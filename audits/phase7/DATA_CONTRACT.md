# Phase 7 training and validation contract

Status: implemented and verified for **synthetic research only**. No football collection/signing authority is configured. `verifyDataset` rejects football-labelled datasets even if a caller signs them. An Ed25519 signature does not turn invented history into evidence.

## Evidence availability and the five clocks

The assessment is limited to retained Phase 5/6 artifacts and local schema/code, not a new audit of either hosted project. The machine-readable assessment records exact source hashes. In the retained Phase 5 read at `2026-10-24T05:14:56.81316Z`, 1,929 settled predictions and 816 legacy market pairs were available, but authoritative per-feature and settlement receipts were not established. Its `research_schema_present:false` describes that read only. Phase 6's 52,080 observations and 30 originals have local server receipts but are explicitly synthetic. **Zero real training examples can currently be certified from these available artifacts.** This is not a claim that no uninspected external evidence exists.

| Clock | Meaning | Required evidence | What is insufficient |
|---|---|---|---|
| Original issuance | When the original prediction was issued | Original winning publication identity, saved probabilities/build/kickoff/pick and immutable at-issue capture | A mutable current forecast or a caller's historical `made_at` alone |
| Server receipt | When the trusted ingestion boundary received an item | Server-assigned `received_at_utc`, authenticated source and durable immutable record | A provider event timestamp or client-supplied earlier receipt |
| Fixture event | When the historical match or actual kickoff/final event occurred | Fixture-bound provider event data with source provenance | Receipt time interpreted as event time, or event time interpreted as availability |
| Feature observation | When the feature value became available to the system | Per-field observation equals authoritative receipt; receipt strictly before the target issue | Legacy `captured_at`, mutable `updated_at`, or today's xG copied into yesterday's issue |
| Outcome/correction receipt | When a final label or later correction became available | Append-only fixture-bound revisions, final event time, valid 90-minute score and server receipt | Current final goals without a settlement/correction ledger |

Current archive contents may be imported **now** under a new, genuine receipt for use in **future** issues. They cannot be relabelled as pre-issue evidence for old forecasts. Upstream fixture inventory, source authorization, clock health and completeness must be audited separately: complete retained manifests do not prove the collector had every upstream fixture or field.

## Signed dataset boundary

`sealDataset` signs canonical `{purpose:"dataset_export",payload}` with Ed25519. The packet carries its SHA-256 and a key identifier/signature. `verifyDataset` receives a **separate trusted policy**; the packet cannot supply its own public key or authorize a different source, clock domain, data kind or code version. Current policy purpose is `phase7-synthetic-poc` with `allowed_kind:synthetic_verification`. Unit-clock fixtures are labelled `synthetic_unit`; the end-to-end exporter uses actual `postgres_server` receipts from a network-isolated local instance.

The payload contains:

- Schema/data kind, source identity/clock domain, server export timestamp and pinned source-version hashes.
- Deduplicated observation records, including their original PostgreSQL value text and payload hash.
- The entire declared per-candidate job roster, including missing captures.
- Each immutable original envelope and its raw PostgreSQL text/hash; complete manifest body text/root; ordered chunks, counts and observation memberships.
- Original source-prediction metadata and append-only settlement revisions with raw text/hash, event time, revision and receipt.

The exporter reads the inherited integrity-checked `research.read_snapshot_evidence` and existing private roster. It does not read mutable fixtures to rebuild past features. It exports all declared jobs rather than selecting successful ones.

`pg-jsonb-v1` proofs and canonical signed-payload hashes are different schemes. The verifier hashes the **exact retained PostgreSQL text** for envelopes, manifest bodies, values and labels, checks the captured manifest anchor, then verifies ordered chunk membership/counts and all referenced observations. UUID-array chunk serialization uses PostgreSQL's spaced JSON array form. Only after these checks are objects used in canonical signed/sample hashes. A newly signed shortened array still fails the captured-root/count checks. No membership cap silently truncates inputs; oversized transport/payload support remains bounded and must fail explicitly.

Source hashes pin exporter/contract code, local schema, input bridge, actual M14 feature source, original conditional adapter, settlement/grading and scoring dependencies. Matching code is required when reproducing a frozen export. Database owners, source operators, Docker administrators and the independently approved signing policy remain trust boundaries; this is not hardware attestation or a sandbox for a malicious owner.

## Per-example eligibility

1. Require unique fixture identity, matching original source/envelope, valid frozen original probabilities/build/pick/kickoff, intact evidence proofs and known source versions. Dataset corruption or conflicting identifiers fails the dataset, not a selectively cleaned analysis.
2. Original issue must precede original kickoff. Capture must be `at_issue`, received no earlier than issue, within ten seconds of it, before kickoff and no later than export. Missing/invalid capture receipt or `late_import` excludes the row from both candidate fitting and verified-original scoring. A separate capture-valid flag prevents a second feature error from overriding that exclusion.
3. All selected observations must have an explicit offset/calendar-valid microsecond timestamp, `observed_at_utc == received_at_utc`, receipt strictly before issue and no later than export, supported schema/field and non-null observed value. Effective time cannot follow receipt. Historical played time must precede receipt and target issue. Target outcome-derived observations cannot become features.
4. Recompute the existing M14 feature vector from the **complete retained evidence**. Consume only finite `xgEdge`; verify original target home/away/league/date identity. The existing provider window/minimum/history calculations are preserved. Missing or invalid model inputs reject candidate use; they are not imputed to zero. Unrelated missing lineup features do not suppress a valid xgEdge.
5. Home and away baseline probabilities must both be positive for a conditional home/away fit. Original rounded mass is retained. Boundary cases abstain rather than invent log odds.
6. Validate each settlement's hash, fixture/kind, unique increasing revision order and nondecreasing receipt order. A receipt cannot follow the export. Finished labels require valid actual fixture date/time and `original kickoff <= event finished`, **`actual/moved kickoff <= event finished <= receipt`**. Zero-duration events are allowed only as the explicit synthetic proof; a real adult-football protocol needs independently verified regulation/final-event evidence and cannot use this as a 90-minute timing shortcut.
7. Select the last revision received **strictly before** the label cutoff; later corrections cannot replace that training label. Nonfinal states remain pending/void under the existing grader. Preserve valid 90-minute FT-pair preference and the 48-hour void rule. AET/PEN without valid explicit FT scores is withheld; padded statuses are normalized. No live grader changes are made.

`prepareSamples` returns the original roster count, explicit rejections, feature-eligible examples and independently baseline-scorable examples. A valid frozen original with invalid/missing features can still receive exact original fallback in validation. A missing/unverified original cannot be given a fictitious baseline score. Outcome-unavailable/ambiguous/void rows remain visible in rejection counts. Integrity failures stop processing rather than dropping inconvenient records.

## Frozen fit

`fitCoefficient` requires a frozen dataset exported **before** its fit cutoff and a chronological `[train_start,fit_cutoff)` issue interval. Selected label receipts must also precede that cutoff. This export requirement prevents a later dataset, containing newly received corrections, from masquerading as the dataset available when fitting.

For saved `(h,d,a)` and existing feature `x`, reuse the Phase 6 calculation:

`q = logistic(log(h/a) + beta*x)` and candidate `((h+a)*q, d, (h+a)*(1-q))`.

Fit a single beta by minimizing multiclass log loss within the inherited `[-1,1]` bound. Draw terms and home+away mass are constant in beta. The derivative for non-draw rows is `sum(x*(q-y_home))/N`. It is monotone; deterministic bisection uses 80 iterations. There is no new engine, intercept, feature redesign, regularization or validation-selected hyperparameter grid. A zero coefficient returns the original vector directly.

The synthetic proof requires at least 20 feature-eligible examples, at least ten non-draw rows and positive feature information (`sum(x²)>1e-12`); zero-gradient tolerance is `1e-12`. These are numerical feasibility checks, **not evidence of adequate football sample size**. Insufficient or unidentifiable data produces `status:abstain`, beta zero and an explicit reason. Bound optima are flagged, not interpreted as a validated model.

The versioned artifact records configuration/hash, dataset hash, full source versions/trainer hash, exact algorithm constants, selected fixture/sample/label roots, complete training-roster fixture IDs, rejection/outside-period counts and boundary status. It always has `artifact_kind:synthetic_training`, `production_ready:false`, `confirmatory_eligible:false`. No Phase 7 artifact is registered with or activated by the Phase 6 prediction registry.

## Registration and validation chronology

Fitting alone does not freeze a candidate for a new study. The local operator materializes the immutable artifact and protocol hash in PostgreSQL. Its **server-assigned registration receipt** is separately signed with purpose `artifact_freeze`, binding artifact hash, training dataset hash and validation-protocol hash. Caller dates cannot substitute for this receipt; signature purpose separation prevents a dataset signature from being reused as a freeze receipt.

Validation requires:

- Training export `< fit cutoff <= server registration < validation start < validation end <= label cutoff`.
- Every validation issue strictly after registration and inside the fixed issue window for scoring.
- No validation fixture overlapping **any** fixture in the training roster, including rejected/unused training examples.
- A validation export at or after the fixed label cutoff. Only label revisions before that cutoff may be scored.
- The original coefficient/configuration/protocol remain unchanged. Validation never refits beta or chooses a new setting.

Comparisons use exact paired fixtures: original versus candidate on all scorable rows; both on the identical eligible market subset; and each against the same de-vigged market. Missing feature predictions use exact baseline fallback and remain in the intention-to-forecast scores. Odds require immutable manifest membership and trustworthy pre-issue receipt/capture chronology, freshness and valid margin under the existing Phase 6 selector. Closing or later odds cannot replace missing pre-issue observations.

Brier, log loss, accuracy, class calibration/AUC, competition/month strata, coverage and descriptive paired uncertainty are reported. Small-cluster intervals may be null. Current reports are synthetic diagnostics, not the confirmatory inference or promotion mechanism described in `PILOT_PROTOCOL.md`.

## Private persistence and failure boundaries

Three additive `shadow_eval` tables hold immutable dataset headers, compact per-roster example status/provenance and coefficient artifacts. They reference existing snapshots; repeated registration is exact/idempotent and conflicting contents are rejected. RLS and private NOLOGIN operator/reader grants deny ordinary app roles and shadow runners access to the new writers. SQL enforces synthetic-only artifacts and the inherited shared quota. No original prediction or existing Phase 6 source file is modified.

Raw signed exports, synthetic signing keys and full backup remain outside public Git, in mode-0700 directories/mode-0600 files. Reproduction needs only the public trust policy and frozen packets, not the private key. Reversing this research is closing/reverting its draft PR or executing its **local-only** rollback to revoke the new writer entrypoints while retaining all data. The complete database dump includes the new tables; the inherited restore procedure creates the known roles first. Hosted Supabase restore/Auth/JWT/PostgREST/Edge compatibility is not established by these tests.
