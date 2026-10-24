# Phase 8 weekend testing and release preparation implementation plan

User authorizes immediate isolated implementation, private experimental forecasts and a **US$5 total weekend AI ceiling**. The consolidated Phase 8 instruction is the specification; its urgency supersedes additional design-approval rounds. No hosted writes, deployment, production process execution, public prediction change or prior-PR merge is authorized.

**Base:** Phase 7 `19c9a30`; branch `codex/phase8-weekend-testing-ai`.

**Architecture decision:** Execute the unchanged complete Build 355 application in a fresh offline Chromium context; inject a complete ordered receipt-now source packet and captured shared measures, intercept only persistence boundaries and use unmodified gate/prediction routines. Store packets, originals, jobs, forecasts, failures, labels and a global integer-microdollar reservation ledger in private isolated PostgreSQL under the inherited 250 MiB quota. Do not use the Phase 6 xgEdge adapter or Phase 7 feature reconstruction as a substitute engine. Do not unpause the old production AI table/function.

Alternatives rejected: invoking the signed-in robot (publishes publicly); writing a second engine or shortened feature history (parity risk); calling the existing grounded AI function without an enforceable reservation boundary (unbounded charges); installing Supabase or creating hosting (restricted). Reuse native Node, existing Chromium/Playwright and cached PostgreSQL only. Code/test implementation can progress independently of blocked live AI credentials/network/billing.

## Constraints and review focus

- Preserve exact `index.html`, Build 355 settings, Smart Bet/UI, 72-hour `PUBLISH_AHEAD_DAYS=3` and separate 48-hour void rule.
- Two fixed UTC observation days, October 24 and 25, 2026; deterministic pre-outcome fixture roster, no arbitrary two-match cap. Every attempted/failed/missing arm stays visible. Forecasts must be persisted before kickoff; prior originals are contextual, not a newly eligible contemporaneous E forecast.
- Prospective receipt-now imports can support later forecasts only. No historical first-receipt claims from mutable fixture/odds timestamps. Complete source inventory and deterministic order must be recorded; fail explicitly rather than truncate.
- All private packets, backend sources, labels, dumps and credentials outside public Git. Only reviewed aggregates and source metadata may be committed.
- Known billing/grounding unknowns fail closed; retries retain prior worst-case reservations, no refund from missing usage. No provider calls without credential/network/model/price/permission and exclusive budget-control readiness.
- Complete source packet and fresh context prevent cache/order/cross-competition drift; independently test public-source equality and engine/market/gate parity.
- Monitoring is operational only where executed. Codex is supervised/transient, not an unattended scheduler; user must identify an approved durable runner for continued collection.
- Hosted Auth/JWT/PostgREST/Edge, backup and release gates remain explicit; local SQL is not hosted integration certification.

## Task 1 — source feasibility and exact private engine

Files: `audits/phase8/engine.mjs`, `source-query.sql`, `audits/test/phase8-engine.test.mjs`, source assessment/result documentation.

Interface: `runEngine(packet, options)` accepts a frozen complete ordered source dataset, captured measures and private fixture roster, returns full original engine probabilities/lambdas and gate/market decision with source/input hashes and real generation time. A fresh context routes every request locally or aborts it; no signed-in state or hosted URL is usable.

- [ ] Audit existing collector/AI sources privately and hosted metadata using read-only operations; record versions, data coverage, clocks, permissions, budget/runtime blockers without publishing private code.
- [ ] Write and observe failing tests for exact source equality, league-specific shrink registration, same-context cache avoidance, missing measures/history, archive versus refreshed selection, 72-hour boundaries and zero outbound traffic.
- [ ] Implement the complete unchanged-source browser path, preserving all loaded histories and shared configuration. Test synthetic fixtures against direct unmodified engine/gate execution; do not claim synthetic accuracy.
- [ ] Prepare read-only fresh source export using a single database snapshot, complete ordered basic/available feature fields, original records, eligible odds and server read timestamp. Freeze receipt-now locally before generation. Attempt genuine supervised pre-kickoff forecasts only after parity and capacity checks succeed.
- [ ] Run focused tests, inspect every result and commit.

## Task 2 — isolated storage, spending and AI contract

Files: `audits/phase8/schema.sql`, `store.mjs`, `budget.mjs`, `ai.mjs`, local integration and pure tests.

Interfaces: private receipt/job/forecast/label APIs write only the local schema. `reserve(request)` atomically charges the one weekend ledger before execution and rejects any ceiling breach; each retry is a separate reservation. AI parser produces separately versioned A1/A2/A3 decisions using the same frozen input packet, source references and request/response receipts.

- [ ] Write failing tests for ordinary-role denial, immutable originals/forecasts, duplicate retries/conflicts, shared storage admission, all-failure denominators, durable concurrent budget reservations, restarts, missing usage/failures, grounding without a verified finite bound, and post-kickoff refusal.
- [ ] Implement additive private tables and safe local-only bridge, shared original quota, reservation/control-row locking and integer microdollars. Reserve verified worst-case request expense; retain uncertain/failure liability. No arbitrary provider transport or production function invocation.
- [ ] Reuse existing A1 multiplier/market calculations where supported, A2 veto semantics and separate A3 probabilities; freeze prompt/model/config/input hashes. A3 is independent of engine probabilities; distinguish it from legacy engine-informed judge. Enforce response schema, source time eligibility and explicit abstentions. Grounding disabled unless safely bounded.
- [ ] Verify Google official current pricing/billing/rate-limit docs, deployed provider/model names and missing account-specific permissions. Document exact missing activation requirements. Actual paid spend remains zero unless all gates genuinely pass within authorization.
- [ ] Run focused regressions/local backup-restore/rollback verification and commit.

## Task 3 — weekend reporting and combined release candidate

Files: `audits/phase8/report.mjs`, `run-weekend.mjs`, protocol/runbook/report/results; selectively restored Phase 5 research files/tests; CI.

- [ ] Write failing tests for identical-fixture comparisons, original versus refreshed timing, pre-kickoff completion, market receipt eligibility, malformed/ambiguous/48-hour labels, missing/pending arms, calibration/coverage/veto reporting, cost per success and reproducibility.
- [ ] Implement Monday-ready offline scoring with existing proper-score/calibration/grading code. Never report unplayed results or synthetic gains as real findings; no unattended Monday scheduling claim.
- [ ] Restore only the ten missing additive Phase 5 paths from `f56caab`, preserving all inherited Phase 3–7 source/workflows/packages. Pin blob/ref provenance and require combined tests; do not merge existing PRs. Fix malformed-score admission only with a regression.
- [ ] Add Phase 8 CI branch/base filters, exact Build 355 source preservation and release manifest. Run all applicable combined tests on Node 20.20.2 and 24.19.0. Collect fresh independent whole-branch review and fix material issues with RED→GREEN tests.
- [ ] Record genuine operational versus blocked components, any actual forecast counts/spend/results, full test/commit/file history, resource/security/backup/rollback limitations and October 30/31 release checklist. No launch recommendation without critical hosted gates.
- [ ] Push only Phase 8, open a new draft PR targeting Phase 7, verify CI. No merge/deploy. Future collection/model/billing/hosting changes requiring approval remain stopped.
