# MatchMind final integrated release correction — report to the Director

8 November 2026. Branch `claude/staging-s1-s2-20261107`, PR #26, **draft and unmerged**.
Baseline accepted head `e6459adcfc0f565b6ad26743b38560161491d115`.

Nothing here has been deployed. Installed users are on **Build 355**; this branch is Build 357 and
has never shipped.

## 1. Branch, final commit, PR

| | |
|---|---|
| Branch | `claude/staging-s1-s2-20261107` |
| Final commit | `d6f787f` (`e6459ad..d6f787f`, seven commits) |
| PR | https://github.com/kennedychinazam/matchmind/pull/26 (draft) |

Four commits on the accepted baseline:

| Commit | What |
|---|---|
| `3efcb81` | fixture-freshness preflight; acceptance workflow made dispatch-only; publication-rights assessment |
| `0e3f322` | publisher-failure reporting channel; job timeout raised past the script's own budget |
| `6216491` | **the Analysis provenance change** (Agent B) |
| `034bdd1` | **Scores slate completeness and the Samsung layout causes** (Agent D, integrated by hand) |
| `ef05d12` | the independent review's seven fixable findings, including two of my own mistakes |
| `5676f57` | page-overflow attribution, so a test fails only for the box it names |
| `d6f787f` | the brand wraps its own contents, which CI caught and my font stack could not |

## 2. Confirmed root causes and corrections

### 2.1 The "No pick" paragraph: both named causes were impossible

**ERROR.** The Analysis feed printed a four-sentence note under every matchday holding one or more
played fixtures with no pick, naming two causes.

**ROOT CAUSE.** Both are false.

*"the app was not open before kick-off"* — publication does not depend on any reader's device.
`archivePrediction` (`index.html:10719`), `recordDrift` (`:10750`), `markWithheld` (`:11128`) and
`backfillPredictions` (`:16730`) each return unless `isPublisher()`, and the client table shim
throws `Private source writes require publisher authority` for any non-raw writer (`:2976`). The
database policies additionally test the robot's email. Forecasts are published by the scheduled
GitHub Actions publisher (`.github/workflows/publish-picks.yml` running `robot/publish.mjs`),
which opens the deployed app headless as the publisher account. **The Director was right and the
app's copy was wrong.**

*"or the pick was withheld … because it did not clear that competition's bar"* — since build 199 a
withheld row **keeps its pick**: `fixturePresentationRow` sets `pick: p.pick` regardless of
`withheld_at`. Such a fixture therefore has a truthy `f.pick` and is never one of these rows at
all. The sentence described build 142's deleted behaviour. `unarchivePrediction`, which the
justifying comment cited, **does not exist anywhere in the file** — only two historical comments
mention it.

**CORRECTION.** The paragraph is gone, with nothing persistent in its place. Every row stays.

### 2.2 One chip label covered eight different provenances

**ERROR.** `No pick` was shown for a published edition that issued no pick, a proven withhold, a
dated board snapshot, nothing on record at all, a locally fitted archive with no row, an archive
read that **failed**, an edition past its expiry, and a bare results-feed row carrying no
provenance. An unreadable record read as a deliberate abstention.

**ROOT CAUSE.** The branch keyed on `!f.pick` alone. `loadArchive` also swallowed its own failure,
leaving a failed read indistinguishable from an empty one.

**CORRECTION.** `PICK_STATUS` + `pickStatusCode(L, f)` decide from provenance, with a new
`_archiveRead` load state and `_boardRow` on presentation rows:

| Label | Means |
|---|---|
| `Withheld` | a published prediction row stamping `withheld_at` |
| `No pick issued` | a published prediction row that issued no pick |
| `Board: no pick` | no prediction row, but a **dated** board snapshot carries one |
| `No record` | neither; four causes collapse and are **not** separable |
| `Not archived` | locally fitted device, archive read, no row for this fixture |
| `Unavailable` | never read, read failed, expired edition, or a row with no provenance |
| `<pick> rebuilt` | a RECONSTRUCTED row, which the ledger already excludes |

Four causes are deliberately **not** subdivided, because the data cannot separate them: the
publisher never ran in that fixture's window; the gate declined it before any publication (which
`index.html:4464-4466` records as writing "no row, no counter and no log line"); the competition
was never priced that run (the `notPassed` population, which carries no fixture identities); or the
fixture was outside `PUBLISH_AHEAD_DAYS = 3` at every run that saw it. The label says the data does
not say why, and names no cause. Board-derived labels are phrased as a **dated observation**,
because `boardBuild` excludes any fixture already kicked off and the board is a single row
overwritten every run, so it keeps no history.

The long explanation is optional: a `title`, an `aria-label`, and a tap. Never a paragraph.

### 2.3 A hindsight reconstruction was graded like a committed pre-match pick

**ERROR.** `backfillPredictions` writes prediction rows for **already-played** fixtures, stamped
`build: RECONSTRUCTED` (= −1). The feed gave them a plain ✓ or ✗ while `renderLedger`
(`index.html:11184`) and `engineRecordPayload` (`:21171`) excluded them. One pick, two answers.

**ROOT CAUSE.** `archiveRow` computed `recon: r.build === RECONSTRUCTED` and **no reader consulted
it**; the only occurrence of `recon` in the file was that assignment.

**CORRECTION.** `pickIsRebuilt(f)` reads it, and such a pick renders `1 rebuilt` with no verdict.
`gradePick`, every threshold and both ledger exclusions are untouched.

**One correction to the backend finding, verified by me.** This was **not** reachable through a
published edition: `FIXTURE_DISPLAY_SCHEMA` declares `prediction.build` with `"min":0`
(`index.html:2905`) and `fixtureProjection` rejects `value<s.min` (`:2910`), so `build: -1` cannot
traverse a bounded edition. The defect was live on the **raw/local path**, where `applyGatePass`
copies the archived pick onto the row. Both paths are now covered.

### 2.4 The Scores slate could hide rows while looking entirely settled

This is the Director's own observation, reproduced end to end across a real page reload: the feed
rendered **1 of the 6** matches the day held, while the header read `6 matches` and the competition
chip read `All competitions`.

**ROOT CAUSE, three mechanisms.**

1. `renderScores` wrote `scoresMeta` from `dayAll.length` **before** applying the competition and
   status filters, so the reader got the unfiltered count over a filtered list. When the filtered
   list was empty, the markup was only the four status chips — a count, four chips, no rows — and
   the `if(!dayAll.length)` empty state fires on the **unfiltered** day, so it was never reached.
2. `compsLabel()` returned the string `All competitions` whenever `afState.leagues[v]` was missing,
   which is exactly the state after `loadCloudLeagues` rebuilds and drops the chosen league, or
   after sign-out clears `afState.leagues` while leaving `afState.filter` set. The chip actively
   denied the filter it was reporting.
3. `buildCompsDrop()`'s empty-corpus note was an **assignment** over `html`, discarding the
   `All competitions` item with it. In the public presentation shape `L.matches` is empty, so the
   `>= 15` qualifying test leaves the set empty for **every public reader**: this is the normal
   path, not an edge case. A reader whose filter was a league id had no control anywhere able to
   widen the feed. The Scores control also opened empty on a fresh load, because
   `renderCompsDrop()` is reached only from `renderFixtures()`.

**How a reader reaches it without touching any dropdown:** global Search, then tap a competition,
which sets `afState.filter = L.id` (`index.html:5805`). That is the route the Director took.

**CORRECTION.** The header counts the rows below it and says "of N — one competition" while
narrowed; a day that holds matches and shows none says which filter is hiding them and offers one
tap out; the chip states the real filter on every repaint; the way back to All competitions is
never discarded; and the Scores control is built before it is shown.

### 2.5 The Samsung screenshots: the Director's zoom suspicion was wrong, and the cause is ours

**There is no browser-conditional rule anywhere in the stylesheet.** No `text-size-adjust`, no
`env(safe-area-inset-*)`, no `@media (display-mode: standalone)` layout rule, no UA sniffing
affecting layout, zero `vw` font sizes, and **exactly one** media query in the whole sheet
(`@media(max-width:360px)` at `index.html:292`). So no Chrome-specific or Firefox-specific fix
exists to write. The layout is **width-fragile** instead. Same page, same text size: a 360 CSS px
viewport gives a 106 px top bar, 412 px gives 72 px — a 34 px difference that accounts for "Chrome
used more vertical space".

**The About row wrapped at the DEFAULT text size**, with no accessibility setting involved. At
360 CSS px the row has 298 px; the version string wants 182 and the descriptor 151, plus a 32 px
icon and gaps, so 386 px was asked of 298. Both wrapped, and the version broke between "build" and
its number. **It reproduces on Build 355 itself**, with the exact wording photographed. Zoom was
never the cause. Fixed by giving the descriptor its own line: both now read on one line at 100%
and 130% text scaling.

**Text scaling pushed the whole page sideways** between 361 and 393 CSS px, because `.brand` is a
flex item whose automatic minimum size is its min-content width, and the only media query covers
`max-width:360px`. Measured 2, 5 and 20 px of horizontal page scroll at 375, 390 and 393 px with
the root raised. On Build 355, which has **zero** media queries, 360 px with raised scaling gave
17 px of sideways scroll — the Director's own device width, in Chrome.

Fixed with `min-width:0` alone: **0 px at every width and scale tested**, with the top bar the same
height or lower (390 px and 393 px at 22.4 px root drop from 97 px to 78 px).

**I got the fix wrong, and the independent review caught it.** The mobile specialist proposed
`min-width:0; overflow:hidden`. I dropped `overflow:hidden` because it clips the wordmark, and
accepted `min-width:0` alone on a measurement of the page's horizontal scroll, which it does drive
to zero at every width and scale. **That measurement could not see the actual fault.**
`min-width:0` lets the flex *item* shrink while its children keep `min-width:auto`, so the wordmark
and the PRO badge overflowed the brand's own content box to the right, underneath `#dataChip`,
which is opaque and later in the DOM and therefore painted over them. The badge was simply gone,
with no scrollbar to reveal it.

I re-measured it myself and confirmed the review, then found it is worse than the review reported:
occlusion starts at the **default** text size, not at 120%.

```
361px root 16   (100%)  badge overlapped by the status chip by  189px²   sideways 0
375px root 16   (100%)  badge overlapped by the status chip by   47px²   sideways 0
390px root 20.8 (130%)  badge overlapped by the status chip by  647px²   sideways 0
390px root 28.8 (180%)  badge overlapped by the status chip by 1553px²   sideways 0
430px root 32   (200%)  badge overlapped by the status chip by 1865px²   sideways 0
```

`overflow:hidden` would not have helped: the geometry is identical, so the author's version loses
the badge by clipping and mine lost it by occlusion. **The only thing that rescues the top bar is
wrapping**, and `flex-wrap:wrap` was gated behind the single `max-width:360px` query. It is now
unconditional, and verified across 9 widths × 7 text scales: **0 occlusion and 0 sideways scroll
everywhere**.

It costs height: 72 → 106 CSS px at 375 px even at the default text size. The mobile specialist
objected to exactly that cost and recommended against wrapping. **That objection was wrong, and so
was my acceptance of it:** the 72 px was only ever reached by overlapping the badge, so the taller
bar is the honest measurement rather than a regression.

### 2.6 A failed publisher run reached nobody

**ERROR.** No `if: failure()` step, no issue, no webhook and no badge in **any** workflow in the
repository. The script's only failure channel was stdout. So the sole surfacing was GitHub's
default failure email to the repository owner — an account setting, not something the repository
guarantees — and a schedule GitHub disables after 60 days of inactivity emails nothing at all.

**CORRECTION.** A separate job opens or updates a single tracking issue. Separate on purpose: it
needs `issues: write`, and the publisher job holds the publisher's sign-in credentials, so the
token that can open an issue never shares a job with those secrets.

### 2.7 The publisher job was cancelled before it could explain itself

**ERROR.** `timeout-minutes: 90` against the script's own worst case of **141 minutes**: three
`waitSettled` calls at 20 min each, the measurement pass at 70 min, the Smart Bet tab at 5 min, two
sign-in waits at 3 min. A slow run was killed mid-sequence, after the bars, the engine record and
possibly the board had been written, losing the `summary` line carrying `newPredictions`,
`board.notPassed` and `issuedRowsToday` exactly when it was needed.

**CORRECTION.** 150 minutes. No cron was added: a fourth daily run would make provider API calls,
which is not authorized.

### 2.8 Fixture-freshness preflight

The Director's recommendation after attempt 2. The staging edition's own expiry is now checked with
the admin key **before a single disposable user exists**, and a stale fixture is named as a stale
fixture rather than surfacing as a generic mid-test 500. Verified failing-first against a fake
Supabase: an expired edition exits 1 with "FIXTURE NOT FRESH … TEST FIXTURE problem, not a product
defect" and **zero** POSTs to `/auth/v1/admin/users`.

### 2.9 A daily blackout of the public feed — FOUND, NOT FIXED, needs a Director decision

**ERROR.** Every UTC day has a window of roughly five and a half hours in which **no edition is
admissible**, so ordinary readers get `Published fixtures unavailable. Please try again.` An
edition published by the 23:17 UTC run is usable for about **43 minutes**.

**ROOT CAUSE.** Edition admission is scoped to the current **UTC** day in three independent places,
while `expires_at` is clamped to UTC midnight and the publisher schedule is expressed around Lagos
local time with its first daily run at 05:17 UTC. All four verified directly:

```
PROPOSAL-up.sql:210   where edition_day=(statement_timestamp() at time zone 'UTC')::date
                        and as_of<=statement_timestamp() and expires_at>statement_timestamp()
PROPOSAL-up.sql:412   least(stamp+interval '24 hours',((day_utc+1)::timestamp at time zone 'UTC'))
index.html:2941       refuses an as_of from a different UTC day, independently of the server
publish-picks.yml:8-10  cron '17 23 * * *', '17 5 * * *', '17 17 * * *'
```

The Build 357 "keep what is on screen" branch cannot help: `_presentationUntil` is that same UTC
midnight, so `keep` is false and the slate is cleared with `_boardRecord.state='failed'`.

**IMPACT.** Daily blackout of the public Analysis feed. It also means a genuinely missed publisher
run and the normal nightly dead window are **indistinguishable to a reader**, which bears directly
on the Director's original complaint: until this is settled, a "No pick" count cannot be read as
evidence about the publisher.

**WHY I DID NOT FIX IT.** Every available mitigation is ruled out or unauthorized:

- *Extend the edition's lifetime past UTC midnight* — the Director's instruction of 8 November
  expressly forbids extending published edition lifetime, and it weakens a fail-closed
  freshness invariant.
- *Add a cron just after 00:00 UTC* — a fourth daily publisher run makes provider API calls, and
  no provider spending beyond approved activity is authorized. It would also only narrow the gap,
  since the run takes time before `boardPublish`.
- *Re-scope the edition window to the product's own day (Africa/Lagos) consistently in all three
  places* — this neither extends a lifetime nor adds a provider call, and is the option I would
  recommend. It touches the migration, so it needs the Director's approval and a staging
  installation to verify.

**STATUS.** CONFIRMED by direct reading of all four sites. Awaiting a decision.

## 3. Files changed

| File | Change |
|---|---|
| `index.html` | Analysis provenance status; reconstruction labelling; Scores header, empty-filter state and competition control; `.brand` min-width; About-row layout |
| `.github/workflows/publish-picks.yml` | failure-reporting job; timeout 90 → 150 |
| `.github/workflows/staging-authenticated-acceptance.yml` | dispatch-only |
| `backend/fixture-delivery/staging-authenticated-acceptance.mjs` | fixture-freshness preflight |
| `test/analysis-pick-provenance.test.mjs` | NEW, 10 tests |
| `test/scores-slate-completeness.test.mjs` | NEW, 9 tests |
| `test/mobile-viewport-scaling.test.mjs` | NEW, 3 tests |
| `test/mobile-text-scaling-layout-defect.test.mjs` | NEW, 2 tests |
| `audits/release-acceptance/PUBLICATION-RIGHTS.md` | NEW |
| `audits/release-acceptance/DEVICE-ACCEPTANCE-S23-IPHONE.md` | NEW, operator checklist |
| `audits/release-acceptance/FINAL-INTEGRATED-REPORT.md` | NEW, this file |

No existing test file was modified. `index.html` remains pure CRLF (24,485 pairs, zero bare LF).

## 4. Independent review findings and dispositions

A separate reviewer, which wrote none of this code, reviewed `e6459ad..034bdd1`: it built its own
20-pick slate rather than reusing the authors' fixtures, drove the page directly, and ran **25
mutants** of the shipped functions against the authors' tests.

**Its verdict on the Analysis provenance work (`6216491`): sound.** It could not make it misreport,
lose a row, move a grade or write anything. All twenty grade chips are **byte-identical** between
baseline and head on its independent slate; row count identical; the only difference is the two
ungraded rows, where one undifferentiated `No pick` becomes a proven `No pick issued` and an honest
`No record`. 13 of 16 mutants of the new functions are killed by the authors' tests.

**Its verdict on the commit I integrated by hand (`034bdd1`): do not ship as integrated.** Two
high-severity accessibility regressions, neither reachable by any test in the suite.

| # | Finding | Severity | Disposition |
|---|---|---|---|
| F1 | `.brand{min-width:0}` paints the wordmark and PRO badge under the opaque status chip | HIGH | **FIXED, in two steps.** `.topbar{flex-wrap:wrap}`, then `.brand{flex-wrap:wrap}` after CI caught the badge still overflowing on a wider font stack. 0 occlusion and 0 sideways across 9 widths × 7 scales, local and CI |
| F2 | `.setrow.aboutrow .sd{white-space:nowrap}` reintroduces page scroll in Settings above ~140% scaling | HIGH | **FIXED.** The `nowrap` is scoped to `#verLabel`, the value only. Reproduced by me at 320px/140% (8px) through 320px/200% (117px); 0 after |
| F3 | The reload-with-retained-state test is vacuous: its assertions sit inside an `if` and nothing pins the retained filter | MEDIUM | **FIXED.** Two unconditional assertions added. The surviving mutant (`const cf = 'all'`) is now killed, verified |
| F5 | The `nostub` sentence names the results feed for a branch that is a competition without raw authority | MEDIUM | **FIXED.** Split into `nostub` and `noauthority` with its own truthful sentence |
| F6 | Mutation-proven test gaps: 4 mutants survived, including one tripling the badge padding | MEDIUM | **PARTLY FIXED.** New `test/review-regressions.test.mjs` pins occlusion, the About matrix, attribute integrity and the two unavailable states. The `loadArchive` throw path and a `nopick` slate case remain uncovered |
| F7 | `escapeHtml` does not escape `"` or `'`, while the new chip builds three quoted attributes per row | LOW (latent) | **FIXED.** It escapes both now. The reviewer ruled out any reachable public path; the raw publisher path had no client-side pattern on `pick` |
| F4 | A narrowed-but-non-empty Scores day still hides rows; the one-tap escape appears only at zero rows | MEDIUM | **NOT FIXED.** Defensible as designed, and it is a product call about whether partial slates get an in-feed escape. Director's decision |
| F8 | `recon` on presentation rows is dead, and a `build:-1` row would fail the whole edition rather than one row | LOW | **NOT FIXED.** The better fix excludes `build < 0` in the publisher's projection, which touches the migration. Availability-only, and only if a reconstruction lands inside the live window |
| F9 | One `loadArchive` exit left `_archiveRead` stale, and it is never reset on account change | LOW | **FIXED** for the early return. Not reachable with harm today, fixed so the invariant holds by construction |
| F10 | The live-match indicator now disappears under the Upcoming/Finished chips | LOW | **NOT FIXED.** Follows from "the header counts the rows below it". Worth a product view |
| F11 | `APP_BUILD` and `sw.js` `CACHE` both 357 while `index.html` changed | INFORMATIONAL | **Correct for an unreleased draft**, and the house convention: `98c2961` bumped 355→357 and six fix commits have shipped under it. Consequence to note: `mmVersionWatch` compares the served cache name against `APP_BUILD`, so no "Build N is available" banner fires and About reports "build 357" for two materially different documents. **Bump both before release** |

Four mutants had survived the authors' tests: one tripling the PRO badge's padding (which worsens
F1 massively), one neutralising the About row's wrap rule, one turning a failed archive read into
`'loaded'`, and one removing `escapeHtml` from the chip's attributes. The first two and the fourth
are now covered; the third is not.

## 5. CI results

**Build 357 integration** on `d6f787f`
([run 42503801086](https://github.com/kennedychinazam/matchmind/actions/runs/42503801086)):
**success, all five jobs green.**

```
combined (20.20.2)   # tests 261  # pass 261  # fail 0  # cancelled 0  # skipped 0
combined (24.19.0)   success
fence                10 probes + drift guard + negative control
postgrest            95 checks + negative control
hosted17             PostgreSQL 17, 10 fence + 26 hosted probes + negative control
```

261 = 233 existing + 10 provenance + 14 mobile + 4 review regressions. Nothing was skipped,
cancelled or excluded.

**CI caught a defect my container could not, twice over, and both were mine.** On `ef05d12` both
new tests failed only at 320 px and 361 px with 200% scaling. The first diagnosis was wrong: I
assumed an unrelated box, because the About-row probe reported `row overflow 0px, card overflow
0px` while the page scrolled 22 px. So I made both probes name the widest box crossing the right
edge (`5676f57`), and CI answered: `SPAN.pro right=342` against a 320 px viewport — **the badge
itself, inside the top bar**. Wrapping `.topbar` had put `.brand` on its own line, but `.brand` is
itself an unbreakable flex row. I reproduced it locally by pushing the root font-size to 36–44 px,
which reaches the same condition a wider font reaches sooner, and `.brand{flex-wrap:wrap}` fixed
it (`d6f787f`): badge right edge 381/415/449 → 84/90/95, page overflow 20/40/74 px → 0.

Two elements do still overflow at root 36 px and above, `BUTTON.nav-btn` and `DIV.bottomnav`, both
outside the top bar and both predating this round. They are below the committed matrix's ceiling of
root 32 px, so no test asserts them; they are recorded here and belong on the device checklist.

The staging authenticated acceptance workflow did **not** run, by design: it is dispatch-only now,
because the Director deleted `MM_STAGING_SERVICE_KEY` and on push it would fail at the
missing-secret step on every unrelated commit. Its passing evidence stands at
[run 42456545800 attempt 3](https://github.com/kennedychinazam/matchmind/actions/runs/42456545800),
`MATCHMIND_STAGING_AUTHENTICATED_ACCEPTANCE_PASS 54`. No privileged authentication test was re-run
and no key was requested.

**Failing-first evidence, both directions.** All 16 defect tests fail against the unmodified
baseline with specific measured messages, and pass after. Examples, verbatim from the before-run:

```
not ok - a proven withhold does not read as withheld: No pick
not ok - a post-match reconstruction was still graded with a tick or a cross: 1 ✓
not ok - the feed still blames whether the app was open
not ok - at root 16px the version string "MatchMind PRO · v0.9 · build 357" wraps onto 2 lines
         in 129 CSS px, so the build number breaks away from the word "build"
not ok - at 375 CSS px with the root font-size at 20.8px the page scrolls sideways by 2 CSS px
not ok - after a reload the feed rendered 2 of the 6 matches the day holds, because the retained
         competition setting (39) narrowed Scores. Header: "Updated just now · 6 matches".
         Chip: "🏆 All competitions ▾". The competition chip claims the feed is unfiltered.
```

## 6. Evidence that published predictions and historical accuracy are preserved

- **Immutability verified in code.** `unarchivePrediction` does not exist. No `.delete()` against
  `predictions` exists anywhere. The only three writers are `flushPredictionArchive`
  (`upsert … ignoreDuplicates:true`, insert-if-absent only), `withholdWrite` (touches only
  `withheld_at`), and `backfillPredictions` (publisher-only, manual button, stamps RECONSTRUCTED).
  Re-gating is gone: `f.gated = (started || arch) ? null : gateReason(...)` (`index.html:19629`).
- **No post-kickoff forecast can be created by a reader.** `kickoffPassed` guards every write site,
  and for presentation readers the gate pass is unreachable entirely: `index.html:19704` returns to
  `loadFixturePresentation()` before any `applyGatePass` call site, and a presentation league is
  built with `matches: []` and never fitted.
- **Accuracy is unchanged by the change.** A test asserts `recordLine` is byte-identical with and
  without 24 unissued fixtures present (`7/10 correct · 70.0%` both ways). `gradePick`, every
  threshold, `FORM_ADJ` and both ledger exclusions are untouched — verified by diffing the engine
  identifiers, where the only match is a comment line.
- **Row inclusion is behaviourally identical.** The Analysis filter keeps the same three
  conditions; only the counter increment was removed, and `noPickPlayed` now appears nowhere.
- **The rebuilt label removes a grade rather than adding one.** A `build: 355` row still renders
  exactly `1 ✓`; the reconstruction loses its verdict.
- `APP_BUILD` stays 357 and the service-worker cache stays `matchmind-v357`. Deployed `main` is
  **355** with cache `matchmind-v355`, so the cache name already differs from what installed users
  hold and a deploy would install the new worker and purge the old cache. No bump is needed.

## 7. Mobile acceptance: emulated and physical, separated

**EMULATED (executed, Chromium only).** S23 Ultra metrics at 360×772 dpr 3.5 and 412×915, in
browser mode and in a real `display-mode: standalone` Chromium app window, at 100% and 130% text
scaling: zero sideways scroll in every case, smallest hit-tested tap target 44 CSS px, smallest
font 10.9 px at default and 14.1 px at 130%. Plus iPhone 14, iPhone SE, Pixel 7 and iPad Mini
viewports booting with no errors and no sideways scroll. A test pins the absence of
`maximum-scale`, `user-scalable=no` and `text-size-adjust`, so no fix may take the reader's text
scaling away.

**PHYSICAL: none. No physical-device acceptance has been performed.** Nothing in this release is
evidence about real hardware.

**UNVERIFIED, and no claim is made about either: Firefox Android and iOS Safari.** This container
has only Chromium — there is no Firefox and no WebKit binary. The Director's Chrome-versus-Firefox
comparison is *explained* here by a measured width sensitivity in our own CSS, but the Firefox half
has not been executed anywhere.

`audits/release-acceptance/DEVICE-ACCEPTANCE-S23-IPHONE.md` is the operator checklist: Samsung
Galaxy S23 Ultra across Chrome browser, installed Chrome PWA and Firefox Android; a real iPhone on
Safari and as an installed PWA; Scores and Analysis consistency; refresh, login, favourites and
offline; readability and navigation; including the 100→110→100 zoom round trip the Director
reported and a by-thumb touch test. It states at the top that nothing in it has been performed and
that emulated results do not substitute.

Two standing observations recorded, not fixed, because neither was reproduced as a defect: the
favourite star is a 15×18 CSS px tap target, below the project's own 44 px floor; and there is no
`env(safe-area-inset-bottom)` anywhere while `.app` reserves a flat 84 px for the bottom nav, which
may put the Android gesture bar over the tabs on hardware.

## 8. Publication rights

Full assessment in `audits/release-acceptance/PUBLICATION-RIGHTS.md`. In short:

**Imagery is a non-issue, and it is enforced in source rather than asserted.** The published
payload carries no imagery field and no numeric id from which an image URL could be rebuilt;
presentation leagues are built with `logo:''`, `flag:''`; `THIRD_PARTY_BRANDING_ENABLED = false`
(`index.html:16957`) with no URL or storage override; cached provider logo URLs survive only as
numeric model input and reach no rendering sink; and `test/branding-rights.test.mjs` asserts in a
real browser that **no third-party image request is attempted at all**.

**The payload splits cleanly.** Provider-origin facts: fixture id, competition id/name/country,
date, time, status, elapsed, team names, scores, `updated_at`, `provider`. MatchMind-derived:
every prediction field, the board, the engine and CLV records, the slips.

**The one open question, which is a licence question and not an engineering one:** does the
API-Football subscription permit redistributing fixture identity, kickoff times, team and
competition names and scores to MatchMind's own end users, as opposed to internal use? It needs the
subscription terms read. **No provider was contacted and none is authorized.** The active
subscription, routine renewal and the 10 November internal pilot are **not** reopened as launch
blockers.

Unresolved for the Director: the licence reading itself; whether the bounded edition should be
readable anonymously or only by signed-in accounts; and whether to add visible provider attribution
as a precaution.

## 9. Tasks genuinely requiring Director action

1. **Physical-device acceptance.** Work `DEVICE-ACCEPTANCE-S23-IPHONE.md` on a real Samsung Galaxy
   S23 Ultra and a real iPhone on Safari, including both installed PWAs. Nobody else can do this,
   and no emulation substitutes. While you are there, record each browser's reported viewport width
   on the S23, which settles the Chrome-versus-Firefox comparison outright.
2. **Read the API-Football subscription terms** and answer one question: may MatchMind redistribute
   fixture identity, kickoff times, team and competition names and scores to its own end users? No
   provider enquiry is needed or authorized to answer it.
3. **Decide the daily blackout** (section 2.9). My recommendation is re-scoping the edition window
   to the product's own day in all three places. It needs your approval because it touches the
   migration, and a staging installation to verify.
4. **Decide anonymous reach**: should the bounded edition be readable by anonymous visitors, or
   only by signed-in accounts? The mechanism supports either and no decision is recorded.
5. **Optional, two one-line calls.** SHA-pin `actions/checkout@v4` and `actions/setup-node@v4` in
   the workflows that hold credentials (I cannot resolve a trustworthy SHA without reading a
   repository outside this session's scope, and guessing one breaks CI). And say whether you want
   the two code comments that quote the removed false sentence paraphrased; they currently document
   what was removed and why, which is the house style.

Not needed from you: the staging administrator key. It stays deleted, no privileged authentication
test was re-run, and the acceptance workflow is dispatch-only so it will not ask for one.

## 10. Recommendation: NO-GO for public release

The engineering candidate is in good shape and the defects the Director raised are fixed with
evidence. Four things are outstanding, and three of them are not engineering's to close.

**NO-GO**, for these reasons and no others:

1. **No physical-device acceptance.** Emulated Chromium is not a Samsung and not an iPhone, and
   Firefox Android and iOS Safari are entirely unverified. Needs an operator with the hardware.
2. **The publication-rights licence question is open.** Needs the subscription terms read.
3. **The daily edition blackout** (section 2.9) is a user-visible defect I did not fix, because
   every available mitigation is something the Director ruled out or did not authorize.
4. **Three open review findings** are product decisions rather than defects: F4 (whether a
   partial Scores slate gets an in-feed escape), F8 (whether the publisher should exclude
   `build < 0` rows when projecting, which touches the migration), and F10 (whether the live
   indicator should survive a status filter).

The independent review itself is **complete**, and its two high-severity findings are fixed and
re-verified independently of the reviewer's own numbers.

What would make it a GO: the device checklist completed on real hardware, the licence question
answered, a decision on the blackout, and `APP_BUILD` plus the service-worker cache name bumped at
release.

## 11. One thing I got wrong in this round, recorded rather than buried

I got the same change wrong twice, in two different ways, and neither was caught by me.

**First**, I accepted `min-width:0` on `.brand` as sufficient because I measured the page's
horizontal scroll and saw zero at every width and scale. The fault was occlusion, not overflow, and
my measurement was blind to it, so a change I signed off would have shipped a missing PRO badge to
every reader at 375 CSS px and above, including at the default text size. **The independent review
caught it.**

**Second**, my fix for that was itself incomplete: wrapping the bar left `.brand` an unbreakable
row, so the badge still ran past the edge on a wider font stack than this container has. **CI
caught it**, and only after I changed the test to name the offending box rather than assume one. My
first diagnosis of that CI failure was also wrong: I blamed an unrelated element.

Two lessons, both now encoded in `test/review-regressions.test.mjs`: measure what the reader can
see, not only what the scrollbar admits; and when a test fails, make it name the thing it is
accusing before accepting any theory about it, including mine.
