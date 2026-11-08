-- Published-edition ROLLING WINDOW acceptance, on an ISOLATED LOCAL cluster.
--
-- WHY THIS EXISTS. The public feed went dark for about five and a half hours of every UTC day.
-- Two independent causes, both in PROPOSAL-up.sql:
--   (1) mm_fixture_delivery.display(screen) admitted an edition only when
--       edition_day=(statement_timestamp() at time zone 'UTC')::date, so every edition became
--       inadmissible the instant the UTC date rolled over; and
--   (2) materialize() clipped expires_at with least(stamp+interval '24 hours', next UTC midnight),
--       so the 23:17 UTC publisher run produced an edition that lived 43 minutes.
-- The publisher runs at 23:17, 05:17 and 17:17 UTC, so from 00:00 until the 05:17 run finished
-- nothing was admissible and display() raised P0002 'Current presentation unavailable'.
-- The fix is a rolling window of at most 24 hours, independent of any calendar date. edition_day
-- is KEPT as created-day metadata and both table checks are KEPT; only the admission filter and
-- the insert-time expiry changed.
--
-- HOW THIS FILE STAYS HONEST. It does not re-type the rules. It EXTRACTS, with sed, the two
-- expressions that PROPOSAL-up.sql actually executes -- display()'s admission predicate and
-- materialize()'s expires_at expression -- and builds the probe fixtures from them. Run it
-- against the pre-fix PROPOSAL-up.sql and probes 1 and 3 fail while 2 and 4 still pass -- the
-- blackout was never a missing guard -- and against the fixed one all four pass.
--
-- The two EXECUTED expressions have no second copy. Independent review of 2e788a8 found that
-- the rest does: the ORDER BY, the LIMIT and the table DDL are re-typed here, so a later
-- `create or replace` of display(), an `alter table ... drop constraint`, or a change to the
-- tiebreak were all invisible. The text invariants below now pin those too.
--
-- Because statement_timestamp() cannot be moved, the extracted admission predicate is
-- re-pointed at a p_at parameter so the probes can assert at EXACT clock times (23:30, 00:30,
-- 05:00) instead of whenever CI happens to run. Nothing else about the predicate is touched.
--
-- EVERY ROW AND EVERY TIMESTAMP HERE IS INVENTED. No production row, provider response,
-- credential or forecast is read, copied or written. This touches no hosted database, makes no
-- network call and needs no credential. It creates NO roles, so it cannot collide with
-- local-fence-regression.sql, and it drops its own schema on the way out. Run it only against a
-- throwaway local cluster:
--
--   initdb -D "$PGDATA" -A trust -U postgres
--   pg_ctl -D "$PGDATA" -o "-k /tmp/mmpg -p 5433 -c listen_addresses=" -w start
--   cd backend/fixture-delivery
--   psql -h /tmp/mmpg -p 5433 -U postgres -v ON_ERROR_STOP=1 -f local-edition-window-regression.sql
--
-- Override the migration it reads with -v up=/path/to/PROPOSAL-up.sql (default: ./PROPOSAL-up.sql).
-- It asserts, so a wrong answer aborts with a named failure rather than printing a table.

-- Aborts on the first failure by default. Pass -v ON_ERROR_STOP=off to let every probe report
-- its own verdict in one run, which is how the before/after evidence for all four was taken.
\if :{?ON_ERROR_STOP}
\else
\set ON_ERROR_STOP on
\endif
\pset pager off

\if :{?up}
\else
\set up PROPOSAL-up.sql
\endif
\echo 'reading the migration under test from' :up

-- The two expressions the migration really runs, lifted verbatim out of it.
\set admission `sed -n "s/^.*select \* into e from mm_fixture_delivery\.editions where \(.*\) order by as_of desc.*$/\1/p" :up`
\set expiry `sed -n "s/^.*insert into mm_fixture_delivery\.editions values(eid,day_utc,stamp,\(.*\),'existing-published-record-projection\/1'.*$/\1/p" :up`
-- The invariants that must survive the fix, counted in the migration text.
\set day_col `grep -cF " edition_day date not null," :up || true`
\set chk_day `grep -cF "check((as_of at time zone 'UTC')::date=edition_day)" :up || true`
\set chk_24h `grep -cF "check(expires_at>as_of and expires_at<=as_of+interval '24 hours')" :up || true`
\set chk_p0002 `grep -cF "raise exception 'Current presentation unavailable' using errcode='P0002'" :up || true`
\set backfills `grep -ciE "update[[:space:]]+(only[[:space:]]+)?(\"?mm_fixture_delivery\"?\.)?\"?editions\"?" :up || true`
-- F-3: the pieces this file RE-TYPES rather than extracts, pinned by count so a later statement
-- cannot redefine them behind the probes' back. One admission select, one ORDER BY with the
-- primary-key tiebreak, exactly one display() definition and no replacement of it, and no
-- constraint ever dropped.
\set n_admission `grep -cF "select * into e from mm_fixture_delivery.editions" :up || true`
\set n_orderby `grep -cF "order by as_of desc,edition_id desc limit 1" :up || true`
\set n_display `grep -cE "create (or replace )?function mm_fixture_delivery\.display\(" :up || true`
\set n_replace `grep -ciE "create or replace function mm_fixture_delivery\.display\(" :up || true`
\set n_dropck `grep -ciE "alter table[[:space:]]+(only[[:space:]]+)?(\"?mm_fixture_delivery\"?\.)?\"?editions\"?[[:space:]]+drop" :up || true`

\echo 'extracted admission predicate:' :'admission'
\echo 'extracted expires_at expression:' :'expiry'

-- Self-cleaning at both ends, so an aborted earlier run cannot wedge the next one.
drop schema if exists mmwin cascade;
create schema mmwin;

-- psql does not interpolate :variables inside dollar-quoted blocks, so the values extracted above
-- are carried into the probes through this table rather than re-typed.
create table mmwin.rules(k text primary key, v text not null);
insert into mmwin.rules values
 ('up',         :'up'),
 ('admission',  :'admission'),
 ('expiry',     :'expiry'),
 ('day_col',    :'day_col'),
 ('chk_day',    :'chk_day'),
 ('chk_24h',    :'chk_24h'),
 ('chk_p0002',  :'chk_p0002'),
 ('backfills',  :'backfills'),
 ('n_admission',:'n_admission'),
 ('n_orderby',  :'n_orderby'),
 ('n_display',  :'n_display'),
 ('n_replace',  :'n_replace'),
 ('n_dropck',   :'n_dropck');
create function mmwin.die(text) returns boolean language plpgsql immutable as $$begin raise exception '%',$1;end$$;
create function mmwin.rule(text) returns text language sql stable as $$select v from mmwin.rules where k=$1$$;
-- Each probe records its own verdict only if it runs to completion, so the closing banner cannot
-- claim a pass that an aborted probe never earned (a DO block is its own transaction, so a raise
-- rolls its verdict back with it).
create table mmwin.verdict(probe integer primary key, note text not null);
-- A key that was never registered used to come back NULL here, and `NULL <> 1` is NULL, so an
-- invariant nobody inserted passed silently. Found when the ORDER BY mutant survived the very
-- guard written for it. A missing key is now a setup failure, not a pass.
create function mmwin.rulen(text) returns integer language sql stable as $$
 select case when count(*)=0
   then (select null::integer where mmwin.die('SETUP: invariant '||$1||' was never registered in mmwin.rules, so its guard could never fire'))
   else coalesce(nullif(min(v),'')::integer,0) end from mmwin.rules where k=$1$$;

-- ===== exactly the temporal shape PROPOSAL-up.sql creates for mm_fixture_delivery.editions =====
-- Columns and both CHECK constraints are copied verbatim from the migration; probe 4 asserts the
-- migration still carries them, so this replica cannot quietly diverge.
create table mmwin.editions (
 edition_id uuid primary key,
 edition_day date not null,
 as_of timestamptz not null,
 expires_at timestamptz not null,
 source_review text not null check(length(source_review) between 1 and 200),
 expected_cards integer not null check(expected_cards between 0 and 1000),
 expected_predictions integer not null check(expected_predictions between 0 and 1000),
 payload jsonb not null,
 check((as_of at time zone 'UTC')::date=edition_day),
 check(expires_at>as_of and expires_at<=as_of+interval '24 hours')
);

do $setup$
declare admission text=mmwin.rule('admission'); expiry text=mmwin.rule('expiry'); up text=mmwin.rule('up');
begin
 if coalesce(admission,'')='' then
  raise exception 'SETUP: could not extract display() admission predicate from %. Wrong path, or the migration no longer matches the expected shape',up;
 end if;
 if coalesce(expiry,'')='' then
  raise exception 'SETUP: could not extract materialize() expires_at expression from %. Wrong path, or the migration no longer matches the expected shape',up;
 end if;

 -- display(), reduced to the admission decision under test. The extracted predicate is used
 -- as-is except that statement_timestamp() becomes the p_at parameter, so the probes can name an
 -- exact UTC clock time. The P0002 fail-closed raise is the migration's own, kept deliberately:
 -- when every publisher run has failed for more than 24 hours the feed must go dark, not stale.
 execute format($build$
  create function mmwin.display_at(p_at timestamptz) returns uuid language plpgsql stable as $body$
  declare e mmwin.editions%%rowtype;
  begin
   select * into e from mmwin.editions where %s order by as_of desc,edition_id desc limit 1;
   if not found then raise exception 'Current presentation unavailable' using errcode='P0002';end if;
   return e.edition_id;
  end $body$;
 $build$, replace(admission,'statement_timestamp()','p_at'));

 -- materialize()'s insert-time expiry, over the same (stamp, day_utc) it computes from.
 execute format($build$
  create function mmwin.publish_expiry(stamp timestamptz, day_utc date) returns timestamptz
  language sql immutable as $body$select %s$body$;
 $build$, expiry);
end $setup$;

-- A publisher run, exactly as materialize() shapes one: as_of=stamp, edition_day=stamp's UTC
-- date, expires_at=the migration's own expiry expression.
create function mmwin.publish(tag text, stamp timestamptz) returns uuid
language sql volatile as $$
 insert into mmwin.editions values(
  ('00000000-0000-4000-8000-'||lpad(tag,12,'0'))::uuid,
  (stamp at time zone 'UTC')::date, stamp, mmwin.publish_expiry(stamp,(stamp at time zone 'UTC')::date),
  'synthetic-rolling-window-probe/1', 0, 0, '{"cards":[],"board":null,"records":{},"slips":[]}'::jsonb)
 returning edition_id
$$;

-- ===== probes =====
-- Publish with an explicitly full 24-hour life, so the admission rule can be probed on its own
-- without the insert-time expiry expression deciding the outcome first. This is the edition the
-- brief specifies: as_of at 23:17, expires_at at as_of+24h.
create function mmwin.publish_24h(tag text, stamp timestamptz) returns uuid
language sql volatile as $$
 insert into mmwin.editions values(
  ('00000000-0000-4000-8000-'||lpad(tag,12,'0'))::uuid,
  (stamp at time zone 'UTC')::date, stamp, stamp+interval '24 hours',
  'synthetic-rolling-window-probe/1', 0, 0, '{"cards":[],"board":null,"records":{},"slips":[]}'::jsonb)
 returning edition_id
$$;

do $probe1$
declare got uuid; e1 uuid; exp timestamptz; bad text[]='{}';
 -- The 23:17 UTC publisher run and the blackout window that followed it.
 pub    timestamptz='2026-03-10 23:17:00+00';
 r_eve  timestamptz='2026-03-10 23:30:00+00';  -- 13 min later, same UTC day
 r_0030 timestamptz='2026-03-11 00:30:00+00';  -- next UTC day: WAS DARK
 r_0500 timestamptz='2026-03-11 05:00:00+00';  -- still before the 05:17 run: WAS DARK
begin
 -- 1. THE BLACKOUT. A 23:17 edition with a full 24-hour life must be served at 00:30 and at
 --    05:00 on the following UTC day. The blackout had TWO independent causes, so this probe
 --    tests them separately and reports BOTH rather than stopping at whichever it meets first:
 --    (a) display()'s admission predicate filtered on edition_day, and
 --    (b) materialize() clipped expires_at to the next UTC midnight.
 delete from mmwin.editions;
 e1 = mmwin.publish_24h('1',pub);

 -- (a) ADMISSION, probed at exact clock times against an edition that is given a full 24h life.
 begin got = mmwin.display_at(r_eve);
 exception when sqlstate 'P0002' then got=null; end;
 if got is distinct from e1 then
  bad = bad || 'FAIL 1b: the edition was not served even 13 minutes after publication, at 2026-03-10 23:30Z'::text;
 else raise notice 'PASS 1b: served at 2026-03-10 23:30Z (same UTC day)';
 end if;

 begin got = mmwin.display_at(r_0030);
 exception when sqlstate 'P0002' then got=null; end;
 if got is distinct from e1 then
  bad = bad || 'FAIL 1c: THE BLACKOUT. At 2026-03-11 00:30Z the 23:17 edition was refused although it is only 1h13m old and expires at 2026-03-11 23:17Z. display() is still filtering on edition_day'::text;
 else raise notice 'PASS 1c: served at 2026-03-11 00:30Z, the next UTC day (blackout gone)';
 end if;

 begin got = mmwin.display_at(r_0500);
 exception when sqlstate 'P0002' then got=null; end;
 if got is distinct from e1 then
  bad = bad || 'FAIL 1d: THE BLACKOUT. At 2026-03-11 05:00Z the 23:17 edition was refused although it is only 5h43m old and the 05:17 publisher run has not finished. display() is still filtering on edition_day'::text;
 else raise notice 'PASS 1d: served at 2026-03-11 05:00Z, before the 05:17 run (blackout gone)';
 end if;

 -- The far edge of the rolling window: valid up to, and not including, as_of+24h.
 begin got = mmwin.display_at(pub+interval '24 hours'-interval '1 second');
 exception when sqlstate 'P0002' then got=null; end;
 if got is distinct from e1 then
  bad = bad || 'FAIL 1e: refused one second before its own 24-hour expiry'::text;
 else raise notice 'PASS 1e: still served 1 second before as_of+24h';
 end if;

 -- (b) EXPIRY. What the publisher itself would store for that same 23:17 run.
 exp = mmwin.publish_expiry(pub,(pub at time zone 'UTC')::date);
 if exp <> pub+interval '24 hours' then
  bad = bad || format('FAIL 1f: the 23:17 run is given expires_at %s, a life of only %s, instead of a full rolling 24 hours to %s. The least(...) midnight clip in materialize() is still there',
                      exp, exp-pub, pub+interval '24 hours');
 else raise notice 'PASS 1f: the 23:17 run gets a full 24-hour life, expires_at=%',exp;
 end if;

 -- (c) THE SAME EXPIRY ACROSS A REAL DST TRANSITION, AND AGAINST THE WALL CLOCK.
 -- Independent review of 2e788a8: 1f alone compared the expiry at a single instant on a
 -- non-transition date, so `interval '1 day'` survived -- and on timestamptz that is NOT 24
 -- hours across a transition. In a non-UTC session it yields 23 hours in spring (an hour of
 -- blackout) and 25 hours in autumn, which VIOLATES the table's expires_at<=as_of+24h check and
 -- would abort the publisher insert outright, once a year. A clip referencing statement_timestamp()
 -- also survived, because every date above is in the past relative to CI's clock.
 -- 2026-03-08 and 2026-11-01 are the real US transitions; 2026-03-29 and 2026-10-25 the EU ones.
 declare
  tz text; t timestamptz; d interval;
 begin
  foreach tz in array array['UTC','America/New_York','Europe/Berlin','Australia/Lord_Howe'] loop
   foreach t in array array['2026-03-07 23:17:00+00'::timestamptz,'2026-03-08 06:17:00+00',
                            '2026-03-28 23:17:00+00','2026-10-24 23:17:00+00',
                            '2026-10-31 23:17:00+00','2026-11-01 05:17:00+00',
                            statement_timestamp()] loop
    execute format('set local timezone to %L',tz);
    d = mmwin.publish_expiry(t,(t at time zone 'UTC')::date) - t;
    if d <> interval '24 hours' then
     bad = bad || format('FAIL 1g: in session timezone %s an edition published at %s would be given a life of %s instead of exactly 24 hours. interval ''1 day'' is not 24 hours across a DST transition on timestamptz, and a life over 24 hours is refused by the table check, so the publisher insert aborts',tz,t,d)::text;
    end if;
   end loop;
  end loop;
  execute 'set local timezone to ''UTC''';
 end;
 if array_length(bad,1) is null then
  raise notice 'PASS 1g: the expiry is exactly 24 hours in 4 session timezones across both 2026 DST transitions, and at the live clock';
 end if;

 if array_length(bad,1) > 0 then
  raise exception E'PROBE 1 FAILED, the feed still goes dark:\n  - %', array_to_string(bad,E'\n  - ');
 end if;
 insert into mmwin.verdict values(1,'a 23:17 edition with a 24h life is served at 00:30Z and 05:00Z the next UTC day, and the publisher grants that full life');
end $probe1$;

do $probe2$
declare got uuid; e1 uuid; e2 uuid; exp timestamptz; code text; n integer;
 -- The 23:17 UTC publisher run and the blackout window that followed it.
 pub   timestamptz='2026-03-10 23:17:00+00';
 r_eve timestamptz='2026-03-10 23:30:00+00';  -- 13 min later, same UTC day
 r_0030 timestamptz='2026-03-11 00:30:00+00'; -- next UTC day: WAS DARK
 r_0500 timestamptz='2026-03-11 05:00:00+00'; -- still before the 05:17 run: WAS DARK
begin
 delete from mmwin.editions;
 -- 2. FAIL CLOSED. Past expires_at is refused, and a publisher that has missed every run for
 --    more than 24 hours gets darkness rather than stale content.
 delete from mmwin.editions;
 e1 = mmwin.publish('1',pub);
 code = null;
 begin got = mmwin.display_at(pub + interval '24 hours');
 exception when sqlstate 'P0002' then code='P0002'; end;
 if code is distinct from 'P0002' then
  raise exception 'FAIL 2a: an edition exactly at its expires_at was served (returned %) instead of raising P0002',got;
 end if;
 raise notice 'PASS 2a: exactly at expires_at the edition is refused with P0002';

 code = null;
 begin got = mmwin.display_at(pub + interval '24 hours' + interval '1 second');
 exception when sqlstate 'P0002' then code='P0002'; end;
 if code is distinct from 'P0002' then raise exception 'FAIL 2b: an expired edition was served (returned %)',got;end if;
 raise notice 'PASS 2b: one second past expires_at the edition is refused with P0002';

 -- The missed-publisher case: the newest edition in the table is more than 24 hours old, so
 -- EVERY run has failed for over a day. The row is still present; it simply must not be served.
 delete from mmwin.editions;
 e1 = mmwin.publish('9','2026-03-09 05:17:00+00');
 e2 = mmwin.publish('a','2026-03-09 17:17:00+00');
 select count(*) into n from mmwin.editions;
 if n <> 2 then raise exception 'FAIL 2c: the stale editions were not stored; nothing would be proven';end if;
 code = null; got = null;
 begin got = mmwin.display_at('2026-03-10 18:00:00+00');
 exception when sqlstate 'P0002' then code='P0002'; end;
 if code is distinct from 'P0002' then
  raise exception 'FAIL 2c: with the newest edition over 24 hours old the feed served STALE content (edition %) instead of failing closed',got;
 end if;
 select count(*) into n from mmwin.editions;
 if n <> 2 then raise exception 'FAIL 2c: display() must not delete editions';end if;
 raise notice 'PASS 2c: every publisher run failed for >24h -> P0002, fails CLOSED, both stale rows still stored and simply not served';

 -- 2d. THE EMBARGO. Independent review of 2e788a8 found no probe touched the as_of<=now half of
 -- the admission predicate, so deleting that term outright, or widening it by a day, passed all
 -- sixteen verdicts. An edition must not be served before the instant it was published.
 delete from mmwin.editions;
 e1 = mmwin.publish_24h('b','2026-03-12 23:17:00+00');
 code = null; got = null;
 begin got = mmwin.display_at('2026-03-10 12:00:00+00');
 exception when sqlstate 'P0002' then code='P0002'; end;
 if code is distinct from 'P0002' then
  raise exception 'FAIL 2d: an edition stamped 2026-03-12 23:17Z was served at 2026-03-10 12:00Z, two days before it was published (returned %). The as_of<=now half of the admission predicate is gone',got;
 end if;
 raise notice 'PASS 2d: an edition is not served before its own as_of (the embargo holds)';
 -- One second before, refused; at its own as_of, served. The boundary, from both sides.
 code = null; got = null;
 begin got = mmwin.display_at('2026-03-12 23:16:59.999999+00');
 exception when sqlstate 'P0002' then code='P0002'; end;
 if code is distinct from 'P0002' then raise exception 'FAIL 2e: served one microsecond before its own as_of (returned %)',got;end if;
 got = mmwin.display_at('2026-03-12 23:17:00+00');
 if got is distinct from e1 then raise exception 'FAIL 2e: not served at exactly its own as_of (got %, expected %)',got,e1;end if;
 raise notice 'PASS 2e: refused one microsecond before as_of, served at exactly as_of';
 insert into mmwin.verdict values(2,'an expired or >24h-old edition is refused with P0002, never served stale');

end $probe2$;

do $probe3$
declare got uuid; e1 uuid; e2 uuid; exp timestamptz; code text; n integer;
 -- The 23:17 UTC publisher run and the blackout window that followed it.
 pub   timestamptz='2026-03-10 23:17:00+00';
 r_eve timestamptz='2026-03-10 23:30:00+00';  -- 13 min later, same UTC day
 r_0030 timestamptz='2026-03-11 00:30:00+00'; -- next UTC day: WAS DARK
 r_0500 timestamptz='2026-03-11 05:00:00+00'; -- still before the 05:17 run: WAS DARK
begin
 delete from mmwin.editions;
 -- 3. NEWEST as_of WINS when more than one edition is inside the window. The cross-midnight pair
 --    is the discriminating case: before the fix neither was admissible at 00:30Z at all.
 delete from mmwin.editions;
 e1 = mmwin.publish('1','2026-03-10 22:00:00+00');
 e2 = mmwin.publish('2','2026-03-10 23:17:00+00');
 begin got = mmwin.display_at(r_0030);
 exception when sqlstate 'P0002' then
  raise exception 'FAIL 3a: at 00:30Z BOTH valid editions from the previous UTC day were refused with P0002, so there was nothing to choose between';
 end;
 if got is distinct from e2 then
  raise exception 'FAIL 3a: at 00:30Z the newest as_of (23:17) should win; got % (expected %)',got,e2;
 end if;
 raise notice 'PASS 3a: with two valid editions from the previous UTC day, the 23:17 one wins at 00:30Z';

 -- And across the date boundary, where the older edition is the one on the previous day.
 delete from mmwin.editions;
 e1 = mmwin.publish('1','2026-03-10 23:17:00+00');
 e2 = mmwin.publish('2','2026-03-11 05:17:00+00');
 begin got = mmwin.display_at('2026-03-11 06:00:00+00');
 exception when sqlstate 'P0002' then
  raise exception 'FAIL 3b: at 06:00Z neither the 05:17 nor the previous-day 23:17 edition was admissible';
 end;
 if got is distinct from e2 then raise exception 'FAIL 3b: the 05:17 edition should win over the previous day 23:17 one; got %',got;end if;
 raise notice 'PASS 3b: the newer 05:17 edition wins over the previous UTC day 23:17 one';
 insert into mmwin.verdict values(3,'with two editions inside the window the newest as_of wins');

 -- Once the newer one expires, the window is genuinely rolling: nothing newer, nothing served.
 delete from mmwin.editions;

end $probe3$;

do $probe4$
declare got uuid; e1 uuid; e2 uuid; exp timestamptz; code text; n integer;
 -- The 23:17 UTC publisher run and the blackout window that followed it.
 pub   timestamptz='2026-03-10 23:17:00+00';
 r_eve timestamptz='2026-03-10 23:30:00+00';  -- 13 min later, same UTC day
 r_0030 timestamptz='2026-03-11 00:30:00+00'; -- next UTC day: WAS DARK
 r_0500 timestamptz='2026-03-11 05:00:00+00'; -- still before the 05:17 run: WAS DARK
begin
 delete from mmwin.editions;
 -- 4. THE TABLE CHECKS STILL REJECT A MALFORMED EDITION. The tempting wrong fix for the blackout
 --    is to widen or drop these; that would turn a bounded window into an unbounded one.
 code = null;
 begin
  insert into mmwin.editions values('00000000-0000-4000-8000-0000000000b1','2026-03-10',pub,pub,
   'synthetic-rolling-window-probe/1',0,0,'{}'::jsonb);
 exception when check_violation then code='23514'; end;
 if code is distinct from '23514' then raise exception 'FAIL 4a: expires_at<=as_of was accepted';end if;
 raise notice 'PASS 4a: expires_at=as_of is rejected by check_violation';

 code = null;
 begin
  insert into mmwin.editions values('00000000-0000-4000-8000-0000000000b2','2026-03-10',pub,
   pub+interval '24 hours'+interval '1 second','synthetic-rolling-window-probe/1',0,0,'{}'::jsonb);
 exception when check_violation then code='23514'; end;
 if code is distinct from '23514' then raise exception 'FAIL 4b: expires_at>as_of+24h was accepted; the window is no longer bounded';end if;
 raise notice 'PASS 4b: expires_at=as_of+24h+1s is rejected by check_violation';

 -- edition_day is kept as created-day metadata, and its check still binds it to as_of.
 code = null;
 begin
  insert into mmwin.editions values('00000000-0000-4000-8000-0000000000b3','2026-03-11',pub,
   pub+interval '24 hours','synthetic-rolling-window-probe/1',0,0,'{}'::jsonb);
 exception when check_violation then code='23514'; end;
 if code is distinct from '23514' then raise exception 'FAIL 4c: edition_day no longer has to match as_of';end if;
 raise notice 'PASS 4c: edition_day still has to equal the as_of UTC date (metadata preserved)';

 -- The boundary itself must remain reachable: after the fix the publisher inserts exactly here.
 insert into mmwin.editions values('00000000-0000-4000-8000-0000000000b4','2026-03-10',pub,
  pub+interval '24 hours','synthetic-rolling-window-probe/1',0,0,'{}'::jsonb);
 raise notice 'PASS 4d: expires_at=as_of+24h exactly is accepted, which is where the fixed insert sits';
 delete from mmwin.editions;

 -- 4e. Text-level invariants in the migration itself, so the blackout cannot be "fixed" later by
 --     deleting the column, the bounds or the fail-closed raise.
 if mmwin.rulen('day_col') < 1 then raise exception 'FAIL 4e: the edition_day column is gone from %',mmwin.rule('up');end if;
 if mmwin.rulen('chk_day') < 1 then raise exception 'FAIL 4e: the edition_day/as_of check is gone from %',mmwin.rule('up');end if;
 if mmwin.rulen('chk_24h') < 1 then raise exception 'FAIL 4e: the expires_at>as_of and <=as_of+24h check is gone from %',mmwin.rule('up');end if;
 if mmwin.rulen('chk_p0002') < 1 then raise exception 'FAIL 4e: the P0002 fail-closed raise is gone from %',mmwin.rule('up');end if;
 if mmwin.rulen('backfills') > 0 then raise exception 'FAIL 4e: % rewrites stored editions. The rolling window applies to future publications only; no backfill is authorised',mmwin.rule('up');end if;
 -- F-3. The probes below re-type the ORDER BY and the table DDL, so without these a later
 -- statement in the migration could redefine display() or drop a constraint and every probe
 -- would still pass. Independent review of 2e788a8 demonstrated exactly that.
 if mmwin.rulen('n_admission') <> 1 then raise exception 'FAIL 4f: % has % admission selects against editions, expected exactly 1',mmwin.rule('up'),mmwin.rulen('n_admission');end if;
 if mmwin.rulen('n_orderby') <> 1 then raise exception 'FAIL 4f: the "order by as_of desc,edition_id desc limit 1" tiebreak is not present exactly once in %. Without the primary-key tiebreak two editions sharing an as_of have no total order',mmwin.rule('up');end if;
 if mmwin.rulen('n_display') <> 1 then raise exception 'FAIL 4f: % defines mm_fixture_delivery.display() % times, expected exactly 1. A later definition would win at install time and these probes would not see it',mmwin.rule('up'),mmwin.rulen('n_display');end if;
 if mmwin.rulen('n_replace') > 0 then raise exception 'FAIL 4f: % uses create or replace on display(), so the admission rule these probes extracted may not be the one installed',mmwin.rule('up');end if;
 if mmwin.rulen('n_dropck') > 0 then raise exception 'FAIL 4f: % drops a constraint from editions, so the 24-hour bound these probes rely on may not survive the install',mmwin.rule('up');end if;
 raise notice 'PASS 4e: edition_day, both table checks and the P0002 raise are all still in the migration, and it rewrites no stored edition';
 raise notice 'PASS 4f: one display() definition, never replaced, one admission select with the primary-key tiebreak, and no constraint dropped';
 insert into mmwin.verdict values(4,'the table checks still reject a malformed edition and the invariants survive');
end $probe4$;

do $banner$
declare n integer; missing text;
begin
 select count(*) into n from mmwin.verdict;
 if n <> 4 then
  select string_agg(p::text,', ' order by p) into missing
    from generate_series(1,4) p where p not in (select probe from mmwin.verdict);
  raise exception 'ROLLING-WINDOW REGRESSION FAILED: only % of 4 probes passed. Failing probe(s): %. The named FAIL above says which rule is wrong',n,missing;
 end if;
 raise notice 'ALL 4 ROLLING-WINDOW PROBES PASSED';
end $banner$;

drop schema mmwin cascade;
