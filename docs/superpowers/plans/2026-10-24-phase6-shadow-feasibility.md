# Phase 6 offline private shadow feasibility implementation plan

> **For agentic workers:** Use superpowers:executing-plans or subagent-driven-development task by task. User explicitly authorizes implementation of this isolated system; no hosted or live changes are authorized.

**Goal:** Verify private, reproducible shadow evaluation without altering frozen predictions or claiming synthetic accuracy gains.

**Architecture:** Extend the existing disposable PostgreSQL snapshot harness with an isolated private `shadow_eval` schema. Read snapshot manifests through Phase 3/4's integrity-checked reader; invoke a fixed, versioned offline adapter; append separate forecasts and operational attempts; score frozen exports with the Phase 5 pure metrics.

**Tech stack:** Node 20.20.2/24.19.0, existing PostgreSQL 17 image, built-in Node libraries, existing M14 feature VM. No new dependencies or images.

## Design and constraints

- Branch `codex/phase6-shadow-feasibility` starts exactly at `e5580b3`; Phase 5 reference is `f56caab`. Neither existing PR is merged or changed.
- Default comparison is exact original output. One hypothesis: M14's existing `xgEdge` may contain incremental information about home-versus-away ranking. Investigate input availability and adapter feasibility first, not accuracy on invented outcomes.
- Existing M14 ridge predicts an expected-points residual, not a 1X2 distribution. Reject an arbitrary conversion. A narrow conditional home/away log-odds adapter can accept an explicitly frozen coefficient artifact; preserve draw probability and original output for coefficient zero. In Phase 6 only **synthetic** coefficients are available; non-synthetic use must abstain until independently trained receipt-verified coefficients exist. No fitting of historical mutable features or spent holdouts.
- Adapter registry is trusted repository code, not arbitrary uploaded functions. Freeze adapter source, configuration, code provenance, registration timestamp, artifact kind and evidence requirements. Identity and M14 xG-edge paths only; fault injection belongs in test-only registry overrides.
- Validate authoritative observation receipt equality and strict pre-issue chronology with microseconds. Reject late-import captures, unknown receipts and backdated provider-event substitutions for candidate input. Maintain complete manifests; never truncate historical inputs. Original snapshot export remains immutable and distinct from exact engine replay, which remains unavailable.
- A missing snapshot must remain a recorded failure, not vanish from coverage. Missing required input, unsupported/real unfitted artifact, invalid output and execution errors produce exact baseline fallback when a snapshot exists. Database write failures are explicit and repairable from source/reconciliation; no success claim if persistence failed.
- Reports are labelled `synthetic_verification` or `historical_exploratory`; this offline feasibility system never automatically certifies prospective evidence. Outcomes are passed only to scoring, never adapters. Preserve original kickoff and 90-minute/48-hour rules; invalid labels cannot be scored.
- Private schema, immutable registries/results, append-only attempt events, FK to original snapshot, unique candidate/snapshot results, least-privilege runner/operator/reader roles. Ordinary application roles get no access. Candidate code gets no database/AI credentials.
- Combined `research` + `shadow_eval` quota remains 262144000 bytes (250 MiB), guarded by the existing quota lock. Operational failure receipts are bounded and quota failure itself remains observable. No hosted database connection or real publisher/collector execution in the new command.

## Alternatives considered

1. Use existing `research.append_shadow` unchanged: minimal, but it lacks a frozen candidate registry, execution-failure taxonomy, missing-snapshot denominator and reproducible study exports. Retain it unchanged for compatibility; Phase 6 adds separate tables linked to its snapshot layer.
2. New private schema and offline runner (chosen implementation decision): preserves Phase 3/4 APIs and public paths, permits independent rollback/review, shares the existing budget. Requires explicit schema permission and restore tests.
3. Activate full M14 or fit a new historical predictor: rejected because probability mapping and historical evidence are not validated. Asynchronous publication/outbox remains future design only.

## Interfaces and tasks

### Task 1 — registry, provenance and adapter (root)

Files: `audits/phase6/core.mjs`, `audits/phase6/adapters.mjs`, `audits/test/phase6-core.test.mjs`.

- [ ] Write failing tests for frozen candidate/config/source hashes, original immutability, microsecond timing, missing/late evidence, exact identity fallback, synthetic-only coefficient execution, bad output and exceptions.
- [ ] Implement `freezeCandidate(spec)` yielding descriptor `{candidate_id,version,adapter_id,adapter_sha256,configuration,configuration_hash,frozen_at_utc,study_kind}`; ID is canonical hash of the descriptor fields.
- [ ] Implement `evaluateJob({candidate,snapshot,capture,observations}, registry?)` returning deterministic immutable JSON result. Capture includes `{payload_hash,capture_kind,manifest_hash}`. Results carry snapshot/candidate/config/baseline/evidence hashes, private visibility, probabilities, status/reason, feature diagnostics and `confirmatory_eligible:false`.
- [ ] Reuse `buildAsOfInputs` / `existingMatchFeatures`; no live engine modification. Only xgEdge is consumed by the experimental adapter. No outcome argument.
- [ ] Green focused tests and regression suite; commit independently.

### Task 2 — local private repository and permissions

Files: `audits/phase6/schema.sql`, `audits/phase6/repository.mjs`, `audits/phase6/rollback.sql`, `audits/test/phase6-db.integration.test.mjs`.

- [ ] Write failing database tests for all ordinary roles, immutable configs/results, snapshot links, result idempotence/conflicts, attempt events including missing snapshots, quota, backup/restore and rollback.
- [ ] Add local-only schema with frozen candidate JSON/hash, separate results and attempt events. All tables RLS, ordinary roles denied, constrained SQL entrypoints. Runner reads existing research manifests through inherited `research_reader`; cannot publish or modify observations/predictions.
- [ ] `repository(db)` exports synchronous `register(candidate)`, `load(snapshotId)` -> `{snapshot,capture,observations}` or missing error, `save(result)`, `recordAttempt(event)`, `exportStudy(candidateId)`; db is the existing **local** harness object, never a URL/env connection. Use safe JSON literals, fixed SQL, no hosted SDK.
- [ ] Persist original `source_prediction` untouched in export for evaluation; include capture backlog/failed attempts in operational summaries. Export snapshot/observation data privately, never Git.
- [ ] Green integration tests against the cached pinned image; commit independently.

### Task 3 — evaluation and Phase 5 selective reuse

Files: `audits/phase5/validation.mjs` (byte-identical copy from f56caab), its focused tests, `audits/phase6/report.mjs`, `audits/test/phase6-report.test.mjs`.

- [ ] Port only the pure Phase 5 scoring/validation module and its tests; do not port its raw-data audit, candidate tuning, app changes or whole PR. Document retained unused functions precisely.
- [ ] Write failing tests for known Brier/log loss, class calibration/AUC, correct 90-minute outcomes, exact 48-hour boundaries, duplicate fixtures, identical paired model/market cohorts, missing/future odds, abstention/coverage counts and byte-identical reports.
- [ ] `buildReport({candidate,records,attempts,asOfUtc})` uses original source metadata + Phase 3 envelope and result; authoritative odds must belong to the immutable manifest and precede issue, age <=24h. Both original and candidate compared on identical market subset. Group by stable competition ID and UTC issuance periods. Include exact fallback intention-to-forecast, successful-only diagnostics, pending/void/excluded/unrecorded counts and descriptive uncertainty.
- [ ] Never promote a synthetic or date-labelled cohort; report no positive accuracy finding. Green tests; commit independently.

### Task 4 — executable synthetic feasibility and resources

Files: `audits/phase6/run-synthetic.mjs`, `audits/phase6/results/*`, CI modifications, final report/runbook.

- [ ] Seed synthetic pre-issue observations via existing server-receipt API, publish synthetic originals using local harness SQL, register candidates, execute/capture/fallback and export/report privately.
- [ ] Verify container network none, no ports, image already cached, no hosted credentials/connections. Fail rather than silently skip dependencies. No large downloads.
- [ ] Measure realistic manifest volumes/reuse, complete feature construction, adapter runtime, database growth including indexes/operational events; estimate 30/90/180d at transparent prediction and poll rates within shared 250 MiB budget. No sustained trial recommended without coverage, genuine training artifact and feasible storage/sample size.
- [ ] Run inherited 107 tests, selectively copied Phase 5 tests and all Phase 6 tests **together** on both Node versions; record exact counts/scope and independent review corrections. CI targets this branch/new PR base.
- [ ] Document architecture, every changed file/reason, rejected models, complete tests, synthetic-only findings, quotas, backup/restore/rollback, security, limitations and commit history. Push and create separate draft PR to `codex/phase3-immutable-snapshots`; no merge/deploy.

## Review focus

Time provenance must come from database receipts, not JSON assertions; late imports abstain. Failed capture/result persistence must remain in denominators. Retries must not create competing results. Candidate failures must retain exact stored precision. Evaluation must bind settlement and odds to the same fixture and preserve 90-minute/48-hour semantics. Database superusers and Docker administrators remain trusted; SQL/Node tests do not establish Supabase Auth/PostgREST/Edge compatibility.
