# Phase 8 secure OpenRouter continuation plan

**Specification:** owner's urgent continuation instruction. Immediate isolated implementation is authorized; no further design-approval cycle, production write, publisher/collector execution, merge/deployment or new paid resource. Base exactly `9312a06`; continuation branch `codex/phase8-openrouter-continuation`; draft PR targets the Phase8 branch. Existing PRs remain untouched.

**Goal:** prove recovery/ancestry and prepare or execute receipt-qualified OpenRouter comparisons only when recovery, runtime, provider and global budget guards all pass. Preserve Build355, Smart Bet,72-hour issuance,48-hour void and250MiB relation ceiling.

**Architecture:** retain all Saturday records. Add a recovery verifier and additive private OpenRouter ledger/forecast namespace; exact engine is reused unchanged. HTTP transport admits only OpenRouter key/credit/model/generation GETs and bounded chat-completion POSTs, uses the inherited proxy, never prints secrets or puts them on command lines. Requested models only: `openai/gpt-6-luna`, `moonshotai/kimi-k2.5`. Structured JSON, fixed backend/price caps, no SDK retries/fallbacks, tools/search disabled. Every attempt reserves a conservative whole-context maximum before dispatch; unknown/failed liabilities remain reserved and survive checkpoint/restore.

## Task 1 — recovery and runtime

Files: `audits/phase8-continuation/recovery.mjs`, recovery CLI/runbook, focused tests.

- [ ] Verify archive checksum, safe member paths/types/size, file hashes and explicit manifest latest checkpoint. Never extract symlinks/traversal or execute an arbitrary supplied dump outside network-none PostgreSQL.
- [ ] Restore complete archive into a new outside-Git directory and cached isolated PostgreSQL. Verify every retained checkpoint is a hash-identical event prefix of its successor,145jobs/725original arm slots, complete93680-row packet, original forecast hashes, roles, quota and all retained reservations/dispatch/cost records. No historical reconstruction.
- [ ] Ask for owner confirmation of external archive retention; local presence cannot prove download. Record the actual runtime status. Current observed133 has no secret binding/OpenRouter host and must not be bypassed; recheck only after updated attachment/readiness.
- [ ] Synthetic RED→GREEN tests for corrupt/traversal/oversize/ancestry loss, missing forecast/input, restored money liability and ambiguous checkpoint selection. Commit.

## Task 2 — model, request and budget contracts

Files: `contracts.mjs`, `transport.mjs`, `openrouter-schema.sql`, `ledger.mjs`, tests.

- [ ] Verify official public endpoints/docs and, when runtime ready, authenticated key/credits/model endpoints. Public catalog availability is not account permission. Require non-resetting finite key limit<=US$5, sufficient verified balance, restricted nonmanagement key and reconciled legacy/new liability. Never request a pasted key or a broader management secret.
- [ ] Parse pricing as exact decimals; include the highest tier/overrides, full context and bounded output. Freeze model/backend/price/configuration/hash. Require healthy structured-output endpoint and parameter support. Reject missing/expired/changed profiles, unapproved models, tool costs or fallback paths.
- [ ] Strict JSON Schema plus independent runtime validation: only source refs from the frozen football evidence; A3 receives no engine/odds probabilities; scout A1/A2 shares one response. Reject malformed/refused/truncated/unsourced outputs without hiding failures.
- [ ] Append-only shared budget, dispatch-once, post-commit pre-kickoff confirmation, response/cost/failure records. Include existing reservations and current provider usage conservatively; no daily/cold-run reset or uncertain refunds. Test concurrency, retries, failures, charges exceeding reserve, backup/restore, permissions and quota. Commit.

## Task 3 — supervised Sunday and Monday readiness

Files: preflight/supervised runner/report CLI, continuation report/runbook, CI branch/base filters, tests.

- [ ] Gate real inference on authenticated current runtime, owner retention acknowledgement, verified full restoration/ancestry, provider/key/balance/price contracts and actual UTC SundayOct25 pre-kickoff time. Saturday does not masquerade as Sunday. No unattended scheduler.
- [ ] Use fresh complete receipt-now packet and exact existing engine; keep published originals, Saturday forecasts and new Sunday/model arms distinct. Predeclare deterministic fixture order and balanced model-request bundles constrained by available data/runtime/storage/US$5, with every failure/abstention preserved.
- [ ] Reuse existing proper scores/grading/calibration; compare identical fixtures with issue times and eligible odds explicit. Monday report only at a genuine cutoff; pending future execution is reported as blocked, never fabricated. Detailed football results stay private.
- [ ] Run all inherited/new tests on Node20/24, fresh independent review, record actual executions/failures/costs and remaining release gates. Push continuation only and open a new draft PR; preserve all prior PRs/protected refs. No merge/deploy.

## Review focus / current known constraints

Incomplete backup ancestry must block same-study paid execution. A republished configuration is not active merely because the owner saved it; require current ready observations. HTTP secrets can be proxy placeholders, so never fingerprint/print their values or bypass egress. Tiered prices can exceed headline rates. Key/account limits and provider response shape must be actually verified; a restricted key may not be allowed to read account credits, which is a blocker rather than justification for broader credentials. Frozen historical clocks stay unchanged. Current date is SaturdayOct24; Sunday/Monday are future supervised windows unless the actual clock advances. No optimization or new prediction model is in scope.
