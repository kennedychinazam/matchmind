/* GENUINE Supabase Auth acceptance against the ISOLATED STAGING project.
 *
 * Corrected after Director review of 8 November 2026, which found four concrete defects in the
 * first version. Each correction is marked DR1..DR4 at the place it applies:
 *
 *   DR1  the sign-out assertion was factually wrong. Supabase revokes the REFRESH token on
 *        sign-out; an already minted access token stays valid until its own exp. The old test
 *        asserted the opposite and would have failed, or worse passed for a wrong reason.
 *   DR2  the tamper checks were vacuous. They now use the separately negative-controlled
 *        predicates in acceptance-predicates.mjs, and a forged token must be refused EXPLICITLY.
 *   DR3  deleting the Auth user is not proof the personal rows are gone, because app_state has
 *        no verified ON DELETE CASCADE. Rows are now deleted and their absence verified, and the
 *        original failure is preserved rather than masked by a cleanup error.
 *   DR4  secret routing is the workflow's job; this file only ever reads one environment
 *        variable and masks it before first use.
 *
 * SECRETS. The admin key arrives only in MM_STAGING_SERVICE_KEY. It is never written to a file,
 * never echoed, never placed in a URL, and never sent anywhere but the staging host. The two
 * disposable passwords are generated with crypto.randomBytes, masked before first use, and die
 * with the job.
 *
 * SAFETY. Refuses unless the target is the staging ref, refuses a key that looks publishable,
 * refuses if the production ref appears anywhere in its configuration. It creates NOTHING except
 * two Auth users and the rows those users write as themselves, and it removes both.
 */
import {randomBytes} from 'node:crypto';
import {classify, isGenuineDenial, isGenuineRead, isExplicitlyUnauthorized, explain}
  from './acceptance-predicates.mjs';

const STAGING_REF = 'rdcbnvfnxenrpnnwxszs';
const PRODUCTION_REF = 'toqfdrcjzwnlydqekude';
const BASE = `https://${STAGING_REF}.supabase.co`;
/* Public by design: the browser ships this. Never a secret. */
const PUBLISHABLE = 'sb_publishable_WKB88h4KAPtLVphsfNF9fg_W90ym80y';
const SERVICE = process.env.MM_STAGING_SERVICE_KEY || '';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (!SERVICE) {
  console.error('MM_STAGING_SERVICE_KEY is not set. This job cannot create disposable Auth users.');
  process.exit(78);
}
if (SERVICE.startsWith('sb_publishable_') || SERVICE.length < 20)
  throw Error('REFUSING: MM_STAGING_SERVICE_KEY does not look like a secret key');
if (BASE.includes(PRODUCTION_REF) || JSON.stringify(process.env.MM_TARGET || '').includes(PRODUCTION_REF))
  throw Error('REFUSING: production reference present in the target configuration');
if (!PUBLISHABLE.startsWith('sb_publishable_'))
  throw Error('REFUSING: the anon key is not a publishable key');

const mask = v => console.log(`::add-mask::${v}`);
mask(SERVICE);
const pw = () => { const v = randomBytes(24).toString('base64url') + 'Aa1!'; mask(v); return v; };

let passed = 0;
const check = (ok, name, detail = '') => {
  if (!ok) throw Error(`FAILED ${name} ${detail}`);
  console.log('PASS ' + name); passed++;
};
const note = (name, detail) => console.log(`NOTE ${name} ${detail}`);

const call = async (path, {method = 'GET', body, key = PUBLISHABLE, bearer, headers = {}} = {}) => {
  const r = await fetch(BASE + path, {
    method,
    headers: {apikey: key, 'Content-Type': 'application/json',
      ...(bearer ? {Authorization: 'Bearer ' + bearer} : {}), ...headers},
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000)});
  const raw = await r.text();
  let data; try { data = raw ? JSON.parse(raw) : null; } catch { data = {nonjson: raw.slice(0, 200)}; }
  return {status: r.status, data};
};
const admin = (path, opts = {}) => call(path, {...opts, key: SERVICE, bearer: SERVICE});
const claims = jwt => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));

const users = [];
let primary = null;
try {
  /* ── real users, through the official Admin API, never by touching auth tables ──
     DR3: each id is validated before the next user is created, so a silent creation failure
     cannot leave the run proceeding with an undefined id. */
  for (const tag of ['a', 'b']) {
    const email = `mm-staging-${tag}-${randomBytes(6).toString('hex')}@example.com`;
    const password = pw();
    const made = await admin('/auth/v1/admin/users', {method: 'POST',
      body: {email, password, email_confirm: true,
        user_metadata: {disposable: true, purpose: 'release-acceptance'}}});
    check(made.status === 200 || made.status === 201, `admin_created_user_${tag}`, explain(made));
    const id = made.data?.id;
    check(typeof id === 'string' && UUID_RE.test(id), `created_user_${tag}_has_a_real_uuid`, String(id));
    users.push({tag, email, password, id, token: null, refresh: null});
  }
  check(users.length === 2 && users[0].id !== users[1].id, 'two_distinct_users_exist');

  /* ── genuine password sign-in, with the PUBLISHABLE key, exactly as the app does ── */
  for (const u of users) {
    const s = await call('/auth/v1/token?grant_type=password', {method: 'POST',
      body: {email: u.email, password: u.password}});
    check(s.status === 200 && typeof s.data?.access_token === 'string',
      `real_password_sign_in_${u.tag}`, explain(s));
    u.token = s.data.access_token;
    u.refresh = s.data.refresh_token;
    const c = claims(u.token);
    check(c.role === 'authenticated', `jwt_role_is_authenticated_${u.tag}`, String(c.role));
    check(c.sub === u.id, `jwt_subject_matches_created_user_${u.tag}`);
    check(!c.is_super_admin && c.role !== 'service_role', `jwt_carries_no_elevated_claim_${u.tag}`);
    check(typeof c.exp === 'number' && c.exp * 1000 > Date.now(), `jwt_has_future_expiry_${u.tag}`);
  }
  const [A, B] = users;

  /* ── A/B owner isolation, through PostgREST, as the signed-in users ──
     Every assertion below carries a real token. A.token exists only because the sign-in check
     above passed, and that check throws, so the script cannot reach here unauthenticated. A
     "denied" result here therefore cannot be the trivial denial of an anonymous request. */
  const wroteA = await call('/rest/v1/app_state', {method: 'POST', bearer: A.token,
    body: {user_id: A.id, fav_teams: ['acceptance-A']}, headers: {Prefer: 'return=representation'}});
  check(wroteA.status === 201, 'owner_A_writes_its_own_row', explain(wroteA));
  const wroteB = await call('/rest/v1/app_state', {method: 'POST', bearer: B.token,
    body: {user_id: B.id, fav_teams: ['acceptance-B']}, headers: {Prefer: 'return=representation'}});
  check(wroteB.status === 201, 'owner_B_writes_its_own_row', explain(wroteB));

  const readA = await call('/rest/v1/app_state?select=user_id,fav_teams', {bearer: A.token});
  check(isGenuineRead(readA) && readA.data.length === 1 && readA.data[0].user_id === A.id,
    'owner_A_reads_only_its_own_row', explain(readA));
  const readB = await call('/rest/v1/app_state?select=user_id,fav_teams', {bearer: B.token});
  check(isGenuineRead(readB) && readB.data.length === 1 && readB.data[0].user_id === B.id,
    'owner_B_reads_only_its_own_row', explain(readB));

  const crossRead = await call(`/rest/v1/app_state?select=*&user_id=eq.${B.id}`, {bearer: A.token});
  check(isGenuineDenial(crossRead), 'owner_A_cannot_read_B_row', explain(crossRead));
  const crossWrite = await call(`/rest/v1/app_state?user_id=eq.${B.id}`, {method: 'PATCH',
    bearer: A.token, body: {fav_teams: ['tampered-by-A']}, headers: {Prefer: 'return=representation'}});
  check(isGenuineDenial(crossWrite), 'owner_A_cannot_update_B_row', explain(crossWrite));
  const foreignInsert = await call('/rest/v1/app_state', {method: 'POST', bearer: A.token,
    body: {user_id: '00000000-0000-4000-8000-000000000000', fav_teams: ['forged']}});
  check(foreignInsert.status >= 400 && foreignInsert.status < 500,
    'owner_A_cannot_insert_for_another_owner', explain(foreignInsert));

  const stillB = await call('/rest/v1/app_state?select=fav_teams', {bearer: B.token});
  check(isGenuineRead(stillB) && JSON.stringify(stillB.data) === JSON.stringify([{fav_teams: ['acceptance-B']}]),
    'owner_B_row_unchanged_after_A_attempts', explain(stillB));

  /* ── an authenticated ordinary user is still an ordinary user ── */
  for (const table of ['fixtures', 'predictions', 'shared_records', 'daily_slips',
                       'fixtures_lean', 'provider_alias', 'odds_latest']) {
    const r = await call(`/rest/v1/${table}?select=*`, {bearer: A.token});
    check(isGenuineDenial(r), 'authenticated_no_raw_feed_' + table, explain(r));
  }
  const cap = await call('/rest/v1/rpc/matchmind_fixture_access_v1', {method: 'POST', body: {}, bearer: A.token});
  check(cap.status === 200 && cap.data?.raw_allowed === false, 'authenticated_raw_capability_false', explain(cap));

  /* PROPOSAL-up.sql deliberately grants EXECUTE on the publish entry point to `authenticated`,
     so the refusal is the runtime gate's, not an ACL's. Both halves are asserted. */
  const pubAcl = await call('/rest/v1/rpc/matchmind_publish_display_v1', {method: 'POST', body: {}, bearer: A.token});
  check(pubAcl.status >= 400 && pubAcl.status < 500, 'authenticated_publish_refused', explain(pubAcl));
  check(/scoped publisher|publisher/i.test(JSON.stringify(pubAcl.data)),
    'authenticated_publish_refused_BY_THE_GATE_not_by_acl', explain(pubAcl));
  const hist = await call('/rest/v1/rpc/matchmind_display_v1', {method: 'POST', body: {screen: 'history'}, bearer: A.token});
  check(hist.status === 200 && Array.isArray(hist.data?.cards),
    'authenticated_still_reads_bounded_display', explain(hist));

  /* ── DR2: token integrity, with explicit refusals, not "something went wrong" ── */
  const parts = A.token.split('.');
  const tampered = [parts[0], Buffer.from(JSON.stringify({...claims(A.token), role: 'service_role'}))
    .toString('base64url'), parts[2]].join('.');
  const forgedRole = await call('/rest/v1/fixtures?select=*', {bearer: tampered});
  check(isExplicitlyUnauthorized(forgedRole),
    'tampered_jwt_claiming_service_role_refused_401_or_403', explain(forgedRole));
  const garbage = await call('/rest/v1/app_state?select=*', {bearer: parts[0] + '.' + parts[1] + '.deadbeef'});
  check(isExplicitlyUnauthorized(garbage), 'jwt_with_broken_signature_refused_401_or_403', explain(garbage));
  /* A forged role HEADER rides a VALID token, so the contract is different: the request is
     answered normally and must simply yield no privileged rows. An error here would not be a
     pass, so the genuine-denial contract is required rather than "not rows". */
  const headerRole = await call('/rest/v1/fixtures?select=*', {bearer: A.token,
    headers: {role: 'service_role', 'x-postgrest-role': 'service_role'}});
  check(isGenuineDenial(headerRole), 'forged_role_header_yields_no_privileged_rows', explain(headerRole));
  check(classify(headerRole) !== 'server_error' && classify(headerRole) !== 'malformed',
    'forged_role_header_answer_is_a_real_contract_not_an_error', explain(headerRole));

  /* ── DR1: sign-out, tested against what Supabase actually does ──
     Supabase revokes the REFRESH token on sign-out. An access token already minted stays valid
     until its own exp; that is documented platform behaviour, not an app defect, and the previous
     version of this harness asserted the opposite. So: prove the refresh path is dead, and record
     the access token's remaining life as a bounded, finite window. */
  const lifetime = claims(A.token).exp - claims(A.token).iat;
  note('access_token_lifetime_seconds', String(lifetime));
  check(Number.isFinite(lifetime) && lifetime > 0 && lifetime <= 24 * 3600,
    'access_token_lifetime_is_finite_and_within_24h', String(lifetime));

  const out = await call('/auth/v1/logout', {method: 'POST', bearer: A.token});
  check(out.status === 204 || out.status === 200, 'sign_out_accepted', explain(out));

  const renew = await call('/auth/v1/token?grant_type=refresh_token', {method: 'POST',
    body: {refresh_token: A.refresh}});
  check(renew.status >= 400 && renew.status < 500,
    'refresh_token_revoked_by_sign_out', explain(renew));
  check(typeof renew.data?.access_token !== 'string',
    'sign_out_yields_no_new_access_token', explain(renew));

  const remaining = claims(A.token).exp - Math.floor(Date.now() / 1000);
  note('access_token_still_valid_for_seconds_after_signout_by_design', String(remaining));
  note('access_token_expiry_not_tested_to_exhaustion',
    `would require waiting ${remaining}s; out of scope for this job, recorded rather than claimed`);
} catch (e) {
  primary = e;
}

/* ── DR3: cleanup. Rows first, then users, then verify BOTH are gone ──
   Deleting the Auth user is not proof the personal rows went with it: app_state has no verified
   ON DELETE CASCADE. Rows are removed by their own owner where a token exists, and otherwise by
   the authorized staging admin path. Nothing here can mask the original failure: problems are
   collected and reported after it. */
const cleanupProblems = [];
for (const u of users) {
  if (!u.id) continue;
  try {
    const byOwner = u.token
      ? await call(`/rest/v1/app_state?user_id=eq.${u.id}`, {method: 'DELETE', bearer: u.token})
      : {status: 0, data: null};
    const byAdmin = await admin(`/rest/v1/app_state?user_id=eq.${u.id}`, {method: 'DELETE'});
    const left = await admin(`/rest/v1/app_state?select=user_id&user_id=eq.${u.id}`);
    const rowsGone = Array.isArray(left.data) && left.data.length === 0;
    console.log(`${rowsGone ? 'PASS' : 'LEFTOVER'} app_state_rows_removed_${u.tag} ` +
      `owner=${byOwner.status} admin=${byAdmin.status} ${explain(left)}`);
    if (!rowsGone) cleanupProblems.push(`app_state rows for ${u.tag} (${u.id}) survived`);

    const del = await admin(`/auth/v1/admin/users/${u.id}`, {method: 'DELETE'});
    const userGone = del.status === 200 || del.status === 204;
    const gone = await admin(`/auth/v1/admin/users/${u.id}`);
    const absent = gone.status === 404;
    console.log(`${userGone && absent ? 'PASS' : 'LEFTOVER'} disposable_user_removed_${u.tag} ` +
      `delete=${del.status} lookup=${gone.status}`);
    if (!(userGone && absent)) cleanupProblems.push(`auth user ${u.tag} (${u.id}) survived`);
  } catch (e) {
    cleanupProblems.push(`cleanup threw for ${u.tag} (${u.id}): ${e.message}`);
  }
}
for (const p of cleanupProblems) console.log(`::warning::${p}`);

/* The original failure wins. Incomplete cleanup is its own failure when nothing else went wrong. */
if (primary) {
  console.error(String(primary.message));
  if (cleanupProblems.length) console.error('cleanup also incomplete: ' + cleanupProblems.join('; '));
  process.exit(1);
}
if (cleanupProblems.length) {
  console.error('CLEANUP INCOMPLETE: ' + cleanupProblems.join('; '));
  process.exit(1);
}
console.log('MATCHMIND_STAGING_AUTHENTICATED_ACCEPTANCE_PASS ' + passed);
