-- UNEXECUTED LOCAL PROPOSAL ONLY. Production shape captured 2026-11-27T02:49:05Z.
-- Staging differs: do not install there. No historical rewrite, DELETE or retention change.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.predictions in share row exclusive mode;
do $$begin
 if to_regnamespace('mm_prediction_integrity') is not null or exists(select 1 from pg_roles where rolname='mm_prediction_guard') then raise exception 'Prediction guard already exists';end if;
 if exists(select 1 from pg_trigger where tgrelid='public.predictions'::regclass and not tgisinternal) then raise exception 'Unreviewed prediction trigger';end if;
 if not exists(select 1 from pg_attribute where attrelid='public.predictions'::regclass and attname='final_prob' and atttypid='real'::regtype and not attisdropped) or not exists(select 1 from pg_attribute where attrelid='public.predictions'::regclass and attname='final_at' and atttypid='timestamptz'::regtype and not attisdropped) then raise exception 'Production metadata columns required; staging adaptation is separate';end if;
 if exists(select 1 from pg_attribute where attrelid='public.predictions'::regclass and attnum>0 and not attisdropped and has_column_privilege('authenticated','public.predictions',attnum,'UPDATE')<>(attname=any(array['final_pick','final_prob','final_at','withheld_at']))) then raise exception 'Unexpected authenticated UPDATE scope';end if;
 if has_table_privilege('authenticated','public.predictions','DELETE') or has_table_privilege('anon','public.predictions','INSERT') then raise exception 'Unexpected client mutation grants';end if;
end$$;
create role mm_prediction_guard nologin noinherit nosuperuser nobypassrls;
-- Temporary installer membership only; no API/service role membership is added.
grant mm_prediction_guard to current_user with set true, inherit false;
create schema mm_prediction_integrity authorization mm_prediction_guard;
revoke all on schema mm_prediction_integrity from public,anon,authenticated,service_role;
grant usage on schema public to mm_prediction_guard;
grant select(fxid,lid,date,time,status,home,away),update(fxid) on public.fixtures to mm_prediction_guard;
grant select(fxid) on public.predictions to mm_prediction_guard;
-- FOR SHARE needs UPDATE privilege and an applicable UPDATE USING predicate. Actual writes
-- remain denied by WITH CHECK(false); this NOLOGIN owner is not a client-accessible role.
create policy prediction_guard_fixture_read on public.fixtures for select to mm_prediction_guard using(true);
create policy prediction_guard_fixture_lock on public.fixtures for update to mm_prediction_guard using(true) with check(false);
create function mm_prediction_integrity.kickoff(d date,t text) returns timestamptz
language plpgsql immutable set search_path=pg_catalog as $fn$
declare raw text:=t; parsed time; stamp timestamptz;
begin
 if d is null or not isfinite(d) or t is null or t<>btrim(t) then raise exception 'A verified UTC kickoff time is required' using errcode='23514';end if;
 if raw ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{1,2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,6})?)?(Z|[+]00:00)?$' then
  if left(raw,10)<>to_char(d,'YYYY-MM-DD') then raise exception 'Kickoff date/time mismatch' using errcode='23514';end if;
  raw=substring(raw from 12);raw=regexp_replace(raw,'(Z|[+]00:00)$','');
 end if;
 if raw !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,6})?)?$' then raise exception 'A verified UTC kickoff time is required' using errcode='23514';end if;
 parsed=raw::time;stamp=(d+parsed) at time zone 'UTC';return stamp;
end$fn$;
alter function mm_prediction_integrity.kickoff(date,text) owner to mm_prediction_guard;
revoke all on function mm_prediction_integrity.kickoff(date,text) from public,anon,authenticated,service_role;
create function mm_prediction_integrity.guard() returns trigger
language plpgsql security definer set search_path=pg_catalog as $fn$
declare f record; stamp timestamptz; ko timestamptz; original_ko timestamptz; cutoff timestamptz;
 changed_final boolean;changed_withheld boolean;
begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-array['final_pick','final_prob','final_at','withheld_at']) is distinct from (to_jsonb(old)-array['final_pick','final_prob','final_at','withheld_at']) then raise exception 'Published prediction fields are immutable' using errcode='23514';end if;
  changed_final=(new.final_pick,new.final_prob,new.final_at) is distinct from (old.final_pick,old.final_prob,old.final_at);
  changed_withheld=new.withheld_at is distinct from old.withheld_at;
  if not changed_final and not changed_withheld then return new;end if;
 else
  -- BEFORE INSERT also runs for an ignored duplicate. Preserve first-writer-wins replay,
  -- including after kickoff, without admitting any changed original through UPDATE.
  if exists(select 1 from public.predictions p where p.fxid=new.fxid) then return new;end if;
 end if;
 select x.fxid,x.lid,x.date,x.time,x.status,x.home,x.away into f from public.fixtures x where x.fxid=new.fxid for share;
 if not found then raise exception 'Prediction fixture is unavailable' using errcode='23503';end if;
 -- A waiting statement's start time is NOT the issuance clock. Sample after the real row lock.
 stamp=clock_timestamp();ko=mm_prediction_integrity.kickoff(f.date,f.time);
 if tg_op='INSERT' then
  -- Matching NULLs/empty labels do not establish an identity for NEW issuance.
  -- Existing originals and unchanged legacy metadata no-ops were handled above.
  if f.fxid is null or f.fxid<=0 or f.lid is null or f.lid<=0 or f.home is null or length(btrim(f.home)) not between 1 and 160 or f.away is null or length(btrim(f.away)) not between 1 and 160 then raise exception 'Canonical fixture identity is incomplete' using errcode='23514';end if;
  if new.fxid is null or new.lid is distinct from f.lid or new.home is distinct from f.home or new.away is distinct from f.away or new.kickoff is distinct from f.date or mm_prediction_integrity.kickoff(new.kickoff,new.ktime) is distinct from ko then raise exception 'Prediction identity does not match fixture' using errcode='23514';end if;
  if new.build=-1 then
   if f.status is null or f.status<>all(array['FT','FINISHED','AET','PEN']) or ko>=stamp then raise exception 'Reconstruction requires a canonical past finished fixture' using errcode='23514';end if;
  else
   if new.build is null or new.build<1 or new.build>1000000 or f.status is distinct from 'NS' or ko<=stamp or f.date>(stamp at time zone 'UTC')::date+5 then raise exception 'Live prediction must be issued before verified kickoff within the publication window' using errcode='23514';end if;
  end if;
  if new.final_pick is not null or new.final_prob is not null or new.final_at is not null or new.withheld_at is not null then raise exception 'New prediction cannot supply later metadata events' using errcode='23514';end if;
  new.made_at=stamp;return new;
 end if;
 original_ko=mm_prediction_integrity.kickoff(old.kickoff,old.ktime);cutoff=least(original_ko,ko);
 if f.status is distinct from 'NS' or stamp>=cutoff then raise exception 'Prediction metadata is closed at kickoff' using errcode='23514';end if;
 if changed_final then
  if new.final_pick is null or length(btrim(new.final_pick)) not between 1 and 160 or new.final_prob is null or new.final_prob<0 or new.final_prob>1 or new.final_prob='NaN'::real then raise exception 'Invalid drift metadata' using errcode='23514';end if;
  new.final_at=stamp;
 end if;
 if changed_withheld then
  if old.withheld_at is not null or new.withheld_at is null then raise exception 'Withdrawal is a first event and cannot be cleared or replaced' using errcode='23514';end if;
  new.withheld_at=stamp;
 end if;
 return new;
end$fn$;
alter function mm_prediction_integrity.guard() owner to mm_prediction_guard;
revoke all on function mm_prediction_integrity.guard() from public,anon,authenticated,service_role;
create trigger mm_prediction_integrity before insert or update on public.predictions for each row execute function mm_prediction_integrity.guard();
-- No DELETE trigger or client privilege change in MM-06.
revoke mm_prediction_guard from current_user;
commit;
