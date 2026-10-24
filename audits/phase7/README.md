# Phase 7 local operations

Read [REPORT.md](REPORT.md), [DATA_CONTRACT.md](DATA_CONTRACT.md) and [PILOT_PROTOCOL.md](PILOT_PROTOCOL.md). This is synthetic training feasibility only; no football authority or model activation is configured.

Use the existing Node 20.20.2/24.19.0 and cached, digest-pinned PostgreSQL image from `audits/test-support/local-db.mjs`. No Supabase install, new image, hosted URL, collector, publisher or provider call is needed. Docker/database/repository administrators must be trusted. CI uses the same inherited image on its separate disposable runner.

From the repository root:

```sh
node --test audits/test/*.test.mjs
npm exec --yes --package=node@20.20.2 -- node --test audits/test/*.test.mjs
node audits/phase7/availability.mjs
node audits/phase7/run-synthetic.mjs /workspace/matchmind-tools/phase7-new \
  > /tmp/matchmind-phase7-aggregates.json
```

Use a fresh directory **outside Git**. The runner creates private files and an ephemeral synthetic signing key, seeds artificial fixtures through local SQL, and always closes its network-isolated temporary container. Receipts are actual server time; artificial outcomes have explicitly zero-duration events. Typical complete proof is roughly 40 seconds, including bounded waits. It never runs the production publisher/collector. Its three-table schema is additive initialization on a fresh local database, not an idempotent hosted migration.

Private outputs: `training.json`, `validation.json`, `artifact.json`, `freeze.json`, `protocol.json`, `policy.json`, `synthetic-signing-key.pem`, `private-training-backup.sql`; directory mode 0700, files mode 0600. Do not publish any raw packet, private key or SQL dump. Only deliberately inspected aggregate results are suitable for this public repository. Keep matching source revision and file hashes with the private archive. A fresh run has different actual receipts/IDs/keys; the same frozen packet reproduces exactly.

Replay needs the frozen packets and **separately trusted public policy**, not the private key:

```sh
node audits/phase7/reproduce.mjs /workspace/matchmind-tools/phase7-new \
  /workspace/matchmind-tools/phase7-new/policy.json > /tmp/phase7-replay24.json
npm exec --yes --package=node@20.20.2 -- node audits/phase7/reproduce.mjs \
  /workspace/matchmind-tools/phase7-new \
  /workspace/matchmind-tools/phase7-new/policy.json > /tmp/phase7-replay20.json
cmp /tmp/phase7-replay20.json /tmp/phase7-replay24.json
```

The proof generates its own synthetic public policy. Real data would require an independently approved authority; accepting an arbitrary export's bundled public key is not verification. The current verifier rejects real football datasets entirely. Check out the matching code revision before reproducing old packets; version/hash mismatches intentionally fail.

For programmatic use: create `localDatabase`, inspect the cached image, start it, apply inherited staging bootstrap/snapshot/manifests/permissions/monitoring/capture files, install Phase 6 with `repository(db).install()`, then Phase 7 with `trainingRepository(db).install()`. Export the full declared job roster, prepare/verify, fit only the frozen training packet, store its dataset, register artifact plus validation-protocol hash, preserve the signed server receipt, then export and validate a later disjoint cohort. The tests demonstrate this sequence. No network connection string is accepted by this bridge.

Monitor roster/status counts, rejected reasons, actual combined research/training/shadow relation/index bytes, file/WAL capacity and private command failures. Keep every failed job; repair only from genuinely persisted pre-issue inputs. Re-registration must be identical; changed artifacts/configuration require a new version. Physical disk exhaustion can prevent a database failure record; retain safe command outcomes outside it and reconcile with the roster. The 250 MiB cap is admission accounting, not a physical disk guarantee. Pilot enrollment and stop monitoring are proposals only, not an unattended service.

The private full SQL dump includes the new tables/functions/grants but not global roles. Rehearse restoration into a new isolated container/empty database using the inherited harness: initialize the known NOLOGIN roles through bootstrap/Phase 6 schema, then `db.restore(dump)`. Verify snapshot/manifest/artifact hashes, roster counts and permissions before accepting the restore. The integration suite exercises local restore and new-role denial; it does not establish Supabase Auth or hosted restoration.

For nondestructive stop, apply `audits/phase7/rollback.sql` **only through the isolated local database**. It revokes only the two new training writer functions from `shadow_operator`; inherited Phase 6 remains available and all data/quota accounting remains. Re-enable only the exact reviewed grants at the end of `schema.sql`; do not rerun table creation over an existing archive. Closing/reverting this undeployed PR is the code rollback. Never run these scripts against either hosted project.
