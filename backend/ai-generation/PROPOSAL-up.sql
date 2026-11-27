-- LOCAL REVIEW CANDIDATE ONLY. Do not install during a live v17 generation cutover.
-- Required: stop/drain or otherwise isolate v17 provider work and writes first; preserve usage.
begin;
do $$begin
 if to_regnamespace('mm_ai_generation') is not null then raise exception 'AI generation protocol already exists';end if;
 if to_regclass('public.ai_usage') is null or to_regclass('public.fixtures') is null then raise exception 'Expected MatchMind schema unavailable';end if;
 if to_regprocedure('public.matchmind_display_v1(text)') is null or to_regprocedure('public.matchmind_history_v1(date,bigint)') is null then raise exception 'Approved source RPCs unavailable';end if;
 if to_regprocedure('mm_fixture_delivery.display(text)') is null or to_regprocedure('mm_fixture_delivery.history(date,bigint)') is null then raise exception 'Expected approved inner source functions unavailable';end if;
 if exists(select 1 from public.ai_usage where count<0) then raise exception 'Invalid legacy usage; reconcile explicitly without resetting it';end if;
end$$;
create schema mm_ai_generation;
revoke all on schema mm_ai_generation from public,anon,authenticated;
grant usage on schema mm_ai_generation to service_role;
create table mm_ai_generation.source_acl_baseline(function_identity text primary key,acl text);
insert into mm_ai_generation.source_acl_baseline select oid::regprocedure::text,proacl::text from pg_proc where oid in ('mm_fixture_delivery.display(text)'::regprocedure,'mm_fixture_delivery.history(date,bigint)'::regprocedure);
alter table mm_ai_generation.source_acl_baseline enable row level security;
revoke all on mm_ai_generation.source_acl_baseline from public,anon,authenticated,service_role;
grant select on mm_ai_generation.source_acl_baseline to service_role;
-- Public wrappers are invokers. BYPASSRLS does not bypass this inner EXECUTE ACL.
-- These two functions still return only the existing approved public projection.
grant execute on function mm_fixture_delivery.display(text),mm_fixture_delivery.history(date,bigint) to service_role;
create table mm_ai_generation.refunds(user_id uuid references auth.users(id) on delete cascade,day date,credits integer not null check(credits>=0),primary key(user_id,day));
create table mm_ai_generation.work(
 work_key text primary key,token uuid not null,owner_id uuid references auth.users(id) on delete set null,day date not null,
 state text not null check(state in ('reserved','dispatched','uncertain','complete','known_failure','preflight_failure')),
 fxid bigint,private boolean not null,mode text not null check(mode in ('analysis','context')),provider text not null,prompt_version text not null,source_hash text not null,
 created_at timestamptz not null,lease_until timestamptz not null,dispatched_at timestamptz,completed_at timestamptz,expires_at timestamptz,output jsonb,
 check(private or fxid>0),check(private or state<>'complete' or output is not null)
);
create table mm_ai_generation.reconciliations(resolution_id uuid primary key,work_key text not null,prior_token uuid not null,authorized_at timestamptz not null,note text not null check(length(note) between 1 and 300));
alter table mm_ai_generation.refunds enable row level security;
alter table mm_ai_generation.work enable row level security;
alter table mm_ai_generation.reconciliations enable row level security;
revoke all on mm_ai_generation.refunds,mm_ai_generation.work,mm_ai_generation.reconciliations from public,anon,authenticated,service_role;
grant select,insert,update on mm_ai_generation.refunds,mm_ai_generation.work,mm_ai_generation.reconciliations to service_role;

-- Monotonic physical counter: old v17 writes cannot lower an allocation already recorded.
-- This cannot count legacy provider work that was already dispatched: draining it is a cutover gate.
create function mm_ai_generation.usage_monotonic() returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if new.user_id is distinct from old.user_id or new.day is distinct from old.day or new.count<old.count then raise exception 'AI usage cannot regress';end if;
 return new;
end$$;
revoke all on function mm_ai_generation.usage_monotonic() from public,anon,authenticated;
create trigger mm_ai_usage_monotonic before update on public.ai_usage for each row execute function mm_ai_generation.usage_monotonic();

create function mm_ai_generation.check_envelope(e jsonb,expected_screen text) returns boolean language plpgsql stable security invoker set search_path=pg_catalog as $$begin
 if jsonb_typeof(e) is distinct from 'object' or e->>'version' is distinct from 'matchmind-display/1' or e->>'screen' is distinct from expected_screen
 or jsonb_typeof(e->'cards') is distinct from 'array' or e->>'edition_id' is null or e->>'edition_id' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or jsonb_typeof(e->'as_of') is distinct from 'string' or jsonb_typeof(e->'expires_at') is distinct from 'string'
 or e->>'as_of' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2})$'
 or e->>'expires_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Approved source metadata unavailable';end if;
 if jsonb_array_length(e->'cards')>3000 or (e->>'as_of')::timestamptz>statement_timestamp() or (e->>'expires_at')::timestamptz<=statement_timestamp()
 or (e->>'expires_at')::timestamptz<=(e->>'as_of')::timestamptz or (e->>'expires_at')::timestamptz-(e->>'as_of')::timestamptz>interval '24hours' then raise exception 'Approved source metadata unavailable';end if;
 return true;
end$$;
create function mm_ai_generation.source(fx bigint) returns jsonb language plpgsql stable security invoker set search_path=pg_catalog as $$
declare e jsonb;c jsonb;v jsonb;d date;identity text;screen text;asof timestamptz;expiry timestamptz;
begin
 if fx is null or fx<1 or fx>9007199254740991 then raise exception 'Invalid fixture';end if;
 foreach screen in array array['predictions','history','scores'] loop
  e=public.matchmind_display_v1(screen);
  perform mm_ai_generation.check_envelope(e,screen);
  if identity is not null and (identity<>e->>'edition_id' or asof is distinct from (e->>'as_of')::timestamptz or expiry is distinct from (e->>'expires_at')::timestamptz) then raise exception 'Approved source changed';end if;
  identity=e->>'edition_id';asof=(e->>'as_of')::timestamptz;expiry=(e->>'expires_at')::timestamptz;
  select x into c from jsonb_array_elements(e->'cards') x where (x->>'fxid')::bigint=fx limit 1;
  exit when c is not null;
 end loop;
 if c is null then
  -- Only date/ID locates a bounded existing public history page; the public RPC decides visibility.
  select f.date into d from public.fixtures f where f.fxid=fx;
  if d is not null then
   e=public.matchmind_history_v1(d,fx+1);
   perform mm_ai_generation.check_envelope(e,'history');
   if e->>'edition_id'<>identity or asof is distinct from (e->>'as_of')::timestamptz or expiry is distinct from (e->>'expires_at')::timestamptz then raise exception 'Approved source changed';end if;
   select x into c from jsonb_array_elements(e->'cards') x where (x->>'fxid')::bigint=fx limit 1;
  end if;
 end if;
 if c is null then return null;end if;
 v=jsonb_build_object('version','matchmind-ai-source/1','fxid',fx,'fixture',jsonb_build_object(
 'fxid',fx,'lid',c->'lid','lname',c->'lname','lcountry',c->'lcountry','home',c->'home','away',c->'away','date',c->'date','time',c->'time','status',c->'status'),
 'prediction',c->'prediction');
 return jsonb_build_object('snapshot',v,'source_hash',encode(sha256(convert_to(v::text,'UTF8')),'hex'));
end$$;
create function public.mm_ai_source_v1(fxid bigint) returns jsonb language sql stable security invoker set search_path=pg_catalog as $$select mm_ai_generation.source(fxid)$$;

create function mm_ai_generation.quota(uid uuid,d date) returns integer language sql stable security invoker set search_path=pg_catalog as $$
 select greatest(coalesce((select count from public.ai_usage where user_id=uid and day=d),0)-coalesce((select credits from mm_ai_generation.refunds where user_id=uid and day=d),0),0)
$$;
create function public.mm_ai_quota_v1(user_id uuid) returns jsonb language sql stable security invoker set search_path=pg_catalog as $$
 select jsonb_build_object('used',mm_ai_generation.quota(user_id,(statement_timestamp() at time zone 'UTC')::date),'quota_day',(statement_timestamp() at time zone 'UTC')::date)
$$;
-- Exactly-once retirement of a proven pre-dispatch lease. Called outside a different
-- owner's allocation transaction so that the usage-row/work-row lock order is preserved.
create function public.mm_ai_recover_predispatch_v1(work_key text,lease_token uuid) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare w mm_ai_generation.work%rowtype;
begin
 select * into w from mm_ai_generation.work x where x.work_key=mm_ai_recover_predispatch_v1.work_key;
 if not found then return jsonb_build_object('ok',false);end if;
 if w.owner_id is not null then perform 1 from public.ai_usage u where u.user_id=w.owner_id and u.day=w.day for update;end if;
 select * into w from mm_ai_generation.work x where x.work_key=mm_ai_recover_predispatch_v1.work_key for update;
 if w.token is distinct from lease_token or w.state<>'reserved' or w.lease_until>statement_timestamp() then return jsonb_build_object('ok',false);end if;
 if w.owner_id is not null then insert into mm_ai_generation.refunds(user_id,day,credits) values(w.owner_id,w.day,1) on conflict(user_id,day) do update set credits=mm_ai_generation.refunds.credits+1;end if;
 update mm_ai_generation.work x set state='preflight_failure',token=gen_random_uuid(),owner_id=null,completed_at=statement_timestamp() where x.work_key=w.work_key;
 return jsonb_build_object('ok',true);
end$$;
create function public.mm_ai_prepare_v1(document jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare uid uuid=(document->>'user_id')::uuid;d date=(statement_timestamp() at time zone 'UTC')::date;
 lim integer=(document->>'limit')::integer;fx bigint=(document->>'fxid')::bigint;priv boolean=coalesce((document->>'private')::boolean,false);
 mode_ text=document->>'mode';provider_ text=document->>'provider';ver text=document->>'prompt_version';h text=document->>'source_hash';
 key_ text;src jsonb;w mm_ai_generation.work%rowtype;used_ integer;t uuid;
begin
 if uid is null or lim is null or lim<1 or mode_ not in ('analysis','context') or provider_ not in ('gemini','claude','deepseek','kimi') or ver is null or length(ver)>100 or h !~ '^[a-f0-9]{64}$' then raise exception 'Invalid AI allocation';end if;
 if not priv then src=mm_ai_generation.source(fx);if src is null or src->>'source_hash'<>h then return jsonb_build_object('status','source_changed');end if;end if;
 key_=encode(sha256(convert_to(jsonb_build_array(case when priv then uid::text else 'shared' end,fx,mode_,provider_,ver,h)::text,'UTF8')),'hex');
 -- Usage row first, then work row, is the lock order for every mutation below.
 insert into public.ai_usage(user_id,day,count) values(uid,d,0) on conflict do nothing;
 perform 1 from public.ai_usage where user_id=uid and day=d for update;
 -- Serialize absent-key claims without persisting a sentinel for quota-denied inputs.
 perform pg_advisory_xact_lock(hashtextextended(key_,0));
 select * into w from mm_ai_generation.work where work_key=key_ for update;
 used_=mm_ai_generation.quota(uid,d);
 if not priv and w.state='complete' and w.expires_at>statement_timestamp() then return jsonb_build_object('status','cached','output',w.output,'used',used_,'quota_day',d);end if;
 if w.state in ('dispatched','uncertain') then return jsonb_build_object('status','uncertain','used',used_,'quota_day',d);end if;
 if w.state='reserved' then
  if w.lease_until>statement_timestamp() then return jsonb_build_object('status','busy','used',used_,'quota_day',d);end if;
  -- Refund and fence the old token before every possible quota return. Cross-owner
  -- recovery takes place in its own transaction, avoiding a reversed usage-row lock order.
  if w.owner_id is distinct from uid or w.day<>d then return jsonb_build_object('status','recoverable','work_key',w.work_key,'lease_token',w.token,'used',used_,'quota_day',d);end if;
  perform public.mm_ai_recover_predispatch_v1(w.work_key,w.token);
  used_=mm_ai_generation.quota(uid,d);
 end if;
 if used_>=lim then return jsonb_build_object('status','quota','used',used_,'quota_day',d);end if;
 update public.ai_usage set count=count+1,updated_at=statement_timestamp() where user_id=uid and day=d;
 t=gen_random_uuid();
 insert into mm_ai_generation.work(work_key,token,owner_id,day,state,fxid,private,mode,provider,prompt_version,source_hash,created_at,lease_until)
 values(key_,t,uid,d,'reserved',fx,priv,mode_,provider_,ver,h,statement_timestamp(),statement_timestamp()+interval '2 minutes')
 on conflict(work_key) do update set token=excluded.token,owner_id=excluded.owner_id,day=excluded.day,state='reserved',source_hash=excluded.source_hash,created_at=excluded.created_at,lease_until=excluded.lease_until,dispatched_at=null,completed_at=null,expires_at=null,output=null;
 return jsonb_build_object('status','reserved','work_key',key_,'lease_token',t,'used',used_+1,'quota_day',d);
end$$;

create function public.mm_ai_mark_dispatch_v1(work_key text,lease_token uuid,user_id uuid) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare w mm_ai_generation.work%rowtype;
begin
 select * into w from mm_ai_generation.work x where x.work_key=mm_ai_mark_dispatch_v1.work_key;
 if not found or w.owner_id is distinct from user_id then return jsonb_build_object('ok',false);end if;
 perform 1 from public.ai_usage u where u.user_id=w.owner_id and u.day=w.day for update;
 update mm_ai_generation.work x set state='dispatched',dispatched_at=statement_timestamp() where x.work_key=w.work_key and x.token=lease_token and x.owner_id=user_id and x.state='reserved' and x.lease_until>statement_timestamp();
 return jsonb_build_object('ok',found);
end$$;

-- OPERATOR ONLY, NEVER CALLED BY THE HANDLER. Reconciliation authorizes another
-- charged attempt; it does not establish whether the earlier external call was billed.
create function public.mm_ai_authorize_retry_v1(work_key text,lease_token uuid,resolution_id uuid,note text) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare w mm_ai_generation.work%rowtype;
begin
 if resolution_id is null or note is null or length(note) not between 1 and 300 then raise exception 'Explicit reconciliation evidence required';end if;
 select * into w from mm_ai_generation.work x where x.work_key=mm_ai_authorize_retry_v1.work_key;
 if not found then return jsonb_build_object('ok',false);end if;
 if w.owner_id is not null then perform 1 from public.ai_usage u where u.user_id=w.owner_id and u.day=w.day for update;end if;
 select * into w from mm_ai_generation.work x where x.work_key=mm_ai_authorize_retry_v1.work_key for update;
 if w.token is distinct from lease_token or w.state not in ('dispatched','uncertain') or w.dispatched_at is null or w.dispatched_at+interval '15 minutes'>statement_timestamp() then return jsonb_build_object('ok',false);end if;
 insert into mm_ai_generation.reconciliations values(resolution_id,w.work_key,w.token,statement_timestamp(),note);
 update mm_ai_generation.work x set state='known_failure',token=gen_random_uuid(),owner_id=null,completed_at=statement_timestamp() where x.work_key=w.work_key;
 return jsonb_build_object('ok',true,'prior_allocation_retained',true);
end$$;

create function public.mm_ai_finish_v1(document jsonb) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare key_ text=document->>'work_key';tok uuid=(document->>'lease_token')::uuid;uid uuid=(document->>'user_id')::uuid;kind text=document->>'outcome';
 w mm_ai_generation.work%rowtype;src jsonb;out_ jsonb=document->'output';used_ integer;
begin
 select * into w from mm_ai_generation.work where work_key=key_;
 if not found or w.owner_id is distinct from uid then return jsonb_build_object('ok',false,'reason','stale');end if;
 perform 1 from public.ai_usage where user_id=uid and day=w.day for update;
 select * into w from mm_ai_generation.work where work_key=key_ for update;
 if w.token is distinct from tok or w.owner_id is distinct from uid then return jsonb_build_object('ok',false,'reason','stale');end if;
 if kind='preflight_failure' and w.state='reserved' then
  insert into mm_ai_generation.refunds(user_id,day,credits) values(uid,w.day,1) on conflict(user_id,day) do update set credits=mm_ai_generation.refunds.credits+1;
  update mm_ai_generation.work set state='preflight_failure',completed_at=statement_timestamp(),owner_id=null where work_key=key_;
 elsif kind='uncertain' and w.state='dispatched' then
  update mm_ai_generation.work set state='uncertain' where work_key=key_;
 elsif kind='known_failure' and w.state in ('dispatched','uncertain') then
  update mm_ai_generation.work set state='known_failure',completed_at=statement_timestamp(),owner_id=null where work_key=key_;
 elsif kind='complete' and w.state in ('dispatched','uncertain') then
  if jsonb_typeof(out_) is distinct from 'object' or jsonb_typeof(out_->'text') is distinct from 'string'
   or length(btrim(out_->>'text')) not between 1 and 32768 or octet_length(out_::text)>65536 then raise exception 'Invalid AI output';end if;
  if not w.private then
   src=mm_ai_generation.source(w.fxid);
   if src is null or src->>'source_hash'<>w.source_hash then
    update mm_ai_generation.work set state='known_failure',completed_at=statement_timestamp(),owner_id=null where work_key=key_;
    return jsonb_build_object('ok',false,'reason','source_changed','used',mm_ai_generation.quota(uid,w.day),'quota_day',w.day);
   end if;
  end if;
  update mm_ai_generation.work set state='complete',completed_at=statement_timestamp(),owner_id=null,
   output=case when w.private then null else out_ end,
   expires_at=case when w.private then null else statement_timestamp()+case when w.mode='context' then interval '6 hours' else interval '12 hours' end end where work_key=key_;
 else return jsonb_build_object('ok',false,'reason','stale');end if;
 used_=mm_ai_generation.quota(uid,w.day);
 return jsonb_build_object('ok',true,'used',used_,'quota_day',w.day);
end$$;

revoke all on all functions in schema mm_ai_generation from public,anon,authenticated;
grant execute on all functions in schema mm_ai_generation to service_role;
revoke all on function public.mm_ai_source_v1(bigint),public.mm_ai_quota_v1(uuid),public.mm_ai_prepare_v1(jsonb),public.mm_ai_mark_dispatch_v1(text,uuid,uuid),public.mm_ai_finish_v1(jsonb),public.mm_ai_recover_predispatch_v1(text,uuid),public.mm_ai_authorize_retry_v1(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.mm_ai_source_v1(bigint),public.mm_ai_quota_v1(uuid),public.mm_ai_prepare_v1(jsonb),public.mm_ai_mark_dispatch_v1(text,uuid,uuid),public.mm_ai_finish_v1(jsonb),public.mm_ai_recover_predispatch_v1(text,uuid),public.mm_ai_authorize_retry_v1(text,uuid,uuid,text) to service_role;
commit;
