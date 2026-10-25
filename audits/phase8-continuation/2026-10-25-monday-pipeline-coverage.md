# Monday outcome pipeline, coverage and evidence, 25 October 2026

Offline work only. No paid inference, no production or hosted change, no access
to the missing private Sunday checkpoint. See the
[unresolved recovery dependency](UNRESOLVED-RECOVERY-DEPENDENCY.md).

## Why the collector was changed

`audits/phase8/collect-results.mjs` ran its entire workflow at module scope, so
importing it started a database and performed a source read. No test could reach
it, and the Monday settlement path therefore had **no coverage at all**.

It is now split into `parseArguments`, `collectResults` and a `main()` guard of
the same form `recovery.mjs` already uses. Unchanged: the CLI arguments and their
defaults, the usage message, the restored-database setup, the label append, the
output file names, mode `0600`, the exclusive-create flag, the next-checkpoint
dump and checksum, and the printed summary. Injectable, and only for tests: the
label reader and the container name. The command line always uses the real
read-only reader.

## Test evidence

`audits/test/phase8-collect-results.integration.test.mjs` builds a synthetic
journal in a disposable network-none PostgreSQL, dumps it as a private
checkpoint, then runs the real `collectResults` against that checkpoint and
inspects the files it writes. Nothing is mocked except the label read.

The fixture declares a Sunday roster of four fixtures against five enrolled jobs,
plus one Saturday job over the same fixture as the settleable Sunday one.

| Requirement | How it is proven |
|---|---|
| Workflow executes | Real `collectResults` against a real restored dump; `mode` is `continuation` |
| File outputs | `study-<cycle>.json`, `report-<cycle>.json`, `private-weekend-backup-<cycle>.sql`, `backup-<cycle>.sha256` all present |
| Checkpoint chaining | The written checksum equals SHA-256 of the written dump, and the dump restores cleanly |
| Complete declared roster | 12 cohort slots survive from a roster of 4 with only 5 enrolled jobs; 13 records including Saturday |
| missing_enrollment | Exactly 7 virtual rows, every forecast `failed`, no `generated_at_utc` and no probabilities |
| Saturday and Sunday separated | `saturday.coverage.roster` 1, `sunday.coverage.roster` 4, `saturday_vs_sunday.n` 1 |
| Arm attribution | E never scores and abstains 3 times; per model A1, A2 and A3 scored on their own numbers |
| 90-minute regulation | A 2-1 extra-time win with 1-1 at 90 scores as a draw: Brier 0.78, not the 0.38 the home win would give |
| 48-hour void | Postponed 60 hours past kickoff counts in `coverage.void` |
| Abandoned and late | Abandoned 30 hours past kickoff stays `pending`, not void and not graded |
| 72-hour publication | An engine `outside_72_hour_window` exclusion survives settlement as a failure reason |
| No fabrication | Every `forecast` carries a real `generated_at_utc`; nothing else carries probabilities |
| Invalid recovery input | Corrupt checksum, missing `study.json`, a traversing backup name and a missing dump are each refused before any database starts |
| Nothing altered | Every pre-collection event keeps its hash in the next checkpoint, only 6 labels are added, and the retained reservation total is unchanged |

Where the 72-hour rule applies: it is enforced by the engine at issue time, as
`exclusion_reason: 'outside_72_hour_window'`, and by the application's own
publication gate. It is not a settlement rule, so the collector's duty is to
carry it through as a failure rather than re-apply it. That is what is tested.

## Verification

Commit `c9a1638`. GitHub CI on that commit: **247 tests, 247 pass, 0 fail, 0
skipped** on Node 20.20.2 and Node 24.19.0, both the push and pull_request runs.
The three new tests are reported individually as passing on both runtimes. The
previous baseline was 244.

The test was intermittent for two commits before that, and the cause is worth
keeping. Fixture times are minute-precision, so `utcKickoff` drops the seconds.
A test kickoff set a few seconds ahead truncates to as much as 14 seconds
**before** the moment its own forecast was issued, and the contextual comparison
then rejects its own Saturday baseline and reports no pairs. Measured across a
full minute of start offsets, the original scheme landed the truncated kickoff up
to 14 seconds early, while anchoring on the second whole minute ahead keeps it at
least 61 seconds late. The one passing run before the fix was luck in where the
second fell, not a Node version difference. Any future fixture that needs an
issued forecast and a settled result in the same run should anchor its kickoff on
a whole minute for the same reason.

The 15 database-backed integration tests cannot run on the Windows workstation,
because the harness pins `unix:///var/run/docker.sock` as a security control and
Windows Docker cannot serve it. CI is currently the only place they execute.

## Coverage gaps that remain

1. ~~**The journal shape is reconstructed, not produced.**~~ Closed by the
   [Sunday-to-Monday dry run](2026-10-25-full-cycle-dry-run.md), which generates
   the journal with the real `runSunday` and settles it through the real
   checkpoint writer, recovery verifier and collector. This file's own test still
   hand-builds its journal, deliberately, to pin the settlement rules on fixtures
   a clean runner would not produce.
2. The genuine network reader is injected away. `sourceURL` and `collectPages`
   have their own unit tests; no test performs a live read, by design.
3. The collector has never run against a real private Sunday checkpoint, because
   none is available.
4. One settleable fixture only, so calibration and paired intervals are exercised
   structurally rather than statistically.
5. `invalid_label` and `ambiguous_90_minute` are covered at unit level in
   `phase8-report.test.mjs` but not end to end through the collector.
6. File permission modes are not asserted, since Windows and Linux differ.
7. Two collector runs inside the same clock second would collide on the
   exclusive-create flag. Untested.

## Readiness for genuine Monday results

The pipeline is ready in code and proven on synthetic fixtures. It is **not**
ready to report on the real study, and will not be until the Sunday chain is
available, because there is nothing genuine to restore. No synthetic run will be
presented as an evaluation of the real study.
