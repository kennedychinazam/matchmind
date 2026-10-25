# Sunday-to-Monday dry run, 25 October 2026

Synthetic fixtures, synthetic outcomes, one disposable network-none PostgreSQL.
No paid inference, no provider contact, no production or hosted change, no use of
the Saturday archive. See the
[unresolved recovery dependency](UNRESOLVED-RECOVERY-DEPENDENCY.md).

## What this adds over the previous coverage

The Monday collector was covered against a journal the test built by hand, so a
drift in what the runner actually writes would not have failed anything. That was
the largest gap named in the
[coverage note](2026-10-25-monday-pipeline-coverage.md), and this closes it.

`audits/test/phase8-full-cycle.integration.test.mjs` runs the real chain:

1. `runSunday` writes its own journal from a synthetic source packet and a
   synthetic engine.
2. The real `checkpointWriter` chains two generations, each with its own dump and
   checksum, parented on the hash of the verified pre-run state.
3. The real `verifyCheckpointFiles` proves the file lineage.
4. The head checkpoint is **cold-restored** into a fresh database and compared
   event by event, hash and receipt, against the verified meta. File proof alone
   does not authorise a resume, and the code says so, so the dry run does the
   restore the comment demands.
5. The real `collectResults` settles that restored journal.

Only one thing is replaced: the external match-result read, by a deterministic
synthetic reader. Nothing else is mocked.

## Determinism

Every fixture time is anchored on a whole minute, and each anchor was measured
exact under `utcKickoff`'s minute truncation before the run was trusted. That is
the direct fix for the earlier intermittent failure, where a kickoff carrying
seconds could round back across its own issue time. The dry run waits for
nothing and does not depend on where the second falls.

## Verified end to end

| Area | Result |
|---|---|
| Runner output | 4 declared fixtures, 12 jobs, 48 forecasts, 6 commit confirmations |
| Ledger events | 0 reservations, 0 usage events, retained liability 0 |
| Provider contact | Client and account preflight never called, 0 times each |
| Checkpoint chain | 2 generations, first parented on the pre-run hash, second on the first's dump hash, both `reserved_micros` 0 |
| Chain grows only | Generation 1 holds fewer events than generation 2 and nothing is rewritten |
| Cold restore | Event set identical to the checkpoint head, hash for hash and receipt for receipt |
| Declared denominator | Sunday roster 4, 12 records, 0 `missing_enrollment` for a clean run, 1 label per job |
| 90-minute settlement | A 2-1 extra-time win with 1-1 at 90 scores as a draw: mean Brier 0.5125, where scoring the extra-time result would give 0.3125 |
| 48-hour void | Postponed 60 hours past kickoff voids; abandoned 30 hours past kickoff stays pending |
| Arm attribution | E abstains 4 times and never scores; both model cohorts carry A1, A2 and A3 as `paid_execution_disabled` failures, nothing scored |
| No fabrication | Every issued forecast carries a real receipt; no other forecast carries probabilities; the baseline fallback is recorded with `fallback_scored_as_ai: false` |
| Spending claims | `reserved_liability_usd` 0, `actual_ai_spend_usd` 0, `accuracy_claim` false, `confirmatory_eligible` false |
| Chain after collection | `verifyCheckpointFiles` returns the same two hashes it did before |

## Isolation, asserted rather than assumed

The container runs on `--network none` with no published ports and the pinned
image digest. The provider client and the account preflight are never called. The
public `predictions` table stays empty. The research relation quota is unchanged
at 262144000 bytes. Ordinary roles cannot read the private journal, and the
journal cannot be deleted. No liability exists in the store, in the cold restore,
or in either checkpoint. The report text contains no provider host.

## Failure paths

An interrupted enrollment, forced by the real writer refusing an invalid fixture
id rather than by a mock, leaves the study and packet immutable with only part of
the roster enrolled. All five declared targets stay in the denominator, with three
`missing_enrollment` rows carrying no invented time and no probability.

Recovery refuses a corrupted dump, a relinked parent, an incomplete file set, a
truncated generation, a foreign parent hash and a malformed parent hash. The
checkpoint writer refuses a non-empty directory, so an existing journal is never
silently reset, and refuses a parent that is not a SHA-256.

## Verification

Commit `7ef1731`. GitHub CI: **253 tests, 253 pass, 0 fail, 0 skipped** on Node
20.20.2 and Node 24.19.0, both the push and pull_request runs, all four jobs
green on the first attempt. Previous baseline 247. The six new tests are reported
individually as passing on both runtimes.

## What a genuine research evaluation still requires

1. The complete private Sunday checkpoint chain, including the failed attempt and
   its retained US$0.306000 reservation, verified by an isolated cold restore.
   Nothing here substitutes for it.
2. Renewed authorization for paid inference, after that liability is reconciled.
3. A real provider response. The transport and response contracts are tested
   against fixtures only; no real OpenRouter reply has ever been parsed. This dry
   run deliberately proves the opposite property, that no provider is reached.
4. Genuine pre-kickoff AI forecasts. A1, A2 and A3 remain empty in every arm, and
   Sunday 25 October fixtures cannot be predicted after their kickoffs.
5. A real settled-result read. The external reader is injected away here by
   design.
6. The 15 database-backed tests still run only in CI, because the harness pins
   `unix:///var/run/docker.sock` and Windows Docker cannot serve it.
