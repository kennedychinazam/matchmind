# MM-03 local preview and artifact review — 26 November 2026

Primary accepted the local identity repair and acceptance-harness corrections. Hosted staging remains unaccepted and unavailable; this report does not close that deployment prerequisite.

## Identity repair

Before repair, six of eight deterministic source/real-preview mobile-click cases failed. A Scores cache disappearing could bypass the optional cache identity check, and an existing same-fixture league row could supply an unproven prediction. Scores now retains the exact accepted envelope with its rows, independent of later screen-map changes. History claims must match that selected edition/as-of and fixture identity. The detail path no longer borrows a league prediction, and publishes its history-enriched row only after account/navigation checks pass.

Mismatched history shows **Published pick unavailable** while retaining the selected fixture's informational **51/29/20** vector. Same-edition controls retain the issued **75% DNB** claim and original **60/20/20** vector even after screen-cache clear/replacement. No model, grading or stored forecast was changed.

## Verification

- Primary cumulative acceptance: **219/219 passed**, no failures or skips. Includes storage/account recovery, cache, publisher, bounded source, issued tips, consumers, navigation, source/real-preview details and PWA lifecycle.
- Primary corrected fixture UI suite: **19/19 passed**, no failures or skips.
- Primary independent mirror browser/build checks: **8/8 passed**, no failures or skips in the selected non-SQL checks.
- PWA receipts and local QA preview match exact final source SHA-256 `e330b7d8ae8e2165cd675454be95aa687834293fe0c1679eb667e4b638cd788d`. Generated QA preview index SHA-256 `b50f00c044ecc194200b929e59e360346fc8712093d45d72a207873cfc711371`.
- Primary inspected actual 320-pixel source/preview Scores-click screenshots. Fixture identities, informational vector and unavailable-claim state fit without sideways overflow. Offline-cache toast/sample badges reflect the deliberately isolated synthetic harness; they are not measurements of deployed behavior.

Windows mirror tests now use `fileURLToPath`. A swallowed original-vector/identity assertion was restored after a historical inline comment. Docker setup is scoped to the two SQL tests rather than blocking unrelated browser checks. Those SQL cases remain **unrun here**, because their Linux Docker socket is unavailable; no SQL pass is claimed.

Four additional UI failures reproduced against exact pre-MM-03 accepted source SHA-256 `671d133c1c8f9b68aac2eb1a3df1ec6bf2a69df274ff8d86bbbcfe283cb2d1a7`. Test-only corrections target the intended display RPC, await match-context completion, select the fetched fixture's actual local Scores day and navigate before rendering. Probability, identity, no-refit and no-raw-read assertions remain active.

The byte/card test now explicitly preserves the owning handover's distinct reviewed policies: production browser **3,000 cards/4 MiB**, current staging mirror/materialization contract **1,500 cards/2 MiB**. It verifies the shared range, production-only range, rejection above the production limit and shared rejection of nested unapproved data. Neither runtime bound was changed. Broader MM-08 contract/diagnostic consistency remains open.

Receipts: `work/v6-final-acceptance.log`, `work/v6-final-pwa-evidence.json`, `work/mm03-primary-ui-acceptance.log`, `work/mm03-primary-mirror-acceptance.log`, `work/mm03-before.log`, `work/mm03-accepted-baseline-ui.log`. Superseded expanded runs include the unavailable Docker hook and test setup failures; they are retained, not relabelled as clean runs.

## Hosted read-only observations and remaining gate

On 26 November the approved five-screen production source validated at 1,342 cards, 303 predictions and 688,613 compact payload bytes. Source edition `f101e707-1482-4a8e-8644-1f96ad1a9a54` had source as-of 09:03 UTC; the read-only validation ran at 09:05 UTC. This point-in-time validation is not a staging publication receipt. A later public Scores observation at 09:19 UTC saw a fresh production edition, while staging status returned JSON null and staging Scores still returned HTTP 500 / `P0002` / `Verified real-data mirror unavailable`.

No raw anonymous table access was reopened. No writer token was used or retrieved, no backend SQL was installed, and no refresh/deployment occurred. The current mirror README now distinguishes the bounded public-RPC repair from obsolete GET/raw-reader instructions.

Fresh hosted staging still requires a reviewed source commit, protected environment verification, separately authorized staging refresh/Pages publication, destination readback, exact deployed hashes and actual consumer/mobile acceptance. Original-logo hosted builds and release build assignment remain publication gates; local `--qa-no-logos` and APP_BUILD 368 are QA evidence only. Real-phone acceptance remains separate.

**Next job: MM-04 capacity prevention**, limited to read-only measurement and a plan while the fresh-staging prerequisite blocks broader source changes. No claim is made that all MM-03 hosted requirements are complete.
