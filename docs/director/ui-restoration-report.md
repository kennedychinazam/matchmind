# Match-analysis UI restoration: Agent 1

Status: the bounded public detail interface is restored; complete Build 355 data parity and actual hosted Build 355 acceptance remain unverified. This report does not approve production release.

## Changes

- Reused the existing Build 355 detail shells and ordering: result probabilities, goals, combos, half-time/full-time, correct score, likely scorers, form/head-to-head, table and Professional AI Write-up. Each unavailable panel has its own concise state.
- Fixed both rendering layers. `index.html` previously cleared the rich panels through `showNoAnalysis()`. `staging/published-forecast-view.mjs` then replaced the source renderer and hid them again. Both now use `renderPublishedAnalysis()`.
- Removed the real-preview transform that hid result analysis unless a qualifying pick existed. Informational 1X2 and expected goals remain available without an issued pick.
- Kept issued selections, original probabilities and fixture identity distinct from football analysis. Tips/slip contexts retain their own issued hero badge while displaying the fixture's separately identified analysis. A missing original 1X2 vector can use an explicitly labeled approved informational vector; it never supplies a locked-pick probability.
- Preserved accepted bounded cards when Scores loads before competition leagues. Finished/live Scores clicks now use the same public analysis renderer and bounded history read for the issued record. Private raw-authorized match-centre behavior remains separate.
- Canceled obsolete Scores detail reads after navigation, account/client changes or a newer detail request. Captured edition identity is checked before combining a history result with Scores data.
- Kept compact badges, favorite positions, genuine catalog crests and competition logos. Restored the competition/country caption. Supporting AI provenance displays a short publication date with the full source/timestamp available as accessible metadata.
- Changed only generated preview reads to `mm_preview_display_v2`; the logical application RPC and status v1 remain unchanged. Agent 2 owns the compatible backend wrapper.

No prediction engine execution, market generation, historical forecast regeneration, paid AI/provider request, production database write or deployment was performed by this agent.

## Review corrections

| Reviewer finding | Correction |
| --- | --- |
| H1: issued-slip context hid approved fixture market panels | Removed selection-kind gating; retained explicit separation between fixture analysis and issued selection. |
| M3: an issued record with null original 1X2/xG hid approved informational inputs | Prefer original inputs when valid, otherwise show labeled approved informational inputs. |
| H4: finished/live Scores used a separate route that hid analysis | Preserve the bounded Scores card and route public detail through the published renderer; added actual row-click tests. |
| M5: a long AI-source identifier exceeded two displayed lines | Concise publication caption; full provenance in accessible metadata, without text clamping. |
| H6: delayed history read reopened detail after navigation | Added request, navigation and account-context guards; reject cross-edition identity mixing. |

Final independent acceptance belongs to the reviewer and integration lead.

## Focused verification

`test/published-detail-restoration.test.mjs` contains **40 tests**, covering source and generated real-preview HTML at 320px and 390px. The integration lead reported **40/40 passing** on integrated candidate `55a3256`. Cases cover issued/no-pick/missing/completed-DNB states, issued-slip analysis, informational fallback, actual finished/live Scores row clicks, concise text, long AI-source identifiers, overflow, unchanged source values, no model refit, delayed navigation/account cancellation, repeated clicks and cross-edition reads.

The updated existing `director-mobile-display` and `public-analysis-visibility` suites passed **14/14** during this agent's focused verification. Later 16-case, 8-case and 4-case targeted runs are subsets of the 40-case suite and must not be added as extra unique tests. The integration lead owns the final combined test and CI counts.

Browser evidence is offline Chromium on `/usr/bin/chromium`. It is not physical Android Chrome, Samsung Internet or Firefox acceptance.

## Real-data screenshot evidence

Artifacts are local workspace evidence, not committed application assets:

- Before: `/workspace/matchmind-evidence/baseline-preview/acceptance/real-preview-{320,390}-detail-published.png`. These are archived actual hosted Build 358 captures for baseline commit `d624081`, recovered by the integration lead.
- After: `/workspace/matchmind-evidence/ui-real-replay/{320,390}-{1570019,1647948}-{compact,expanded}.png`.
- Evidence/provenance: `/workspace/matchmind-evidence/ui-real-replay/{320,390}-evidence.json`.
- Build 355 styling comparison: `/workspace/matchmind-evidence/ui-real-replay/build355-source-css-{320,390}-{1570019,1647948}.png`.

After screenshots replay the actual approved read-only source projection captured **2026-11-13T22:03:33.298Z** from `/tmp/mm-data-analysis-complete.json`. They are explicitly labeled **LOCAL REPLAY**, and must not be described as current live or hosted acceptance. Original crest/logo assets and the captured Inter font were used. No live provider/database request occurs during replay.

| Actual fixture | Available evidence |
| --- | --- |
| Leganes–Burgos, fixture 1570019 | Completed 3–1; original U3.5 badge around 81%; original displayed 1X2 39.7% / 34.1% / 26.2%; expected goals 1.05 / 0.80; form LLDLL / LWWDW; one prior meeting. |
| Dijon–Orleans, fixture 1647948 | No qualifying issued pick; approved informational 1X2 26.8% / 24.9% / 48.4%; expected goals 1.29 / 1.79; Dijon form absent, Orleans form WWWL; no prior meeting in the bounded source projection. |

Both widths showed all nine expected accordion IDs, genuine crests, no recorded runtime errors and no horizontal overflow in the replay.

The actual Build 355 website could not be opened: the environment proxy returned CONNECT HTTP 403 for `kennedychinazam.github.io`. The Build 355 comparison PNGs use the original `036f09b` source CSS with scripts removed and the same approved replay content mapped into its static detail DOM. They are labeled **SOURCE CSS / LOCAL RECREATION**. They do not recreate the original Build 355 model outputs, establish original full-panel parity, or replace actual hosted reference acceptance. No screenshots were supplied directly by the Director in this thread.

## Remaining data and acceptance gaps

Agent 2's approved projection supplies original issued values, approved board informational result/xG and bounded historical form/H2H. Current market outputs for goals, combos, half-time/full-time, correct score and scorers are not approved persisted published records. Their renderer support is present, but actual data remains unavailable pending an authorized private publisher and independent validation. A complete trusted league table is also absent.

The existing AI cache was not a grounded, fixture-bound approved write-up source. It is excluded from active publication. The renderer supports a future independently reviewed published write-up; current real fixtures accurately state that no AI write-up was published.

Full Build 355 analysis restoration therefore remains incomplete at the data/publishing boundary. Actual hosted preview verification, actual hosted Build 355 comparisons and physical-device acceptance remain the integration lead's outstanding acceptance responsibilities. No production merge or deployment is authorized by this report.

## Implementation commits

Agent 1 changes: `db020d2`, `d969c66`, `4dda6df`, `6eadfd6`. The integration lead cherry-picked these into the development branch. This documentation commit is separate; no application behavior changes accompany it.
