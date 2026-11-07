/* GENUINE Supabase Auth acceptance against the ISOLATED STAGING project.
 *
 * This is the one piece of the release evidence that could not be produced offline: real GoTrue
 * sign-ins with real JWTs, exercised over HTTP against the installed PR #26 migration. The
 * Director's anonymous run (16/16) proved the unauthenticated surface; this proves the
 * authenticated one.
 *
 * SECRETS. The admin key arrives only in MM_STAGING_SERVICE_KEY, from a repository secret. It is
 * never written to a file, never echoed, never placed in a URL, and never sent anywhere but the
 * staging host. The two disposable passwords are generated here with crypto.randomBytes, are
 * registered with the runner's masker before first use, and die with the job. Nothing from this
 * file is committed back.
 *
 * SAFETY. It refuses to run unless the target is the staging project ref, refuses if the key
 * looks publishable rather than secret, and refuses outright if the production ref appears
 * anywhere in its configuration. Both users are deleted in a finally block and their deletion is
 * then verified, so a failure part-way through still cleans up.
 *
 * It creates NOTHING except two Auth users and the rows those users write as themselves. It never
 * touches fixtures, predictions, editions, forecasts or archives.
 */
import {randomBytes} from 'node:crypto';

const STAGING_REF = 'rdcbnvfnxenrpnnwxszs';
const PRODUCTION_REF = 'toqfdrcjzwnlydqekude';
const BASE = `https://${STAGING_REF}.supabase.co`;
/* Public by design: the browser ships this. Never a secret. */
const PUBLISHABLE = 'sb_publishable_WKB88h4KAPtLVphsfNF9fg_W90ym80y';
const SERVICE = process.env.MM_STAGING_SERVICE_KEY || '';

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
const pw = () => { const v = randomBytes(24).toString('base64url') + 'Aa1!'; mask(v); return v; };
mask(SERVICE);

let passed = 0;
const check = (ok, name, detail = '') => {
  if (!ok) throw Error(`FAILED ${name} ${detail}`);
  console.log('PASS ' + name); passed++;
};

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
try {
  /* ── real users, created through the official Admin API, never by touching auth tables ── */
  for (const tag of ['a', 'b']) {
    const email = `mm-staging-${tag}-${randomBytes(6).toString('hex')}@example.com`;
    const password = pw();
    const made = await admin('/auth/v1/admin/users', {method: 'POST',
      body: {email, password, email_confirm: true, user_metadata: {disposable: true, purpose: 'release-acceptance'}}});
    check(made.status === 200 || made.status === 201, `admin_created_user_${tag}`, 'http ' + made.status +
      ' ' + JSON.stringify(made.data).slice(0, 200));
    users.push({tag, email, password, id: made.data?.id, token: null});
  }

  /* ── genuine password sign-in, with the PUBLISHABLE key, exactly as the app does ── */
  for (const u of users) {
    const s = await call('/auth/v1/token?grant_type=password', {method: 'POST',
      body: {email: u.email, password: u.password}});
    check(s.status === 200 && typeof s.data?.access_token === 'string', `real_password_sign_in_${u.tag}`,
      'http ' + s.status);
    u.token = s.data.access_token;
    const c = claims(u.token);
    check(c.role === 'authenticated', `jwt_role_is_authenticated_${u.tag}`, String(c.role));
    check(c.sub === u.id, `jwt_subject_matches_created_user_${u.tag}`);
    check(!c.is_super_admin && c.role !== 'service_role', `jwt_carries_no_elevated_claim_${u.tag}`);
    check(typeof c.exp === 'number' && c.exp * 1000 > Date.now(), `jwt_has_future_expiry_${u.tag}`);
  }
  const [A, B] = users;

  /* ── A/B owner isolation, through PostgREST, as the signed-in users ── */
  const wroteA = await call('/rest/v1/app_state', {method: 'POST', bearer: A.token,
    body: {user_id: A.id, fav_teams: ['acceptance-A']}, headers: {Prefer: 'return=representation'}});
  check(wroteA.status === 201, 'owner_A_writes_its_own_row', 'http ' + wroteA.status +
    ' ' + JSON.stringify(wroteA.data).slice(0, 160));
  const wroteB = await call('/rest/v1/app_state', {method: 'POST', bearer: B.token,
    body: {user_id: B.id, fav_teams: ['acceptance-B']}, headers: {Prefer: 'return=representation'}});
  check(wroteB.status === 201, 'owner_B_writes_its_own_row', 'http ' + wroteB.status);

  const readA = await call('/rest/v1/app_state?select=user_id,fav_teams', {bearer: A.token});
  check(readA.status === 200 && Array.isArray(readA.data) && readA.data.length === 1 &&
    readA.data[0].user_id === A.id, 'owner_A_reads_only_its_own_row',
    'http ' + readA.status + ' n=' + (readA.data?.length));
  const readB = await call('/rest/v1/app_state?select=user_id,fav_teams', {bearer: B.token});
  check(readB.status === 200 && readB.data?.length === 1 && readB.data[0].user_id === B.id,
    'owner_B_reads_only_its_own_row', 'n=' + (readB.data?.length));

  const crossRead = await call(`/rest/v1/app_state?select=*&user_id=eq.${B.id}`, {bearer: A.token});
  check(crossRead.status === 200 && Array.isArray(crossRead.data) && crossRead.data.length === 0,
    'owner_A_cannot_read_B_row', 'n=' + (crossRead.data?.length));
  const crossWrite = await call(`/rest/v1/app_state?user_id=eq.${B.id}`, {method: 'PATCH', bearer: A.token,
    body: {fav_teams: ['tampered-by-A']}, headers: {Prefer: 'return=representation'}});
  check(!(crossWrite.status === 200 && Array.isArray(crossWrite.data) && crossWrite.data.length > 0),
    'owner_A_cannot_update_B_row', 'http ' + crossWrite.status + ' n=' + (crossWrite.data?.length));
  const foreignInsert = await call('/rest/v1/app_state', {method: 'POST', bearer: A.token,
    body: {user_id: '00000000-0000-4000-8000-000000000000', fav_teams: ['forged']}});
  check(foreignInsert.status >= 400, 'owner_A_cannot_insert_for_another_owner', 'http ' + foreignInsert.status);

  const stillB = await call('/rest/v1/app_state?select=fav_teams', {bearer: B.token});
  check(JSON.stringify(stillB.data) === JSON.stringify([{fav_teams: ['acceptance-B']}]),
    'owner_B_row_unchanged_after_A_attempts', JSON.stringify(stillB.data).slice(0, 120));

  /* ── an authenticated ordinary user is still an ordinary user ── */
  for (const table of ['fixtures', 'predictions', 'shared_records', 'daily_slips',
                       'fixtures_lean', 'provider_alias', 'odds_latest']) {
    const r = await call(`/rest/v1/${table}?select=*`, {bearer: A.token});
    check(!(r.status === 200 && Array.isArray(r.data) && r.data.length > 0),
      'authenticated_no_raw_feed_' + table, 'http ' + r.status + ' n=' + (r.data?.length));
  }
  const cap = await call('/rest/v1/rpc/matchmind_fixture_access_v1', {method: 'POST', body: {}, bearer: A.token});
  check(cap.status === 200 && cap.data?.raw_allowed === false, 'authenticated_raw_capability_false',
    JSON.stringify(cap.data).slice(0, 120));
  const pub = await call('/rest/v1/rpc/matchmind_publish_display_v1', {method: 'POST', body: {}, bearer: A.token});
  check(pub.status >= 400, 'authenticated_cannot_publish', 'http ' + pub.status);
  const hist = await call('/rest/v1/rpc/matchmind_display_v1', {method: 'POST', body: {screen: 'history'}, bearer: A.token});
  check(hist.status === 200 && Array.isArray(hist.data?.cards), 'authenticated_still_reads_bounded_display',
    'http ' + hist.status);

  /* ── token integrity ── */
  const parts = A.token.split('.');
  const tampered = [parts[0], Buffer.from(JSON.stringify({...claims(A.token), role: 'service_role'}))
    .toString('base64url'), parts[2]].join('.');
  const forgedRole = await call('/rest/v1/fixtures?select=*', {bearer: tampered});
  check(!(forgedRole.status === 200 && Array.isArray(forgedRole.data) && forgedRole.data.length > 0),
    'tampered_jwt_claiming_service_role_rejected', 'http ' + forgedRole.status);
  const garbage = await call('/rest/v1/app_state?select=*', {bearer: parts[0] + '.' + parts[1] + '.deadbeef'});
  check(garbage.status >= 400, 'jwt_with_broken_signature_rejected', 'http ' + garbage.status);
  const headerRole = await call('/rest/v1/fixtures?select=*', {bearer: A.token,
    headers: {role: 'service_role', 'x-postgrest-role': 'service_role'}});
  check(!(headerRole.status === 200 && Array.isArray(headerRole.data) && headerRole.data.length > 0),
    'authenticated_role_header_not_elevated', 'http ' + headerRole.status);

  /* ── sign out, and prove the session is over ── */
  const out = await call('/auth/v1/logout', {method: 'POST', bearer: A.token});
  check(out.status === 204 || out.status === 200, 'sign_out_accepted', 'http ' + out.status);
  const afterOut = await call('/rest/v1/app_state?select=*', {bearer: A.token});
  check(!(afterOut.status === 200 && Array.isArray(afterOut.data) && afterOut.data.length > 0),
    'revoked_session_cannot_read_owner_rows', 'http ' + afterOut.status + ' n=' + (afterOut.data?.length));
} finally {
  /* ── cleanup runs whatever happened above ── */
  for (const u of users) {
    if (!u.id) continue;
    const del = await admin(`/auth/v1/admin/users/${u.id}`, {method: 'DELETE'});
    console.log(`${del.status === 200 || del.status === 204 ? 'PASS' : 'WARN'} disposable_user_deleted_${u.tag} http ${del.status}`);
    const gone = await admin(`/auth/v1/admin/users/${u.id}`);
    console.log(`${gone.status === 404 ? 'PASS' : 'WARN'} disposable_user_absent_after_delete_${u.tag} http ${gone.status}`);
  }
}
console.log('MATCHMIND_STAGING_AUTHENTICATED_ACCEPTANCE_PASS ' + passed);
