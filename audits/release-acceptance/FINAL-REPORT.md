# Build 357 release acceptance — final report

Prepared for MatchMind Director. Continuation of draft PR #23 after the previous coding
environment reached its usage limit. Draft PR #24, branch `claude/release-acceptance-20261106`.

No production write, merge, deployment, payment, provider request, paid inference,
historical regrading or destructive operation was performed.

---

## 1. Exact code revision

| | |
|---|---|
| Repository | `kennedychinazam/matchmind` |
| Base, verified | `7ed7a9f56ca9552665c0f6c425f513ba26aebe92` — confirmed against the GitHub API as the head of draft PR #23, branch `codex/public-fixture-remediation-20261102`, base `codex/release-final-20261102`, draft, open |
| Continuation branch | `claude/release-acceptance-20261106` |
| Draft PR | #24, based on `codex/public-fixture-remediation-20261102` so the diff is this work alone |

No Codex branch was modified, rebased or force-pushed. PR #6 and PR #23 are untouched and
remain draft.

Commits, oldest first:

| SHA | Subject |
|---|---|
| `fe5183a` | a failed bounded source read is reported, never shown as emptiness |
| `6b63e9f` | the raw-source capability was inert; `PROPOSAL-up.sql` needs a permissive policy |
| `59e2a18` | emulated mobile and PWA acceptance, and a wait that verified nothing |
| `2a2e9b4` | acceptance configuration, verified cost and the outstanding authorizations |
| `2078d63` | two corrections from the independent security review |

---

## 2. Problems found, with verified causes

Eight. Four were defects in the product or its proposal; four were tests written before
PR #23's own rules. Every one was reproduced before it was touched.

### ERROR 1 — a failed bounded source read was rendered as emptiness

- **ROOT CAUSE** `fixtureTable()` collapses every internal failure into one envelope,
  `{data:null, error:{message:'Bounded fixture display unavailable', code:'MM_DISPLAY_UNAVAILABLE'}}`
  (`index.html:2999`). Four call sites destructured only `data` and discarded `error`.
- **EVIDENCE** `index.html:22128` (`showPredictDate`, prediction read) rendered
  `No predictions stored for 2025-01-01.` on a denied read. Reproduced by CI failure #158
  at the verified head and by a written-first regression. `index.html:10931`, `16792` and
  `22133` discarded their result read's error, so every pick in the window read
  "no result on record"; the ledger output under a denied read was captured verbatim:
  `Published picks 1 Graded 0 No result on record 1 ... no result`.
- **PROPOSED SOLUTION** capture and throw at all four sites, the `if(error) throw error;`
  idiom already at `index.html:10920` and `16783`. Each function already had a truthful
  catch handler, so the messages become "Couldn't load that day: …", "Couldn't read the
  archive: …" and "Could not read the ledger — …".
- **ALTERNATIVE** render a per-row "result unavailable" marker instead of aborting the
  view. Rejected: it needs new state in twelve consumers for no gain in truthfulness, and
  the three functions already had correct handlers. A second alternative, making
  `fixtureTable` throw rather than return an envelope, was rejected because the envelope is
  the boundary that stops internal detail reaching a user.
- **IMPACT** the app stated facts about the archive and about settlement that were false.
  Worst case: a user reads "no predictions stored" for a day whose predictions exist and
  are intact, or treats a pick as ungraded when the result simply could not be read.
- **VERIFICATION** `test/display-read-truthfulness.test.mjs`, 5 behavioural regressions
  written failing-first. Three isolate the result read by granting raw access through the
  real `fixtureAccess()` gate, because without the grant the prediction read fails first
  and the assertion passes for the wrong reason. Each test also asserts the stored
  prediction row is byte-identical afterwards.
- **STATUS** FIXED. Nothing is stored or sent anywhere; no row is mutated.

### ERROR 2 — Node 24 was never verified at the PR #23 head

- **ROOT CAUSE** the matrix had no `fail-fast: false`, so the Node 24 job was cancelled the
  moment Node 20 failed.
- **EVIDENCE** run `41692158563` on `7ed7a9f5`, conclusion **failure**, created
  2026-11-03T18:16:09Z. Node 20 job `126113217744`: 211 tests, 205 pass, **6 fail**,
  0 skipped, 0 cancelled. Node 24 job `126113217096`: **cancelled**. PR #23's body says the
  exact-head suites "are running"; they had finished, and failed.
- **PROPOSED SOLUTION** `fail-fast: false`, and add this branch to the push trigger.
- **ALTERNATIVE** two separate jobs instead of a matrix. Rejected as a larger change to a
  working workflow for the same effect.
- **IMPACT** a cancelled job is indistinguishable from a passing one in a summary view. One
  of the two supported Node versions had no result at all on the release candidate.
- **VERIFICATION** both jobs now run to completion and report separately; see part 4.
- **STATUS** FIXED.

### ERROR 3 — the raw-source capability was inert

- **ROOT CAUSE** `PROPOSAL-up.sql` created only a RESTRICTIVE SELECT policy per copied-fact
  base table. A restrictive policy cannot return a row on its own: with RLS enabled and no
  PERMISSIVE policy that applies, PostgreSQL default-denies.
- **EVIDENCE** on an isolated PostgreSQL 16.15 cluster built for this check, an enrolled
  principal with `raw_allowed()` returning `t` read **0 of 2** rows. Written as probe 3 of
  `backend/fixture-delivery/local-fence-regression.sql`; against the uncorrected proposal it
  aborts with `FAIL 3: enrolled capability delivered 0 of 2 rows (inert fence)` while probes
  1 and 2 still pass.
- **PROPOSED SOLUTION** one PERMISSIVE policy per base table reading the **same**
  capability. Restrictive AND permissive both call `raw_allowed()`, so the net can never
  exceed it. `PROPOSAL-revert.sql` drops it alongside the fence.
- **ALTERNATIVE** drop the restrictive policy and rely on the permissive one alone.
  Rejected: the restrictive form is what guarantees no other policy on those tables can
  ever return a row without the capability, which is the property worth keeping.
- **IMPACT** the three public-protection claims were never affected. What broke was the
  authorized path: an enrolled publisher or research principal would have seen an empty
  application, because the browser takes the raw branch on `raw_allowed:true` and returns
  the empty raw result with no fallback.
- **VERIFICATION** 8 asserting probes, all passing with the correction: anonymous read
  refused; ordinary authenticated reads nothing; enrolled capability delivers its rows;
  revocation closes it immediately; expiry closes it; unrestricted select and paging extract
  nothing; the principal registry is unreadable; a `SECURITY INVOKER` function cannot bypass
  the fence.
- **STATUS** FIXED in the proposal file only. **Not applied anywhere but a throwaway local
  cluster.** Every row is invented.

### ERROR 4 — a wait that verified nothing

- **ROOT CAUSE** `page.waitForFunction` treats a returned Promise as a truthy value, so an
  async predicate resolves at once whatever it computes.
- **EVIDENCE** on the pinned `playwright-core@1.63.0` that CI installs:
  `waitForFunction(async () => false)` resolved in **30 ms**; `waitForFunction(() => false)`
  timed out after **2007 ms**. `test/pwa-lifecycle.test.mjs:48` used the async form to wait
  for the service worker to take control.
- **PROPOSED SOLUTION** a Node-side poll over `page.evaluate`, which does await, with a 30s
  bound and a named failure.
- **ALTERNATIVE** `page.waitForEvent` on a worker event, or expose a flag from an awaited
  evaluate and wait on the sync form. Both work; the poll is the smallest change and reads
  the same way at both call sites.
- **IMPACT** the PWA acceptance evidence did not establish that the worker controlled the
  page at that point. The test passed on the awaited evaluates that follow, so the gap was
  silent. This is the "silent error" class the assignment asked about.
- **VERIFICATION** the no-op is demonstrated directly, the corrected test still passes, and
  the same pattern is absent from the rest of the suite (one occurrence, now fixed).
  `sw.js` is untouched and its pinned sha256 unchanged.
- **STATUS** FIXED.

### ERROR 5 — `combined-security` seeded a corpus the app deliberately purges

- **ROOT CAUSE** `onAuth` drops any league not marked `_presentation` (`index.html:22722`,
  the bounded-presentation rule PR #23 introduced). `seed()` built raw leagues, then called
  `onAuth({id:'A'})`.
- **EVIDENCE** probed directly: after `onAuth`, `afState.leagues` was `[]`, `leagueOrder`
  `[]`, `searchData('Public Shared')` returned `{comps:0, teams:[], matches:0}` and
  `#searchResults` held `Nothing loaded on this device matches "Public Shared"`. With
  `_presentation:true` on the same seed: 1 match, 1 team, `data-m="0"` rendered.
- **PROPOSED SOLUTION** mark the seeded corpus `_presentation`, as `fixtureDisplayLoad`
  marks it at `index.html:3018`.
- **ALTERNATIVE** grant raw access in the test so raw leagues survive. Rejected: search in
  a signed-in session is meant to index the bounded corpus, so the presentation marking is
  the faithful premise.
- **IMPACT** test-only. CI failures #46 and #50.
- **VERIFICATION** both pass; the suite is green.
- **STATUS** FIXED, premise corrected, nothing weakened.

### ERROR 6 — `branding-rights` seeded a legacy cache the app no longer admits

- **ROOT CAUSE** `restoreState` refuses a stored state unless raw access is current:
  `if(s && !(fixtureRawCurrent()) && s.footballSource!=='custom-csv') return false;`
- **EVIDENCE** CI failure #43, `synthetic legacy cache did not restore`.
- **PROPOSED SOLUTION** take the raw grant through the real `fixtureAccess()` gate before
  `restoreState`, keeping the test on the authorized collector path — which is exactly where
  a cached provider logo could still reach a rendered surface.
- **ALTERNATIVE** set `footballSource:'custom-csv'` to slip the fence. Rejected: custom CSV
  is a different source and would not carry provider imagery, so the test would stop
  covering what it is named for.
- **IMPACT** test-only. One hypothesis raised and **disproved** along the way: that this
  fence loses user favourites and history. It does not — personal data lives in the separate
  `mm_personal_v1:` partition restored by `personalApply` (`index.html:22605+`).
- **VERIFICATION** passes; the logo-suppression assertions still run.
- **STATUS** FIXED, premise corrected.

### ERROR 7 — three `release-remediation` stubs predate the access gate

- **ROOT CAUSE** the stubs provided only `from`. `fixtureAccess()` calls
  `supa.rpc('matchmind_fixture_access_v1')`, which threw, so the read never reached what the
  test was about.
- **EVIDENCE** CI failures #156, #157 (`page.evaluate: Object`) and #158.
- **PROPOSED SOLUTION** give each stub an `rpc` returning a raw-access grant, which is the
  path their `from` stub models.
- **ALTERNATIVE** route the stubs through the bounded display instead. Rejected: these tests
  are about collector-side settlement revalidation, which legitimately runs with raw access.
- **IMPACT** test-only, but #158 masked ERROR 1, so one of the three was hiding a real
  defect.
- **VERIFICATION** all 20 `release-remediation` tests pass.
- **STATUS** FIXED, premise corrected.

### ERROR 8 — an assertion that could not fail

- **ROOT CAUSE** `assert.match(await p.locator('#searchResults').textContent(), /Public Shared/)`
  also matches the no-results message, which quotes the query back:
  `Nothing loaded on this device matches "Public Shared".`
- **EVIDENCE** that test passed at the verified head while its sibling, asserting a rendered
  `.sres` row for the same query, failed. The corpus was empty in both.
- **PROPOSED SOLUTION** require a rendered result row as well as the text.
- **ALTERNATIVE** leave it, since the sibling test covers it. Rejected: an assertion that
  cannot fail is worse than none, because it reads as coverage.
- **IMPACT** test-only, and it is why ERROR 5 survived in the suite.
- **VERIFICATION** the assertion now fails on an empty corpus; verified against the
  uncorrected seed.
- **STATUS** FIXED, strengthened.

---

## 3. Corrections completed

| Area | Change |
|---|---|
| `index.html` | four call sites capture and throw the bounded-read error; one build note corrected for accuracy. No formula, market table, grading rule, settlement rule or threshold changed |
| `.github/workflows/build357-integration.yml` | `fail-fast: false`; this branch on the push trigger |
| `backend/fixture-delivery/PROPOSAL-up.sql` | one permissive policy per base table on the same capability; a note recording that `principals.scope` is never read |
| `backend/fixture-delivery/PROPOSAL-revert.sql` | drops the new policy alongside the fence |
| `backend/fixture-delivery/local-fence-regression.sql` | new, 8 asserting probes on an isolated local cluster |
| `test/display-read-truthfulness.test.mjs` | new, 5 behavioural regressions |
| `test/mobile-pwa-acceptance.test.mjs` | new, four emulated device profiles |
| `test/pwa-lifecycle.test.mjs` | the no-op wait replaced by a real one |
| `test/combined-security.test.mjs`, `test/branding-rights.test.mjs`, `test/release-remediation.test.mjs` | four stale premises corrected, one assertion strengthened |
| `audits/release-acceptance/` | this report and the authorization request |

No test was weakened, skipped, quarantined or excluded. `sw.js`, `manifest.webmanifest`,
`robot/publish.mjs` and every engine constant are byte-identical to the verified head.

The complete `index.html` diff against the verified head is 6 changed lines of code — three
`error:` captures added to existing destructures, one more, and four `if(…) throw …;` lines —
plus comments. Nothing else in 23,000 lines moved.

---

## 4. Test results, Node 20 and Node 24

Offline Chromium from `/opt/pw-browsers/chromium`, `playwright-core@1.63.0`, every off-host
request aborted. Before this branch, at the verified head: **211 tests, 205 pass, 6 fail**.

### Local

| Node | Tests | Pass | Fail | Skipped | Cancelled |
|---|---|---|---|---|---|
| 20.20.0 | 217 | 217 | 0 | 0 | 0 |
| 22.22.0 | 217 | 217 | 0 | 0 | 0 |
| 24.19.0 | 217 | 217 | 0 | 0 | 0 |

### GitHub Actions

| Run | Node | Tests | Pass | Fail | Skipped | Cancelled |
|---|---|---|---|---|---|---|
| [`42251024121`](https://github.com/kennedychinazam/matchmind/actions/runs/42251024121) `fe5183a` | 20.20.2 | 216 | 216 | 0 | 0 | 0 |
| [`42251024121`](https://github.com/kennedychinazam/matchmind/actions/runs/42251024121) `fe5183a` | 24.19.0 | 216 | 216 | 0 | 0 | 0 |
| [`42252948985`](https://github.com/kennedychinazam/matchmind/actions/runs/42252948985) `59e2a18` | 20.20.2 | 217 | 217 | 0 | 0 | 0 |
| [`42252948985`](https://github.com/kennedychinazam/matchmind/actions/runs/42252948985) `59e2a18` | 24.19.0 | 217 | 217 | 0 | 0 | 0 |
| [`42254673896`](https://github.com/kennedychinazam/matchmind/actions/runs/42254673896) `2078d63` | 20.20.2 | 217 | 217 | 0 | 0 | 0 |
| [`42254673896`](https://github.com/kennedychinazam/matchmind/actions/runs/42254673896) `2078d63` | 24.19.0 | 217 | 217 | 0 | 0 | 0 |

Both matrix jobs now run to completion and report separately. **No test is skipped and none
is conditionally skipped in practice**: the two files carrying a conditional skip,
`test/pwa-lifecycle.test.mjs` and `test/mobile-pwa-acceptance.test.mjs`, both run when
`PWA_PLAYWRIGHT` and `PWA_CHROMIUM` are set, which the workflow and every run above do. A
run that failed to set them would report `skipped 1` or `skipped 2`, and every run above
reports `skipped 0`.

### Per suite, 217 total

| Suite | Tests | | Suite | Tests |
|---|---|---|---|---|
| `account-deletion-lifecycle` | 22 | | `fixture-delivery-ui` | 19 |
| `account-ownership` | 20 | | `integration-build357` | 2 |
| `branding-rights` | 2 | | `launch-readiness` | 14 |
| `combined-security` | 7 | | `mobile-pwa-acceptance` | 1 |
| `credential-ownership` | 14 | | `pwa-lifecycle` | 1 |
| `display-read-truthfulness` | 5 | | `release-remediation` | 20 |
| `fixture-delivery-backend` | 15 | | `search-accessibility` | 10 |
| `fixture-delivery-cache` | 10 | | `settlement-consumers` | 17 |
| `fixture-delivery-consumers` | 11 | | `settlement-provenance` | 10 |
| `fixture-delivery-refresh` | 3 | | `takeover-ui` | 8 |
| `fixture-delivery-robot` | 6 | | | |

### Database, outside `node --test`

`backend/fixture-delivery/local-fence-regression.sql`, PostgreSQL 16.15, a throwaway
cluster created for this check: 8 probes, 8 pass. Against the uncorrected proposal, probe 3
fails. Invented rows only; no hosted database contacted.

---

## 6. Backend acceptance results

### What was asked, and what the evidence says

| Requirement | Result |
|---|---|
| Ordinary anonymous users cannot retrieve unrestricted raw fixture tables | **HELD.** Table and every column SELECT revoked from `public, anon, authenticated` (`PROPOSAL-up.sql:176-177`); the install **aborts** if any inherited anonymous SELECT survives (`:194`) and if `anon`/`authenticated` carry `rolsuper` or `rolbypassrls` (`:159`). Probe 1: refused outright, not merely emptied |
| Authenticated ordinary users cannot bypass the restrictions | **HELD.** Probe 2: 0 rows. Probe 8: a `SECURITY INVOKER` function returns 0 rows. Probe 7: the principal registry is unreadable |
| Generic queries, unrestricted pagination and bulk extraction are prevented | **HELD.** Probe 6: `select *` with no predicate, `offset 0 limit 1000`, as an ordinary authenticated caller, returns 0 rows. The RPC surface accepts only the five fixed screens and no caller-supplied fixture, date, field list, offset, cursor, table or history range |
| Approved fixture and prediction screens still function | **HELD in the browser.** 217 tests include `fixture-delivery-ui` (19), `fixture-delivery-consumers` (11), `fixture-delivery-backend` (15), `fixture-delivery-cache` (10), `fixture-delivery-refresh` (3), `fixture-delivery-robot` (6). Not yet proven against PostgREST |
| Published probabilities, identities and original records unchanged | **HELD.** No engine constant, market table, grading rule or threshold is in the diff; `release-remediation` (20) and `settlement-provenance` (10) cover the probability contract and issued-vector integrity; the new tests assert stored rows are byte-identical after a failed read |
| Results, withdrawals and settlement retain their meaning | **HELD.** `settlement-consumers` (17) and `settlement-provenance` (10) pass; the only settlement-adjacent change is that an unreadable result read now reports rather than presenting a pick as ungraded, which strengthens the meaning |
| Collector and publisher retain authorized access | **PARTLY.** ERROR 3 shows the enrolled-principal path was inert and is now corrected and proven locally. The `service_role` collector path cannot be settled here; see the open question below |
| No provider key or server secret in the browser | **HELD.** Only an `sb_publishable_` key ships. No `sb_secret_`, no `service_role`, no JWT literal, no `MM_CRON_SECRET`, no OpenRouter key. `afState.key` ships empty, lives only in per-owner `localStorage` under a slot allow-list, requires an explicit per-session opt-in, and reaches exactly one destination, the `x-apisports-key` header against an allow-listed api-sports.io base. `cloudPush`'s payload is an explicit allow-list carrying no credential and no fixture rows. `sw.js` caches same-origin responses only, and Supabase is a different origin |

### What could not be proved here

The repository's own synthetic proof,
`local-integration.mjs --run-local-synthetic`, needs the Docker daemon. This container has
the client but no daemon and no socket:

```
$ ls -la /var/run/docker.sock
ls: cannot access '/var/run/docker.sock': No such file or directory
```

So **PostgREST behaviour is unproven**: request shaping, `Prefer` headers, embedded
resource expansion, `?select=` column projection, Range pagination headers, the JWT role
switch and the `/rpc/` surface. The local PostgreSQL cluster answers the RLS question and
nothing more.

### Two open questions for the Director

1. **Does `service_role` hold an explicit SELECT grant, or inherit one via `PUBLIC`?**
   `PROPOSAL-up.sql` runs `revoke select on <table> from public,anon,authenticated`. If the
   collector's access came through `PUBLIC`, that statement stops the refresh pipeline. A
   local replica cannot answer it; it is a fact about the production catalogue, and the
   proposal's preflight does not check it. It should, and I can add the check once the
   secret-free grants export shows the intended shape. This is the single item that most
   warrants holding the install.
2. **`principals.scope` is recorded but never read.** The column is constrained to
   `publisher|research`, yet `raw_allowed()` checks only `enabled` and `approved_until`, so
   both scopes receive the same full raw read of all columns of all rows of the ten
   copied-fact tables. That matches the README's statement that both paths retain complete
   history, so it is recorded in the file rather than changed: narrowing it is a decision
   about intent. It matters more now than before, because the correction in ERROR 3 turns
   that capability from inert into live. Containment is real — `principals` defaults
   `enabled` to false, starts empty, and no browser-reachable role can write it.

---

## 7. Remaining physical-device tests

Emulated results are recorded, and they are emulation:

| Device | Viewport | DPR | Sideways scroll | Smallest tab | Offline reload |
|---|---|---|---|---|---|
| iPhone 14 | 390×664 | 3 | 0 px | 44 px | served build 357 |
| iPhone SE | 320×568 | 2 | 0 px | 44 px | served build 357 |
| Pixel 7 | 412×839 | 2.625 | 0 px | 44 px | served build 357 |
| iPad Mini | 768×1024 | 2 | 0 px | 44 px | served build 357 |

Each profile also required the worker activated and controlling the page, the full
five-entry offline shell actually cached, five visible tabs, no page runtime errors, and an
offline reload serving the same document and build.

Seven items need an operator with hardware, and nothing in this container can substitute:

1. **iOS Safari / WebKit** — emulation runs Chromium. Service-worker cache eviction,
   storage quota and backgrounded-tab behaviour all differ.
2. **Add to Home Screen and launch from the icon** — standalone launch, splash screen,
   status bar, and whether the app returns to the right view. iOS and Android separately.
3. **Real touch** — tap accuracy on the five targets, scroll momentum, the date strip under
   a thumb, one-handed reach. 44 CSS px is geometry, not experience.
4. **Notification permission** — the real OS prompt, a delivered push, behaviour with the
   app closed. The worker's push handler has never run against a real push service.
5. **Network transitions** — offline to online mid-read, captive portal, 3G latency,
   airplane mode on a cold start. The offline shell is proven against a destroyed local
   origin, which is not a flaky radio.
6. **Storage pressure** — `saveState` writes against a roughly 5 MB quota with an empty
   catch. Only a device with a full browser store surfaces that.
7. **Comfort at 320 px and 390 px** — fitting without sideways scroll is proven; whether the
   text is comfortable is a human judgement.

---

## 8. Remaining applicable rights requirements

Per the Director's instruction: routine renewal and further subscription-proof demands are
**not** treated as release blockers; the earlier 10 November three-fixture pilot date is
treated as an internal evidence check and **not** a retention deadline; no data was
deleted; no provider contact was made and none is proposed; branding stays neutral.

One licensing question is left materially unresolved by the bounded presentation contract,
and it belongs to the rights review rather than to the provider: a bounded edition is still
a finite, inspectable, recordable projection of provider facts served to the public.
Bounding the fields and denying generic SQL reduce extractability; neither confers a
publication right. Also still open in the rights review, unchanged by this branch: imagery
and third-party rights, issued bookmaker-price display, share images, and retention.

Until those are settled, **external invitations and public release stay blocked**, which is
the position PR #23 already records. Nothing in this branch changes it.

---

## 9. Outstanding authorization requests

Nine, each separately scoped, none implied by another. Full text in
`audits/release-acceptance/ACCEPTANCE-AUTHORIZATION-REQUEST.md`.

| # | Request | Cost |
|---|---|---|
| 1 | A Docker-capable runner, so the repository's own synthetic Postgres + PostgREST proof can run | 0.00 USD, no hosted resource, no external network |
| 2 | Create the staging Supabase project, PostgreSQL 17, `eu-west-2` | Expected 0.00 USD; worst case 10 USD/month |
| 3 | Apply `PROPOSAL-up.sql` to staging only | 0.00 USD |
| 4 | Create three synthetic staging accounts and seed synthetic rows | 0.00 USD |
| 5 | Run the denied-operation probes, including refused writes | 0.00 USD |
| 6 | Rehearse `PROPOSAL-revert.sql` on staging | 0.00 USD |
| 7 | Delete the staging project at the end | 0.00 USD |
| 8 | The Director's secret-free schema, grants, policies and inventory export | 0.00 USD |
| 9 | An operator session on one iOS and one Android device, items 1 to 7 of part 7 | operator time |

Cost basis, read from the Supabase management API as metadata only, no production table or
row read: organization `MatchMind` (`tpbuhnouchqssmunxqgv`) is on the **free** plan with two
projects, `MatchMind Project` (`toqfdrcjzwnlydqekude`, ACTIVE_HEALTHY, PostgreSQL 17.6.1.147)
and `EduVanta` (`kbkzwcaffyjxnsbvtsnw`, INACTIVE). The free plan allows two active projects,
so a third should remain free, but that depends on how a paused project is counted at
creation. I will stop and report rather than incur a charge.
