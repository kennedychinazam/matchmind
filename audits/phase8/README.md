# Supervised private weekend testing

Read [REPORT.md](REPORT.md) and [AI_AND_MANUAL_CI.md](AI_AND_MANUAL_CI.md). The October 24 run is real and private. AI calls, scheduling and hosted writes are disabled. Ordinary regression CI uses synthetic data only.

## Current private archive

The actual supervised archive is outside Git at `/workspace/matchmind-tools/phase8/saturday-run`; its source packet is `/workspace/matchmind-tools/phase8/raw-source.json`. Files are mode0600 and directories0700. They include `study.json`, `engine-output.json`, `report.json`, the complete SQL backup and its checksum. **Retrieve and privately retain these before the transient workspace disappears.** Git, public artifacts and the aggregate report are not a private data backup.

Source capture: 93,680 complete rows in the engine's 55-competition/60-month scope. The private roster has 145 fixtures: 54 Saturday and 91 Sunday kickoffs. All were forecast on Saturday; this is **one executed Saturday observation window**, not a completed Sunday run. Eighty-six passed the public gate; other probability outputs retain their withholding/scope reasons. Eighty-three prior originals remain contextual records, not new contemporaneous E forecasts.

## Safe commands

Use Node20.20.2/24.19.0, installed Chromium/Playwright, the existing local Docker socket and cached pinned PostgreSQL image. No Supabase stack installation is needed. Never run `robot/publish.mjs`, a production collector, Edge deployment or hosted SQL migration.

```sh
node --test audits/test/*.test.mjs
npm exec --yes --package=node@20.20.2 -- node --test audits/test/*.test.mjs

# An explicit supervised, READ-ONLY export of existing MatchMind Data API records.
# Use a new private directory; no real API-Football or AI request is made.
node audits/phase8/collect-source.mjs /private/weekend-sunday --read-only
node audits/phase8/run-weekend.mjs /private/weekend-sunday/run \
  /private/weekend-sunday/raw-source.json
```

The real runner only accepts the fixed October24/25 UTC observation dates. It declares every target job before running the model, stores originals separately, and never removes failed jobs. It refuses incomplete packets/capacity failures. Prediction eligibility uses the unchanged72-hour rule and actual pre-kickoff persistence. New writes require a separate server confirmation **after the forecast transaction commits**; an absent/late confirmation becomes a visible failure. Synthetic `nowUtc` exists only on the engine test/replay API, never the real runner.

The source exporter uses existing public read permissions and the app's already-public publishable key. Only fixed GET endpoints/tables are allowed; no service-role credential, arbitrary URL, RPC, Edge Function or mutation method is accepted. It loads every fixed competition, including resting/no-upcoming histories. Initial/final per-competition counts and ordered keyset pages are retained; a mismatch fails the export. Reads are **as collected, not one atomic hosted snapshot**. Historical mutable values receive genuine local receipt-now timestamps and cannot be used to assert earlier availability. Unrequested advanced fields remain unavailable, not imputed. Order is explicitly date/fixture ID; it does not reconstruct historical device-cache ties.

## Outcomes and Monday evaluation

The first actual supervised poll executed at15:13 UTC on October24. All145 labels remained pending; no score was claimed. A later **supervised** poll restores the private archive into a new network-isolated local PostgreSQL container, reads current outcome fields via GET, appends server-received revisions, generates a report and writes a new full dump/checksum:

```sh
# First poll from the original archive:
node audits/phase8/collect-results.mjs /private/weekend-run

# Every subsequent poll MUST explicitly select the latest verified predecessor:
node audits/phase8/collect-results.mjs /private/weekend-run \
  private-weekend-backup-CYCLE.sql backup-CYCLE.sha256
```

Do not repeatedly restore the original dump and silently fork away correction history. Keep the selected predecessor and resulting report/hash chain. The actual first updated Saturday dump is `private-weekend-backup-20261024151247326575.sql`, with `backup-20261024151247326575.sha256` beside it. New output filenames include their own cycle ID; never overwrite the original or older revisions. No scheduler has been installed. Resume supervised work on Sunday/Monday; no future execution is promised by this repository.

For Monday, use verified FT regulation scores; require valid explicit FT scores for AET/PEN. Preserve the separate48-hour void anchor for each original/refreshed issue. Select label revisions strictly before the fixed report cutoff. Show pending/void/malformed/missing counts. Existing originals are contextual and usually lack receipt-eligible original-time odds; do not substitute today's odds. New model/market and AI/model comparisons use identical jobs and frozen input hashes. Daily windows remain separate; repeated fixtures across windows are correlated and are not independent new matches.

## Backup, stop and capacity

Each run writes a full private dump and SHA256. The dump preserves complete packet bodies, originals, roster, all arm failures, forecast receipts, labels and reservations. `pg_dump` excludes global roles: initialize the inherited known NOLOGIN roles first, restore into an empty isolated database, then verify source/event hashes, counts and permissions. The actual145-job backup has been restored and verified. Never run a restore against production.

Apply `audits/phase8/rollback.sql` **only in the isolated container** to revoke the new writer; retain all data and budget liability. Re-enable only the reviewed grant, never by rerunning schema creation over an archive. Closing/reverting the draft PR is the code rollback; nothing is deployed.

The original combined research relation/index ceiling remains262144000bytes (250MiB). All new events use the same quota lock/accounting; no automatic increase. The first run used8,568,832bytes. Private raw files, backup generations, encryption copies, WAL and containers require separate measured capacity; they are not hidden in that relation figure. Retained Phase8 private files after the first outcome poll total135,610,851bytes. Inspect both relation and file growth before another run; stop, export/verify private archives or reduce **future enrollment** if capacity cannot support complete evidence and outcomes. Never truncate required history or discard failed jobs to continue. A disposable CI run cannot authorize discarding the only private copy.
