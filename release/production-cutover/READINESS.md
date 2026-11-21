# Production cutover readiness: bounded-display client + PROPOSAL-up.sql

Checked 2026-11-21, read-only. Worktree at cf998a2 (development head). Production project
`toqfdrcjzwnlydqekude`: catalog and public-data SELECTs only. Nothing in production was changed.
`origin/main` = `origin/backup/build355-20261023` = `036f09b` (Build 355). Neither has moved.

## Verdict: NO-GO

The migration would install cleanly. The release would still fail. Two independent defects mean
that after cutover **no edition can ever be created**, so every visitor gets "Matches temporarily
unavailable", and the publisher robot fails on every run.

### Blockers (each verified)

**B1. `materialize()` cannot succeed on production data, from any caller.**
`materialize()` must put every row of `public.predictions` into `cards`. It refuses if one is
missing ("Unaccounted immutable prediction inventory"). It also does not truncate.
`payload_valid()` caps `cards` at 1000 (`"max":1000`) and the payload at 524288 bytes. The client
caps it at 1500 cards and 2 MiB. Production counts on 2026-11-21:
- `predictions`: **2963** rows (kickoffs 2026-07-16 to 2026-11-23), all with a matching fixture.
- Fixtures dated today-6 to today+7: 988, of which 757 have no prediction.
- So `cards` would hold at least 2963 + 757 = **3720** rows. That is 3.7 times the SQL bound, and
  the byte cap is far smaller still. `payload_valid` returns false, and `materialize` raises
  "Incomplete or unsupported presentation inventory".
- On top of that, **30 `predictions` rows have `lname` NULL**. The prediction schema has
  `lname` with `nullable:false`, so the payload is rejected even if the size problem is fixed.
- The prediction table only grows, so a fixed bound fails permanently.
BACKEND-VERIFICATION.md had already listed "Limits are 1000 cards and 512 KiB … actual inventory
… must pass" as an open acceptance gate. It does not pass.

**B2. The development client never publishes, so the robot fails and calls nothing.**
Commit a9d8aa1 changed `isPublisher()` in `index.html` (line 4673) to `return false`
unconditionally. The robot workflow (`.github/workflows/publish-picks.yml` on main, running
`robot/publish.mjs`) drives the LIVE Pages app. After cutover that is this client, so:
- origin/main `robot/publish.mjs` throws `signed in, but not as the publisher account` at boot.
  The development `robot/publish.mjs` keeps the same check, so it fails the same way.
- `sharedRecordsPublish`, `sharedClvPublish` and `boardPublish` all return early on
  `!isPublisher()`. `boardPublish` is the only client caller of `matchmind_publish_display_v1`
  (index.html:21411), so the robot never materializes.
- The result: no new board, engine or CLV records, no shared slips, no `competition_measures`
  bars, and no edition.

**B3. Nothing else materializes, and editions expire after 24h (confirmed).**
`display()` admits only `as_of<=now<expires_at`. `materialize()` sets `expires_at = as_of + 24h`.
The only pg_cron jobs are `push-kickoff`, `push-digest` and `push-result` (send-push), plus
`refresh-af-10min` (refresh-af). None of them calls materialize. Deployed refresh-af **v54** has no
`matchmind_publish_display_v1` call. The patch adds one, and it would also fail because of B1.

**B4. The robot on main still reads anonymously.**
`restCount` (HEAD on `predictions`, `daily_slips`, `competition_measures` with the publishable
key) loses `predictions` and `daily_slips` after the migration. It is non-fatal (it returns null).
The fix is the development `robot/publish.mjs` (48 lines differ), which is not on main and is not
approved. Minor next to B2.

## Q1. Does PROPOSAL-up.sql apply cleanly to current production? Yes; every precondition passes

| Precondition / object | Production now | Result |
|---|---|---|
| schema `mm_fixture_delivery`, roles `mm_display_*` must not exist | absent | pass |
| installer can take SET+INHERIT on new roles | `postgres`: not superuser, CREATEROLE, INHERIT; PG 17.6 | pass (the same shape staging installed on) |
| anon/authenticated not superuser/bypassrls | both false | pass |
| 10 base tables exist with relkind r: fixtures, predictions, daily_slips, shared_records, odds_snapshots, injuries, match_context, predictions_retired, match_analysis, venues | all present, RLS on | pass |
| views fixtures_lean, competitions, odds_latest | present, `security_invoker=true`; deps fixtures/fixtures/odds_snapshots | pass |
| service_role exists, with direct SELECT on each of the 10 base tables | `service_role=arwdDxtm/postgres` on all 10 | pass |
| no dependent view outside public, no matview | none | pass |
| no anon/authenticated-executable SECURITY DEFINER public function touching provider tables | only `handle_new_user` and `rls_auto_enable`; neither is executable by anon/authenticated or matches | pass |
| no inherited anonymous SELECT left after revoke | anon grants are explicit only; column ACLs exist only on predictions final_*/withheld_at, `authenticated=w` (UPDATE) | pass |
| policy names `materializer_read`, `mm_source_raw_*` free | not present | pass |
| `gen_random_uuid` | core in PG17 | pass |
| event trigger `ensure_rls` (`rls_auto_enable`) | acts on schema `public` only; it only logs for the new schema | harmless |
| realtime publication | `supabase_realtime`, no tables | no alternate path |

Objects added since the file was written are not refusal causes:
- `venues`, `injuries` and `match_context` are already in its lists.
- `ai_shadow`, `push_sent`, `push_subscriptions`, `competition_measures`, `app_state`, `mm_roles`,
  `profiles` and `ai_usage` are not touched. They keep their current grants and RLS.
- `competition_measures` stays readable as before.

Changed behaviour on install:
- SELECT is revoked from anon/PUBLIC on the 13 roots.
- Authenticated callers are fenced by restrictive and permissive `raw_allowed()` policies.
- The existing permissive SELECT policies (`public read fixtures`, `read predictions`, and so on)
  stay, but the restrictive fence ANDs over them.
- Write policies keyed on the robot email remain. Their `EXISTS (select … from fixtures)`
  subquery and any upsert/UPDATE now also need SELECT. They work only for an enrolled principal.

## Q2. What each actor loses after install

- **Anonymous visitors on Build 355:** every direct `supa.from()` read of the 13 objects is
  refused (permission denied), so the app is empty. `competition_measures` still reads.
- **Signed-in users:** 4 profiles exist, and the principals table starts empty.
  - On 355, reads return 200 with `[]` under RLS, so the app is empty.
  - On the new client, `raw_allowed=false`, so it uses the display RPC, which is empty under B1.
- **Publisher robot:**
  - If its account is not enrolled, the same as signed-in users. Its app-side writes through
    upsert need SELECT and fail.
  - Even when enrolled, B2 stops it on the new client.
- **refresh-af v54:** uses `SUPABASE_SERVICE_ROLE_KEY`, and service_role keeps its direct grants
  and has bypassrls. Ingestion is **unaffected**.
  - Deployed source sha256 is `3541673d…893e` (3125 lines). The ezbr hash is `53d5588d…03b8`,
    with verify_jwt=true.
  - `refresh-af-v54-presentation.patch` applies cleanly in a `patch --dry-run` against the
    deployed source. It would only add a materialize call, which fails today under B1.
- **send-push v9 (FN_VERSION 98):** service-role client. Unaffected.
- **ai-analyze v17:** service-role `admin` client. Unaffected; it keeps serving cached
  `match_analysis`/`match_context` for any fxid to any signed-in caller.
  - ezbr hash `dc6dde9e…f0e3d`.
  - The patch's context lines match the deployed text. A full dry-run was not run.
- **ai-shadow v2 and delete-account v2:** source not reviewed. Unverified.

The repository pins no exact-source hash for v54 or v17, so the "exact-source hash" check could
only record the observed hashes above.

## Q3. How an edition gets materialized after cutover

The only paths are:
- `matchmind_publish_display_v1()`, called by an enrolled `publisher` principal (from
  `boardPublish` in the client); or
- the service role (`current_setting('role')='service_role'`, which is the patched refresh-af).

Today neither works (B1, B2). Without the refresh-af patch nothing materializes on a timer, and an
edition lives 24h. The robot gaps are 6h, 12h and 6h, so the robot alone would be enough *if* it
published. Each refresh-af materialization inserts one edition of up to 512 KiB with no pruning:
up to 144 a day, about 74 MB a day. Add retention before enabling the patch.

The order that keeps users from seeing an empty app, once the blockers are fixed, is in the
runbook below. Build 355 tabs still open at cutover lose all reads at the moment of the SQL
commit. The number of anonymous devices is not measurable from the database; there are 0 push
subscriptions and 4 profiles. `sw.js` on main is network-first, and `sw.js` itself is never
cached, so:
- any online navigation or reload fetches the new `index.html`;
- an open 355 tab's `mmVersionWatch` sees `matchmind-v358` > 355 and shows the reload banner on
  boot or foreground;
- offline devices keep 355 from cache until they reconnect.

## Q4. Does the development index.html work against production once migrated?

- **Configuration:** `SUPA_URL` is `https://toqfdrcjzwnlydqekude.supabase.co` and `SUPA_KEY` is
  the production publishable key (index.html:1127-1128). `APP_BUILD` is 358, matching
  `sw.js matchmind-v358`. Staging values are injected only by `staging/build-real-preview.mjs`.
  Correct for production as-is.
- **Publisher mode:** disabled (B2). **Fails.**
- **v3 `competitions`:** the production materializer emits no `competitions` key. The client
  accepts that, and its panels fall back to "Goals probabilities unavailable…" and "League table
  unavailable…". This is degradation by code reading; it was not executed against production.
- **Tips previous issue and records:** they come through the `slips` and `records` screens and
  are filtered locally. They work only if an edition exists, which B1 rules out.
- **Every screen:** returns `MM_DISPLAY_UNAVAILABLE`, because no edition exists.

## Ordered cutover runbook (valid only after B1 and B2 are fixed and re-reviewed)

1. **Freeze:** check that `git rev-parse origin/main` is `036f09b`. Pause the publish-picks
   workflow (disable it in Actions) so no run straddles the switch.
2. **Pre-check, read-only:** re-run the Q1 catalog queries. Then run a dry inventory query
   showing that predictions plus window cards fit the revised bounds and have no null required
   fields (today it fails: 3720 cards, 30 null `lname`).
3. **SQL (owner, as `postgres`):** apply `PROPOSAL-up.sql` (fixed version). Expect COMMIT with
   no WARNING. Then verify:
   - `select has_table_privilege('anon','public.fixtures','SELECT')` is false;
   - the `mm_fixture_delivery` functions have no PUBLIC EXECUTE.
4. **Immediately, in the same window:** enrol the publisher.
   `insert into mm_fixture_delivery.principals(user_id,scope,enabled,approved_until,approval_ref) values('<robot auth.users id>','publisher',true,'<date>','<Director ref>')`.
   The Director/owner looks up the id; it is not recorded here.
5. **First edition:** call `select public.matchmind_publish_display_v1()` as service_role. Expect
   `{version:'matchmind-display/1',cards:N,predictions:M}`, and
   `select public.matchmind_display_v1('scores')` (as anon via REST) returns cards.
   - Steps 3 to 5 take about 2 minutes. Anonymous 355 clients are empty during that window.
6. **Client:** push `index.html`, then `sw.js` (`matchmind-v358`), to main (Director). Wait until
   `curl -s https://kennedychinazam.github.io/matchmind/sw.js | grep matchmind-v358` passes and
   the page hash matches. Pages normally takes a few minutes.
7. **Edge (owner approval):**
   - Re-fetch refresh-af and check `version==54` and source sha256 `3541673d…893e`. Apply the
     patch plus `refresh-presentation.mjs` and deploy with verify_jwt unchanged (true).
   - Within 10 minutes the next cron response shows `displayRefresh.status=refreshed`.
   - ai-analyze: check v17 and hash, then apply the cache-guard patch (needs `SUPABASE_ANON_KEY`).
8. **Robot:** re-enable it, then run `workflow_dispatch`. Expect exit 0 and `shared board ok`.
9. **Verify** as guest and as an ordinary signed-in account: Scores, Tips, Records render, and
   raw REST returns 401 / `[]`.

Owner/Director actions: approve the SQL; enrol the publisher identity; approve both Edge deploys;
push main; manage the workflow pause.

## Rollback

`PROPOSAL-revert.sql` does the following:
- restores the snapshotted table/column SELECT grants for PUBLIC/anon/authenticated on every
  saved relation;
- drops `mm_source_raw_fence`, `mm_source_raw_read` and `materializer_read`;
- restores RLS flags and view `security_invoker` options;
- revokes EXECUTE on the three `matchmind_*` wrappers and the private functions.

It keeps the schema, roles, principals, editions and snapshots, and deletes no data. It restores
the old broad exposure (a Director decision).

Order:
1. Re-enable 355 compatibility on the client first, by publishing 355's `index.html` with a
   **higher** cache number (`matchmind-v359`, `APP_BUILD` raised to match), as in
   `release/production-compat/RUNBOOK.md` on branch ccr-5da6e9b3-3ms4v5.
2. Then run the SQL revert immediately.
3. Revert any Edge patch: the refresh-af materialize call would only return
   `displayRefresh: unavailable`, which is harmless.

The reason for client first: the bounded client is empty, and the robot fails, as soon as the
wrappers are revoked. 355 is empty only for the minutes between the Pages update and the revert.
A robot run must not fall in that gap, so pause the workflow.

## Re-check after fixes, 2026-11-21 (read-only against production)

Fixes: e67205f (SQL: bounded window edition, paged history, neutral league label, loud size
refusal, retention, publisher RPC, 90-leg tips and rescheduled board rows admitted), 0cd0a7e
(client: server-decided `isPublisher()`, paged history read). `robot/publish.mjs` on this branch
already counts through the signed-in page (B4).

Production inventory, built with the new projection inside a `READ ONLY` transaction and checked
node by node against the patched `payload_valid` schema plus its semantic rules (dup ids,
probability vectors, board identity, tips shape, leg-to-card references, record keys):
995 cards (bound 1500), 660,221 bytes (bound 2,097,152), 238 window predictions, 17 slips,
39,611 schema nodes, **0 violations**. All 2963 predictions have a dated fixture; 2732 are served by
`matchmind_history_v1` (11 pages of 250). The 30 NULL `lname` rows all resolve from their fixture.
Found during the re-check and fixed in e67205f: production issues 90-leg `tips` slips, which the
old 40-leg schema refused, so the original materializer could not have written an edition even
under its size bound.

Verdict for executing the release from this session: **NO-GO, stopped before production.**
- Pages publish and the workflow pause need writes to `main` and to Actions settings. This session
  may push only to `ccr-5da6e9b3-3ms4v5`, and its GitHub CLI token is invalid.
- The 320px/390px browser checks only run in Chromium here (no Firefox/WebKit). Most of them fail
  identically at the baseline, so they are not a clean signal.
- The deployed refresh-af/ai-analyze hashes were not re-fetched, because no deploy was reached.
