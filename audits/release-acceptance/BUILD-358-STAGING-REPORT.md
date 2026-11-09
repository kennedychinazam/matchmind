# Build 358 staging acceptance: installation and preview

9 November 2026. Staging project `rdcbnvfnxenrpnnwxszs` only. Production `toqfdrcjzwnlydqekude` was
never queried or changed. No provider call, no paid request, no Edge Function call, no new secret, no
service key, no deployment, no merge. PR 26 stays draft.

Branch `claude/build-358-staging-20261109`, cut from the immutable candidate
`0a725edd01a2dae8e1ecb49498f17b9f43b861ba`. The candidate files are not edited by anything here.

## 1. Preflight, read only

All 12 functions installed on staging match, by md5 of `prosrc`, the functions produced by the
unmodified `PROPOSAL-up.sql` at `ecf001f` (git blob `2e850a5206e0f178ffbb1847fc7c182288283eaa`).

| Function | Owner | md5 of installed body |
|---|---|---|
| `mm_fixture_delivery.display(text)` | `mm_display_reader` | `f5bc8baa47c0db53d9e2605dab06a5c9` |
| `mm_fixture_delivery.materialize()` | `mm_display_materializer` | `8e8eef4cf65458e7da5f5b23b923d79a` |
| 10 others, pinned in the patch | unchanged | listed in `STAGING-358-incremental-up.sql` |

| Fingerprint before | Value |
|---|---|
| Function owner, security, volatility, config and ACL of the 12 functions | `ab5c5e974e326b22790eb32c7b0f20c1` |
| Fixtures, predictions, editions, principals (row text) | `13bc4b19fb8834b366e5c9f47574daa8` |
| Counts | 148 fixtures, 145 predictions, 2 editions (both expired), 1 principal (disabled) |
| Installer role | `postgres`, non-superuser, CREATEROLE. ADMIN on both owner roles, SET false, INHERIT false |
| Schema ACL | unchanged by the patch (checked) |

## 2. The migration

The release file `PROPOSAL-up.sql` is a fresh install and was **not** replayed. The only difference
between the installed baseline and Build 358 is two function bodies (`git diff ecf001f 0a725ed`).

| File | sha256 |
|---|---|
| `backend/fixture-delivery/STAGING-358-incremental-up.sql` | `9069d07a6e097ddf7c0c5c733da509369443bfc77e56897ea871aea143cc22fd` |
| `backend/fixture-delivery/STAGING-358-incremental-down.sql` | `d309a48c1fd1f97ba2b2af31214570d47851829b8397608d0c48cce84f9f03e0` |

Mechanism: `CREATE OR REPLACE FUNCTION` for `display(text)` and `materialize()` under `SET LOCAL ROLE`
to each owner. That keeps owner, ACL, SECURITY DEFINER, volatility and `search_path`. It takes SET on
the two owner roles and CREATE on the schema for the length of one transaction and gives both back,
the same way the installer did.

Guards, all inside one transaction that rolls back on any failure:
- refuses unless the function inventory is exactly 12 and every body matches its pin
- refuses unless owner and attributes of the two target functions match
- refuses if any private function is EXECUTE to PUBLIC
- refuses to commit unless owners, ACLs, config of all 12 are identical afterwards, only the two
  bodies moved to the expected new md5, no installer membership or CREATE remains, and the md5 of
  every fixtures, predictions, editions and principals row is unchanged

Offline evidence: `staging-358-incremental-regression.mjs`, 28 probes, passes on PostgreSQL 16.15
(local, hosted-shaped non-superuser administrator) and PostgreSQL 17.11 (CI job `hosted17`, the same
engine version as staging). It covers a tampered baseline, a renamed function, a second application,
the rolling window before and after the patch, the rollback, and the patch again after rollback. Two
defects were found and fixed by this regression before anything touched staging: a missing semicolon
let `reset role` be read as a function attribute, and a type error in the fingerprint query.

Rollback: `STAGING-358-incremental-down.sql` restores the two baseline bodies under the same guards.
It was applied and verified in the regression. It was not needed on staging.

## 3. Installation on staging

Run through the authorized staging connection as `postgres`, as one transaction, with the file text
unchanged. It returned without error.

| Check after | Result |
|---|---|
| `display(text)` body md5 | `0f85fe96b9ed5d269a886b5675516ea6` (Build 358) |
| `materialize()` body md5 | `223529aa1b915e96426c26b1c4acb3ff` (Build 358) |
| ACL fingerprint of 12 functions | `ab5c5e974e326b22790eb32c7b0f20c1`, identical to before |
| Data fingerprint | `13bc4b19fb8834b366e5c9f47574daa8`, identical to before |
| Fixtures, predictions | 148, 145, unchanged |
| Role memberships of `postgres` on the owner roles | same two edges, ADMIN only, SET false, INHERIT false |
| Schema ACL | unchanged, no CREATE left for either owner role |
| Private functions EXECUTE to PUBLIC | 0 |
| anon SELECT on `public.fixtures` | false |
| anon EXECUTE on `matchmind_publish_display_v1()` | false |

## 4. A valid edition for preview testing

Both existing editions had expired (the later at 2026-11-09 00:00 UTC), so the feed was dark before
and after the patch. One fresh edition was published through the real publisher RPC:

- The existing publisher principal was enabled for 5 minutes, the RPC was called as `authenticated`
  with that subject, and the principal was restored to its original row (disabled, original
  `approved_until`). Zero enabled publishers afterwards.
- Edition `4f81c165-5778-417e-85f5-3b20f1bfada4`, `as_of` 2026-11-09 14:02:27 UTC, `expires_at`
  2026-11-10 14:02:27 UTC. Life is exactly 24 hours.
- 147 cards and 145 predictions. All 145 frozen predictions are in it. Nothing was recalculated.
  The 148th fixture is one of two older fixtures with no prediction, outside the edition's date
  window. The edition projects the same rows the publisher always projects.
- Read as `anon`: predictions screen serves this edition, history 146 cards, scores 1 card,
  `raw_allowed` false.

**The edition expires at 2026-11-10 14:02 UTC.** After that the app fails closed. No scheduled
publisher runs on staging. Another edition needs the same five-minute enrolment, which is a staging
write and needs your word.

**The synthetic slate is old.** The newest fixture is dated 2026-11-08, so today's Scores and
Predictions screens hold one card. Analysis history holds 146. The app's date picker shows the
older matches. A slate dated for the test day needs new synthetic fixtures, which changes the 148
count. That is your decision.

## 5. The preview build

`staging/build-preview.mjs` reads the candidate files and writes `staging/dist/`. The candidate is
untouched. `sw.js` and both icons are byte-identical. In `index.html` exactly three lines are
replaced (`SUPA_URL`, `SUPA_KEY`, `<title>`) and one guard script is added in `<head>`. The manifest
name becomes `MatchMind STAGING`.

- Project and key: `https://rdcbnvfnxenrpnnwxszs.supabase.co` and the project's publishable key
  `sb_publishable_WKB88h4KAPtLVphsfNF9fg_W90ym80y`, which matches `get_publishable_keys` for the
  staging project. No service-role key, no secret, no production reference or key anywhere in the
  output (the build refuses otherwise, and a test checks again).
- The guard refuses any request to a host other than staging, the page's own origin, Google Fonts and
  the supabase-js CDN. It refuses every `/functions/` call (AI analysis, account deletion), blocks
  `sendBeacon` to other hosts and makes `PushManager.subscribe` reject, so no production or staging
  push subscription can register.
- A visible orange bar reads `STAGING · Build 358 · synthetic data · not production`. The tab title
  starts with STAGING.
- Separate origin, so the browser storage, accounts and service worker are separate from production.

Evidence:
- `test/staging-preview.test.mjs`, 4 tests, offline, run in the existing `combined` job.
- `.github/workflows/staging-preview-verify.yml`, run from a GitHub runner that can reach staging,
  anonymous and read only. 14 of 14 checks passed: Auth health HTTP 200; the display RPC returns the
  edition above; raw fixtures refused (HTTP 401); publish refused; the built page adopted the same
  `as_of` the RPC serves; 145 predictions in the page archive; every request went to staging,
  fonts or the CDN only; no production, provider, AI or Edge Function request; no script error.
- The built directory is kept for 7 days as the workflow artifact `matchmind-build358-staging-preview`.

## 6. Preview URL: none yet. This is a blocker.

No preview URL exists. A phone cannot reach this container. The only static hosts this session can
reach are the live GitHub Pages site, which you ruled out, and a claude.ai artifact page. An artifact
page has its own origin and may not register a service worker or install as an app, and nothing here
can open it from a phone, so it could not be verified as a faithful preview. It was not published.

Nothing is claimed about a phone, Firefox Android or iOS Safari.

### Operator actions to get a URL

1. Pick a host that is not the production site: a new private repository with its own Pages, or
   Cloudflare Pages, or Netlify. It must serve over HTTPS from its own origin, with `sw.js` and
   `manifest.webmanifest` at the root.
2. Download the workflow artifact `matchmind-build358-staging-preview` from run
   [staging-preview-verify](https://github.com/kennedychinazam/matchmind/actions/workflows/staging-preview-verify.yml)
   and upload its contents to that host unchanged. Compare `BUILD-INFO.json` hashes with the files.
3. Tell me the URL. I will check the response, the hashes and the staging binding before calling it
   ready. If you want me to host it as a claude.ai artifact instead, say so and accept that the
   service worker and install behaviour cannot be accepted there.
4. Then run `DEVICE-ACCEPTANCE-S23-IPHONE.md` and `OPERATOR-CHECKLIST-ROLLING-EDITION.md` on the
   S23 Ultra and a real iPhone in Safari, before 2026-11-10 14:02 UTC or after a fresh staging
   edition. Do not stop any publisher. Use only synthetic accounts. Item A5 should read
   `Live` now and `Updated 7h ago` at about 21:02 UTC.

## 7. Synthetic mobile QA slate and edition refresh (9 November 2026, 16:00 UTC)

Authorized by the Director on PR 26 (Decisions 3 and 4). Staging only. No provider, no production.

Additive rows, in one transaction that refuses unless the baseline is exactly 148 fixtures and 145
predictions and the id range 920000 and up is empty. It would have rolled back as a whole on any
mismatch. It committed.

| | Before | After |
|---|---|---|
| Fixtures | 148 | 156 (8 new: 920001 to 920008) |
| Predictions | 145 | 149 (4 new: 920001, 920002, 920004, 920006) |
| md5 of the 148 old fixture rows | `e775a54fa3d90f86b4087f5b98e79439` | identical |
| md5 of the 145 old prediction rows | `19f6cacdf289b6bbbce15d8180f2d1db` | identical |
| Principals, existing editions, shared records | fingerprinted | identical |

The new fixtures are fictional clubs ("QA Harbor FC" and so on), league "Synthetic League", provider
`synthetic`, status NS, no scores, no odds, no provider facts, no logos. Dates 9 to 12 November,
kickoffs between 12:00 and 21:00. Four carry one pre-match forecast each (all pick `1`, market `Home`,
probabilities 0.58, 0.47, 0.41, 0.64, build 358). Each `made_at` is 2026-11-09T16:00:49.369Z, which is
strictly before its kickoff, and the probabilities sum to 1. No played match got a forecast. No old
row was touched. The board record was not changed, so the four forecasts reach the app through the
edition's prediction cards. The four fixtures without a forecast test the honest no-pick state.

Edition refreshed after validation, through the reviewed five-minute publisher procedure:

| | |
|---|---|
| Edition id | `a4734e39-65d1-4cea-a4dc-21dbd9ec0432` |
| `as_of` | 2026-11-09 16:01:25.674414 UTC |
| `expires_at` | 2026-11-10 16:01:25.674414 UTC |
| Cards, predictions | 155 and 149 |
| Anonymous reads | predictions screen 9 cards (4 with a pick), scores 9, history 150 |
| Publisher principal afterwards | disabled, `approved_until` unchanged, row md5 identical, 0 enabled |
| Function fingerprint, `display` and `materialize` md5 | unchanged: `ab5c5e97...`, `0f85fe96...`, `223529aa...` |

The earlier edition `4f81c165` (14:02 UTC) stays in the table. One attempt at this refresh was
rejected by my own guard before it wrote anything (a PL/pgSQL `FOUND` scoping mistake) and nothing
changed. That makes two editions published today, the second one explicitly under Decision 4. The next
refresh is due after 2026-11-10 16:01 UTC and is limited to one per day.

Rollback of only the additive rows, should one be asked for: delete the 4 predictions and 8 fixtures
with `fxid >= 920000`, then publish a new edition.
