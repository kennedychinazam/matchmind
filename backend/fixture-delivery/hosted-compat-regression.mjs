/* Hosted-Supabase compatibility regression for the fixture-delivery migration.
 *
 * WHY IT EXISTS. The migration installed cleanly for years against a LOCAL SUPERUSER and failed on
 * hosted Supabase, where `postgres` is a role administrator but NOT a superuser and the `auth`
 * schema belongs to `supabase_admin`. Two defects followed, both reported from Director staging on
 * PostgreSQL 17.11 and both reproduced here before anything was changed:
 *   S1  alter function ... owner to mm_display_reader  ->  42501 must be able to SET ROLE
 *   S2  grant usage on schema auth ...                 ->  WARNING: no privileges were granted
 *       and then, at run time, 42501 permission denied for schema auth inside a definer function.
 *
 * It builds a cluster SHAPED like hosted Supabase and installs the real, source-controlled
 * PROPOSAL-up.sql as a non-superuser role administrator. Every role, schema and row is invented.
 * It never contacts a hosted database, a provider or a network service of any kind.
 *
 *   node backend/fixture-delivery/hosted-compat-regression.mjs
 *   node backend/fixture-delivery/hosted-compat-regression.mjs --negative-control
 *
 * Connection comes from PGHOST / PGPORT / PGUSER / PGPASSWORD, so the same file runs against the
 * local PostgreSQL 16 cluster and against the PostgreSQL 17 service container in CI.
 *
 * --negative-control strips the S1 and S2 fixes back out and REQUIRES the install to fail with
 * those exact errors. A regression that can only pass proves nothing.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const NEGATIVE = process.argv.includes('--negative-control');
const work = mkdtempSync(join(tmpdir(), 'mm-hosted-'));
const SUPER = process.env.PGUSER || 'postgres';
const DB = 'mm_hosted_' + Date.now();

const psql = (user, db, args, {sqlFile, sql, allowFail = false} = {}) => {
  const base = ['-X', '-v', 'ON_ERROR_STOP=1', '-U', user, ...(db ? ['-d', db] : []), ...args];
  if (sqlFile) base.push('-f', sqlFile);
  try {
    return execFileSync('psql', base, {input: sql, encoding: 'utf8', timeout: 120000,
      env: {...process.env, PGOPTIONS: '-c client_min_messages=warning'}}).trim();
  } catch (e) {
    const text = String(e.stdout || '') + String(e.stderr || '');
    if (allowFail) return 'FAILED:' + text.trim();
    throw new Error(text.trim() || e.message);
  }
};
/* psql echoes SET/RESET tags, so take the last non-empty line as the answer. */
const lastLine = out => out.split('\n').map(x => x.trim()).filter(Boolean).pop() ?? '';
const q = (user, sql) => lastLine(psql(user, DB, ['-tAc', sql]));
/* The capability functions are granted to anon and authenticated, not to the installer. Probe
   them the way a real caller arrives: log in as the authenticator and SET ROLE, exactly as
   PostgREST does. */
const asRole = (role, sql) => lastLine(psql('authenticator', DB, ['-tAc', `set role ${role}; ${sql}`]));

const results = [];
let failures = 0;
const check = (name, fn) => {
  try { fn(); results.push('PASS  ' + name); }
  catch (e) { failures++; results.push('FAIL  ' + name + '\n        ' + String(e.message).split('\n').slice(0, 3).join('\n        ')); }
};
const eq = (got, want, what) => { if (String(got) !== String(want)) throw new Error(`${what}: got ${got}, want ${want}`); };

/* ── the hosted shape ─────────────────────────────────────────────────────────────────────── */
/* Clear anything a previous run of THIS harness left behind. Roles are cluster-wide, so a
   leftover database still holding objects they own blocks the role drop below. */
for (const old of psql(SUPER, 'postgres', ['-tAc',
    "select datname from pg_database where datname like 'mm\\_hosted\\_%'"]).split('\n').filter(Boolean)) {
  psql(SUPER, 'postgres', ['-c', `drop database if exists "${old.trim()}"`], {allowFail: true});
}
psql(SUPER, 'postgres', ['-c', `drop database if exists ${DB}`]);
for (const [role, opts] of [['supabase_admin', 'login superuser'], ['hosted_postgres', 'login createrole createdb'],
    ['anon', 'nologin'], ['authenticated', 'nologin'], ['service_role', 'nologin bypassrls'],
    ['authenticator', 'login noinherit']]) {
  psql(SUPER, 'postgres', ['-c',
    `do $$begin if not exists(select 1 from pg_roles where rolname='${role}') then execute 'create role ${role} ${opts}'; end if; end$$`]);
}
psql(SUPER, 'postgres', ['-c', 'grant anon,authenticated,service_role to authenticator']);
/* An installer with CREATE on the database but NO role administration, to prove the migration
   refuses rather than half-installing when it cannot take what it needs. */
psql(SUPER, 'postgres', ['-c',
  "do $$begin if not exists(select 1 from pg_roles where rolname='weak_installer') then execute 'create role weak_installer login'; end if; end$$"]);
// a clean slate for the two roles this migration creates
for (const role of ['mm_display_reader', 'mm_display_materializer']) {
  const dropped = psql(SUPER, 'postgres', ['-c', `drop role if exists ${role}`], {allowFail: true});
  if (dropped.startsWith('FAILED:'))
    throw new Error(`cannot start from a clean slate: ${role} still has dependent objects.\n` + dropped.slice(7, 300));
}
psql(SUPER, 'postgres', ['-c', `create database ${DB} owner hosted_postgres`]);

/* auth belongs to supabase_admin, and `postgres` gets USAGE WITHOUT grant option — which is what
   makes the proposal's `grant usage on schema auth to ...` a silent no-op on hosted. */
psql('supabase_admin', DB, [], {sql: `
  create schema auth authorization supabase_admin;
  create function auth.uid() returns uuid language sql stable as
   $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
      (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid$$;
  grant usage on schema auth to anon, authenticated, service_role, authenticator, hosted_postgres;
  grant execute on function auth.uid() to anon, authenticated, service_role, authenticator, hosted_postgres;
`});

/* the project's own synthetic bootstrap, minus the lines hosted Supabase already provides */
const bootstrap = readFileSync(resolve(ROOT, 'synthetic-bootstrap.sql'), 'utf8')
  .split('\n')
  .filter(l => !/^create role |^create schema auth;|^create function auth\.uid\(\)|^do \$\$begin execute format\('alter role authenticator password|^grant anon,authenticated,service_role to authenticator;|^grant execute on function auth\.uid\(\) to anon,authenticated,service_role;/.test(l))
  .map(l => l.replace('grant usage on schema public,auth to', 'grant usage on schema public to'))
  .join('\n');
writeFileSync(join(work, 'bootstrap.sql'), bootstrap);
psql('hosted_postgres', DB, [], {sqlFile: join(work, 'bootstrap.sql')});

/* the migration under test, optionally with its two fixes removed */
let up = readFileSync(resolve(ROOT, 'PROPOSAL-up.sql'), 'utf8');
if (NEGATIVE) {
  /* Put the migration back the way it was before the S1 and S2 fixes, and INSIST each edit
     applied. A control that silently fails to remove the fix would "hold" for the wrong reason. */
  const undo = (label, re, to) => {
    const before = up;
    up = up.replace(re, to);
    if (up === before) throw new Error('negative control could not remove the fix: ' + label);
  };
  undo('S1 reader enablement',
    /do \$\$begin\r?\n if not pg_catalog\.pg_has_role\(current_user,'mm_display_reader','SET'\)[\s\S]*?end \$\$;\r?\n/, '');
  undo('S1 materializer enablement',
    /do \$\$begin\r?\n if not pg_catalog\.pg_has_role\(current_user,'mm_display_materializer','SET'\)[\s\S]*?end \$\$;\r?\n/, '');
  undo('S1 temporary CREATE grants',
    /grant create on schema mm_fixture_delivery to mm_display_reader;\r?\n/, '');
  up = up.replace(/grant create on schema mm_fixture_delivery to mm_display_materializer;\r?\n/, '');
  undo('S2 commented-out auth grants',
    /--   grant usage on schema auth to mm_display_reader;\r?\n--   grant execute on function auth\.uid\(\) to mm_display_reader;\r?\n/,
    'grant usage on schema auth to mm_display_reader;\ngrant execute on function auth.uid() to mm_display_reader;\n');
  /* Remove the helper's own definition and grants FIRST. Renaming every occurrence would turn
     its CREATE statement into `create function auth.uid()`, which fails for an unrelated reason
     and would have the control "pass" on the wrong error. */
  undo('S2 helper definition',
    /-- S2 FIX: THE REQUEST SUBJECT[\s\S]*?grant execute on function mm_fixture_delivery\.request_uid\(\) to mm_display_reader;[^\n]*\r?\n/, '');
  up = up.replace(/grant execute on function mm_fixture_delivery\.request_uid\(\) to mm_display_materializer;\r?\n/, '');
  undo('S2 private subject reader call sites',
    /mm_fixture_delivery\.request_uid\(\)/g, 'auth.uid()');
}
writeFileSync(join(work, 'up.sql'), up);
const installed = psql('hosted_postgres', DB, [], {sqlFile: join(work, 'up.sql'), allowFail: true});

if (NEGATIVE) {
  check('negative control: the install FAILS without the S1 fix', () => {
    if (!installed.startsWith('FAILED:')) throw new Error('the install succeeded with the fix removed');
    if (!/must be able to SET ROLE/.test(installed))
      throw new Error('failed, but not with the S1 error. Got: ' + installed.slice(-600));
  });
  check('negative control: the auth grants are refused with the S2 fix removed', () => {
    if (!/no privileges were granted for "auth"/.test(installed))
      throw new Error('the ineffective auth grant warning was not observed');
  });
  console.log(results.join('\n'));
  console.log(failures ? `\nNEGATIVE CONTROL FAILED (${failures})` : '\nNEGATIVE CONTROL HELD');
  psql(SUPER, 'postgres', ['-c', `drop database if exists ${DB}`], {allowFail: true});
  process.exit(failures ? 1 : 0);
}

check('S1: the migration installs under a non-superuser role administrator', () => {
  if (installed.startsWith('FAILED:')) throw new Error(installed.slice(7, 400));
});
check('S1 cleanup: neither owner role keeps CREATE on the private schema', () => {
  eq(q('hosted_postgres', `select has_schema_privilege('mm_display_reader','mm_fixture_delivery','CREATE')`), 'f', 'reader CREATE');
  eq(q('hosted_postgres', `select has_schema_privilege('mm_display_materializer','mm_fixture_delivery','CREATE')`), 'f', 'materializer CREATE');
});
check('S1 cleanup: no membership granted by the installer is left behind', () => {
  eq(q('hosted_postgres', `select count(*) from pg_auth_members a join pg_roles r on r.oid=a.roleid
       join pg_roles g on g.oid=a.grantor where r.rolname like 'mm_display%' and g.rolname='hosted_postgres'`), '0', 'installer edges');
});
check("S1 cleanup: the platform's own administrative membership is untouched", () => {
  eq(q('hosted_postgres', `select count(*) from pg_auth_members a join pg_roles r on r.oid=a.roleid
       join pg_roles m on m.oid=a.member where r.rolname like 'mm_display%' and m.rolname='hosted_postgres'
       and a.admin_option`), '2', 'platform admin edges');
});
check('S2: the function owner has NO access to the auth schema', () => {
  eq(q('hosted_postgres', `select has_schema_privilege('mm_display_reader','auth','USAGE')`), 'f', 'reader auth USAGE');
});
check('S2: a capability check runs anyway, and refuses an absent subject', () => {
  eq(asRole('authenticated', 'select mm_fixture_delivery.raw_allowed()'), 'f', 'no subject');
});
check('S2: a malformed subject is refused, not raised', () => {
  eq(asRole('authenticated', `set request.jwt.claim.sub='not-a-uuid'; select mm_fixture_delivery.raw_allowed()`), 'f', 'malformed sub');
});
check('S2: a malformed claims document is refused, not raised', () => {
  eq(asRole('authenticated', `set request.jwt.claims='{oops'; select mm_fixture_delivery.raw_allowed()`), 'f', 'malformed claims');
});
check('S2: the claims fallback is read when the direct claim is absent', () => {
  eq(asRole('authenticated', `set request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111"}';
       select mm_fixture_delivery.raw_allowed()`), 'f', 'claims fallback reaches the check');
});
check('owner mismatch: a well-formed but unenrolled subject is refused', () => {
  eq(asRole('authenticated', `set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
       select mm_fixture_delivery.raw_allowed()`), 'f', 'unenrolled');
});
check('the capability admits exactly the enrolled subject', () => {
  q('hosted_postgres', `insert into mm_fixture_delivery.principals(user_id,scope,enabled,approved_until,approval_ref)
     values('33333333-3333-4333-8333-333333333333','publisher',true,now()+interval '1 hour','synthetic-regression')`);
  eq(asRole('authenticated', `set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
       select mm_fixture_delivery.raw_allowed()`), 't', 'enrolled');
  eq(asRole('authenticated', `set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
       select mm_fixture_delivery.raw_allowed()`), 'f', 'still refuses others');
});
check('public RPC misuse: anon and authenticated cannot execute the private subject reader', () => {
  eq(q('hosted_postgres', `select has_function_privilege('anon','mm_fixture_delivery.request_uid()','EXECUTE')`), 'f', 'anon');
  eq(q('hosted_postgres', `select has_function_privilege('authenticated','mm_fixture_delivery.request_uid()','EXECUTE')`), 'f', 'authenticated');
});
check('public RPC misuse: anon cannot execute the publisher entry point', () => {
  eq(q('hosted_postgres', `select has_function_privilege('anon','public.matchmind_publish_display_v1()','EXECUTE')`), 'f', 'anon publish');
});
check('default deny: anon holds no raw SELECT on the source tables', () => {
  eq(q('hosted_postgres', `select has_table_privilege('anon','public.fixtures','SELECT')`), 'f', 'anon fixtures');
});
check('the collector keeps its read', () => {
  eq(q('hosted_postgres', `select has_table_privilege('service_role','public.fixtures','SELECT')`), 't', 'service_role');
});

/* The failure path: an installer that cannot administer roles must abort transactionally and
   leave nothing behind. Run in its own database so a partial install would be visible. */
const WEAK = DB + '_weak';
psql(SUPER, 'postgres', ['-c', `create database ${WEAK} owner weak_installer`]);
psql('supabase_admin', WEAK, [], {sql: `
  create schema auth authorization supabase_admin;
  create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
  grant usage on schema auth to weak_installer;`});
psql(SUPER, WEAK, ['-c', 'grant create on database ' + WEAK + ' to weak_installer'], {allowFail: true});
const weakRun = psql('weak_installer', WEAK, [], {sqlFile: join(work, 'up.sql'), allowFail: true});
check('a non-administrator installer is refused, with a message naming the problem', () => {
  if (!weakRun.startsWith('FAILED:')) throw new Error('the migration installed without role administration');
  if (!/cannot take SET ROLE on mm_display_reader|permission denied to create role|must be able to SET ROLE/.test(weakRun))
    throw new Error('refused, but not for the expected reason: ' + weakRun.slice(-400));
});
check('the refused install leaves no schema, and no half-made state', () => {
  eq(lastLine(psql(SUPER, WEAK, ['-tAc', "select count(*) from pg_namespace where nspname='mm_fixture_delivery'"])), '0', 'private schema');
});
psql(SUPER, 'postgres', ['-c', `drop database if exists ${WEAK}`], {allowFail: true});

/* rollback, by the same non-superuser, and its own cleanup */
const reverted = psql('hosted_postgres', DB, [], {sqlFile: resolve(ROOT, 'PROPOSAL-revert.sql'), allowFail: true});
check('rollback: the revert runs under the same non-superuser installer', () => {
  if (reverted.startsWith('FAILED:')) throw new Error(reverted.slice(7, 400));
});
check('rollback: the original broad exposure is restored', () => {
  eq(q('hosted_postgres', `select has_table_privilege('anon','public.fixtures','SELECT')`), 't', 'anon after revert');
});
check('rollback cleanup: the revert leaves no membership of its own behind', () => {
  eq(q('hosted_postgres', `select count(*) from pg_auth_members a join pg_roles r on r.oid=a.roleid
       join pg_roles g on g.oid=a.grantor where r.rolname like 'mm_display%' and g.rolname='hosted_postgres'`), '0', 'revert edges');
});

console.log('engine: ' + q('hosted_postgres', 'show server_version'));
console.log(results.join('\n'));
console.log(failures ? `\n${failures} FAILED` : `\nALL ${results.length} HOSTED COMPATIBILITY PROBES PASSED`);
psql(SUPER, 'postgres', ['-c', `drop database if exists ${DB}`], {allowFail: true});
process.exit(failures ? 1 : 0);
