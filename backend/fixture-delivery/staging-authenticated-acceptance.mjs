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
 * Then corrected again after an INDEPENDENT SECURITY REVIEW of those corrections, which found
 * that three of the four still carried a vacuous assertion of the very class DR2 existed to
 * remove. Those are marked F1..F8 at the place each applies. In short: a 4xx after sign-out is
 * only evidence of revocation if the refresh token demonstrably worked before it (F1); the one
 * remaining bare-4xx denial is now explicit and its row is cleaned up (F2); the token's life is
 * bounded against the wall clock, not against its own iat (F4); a user is recorded before the
 * checks that can reject it (F5); the role-header check compares against the unforged request
 * instead of restating what was already proven (F7); and the mask is emitted only where the
 * runner consumes it (F8).
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
/* The owner id the cross-owner INSERT probe forges. Module scope, because cleanup has to be able
   to remove a row at this id even though it belongs to no user this run created. */
const FOREIGN_UUID = '00000000-0000-4000-8000-000000000000';

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

/* F8 (independent review, 8 November 2026): `::add-mask::` is a workflow command only the
   Actions runner consumes. Run this file anywhere else and that line IS the key, in clear text,
   on stdout. So it is emitted only where it means something. */
const IN_ACTIONS = process.env.GITHUB_ACTIONS === 'true';
const mask = v => { if (IN_ACTIONS) console.log(`::add-mask::${v}`); };
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
  /* ── FIXTURE-FRESHNESS PREFLIGHT, BEFORE ANY USER EXISTS ──
     Director review of 8 November 2026, after attempt 2 of run 42456545800. That attempt created
     two real users, proved both sign-ins, A/B isolation, every raw-feed denial, the publisher gate
     and full cleanup, and then failed at `authenticated_still_reads_bounded_display` with an
     HTTP 500 carrying Postgres P0002 `Current presentation unavailable`. The cause was not a
     product defect: the only synthetic display edition on staging was the previous day's and had
     already expired, and the public display function is CORRECT to fail closed without a same-day
     unexpired edition. An expired test fixture is not evidence of a product bug, but the run
     reported it as a generic mid-test 500 after doing all of that work.
     So the edition's own expiry is checked FIRST, with the admin key, before a single disposable
     user is created, and a stale fixture is named as a stale fixture. Nothing here publishes,
     refreshes or extends an edition: the harness reports and stops. Republishing a staging
     edition is an authorized operator action, deliberately not automated here. */
  const edition = await admin('/rest/v1/rpc/matchmind_display_v1',
    {method: 'POST', body: {screen: 'history'}});
  if (edition.status !== 200) {
    const body = JSON.stringify(edition.data || null);
    const stale = /presentation unavailable|P0002/i.test(body);
    throw Error(stale
      ? `FIXTURE NOT FRESH: staging has no current unexpired synthetic display edition, so the ` +
        `public display function fails closed as designed. This is a TEST FIXTURE problem, not a ` +
        `product defect. Publish a same-day synthetic edition on staging and run this again. ` +
        explain(edition)
      : `FAILED display_preflight_readable ${explain(edition)}`);
  }
  const until = Date.parse(edition.data?.expires_at || '');
  const left = Number.isFinite(until) ? Math.round((until - Date.now()) / 1000) : NaN;
  note('display_edition_id', String(edition.data?.edition_id));
  note('display_edition_expires_at', String(edition.data?.expires_at));
  note('display_edition_seconds_remaining', String(left));
  check(Number.isFinite(left) && left > 0,
    'display_edition_is_published_and_unexpired_BEFORE_users_are_created',
    `expires_at=${edition.data?.expires_at} seconds_remaining=${left}`);
  /* A run of this job takes well under a minute, but an edition expiring mid-run would reproduce
     exactly the attempt-2 failure, so a thin margin is called out as a fixture problem up front. */
  check(left > 300, 'display_edition_has_margin_to_outlive_this_run',
    `only ${left}s remain; publish a fresh staging edition rather than racing its expiry`);

  /* ── real users, through the official Admin API, never by touching auth tables ──
     DR3: each id is validated before the next user is created, so a silent creation failure
     cannot leave the run proceeding with an undefined id. */
  for (const tag of ['a', 'b']) {
    const email = `mm-staging-${tag}-${randomBytes(6).toString('hex')}@example.com`;
    const password = pw();
    /* F5: the record is pushed BEFORE the checks that can reject it. A user that was created but
       answered for in a shape this code does not recognise, or whose POST committed and then
       timed out, is still cleaned up and still named in the output. The old order captured the
       only handle on the user after the validation, so such a user survived the run unnamed. */
    const u = {tag, email, password, id: null, token: null, refresh: null};
    users.push(u);
    const made = await admin('/auth/v1/admin/users', {method: 'POST',
      body: {email, password, email_confirm: true,
        user_metadata: {disposable: true, purpose: 'release-acceptance'}}});
    u.id = typeof made.data?.id === 'string' ? made.data.id
      : typeof made.data?.user?.id === 'string' ? made.data.user.id : null;
    check(made.status === 200 || made.status === 201, `admin_created_user_${tag}`, explain(made));
    check(typeof u.id === 'string' && UUID_RE.test(u.id),
      `created_user_${tag}_has_a_real_uuid`, String(u.id));
  }
  check(users.length === 2 && users[0].id !== users[1].id, 'two_distinct_users_exist');

  /* ── genuine password sign-in, with the PUBLISHABLE key, exactly as the app does ── */
  for (const u of users) {
    const s = await call('/auth/v1/token?grant_type=password', {method: 'POST',
      body: {email: u.email, password: u.password}});
    /* F1: the refresh token is asserted here. Without it `A.refresh` would be undefined, the
       post-sign-out exchange would send `{}`, and GoTrue's "refresh_token required" 400 would
       have satisfied a revocation test that proved nothing. */
    check(s.status === 200 && typeof s.data?.access_token === 'string'
      && typeof s.data?.refresh_token === 'string',
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
  /* F2: this was the last denial written as a bare 4xx range, so it could not tell "RLS refused
     the row" from "the request was malformed and RLS never ran". Three things are now required:
     an explicit authorization refusal, a refusal that names row-level security, and the absence
     of any row at the forged owner id - because a write that succeeded while answering 400 would
     otherwise pass, and its row has no owner in `users` to clean it up. */
  const foreignInsert = await call('/rest/v1/app_state', {method: 'POST', bearer: A.token,
    body: {user_id: FOREIGN_UUID, fav_teams: ['forged']}});
  check(isExplicitlyUnauthorized(foreignInsert),
    'owner_A_cannot_insert_for_another_owner', explain(foreignInsert));
  check(/row-level security/i.test(JSON.stringify(foreignInsert.data)),
    'foreign_insert_refused_BY_RLS_not_by_an_unrelated_fault', explain(foreignInsert));
  const forgedLeft = await admin(`/rest/v1/app_state?select=user_id&user_id=eq.${FOREIGN_UUID}`);
  check(Array.isArray(forgedLeft.data) && forgedLeft.data.length === 0,
    'no_row_exists_at_the_forged_owner_id', explain(forgedLeft));

  const stillB = await call('/rest/v1/app_state?select=fav_teams', {bearer: B.token});
  check(isGenuineRead(stillB) && JSON.stringify(stillB.data) === JSON.stringify([{fav_teams: ['acceptance-B']}]),
    'owner_B_row_unchanged_after_A_attempts', explain(stillB));

  /* ── an authenticated ordinary user is still an ordinary user ──
     N3: the denial contract below now rejects a 404, which is right. But a relation that is not
     exposed through PostgREST at all would fail it for a reason that has nothing to do with
     authorization, and the failure would read like an Auth finding. So establish first, with the
     admin key, that each relation exists and is reachable. */
  const RAW_FEEDS = ['fixtures', 'predictions', 'shared_records', 'daily_slips',
                     'fixtures_lean', 'provider_alias', 'odds_latest'];
  for (const table of RAW_FEEDS) {
    const probe = await admin(`/rest/v1/${table}?select=*&limit=1`);
    check(['rows', 'empty'].includes(classify(probe)),
      'relation_is_exposed_through_postgrest_' + table, explain(probe));
  }
  for (const table of RAW_FEEDS) {
    const r = await call(`/rest/v1/${table}?select=*`, {bearer: A.token});
    check(isGenuineDenial(r), 'authenticated_no_raw_feed_' + table, explain(r));
  }
  const cap = await call('/rest/v1/rpc/matchmind_fixture_access_v1', {method: 'POST', body: {}, bearer: A.token});
  check(cap.status === 200 && cap.data?.raw_allowed === false, 'authenticated_raw_capability_false', explain(cap));

  /* PROPOSAL-up.sql deliberately grants EXECUTE on the publish entry point to `authenticated`,
     so the refusal is the runtime gate's, not an ACL's. Both halves are asserted. */
  const pubAcl = await call('/rest/v1/rpc/matchmind_publish_display_v1', {method: 'POST', body: {}, bearer: A.token});
  check(pubAcl.status >= 400 && pubAcl.status < 500, 'authenticated_publish_refused', explain(pubAcl));
  /* The gate's own message, not merely a string containing "publisher". A permission error would
     name publisher_allowed and would have satisfied the looser pattern, which is exactly the
     "do not label unrelated errors as success" trap. The Director's staging run recorded the gate
     answering `Scoped publisher required`. */
  check(/scoped publisher required/i.test(JSON.stringify(pubAcl.data)),
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
     pass, so the genuine-denial contract is required rather than "not rows".
     F7: the second check used to assert the answer was neither a server error nor malformed,
     which `isGenuineDenial` had already established one line above - a proven tautology, in the
     commit whose whole purpose was removing those. It now compares the forged request with the
     identical UNFORGED one, which is falsifiable: if the headers changed the answer at all, the
     two classifications differ and this fails. */
  const headerRole = await call('/rest/v1/fixtures?select=*', {bearer: A.token,
    headers: {role: 'service_role', 'x-postgrest-role': 'service_role'}});
  check(isGenuineDenial(headerRole), 'forged_role_header_yields_no_privileged_rows', explain(headerRole));
  const unforged = await call('/rest/v1/fixtures?select=*', {bearer: A.token});
  check(classify(headerRole) === classify(unforged),
    'forged_role_header_changed_nothing_about_the_answer',
    `forged: ${explain(headerRole)} / plain: ${explain(unforged)}`);

  /* ── DR1: sign-out, tested against what Supabase actually does ──
     Supabase revokes the REFRESH token on sign-out. An access token already minted stays valid
     until its own exp; that is documented platform behaviour, not an app defect, and the previous
     version of this harness asserted the opposite. So: prove the refresh path is dead, and record
     the access token's remaining life as a bounded, finite window. */
  /* F1: a 4xx after sign-out proves nothing on its own. It is also what GoTrue answers when the
     refresh token was never valid, when the field was absent, and when the endpoint is rate
     limiting. This positive control exchanges the refresh token ONCE while the session is still
     live, so the refusal afterwards can only mean revocation, and keeps the rotated pair the
     server hands back - GoTrue rotates on every exchange, so the old one is spent either way. */
  const preRenew = await call('/auth/v1/token?grant_type=refresh_token', {method: 'POST',
    body: {refresh_token: A.refresh}});
  check(preRenew.status === 200 && typeof preRenew.data?.access_token === 'string'
    && typeof preRenew.data?.refresh_token === 'string',
    'refresh_token_WORKS_before_sign_out', explain(preRenew));
  A.token = preRenew.data.access_token;
  A.refresh = preRenew.data.refresh_token;

  /* F4: bound the token against the WALL CLOCK. `exp - iat` only tests two claims against each
     other, and a token whose iat and exp both sit years in the future is self-consistent: the old
     check passed a ten-year token while its own name claimed 24 hours. */
  const nowSec = () => Math.floor(Date.now() / 1000);
  const cA = claims(A.token);
  note('access_token_exp_minus_iat_seconds', String(cA.exp - cA.iat));
  const remaining = cA.exp - nowSec();
  check(Number.isFinite(remaining) && remaining > 0 && remaining <= 24 * 3600,
    'access_token_remaining_life_within_24h', String(remaining));
  check(Number.isFinite(cA.iat) && Math.abs(cA.iat - nowSec()) <= 600,
    'access_token_was_issued_now_not_at_some_distant_time', String(cA.iat));

  const out = await call('/auth/v1/logout', {method: 'POST', bearer: A.token});
  check(out.status === 204 || out.status === 200, 'sign_out_accepted', explain(out));

  const renew = await call('/auth/v1/token?grant_type=refresh_token', {method: 'POST',
    body: {refresh_token: A.refresh}});
  /* Exactly 400, not any 4xx: a 429 is the endpoint declining to answer, not a revocation. */
  check(renew.status === 400,
    'refresh_after_sign_out_refused_400_not_rate_limited', explain(renew));
  check(/invalid[_ ]grant|refresh.?token/i.test(JSON.stringify(renew.data)),
    'refresh_refusal_names_the_token_not_an_unrelated_fault', explain(renew));
  check(typeof renew.data?.access_token !== 'string',
    'sign_out_yields_no_new_access_token', explain(renew));

  note('access_token_still_valid_for_seconds_after_signout_by_design', String(cA.exp - nowSec()));
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
const removeRows = async (filter, label) => {
  const del = await admin(`/rest/v1/app_state?${filter}`, {method: 'DELETE'});
  const left = await admin(`/rest/v1/app_state?select=user_id&${filter}`);
  const gone = Array.isArray(left.data) && left.data.length === 0;
  console.log(`${gone ? 'PASS' : 'LEFTOVER'} app_state_rows_removed_${label} ` +
    `admin=${del.status} ${explain(left)}`);
  if (!gone) cleanupProblems.push(`app_state rows for ${label} survived (${explain(left)})`);
};

for (const u of users) {
  /* The row phase and the user phase get their own try: a socket dying in one must not skip the
     other, which is how a single throw used to leak both. */
  try {
    if (u.token && u.id) {
      const byOwner = await call(`/rest/v1/app_state?user_id=eq.${u.id}`,
        {method: 'DELETE', bearer: u.token});
      note(`app_state_owner_delete_${u.tag}`, String(byOwner.status));
    }
  } catch (e) {
    cleanupProblems.push(`owner row delete threw for ${u.tag} (${u.id}, ${u.email}): ${e?.message}`);
  }
  try {
    if (u.id) await removeRows(`user_id=eq.${u.id}`, u.tag);
  } catch (e) {
    cleanupProblems.push(`admin row delete threw for ${u.tag} (${u.id}, ${u.email}): ` +
      `${e?.message} - an app_state row may remain at that owner id`);
  }
  try {
    /* F5: a user created under a response shape this code did not recognise has no id here.
       Find it by its disposable address rather than leaving it in the project unnamed. */
    let id = u.id;
    if (!id) {
      const found = await admin(`/auth/v1/admin/users?filter=${encodeURIComponent(u.email)}`);
      const list = Array.isArray(found.data?.users) ? found.data.users : [];
      id = list.find(x => x?.email === u.email)?.id || null;
      if (id) {
        cleanupProblems.push(
          `user ${u.tag} existed despite an unrecognised create response; recovered by email as ${id}`);
        await removeRows(`user_id=eq.${id}`, `${u.tag}_recovered`);
      }
    }
    if (!id) { console.log(`NOTE no_disposable_user_to_remove_${u.tag} ${u.email}`); continue; }
    const del = await admin(`/auth/v1/admin/users/${id}`, {method: 'DELETE'});
    const gone = await admin(`/auth/v1/admin/users/${id}`);
    const removed = (del.status === 200 || del.status === 204) && gone.status === 404;
    console.log(`${removed ? 'PASS' : 'LEFTOVER'} disposable_user_removed_${u.tag} ` +
      `delete=${del.status} lookup=${gone.status}`);
    if (!removed) cleanupProblems.push(`auth user ${u.tag} (${id}, ${u.email}) survived`);
  } catch (e) {
    cleanupProblems.push(`user delete threw for ${u.tag} (${u.email}): ${e?.message}`);
  }
}
/* F2: the forged-owner probe row belongs to no user in `users`, so nothing above would find it.
   A run that never reached the probe deletes an empty set, which is harmless. */
try { await removeRows(`user_id=eq.${FOREIGN_UUID}`, 'forged_owner_probe'); }
catch (e) {
  cleanupProblems.push(`forged-owner probe row cleanup threw: ${e?.message} - ` +
    `a row may remain at user_id ${FOREIGN_UUID}`);
}
for (const p of cleanupProblems) console.log(`::warning::${p}`);

/* The original failure wins. Incomplete cleanup is its own failure when nothing else went wrong. */
if (primary) {
  console.error(primary?.stack || String(primary));
  if (cleanupProblems.length) console.error('cleanup also incomplete: ' + cleanupProblems.join('; '));
  process.exit(1);
}
if (cleanupProblems.length) {
  console.error('CLEANUP INCOMPLETE: ' + cleanupProblems.join('; '));
  process.exit(1);
}
console.log('MATCHMIND_STAGING_AUTHENTICATED_ACCEPTANCE_PASS ' + passed);
