# Phase 8 — supervised weekend testing and release preparation

**Operational result:** 145 genuine fresh private Build355 probability forecasts were generated and stored before kickoff on Saturday October24. **AI forecasts:0; actual AI expenditure:$0.00.** A supervised result poll has executed; all145 outcomes were pending at15:13 UTC. No predictive improvement, profitability, completed weekend study or launch approval is claimed.

Phase8 is on `codex/phase8-weekend-testing-ai`, based exactly on Phase7`19c9a30`. Production Build355, the original72-hour publication rule and separate48-hour postponed-match void rule remain unchanged. PRs#1–#4 and protected branches are preserved; none is merged/deployed. The new Phase8 draft targets Phase7. Its final head/CI links are recorded in PR metadata and the delivery response.

## What genuinely executed

See [aggregate evidence](results/2026-10-24-supervised.json); no individual forecasts, source packets, credentials, private backend source or dumps are published here.

| Event | Verified result |
|---|---|
| Source export completed | October24,14:46:03UTC;100.651seconds;93,680rows;55fixed engine competitions;29,150,972raw bytes |
| Local study / packet receipt | 14:47:14.966130 /14:47:17.743598UTC |
| Exact engine generation | 14:47:54.603UTC |
| Forecast persistence | 14:47:55.848966–14:49:03.267821UTC |
| Independent completed-batch database witness | 14:49:05.265336UTC, before **every** target's earliest15:00UTC kickoff |
| Private fixture roster | 145:54Saturday kickoffs,91Sunday kickoffs, all issued in Saturday's observation window |
| Public gate result retained | 86eligible;35low,23nobase,1outofscope. Withheld probability outputs are private diagnostics, not public betting recommendations |
| Original published contexts | 83; all before collection;62targets had no original context |
| AI arm slots | 435blocked failures, retained in the denominator; no inference or reservation |
| First actual result poll | 15:13:16.630992UTC;145pending,0scored,0void,0invalid/ambiguous labels |
| Initial research relations/indexes | 8,568,832bytes (~8.17MiB), under unchanged262144000-byte ceiling |

The frozen real engine outputs replay exactly at the recorded clock. This replay is a diagnostic, **not a newly issued forecast**. The actual private backup restored145jobs,725arm records and the93,680-row source packet; all event hashes and the packet hash matched. Ordinary-role denial, immutable data and zero local public prediction rows were verified. Production data was read only; the production publisher/collector and real API-Football were never executed.

## Before and after

Phase6/7 supplied isolated snapshot evaluation and synthetic-only xgEdge training. Neither reran the Build355 publisher engine, and neither established a usable historical football training set.

Phase8 adds a separate `weekend-v1` receipt-now experiment. A complete declared source projection is read via existing public Data API GET permissions, frozen in private local PostgreSQL, then supplied to the unchanged whole application in fresh network-blocked Chromium. The runner substitutes **only persistence boundaries**, leaves `supa/authUser`null and runs the actual `fxPredict`, league-specific dampening/shrink, cross-competition history and `applyGatePass`/board-capture calculations. Originals are stored separately from the scratch refreshed archive, preventing an old frozen pick from masquerading as a new selection. No duplicate engine, xgEdge replacement or new statistical setting is introduced.

Full application SHA256 is `c915f9820c363786f4848ba6ba0f935a100a03f4507505c3b3bf029357e29b10`. The actual engine wrapper hash is recorded in the aggregate; `index.html` is byte-identical to the Build355 development baseline and production recovery source. All required60-month goals/identity/date/season history in the fixed55-ID scope is retained, including resting competitions and same-day settled matches. Additional collected xG is present on20,577rows; injuries include observed empty values. Unrequested advanced statistics/lineups are unavailable to this experiment, not invented. No full-M14 activation or football training is claimed.

The input order is deterministic date/fixture ID, with a fresh context per packet to avoid same-count correction caches. It does **not** establish equality to every live device's historical cache/order/state. Page reads are non-atomic as-collected reads with explicit inventories and hashes; mutable `updated_at`/legacy odds capture times do not become historical first receipts. Genuine local server receipt-now precedes new generation. Historical originals are contextual because no at-issue immutable receipt capture is proven for them.

The initial whole-scope hosted count failed; a separate metadata/policy query also timed out. Both failures were recorded, with no partial dataset accepted. Narrow per-competition inventory/keyset reads then completed the entire required scope; no competition/history was cut to obtain success. The source export uses existing stored data, not additional API-Football calls. Future exports incur roughly another measured cold-read payload, so avoid unnecessary continuous polling.

## Private storage, spending and inference

An additive RLS-protected immutable event table in `shadow_eval` stores typed study→packet→job→forecast/label/reservation relationships, original values, hashes and server receipts. Ordinary application roles and shadow runners cannot read/write it. Repeated identical registration is idempotent; changed contents conflict. All tables share inherited quota accounting and lock. Missing/failed AI arms remain explicit. A separately versioned private dataset is used; the old production AI table and pause flag remain untouched.

Owner steering supersedes Gemini activation: no durable runner; supervised runs only; Gemini unfunded and its required deposit declined; OpenAI/Kimi/OpenRouter are configurable but **not selected**. [AI_AND_MANUAL_CI.md](AI_AND_MANUAL_CI.md) records inspected provider architecture, current documentation, spending safeguards, account/network blockers and the inert manual-CI template. Paid transport is disabled for every provider. Request shapes and response validation are prepared, not API-certified integrations.

A1 preserves the existing capped context/market calculation; A2 is a veto with separate response/actionable coverage; A3 is explicitly independent of engine/bookmaker probabilities. Frozen input/prompt/model/configuration/request identities are required for future trials. Uncited information abstains; no grounded news request is enabled. The synthetic-only spending proof reserves worst-case liability before dispatch under one$5 ledger, retains failed/unknown charges and prevents duplicate dispatch. A new database or disposable runner cannot certify cross-run budget continuity; a selected provider, verified pricing/limits, secure key and durable carry-forward/provider cap are still prerequisites. Actual spend is exactly zero because no provider calls occurred.

## Independent review and corrections

Independent technical review of `bc242fe` found:

1. A timestamp captured before waiting on the quota lock could admit a write after kickoff with an earlier receipt. Reproduced with a held database lock, then fixed with fresh post-lock/post-insert checks and a **separate post-commit confirmation transaction**. Unconfirmed/late commits are visible failures; reservations also require confirmation before dispatch. Saturday's earlier run is independently unaffected: its completed-batch witness precedes the earliest kickoff by over ten minutes.
2. Rejected AI lineage could still count toward coverage and cost-per-success. Reproduced and fixed: usable forecasts and successful-forecast costs now derive from the same timestamp/probability/input-lineage admission; timely responses are reported separately. Saturday's all-failed AI counts are unaffected.

Additional regressions prevent outcome-poll backup-chain forks, nonpositive bookmaker timing eligibility and original-context48-hour anchor drift. New scripts select an explicit verified predecessor dump rather than silently overwriting/forking correction history. Private-path guards reject symlinks and repository names beginning with`..`. No material finding demonstrated that Saturday's145forecasts were invalid. The review did not certify hosted integration, actual provider billing or permanent storage.

## Combined release candidate and tests

Phase7 already inherited Phase3/4/6 and selective Phase5 scoring. Phase8 restores exactly the ten missing additive Phase5 paths from`f56caab` and pins their blob provenance in [release-manifest.json](release-manifest.json). It does not merge any PR or overwrite newer Phase3/4 files. One restored read-only SQL extractor adds nonnegative-score guards, proven against malformed synthetic rows; retained historical result files remain unchanged and are not presented as a new audit/holdout.

Final combined suites: **198/198 on Node20.20.2 and198/198 on Node24.19.0**, zero failures/skips. See [verification evidence](results/2026-10-24-verification.json) for commands/durations/hashes. This is an actually combined Phase3–8 audit suite, including both previously absent Phase5 tests, not a claim of a merged production deployment. The codebase's complete applicable audit command was run; broad authenticated product behavior remains a hosted release gate.

Coverage includes exact public-source identity, real72/48-hour boundaries, full engine/gate numerical parity, K8/K32 settings, cross-competition/resting inputs, same-day/AET regulation handling, missing data, same-count corrections, fresh contexts, source pagination/completeness, pre-kickoff persistence/lock waiting/commit confirmation, original immutability, duplicate/conflicting forecasts, failures, private grants/quota, concurrent total-budget admission/retries/restore, AI independence/lineage, encryption/tamper rejection, report pairing/calibration/coverage, original void anchors and local rollback. All inherited snapshot/publisher-failure/M14/SmartBet-offline regressions continue to pass. No real private forecast or provider credential enters automatic CI.

## Reporting and remaining feasibility limits

The Monday-ready report calculates multiclass Brier/log loss,1X2 accuracy, home/draw/away calibration and ranking diagnostics, identical-job market/model comparisons, competition/window strata, missing/failed/abstained/veto counts and cost per verified AI forecast. Current metrics are null because no eligible outcome has been collected. Bookmaker evidence must have a genuine receipt before issue, positive pre-kickoff timing, acceptable margin and freshness; later odds never fill an earlier gap. Use each original's saved kickoff for its48-hour void rule. Unknown actual AI spend remains null with retained liability, never fictitious zero.

Saturday's145outputs comprise one observation window, including Sunday fixtures. A separate Sunday refreshed cohort has **not executed**. Different issuance times are retained; old originals cannot be presented as contemporaneous AI controls. Future Saturday/Sunday cohorts must be shown separately and matched by fixture/window; repeated fixtures are dependent. A2 veto rates are not predictive probability gains. The small weekend sample is exploratory and cannot prove superiority/profitability. Do not tune/promote a model on it or present previously inspected holdouts as untouched evidence.

Private files after the first poll total135,610,851bytes (~129.3MiB), separate from the8.17MiB initial database relation figure. Raw packets, backup generations, WAL, encryption copies and container resources must be capacity-checked before further runs. No storage budget is increased. The new runner avoids a duplicate emergency dump on successful runs; already retained checkpoints/failures are preserved. Results currently depend on this transient private workspace; GitHub/public aggregates cannot recover them. No approved owner encryption key/permanent private retention destination is configured.

## October30/31 release gates

| Gate | Current status |
|---|---|
| Exact engine/settings/UI/public source preservation | Pass; no application diff,72/48-hour regression checks pass |
| Combined local regressions / isolated backup/rollback | Pass; real populated archive and synthetic failure/permission tests verified |
| Genuine supervised same-engine trial | Executed Saturday; outcomes pending; no accuracy gain established |
| AI provider/inference/spending continuity | Blocked pending owner choice and verified account/price/key/cap/runtime |
| Private manual CI | Inert template only; needs default-branch registration approval, protected environment and owner-held recovery key/rehearsal |
| Supabase Auth/JWT/PostgREST/RPC/Edge integration | **Not certified**; local PostgreSQL is insufficient; no hosted changes/deployments |
| Production backup/restoration and authenticated SmartBet/user flows | Not newly verified; source preservation/offline checks do not replace staging |
| Security notices | Read-only advisor reported public`pg_net`extension and leaked-password protection disabled; investigate/approve remediation separately, no production settings changed |
| Independent Claude review / deployment approval | Outstanding; deadline does not waive either |

Ready for independent review: isolated research/operating tools, exact-source preservation, combined verification and private supervised feasibility evidence. Keep AI, learned models and all new integrations experimental. There is no evidence to replace or alter the live statistical engine. Recommend supervised Sunday refresh/results collection if capacity/data remain adequate, owner retention of the private archive, and a Monday exploratory report on genuinely available outcomes. By October30, resolve critical staging/security/backup gates and obtain a separate reviewed deployment decision; do not promise an October31 launch while they remain open.

## Change and rollback dossier

Commits: `31746a2` isolated plan; `bc242fe` exact engine, private storage/source/reporting, closed AI/provider/encryption/manual-CI preparation and additive Phase5 combination; `4b77f62` review corrections/commit confirmations/lineage, chained outcome restore and rollback. The documentation/evidence delivery commit follows them; the final PR supplies its exact head and CI links.

New module responsibilities: `engine.mjs`unchanged-source executor; `source.mjs`/`collect-source.mjs`read-only collection; `schema.sql`/`store.mjs`private journal/quota/receipts; `budget.mjs`retained liability; `providers.mjs`/`ai.mjs`unselected request contracts; `report.mjs`paired evaluation; `run-weekend.mjs`supervised enrollment; `collect-results.mjs`/`archive.mjs`verified correction-chain restore; `files.mjs`private paths; `seal-results.mjs`ciphertext envelope; `rollback.sql`local nondestructive stop; manual workflow template/release manifest/docs/results. New`phase8-*`tests cover these boundaries. `.gitignore`protects documented private directories; the inherited CI workflow adds Phase8/base/path triggers. Ten additive Phase5 files/tests are explicitly listed in the release manifest. No private Edge source or public engine/publisher/UI file changes.

Rollback: stop supervised runs, revoke only the local weekend writer with`rollback.sql`, preserve events/reservations/source packets/backups and verify read access. Restore only into disposable isolated PostgreSQL after initializing known roles; verify hashes and denial for ordinary roles. Revert/close the undeployed Phase8 draft to remove code. No production rollback action is needed because no production change occurred. No current provider key/call needs shutdown; any future activation must specify its own owner-controlled provider stop and remaining-budget reconciliation before approval.
