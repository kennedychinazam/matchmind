# Legacy checkpoint confirmation constraint, 25 October 2026

Offline diagnosis and repair of the reservation-confirmation failure that stopped
the Sunday continuation. No paid inference was attempted, requested or authorized
while this work was done, and no hosted or production object was touched.

## What was wrong

`weekend_append` gained the `confirmation` event kind, the mandatory
`requires_confirmation` flag on reservations and forecasts, and the rule that a
`usage` dispatch needs an accepted confirmation, in commit `4b77f62`
(`fix: confirm pre-kickoff commits and preserve verified evaluation denominators`,
24 October 15:12:35Z). The same commit widened the table constraint:

    CHECK(kind IN('study','packet','job','forecast','label','reservation','usage'))
    CHECK(kind IN('study','packet','job','forecast','label','reservation','usage','confirmation'))

The supervised Saturday study completed at 24 October 14:49:05Z, before that
commit. Its checkpoint therefore carries the narrower constraint, and a cold
restore of that chain brings the narrower constraint back with it.

`refreshWriter` already replaced the restored `weekend_append` from the reviewed
schema text, but it did not touch the restored table constraint. So on a restored
legacy checkpoint the refreshed writer validated a confirmation correctly and
then failed on the table CHECK at its own INSERT. Two further defects made that
worse:

1. `store.reserve` appended the reservation first and confirmed afterwards. On a
   legacy restore the hold became immutable and its mandatory confirmation was
   then impossible, so the reservation could never be confirmed, dispatched or
   released. A retained hold with no provider call is the visible result.
2. `confirm` recorded its failure fallback with the same rejected kind, inside a
   `catch` with no guard, so the fallback's own rejection propagated and hid why
   the commit confirmation had not persisted.

## What changed

- `audits/phase8/store.mjs`: `reserve` and `reserveAsync` now verify, before
  appending anything, that the store's kind constraint and writer both admit
  `confirmation`. A store that cannot record the acknowledgement refuses the
  reservation instead of stranding it. `confirm` no longer lets its fallback
  replace the original reason.
- `audits/phase8-continuation/local.mjs`: `refreshWriter` also widens the kind
  constraint, taking the kind list from the same reviewed `schema.sql` text that
  supplies the writer, and asserts that the stored event count and the retained
  reserved total are unchanged by the maintenance.
- `audits/test/phase8-legacy-confirmation.integration.test.mjs`: reproduces the
  real pre-`4b77f62` table constraint on a disposable local PostgreSQL and checks
  that a reservation is refused before it exists, that the maintenance alters no
  stored event and no retained liability, and that a reservation confirms after
  the maintenance.

The committed test coverage before this change simulated a legacy chain by
filtering `confirmation` events out of the JavaScript read view, over a database
whose schema still accepted confirmations. That exercised the lineage check only,
never the constraint that actually rejected the write.

## Unresolved state, carried forward

These are open unknowns, not omissions:

- The latest private Sunday checkpoint chain is not available here. Only the
  verified Saturday baseline archive is held, by the owner, outside this
  repository. It predates the 90-fixture Sunday study and the failed attempt, so
  it must never be used to restart paid work or to reset the ledger.
- A private failed attempt retains a US$0.306000 worst-case OpenAI reservation.
  It is not refunded, released or recreated. The last reported study ledger is
  therefore not zero. Actual billed spending was reported as US$0.
- The private event count after that failed attempt, and the identity and hash of
  the last checkpoint, remain unestablished. The earlier 2,514-event restore
  predates the attempt and does not describe current state.
- No AI prediction has been produced in any arm. A1, A2 and A3 remain empty.
- The global nonresetting US$5 ceiling is unchanged and is shared across both
  providers, every request and every study day.

Paid inference stays blocked until the latest private liability is reconciled
against the real journal. The repairs here remove the defect that stranded a hold;
they do not reconcile the hold that is already retained, and they are not a
readiness claim. No merge, deployment, public publication or hosted Supabase
change is authorized.
