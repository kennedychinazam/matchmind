# Phase 3 local staging runbook

This change is confined to `codex/phase3-immutable-snapshots`. It adds an offline research subsystem; `index.html`, Smart Bet, statistical calculations, the robot and production workflows are unchanged. The draft PR targets `feature/matchmind-quality-upgrade`.

## Scope and trust

Use synthetic data and the local Docker socket exclusively. No Supabase credentials, provider keys, publisher passwords or paid services are needed. Do not run the production robot, including its dry-run mode. Never apply these SQL files to `toqfdrcjzwnlydqekude`.

The automated DB harness creates a uniquely named PostgreSQL container for each integration-test process using a pinned image. `--network none`, no ports, tmpfs storage and docker-exec/Unix-socket access isolate it. Containers are removed after tests. Docker-daemon users remain administrators of this disposable environment. The Compose alternative below has the same network restrictions. Trust authentication applies only inside that isolated container; it is not a production authentication design.

## Dependencies and all tests

Prerequisites: local Docker daemon at `/var/run/docker.sock`, Node 20 or newer, npm and Chromium at `/usr/bin/chromium` (or set `MM_TEST_CHROMIUM` to an installed local executable). No hosted DB access is used.

From the repository root:

```sh
npm ci --prefix audits --ignore-scripts --no-audit --no-fund
docker --host=unix:///var/run/docker.sock pull postgres:17-bookworm@sha256:858bb5e98eed02eb8cafbcdc007f9a65d1b613972028944a8ec2133ccaf80d27
node --test audits/test/*.test.mjs
npm exec --yes --package=node@20.20.2 -- node --test audits/test/*.test.mjs
node audits/staging/measure.mjs
```

The exact Node 20 runtime tested is 20.20.2; the workspace runtime is 24.19.0. The browser dependency is locked to playwright-core 1.63.0; it uses the installed Chromium and does not download a browser or access a live website. Its context intercepts every application request: synthetic HTML is fulfilled locally and all other requests are aborted, including CDN, Supabase, API-Football and AI endpoints. It opens the Smart Bet tab in guest mode and compares behavior with the parent revision. It is not an authenticated publisher UI test.

All tests, including DB and browser tests, run under the requested `node --test audits/test/*.test.mjs` command. There are no silently skipped infrastructure tests. Missing Docker/Chromium fails the run. The first 34 audit regressions remain intact.

## Manual local migration

These are transactional, additive research SQL artifacts, not a production Supabase migration history. `bootstrap.sql` deliberately creates synthetic source tables and test roles; never apply it to an existing application database. Migration filenames can be generated through the Supabase CLI later after hosted staging review; no Supabase CLI or production deployment is involved here.

```sh
docker compose -f audits/staging/compose.yml up -d
docker compose -f audits/staging/compose.yml exec -T db pg_isready -U postgres -d matchmind_test
# If startup is still in progress, repeat pg_isready until it reports accepting connections.
docker compose -f audits/staging/compose.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d matchmind_test < audits/staging/bootstrap.sql
docker compose -f audits/staging/compose.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d matchmind_test < audits/staging/snapshot-schema.sql
docker compose -f audits/staging/compose.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d matchmind_test < audits/staging/evidence-manifests.sql
docker compose -f audits/staging/compose.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d matchmind_test < audits/staging/permissions.sql
docker compose -f audits/staging/compose.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d matchmind_test < audits/staging/capture-monitoring.sql
docker compose -f audits/staging/compose.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d matchmind_test < audits/staging/capture-hooks.sql
```

Apply bootstrap/base schema and `evidence-manifests.sql` once to a fresh disposable database. The evidence migration adds shared manifest tables and a nullable manifest FK; existing inline snapshot links remain readable and are not rewritten. `capture-monitoring.sql` is reapplicable and preserves operational state; `capture-hooks.sql` replaces functions/trigger transactionally. For an existing isolated database at the initial reviewed schema (`33ee671`), first back it up, then apply `evidence-manifests.sql`, `permissions.sql`, `capture-monitoring.sql`, and `capture-hooks.sql` in that order. Do not reapply bootstrap/base schema. No Supabase migration has been executed.

Reapplying `permissions.sql` revokes research function grants; follow it with monitoring and capture-hook scripts to restore only the designated facade/shadow permissions. Do not regrant the raw capture function to publisher/operator roles.

## Tables and permissions

- `research.observations`: immutable field value versions, server receipt/observation times and source hashes. Unknown timing stays null. Indexes cover fixture/field/as-of selection, collector runs and fixed-size metadata candidate lookups.
- `research.prediction_snapshots`: immutable original probabilities, pick, kickoff, issuance/build lineage, source JSON and a shared manifest FK.
- `research.snapshot_evidence`: retained legacy inline links. Existing snapshots remain unchanged and readable.
- `research.evidence_chunks` and `research.evidence_chunk_members`: content-addressed immutable sets of at most 500 ordered observation references with observation FKs. Shared chunks avoid copying the history for each prediction.
- `research.evidence_manifests` and `research.evidence_manifest_chunks`: immutable hashed selection metadata, ordered chunk hashes, count and normalized FK links. Readers verify header hash, linked chunk order, per-chunk hash and complete count.
- `research.shadow_forecasts`: separate private candidate outputs and original snapshot lineage.
- `research.control`: privileged operational enable/evidence-budget configuration.
- `research.capture_health`: private operational state per fixture identifier, with status, server times, attempts/failures, sanitized SQLSTATE and successful snapshot FK. It contains no probability, pick, raw error message, source payload or credentials.

All ten tables enable RLS. Public/anon/authenticated have no schema, table or function access. `research_reader` can read evidence/manifests but cannot see operational health. `research_collector` can execute the observation/shadow writers. `research_publisher` can insert synthetic source predictions and execute `try_capture_prediction`; it cannot execute raw `capture_prediction`. `research_operator` is NOLOGIN and has only health SELECT, private backlog lookup and monitored repair EXECUTE. It cannot directly UPDATE/DELETE/TRUNCATE monitoring or evidence.

Eight evidence tables have UPDATE/DELETE/TRUNCATE guards; control and health are intentionally mutable operational tables. Narrow private SECURITY DEFINER functions have fixed search paths and fully qualified objects. Owners/DB administrators remain a trusted boundary. Local role tests are not hosted Supabase Auth/PostgREST validation.

## Receipt, reconstruction and model integration

`appendObservedFields` accepts provider-response values already held by a collector, without making a provider request. It rejects caller observation/receipt timestamps, unknown envelope fields, unsupported feature names and oversized values. SQL independently enforces the field allowlist and six-digit timestamp contract, rejects unsafe odds identifiers, stamps `clock_timestamp()` and never trusts provider chronology as proof of earlier availability. Historical completed stats need explicit played time before receipt. Corrections append; unchanged successive values reuse the existing stored observation ID. A return to an older value after a correction creates a new version with a new receipt.

SQL rejects nonfinite expected goals and normalizes capture serialization to UTC so retries across session timezones remain idempotent. SQL shadow writes require valid non-null manifest/configuration hashes, derive the cohort from original issuance, and enforce exact baseline probabilities for every fallback mode.

The database captures the source row that actually won the `fxid` insert. Original `made_at` remains client issuance; it is never replaced with database receipt. `at_issue` denotes capture by the actual INSERT trigger within ten seconds of that timestamp. Explicit repair calls and older imports are `late_import`. This classification does not certify complete model-input replay. Captures are conservatively marked `replay_eligible=false` because Build 355 did not persist its ordered engine inputs/configuration. `model_version=build355` is explicitly derived from the original build identifier, not an independently recorded model registry version.

The offline adapter uses only archived observations with server receipt equal to the recorded observation time and at/before issuance. It compares microseconds, rejects future corrections, and requires played-time provenance for historical outcome-derived stats. The existing `providerExtras` and `matchFeatures` functions are read from the unchanged app and evaluated in a VM without network APIs; their code hash is recorded. No model is fitted or promoted, and no spent holdout runs. Missing required evidence or disabled/unavailable adjustment returns exactly the saved baseline triple/pick in a separate shadow record.

Two hash domains are explicit: `canonical-json-v1` for JS manifests and `pg-jsonb-v1` for stored database payloads. They are not interchangeable. Database payloads can be verified with PostgreSQL `digest(envelope::text,'sha256')`. Hashes do not prove source authenticity. `fixture_version_hash` in the current capture envelope fingerprints the fixture lineage frozen in the source prediction, not a complete historical fixture-row version. Field observations and evidence IDs carry separately versioned provider evidence. Full baseline recomputation needs a future ordered engine-input/configuration manifest.

## Durable capture failures and operator repair

The source INSERT trigger invokes `research.try_capture_prediction(fixture_id)`. Capture work occurs in an inner savepoint. On error its research writes roll back, then operational health is recorded in the outer source-publication transaction. The facade returns a snapshot ID or sanitized `{error:{code}, monitor_recorded}` receipt. Ordinary research failures no longer depend on warnings for detection.

Health states are `captured`, `pending`, `disabled`, and `repaired`. Attempts/failures are monotone; original failure time and last failure SQLSTATE survive repair. Intentional capture pauses are recorded as `disabled`. Successful explicit retry updates status and references the single original snapshot without rewriting or republishing the source prediction.

Health writes bypass the research evidence admission check so a 250 MiB research-budget failure can still be recorded. There is at most one health row per requested fixture identifier, not an unbounded event log. Trusted publishers/operators must not submit arbitrary identifiers. The table still consumes physical database storage; it is not an independent storage service or disk quota exemption.

Use a private operator session on the local container:

```sql
SET ROLE research_operator;
SELECT * FROM research.capture_backlog(100, 0);
-- Page by passing the last returned fixture_id as the second argument.
SELECT fixture_id,state,attempts,failures,last_sqlstate,repaired_at
FROM research.capture_health ORDER BY last_attempt_at DESC;
SELECT research.try_capture_prediction(123); -- substitute a fixture from the backlog
```

`capture_backlog` reconciles public source IDs against actual snapshot existence and unresolved health, so it finds `unrecorded` missing snapshots even if monitoring itself failed. Its page size is validated (1–1000); it reveals no research data to application users. Operators should execute reconciliation as part of their private staging checks; no scheduled production monitor or alert service was deployed.

If the health sink/entrypoint itself cannot write, the trigger still preserves the original source insert and returns a warning as a fallback. The backlog remains the independent read-based backstop when the database is available. If the entire DB is unavailable, lacks physical storage to commit the original publication, or denies reconciliation reads, an in-database table cannot guarantee durability or alerts. External availability monitoring, reserved physical capacity, and private operational scheduling remain staging requirements.

The local publisher harness checks the monitored receipt, retries only designated transient capture errors (up to three attempts), never repeats publication due to research failure, and enforces a ten-second total deadline. The real transport must honor AbortSignal and set an appropriate DB statement timeout. A lost/timeout response does not undo a committed capture; repair is idempotent. No real publisher integration was deployed.

## Storage, egress and API budgets

Admission limits: 16 KiB field values; 64 KiB prediction/shadow envelopes; at most 500 references per evidence chunk; 100,000 total references/200 chunks per manifest; 100 observation rows and 2 MiB per collector request; proposed 250 MiB research table/index admission budget. Complete required evidence above the manifest ceiling fails explicitly and is queued for review, never truncated. These are not filesystem/WAL/billing quotas. Payload sizes differ between compact JSON and PostgreSQL jsonb text; SQL is the final authority.

`m14-dependencies-v1` preserves all target-team result history because half-split, home-edge and history-count helpers have no fixed lookback. It keeps the full current/previous competition seasons for standings/round-robin checks, target-team provider data within 240 days, competition referee context within 540 days, and cross-competition schedule evidence within the 21-day congestion/4-day distraction windows plus the latest older fixture needed for capped rest days. It selects eligible versions before taking the latest value; a newer stat without played-time proof cannot displace an older verified version. Referee identity normalization remains exclusively in the existing JS builder; SQL retains the bounded competition context so Unicode whitespace/country variants cannot prune required referee matches. No model constants or formulas changed.

A metadata candidate index limits unrelated archive work before fetching full field versions. Its fixed-size MD5 key is only an index routing hint; full JSON equality is checked, and all integrity hashes remain SHA-256. Materialized `(fixture_id,field_name)` requirements avoid a bad nested-loop plan. Existing private observation data, not mutable fixture rows, supplies every value.

The scaling regression compares every existing M14 feature with the complete as-of history, including newer unverified corrections, Unicode referee names, and an unrelated malformed record. Initial dataset: 51,866 observations across five seasons/two competitions; selected evidence: 10,444 references in 21 chunks. An additional 2,000 unrelated fixtures add 24,000 fields before a second prediction. It checks identical features, capture under a five-second local regression ceiling, immutable replay, and chunk reuse. Recorded final measurements are in the implementation report. Full original baseline-input replay remains incomplete; model-compatible M14 evidence is not proof of the old baseline's exact input sequence.

An initial complete manifest allocated about 4.8 MiB of research table/index pages; the second prediction reused history chunks and added about 208 KiB. These are local allocated-page measurements, not billing estimates. Growth includes normalized FK/index overhead; future storage projections must include shared history chunks, new observation versions and private health records. The old 82 MiB/month illustration is not a validated forecast for this expanded archive.

No research read is added to normal boot and `?blobs=1` stays opt-in. Current production storage/API/provider impact is zero. Future private transport needs one monitored capture call per fixture (plus bounded retries), collector batches and paged/chunked evidence reads; a manifest is not one unbounded public boot payload. Actual Supabase egress, JWT/RPC overhead, corpus growth and the <=5% representative publisher-runtime target remain unverified. Admission serialization also means concurrent large captures need staged throughput/statement-timeout testing.

Retain referenced evidence for the experiment lifetime; no automatic evidence purge or paid capacity expansion. Stop collection and report budget exhaustion. Design compressed exports/retention separately before extending the experiment.

## Local backup, restore and rollback

The integration suite exercises pg_dump/restore into a second local database, comparing records/hashes and restored reader/function permissions. Backup includes ownership and ACLs; omitting them would lose security settings. It does not claim production restoration readiness.

For the manual local container, keep exports outside the repository:

```sh
mm_phase3_backup_dir=$(mktemp -d /tmp/matchmind-phase3-backup.XXXXXX)
chmod 700 "$mm_phase3_backup_dir"
docker compose -f audits/staging/compose.yml exec -T db pg_dump -U postgres -d matchmind_test > "$mm_phase3_backup_dir/database.sql"
docker compose -f audits/staging/compose.yml exec -T db pg_dumpall -U postgres --globals-only --no-role-passwords > "$mm_phase3_backup_dir/roles.sql"
chmod 600 "$mm_phase3_backup_dir"/*.sql
docker compose -f audits/staging/compose.yml exec -T db createdb -U postgres matchmind_restore
docker compose -f audits/staging/compose.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d matchmind_restore < "$mm_phase3_backup_dir/database.sql"
```

Roles already exist in this test cluster. For restoration into a different disposable cluster, restore the reviewed role definitions first. Verify row counts, payload hashes, owners, grants, RLS policies, indexes, functions and trigger definitions; test that reader SELECT works while public writes/EXECUTE fail.

Non-destructive rollback:

```sh
docker compose -f audits/staging/compose.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d matchmind_test < audits/staging/rollback.sql
```

This disables capture through `research.control.enabled` and revokes writer EXECUTE. The INSERT trigger records disabled health and preserves the original row while disabled. Preserve/export research data and verify the source publisher still inserts correctly. Forward repair appends evidence corrections or retries capture against the original source row; it never overwrites a snapshot. Re-enable only after reviewing errors, raising no paid quota automatically, reapplying permissions, monitoring and capture-hook scripts in order. Destroy the synthetic container only after any needed exports: `docker compose -f audits/staging/compose.yml down` discards tmpfs data.

Before any future production backend change, separately obtain authorization, privately export all five function sources and schema/policies/column grants/indexes/extensions/cron, create a recoverable database backup, and restore-test in isolation. Git/Build 355 recovery does not restore Supabase data, function secrets or deployed functions. No production backup/export or migration was performed here.

## Acceptance evidence and remaining staging gates

Automated coverage includes original 34 regressions; malformed probabilities/timestamps/schema/size; server receipt/backdating; unknown/null states; duplicate IDs and corrected versions; private role denials; atomic batches; storage limits; publisher failure/retry/timeout behavior; pre-issue odds; snapshot-to-existing-feature replay; exact identity fallback; private shadow writes; 47h59m/48h/later reschedules; backup/restore with ACLs, additive migration from the original reviewed schema, private durable failure/repair status and reconciliation after a failed monitor write; and offline browser boot/Smart Bet parity.

The reschedule test deliberately records that a derived unplayed void may later read LIVE/pending. The existing app does not persist a terminal settlement event. A future settlement ledger could append a terminal `void_late` event keyed by prediction snapshot and settlement-policy version and make later grading honor it. That would be a separate grading change requiring review; this task changes no production grading.

Future Supabase staging must verify:

1. Auth/JWT identity mapping, actual column grants, PostgREST/RPC exposure and error receipts, with private-schema restrictions maintained.
2. Integration with the privately managed collector and publisher, disabled paid AI, full source backups and restored DB/function recovery.
3. Stable capture-time configuration/model lineage and exact ordered baseline-input manifest before claiming complete baseline input replay.
4. Actual storage/index/WAL/egress, collector HTTP quotas, representative publisher runtime and the <=5% target under the real workload.
5. A frozen candidate before its first untouched prospective test issue, exact material-improvement threshold and cluster-aware inference preregistration. The November 1 cohort label alone does not establish confirmatory evidence.

No production write, API-Football request, paid AI call, merge or deployment is part of these instructions.
