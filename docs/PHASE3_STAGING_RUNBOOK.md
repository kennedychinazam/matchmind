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
docker compose -f audits/staging/compose.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d matchmind_test < audits/staging/permissions.sql
docker compose -f audits/staging/compose.yml exec -T db psql -X -v ON_ERROR_STOP=1 -U postgres -d matchmind_test < audits/staging/capture-hooks.sql
```

Apply bootstrap/schema/hooks once to a fresh database. A duplicate apply errors and rolls back its transaction; it is not a destructive reset. `permissions.sql` is reappliable but revokes all research function grants first; if hooks are already installed, restore their explicit grants afterward:

```sql
GRANT EXECUTE ON FUNCTION research.capture_prediction(bigint) TO research_publisher;
GRANT EXECUTE ON FUNCTION research.append_shadow(jsonb) TO research_collector;
```

Use `SET ROLE research_collector` for `research.append_observations(jsonb)` and `research.append_shadow(jsonb)`, `research_publisher` for source inserts/capture repair, and `research_reader` for research SELECTs. The real Supabase authenticated publisher is not wired to these local roles.

## Tables and permissions

- `research.observations`: immutable field value versions, server receipt/observation times and source hashes. Unknown values/times remain explicitly null. Indexes cover fixture/field/as-of selection and collector run.
- `research.prediction_snapshots`: original source probabilities, market/pick, expected goals, issuance, frozen kickoff, build/model lineage, source-prediction JSON and evidence IDs. Unique fixture/issuance/build lineage and issue-time index.
- `research.snapshot_evidence`: composite snapshot/observation key and FKs, evidence role and source fixture; reverse observation index. No cascade from mutable source tables.
- `research.shadow_forecasts`: separate private probability outputs, immutable snapshot FK, candidate/configuration/manifest hashes and constrained `shadow` visibility. Unique candidate/configuration per snapshot.
- `research.control`: privileged operational enable/budget state; not research evidence and intentionally administratively mutable.

All five tables enable RLS. Public/anon/authenticated have no schema, table or research function privileges. Reader SELECT has explicit policies. The collector/publisher have only designated function EXECUTE privileges, not direct evidence mutations. UPDATE/DELETE/TRUNCATE guards protect the four evidence tables. Narrow private SECURITY DEFINER functions have fixed `pg_catalog` search paths and fully qualified objects. `research_owner` is NOLOGIN and trusted; DB administrators can still bypass/drop guards. Local role tests and backup/restore check these boundaries.

## Receipt, reconstruction and model integration

`appendObservedFields` accepts provider-response values already held by a collector, without making a provider request. It rejects caller observation/receipt timestamps, unknown envelope fields, unsupported feature names and oversized values. SQL independently enforces the field allowlist and six-digit timestamp contract, rejects unsafe odds identifiers, stamps `clock_timestamp()` and never trusts provider chronology as proof of earlier availability. Historical completed stats need explicit played time before receipt. Corrections append; unchanged successive values reuse the existing stored observation ID. A return to an older value after a correction creates a new version with a new receipt.

SQL rejects nonfinite expected goals and normalizes capture serialization to UTC so retries across session timezones remain idempotent. SQL shadow writes require valid non-null manifest/configuration hashes, derive the cohort from original issuance, and enforce exact baseline probabilities for every fallback mode.

The database captures the source row that actually won the `fxid` insert. Original `made_at` remains client issuance; it is never replaced with database receipt. `at_issue` denotes capture by the actual INSERT trigger within ten seconds of that timestamp. Explicit repair calls and older imports are `late_import`. This classification does not certify complete model-input replay. Captures are conservatively marked `replay_eligible=false` because Build 355 did not persist its ordered engine inputs/configuration. `model_version=build355` is explicitly derived from the original build identifier, not an independently recorded model registry version.

The offline adapter uses only archived observations with server receipt equal to the recorded observation time and at/before issuance. It compares microseconds, rejects future corrections, and requires played-time provenance for historical outcome-derived stats. The existing `providerExtras` and `matchFeatures` functions are read from the unchanged app and evaluated in a VM without network APIs; their code hash is recorded. No model is fitted or promoted, and no spent holdout runs. Missing required evidence or disabled/unavailable adjustment returns exactly the saved baseline triple/pick in a separate shadow record.

Two hash domains are explicit: `canonical-json-v1` for JS manifests and `pg-jsonb-v1` for stored database payloads. They are not interchangeable. Database payloads can be verified with PostgreSQL `digest(envelope::text,'sha256')`. Hashes do not prove source authenticity. `fixture_version_hash` in the current capture envelope fingerprints the fixture lineage frozen in the source prediction, not a complete historical fixture-row version. Field observations and evidence IDs carry separately versioned provider evidence. Full baseline recomputation needs a future ordered engine-input/configuration manifest.

## Capture failures and retries

The INSERT trigger contains research errors in a database subtransaction and emits a fixture ID/SQLSTATE warning. It never suppresses or changes the source prediction. The staging publisher harness performs a separate capture receipt check and returns `published:true` plus an explicit failure/repair status when research capture fails. It retries only capture, up to three attempts for designated transient SQLSTATEs; it never repeats publication because of research failure. Permission, invalid payload and storage failures are visible and not retried as transient errors. A ten-second total deadline bounds the harness; an injected transport must honor its AbortSignal and its own DB statement timeout. A timeout cannot undo an already committed capture; later repair is idempotent.

This separate receipt check is essential: PostgreSQL warnings alone are not evidence that a hosted PostgREST client will receive an actionable error. Hosted staging must establish the actual error/receipt transport before any real publisher integration. No production publisher has been changed.

## Storage, egress and API budgets

Proposed admission limits: 16 KiB field value; 64 KiB prediction/shadow envelope; 500 linked observations; 100 observation rows per collector request; 2 MiB request. SQL serializes budget admission on the control row and checks research table/index bytes plus conservative incoming-size estimates against 250 MiB. This is an operational admission budget, not a filesystem/WAL/billing hard quota. Payload sizes differ slightly between compact JSON and PostgreSQL jsonb text; SQL is the final authority. Oversize data fails explicitly without truncation or invalidating publication.

Deduplicate unchanged values; store allowlisted fields rather than full provider responses. Do not add research reads to normal boot or enable `?blobs=1` by default. Source/provider calls added by this implementation: zero. Current production storage/API impact: zero because nothing is deployed or wired into production.

Illustrative future budget from the approved plan: 2,000 field versions/day at 1 KiB plus 100 envelopes/day at 8 KiB is about 2.73 MiB/day or 82 MiB/30 days before indexes, WAL, backup copies, manifests and shadow forecasts. At a maximum batch size of 100 field rows, 2,000 rows can be sent in 20 full observation-writer calls/day; actual request counts depend on batch utilization and source cadence. A publisher receipt check is one request per capture batch design/transport, with at most two transient retries. The implemented SQL capture function handles one source fixture per call; no claim of a 100-prediction hosted batching endpoint is made. Every retry is counted when measuring hosted staging usage.

Local measurement on 500 synthetic snapshots: mean envelope 1,264 bytes; total research table/index allocation 1,277,952 bytes. Five 100-insert batches measured a median 1 ms without capture versus 50 ms with capture, approximately 0.49 ms incremental server time per prediction. Raw insert relative overhead was 4,900%; this does not satisfy a 5% raw-insert gate. The approved <=5% total publisher-runtime target remains unverified against a representative staged application workload. These figures exclude network, JWT, PostgREST, RLS under hosted identities and real feature volumes. Re-run `measure.mjs` for this machine; timings are observations, not performance guarantees.

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

This disables capture through `research.control.enabled` and revokes writer EXECUTE. The INSERT trigger returns the original row immediately while disabled. Preserve/export research data and verify the source publisher still inserts correctly. Forward repair appends evidence corrections or retries capture against the original source row; it never overwrites a snapshot. Re-enable only after reviewing errors, raising no paid quota automatically, reapplying permissions and restoring the two capture/shadow grants above. Destroy the synthetic container only after any needed exports: `docker compose -f audits/staging/compose.yml down` discards tmpfs data.

Before any future production backend change, separately obtain authorization, privately export all five function sources and schema/policies/column grants/indexes/extensions/cron, create a recoverable database backup, and restore-test in isolation. Git/Build 355 recovery does not restore Supabase data, function secrets or deployed functions. No production backup/export or migration was performed here.

## Acceptance evidence and remaining staging gates

Automated coverage includes original 34 regressions; malformed probabilities/timestamps/schema/size; server receipt/backdating; unknown/null states; duplicate IDs and corrected versions; private role denials; atomic batches; storage limits; publisher failure/retry/timeout behavior; pre-issue odds; snapshot-to-existing-feature replay; exact identity fallback; private shadow writes; 47h59m/48h/later reschedules; backup/restore with ACLs; and offline browser boot/Smart Bet parity.

The reschedule test deliberately records that a derived unplayed void may later read LIVE/pending. The existing app does not persist a terminal settlement event. A future settlement ledger could append a terminal `void_late` event keyed by prediction snapshot and settlement-policy version and make later grading honor it. That would be a separate grading change requiring review; this task changes no production grading.

Future Supabase staging must verify:

1. Auth/JWT identity mapping, actual column grants, PostgREST/RPC exposure and error receipts, with private-schema restrictions maintained.
2. Integration with the privately managed collector and publisher, disabled paid AI, full source backups and restored DB/function recovery.
3. Stable capture-time configuration/model lineage and exact ordered baseline-input manifest before claiming complete baseline input replay.
4. Actual storage/index/WAL/egress, collector HTTP quotas, representative publisher runtime and the <=5% target under the real workload.
5. A frozen candidate before its first untouched prospective test issue, exact material-improvement threshold and cluster-aware inference preregistration. The November 1 cohort label alone does not establish confirmatory evidence.

No production write, API-Football request, paid AI call, merge or deployment is part of these instructions.
