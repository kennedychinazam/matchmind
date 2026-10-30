# Phase 8 secure OpenRouter continuation plan

**Specification:** owner's urgent continuation instruction. Immediate isolated implementation is authorized; no further design-approval cycle, production write, publisher/collector execution, merge/deployment or new paid resource. Base exactly `9312a06`; continuation branch `codex/phase8-openrouter-continuation`; draft PR targets the Phase8 branch. Existing PRs remain untouched.

**Goal:** prove recovery/ancestry and prepare or execute receipt-qualified OpenRouter comparisons only when recovery, runtime, provider and global budget guards all pass. Preserve Build355, Smart Bet,72-hour issuance,48-hour void and250MiB relation ceiling.

**Architecture:** retain all Saturday records. Add a recovery verifier and additive private OpenRouter ledger/forecast namespace; exact engine is reused unchanged. HTTP transport admits only OpenRouter key/credit/model/generation GETs and bounded chat-completion POSTs, uses the inherited proxy, never prints secrets or puts them on command lines. Requested models only: `openai/gpt-6-luna`, `moonshotai/kimi-k2.5`. Structured JSON, fixed backend/price caps, no SDK retries/fallbacks, tools/search disabled. Every attempt reserves a conservative whole-context maximum before dispatch; unknown/failed liabilities remain reserved and survive checkpoint/restore.

## Task 1 — recovery and runtime

Files: `audits/phase8-continuation/recovery.mjs`, recovery CLI/runbook, focused tests.

- [x] Verify archive checksum, safe member paths/types/size, file hashes and explicit manifest latest checkpoint. Never extract symlinks/traversal or execute an arbitrary supplied dump outside network-none PostgreSQL.
- [x] Restore complete archive into a new outside-Git directory and cached isolated PostgreSQL. Verify every retained checkpoint is a hash-identical event prefix of its successor,145jobs/725original arm slots, complete93680-row packet, original forecast hashes, roles, quota and all retained reservations/dispatch/cost records. No historical reconstruction.
- [x] Ask for owner confirmation of external archive retention; local presence cannot prove download. Record the actual runtime status. Current observed133 has no secret binding/OpenRouter host and must not be bypassed; recheck only after updated attachment/readiness.
- [x] Synthetic RED→GREEN tests for corrupt/traversal/oversize/ancestry loss, missing forecast/input, restored money liability and ambiguous checkpoint selection. Commit.

## Task 2 — model, request and budget contracts

Files: `contracts.mjs`, `runtime.mjs`, `transport.mjs`, `execute.mjs`, `checkpoint.mjs`, `local.mjs`, tests.

- [ ] Verify official public endpoints/docs and, when runtime ready, authenticated key/credits/model endpoints. Public catalog availability is not account permission. Require non-resetting finite key limit<=US$5, sufficient verified balance, restricted nonmanagement key and reconciled legacy/new liability. Never request a pasted key or a broader management secret.
- [x] Parse pricing as exact decimals; include the highest tier/overrides, full context and bounded output. Freeze model/backend/price/configuration/hash. Require healthy structured-output endpoint and parameter support. Reject missing/expired/changed profiles, unapproved models, tool costs or fallback paths.
- [x] Strict JSON Schema plus independent runtime validation: only source refs from the frozen football evidence; A3 receives no engine/odds probabilities; scout A1/A2 shares one response. Reject malformed/refused/truncated/unsourced outputs without hiding failures.
- [x] Append-only shared budget, dispatch-once, post-commit pre-kickoff confirmation, response/cost/failure records. Include existing reservations and current provider usage conservatively; no daily/cold-run reset or uncertain refunds. Test concurrency, retries, failures, charges exceeding reserve, backup/restore, permissions and quota. Commit.

## Task 3 — supervised Sunday and Monday readiness

Files: preflight/supervised runner/report CLI, continuation report/runbook, CI branch/base filters, tests.

- [ ] Gate real inference on authenticated current runtime, owner retention acknowledgement, verified full restoration/ancestry, provider/key/balance/price contracts and actual UTC SundayOct25 pre-kickoff time. Saturday does not masquerade as Sunday. No unattended scheduler.
- [ ] Use fresh complete receipt-now packet and exact existing engine; keep published originals, Saturday forecasts and new Sunday/model arms distinct. Predeclare deterministic fixture order and balanced model-request bundles constrained by available data/runtime/storage/US$5, with every failure/abstention preserved.
- [ ] Reuse existing proper scores/grading/calibration; compare identical fixtures with issue times and eligible odds explicit. Monday report only at a genuine cutoff; pending future execution is reported as blocked, never fabricated. Detailed football results stay private.
- [ ] Run all inherited/new tests on Node20/24, fresh independent review, record actual executions/failures/costs and remaining release gates. Push continuation only and open a new draft PR; preserve all prior PRs/protected refs. No merge/deploy.

## Review focus / current known constraints

Incomplete backup ancestry must block same-study paid execution. A republished configuration is not active merely because the owner saved it; require current ready observations. HTTP secrets can be proxy placeholders, so never fingerprint/print their values or bypass egress. Tiered prices can exceed headline rates. Key/account limits and provider response shape must be actually verified; a restricted key may not be allowed to read account credits, which is a blocker rather than justification for broader credentials. Frozen historical clocks stay unchanged. Current date is SaturdayOct24; Sunday/Monday are future supervised windows unless the actual clock advances. No optimization or new prediction model is in scope.

## Implementation record / explicitly unfinished activation

Owner confirmed both external archive downloads and checksum verification. Local recovery verified the three chronological dumps plus the emergency equivalent and exact archived engine parity. Runtime changed133→136 while remaining on the same old source configuration version, with no secret bindings or OpenRouter host; the actual metadata-only CLI stopped before HTTP. Public model/docs checks passed; authenticated key, balance, account model access and real output compliance remain **unexecuted/blocked**. Sunday/Monday are future actual windows; no clock or continuity was fabricated.

Implementation reuses existing model-scoped weekend jobs and the existing ONE SQL spending authority; no new schema/ledger migration was necessary. Full roster is frozen before enrollment; virtual export-only failures preserve missing targets without inventing issuance. Conservative physical output maxima replace the original proposed1024-output liability estimate, while requests still use1024 nominal tokens. Known charges stay covered by unchanged original holds; unknown provider spending blocks, rather than adding overlapping usage repeatedly to bundle prices.

The tested supervised **programmatic** entry and read-only preflight CLI are prepared. A private live launcher, real binding/account shape verification, current key/balance checks, fresh source/day admission and proved cross-task checkpoint reconciliation are activation gates for the next correctly configured task. These are not completed live operations. See `audits/phase8-continuation/{REPORT,README,NEXT_CLOUD_TASK}.md` for exact decisions, test evidence and handoff. No previous PR, protected branch, production process or paid resource changed.

Final offline verification: source95393f5;230/230 tests,0fail/0skip, together on Node20.20.2 and24.19.0. Independent reviewer inspected final code and reported no remaining important finding in scope. All4 actual archived dumps passed complete logical ancestry, frozen engine parity and0real liability. Owner external retention acknowledged. Remote PRs1–5 and protected refs unchanged. Public request contracts prepared; authentic provider/secret/balance checks and Sunday/Monday execution remain blocked/pending actual date and correct environment. Latest observed139 still uses the old source configuration with no binding/host. Delivery is a separate draft with exact new-task handoff, not live activation.
