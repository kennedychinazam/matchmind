# Durable attempt latch

`attempt-latch.mjs`. Offline, fail-closed attempt control for a **future,
separately authorized** pilot.

## What it is for

The capture adapter's latch was two local variables inside
`createSyntheticSession`, so a restart or a second session began again with a
fresh ceiling. That is adequate for synthetic rehearsal and useless as a real
request ceiling. This module keeps the allowances on disk so they outlive the
process.

## What it does not do

It **constrains** attempts and **grants** none. There is no HTTP, no provider
client, no credential, no environment read, no database, no scheduler and no
financial state in this file. `grantsExecutionAuthority()` returns `false`,
every stored authorization record carries `grants_execution_authority:false`,
and `executeRealTransportUnderLatch()` throws unconditionally. Opening a second
latch directory is not a second authority, because dispatch is simulated-only
and the real transport does not exist here. Connecting a real client needs a
separate reviewed implementation and the owner's approval, exactly as for the
adapter's `executeRealTransport`.

## Shape

One private directory, mode `0700`, holding an append-only chain of records,
each mode `0600`, created `O_EXCL|O_NOFOLLOW`, written then `fsync`ed, with the
directory `fsync`ed after. A crash therefore leaves either no record or a
complete one, and a partial record fails its own hash.

| record | written by | contents |
|---|---|---|
| `authorization` | `createLatch` | plan hash, allowances, validity window, `grants_execution_authority:false` |
| `reservation` | `reserveAttempt` | attempt kind, reservation id, reservation clock |
| `outcome` | `recordOutcome` | reservation id, status and reason |

Each record carries `sequence`, `parent_sha256` and its own `record_sha256` over
the rest of the record. Records are never edited: an outcome is a new record, so
receipts stay immutable.

## Allowances

One fixture attempt and one separately reserved optional metadata attempt.
`reserveAttempt` is the consume step and must precede any future dispatch.
`dispatchSimulated` reserves first, then runs the injected simulated transport,
then records the outcome either way.

**Nothing refunds an attempt.** A failed or ambiguous outcome is still spent,
which is the point: an uncertain request may have reached the provider.

## Refusals, all fail-closed

`plan_hash_mismatch` (bound to the reviewed `pilotPlan`, checked before any
directory is created), `latch_already_exists` (re-opening never resets a
ceiling), `unknown_attempt_kind`, `fixture_attempt_exhausted`,
`metadata_attempt_exhausted`, `invalid_clock`,
`authorization_not_yet_valid`, `authorization_expired`, `unknown_reservation`,
`duplicate_outcome`, `malformed_outcome`, `record_hash_mismatch`,
`missing_record`, `broken_latch_chain`, `unexpected_latch_file`,
`latch_cannot_grant_authority`, `malformed_latch_record`,
`simulated_transport_required` (refused before anything is consumed, so a
refused dispatch costs nothing), `latch_directory_required` and
`latch_record_must_be_regular_file` (symlinks and non-regular files refused),
`posix_private_persistence_required` (fails closed on Windows).

## Verification

`audits/test/attempt-latch.test.mjs`. The restart guarantee is proven by
spawning a **genuinely separate process** against the same directory and
requiring it to see the consumed attempt and refuse another, rather than by
re-reading state inside one process.
