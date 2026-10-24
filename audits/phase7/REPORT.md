# Phase 7 — receipt-verified training and validation feasibility

**Decision:** The offline training/validation contract works with synthetic evidence and genuine local PostgreSQL receipt clocks. **No real football training dataset can be certified from the available artifacts, no football coefficient was trained, and no predictive improvement has been established.** Keep the existing engine and public predictions unchanged. A small receipt-feasibility pilot is conditional future work, not an accuracy study or an activated service.

This branch starts exactly at Phase 6 `0c3819c`. Neither hosted project was accessed in Phase 7. PRs #1/#2/#3, Build 355, protected branches, engine calculations, Smart Bet, UI and public publishing remain unchanged. Nothing is merged or deployed; no paid AI, API-Football request, resource creation or Supabase installation is performed.

## Evidence availability assessment

[Aggregate evidence](results/2026-10-24-feasibility.json) records exact retained-source hashes. The Phase 5 archive is read from Git ref `f56caab20a5dfabc237646909058d57dac7f9a65`; the Phase 6 aggregate is inherited from this branch's base. This is a **retained-artifact assessment**, not a current hosted database audit.

| Available evidence | Count | Training status |
|---|---:|---|
| Phase 5 settled original predictions at its retained read | 1,929 | Useful exploratory baseline; immutable first receipt/input lineage not established |
| Phase 5 legacy eligible market pairs | 816 | Legacy benchmark eligibility does not establish receipt-verified feature/outcome provenance |
| Phase 6 local observations / original snapshots | 52,080 / 30 | Actual local receipts, explicitly synthetic |
| Certifiable real football training examples in these artifacts | **0** | Do not fit a football model |

The retained hosted read was `2026-10-24T05:14:56.81316Z`; absence of the research schema in that record describes that time only. Uninspected external evidence might exist. Original `made_at`, a fixture's calendar date, legacy `captured_at`, mutable `updated_at`, per-feature server receipt and settlement/correction receipt are different clocks. None may substitute for another. [DATA_CONTRACT.md](DATA_CONTRACT.md) specifies all five clocks and exact inequalities.

Missing real evidence includes an independently approved collection/signing authority and clock, complete upstream inventory, immutable pre-issue values and publication lineage, regulation-time outcome/correction receipt history, and a dataset/artifact frozen before an untouched validation cohort. Signing reconstructed history does not remedy these gaps. Current archive data imported with a genuine receipt **now** may support later issues, never earlier ones.

## Before and after architecture

Before Phase 7, Phase 6 privately froze originals/evidence, executed fixed adapters and produced paired reports. Its xgEdge adapter accepted only synthetic coefficients; it had no receipt-verified learner or training-to-validation artifact contract.

Phase 7 adds this offline path:

```text
Existing immutable snapshots + complete manifests + label revision ledger
  -> signed full-roster export, external synthetic trust policy
  -> raw PostgreSQL proof checks + strict clock checks + existing M14 xgEdge
  -> deterministic training-only coefficient fit and immutable artifact
  -> actual server registration receipt binding artifact/dataset/protocol
  -> later, disjoint validation issues + fixed label cutoff
  -> exact original / candidate / eligible market paired diagnostics
```

The original Phase 6 files, feature bridge, capture SQL and application are unchanged. Three additive private tables store dataset headers, compact roster examples and coefficient artifacts; they reference existing snapshots. The Phase 6 executable candidate registry never receives or activates a Phase 7 artifact. Raw packets, generated synthetic private keys and full dumps remain outside Git.

Exact PostgreSQL text hashes, manifest roots/chunk order/counts and observation memberships are verified before feature construction. Signature purpose separation and a separately supplied public-key policy bind source identity, data kind and code versions. Missing rows remain in the roster. A verified original with missing features can use exact baseline fallback; an unverified capture cannot enter verified-original scoring. The current policy rejects football datasets even if signed. Signatures are integrity evidence under a trusted signer, not proof against a malicious source/database owner or proof of upstream completeness.

## Hypothesis and implementation decisions

The sole investigated hypothesis is whether **existing M14 xgEdge** helps conditional home-versus-away probability beyond the saved original. Reuse `existingMatchFeatures` and the Phase 6 `m14-xgedge-v1` calculation:

`q = logistic(log(h/a) + beta*xgEdge)`; candidate probabilities are `((h+a)*q, d, (h+a)*(1-q))`.

Draw probability and home+away mass are preserved. Fit only one beta in the inherited `[-1,1]` range using a monotone log-loss derivative and 80-step deterministic bisection. There is no intercept, new model, arbitrary positive coefficient, hyperparameter sweep or validation-driven refit. Minimum 20 qualified examples, ten non-draws and nonzero feature information are numerical proof requirements, not football power claims. Missing/unidentifiable inputs abstain; boundary solutions are flagged. The versioned artifact records complete training-roster IDs, selected sample/label/evidence roots, dataset/configuration/source hashes and algorithm constants.

Training export and qualified labels precede fitting. A separately signed **database server registration** binds the artifact and validation protocol before every validation issue. Overlap with any training-roster fixture, including rejected ones, fails validation. Fixed receipt cutoffs prevent later corrections from rewriting earlier labels. Existing 90-minute settlement and 48-hour void rules are preserved; ambiguous AET/PEN labels are withheld. Actual/moved kickoff must not follow the finished event.

Rejected approaches: backdating imports; treating mutable history as immutable; fitting on synthetic outcomes and advertising football gains; reusing inspected holdouts as fresh; enabling full M14; converting its expected-points target into probabilities arbitrarily; changing Dixon–Coles, recency, home advantage or draw adjustments; choosing only successful captures; truncating required history; increasing storage; and launching a sustained collector in this workspace.

Phase 5 reuse is precise: `audits/phase5/validation.mjs` supplies the inherited paired/descriptive uncertainty and calibration functions; the retained Phase 5 aggregate supplies availability context. Phase 6 adapter/report and shared scoring/as-of/grading contracts are reused directly. No entire Phase 5 branch or PR is merged or newly claimed jointly tested.

## Verification and synthetic findings

[Verification record](results/2026-10-24-verification.json) and [full aggregate result](results/2026-10-24-feasibility.json) contain reproducible counts/hashes. The final combined local suites include all 135 inherited tests and 16 new Phase 7 tests:

| Runtime | Passed | Failed / skipped | Duration |
|---|---:|---:|---:|
| Node 20.20.2 | **151** | 0 / 0 | 104.7 s |
| Node 24.19.0 | **151** | 0 / 0 | 176.6 s |

New coverage: unsigned/untrusted/tampered sources; synthetic-to-football relabelling; invalid/missing/equal/post-issue receipts; complete manifests and source versions; late corrections; missing features/captures; immutable candidate/configuration; known positive/negative fit roots; no-signal abstention; export/cutoff and disjoint validation chronology; independently frozen registration/protocol; exact baseline fallback; actual local receipt pipeline; private permissions; immutable rows; shared-quota refusal; restore; nondestructive rollback; and bounded pilot arithmetic. Inherited tests continue to cover public/original immutability, publisher capture failures, retries, manifest selection, shadow isolation, scoring and settlement. No production process is run.

Independent whole-branch technical review found two material edge cases: invalid capture status could be overwritten by a feature rejection and re-enter scoring; and a finished label could precede a moved actual kickoff. Both were reproduced RED, corrected, then verified GREEN in dedicated regressions and both full suites. Separate capture validity now gates scoring; actual kickoff chronology is mandatory. No further material technical finding was reported in that review. The final dossier prose was written afterward.

The actual-clock proof ingested synthetic history now, issued 30 synthetic training originals, received labels, exported/fitted/froze, then issued and settled 18 disjoint validation originals. It used five artificial historical fixtures and repeated teams, not a representative football accuracy population. Synthetic outcomes are deliberately zero-duration events after the clock reaches kickoff; this proves receipt ordering, **not real regulation-time collection**.

The known artificial conditional optimum reproduced `beta = 0.6931471805599456` (`log(2)`). All 18 validation rows were scorable/feature-qualified/market-paired; none required fallback. Artificial Brier was .560000 original, .506667 candidate and .578475 market; log loss was .916291, .859658 and .996846 respectively. These differences were constructed by the synthetic fixture distribution and are **not football gains**. Constant synthetic feature values yield no meaningful ranking evidence (home/away AUC .5). The replay fits the same frozen packet and validates against the same signed freeze/protocol. Node 20/24 outputs are byte-identical, SHA-256 `227817e35c45db4e3a4e89f96380eacb59198365ed922a02a396094c33b8d8c2`.

## Measured runtime and storage

One local end-to-end synthetic run, including bounded waits/export/database work: **39.33 s**; fitting **584 ms**; validation **479 ms**; parent-process maximum RSS **250,344 KiB**. Docker/PostgreSQL memory is separate. These are single-run engineering measurements, not throughput guarantees or representative long-history football benchmarks. The inherited Phase 4/6 volume evidence informs capacity planning separately.

| Actual proof component | Bytes |
|---|---:|
| Combined research/shadow/training relations, including indexes | 7,569,408 |
| Of which reported indexes, including TOAST indexes | 5,185,536 |
| Training dataset/example/artifact relations, including their indexes | 212,992 |
| Private canonical training export | 862,834 |
| Private canonical validation export | 792,387 |
| Frozen coefficient artifact | 4,136 |

The aggregate contains each table's size. Training/export copies, private backup, WAL, catalogues, container storage and filesystem capacity are additional to database relation accounting. Complete exports deduplicate shared observations but repeat per-issue manifest membership; large real archives may require larger private file capacity or explicitly fail transport bounds. No silent truncation is permitted.

## Conditional prospective feasibility

[PILOT_PROTOCOL.md](PILOT_PROTOCOL.md) proposes **seven issuance days plus seven label-tail days**, one predeclared competition and the first two issues/day by issue time/fixture ID: at most 14 originals, often fewer. It preserves complete required history, selected failures, pre-issue odds and correction receipts. It is too small even to guarantee the proof fitter's 20-row minimum and must not promise a real fitted candidate.

The least expensive valid route is an approved current archive imported under receipt-now, followed by passive recording of already collected licensed payloads for future issues in an adequate existing private runtime. It needs no additional provider requests only if current coverage/timing/licensing actually suffices; that has not been verified. No pilot or private-source change is launched here.

Planning sensitivity, **MiB including 25% reserve**, using retained synthetic storage slopes and complete diverse-team manifests:

| Bootstrap observations | 7 issue days | 14 issue days | 28 issue days |
|---|---:|---:|---:|
| 52,080 | 152.4 | 205.3 | 315.8 — reject |
| 68,400 | **198.9** | 267.4 — reject | 410.9 — reject |
| 99,000 | 286.0 — reject | 383.9 — reject | 589.0 — reject |

Default 68,400-row/seven-day raw components: observations 73.394 MiB; manifests/original snapshots 13.395; indexes 71.054; compact training examples/artifact allowance .059; shadow forecasts .055; outcome labels .082; bookmaker observations .016; operations 1.055. Raw total is 159.108 MiB; planning total is 198.885 MiB. Counts are transparent estimates, never field caps or proof of actual source completeness.

Preflight must include existing research use and actual complete inventory. Enrollment stops at **200 MiB**, reserving remaining space under the unchanged **250 MiB** admission ceiling for labels/repair. Reject scopes whose raw peak exceeds 200 MiB or reserved peak exceeds 250 MiB. No auto-growth, history truncation or deletion of failed predictions. Physical quota/bloat and external backups still need monitoring. Fourteen-day defaults were shortened to seven based on this capacity result; longer scopes remain documented sensitivities.

A receipt pilot measures capture/feature/market/label availability, correction/reconciliation, bytes and latency. It is distinct from an accuracy study. The proposed later protocol requires a separately learned/frozen candidate, new chronological evaluation, paired intention-to-forecast scores and identical bookmaker subsets. Co-primary Brier/log-loss material thresholds and multiplicity-aware upper bounds are specified in the pilot document. The current 95% week/competition intervals are descriptive; a validated dependence-aware confirmatory estimator is a prerequisite, not an implemented promotion gate.

For scale only, retained Phase 5 Brier SD .18461 suggests about 13,000 independent pairs to detect .005 and 81,000 for .002 at the proposed one-sided 98.75% threshold and 80% power; an assumed dependence factor two doubles these. Candidate-relative variance is unknown. No powered bookmaker-relative study is established as feasible within the current budget/population.

## Files and commit history for independent review

| File(s) | Purpose / reason |
|---|---|
| `audits/phase7/availability.mjs` | Qualified retained-data assessment without hosted access |
| `attestation.mjs` | External synthetic trust policy, signatures and source/raw hashes |
| `samples.mjs` | Complete evidence proofs, five-clock eligibility and existing feature recomputation |
| `train.mjs` | Deterministic bounded fit, frozen lineage and abstention |
| `evaluate.mjs` | Registered chronology, identical pairs, fallback, stratified reports |
| `local.mjs` | Existing isolated PostgreSQL bridge, full export and actual-clock proof |
| `schema.sql`, `rollback.sql` | Three private immutable materialization tables/shared quota; revoke only new writers |
| `pilot.mjs` | Transparent fixed-budget/lifecycle forecast without collection |
| `run-synthetic.mjs`, `reproduce.mjs` | Private proof/export/backup and deterministic replay |
| `audits/test-support/phase7.mjs` | Ephemeral-key synthetic contract fixtures |
| `audits/test/phase7-{contract,training,local.integration,pilot}.test.mjs` | 16 new regressions / integration checks |
| `.github/workflows/audit-regression.yml` | Existing Node matrix on the Phase 7 branch/PR base |
| `DATA_CONTRACT.md`, `PILOT_PROTOCOL.md`, `README.md`, this report | Decisions, protocol, operations and limitations |
| `results/2026-10-24-{feasibility,verification}.json` | Public aggregate measurements only; no raw packets or keys |
| `docs/superpowers/plans/2026-10-24-phase7-receipt-verified-training.md` | Isolated approved-scope implementation sequence and final status |

Implementation commits: `93c3135` plan; `3bef28b` signed evidence/sample contract; `58cf76b` fit/validation; `e343f24` actual-clock local persistence/proof; `f619361` bounded pilot/replay/CI and review corrections. The subsequent documentation commit contains this dossier and aggregate evidence. No unrelated source or inherited Phase 6 implementation changes are included.

## Security, rollback and remaining limitations

The harness accepts no hosted connection URL, verifies the inherited pinned cached image, and uses Docker `--pull=never --network none` with no published ports. New tables have RLS and immutable triggers. Public/ordinary app roles and the shadow runner cannot invoke training writers; only the private operator can. Generated keys and raw exports/dumps are mode 0600 outside Git in a mode-0700 directory. The runner rejects known provider/hosted credential variables. There are no HTTP clients/provider calls or credential literals in the added code. Trusted repository/Docker/database administrators remain prerequisites; signatures do not sandbox them.

Rollback is closing/reverting this isolated draft PR or applying `rollback.sql` **only in the disposable local database** to revoke the two Phase 7 writer entrypoints. It retains every original, manifest, dataset and artifact, plus shared quota accounting. For disaster rehearsal, retain the private full dump, source revision, trusted policy and signing-key custody separately; initialize known NOLOGIN roles before restoring into an empty isolated database. Local restore/permission/original-integrity regression checks pass. A separate populated-backup rehearsal restored two datasets, 48 compact examples and one byte-equivalent coefficient artifact; all 48 original envelopes matched their frozen packet and their complete manifest reads succeeded. Ordinary-role denial, private-reader access and artifact immutability were verified after restore. This supplemental rehearsal is recorded separately from the 151-test suites. A hosted Supabase restoration procedure is not certified.

Outstanding: real source/clock/key/inventory approval; authoritative original/input and regulation-time label collection; real publisher/collector timing compatibility; durable private runtime/capacity; realistic new full-history export performance; transport bounds; dependable unattended monitoring; dependence-aware prospective inference and sample size. Supabase Auth, JWT claims, PostgREST/RPC exposure and Edge Runtime remain unverified because plain local PostgreSQL cannot establish them. No AI provider integration is enabled.

Recommended next stage: review this contract independently, then authorize only a measured private source/inventory feasibility assessment. If its provenance, current capacity and operational requirements pass, separately approve the bounded receipt pilot and freeze its dates/scope. Report missingness and costs before deciding whether a real development cohort and a genuinely new accuracy study are achievable. Until then, keep the existing prediction engine and all public behavior unchanged.
