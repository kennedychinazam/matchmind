-- REVIEW ONLY. No backfill, source-row rewrite, policy activation or scheduler change.
-- Requires the reviewed bounded-delivery schema and the existing immutable source tables.
begin;
do $$begin
 if to_regclass('public.predictions') is null or to_regclass('public.daily_slips') is null
 or to_regclass('public.fixtures') is null or to_regclass('public.shared_records') is null
 or to_regclass('mm_fixture_delivery.editions') is null
 or to_regprocedure('mm_fixture_delivery.publisher_allowed()') is null then
  raise exception 'Prospective settlement prerequisites missing';
 end if;
 if exists(select 1 from pg_roles where rolname='mm_settlement_owner') then
  raise exception 'Unreviewed settlement role already exists';
 end if;
end$$;
create role mm_settlement_owner nologin noinherit nosuperuser nobypassrls;
create schema mm_settlement authorization mm_settlement_owner;
revoke all on schema mm_settlement from public,anon,authenticated,service_role;
set role mm_settlement_owner;
create table mm_settlement.policy(
 version text primary key check(version='matchmind-settlement/2'),
 active boolean not null default false
);
insert into mm_settlement.policy(version) values('matchmind-settlement/2');
create function mm_settlement.clock() returns timestamptz language sql stable set search_path=pg_catalog as $$select statement_timestamp()$$;
create table mm_settlement.selections(
 id bigint generated always as identity primary key,
 source_kind text not null check(source_kind in ('prediction','slip')),
 source_key text not null, ordinal integer not null check(ordinal>0),
 fxid bigint not null, policy_version text not null references mm_settlement.policy(version),
 original jsonb not null, original_kickoff timestamptz not null,
 market text not null, selection text not null, probability numeric not null check(probability between 0 and 1),
 enrolled_at timestamptz not null default mm_settlement.clock(),
 status text not null default 'unresolved' check(status in ('unresolved','hit','miss','void')),
 reason text not null default 'awaiting_authoritative_evidence',
 evidence jsonb, decided_at timestamptz,
 unique(source_kind,source_key,ordinal),
 check((status='unresolved' and decided_at is null) or
       (status<>'unresolved' and decided_at is not null and evidence is not null))
);
create table mm_settlement.observations(
 fxid bigint primary key, observed_at timestamptz not null, document jsonb not null,
 conflicted boolean not null default false, authority text not null
);
alter table mm_settlement.observations enable row level security;
alter table mm_settlement.policy enable row level security;
alter table mm_settlement.selections enable row level security;
create function mm_settlement.immutable() returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if tg_table_name='policy' then
  if tg_op<>'UPDATE' or old.active or new.version<>old.version or not new.active then
   raise exception 'Policy activation is one-way; no retirement or version replacement';
  end if;
 else
  if tg_op<>'UPDATE' then raise exception 'Settlement ledger cannot be deleted';end if;
  if old.status<>'unresolved' or new.status='unresolved'
   or (to_jsonb(new)-array['status','reason','evidence','decided_at']) is distinct from
      (to_jsonb(old)-array['status','reason','evidence','decided_at']) then
   raise exception 'Only an unresolved selection may receive one final decision';
  end if;
 end if;
 return new;
end$$;
create trigger immutable_policy before update or delete on mm_settlement.policy for each row execute function mm_settlement.immutable();
create trigger immutable_selection before update or delete on mm_settlement.selections for each row execute function mm_settlement.immutable();

-- Exact supported publication codes from gradePick; no unknown-code substring fallback.
create function mm_settlement.grade(code text,h int,a int,hh int,ha int) returns text
language plpgsql immutable set search_path=pg_catalog as $$
declare actual text=case when h>a then '1' when h=a then 'X' else '2' end; won boolean;
begin
 if h is null or a is null or h<0 or a<0 then return null;end if;
 if code in ('1D','2D') then return case when actual='X' then 'void' when left(code,1)=actual then 'hit' else 'miss' end;end if;
 if code in ('1','X','2','1X','X2','12') then won=position(actual in code)>0;
 elsif code in ('O15','U15','O25','U25','O35','U35') then
  won=case when left(code,1)='O' then h+a>substring(code,2)::numeric/10 else h+a<substring(code,2)::numeric/10 end;
 elsif code='BTS' then won=h>0 and a>0;
 elsif code='NBT' then won=not(h>0 and a>0);
 elsif code ~ '^[1X2]/[1X2]$' then
  if hh is null or ha is null or hh<0 or ha<0 or hh>h or ha>a then return null;end if;
  won=left(code,1)=case when hh>ha then '1' when hh=ha then 'X' else '2' end and right(code,1)=actual;
 else return null;
 end if;
 return case when won then 'hit' else 'miss' end;
end$$;

create function mm_settlement.enroll() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v text; enabled boolean; rowdata jsonb=to_jsonb(new); item jsonb; f jsonb; k timestamptz;
 sourcekey text; kind text; n int=0; code text; prob numeric; market_name text;
begin
 select version,active into v,enabled from mm_settlement.policy for share;
 if not enabled then return new;end if;
 if not mm_fixture_delivery.publisher_allowed() then raise exception 'Authoritative publisher required';end if;
 if tg_table_name='predictions' then
  kind='prediction';sourcekey=rowdata->>'fxid';
  if rowdata->>'pick' is null and rowdata->>'pick_prob' is null then return new;end if;
 else
  kind='slip';sourcekey=jsonb_build_array(rowdata->>'day',rowdata->>'tier')::text;
  if jsonb_typeof(rowdata->'legs')<>'array' or jsonb_array_length(rowdata->'legs')=0 then raise exception 'Issued slip requires selections';end if;
 end if;
 for item in select x from jsonb_array_elements(case when kind='prediction' then jsonb_build_array(rowdata) else rowdata->'legs' end) x loop
  n=n+1;
  select to_jsonb(t) into f from (select fxid,provider,date,time,status,gh,ga,ft_h,ft_a,ht_h,ht_a,updated_at from public.fixtures where fxid=(item->>'fxid')::bigint) t;
  if f is null or (f->>'provider') is distinct from 'af' or coalesce(f->>'status','') not in ('NS','TBD') then raise exception 'Issuance requires an accepted upcoming fixture';end if;
  if kind='prediction' then
   if item->>'kickoff' is distinct from f->>'date' or item->>'ktime' is distinct from f->>'time' then raise exception 'Original kickoff must match accepted issuance';end if;
   code=item->>'pick';prob=(item->>'pick_prob')::numeric;
  else
   if item->>'d' is distinct from f->>'date' or (item ? 't' and item->>'t' is distinct from f->>'time') then raise exception 'Slip kickoff differs from issuance';end if;
   code=item->>'code';prob=(item->>'p')::numeric;
  end if;
  -- The accepted schedule is captured at issuance, never reconstructed later from a mutable fixture.
  if f->>'date' !~ '^\d{4}-\d{2}-\d{2}$' or f->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Complete original kickoff required';end if;
  k=((f->>'date')||'T'||(f->>'time')||':00Z')::timestamptz;
  market_name=item->>'market';
  if k<=mm_settlement.clock() or code is null or prob is null or market_name is null
   or not(code in ('1','X','2','1X','X2','12','1D','2D','O15','U15','O25','U25','O35','U35','BTS','NBT') or code ~ '^[1X2]/[1X2]$') then
   raise exception 'Only supported, fully specified pre-match selections may enroll';
  end if;
  insert into mm_settlement.selections(source_kind,source_key,ordinal,fxid,policy_version,original,original_kickoff,market,selection,probability)
  values(kind,sourcekey,n,(item->>'fxid')::bigint,v,item,k,market_name,code,prob);
 end loop;
 return new;
end$$;

-- Only trusted fixture writes are evidence. The caller cannot submit a grade, score or decision document.
-- Run also on the existing edition-refresh cadence, so a standing PST/CANC can cross 48h without a new provider call.
create function mm_settlement.reconcile() returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare r mm_settlement.selections%rowtype; f jsonb; k timestamptz; observed timestamptz;
 h int; a int; hh int; ha int; outcome text; why text; changed int=0; final boolean;
begin
 if not exists(select 1 from mm_settlement.policy where active) then return 0;end if;
 for r in select * from mm_settlement.selections where status='unresolved' order by id for update skip locked loop
  select document into f from mm_settlement.observations where fxid=r.fxid and not conflicted;
  if f is null or (f->>'provider') is distinct from 'af' or nullif(f->>'updated_at','') is null then continue;end if;
  begin
   observed=(f->>'updated_at')::timestamptz;
   k=((f->>'date')||'T'||(f->>'time')||':00Z')::timestamptz;
  exception when others then continue;end;
  if observed<r.enrolled_at or observed>mm_settlement.clock() or k is null then continue;end if;
  outcome=null;why=null;
  -- Interrupted/abandoned/suspended statuses alone never authorize a void, even after a schedule change.
  if f->>'status' in ('ABD','SUSP','INT') then continue;end if;
  final=f->>'status' in ('FT','AET','PEN');
  if final then
   if k>mm_settlement.clock() then continue;end if;
   h=null;a=null;
   if f->>'ft_h' is not null and f->>'ft_a' is not null then
    h=(f->>'ft_h')::int;a=(f->>'ft_a')::int;
    if f->>'gh' is null or f->>'ga' is null or h>(f->>'gh')::int or a>(f->>'ga')::int then continue;end if;
   elsif f->>'status'='FT' and f->>'ft_h' is null and f->>'ft_a' is null then
    h=(f->>'gh')::int;a=(f->>'ga')::int;
   end if;
   if h is null or a is null or h<0 or a<0 then continue;end if;
   hh=(f->>'ht_h')::int;ha=(f->>'ht_a')::int;
   if k-r.original_kickoff>=interval '48 hours' then outcome='void';why='played_at_least_48h_late';
   else
    outcome=mm_settlement.grade(r.selection,h,a,hh,ha);
    why=case when outcome='void' then 'completed_dnb_draw' else 'authoritative_90_minute_result' end;
   end if;
  elsif mm_settlement.clock()-r.original_kickoff>=interval '48 hours' then
   if f->>'status' in ('PST','CANC') then outcome='void';why='accepted_postponement_or_cancellation_48h';
   elsif f->>'status' in ('NS','TBD') and k-r.original_kickoff>=interval '48 hours' then outcome='void';why='accepted_reschedule_at_least_48h';end if;
  end if;
  if outcome is not null then
   update mm_settlement.selections set status=outcome,reason=why,evidence=jsonb_build_object(
    'authority','accepted_publisher_observation','fixture',f,'observed_at',observed,'regulation_home',h,'regulation_away',a),
    decided_at=mm_settlement.clock() where id=r.id and status='unresolved';
   changed=changed+1;
  end if;
 end loop;
 return changed;
end$$;
-- Capture only a trusted publisher/collector observation; a later tick never trusts arbitrary source-table contents.
create function mm_settlement.capture() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare f jsonb; stamp timestamptz;
begin
 if not exists(select 1 from mm_settlement.policy where active) or not mm_fixture_delivery.publisher_allowed() then return new;end if;
 select jsonb_object_agg(key,value) into f from jsonb_each(to_jsonb(new)) where key=any(array['fxid','provider','date','time','status','gh','ga','ft_h','ft_a','ht_h','ht_a','updated_at']);
 if (f->>'provider') is distinct from 'af' or nullif(f->>'updated_at','') is null then return new;end if;
 if f->>'updated_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then return new;end if;
 begin stamp=(f->>'updated_at')::timestamptz;exception when others then return new;end;
 if stamp>mm_settlement.clock() then return new;end if;
 insert into mm_settlement.observations(fxid,observed_at,document,authority)
 values(new.fxid,stamp,f,current_setting('role',true))
 on conflict(fxid) do update set
 document=case when excluded.observed_at>observations.observed_at then excluded.document else observations.document end,
 authority=case when excluded.observed_at>observations.observed_at then excluded.authority else observations.authority end,
 conflicted=case when excluded.observed_at>observations.observed_at then false else observations.conflicted or observations.document<>excluded.document end,
 observed_at=excluded.observed_at
 where excluded.observed_at>=observations.observed_at;
 return new;
end$$;
create function mm_settlement.tick() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 perform mm_settlement.reconcile();return new;
end$$;
create function mm_settlement.freeze_legacy() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 if exists(select 1 from mm_settlement.policy where active) and
 ((tg_op<>'DELETE' and new.key in ('engine','clv')) or (tg_op<>'INSERT' and old.key in ('engine','clv'))) then
  if tg_op='UPDATE' and to_jsonb(old)=to_jsonb(new) then return new;end if;
  raise exception 'Historical engine/CLV aggregates are frozen; use prospective reporting';
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end$$;
create function mm_settlement.report() returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('policy_version','matchmind-settlement/2','active',(select active from mm_settlement.policy),
 'populations',coalesce((select jsonb_object_agg(source_kind,counts) from(
 select source_kind,jsonb_build_object('enrolled',count(*),'unresolved',count(*) filter(where status='unresolved'),
 'hits',count(*) filter(where status='hit'),'misses',count(*) filter(where status='miss'),
 'voids',count(*) filter(where status='void')) counts from mm_settlement.selections group by source_kind)s),'{}'::jsonb));
$$;
revoke all on all functions in schema mm_settlement from public,anon,authenticated,service_role;
reset role;
grant usage on schema public,mm_fixture_delivery to mm_settlement_owner;
grant select(fxid,provider,date,time,status,gh,ga,ft_h,ft_a,ht_h,ht_a,updated_at) on public.fixtures to mm_settlement_owner;
create policy mm_settlement_fixture_read on public.fixtures for select to mm_settlement_owner using(true);
grant execute on function mm_fixture_delivery.publisher_allowed() to mm_settlement_owner;
create trigger mm_enroll_prediction after insert on public.predictions for each row execute function mm_settlement.enroll();
create trigger mm_enroll_slip after insert on public.daily_slips for each row execute function mm_settlement.enroll();
create trigger mm_settle_observation after insert or update on public.fixtures for each row execute function mm_settlement.capture();
create trigger mm_settle_batch after insert or update on public.fixtures for each statement execute function mm_settlement.tick();
create trigger mm_settle_clock after insert on mm_fixture_delivery.editions for each statement execute function mm_settlement.tick();
create trigger mm_freeze_historical_aggregate before insert or update or delete on public.shared_records for each row execute function mm_settlement.freeze_legacy();
-- Fixed aggregate-only public reporting; no raw evidence or caller-controlled selection IDs.
grant usage on schema mm_settlement to anon,authenticated,service_role;
grant execute on function mm_settlement.report() to anon,authenticated,service_role;
grant execute on function mm_settlement.reconcile() to service_role;
create function public.matchmind_prospective_report_v2() returns jsonb language sql stable security invoker set search_path=pg_catalog as $$select mm_settlement.report()$$;
create function public.matchmind_settle_prospective_v2() returns integer language sql security invoker set search_path=pg_catalog as $$select mm_settlement.reconcile()$$;
revoke all on function public.matchmind_prospective_report_v2(),public.matchmind_settle_prospective_v2() from public,anon,authenticated;
grant execute on function public.matchmind_prospective_report_v2() to anon,authenticated,service_role;
grant execute on function public.matchmind_settle_prospective_v2() to service_role;
commit;
