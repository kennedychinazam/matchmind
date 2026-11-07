-- Build 357 release acceptance: the per-base-table raw fence, on an ISOLATED LOCAL cluster.
--
-- WHY THIS EXISTS. PROPOSAL-up.sql created only a RESTRICTIVE SELECT policy on each copied-fact
-- base table. A restrictive policy cannot return a row on its own: with RLS enabled and no
-- PERMISSIVE policy that applies, PostgreSQL default-denies. So the three protection claims held,
-- but the capability was INERT - an explicitly enrolled principal read zero rows while
-- matchmind_fixture_access_v1 reported raw_allowed:true, and the browser's fixtureTable() took
-- the raw branch and rendered an empty application instead of the bounded display. Probe 3 below
-- fails against the uncorrected proposal and passes with the added mm_source_raw_read policy.
--
-- EVERY ROW HERE IS INVENTED. No production row, provider response, credential or forecast is
-- read, copied or written. This touches no hosted database. Run it only against a throwaway
-- local cluster:
--
--   initdb -D "$PGDATA" -A trust -U postgres
--   pg_ctl -D "$PGDATA" -o "-k /tmp/mmpg -p 5433 -c listen_addresses=" -w start
--   psql -h /tmp/mmpg -p 5433 -U postgres -v ON_ERROR_STOP=1 -f local-fence-regression.sql
--
-- It asserts, so a wrong answer aborts with a named failure rather than printing a table.

\set ON_ERROR_STOP on
\pset pager off

create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;   -- the collector, as Supabase configures it
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema mm_fixture_delivery;
revoke all on schema mm_fixture_delivery from public, anon, authenticated;
grant usage on schema mm_fixture_delivery to anon, authenticated;
create table mm_fixture_delivery.principals(
  user_id uuid primary key, enabled boolean not null default true,
  approved_until timestamptz not null);
revoke all on all tables in schema mm_fixture_delivery from public, anon, authenticated;
create function mm_fixture_delivery.raw_allowed() returns boolean
  language sql stable security definer set search_path=pg_catalog as
  $$select exists(select 1 from mm_fixture_delivery.principals p
     where p.user_id=auth.uid() and p.enabled and p.approved_until>statement_timestamp())$$;
revoke all on function mm_fixture_delivery.raw_allowed() from public,anon,authenticated;
grant execute on function mm_fixture_delivery.raw_allowed() to anon,authenticated;

-- Synthetic copied-fact table in the permissive PRE-proposal state.
create table public.fixtures(fxid bigint primary key, home text, away text, gh int, ga int);
insert into public.fixtures values (1,'Synthetic H','Synthetic A',2,1),(2,'Synthetic C','Synthetic D',0,0);
grant select on public.fixtures to anon, authenticated;
grant select on public.fixtures to service_role;   -- the EXPLICIT collector grant the preflight requires

-- ===== exactly what PROPOSAL-up.sql executes for a base table =====
revoke select on public.fixtures from public,anon,authenticated;
do $$declare col record;begin
 for col in select attname from pg_attribute where attrelid='public.fixtures'::regclass and attnum>0 and not attisdropped loop
  execute format('revoke select(%I) on public.fixtures from public,anon,authenticated',col.attname);
 end loop;
end$$;
alter table public.fixtures enable row level security;
grant select on public.fixtures to authenticated;
create policy mm_source_raw_fence on public.fixtures as restrictive for select to authenticated
  using ((select mm_fixture_delivery.raw_allowed()));
create policy mm_source_raw_read on public.fixtures for select to authenticated
  using ((select mm_fixture_delivery.raw_allowed()));

insert into mm_fixture_delivery.principals values
  ('11111111-1111-1111-1111-111111111111', true, now()+interval '1 hour');

-- ===== probes =====
create function public.probe_count() returns integer language sql security invoker as
  $$select count(*)::integer from public.fixtures$$;

do $$declare n integer; denied boolean;
begin
 -- 1. anonymous: a generic raw read is refused outright, not merely emptied.
 set local role anon;
 begin select count(*) into n from public.fixtures; denied=false;
 exception when insufficient_privilege then denied=true; end;
 reset role;
 if not denied then raise exception 'FAIL 1: anonymous raw table read was not refused';end if;
 raise notice 'PASS 1: anonymous generic raw read refused';

 -- 2. ordinary authenticated caller: no capability, no rows.
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','99999999-9999-9999-9999-999999999999',true);
 select count(*) into n from public.fixtures;
 reset role;
 if n<>0 then raise exception 'FAIL 2: ordinary authenticated caller read % raw rows',n;end if;
 raise notice 'PASS 2: ordinary authenticated caller reads no raw rows';

 -- 3. enrolled principal: the capability must actually deliver its rows.
 --    THIS IS THE REGRESSION. Without mm_source_raw_read it returns 0.
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 select count(*) into n from public.fixtures;
 reset role;
 if n<>2 then raise exception 'FAIL 3: enrolled capability delivered % of 2 rows (inert fence)',n;end if;
 raise notice 'PASS 3: enrolled capability delivers its rows';

 -- 4. revoked mid-session: closed on the next statement.
 update mm_fixture_delivery.principals set enabled=false
   where user_id='11111111-1111-1111-1111-111111111111';
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 select count(*) into n from public.fixtures;
 reset role;
 if n<>0 then raise exception 'FAIL 4: a revoked principal still read % rows',n;end if;
 raise notice 'PASS 4: revocation closes the capability immediately';

 -- 5. expired approval: closed.
 update mm_fixture_delivery.principals
   set enabled=true, approved_until=now()-interval '1 second'
   where user_id='11111111-1111-1111-1111-111111111111';
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 select count(*) into n from public.fixtures;
 reset role;
 if n<>0 then raise exception 'FAIL 5: an expired approval still read % rows',n;end if;
 raise notice 'PASS 5: expiry closes the capability';

 -- 6. bulk extraction by an ordinary caller: select *, no predicate, offset paging.
 update mm_fixture_delivery.principals set approved_until=now()+interval '1 hour'
   where user_id='11111111-1111-1111-1111-111111111111';
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','77777777-7777-7777-7777-777777777777',true);
 select count(*) into n from (select * from public.fixtures offset 0 limit 1000) q;
 reset role;
 if n<>0 then raise exception 'FAIL 6: unrestricted paging extracted % rows',n;end if;
 raise notice 'PASS 6: unrestricted select/paging extracts nothing';

 -- 7. the principal registry itself is not readable by an ordinary caller.
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','77777777-7777-7777-7777-777777777777',true);
 begin select count(*) into n from mm_fixture_delivery.principals; denied=false;
 exception when insufficient_privilege then denied=true; end;
 reset role;
 if not denied then raise exception 'FAIL 7: the principal registry was readable';end if;
 raise notice 'PASS 7: principal registry is not readable by an ordinary caller';

 -- 8. a SECURITY INVOKER function is no way around the fence.
 set local role authenticated;
 perform set_config('request.jwt.claim.sub','77777777-7777-7777-7777-777777777777',true);
 select public.probe_count() into n;
 reset role;
 if n<>0 then raise exception 'FAIL 8: a security invoker function returned % rows',n;end if;
 raise notice 'PASS 8: a security invoker function cannot bypass the fence';

 -- 9 and 10. THE COLLECTOR PREFLIGHT. PROPOSAL-up.sql refuses to install unless the collector
 --    holds an EXPLICIT direct SELECT grant, because the migration revokes SELECT from PUBLIC and
 --    an inherited read would be stripped with it. These two probes exercise the exact predicate
 --    pair that preflight uses. The CI job separately greps PROPOSAL-up.sql for that same text, so
 --    the predicate here cannot drift away from the one the migration actually runs.
 if not has_table_privilege('service_role','public.fixtures','SELECT') then
  raise exception 'FAIL 9: the collector has no effective SELECT to begin with';end if;
 if not exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
               where c.oid='public.fixtures'::regclass and a.privilege_type='SELECT'
                 and a.grantee=(select oid from pg_roles where rolname='service_role')) then
  raise exception 'FAIL 9: an explicit collector grant was not detected when one exists';end if;
 raise notice 'PASS 9: an explicit collector grant is detected';

 -- 10. The negative half: with the explicit grant removed and only PUBLIC left, the collector
 --     still READS (so a naive has_table_privilege check would wave the migration through) but the
 --     direct-grant test must now be FALSE. That difference is the whole point of the preflight.
 revoke select on public.fixtures from service_role;
 grant select on public.fixtures to public;
 if not has_table_privilege('service_role','public.fixtures','SELECT') then
  raise exception 'FAIL 10: the inherited-read case was not set up; nothing was proven';end if;
 if exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
           where c.oid='public.fixtures'::regclass and a.privilege_type='SELECT'
             and a.grantee=(select oid from pg_roles where rolname='service_role')) then
  raise exception 'FAIL 10: an inherited-only read was reported as an explicit grant';end if;
 raise notice 'PASS 10: an inherited-only collector read is correctly refused by the preflight';
 revoke select on public.fixtures from public;
 grant select on public.fixtures to service_role;

 raise notice 'ALL 10 FENCE PROBES PASSED';
end$$;
