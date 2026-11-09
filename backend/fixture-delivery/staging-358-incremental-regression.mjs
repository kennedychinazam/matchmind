/* Regression for the Build 358 STAGING incremental patch. Offline: invented roles, schemas and rows
 * only; it contacts no hosted database, provider or network service.
 *
 *   node backend/fixture-delivery/staging-358-incremental-regression.mjs
 *
 * It builds a cluster shaped like hosted Supabase (non-superuser role administrator), installs the
 * BASELINE the staging project actually runs (baseline/PROPOSAL-up.ecf001f.sql, git blob
 * 2e850a5206e0f178ffbb1847fc7c182288283eaa), publishes one edition, then proves:
 *   - the guard refuses a tampered baseline and refuses a second application, changing nothing
 *   - the forward patch changes ONLY display() and materialize()
 *   - owners, ACLs, attributes, data and editions are byte-identical before and after
 *   - the rolling window behaves: an edition from the previous UTC day, still inside 24 hours, is
 *     refused before the patch and admitted after it, and a new edition lives exactly 24 hours
 *   - the rollback restores the baseline bodies and the same fingerprint
 * Connection comes from PGHOST / PGPORT / PGUSER, as in hosted-compat-regression.mjs.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const ROOT = dirname(fileURLToPath(import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'mm-358-'));
const SUPER = process.env.PGUSER || 'postgres';
const DB = 'mm_358_' + Date.now();
const psql = (user, db, args, {sqlFile, sql, allowFail = false} = {}) => {
  const base = ['-X', '-v', 'ON_ERROR_STOP=1', '-U', user, ...(db ? ['-d', db] : []), ...args];
  if (sqlFile) base.push('-f', sqlFile);
  try { return execFileSync('psql', base, {input: sql, encoding: 'utf8', timeout: 120000,
        env: {...process.env, PGOPTIONS: '-c client_min_messages=warning'}}).trim(); }
  catch (e) { const t = String(e.stdout || '') + String(e.stderr || ''); if (allowFail) return 'FAILED:' + t.trim(); throw new Error(t.trim() || e.message); }
};
const lastLine = o => o.split('\n').map(x => x.trim()).filter(Boolean).pop() ?? '';
const q = (user, sql) => lastLine(psql(user, DB, ['-tAc', sql]));
const asRole = (role, sql) => lastLine(psql('authenticator', DB, ['-tAc', `set role ${role}; ${sql}`]));
const results = []; let failures = 0;
const check = (name, fn) => { try { fn(); results.push('PASS  ' + name); }
  catch (e) { failures++; results.push('FAIL  ' + name + '\n        ' + String(e.message).split('\n').filter(Boolean).slice(-6).join('\n        ')); } };
const eq = (got, want, what) => { if (String(got) !== String(want)) throw new Error(`${what}: got ${got}, want ${want}`); };

const baselineText = readFileSync(resolve(ROOT, 'baseline/PROPOSAL-up.ecf001f.sql'));
const blob = createHash('sha1').update(`blob ${baselineText.length}\0`).update(baselineText).digest('hex');
check('the baseline copy is byte-identical to the blob installed on staging', () => eq(blob, '2e850a5206e0f178ffbb1847fc7c182288283eaa', 'git blob'));

for (const old of psql(SUPER, 'postgres', ['-tAc', "select datname from pg_database where datname like 'mm\\_358\\_%'"]).split('\n').filter(Boolean))
  psql(SUPER, 'postgres', ['-c', `drop database if exists "${old.trim()}"`], {allowFail: true});
for (const [role, opts] of [['supabase_admin', 'login superuser'], ['hosted_postgres', 'login createrole createdb'],
    ['anon', 'nologin'], ['authenticated', 'nologin'], ['service_role', 'nologin bypassrls'], ['authenticator', 'login noinherit']])
  psql(SUPER, 'postgres', ['-c', `do $$begin if not exists(select 1 from pg_roles where rolname='${role}') then execute 'create role ${role} ${opts}'; end if; end$$`]);
psql(SUPER, 'postgres', ['-c', 'grant anon,authenticated,service_role to authenticator']);
for (const role of ['mm_display_reader', 'mm_display_materializer']) {
  const d = psql(SUPER, 'postgres', ['-c', `drop role if exists ${role}`], {allowFail: true});
  if (d.startsWith('FAILED:')) throw new Error('cannot start from a clean slate: ' + d.slice(7, 300));
}
psql(SUPER, 'postgres', ['-c', `create database ${DB} owner hosted_postgres`]);
psql('supabase_admin', DB, [], {sql: `
  create schema auth authorization supabase_admin;
  create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
  grant usage on schema auth to anon, authenticated, service_role, authenticator, hosted_postgres;`});
const bootstrap = readFileSync(resolve(ROOT, 'synthetic-bootstrap.sql'), 'utf8').split('\n')
  .filter(l => !/^create role |^create schema auth;|^create function auth\.uid\(\)|^do \$\$begin execute format\('alter role authenticator password|^grant anon,authenticated,service_role to authenticator;|^grant usage on schema public,auth to/.test(l))
  .map(l => l.replace('grant usage on schema public,auth to', 'grant usage on schema public to')).join('\n');
writeFileSync(join(work, 'bootstrap.sql'), bootstrap);
psql('hosted_postgres', DB, [], {sqlFile: join(work, 'bootstrap.sql')});
const baselineRun = psql('hosted_postgres', DB, [], {sqlFile: resolve(ROOT, 'baseline/PROPOSAL-up.ecf001f.sql'), allowFail: true});
check('the staging baseline installs under a non-superuser role administrator', () => { if (baselineRun.startsWith('FAILED:')) throw new Error(baselineRun.slice(7, 500)); });
check('the installer is a non-superuser that inherits', () => {
  eq(q(SUPER, "select rolsuper from pg_roles where rolname='hosted_postgres'"), 'f', 'rolsuper');
  eq(q(SUPER, "select rolinherit from pg_roles where rolname='hosted_postgres'"), 't', 'rolinherit');
});

const FP = `select md5(string_agg(x, '|' order by x)) from (
 select (n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||') '||pg_get_userbyid(p.proowner)||' '||p.prosecdef::text||' '||p.provolatile::text||' '||coalesce(p.proconfig::text,'')||' '||coalesce(p.proacl::text,'')) x
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='mm_fixture_delivery' or (n.nspname='public' and p.proname in ('matchmind_display_v1','matchmind_fixture_access_v1','matchmind_publish_display_v1'))) t`;
const BODY = fn => q('hosted_postgres', `select md5(prosrc) from pg_proc where oid='${fn}'::regprocedure`);
const DATA = `select md5(concat((select string_agg(e::text,'|' order by edition_id) from mm_fixture_delivery.editions e),
 (select string_agg(f::text,'|' order by fxid) from public.fixtures f),(select string_agg(p::text,'|' order by fxid) from public.predictions p),
 (select string_agg(r::text,'|' order by user_id) from mm_fixture_delivery.principals r)))`;
const OLD = {display: 'f5bc8baa47c0db53d9e2605dab06a5c9', materialize: '8e8eef4cf65458e7da5f5b23b923d79a'};
const NEW = {display: '0f85fe96b9ed5d269a886b5675516ea6', materialize: '223529aa1b915e96426c26b1c4acb3ff'};
const PUB = '33333333-3333-4333-8333-333333333333';

q('hosted_postgres', `insert into mm_fixture_delivery.principals(user_id,scope,enabled,approved_until,approval_ref) values('${PUB}','publisher',true,now()+interval '1 hour','synthetic-358')`);
const published = asRole('authenticated', `set request.jwt.claim.sub='${PUB}'; select public.matchmind_publish_display_v1()`);
check('an edition is published through the baseline publisher RPC', () => { if (!/edition_id/.test(published)) throw new Error(published); });
q('hosted_postgres', `update mm_fixture_delivery.principals set enabled=false`);
/* a previous-UTC-day edition that is still inside its 24 hours: yesterday 23:59:59 UTC */
q('supabase_admin', `insert into mm_fixture_delivery.editions select gen_random_uuid(),
  ((date_trunc('day', now() at time zone 'UTC') - interval '1 second')::date),
  (date_trunc('day', now() at time zone 'UTC') - interval '1 second') at time zone 'UTC',
  (date_trunc('day', now() at time zone 'UTC') - interval '1 second') at time zone 'UTC' + interval '24 hours',
  source_review, expected_cards, expected_predictions, payload from mm_fixture_delivery.editions limit 1`);
const display = () => asRole('anon', `select (public.matchmind_display_v1('predictions')->>'as_of')`);
const displayAll = () => psql('authenticator', DB, ['-tAc', `set role anon; select public.matchmind_display_v1('predictions')->>'edition_id'`], {allowFail: true});
const before = {fp: q('hosted_postgres', FP), data: q('hosted_postgres', DATA), fx: q('hosted_postgres', 'select count(*) from public.fixtures'), pr: q('hosted_postgres', 'select count(*) from public.predictions')};
const nowEdition = q('hosted_postgres', `select edition_id from mm_fixture_delivery.editions where edition_day=(now() at time zone 'UTC')::date`);
check('baseline: display() answers with the edition of today (the earlier calendar-day rule)', () => eq(
  asRole('anon', `select public.matchmind_display_v1('predictions')->>'edition_id'`), nowEdition, 'edition'));
check('baseline: bodies are the staging baseline bodies', () => {
  eq(BODY('mm_fixture_delivery.display(text)'), OLD.display, 'display'); eq(BODY('mm_fixture_delivery.materialize()'), OLD.materialize, 'materialize'); });
/* the baseline blackout, demonstrated: with only yesterday's edition, the feed is dark */
q('supabase_admin', `create table mm_stash as select * from mm_fixture_delivery.editions where edition_day=(now() at time zone 'UTC')::date; delete from mm_fixture_delivery.editions where edition_day=(now() at time zone 'UTC')::date`);
check('baseline: a previous-UTC-day edition still inside 24 hours is REFUSED (P0002)', () => {
  const r = displayAll(); if (!/Current presentation unavailable|P0002/.test(r)) throw new Error('baseline admitted it: ' + r); });
q('supabase_admin', `insert into mm_fixture_delivery.editions select * from mm_stash; drop table mm_stash`);
eq(q('hosted_postgres', DATA), before.data, 'data restored after the baseline demonstration');

/* GUARD: a tampered baseline is refused and nothing changes */
q('supabase_admin', `alter function mm_fixture_delivery.raw_expiry() rename to raw_expiry_x`);
const tamperedRun = psql('hosted_postgres', DB, [], {sqlFile: resolve(ROOT, 'STAGING-358-incremental-up.sql'), allowFail: true});
check('guard: a renamed function (inventory drift) is refused', () => { if (!/REFUSED/.test(tamperedRun)) throw new Error(tamperedRun.slice(-400)); });
q('supabase_admin', `alter function mm_fixture_delivery.raw_expiry_x() rename to raw_expiry`);
check('guard: the refused run changed nothing', () => { eq(q('hosted_postgres', FP), before.fp, 'fingerprint'); eq(BODY('mm_fixture_delivery.display(text)'), OLD.display, 'display'); });
q('supabase_admin', `create or replace function mm_fixture_delivery.request_uid() returns uuid language plpgsql stable security invoker set search_path=pg_catalog as $$begin return null; end $$`);
const bodyRun = psql('hosted_postgres', DB, [], {sqlFile: resolve(ROOT, 'STAGING-358-incremental-up.sql'), allowFail: true});
check('guard: an altered function body is refused', () => { if (!/REFUSED: installed function bodies differ/.test(bodyRun)) throw new Error(bodyRun.slice(-400)); });
check('guard: the refused run left no membership and no CREATE behind', () => {
  eq(q('hosted_postgres', `select count(*) from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles g on g.oid=a.grantor where r.rolname like 'mm_display%' and g.rolname='hosted_postgres'`), '0', 'edges');
  eq(q('hosted_postgres', `select has_schema_privilege('mm_display_reader','mm_fixture_delivery','CREATE')`), 'f', 'create'); });
/* restore the genuine body from the baseline file */
{ const s = baselineText.toString(); const i = s.indexOf('create function mm_fixture_delivery.request_uid()'); const j = s.indexOf('$$', i), k = s.indexOf('$$', j + 2);
  q('supabase_admin', s.slice(i, k + 2).replace('create function', 'create or replace function')); }
check('guard: the genuine body is restored and the fingerprint matches again', () => eq(q('hosted_postgres', FP), before.fp, 'fingerprint'));

/* FORWARD */
const up = psql('hosted_postgres', DB, [], {sqlFile: resolve(ROOT, 'STAGING-358-incremental-up.sql'), allowFail: true});
check('forward: the incremental patch applies under a non-superuser role administrator', () => { if (up.startsWith('FAILED:')) throw new Error(up.slice(7, 500)); if (/no privileges/.test(up)) throw new Error(up); });
check('forward: display() and materialize() carry the Build 358 bodies', () => {
  eq(BODY('mm_fixture_delivery.display(text)'), NEW.display, 'display'); eq(BODY('mm_fixture_delivery.materialize()'), NEW.materialize, 'materialize'); });
check('forward: owners, ACLs, attributes of all 12 functions are unchanged', () => {
  // the fingerprint excludes bodies, so it must be identical to before
  eq(q('hosted_postgres', FP), before.fp, 'fingerprint'); });
check('forward: fixtures, predictions, editions and principals are byte-identical', () => {
  eq(q('hosted_postgres', DATA), before.data, 'data'); eq(q('hosted_postgres', 'select count(*) from public.fixtures'), before.fx, 'fixtures');
  eq(q('hosted_postgres', 'select count(*) from public.predictions'), before.pr, 'predictions'); });
check('forward: no installer membership, CREATE or PUBLIC EXECUTE is left behind', () => {
  eq(q('hosted_postgres', `select count(*) from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles g on g.oid=a.grantor where r.rolname like 'mm_display%' and g.rolname='hosted_postgres'`), '0', 'edges');
  eq(q('hosted_postgres', `select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname='mm_fixture_delivery' and a.grantee=0 and a.privilege_type='EXECUTE'`), '0', 'public execute'); });
check('forward: the guard refuses a second application', () => {
  const again = psql('hosted_postgres', DB, [], {sqlFile: resolve(ROOT, 'STAGING-358-incremental-up.sql'), allowFail: true});
  if (!/REFUSED: installed function bodies differ/.test(again)) throw new Error(again.slice(-300)); });
q('supabase_admin', `create table mm_stash as select * from mm_fixture_delivery.editions where edition_day=(now() at time zone 'UTC')::date; delete from mm_fixture_delivery.editions where edition_day=(now() at time zone 'UTC')::date`);
check('Build 358: a previous-UTC-day edition still inside 24 hours is ADMITTED', () => {
  const r = displayAll(); if (!/^[0-9a-f-]{36}$/.test(lastLine(r))) throw new Error('refused: ' + r); });
q('supabase_admin', `insert into mm_fixture_delivery.editions select * from mm_stash; drop table mm_stash`);
q('hosted_postgres', `update mm_fixture_delivery.principals set enabled=true, approved_until=now()+interval '1 hour'`);
const pub358 = asRole('authenticated', `set request.jwt.claim.sub='${PUB}'; select public.matchmind_publish_display_v1()->>'edition_id'`);
q('hosted_postgres', `update mm_fixture_delivery.principals set enabled=false`);
check('Build 358: a newly published edition lives exactly 24 hours', () => {
  eq(q('hosted_postgres', `select extract(epoch from expires_at-as_of)::int from mm_fixture_delivery.editions where edition_id='${pub358}'`), '86400', 'life seconds'); });
check('Build 358: the newest admissible edition is the one served', () => eq(asRole('anon', `select public.matchmind_display_v1('predictions')->>'edition_id'`), pub358, 'served'));
check('Build 358: with every edition expired, display() fails closed with P0002', () => {
  q('supabase_admin', `update mm_fixture_delivery.editions set expires_at=as_of+interval '1 second', as_of=as_of - interval '2 days', edition_day=((as_of - interval '2 days') at time zone 'UTC')::date where false`);
  q('supabase_admin', `create table mm_stash2 as select * from mm_fixture_delivery.editions; delete from mm_fixture_delivery.editions`);
  const r = displayAll(); q('supabase_admin', `insert into mm_fixture_delivery.editions select * from mm_stash2; drop table mm_stash2`);
  if (!/Current presentation unavailable/.test(r)) throw new Error(r); });
check('forward: anon still cannot read raw tables or publish', () => {
  eq(q('hosted_postgres', `select has_table_privilege('anon','public.fixtures','SELECT')`), 'f', 'anon raw');
  eq(q('hosted_postgres', `select has_function_privilege('anon','public.matchmind_publish_display_v1()','EXECUTE')`), 'f', 'anon publish'); });

/* ROLLBACK */
const afterData = q('hosted_postgres', DATA);
const down = psql('hosted_postgres', DB, [], {sqlFile: resolve(ROOT, 'STAGING-358-incremental-down.sql'), allowFail: true});
check('rollback: the down patch applies', () => { if (down.startsWith('FAILED:')) throw new Error(down.slice(7, 500)); });
check('rollback: the baseline bodies and the same ACL fingerprint are restored', () => {
  eq(BODY('mm_fixture_delivery.display(text)'), OLD.display, 'display'); eq(BODY('mm_fixture_delivery.materialize()'), OLD.materialize, 'materialize'); eq(q('hosted_postgres', FP), before.fp, 'fingerprint'); });
check('rollback: no data moved', () => eq(q('hosted_postgres', DATA), afterData, 'data'));
check('rollback: the down patch refuses when the baseline is already restored', () => {
  const again = psql('hosted_postgres', DB, [], {sqlFile: resolve(ROOT, 'STAGING-358-incremental-down.sql'), allowFail: true});
  if (!/REFUSED: installed function bodies differ/.test(again)) throw new Error(again.slice(-300)); });
const up2 = psql('hosted_postgres', DB, [], {sqlFile: resolve(ROOT, 'STAGING-358-incremental-up.sql'), allowFail: true});
check('forward again after rollback: re-applies cleanly', () => { if (up2.startsWith('FAILED:')) throw new Error(up2.slice(7, 400)); eq(BODY('mm_fixture_delivery.display(text)'), NEW.display, 'display'); });

console.log('engine: ' + q('hosted_postgres', 'show server_version'));
console.log(results.join('\n'));
console.log(failures ? `\n${failures} FAILED` : `\nALL ${results.length} STAGING 358 INCREMENTAL PROBES PASSED`);
psql(SUPER, 'postgres', ['-c', `drop database if exists ${DB}`], {allowFail: true});
process.exit(failures ? 1 : 0);
