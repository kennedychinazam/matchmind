-- LOCAL, UNEXECUTED PROPOSAL. Named production catalog: 2026-11-27T04:58:39Z.
-- Do not install without matched sender/AI/client cutover, drain, retention and rollback review.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$begin
 if to_regnamespace('mm_account_lifecycle') is not null then raise exception 'Lifecycle protocol already exists';end if;
 if not has_column_privilege(current_user,'auth.users','id','SELECT') or not has_column_privilege(current_user,'auth.users','id','UPDATE') then raise exception 'Reviewed installer auth lock privilege required';end if;
 if to_regclass('public.push_subscriptions') is null or to_regclass('public.push_sent') is null or to_regclass('public.app_state') is null or to_regclass('public.profiles') is null or to_regclass('public.ai_usage') is null then raise exception 'Lifecycle source schema missing';end if;
 if exists(select 1 from pg_trigger where tgrelid in ('public.push_subscriptions'::regclass,'public.push_sent'::regclass,'public.app_state'::regclass,'public.profiles'::regclass,'public.ai_usage'::regclass) and not tgisinternal and tgname<>'mm_ai_usage_monotonic') then raise exception 'Unreviewed lifecycle trigger';end if;
end$$;
create schema mm_account_lifecycle;
revoke all on schema mm_account_lifecycle from public,anon,authenticated;
grant usage on schema mm_account_lifecycle to service_role;
create table mm_account_lifecycle.jobs(
 job_id uuid primary key default gen_random_uuid(),
 user_id uuid unique not null, -- deliberately no auth FK: recovery survives login deletion
 token uuid not null default gen_random_uuid(),
 state text not null check(state in('requested','cleaned','auth_dispatched','auth_unconfirmed','completed')),
 requested_at timestamptz not null,lease_until timestamptz,
 cleaned_at timestamptz,auth_dispatched_at timestamptz,completed_at timestamptz,
 counts jsonb not null default '{}',last_error text
);
create table mm_account_lifecycle.resolutions(
 resolution_id uuid primary key,job_id uuid not null references mm_account_lifecycle.jobs(job_id),
 prior_token uuid not null,resolution text not null check(resolution in('auth_absent','auth_present_retry')),
 note text not null check(length(btrim(note)) between 1 and 300),at timestamptz not null
);
alter table mm_account_lifecycle.jobs enable row level security;
alter table mm_account_lifecycle.resolutions enable row level security;
revoke all on mm_account_lifecycle.jobs,mm_account_lifecycle.resolutions from public,anon,authenticated,service_role;
-- NOT VALID retains existing orphan rows; all NEW writes are checked. No validation or cleanup.
alter table public.push_subscriptions add constraint mm_lifecycle_subscription_owner_fk foreign key(user_id) references auth.users(id) on delete cascade not valid;
alter table public.push_sent add constraint mm_lifecycle_sent_endpoint_fk foreign key(endpoint) references public.push_subscriptions(endpoint) on delete cascade not valid;
-- RLS and row triggers do not protect TRUNCATE. No browser operation needs this capability.
revoke truncate on public.push_subscriptions,public.push_sent,public.app_state,public.profiles,public.ai_usage from anon,authenticated;

create function mm_account_lifecycle.rc() returns void language plpgsql volatile set search_path=pg_catalog as $$begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Lifecycle writes require READ COMMITTED' using errcode='25001';end if;
end$$;
create function mm_account_lifecycle.lock_subject(uid uuid) returns void language plpgsql volatile set search_path=pg_catalog as $$begin
 if uid is null then raise exception 'A subject is required' using errcode='22023';end if;
 perform mm_account_lifecycle.rc();
 perform pg_advisory_xact_lock(hashtextextended('mm-account-lifecycle:'||uid::text,0));
end$$;
create function mm_account_lifecycle.guard_personal_write() returns trigger language plpgsql volatile security definer set search_path=pg_catalog as $$
declare uid uuid;old_uid uuid;
begin
 perform mm_account_lifecycle.rc();
 if tg_table_name='profiles' then uid=new.id;if tg_op='UPDATE' then old_uid=old.id;end if;
 else uid=new.user_id;if tg_op='UPDATE' then old_uid=old.user_id;end if;end if;
 if uid is null or (tg_op='UPDATE' and uid is distinct from old_uid) then raise exception 'Personal owner cannot be reassigned' using errcode='23514';end if;
 -- Admission waits for prior writers here, then commits its fence BEFORE public cleanup.
 perform 1 from auth.users where id=uid for key share;
 if not found then raise exception 'Account is unavailable' using errcode='23503';end if;
 if exists(select 1 from mm_account_lifecycle.jobs where user_id=uid) then raise exception 'Account deletion is pending or complete' using errcode='23514';end if;
 return new;
end$$;
create trigger mm_lifecycle_guard_subscription before insert or update on public.push_subscriptions for each row execute function mm_account_lifecycle.guard_personal_write();
create trigger mm_lifecycle_guard_state before insert or update on public.app_state for each row execute function mm_account_lifecycle.guard_personal_write();
create trigger mm_lifecycle_guard_profile before insert or update on public.profiles for each row execute function mm_account_lifecycle.guard_personal_write();

create function mm_account_lifecycle.prepare(uid uuid) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j mm_account_lifecycle.jobs%rowtype;live boolean;
begin
 perform mm_account_lifecycle.lock_subject(uid);
 -- This transaction NEVER writes public personal rows. Separate admission/cleanup is required.
 perform 1 from auth.users where id=uid for update;live=found;
 select * into j from mm_account_lifecycle.jobs where user_id=uid for update;
 if not found then
  if not live then return jsonb_build_object('ok',false,'reason','subject_missing');end if;
  insert into mm_account_lifecycle.jobs(user_id,state,requested_at,lease_until) values(uid,'requested',clock_timestamp(),clock_timestamp()+interval '2minutes') returning * into j;
 elsif j.state='completed' then return jsonb_build_object('ok',true,'status','completed','job_id',j.job_id,'state',j.state);
 elsif not live then
  update mm_account_lifecycle.jobs set state='auth_unconfirmed',lease_until=null,last_error='subject_missing' where job_id=j.job_id returning * into j;
  return jsonb_build_object('ok',false,'status','auth_unconfirmed','job_id',j.job_id,'state',j.state);
 elsif j.state in('auth_dispatched','auth_unconfirmed') then
  return jsonb_build_object('ok',false,'status','auth_unconfirmed','job_id',j.job_id,'state',j.state);
 elsif j.lease_until>clock_timestamp() then return jsonb_build_object('ok',false,'status','busy','job_id',j.job_id,'state',j.state);
 else
  update mm_account_lifecycle.jobs set token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2minutes',last_error=null where job_id=j.job_id returning * into j;
 end if;
 return jsonb_build_object('ok',true,'status','reserved','job_id',j.job_id,'lease_token',j.token,'state',j.state);
end$$;
create function mm_account_lifecycle.cleanup(jid uuid,tok uuid) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j mm_account_lifecycle.jobs%rowtype;uid uuid;n_sent bigint;n_subs bigint;
begin
 select user_id into uid from mm_account_lifecycle.jobs where job_id=jid;
 if uid is null then return jsonb_build_object('ok',false,'reason','unknown_job');end if;
 perform mm_account_lifecycle.lock_subject(uid);
 select * into j from mm_account_lifecycle.jobs where job_id=jid for update;
 if j.token is distinct from tok then return jsonb_build_object('ok',false,'reason','stale_token');end if;
 if j.state not in('requested','cleaned') or j.lease_until is null or j.lease_until<=clock_timestamp() then return jsonb_build_object('ok',false,'reason','stage_or_lease');end if;
 if j.state='cleaned' then return jsonb_build_object('ok',true,'status','cleaned','counts',j.counts);end if;
 -- All endpoint resolution/deletion plus journal state is one rollback unit.
 perform s.endpoint from public.push_subscriptions s where s.user_id=uid order by s.endpoint for update;
 delete from public.push_sent p using public.push_subscriptions s where s.user_id=uid and p.endpoint=s.endpoint;
 get diagnostics n_sent=row_count;
 delete from public.push_subscriptions where user_id=uid;
 get diagnostics n_subs=row_count;
 update mm_account_lifecycle.jobs set state='cleaned',cleaned_at=clock_timestamp(),counts=jsonb_build_object('push_sent',n_sent,'push_subscriptions',n_subs),last_error=null where job_id=jid;
 return jsonb_build_object('ok',true,'status','cleaned','counts',jsonb_build_object('push_sent',n_sent,'push_subscriptions',n_subs));
end$$;
create function mm_account_lifecycle.mark_auth(jid uuid,tok uuid) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j mm_account_lifecycle.jobs%rowtype;uid uuid;
begin
 select user_id into uid from mm_account_lifecycle.jobs where job_id=jid;
 if uid is null then return jsonb_build_object('ok',false,'reason','unknown_job');end if;
 perform mm_account_lifecycle.lock_subject(uid);
 select * into j from mm_account_lifecycle.jobs where job_id=jid for update;
 if j.token is distinct from tok then return jsonb_build_object('ok',false,'reason','stale_token');end if;
 if j.state<>'cleaned' or j.lease_until is null or j.lease_until<=clock_timestamp() then return jsonb_build_object('ok',false,'reason','stage_or_lease');end if;
 update mm_account_lifecycle.jobs set state='auth_dispatched',auth_dispatched_at=clock_timestamp(),lease_until=null where job_id=jid;
 return jsonb_build_object('ok',true,'status','auth_dispatched');
end$$;
create function mm_account_lifecycle.finish(jid uuid,tok uuid,outcome text) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j mm_account_lifecycle.jobs%rowtype;uid uuid;
begin
 select user_id into uid from mm_account_lifecycle.jobs where job_id=jid;
 if uid is null then return jsonb_build_object('ok',false,'reason','unknown_job');end if;
 perform mm_account_lifecycle.lock_subject(uid);
 select * into j from mm_account_lifecycle.jobs where job_id=jid for update;
 if j.token is distinct from tok then return jsonb_build_object('ok',false,'reason','stale_token');end if;
 if j.state='completed' then return jsonb_build_object('ok',true,'status','completed','counts',j.counts);end if;
 if j.state not in('auth_dispatched','auth_unconfirmed') then return jsonb_build_object('ok',false,'reason','stage');end if;
 if outcome in('auth_error','auth_unconfirmed') then
  update mm_account_lifecycle.jobs set state='auth_unconfirmed',last_error=outcome,lease_until=null where job_id=jid;
  return jsonb_build_object('ok',false,'status','auth_unconfirmed');
 end if;
 if outcome is distinct from 'complete' then raise exception 'Invalid deletion outcome' using errcode='22023';end if;
 if exists(select 1 from auth.users where id=uid) or exists(select 1 from public.app_state where user_id=uid) or exists(select 1 from public.profiles where id=uid) or exists(select 1 from public.ai_usage where user_id=uid) or exists(select 1 from public.push_subscriptions where user_id=uid) then
  update mm_account_lifecycle.jobs set state='auth_unconfirmed',last_error='absence_unverified',lease_until=null where job_id=jid;
  return jsonb_build_object('ok',false,'status','auth_unconfirmed','reason','absence_unverified');
 end if;
 update mm_account_lifecycle.jobs set state='completed',completed_at=clock_timestamp(),lease_until=null,last_error=null where job_id=jid;
 return jsonb_build_object('ok',true,'status','completed','counts',j.counts);
end$$;
create function mm_account_lifecycle.reconcile(jid uuid,tok uuid,rid uuid,kind text,reason text) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare j mm_account_lifecycle.jobs%rowtype;uid uuid;answer jsonb;
begin
 if rid is null or kind is null or kind not in('auth_absent','auth_present_retry') or reason is null or length(btrim(reason)) not between 1 and 300 then raise exception 'A unique reconciliation and bounded note are required' using errcode='22023';end if;
 select user_id into uid from mm_account_lifecycle.jobs where job_id=jid;
 if uid is null then return jsonb_build_object('ok',false,'reason','unknown_job');end if;
 perform mm_account_lifecycle.lock_subject(uid);
 select * into j from mm_account_lifecycle.jobs where job_id=jid for update;
 if j.token is distinct from tok then return jsonb_build_object('ok',false,'reason','stale_token');end if;
 if j.state not in('auth_dispatched','auth_unconfirmed') then return jsonb_build_object('ok',false,'reason','stage');end if;
 if exists(select 1 from mm_account_lifecycle.resolutions where resolution_id=rid) then return jsonb_build_object('ok',false,'reason','resolution_used');end if;
 -- Service/operator attests exact getUserById and old-call drain resolution. This is not a timer takeover.
 if kind='auth_absent' then
  answer=mm_account_lifecycle.finish(jid,tok,'complete');
  if answer->>'status' is distinct from 'completed' then return answer;end if;
 else
  perform 1 from auth.users where id=uid for update;
  if not found then return jsonb_build_object('ok',false,'reason','subject_missing');end if;
  update mm_account_lifecycle.jobs set token=gen_random_uuid(),state='cleaned',lease_until=clock_timestamp()+interval '2minutes',last_error=null where job_id=jid returning * into j;
  answer=jsonb_build_object('ok',true,'status','reserved','job_id',j.job_id,'lease_token',j.token,'state',j.state);
 end if;
 insert into mm_account_lifecycle.resolutions values(rid,jid,tok,kind,btrim(reason),clock_timestamp());
 return answer;
end$$;
create function mm_account_lifecycle.push_allowed(ep text,uid uuid,ver timestamptz) returns boolean language sql volatile security definer set search_path=pg_catalog as $$
 select uid is not null and exists(select 1 from public.push_subscriptions s join auth.users u on u.id=s.user_id where s.endpoint=ep and s.user_id=uid and s.updated_at is not distinct from ver) and not exists(select 1 from mm_account_lifecycle.jobs j where j.user_id=uid)
$$;
create function mm_account_lifecycle.push_record(ep text,uid uuid,ver timestamptz,key_ text) returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$begin
 perform mm_account_lifecycle.rc();
 if uid is null or ep is null or length(ep) not between 1 and 4096 or key_ is null or length(btrim(key_)) not between 1 and 200 then raise exception 'Invalid push completion identity' using errcode='22023';end if;
 perform 1 from auth.users where id=uid for key share;
 if not found then return false;end if;
 if exists(select 1 from mm_account_lifecycle.jobs where user_id=uid) then return false;end if;
 -- SHARE also blocks non-key updated_at changes; KEY SHARE alone would not fence generation.
 perform 1 from public.push_subscriptions s where s.endpoint=ep and s.user_id=uid and s.updated_at is not distinct from ver for share;
 if not found then return false;end if;
 insert into public.push_sent(endpoint,dedupe_key,sent_at) values(ep,key_,clock_timestamp()) on conflict(endpoint,dedupe_key) do update set sent_at=excluded.sent_at;
 return true;
end$$;

-- Small public invoker wrappers are service-only. No public arbitrary-subject deletion route.
create function public.mm_deletion_prepare_v1(user_id uuid) returns jsonb language sql volatile security invoker set search_path=pg_catalog as $$select mm_account_lifecycle.prepare(user_id)$$;
create function public.mm_deletion_cleanup_v1(job_id uuid,lease_token uuid) returns jsonb language sql volatile security invoker set search_path=pg_catalog as $$select mm_account_lifecycle.cleanup(job_id,lease_token)$$;
create function public.mm_deletion_mark_auth_v1(job_id uuid,lease_token uuid) returns jsonb language sql volatile security invoker set search_path=pg_catalog as $$select mm_account_lifecycle.mark_auth(job_id,lease_token)$$;
create function public.mm_deletion_finish_v1(job_id uuid,lease_token uuid,outcome text) returns jsonb language sql volatile security invoker set search_path=pg_catalog as $$select mm_account_lifecycle.finish(job_id,lease_token,outcome)$$;
create function public.mm_deletion_reconcile_v1(job_id uuid,lease_token uuid,resolution_id uuid,resolution text,note text) returns jsonb language sql volatile security invoker set search_path=pg_catalog as $$select mm_account_lifecycle.reconcile(job_id,lease_token,resolution_id,resolution,note)$$;
create function public.mm_deletion_push_allowed_v1(endpoint text,owner_id uuid,subscription_version timestamptz) returns boolean language sql volatile security invoker set search_path=pg_catalog as $$select mm_account_lifecycle.push_allowed(endpoint,owner_id,subscription_version)$$;
create function public.mm_deletion_push_record_v1(endpoint text,owner_id uuid,subscription_version timestamptz,dedupe_key text) returns boolean language sql volatile security invoker set search_path=pg_catalog as $$select mm_account_lifecycle.push_record(endpoint,owner_id,subscription_version,dedupe_key)$$;
revoke all on all functions in schema mm_account_lifecycle from public,anon,authenticated,service_role;
grant execute on function mm_account_lifecycle.prepare(uuid),mm_account_lifecycle.cleanup(uuid,uuid),mm_account_lifecycle.mark_auth(uuid,uuid),mm_account_lifecycle.finish(uuid,uuid,text),mm_account_lifecycle.reconcile(uuid,uuid,uuid,text,text),mm_account_lifecycle.push_allowed(text,uuid,timestamptz) to service_role;
grant execute on function mm_account_lifecycle.push_record(text,uuid,timestamptz,text) to service_role;
revoke all on function public.mm_deletion_prepare_v1(uuid),public.mm_deletion_cleanup_v1(uuid,uuid),public.mm_deletion_mark_auth_v1(uuid,uuid),public.mm_deletion_finish_v1(uuid,uuid,text),public.mm_deletion_reconcile_v1(uuid,uuid,uuid,text,text),public.mm_deletion_push_allowed_v1(text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.mm_deletion_prepare_v1(uuid),public.mm_deletion_cleanup_v1(uuid,uuid),public.mm_deletion_mark_auth_v1(uuid,uuid),public.mm_deletion_finish_v1(uuid,uuid,text),public.mm_deletion_reconcile_v1(uuid,uuid,uuid,text,text),public.mm_deletion_push_allowed_v1(text,uuid,timestamptz) to service_role;
revoke all on function public.mm_deletion_push_record_v1(text,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.mm_deletion_push_record_v1(text,uuid,timestamptz,text) to service_role;
-- Called INSIDE AI allocation/dispatch transactions, retaining the auth row lock.
create function mm_account_lifecycle.generation_guard(uid uuid) returns void language plpgsql volatile security definer set search_path=pg_catalog as $$begin
 perform mm_account_lifecycle.rc();
 perform 1 from auth.users where id=uid for key share;
 if not found or exists(select 1 from mm_account_lifecycle.jobs j where j.user_id=uid) then raise exception 'Account generation is paused for lifecycle recovery' using errcode='55000';end if;
end$$;
create function public.mm_deletion_generation_guard_v1(user_id uuid) returns void language sql volatile security invoker set search_path=pg_catalog as $$select mm_account_lifecycle.generation_guard(user_id)$$;
revoke all on function mm_account_lifecycle.generation_guard(uuid),public.mm_deletion_generation_guard_v1(uuid) from public,anon,authenticated;
grant execute on function mm_account_lifecycle.generation_guard(uuid),public.mm_deletion_generation_guard_v1(uuid) to service_role;
commit;
