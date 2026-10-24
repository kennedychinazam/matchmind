# Phase 3 implementation report

## Delivery and protected state

Work branch: `codex/phase3-immutable-snapshots`, created from `feature/matchmind-quality-upgrade` at `68c00ded8043b7ee1a15937db1a32c01d932f4e7`. The approved plan was committed before implementation (`3a419b4`). Tasks were implemented in sequence with failing tests before implementation and separate commits:

| Commit | Deliverable |
| --- | --- |
| `ec9b0f4` | Provenance/envelope validation and tests |
| `26911fe` | Local PostgreSQL schema, private roles, immutability, backup/restore |
| `4e5b006` | As-of adapter executing existing M14 feature functions; private shadow fallback |
| `36d9570` | Failure-safe publisher capture, collector writer and private shadow storage |
| `de9df68` | Full replay/budget/browser coverage, development CI and staging runbook |

The original feature branch remains at its original commit. Production `main` and `backup/build355-20261023` remain at `036f09b29f27a10c7d8bdcec1f16efd557c714e4`. The application, robot and production publishing workflow have no diff from the parent. No production SQL writes, Edge Function deployments, API-Football requests, paid AI calls, paid-resource creation, merge or website deployment were performed. All implementation/database tests used synthetic data in network-disabled local PostgreSQL containers. No private collector source or credentials were committed.

## Files changed

| Files | Purpose |
| --- | --- |
| `docs/superpowers/plans/2026-10-23-phase3-immutable-asof-snapshots.md` | Approved plan, committed unchanged before coding |
| `audits/lib/snapshot-contract.mjs` | Strict JSON, UUID/probability/time/size validation, microsecond comparisons, hash/projection contracts |
| `audits/lib/asof-features.mjs` | Immutable evidence selection, missingness/manifest, offline existing-M14 execution |
| `audits/lib/shadow-forecast.mjs` | Separate shadow output with exact baseline fallback and no confirmatory claims |
| `audits/staging/bootstrap.sql` | Synthetic source tables and local test roles only |
| `audits/staging/snapshot-schema.sql` | Private evidence/snapshot/link/shadow tables, indexes, grants foundation, append-only guards, receipt writer and storage admission |
| `audits/staging/permissions.sql` | Explicit RLS/read/function grants, no public research access |
| `audits/staging/capture-hooks.sql` | Winning-source-insert capture, pre-issue evidence/odds, isolated failure handling, private shadow writer |
| `audits/staging/rollback.sql` | Disable capture and revoke writers while retaining evidence |
| `audits/staging/collector-adapter.mjs` | Allowlisted field ingestion without provider requests; immutable receipts and correction versions |
| `audits/staging/publisher-harness.mjs` | Local injected publisher/capture orchestration; bounded retries/deadline and explicit repair status |
| `audits/staging/compose.yml` | Pinned PostgreSQL 17 image, no network/ports, disposable tmpfs |
| `audits/staging/measure.mjs` | Repeatable local storage/server-time measurement |
| `audits/test-support/local-db.mjs`, `synthetic.mjs` | Disposable local database lifecycle/backup support and synthetic fixtures |
| `audits/test/snapshot-contract.test.mjs` | Validation, missingness, receipt, probability/hash/size tests |
| `audits/test/asof-features.test.mjs` | Late xG/lineups, corrected values, microseconds, provenance, existing feature calculations |
| `audits/test/shadow-forecast.test.mjs` | Exact fallback, source immutability, private output and cohort boundaries |
| `audits/test/snapshot-db.integration.test.mjs` | Real PostgreSQL permissions, immutability, atomic retries, storage cap, restored ACLs/data |
| `audits/test/snapshot-capture.integration.test.mjs` | Publisher permission/storage failures, retries, dedup/corrections, odds, private shadow writes, evidence limits |
| `audits/test/snapshot-replay.integration.test.mjs` | Database-to-feature replay, source-hash verification and 48-hour grading characterization |
| `audits/test/snapshot-budgets.test.mjs` | Oversize ingestion and capture deadline/retry budgets |
| `audits/test/snapshot-browser.test.mjs` | Offline guest boot/Smart Bet parity against parent, zero added research payload/requests |
| `audits/package.json`, `package-lock.json` | Locked Playwright test driver dependency |
| `.github/workflows/audit-regression.yml` | Development-branch/PR CI with local Docker/Chromium tests on Node 20/24 |
| `.gitignore` | Exclude installed dependencies and local execution ledger |
| `audits/README.md`, `docs/PHASE3_STAGING_RUNBOOK.md`, this report | Test entrypoint, exact local migration/rollback/backup commands, permissions and limitations |

## Verification — original implementation

Before implementation, all 34 existing tests passed. Task gates passed 44, 51, 62 and 72 tests respectively. Task 5 passed 80 tests, including real local PostgreSQL and offline Chromium, on Node 24.19.0 and Node 20.20.2. Final post-review verification passed **88/88 tests on Node 24.19.0 and 88/88 on Node 20.20.2**, with zero failures, cancellations or skips. This includes the original 34 regressions, local PostgreSQL, actual concurrent publisher transactions and offline Chromium.

Commands:

```sh
npm ci --prefix audits --ignore-scripts --no-audit --no-fund
node --test audits/test/*.test.mjs
npm exec --yes --package=node@20.20.2 -- node --test audits/test/*.test.mjs
node audits/staging/measure.mjs
```

Missing local DB/browser infrastructure fails the suite; it does not silently skip tests. Browser application requests are intercepted; external requests are aborted. The browser check covers guest boot/Smart Bet tab behavior, not authenticated Supabase publishing.

Dependency audit: `npm audit --prefix audits --omit=optional --json` reported zero vulnerabilities. Credential-pattern checks on changed files found no private-key, cloud access-key, GitHub-token, AI-key or JWT literals. Diff whitespace checks passed. Production app/robot/publishing workflow comparisons showed no changes. Additional security evidence includes private schema isolation, restricted function EXECUTE, RLS, immutable mutation guards, no browser service credential, denied backdated observations, server-assigned receipt times and backup/restore verification of record hashes plus reader/function ACLs.

## Migration, backup and rollback

[PHASE3_STAGING_RUNBOOK.md](PHASE3_STAGING_RUNBOOK.md) provides exact commands. Apply only to a fresh disposable local database, in order: `bootstrap.sql`, `snapshot-schema.sql`, `permissions.sql`, `capture-hooks.sql`. These SQL files have not been applied to Supabase and are not represented as validated hosted Supabase migrations.

Backup uses pg_dump with ownership/ACLs preserved and a separate role export without role passwords; exports go outside this repository. Restore into a second isolated database, then verify counts/hashes, role permissions, owners, RLS and functions. Automated tests exercise that procedure. Rollback sets research capture disabled and revokes writer EXECUTE while preserving both original source predictions and research data. Repair is append-only or an idempotent capture retry. The runbook explains how permissions are restored for local re-enablement.

Any future production change separately requires private backups of all five function sources and database/schema/permissions/cron, a tested isolated restoration, staging validation and explicit user approval. Those production procedures were not executed here.

## Resource results and staging limitations

Local synthetic measurement: 500 snapshots; mean 1,264-byte envelope; 1,277,952 bytes total research table/index allocation. Five 100-row batches measured median 1 ms for source insertion versus 50 ms including capture: approximately 0.49 ms additional server time per prediction and 4,900% overhead relative to bare inserts. The <=5% target for total representative publisher runtime is not established; it remains a staging release gate. No claim of production speed or billing validation is made.

Operational admission limits are 16 KiB field values, 64 KiB envelopes, 500 linked observations, 100 field rows per collector batch, 2 MiB requests and a proposed 250 MiB research table/index budget. They are not filesystem/WAL/billing hard quotas. Unchanged successive field values reuse an existing stored ID; corrections and return-to-earlier-value events preserve new receipt versions. No production boot bytes, reads, writes or provider calls were added.

Future hosted Supabase staging must verify Auth/JWT identity mapping, actual column grants, PostgREST/RPC/private-schema exposure and receipt/error transport; private collector/publisher integration; actual storage/egress/provider quotas and full runtime; and recoverable function/database backups. Local PostgreSQL tests do not establish those capabilities.

Build 355 lacks an exact ordered baseline-input/configuration manifest. Saved output reproduction is exact, but original-input replay stays explicitly incomplete; late imports do not become historical truth. `model_version` is labeled as derived from the recorded build. The fixture-lineage hash covers the frozen source prediction, while field evidence has separate versions. No model is retrained, retuned or promoted. The existing 48-hour derivation can be non-monotonic without a persisted terminal-settlement ledger; it is characterized and documented rather than changed. Prospective cohort labels never automatically imply confirmatory eligibility.

## Final review

An independent Codex Cloud reviewer found no Critical defects and five Important defects. Each Important issue was reproduced by a failing regression and fixed: session-timezone-dependent capture retry conflicts; nonfinite expected goals; oversized odds identifiers that could block capture; SQL fallback distributions differing from baseline; and null manifest provenance/incorrect cohorts. The final pass was verified by the implementer through failing regressions and the full green suites; a second independent review was not performed. The final pass also aligned the SQL field allowlist and six-digit timestamp support with the JS contract, added a genuine concurrent-publisher transaction test, and tested actual trigger permission failure (in addition to RPC denial). There was no production access during review.

The reviewer explicitly declined to certify hosted JWT/PostgREST compatibility, real publisher transport, complete baseline-input replay, production recovery or representative runtime overhead. Those remain the release gates listed above. No reported minor was silently omitted: SQL field/timestamp mismatches were fixed because they violated the shared validation contract; the sequential-race test was supplemented with concurrent local transactions. No deferred review findings remain within the implemented local scope.

## Implementation decisions and plan clarifications

1. Use the existing cloud checkout on the requested new branch instead of another worktree; protected branch refs remain fixed. The cost of incorrect isolation would be protected-branch movement, checked by local/remote ref verification.
2. Preserve the approved plan verbatim and apply the user's later branch/PR-base amendments; execution uses the Codex branch and targets the feature branch.
3. Treat local role tests as synthetic PostgreSQL validation only; hosted authentication/transport remains unverified and must block production integration.
4. Keep JS canonical-JSON and PostgreSQL jsonb hash domains distinct; comparing them interchangeably would produce false integrity failures.
5. Implement the capture function with Task 4's real winning-insert tests after Task 2's schema/permissions foundation; no functionality or test was omitted by that sequencing clarification.
6. Mark baseline-input replay incomplete because Build 355 did not archive the required manifest; assuming completeness would falsely certify historical evidence. Exact saved-output reproduction remains available.
7. Classify only contemporaneous INSERT-trigger captures within ten seconds as `at_issue`; repairs are always late imports. Neither label certifies the original model inputs. The conservative cutoff may classify delayed legitimate captures as late.
8. Leave the <=5% representative publisher-runtime gate unverified, explicitly report the much larger relative overhead of raw inserts, and require staged workload measurement before release.
9. Add a pinned test-only browser dependency and update development audit CI so newly required DB/browser tests can actually run; the production publishing workflow stays unchanged.
10. Treat SQL field/timestamp contract mismatches as correctness fixes rather than deferred polish; expand race verification to real concurrent transactions. This adds test time but avoids overstating compatibility/race evidence.


## Review follow-up: scaling and durable monitoring

The two additional review requests were implemented only on `codex/phase3-immutable-snapshots`; PR #1 remains a draft targeting `feature/matchmind-quality-upgrade`. Commit `ff9c9c1` introduced dependency selection and shared manifests. Subsequent hardening and operational monitoring are included in this revision. The original app, robot, production publisher workflow and protected branch refs remain unchanged.

### Historical evidence scaling

The old selector copied every eligible field for an entire competition into a single <=500-link envelope. It failed on realistic history and selected much more provider data than M14 needs. A newest-500 limit would also have changed the model: home-edge, half-split and target-team history counts have no fixed lookback; standings require current and previous seasons.

The versioned dependency selector preserves all required target-team result history; full current/previous season standings inputs; 240-day target-team provider form; 540-day competition referee context; and cross-competition 21-day congestion/4-day distraction plus the latest older rest fixture. It selects as-of eligible values before DISTINCT ON, so a newer unverified score/stat cannot erase an older verified value. Referee normalization runs only in the original M14 builder; retaining bounded competition referee context avoids a second, subtly different Unicode normalizer in SQL.

Complete evidence is stored in content-addressed chunks of <=500 ordered observation FKs. Immutable manifest headers reference up to 200 chunks/100,000 observations. Headers, normalized chunk order, individual chunk hashes and total counts are verified before reading. Repeated history reuses existing chunks. A complete required set above the supported ceiling fails explicitly; it is never truncated. Existing inline snapshots remain byte-for-byte unchanged and readable through the legacy reader path.

The selector first finds candidate metadata using a fixed-size indexed routing key with full value equality, then materializes exact `(fixture_id,field_name)` requirements. EXPLAIN reproduced an estimated-cardinality error causing about 57 million nested-loop comparisons (~8.5 seconds); the key-based join removed that slow path. No PostgreSQL planner switches or statistical-model formulas were changed.

Scaling regression:

| Scenario | Evidence/result |
| --- | --- |
| Five seasons, multiple teams/competitions | 51,866 observations including newer unverified corrections and unrelated malformed metadata |
| Required model inputs | 10,444 observations in 21 chunks; every M14 feature equals the full-history reference |
| Completeness | Populated history, home edge, half splits, xG, table, lineup continuity, referee and schedule features retained |
| More unrelated history | Add 2,000 unrelated fixtures/24,000 fields before another prediction; total 75,876 observations |
| Reproducibility | Repeated capture returns the original snapshot/manifest; later observations cannot change archived replay |
| Integrity/privacy | Ordered link substitution is detected; ordinary users cannot read manifests; immutable mutations denied |
| Storage | About 4,988,928 bytes for the first shared manifest allocation versus 212,992 bytes for the next prediction using shared chunks |
| Local timing | 0.61–0.65 seconds initial capture and 0.68–0.70 seconds after adding unrelated history in the final concurrent Node 20/24 runs; five-second regression ceiling enforced |

Timings/allocated-page counts vary with concurrency and PostgreSQL page allocation. Final full-suite diagnostics are retained in the local verification logs. These figures are not hosted Supabase performance or billing guarantees. The <=5% representative publisher-runtime target remains a staging gate, particularly because admission locking serializes capture transactions.

### Durable failure identification and repair

`research.capture_health` is a private operational table with `captured`, `pending`, `disabled` and `repaired` state, server timestamps, monotone attempts/failures, sanitized SQLSTATE and the successful snapshot FK. It contains no raw error text, probabilities, picks, source payloads or credentials. RLS plus explicit grants limit health reads to a NOLOGIN `research_operator` role; application users, model readers, collectors and publishers cannot SELECT it or mutate it directly.

The trigger uses `research.try_capture_prediction()`. A failed capture rolls back only its inner savepoint; health is written afterward in the outer successful source-publication transaction. Evidence-budget exhaustion does not block the health write. Success/retry records the existing snapshot and repair status without republishing or altering the original prediction. Raw `capture_prediction` is private so authorized publisher/operator calls use the monitored facade.

`research.capture_backlog(page_size,after_fixture_id)` independently reconciles source predictions, snapshots and unresolved health. It identifies missing `unrecorded` captures even when a deliberately broken monitoring sink prevents status persistence. The operator can retry through the same facade. Tests verify storage failure, permissions, disabled capture, repeated repair, original-source byte equality, private grants, sink failure and restored repair-state/ACLs.

In-database monitoring cannot make a physically unavailable/full database commit or emit an external alert. If the original source transaction itself cannot commit, publication durability is outside the optional-capture guarantee. Private availability monitoring, reserved storage, and an operator-owned reconciliation schedule remain staging requirements; no production monitor was deployed.

### Additional/changed files

- `audits/staging/evidence-manifests.sql`: additive immutable chunk/manifest migration, model dependency selector and verified reader.
- `audits/staging/capture-monitoring.sql`: private operational state, monitored facade and backlog/repair permissions.
- `audits/staging/capture-hooks.sql`: chunked capture, safe facade trigger, private raw function and replaceable local upgrade path.
- `audits/staging/permissions.sql`, `measure.mjs`, `audits/lib/asof-features.mjs`, `snapshot-contract.mjs`: new manifest grants, test setup and complete-evidence replay/projection contracts.
- `audits/test-support/history.mjs`, `local-db.mjs`: reproducible large synthetic corpus and larger local query-output budget.
- `audits/test/snapshot-scaling.integration.test.mjs`: full-vector parity, growth, query time, reuse, eligibility/Unicode, privacy and integrity.
- `audits/test/snapshot-monitoring.integration.test.mjs`: durable failures/repair, source preservation, private grants and failed-sink reconciliation.
- `audits/test/snapshot-upgrade.integration.test.mjs`: actual additive upgrade from `33ee671`, preserving original source/snapshot envelopes/hashes and legacy reads.
- Existing capture/schema/replay tests: updated migration order, monitored receipts, roles and legacy/manifest read paths.
- This report and the staging runbook: updated schema, exact fresh/upgrade commands, monitoring, repair, retention/cost and limitations.

### Follow-up review and final verification

A focused independent Codex Cloud review found one Important selector eligibility mismatch. The failing full-vector regression reproduced history counts changing from 150 to 149 when an unverified newer score displaced the valid older one; SQL eligibility was corrected before latest-value selection. The review's manifest-header linkage and unrelated-archive scaling findings were also addressed. Additional parity testing caught a Unicode referee normalization mismatch; the selector now preserves the bounded context for the original JS normalizer. Each correctness fix has a verified failing-then-passing regression.

**Final verification: 99/99 tests passed on Node 20.20.2 and 99/99 on Node 24.19.0, with zero failures, cancellations or skips.** This includes all original 34 regressions, the full-vector scaling corpus, durable monitoring/repair and an additive upgrade preserving legacy snapshots. Both complete commands below were run after all code changes:

```sh
node --test audits/test/*.test.mjs
npm exec --yes --package=node@20.20.2 -- node --test audits/test/*.test.mjs
```

Changed-file credential-pattern checks found no private keys/tokens; diff whitespace checks passed. Remote `main`, Build 355 backup and the original feature branch retained their verified SHAs. No production Supabase access, Edge deployment, public-engine change, paid AI activation, real API-Football request or paid-resource creation was used. Migration, backup/restore, rollback, private operator queries and repair procedures are documented in `docs/PHASE3_STAGING_RUNBOOK.md`. Hosted Auth/PostgREST, real publisher/collector transport, full original baseline-input replay, production recovery and representative runtime/egress remain explicitly unverified.
