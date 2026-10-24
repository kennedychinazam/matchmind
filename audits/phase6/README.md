# Private offline shadow feasibility — local runbook

Read [REPORT.md](REPORT.md) for decisions, measurements and limitations. This branch is based on Phase 3/4 `e5580b3`. It selectively reuses Phase 5 `f56caab`; neither PR is merged. No application or live publisher/collector entrypoint imports these modules.

## Local prerequisites and isolation

Use Node 20.20.2 or 24.19.0, the existing Docker Unix socket and the already cached PostgreSQL image pinned in `audits/test-support/local-db.mjs`. The harness runs `--pull=never`, `--network none`, no published ports, tmpfs database storage and NOLOGIN research roles. Repository construction inspects the container's image/network/ports; it accepts no hosted URL, SQL connection string or Supabase credentials. A trusted Docker administrator and trusted repository code remain prerequisites.

Do not install Supabase, login/link projects, run migrations against hosted services, launch `robot`/private production collector, add provider keys, call API-Football/AI, deploy, or merge either prior PR. CI pulls only the inherited pinned PostgreSQL image into its own runner; no new service image is introduced.

```sh
node --test audits/test/*.test.mjs
npm exec --yes --package=node@20.20.2 -- node --test audits/test/*.test.mjs
node audits/phase6/run-synthetic.mjs /workspace/matchmind-tools/phase6 30 \
  > /tmp/matchmind-phase6-aggregates.json
node audits/phase6/evaluate.mjs \
  /workspace/matchmind-tools/phase6/xgedge-synthetic-feasibility-v1-private.json \
  > /tmp/matchmind-phase6-rescored.json
```

The synthetic runner refuses a private-export directory inside this repository. It creates the outside directory mode 0700 and files mode 0600. Inspect aggregate outputs before any deliberate public commit. Never commit private raw study exports, SQL backups, credentials or backend source. The command seeds synthetic receipts through the existing local ingestion function and inserts synthetic originals with local SQL; it does not execute a production publisher or collector process. All data, labels and coefficients in this exercise are synthetic.

## Programmatic sequence

1. Start `localDatabase(label)` after cached-image inspection. Apply the inherited files in order: `bootstrap.sql`, `snapshot-schema.sql`, `evidence-manifests.sql`, `permissions.sql`, `capture-monitoring.sql`, `capture-hooks.sql`. Construct `repository(db)` and call `install()` once on the fresh disposable database. The new schema is not an idempotent hosted migration.
2. `freezeCandidate(spec)` binds version, study kind, configuration, required features, adapter source, actual M14 source, and a bundle hash covering executor, adapter, input bridge and timestamp/canonical validation code. `register(candidate)` stores the descriptor immutably; server registration receipt is distinct from caller-declared freeze time. Reusing a version with changed configuration is rejected. Archive the Git revision alongside exports.
3. Declare jobs with `declareJob(candidateId,fixtureId,snapshotIdOrNull)` before execution. Each immutable job freezes its source prediction even if capture is missing. `load(snapshotId)` validates complete manifest/chunk integrity through `research.read_snapshot_evidence`, then returns the original snapshot and complete evidence. It never queries mutable fixtures to manufacture features. No evidence limit is silently truncated.
4. `runJob(repo,candidate,{job_id,snapshot_id})` evaluates only trusted registered adapter code and persists a separate private result. Outcomes are not passed to adapters. Evidence uses exact microsecond receipt/issue comparisons, observed=received, pre-issue receipts, and existing historical played-time rules. Target identity must match the original prediction. Late-import snapshots abstain. Failure produces exact stored-precision fallback where a snapshot exists, or explicit missing-capture repair work where it does not.
5. Missing result persistence is **not** success: inspect `persisted`, `attempt_recorded`, `requires_repair` and the safe reason code. Retries reuse the same candidate/snapshot job; concurrent saves serialize on its row. Conflicting results are rejected, not overwritten. Attempt events contain safe codes only, never arbitrary exception text. A result may persist even if the later monitoring event cannot; the return flags distinguish those cases.
6. `settle(jobId,{fixture_id,kind,fixture})` is an operator-only append of a fixture-bound label revision with server receipt. Keep provider/source provenance privately; no true production settlement collection is implemented. `exportStudy(candidateId)` exports the entire declared job roster, results, attempts, label revisions and immutable odds evidence. Historical feature evidence remains in PostgreSQL and the private full backup; reports need only its hashes plus the eligible odds. This avoids repeating many megabytes of history per report row.
7. Freeze the export and its report input hash. `evaluate.mjs` uses its explicit `asOfUtc` to reject later result/settlement receipts; it never invokes a model, refits a parameter or fetches new data. Re-scoring the same export/source yields identical output on the tested Node versions. The CLI is aggregate-only, but access and provenance still depend on the trusted private export, not a self-asserted JSON timestamp.

## Monitoring, reconciliation and repair

- Keep the roster separate from attempts/results. Compare declared jobs with stored results, missing snapshots and attempt events. Report retries as events, not additional predictions. Missing-snapshot jobs remain in coverage even though their prediction cannot be scored as an immutable snapshot.
- Shadow attempts are capped at 8 per job and 10,000 total. The Phase 6 local monitor guard caps inherited capture-health entries at 10,000 distinct fixtures and 64 attempts per fixture. These are safety bounds, not permission for sustained collection. At a cap, stop/review privately; do not delete study evidence to continue unnoticed.
- Evidence/results use the original shared 262144000-byte ceiling, with up to 1 MiB reserved inside it for operations. All new operations and inherited capture-health writes acquire the same control-row lock. Each operational admission allows a conservative 64 KiB for heap/index/sequence growth. If admission fails, the original publication survives, monitoring can report `monitor_recorded=false`, and `research.capture_backlog()` plus the declared roster exposes missing work.
- Physical disk exhaustion, allocator/page bloat, permissions or a monitoring outage can prevent recording any further receipt in this database. Save the safe local command outcome outside it and reconcile privately. Admission checks are conservative accounting, **not an OS-enforced physical disk quota**. Monitor actual relations/indexes and filesystem capacity; WAL, backups and catalogue overhead need separate capacity. No automatic quota increase is permitted.
- Repair only from persisted pre-issue evidence. Existing snapshot-capture repairs remain `late_import`; they must not be relabelled contemporaneous or prospective. A changed candidate/configuration needs a new version/job, not an update of a prior result. Permanently missing provenance remains an explicit abstention.

## Backup, restore and rollback

The synthetic runner writes `private-research-backup.sql` and a SHA-256 metadata file outside Git before its container closes. The backup includes full research observations/manifests and all shadow tables/functions/privileges. Preserve the matching code revision and role definitions. `pg_dump` does not back up global roles; this test harness first creates the known NOLOGIN roles through the local bootstrap/schema.

For a local restore rehearsal, start a fresh isolated container, bootstrap the same roles/schema in its initial test database, then call `db.restore(dump)` to restore to its empty `matchmind_restore` database. Verify candidate/result hashes, original snapshot hashes, complete manifest reads, label revisions, denial for ordinary roles and private reader access. The integration suite performs this sequence. This does not establish a production Supabase restoration procedure.

For nondestructive rollback, execute **only inside that local container** `audits/phase6/rollback.sql`. It revokes shadow writer/operator execution and usage, preserves originals, evidence, roster, attempts, labels and results, and retains combined quota/monitor accounting while those tables occupy storage. Private readers can still inspect the archive. Do not drop the schema while inherited monitoring references its guard. For re-enablement in isolation, restore the exact `GRANT USAGE` / `GRANT EXECUTE` statements at the end of `schema.sql` after reviewing quota and job state; do not rerun table/role creation over an existing database. Closing/reverting this PR leaves hosted systems untouched because nothing is deployed.

## Interpretation

Only identity and the synthetic-coefficient M14 xgEdge adapter exist. A historical xgEdge candidate with these coefficients always abstains; no receipt-verified learned coefficient is available. Expected-points M14 ridge outputs are not probabilities, so no arbitrary conversion or blanket M14 activation is implemented. No live Dixon–Coles, recency or home-advantage settings are changed.

Reports distinguish scored, pending, void, ambiguous 90-minute labels, missing snapshots/results, fallback and successful-only cohorts; all model/market contrasts use identical fixtures. AET/PEN with unknown valid FT scores is withheld from this private accuracy evaluation, while the public grader remains unchanged. `abstention_rate` means explicit/missing-result fallback count divided by all roster jobs; missing snapshots have their own rate/count and must also be considered when judging usable coverage. Operational counts describe the exported roster/events, not a historical reconstruction of operations at `asOfUtc`.

All reports remain synthetic verification or historical exploration and set `confirmatory_eligible:false`. Supabase Auth/JWT/PostgREST/Edge, real private publisher/collector compatibility, authoritative real label collection, a learned model artifact, multiway confirmatory inference and adequate untouched sample size remain future work requiring separate review and approval. No sustained trial is launched or recommended by this command.
