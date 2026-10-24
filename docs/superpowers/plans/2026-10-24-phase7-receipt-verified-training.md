# Phase 7 receipt-verified training feasibility implementation plan

> Execute inline with test-driven development and one fresh whole-branch review. User authorizes isolated implementation and a new draft PR only; no hosted access/change, real publisher/collector execution, model activation, paid AI or budget increase.

**Goal:** Establish whether trustworthy data exists and prove a chronological training/validation contract without manufacturing football provenance.

**Base:** `0c3819c`, branch `codex/phase7-receipt-verified-training`. Preserve PRs #1/#2/#3 and all protected refs.

**Architecture:** Leave Phase 6 and the application unchanged. Add a synthetic-only signed dataset exporter, strict sample preparation from complete immutable manifests, a deterministic bounded one-parameter fit using the existing Phase 6 prediction calculation, and a separately frozen offline validation report. Local materialization remains private and shares the original 262144000-byte quota. No Phase 7 artifact is executable by the Phase 6 registry.

## Evidence and hypothesis decisions

- Audit retained Phase 5/6 artifacts and database contracts only; do not query either hosted project. State assessment scope/date explicitly. Legacy issue time, `captured_at`, mutable `updated_at`, feature first receipt and final/corrected settlement receipt are different clocks.
- No receipt-verified historical football dataset has been supplied/deployed in this scope. The retained Phase 5 archive cannot establish necessary feature/outcome receipts; Phase 6 receipts are synthetic. Do not train a football coefficient or infer that uninspected external records do not exist.
- Hypothesis: existing M14 xgEdge contributes to home-versus-away conditional ranking beyond the saved original distribution. Reuse `existingMatchFeatures` and `ADAPTERS['m14-xgedge-v1'].execute`; preserve draw probability and original total mass. Do not activate full M14, convert its expected-points ridge target arbitrarily, change rho/recency, or reuse spent holdouts.
- Fit one beta within inherited [-1,1] by deterministic convex log-loss optimization; no intercept, feature redesign, validation-driven hyperparameter search or forced positive coefficient. Draw rows contribute constant loss. Unidentifiable/insufficient data abstains; bound solutions are flagged. All current artifacts are synthetic and explicitly not production-ready.
- A signature protects a dataset only under an independently supplied trusted public-key policy. The signed payload cannot select its own trust root, football status or source version. Generate synthetic keys privately outside Git. No real source authority is configured; current CLI rejects football datasets even if a caller signs one.

## Modules and interfaces

### Task 1 — availability and provenance contract

Create `audits/phase7/availability.mjs`, `attestation.mjs`, `samples.mjs`, test support and `audits/test/phase7-contract.test.mjs`.

- [ ] Write RED tests for unsigned/untrusted/tampered datasets, synthetic→football relabelling, missing/equal/post-issue receipts, future event/label timestamps, incomplete manifests, future corrections, missing xgEdge, duplicate fixture IDs and source/version mismatch.
- [ ] `sealDataset(payload, privateKey, keyId)` / `verifyDataset(package, trustedPolicy)` bind canonical dataset hash, Ed25519 signer, source identity/kind and executable/feature versions. Signer policy must come from outside the signed package. Self-signing arbitrary history is not evidence.
- [ ] Payload includes `dataset_kind`, actual source clock domain, collection/export identity, source versions, deduplicated observations and immutable per-fixture snapshot/evidence memberships, complete receipt metadata and settlement revisions. Missing-capture roster rows remain represented.
- [ ] `prepareSamples(package,policy,cutoff)` verifies authenticity/integrity before recomputing existing xgEdge from full evidence. Return eligible examples plus explicit rejected/abstained rows. No caller-supplied feature values or `updated_at` proxies. Future label revisions cannot replace earlier training labels. Require valid 90-minute outcomes and preserve the 48-hour void policy.
- [ ] Availability CLI reads only retained Git audit artifacts; publishes qualified counts/source hashes and known gaps, never a claim about unqueried current hosted data.
- [ ] Focused tests GREEN; commit.

### Task 2 — frozen fit and validation

Create `audits/phase7/train.mjs`, `evaluate.mjs`, `audits/test/phase7-training.test.mjs`.

- [ ] RED tests: known conditional-logit optimum, zero/no-identifiable signal, missing outcomes, train-label cutoff isolation, disjoint chronological periods, frozen coefficient/hash reproducibility, held-out outcome changes cannot affect beta, no reuse of invalid timestamp/duplicate inputs, exact baseline fallback and identical paired cohorts.
- [ ] Fit beta via the existing conditional prediction calculation and a monotone derivative/bisection, with numerical/reference tests. Artifacts bind training dataset/row/label/evidence/config/source hashes, fixed cutoff, deterministic algorithm/version, coverage, boundary/identifiability status and `production_ready:false`.
- [ ] Freeze time must precede validation issuance. Validation uses a separate timestamp-qualified dataset, immutable prior training artifact and fixed label cutoff; no tuning or refit on validation. Return original/candidate/eligible market Brier, log loss, accuracy, calibration/AUC and paired descriptive intervals, coverage and abstentions.
- [ ] Preserve all roster denominators. No Phase 6 adapter/registry alteration or registration of the new artifact as a live model. Synthetic outputs always remain synthetic, never prospective.
- [ ] Tests GREEN; commit.

### Task 3 — actual local receipt and storage proof

Create `audits/phase7/local.mjs`, `schema.sql`, `run-synthetic.mjs`, `audits/test/phase7-local.integration.test.mjs`.

- [ ] RED tests for complete manifest export, actual database receipt chronology, private training materializations, duplicate retries, ordinary-role denial, shared quota and unchanged original snapshots.
- [ ] Use the existing cached-image `--network none --pull=never` harness. New helper reads complete Phase 6 manifests and server-received label revisions, deduplicates input evidence and signs a private export. Caller timestamps are not promoted to authoritative receipt time.
- [ ] Synthetic end-to-end clock uses actual server time: ingest past synthetic history now; issue originals with near-future synthetic kickoffs; wait briefly for those kickoffs; append synthetic outcomes with current server receipts; fit/freeze; issue validation originals strictly afterward; settle and validate. Synthetic zero-duration events are explicitly synthetic, not a football event-time claim. No fake backdated receipt seeding.
- [ ] Add private immutable dataset/example/artifact materialization tables in `shadow_eval` under existing quota/permissions. Explicit synthetic-only checks; no prediction/public write path. Record hashes and compact prepared examples rather than duplicate complete history. Backup/restore and nondestructive stop remain local.
- [ ] Measure input history, manifests, training examples/artifact, labels, odds, indexes and operational storage; parent runtime/RSS; export and fit/validation runtime. Store only aggregate results publicly; raw evidence, keys and dumps outside Git, permissions 0700/0600.
- [ ] Tests GREEN; commit.

### Task 4 — bounded pilot, full verification and dossier

Create `audits/phase7/pilot.mjs`, `REPORT.md`, `DATA_CONTRACT.md`, `PILOT_PROTOCOL.md`, results and CI updates.

- [ ] Specify a fixed 14-day receipt-feasibility population plus a fixed seven-day label tail; 1–2 originals/day, one competition, predeclared selection, full required history, one pre-issue odds capture and bounded post-finish correction checks. No efficacy-driven selection/extension, silent failed-row removal or evidence truncation.
- [ ] Price 7/14/28-day alternatives using retained measured observation/manifest slopes plus new sample/artifact costs and a 25% reserve. Preserve 250 MiB; distinguish necessary capacity from authorization. Full M14 evidence remains intact. Future bootstrap imports received now can serve future issues, never earlier ones.
- [ ] Contrast this small engineering pilot with a powered accuracy study. Define dual-reference Brier/log-loss gates, freeze, chronology, missingness, paired denominators, uncertainty limitations and rejection conditions before any real study. No study starts in this phase.
- [ ] Fresh whole-branch review; fix material findings with RED→GREEN regressions; run all inherited and new tests together on Node 20.20.2 and 24.19.0. Verify frozen artifacts/reports reproduce across runtimes.
- [ ] Document before/after architecture, every changed file/decision, evidence availability, fit method, rejected approaches, exact tests, storage/runtime/sample size, trust limitations, rollback and next intervention requirements. Push new branch, open draft PR targeting `codex/phase6-shadow-feasibility`; never merge/deploy.

## Review focus

Signatures do not authenticate unapproved collectors; retained audit metadata is not a new hosted audit. All five clocks remain separate. Complete evidence membership and late corrections must be frozen, not reconstructed from mutable rows. Validation outcomes never enter fitting; candidate freeze precedes new issues. Missing rows stay in the denominator. A synthetic signing key cannot authorize football coefficients. Small samples and affordable storage do not establish predictive improvement or adequate power.
