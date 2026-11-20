# Production release runbook: development client on the current production backend

PREPARED, NOT RUN. Requires Director approval of the trade-off below before any step.

## Why a variant (verified 2026-11-20)

Build 355 (`origin/main` 036f09b, `index.html`) reads source data directly with `supa.from(...)`:
`fixtures` (e.g. lines 6932, 7047, 10302, 12821, 18559), `fixtures_lean` (18147, 18560),
`competitions` (18180), `predictions` (10583, 16118, 21424), `daily_slips` (6854, 7084),
`odds_latest` (6432, 6517), `odds_snapshots` (10529), `shared_records` (19658, 20082),
`predictions_retired` (10244), `competition_measures` (3824); the publisher session writes
`predictions`, `daily_slips`, `shared_records`, `competition_measures`.

Production catalogs: RLS SELECT `true` for role public on `fixtures`, `predictions`,
`daily_slips`, `odds_snapshots`; for anon,authenticated on `shared_records`,
`predictions_retired`. `competitions`, `fixtures_lean`, `odds_latest` are
`security_invoker` views. Writes to `predictions`, `daily_slips`, `shared_records`, `ai_shadow`
are gated by policies on the publisher robot's JWT email. anon/authenticated hold table grants
(SELECT everywhere; `predictions` anon SELECT only); RLS is the boundary. No `matchmind_*` or
`mm_preview_*` function exists in production.

The development client calls `matchmind_fixture_access_v1` and `matchmind_display_v1`; without
them public visitors get no data. `backend/fixture-delivery/PROPOSAL-up.sql` would add them and
revoke the direct anonymous reads 355 relies on, so it cannot be installed while 355 is live.

## The variant

`node release/production-compat/build.mjs <out>` rewrites only `fixtureAccess`,
`fixtureRawCurrent` and the head of `fixtureDisplayLoad` so the client takes its existing
source-read path (the owner path) for everyone, against production RLS, without any RPC. The
repository `index.html`, staging transforms and database are unchanged. It refuses a
non-production `SUPA_URL` or a staging/preview artifact. Tests: `test/production-compat.test.mjs`.

**Trade-off, stated exactly:** the variant serves provider-origin fixture rows (scores, team and
competition names, kick-offs, odds captures) to anonymous visitors. That is what live 355 does
today, so production exposure does not grow, but it is precisely the exposure
`PROVIDER-DATA-EXPOSURE.md` says blocks external invitation and public release. Run against the
variant, `test/fixture-delivery-consumers.test.mjs` fails 5 of 11 public-boundary tests (1, 2, 3,
5, 6) by design. The variant is an owner-testing / like-for-like replacement for 355, not a fix
for the rights gate. When `PROPOSAL-up.sql` is approved, ship the unmodified bounded client in the
same change window instead (the variant breaks once direct reads are revoked).

Not verified here: production `ai-analyze` compatibility with the development request shape;
GitHub Pages source settings (the Pages API is not reachable through this session's proxy;
`origin/main` has no deploy workflow, only `.github/workflows/publish-picks.yml`, consistent with
branch deployment of `main` root, which the Director should confirm in Settings > Pages).

## Steps

1. Checkpoint: confirm `git rev-parse origin/main` = `036f09b29f27a10c7d8bdcec1f16efd557c714e4` and
   `origin/backup/build355-20261023` = the same commit. Stop if either moved.
2. Build from the exact approved development commit:
   `node release/production-compat/build.mjs /tmp/mm-prod` and record the printed sha256 values.
3. Tests at that commit (Node 20 and 24, `MM_TEST_CHROMIUM` set): full `node --test test/*.test.mjs`,
   plus `test/production-compat.test.mjs`.
4. Files to publish on `main` root, nothing else: `index.html` (variant), `sw.js`,
   `manifest.webmanifest`, `icon-192.png`, `icon-512.png`. Keep `.github/` and `robot/` as on main
   unless the robot change (`robot/publish.mjs`, 48 lines differ) is separately approved.
5. Cache bump convention (origin/main history: "Build 355 (WO-61): sw.js cache matchmind-v355"):
   `sw.js` `const CACHE = 'matchmind-v<APP_BUILD>'`. The candidate has `APP_BUILD = 358` and
   `matchmind-v358`; 355 clients' `mmVersionWatch` sees 358 > 355 and shows the update banner.
   If the variant gets its own build number, change both together. Commit index.html first, then
   `sw.js` as its own commit, matching the history.
6. Push to `main` (Director). Wait for Pages to serve the new bytes:
   `curl -s https://kennedychinazam.github.io/matchmind/sw.js | grep matchmind-v358` and
   `curl -s https://kennedychinazam.github.io/matchmind/ | sha256sum` equals step 2.
7. Verify as a guest in a fresh browser: Scores lists today's fixtures; Network shows
   `/rest/v1/fixtures` 200 and no `/rest/v1/rpc/matchmind_*` call; an installed 355 PWA shows the
   update banner and reloads to 358. Next `publish-picks` run (23:17/05:17/17:17 UTC) succeeds and
   writes today's `daily_slips`.
8. Rollback: `git revert` the release commits on a new branch (or reset `main` to
   `backup/build355-20261023` with Director approval), then publish an `sw.js` whose cache number is
   **higher** than the one shipped (e.g. `matchmind-v359` carrying 355's index.html with its
   `APP_BUILD` raised to match), because clients only move to a higher number. No database change
   is involved in either direction.
