# Independent review of Director restoration work

Reviewer: specialist Agent 6. Review baseline `d624081f87cd441ea339ac8fdafcc72e2748c130`. This report distinguishes source approval for isolated staging from hosted acceptance and completion of the Director's full request. Production release is not approved.

## Defects returned to implementation agents

| ID / severity | Reproduction and affected files | Required correction / result |
|---|---|---|
| H1 / High | Open a fixture with approved market rows through an issued Tips selection. `index.html:renderPublishedAnalysis` gated goals, combos, HT/FT, scores and scorers on `kind==='prediction'`, hiding available fields. | Corrected by `d969c66`: match analysis remains visible beside the separately identified issued selection; its hero probability is unchanged. Source and generated-preview regressions pass. |
| H2 / High | Publish `card.analysis` to the original staging reader while an old tab/service worker remains open. Its closed schema rejects the new field. `staging/mirror/STAGING-analysis-up.sql`, `staging/build-real-preview.mjs`. | Corrected: permanent v1 strips only analysis; additive v2 returns it. Exact original predictions, edition identity, privacy and old-reader byte limit are tested. UI-first deployment alone was rejected as insufficient. |
| M3 / Medium | Open an issued pick whose original 1X2/xG fields are null but whose approved informational board fields exist. Renderer omitted them because a pick existed. | Corrected by `d969c66`: valid original fields take priority; otherwise approved informational fields display with a separate-source label, without replacing the issued pick probability. |
| H4 / High | Click an actual finished/live Scores row. `matchDetail()` hid football-analysis panels, unlike direct calls used by the original new tests. Scores before league loading also lost bounded card fields. | Corrected by `4dda6df`: bounded Scores cards retain approved fields; finished/live public detail uses the published renderer and bounded history reader. Actual row-click regressions added at 320/390px. |
| M5 / Medium | Render a supported long AI model source. The supporting publication/source caption occupied three lines at both 320/390px. `index.html:#verdictBox`. | Corrected by `4dda6df`: visible publication caption is concise; full timestamp/source remain accessible metadata. Only actual AI prose is exempt. Independent failing screenshots are retained outside Git. |
| H6 / High | Delay the finished Scores history read, switch to More, then resolve the read. On `9958a45`, the late completion incorrectly changed `curView` from `data` to `detail`. `index.html:matchDetail`. | Corrected by `6eadfd6` (integrated `55a3256`): request generation, origin view, navigation epoch, client/account identity and account epoch are checked after the await. Independent delayed-navigation reproduction now remains on More. Focused actual Scores/late-read/account/latest-request checks pass. |
| H7/H8 / High | Real-font, real-source scans found three-line hero/result labels at 320px, including Chongqing, Western Sydney and Guidonia; later all-card inspection found Borussia Mönchengladbach and Hemel Hempstead Town at 320/390px. Browser-runner font metrics also exposed Brighton. `index.html` detail CSS/renderer. | Corrected by `c85bc28`, `c00bcaa`, `513ae4c`: complete long labels receive space above their value/track, and marked hero names wrap across two lines. No names/probabilities are clipped, abbreviated or recalculated. Final independent scan of all 776 captured fixtures with original Inter returned zero violations at both widths. |
| M9 / Medium | Open Search from Analysis, jump Back two entries, then Forward. The restored Analysis root was inert while Search was hidden. Direct Forward jumps into Search also failed to restore its originating base view. `index.html:onBack`. | Independently reproduced, then corrected by `95aa454` (integrated `30d067f`): modal inertness is removed before capturing a view, and skipped base views use existing owner/edition-checked restoration. Independent standalone reproduction and both new browser-history tests pass. |
| R1 / High, operational | A legitimate issued Tips row contains three frozen lists of 30. The original 40-leg accumulator limit rejected all 90 entries and stopped the scheduled refresh before deployment. Closed contract, staging SQL and mirror readback. | Corrected by `18b98ee`: only Tips admits up to 90, with recognized tabs, unique ranks 0–29 and at most 30 per tab; other tiers retain 40. V2 preserves every original entry. V1 omits the whole unsupported row and never truncates legs. Exact reviewed staging migration and 29 PostgreSQL assertions pass. |
| M1 / Medium, isolated preparation | Supply inconsistent `results` or absent/partial pagination to `backend/international/discovery.mjs`; incomplete captures were accepted. | Corrected by `532d332`: exact result count and explicit one-page completeness required. No live ingestion is connected. |
| M2 / Medium, isolated preparation | Reuse an arbitrarily old catalogue/fixture capture. The offline discovery prototype accepted it as verified evidence. | Corrected by `532d332`: explicit positive capture-age budget required, including revalidation of original catalogue capture. No production refresh interval is invented. |
| M4 / Medium, research | Reopen official API-Football pricing: current direct page showed 16/26/36 monthly prices, while report said 19/29/39. | Corrected by `f22dbdc`, with dated public-price evidence and account/currency/VAT caveats. |

The initially proposed 4096-character AI limit was also returned for correction: the existing authorized cache shape permits 32768. More importantly, inspection of the deployed writer showed arbitrary authenticated prompts could populate the cache. Raw cache projection was rejected entirely. Default collection now neither reads nor publishes it; a future exact-content/fixture-identity approval mechanism remains inactive.

## Independently executed checks

- Baseline: 26/26 browser regressions passed despite the missing panels. This demonstrated why those existing assertions alone were insufficient acceptance.
- Integrated restoration: 65/65 actual registered tests passed, including 24 source/generated detail cases, public/mobile behavior, closed projection, immutable vectors and immutable engine-region hashes. Network traffic was intercepted.
- Integrated native navigation with the v2 mock: 19/19 cases passed at 320, 390 and 1280px. Checks cover Scores, Analysis, Tips, Favourites; exact dates, filters, order and scroll; repeated Back/Forward; in-app Back; detail identity/accordion state; late archive responses; expiry/account changes; reload and ordinary external Back. The first integrated attempt was cancelled after finding an outdated v1 mock and was not counted as a pass.
- Data/SQL: 13/13 actual registered tests passed, including one local PostgreSQL integration test with 24 focused SQL assertions. The pinned PostgreSQL 16.6 container used `--network none`. Up/down scripts preserve stored edition hashes, reject malformed/private values, preserve privacy and enforce both byte budgets.
- Isolated international preparation: 9/9 cases passed independently after M1/M2 corrections. This approves only the disconnected offline preparation module.
- Final H4/H6 focused rerun: 14/14 actual registered tests passed on integrated `55a3256`, covering actual Scores row clicks and obsolete read cancellation in source and generated preview. The separately authored delayed-read reproduction now reports `expected=data, before=data, after=data`. The separately authored long-source reproduction now reports one displayed caption line at both widths.
- Independent theme suite: 4/4 tests passed, each exercising light and dark themes at 320/390px against source and generated HTML. All nine panels remain visible, original values/country caption persist, ordinary fields fit two lines, no overflow occurs, and primary text contrast is at least 4.5 against its rendered background. Theme colors actually change. Screenshots were captured and inspected.
- Repaired-source independent run: 49/49 tests passed, comprising PostgreSQL (29 focused assertions), complete issued-Tips/readback, public-reader boundaries, 19 native-navigation cases and 12 Search cases. An earlier consumer-suite invocation lacked `MM_TEST_CHROMIUM`; it was rerun with the required local executable and passed.
- Final multi-entry Search jump tests: 2/2 independently passed on `30d067f`. The independently authored standalone reproduction now returns `view=predict, inert=false, overlay=false`.
- Final actual-font scan used the GET-only approved capture dated `2026-11-14T13:54:07.141Z`, 776 cards, source-wire SHA-256 `58ba2568f28cb1551257671b94a861c78bff7deecf88337e1e386c30d00afe16`. All ordinary detail fields were scanned at 320/390px with locally replayed original Inter. Zero violations remained on `46ee287`; the later M9 change touches navigation only. This replay is not hosted acceptance.
- The lead's expanded offline candidate gate was also inspected: 140/140 passed before the last focused two-history-jump correction. Final hosted/CI results must identify the exact pushed head.
- Additional independent long-source layout reproduction found M5. Additional delayed-history reproduction found H6. These were not inferred from agent reports.

Chromium needed an approved outside-sandbox local socket because the sandbox's crashpad `setsockopt` was denied. Those executions did not permit live provider/database requests in the browser tests. Node's `--test-isolation=none` was used for actual registered test counts; file-level runner totals were not substituted.

## Reviewed staging migration

Approved only for the existing isolated staging project `rdcbnvfnxenrpnnwxszs`:

- Up SHA-256: `6a4f58ace1696d47f71124a32fb71ed4d80bbc84813c08f1a2fbd336e3506c4d`.
- Down SHA-256: `8237a49858ad551694f05cc546fe755ef2c8ac1ad279340cdf8885629bb6c1e7`.

Full projection/storage cap is 1 MiB, still at most 1000 cards. The complete legacy projection independently remains at most 512 KiB in JavaScript and SQL. v1 permanently strips optional analysis; v2 is an additive security-invoker facade over the existing expiring, bounded reader. The private writer's token gate and grants remain unchanged. Rollback makes v2 delegate to compatible v1 while retaining additive schema and immutable editions. No production schema/publisher or archive change is approved.

Additional issued-Tips migration approved for staging only: `STAGING-issued-tips-up.sql` SHA-256 `cdb1bdc2c703089f247615e49c838c8d22948e5b472b4c6101cc2dde1b155683`. Full v2 equality, v1 whole-row omission and rollback preserving immutable editions were independently exercised. Old v1 tabs cannot render the complete 90-entry Tips bundle until they reload into the new UI; full Tips availability is not claimed for those tabs.

The preview workflow's offline candidate gate before source fetch/mirror writes is acceptable: it preserves the staging environment, cron and deployment permission boundaries and fails before replacing the last good mirror when focused checks fail. Hosted post-deployment acceptance remains necessary.

## Research assessment

Primary sources were independently reopened to verify article examples `1/2026`, `5/2018`, `32/2024`, `10/2026` and club-friendlies ID `667`; these are not a live catalogue or fixture receipt. Official FIFA association evidence identifies date-only editions of 7 October and 20 October 2026; exact publication times, complete ranking points and a current ingestible dataset remain unverified. The AFC schedule announcement explicitly leaves FIFA approval pending. The report accurately keeps unknown coverage, bookmaker availability, squads, costs/account terms and model validation open.

No new international prediction activation is approved. Senior women, youth, CHAN and club friendlies need separate cohort/eligibility/data validation; a provider prediction flag or club-league fallback is insufficient.

## Scoped source decision

**Approve final runtime candidate `30d067f` and the reviewed exact staging migrations for a controlled deployment to the separate development preview only.** Earlier scoped approval of `55a3256` was superseded when broader CI and actual-font/current-data checks revealed additional defects. H1/H2/M3/H4/M5/H6/H7/H8/M9/R1 are now corrected and their relevant independent checks pass. This is permission to proceed to hosted post-deployment acceptance, not certification that the hosted site already passes. The additive independent theme tests change no application behavior.

No production merge, production deployment, unsupported model activation, historical forecast regeneration or settlement-ledger activation is approved. Keep PR #28 draft.

## Evidence and remaining acceptance

Archived actual hosted Build 358 screenshots/network JSON at commit `d624081` were inspected under `/workspace/matchmind-evidence/baseline-preview/acceptance`. They confirm the Leganes–Burgos detail showing only the result panel. New local screenshots under `/workspace/matchmind-evidence/independent-ui` use explicitly synthetic approved-field fixtures; they prove rendering behavior, not actual hosted availability. Navigation screenshots are under `/workspace/navigation-evidence`.

Direct access to the actual Build 355/preview host remains blocked by environment HTTP CONNECT 403. No new hosted acceptance is asserted by this source review. Actual Build 355 comparison captures, final staging screenshots and recorded staging network behavior must be reviewed after the controlled preview deployment, through hosted workflow evidence if direct access remains blocked.

Physical Android Chrome and Samsung Internet hardware acceptance has not occurred. Firefox installation was attempted by the navigation specialist but its official download domains returned policy HTTP 403; desktop Chromium emulation is not Firefox or Samsung acceptance.

The full request remains incomplete while approved publication of original goals/combo/HTFT/correct-score/scorer distributions, complete standings and grounded AI text is absent. The renderer now has honest per-panel states rather than inventing values or refitting old forecasts. Publishing unsupported markets, certifying unavailable international coverage or declaring real-device/hosted checks complete is not approved.
