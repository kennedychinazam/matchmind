# Retention policy for captured provider responses

`retention.mjs`. Offline. Governs raw provider response bodies captured for the
three-fixture pilot and nothing else.

## The boundary

| | |
|---|---|
| Subscription expires | **2026-11-11T13:47:51Z** |
| Raw-data deletion deadline | **2026-11-10T12:00:00Z** |
| Margin | 25 hours 47 minutes |
| Condition on the permission | subscription active |
| Basis | `PROVIDER-RIGHTS-RESPONSE.md`, 29 October 2026 |

The provider's permission to hold exact response bodies is conditional, and the
condition is repeated four times in the reply: **while your subscription remains
active**. A conditional permission is only honoured if something enforces the
condition, so the boundary lives in code rather than in a calendar reminder.

**The deadline is the operative control, not the expiry.** Deletion is required
to be finished more than a day before the subscription lapses, so a deletion
that goes wrong has room to be noticed and redone while retention is still
lawful. An enforcement timed to finish exactly at expiry has no margin at all.
The module refuses to load if the deadline is ever moved past the expiry.

The Director may revise the deadline after verified continuous renewal. Until
then it stands as written above, and it is written into each registration record
as well as into the policy, so a changed policy and an old record cannot quietly
disagree.

## What is covered

Everything that holds the bytes:

- original HTTP response bodies, successful or not;
- error, rate-limit and authorization-failure bodies, which the provider's reply
  covers on the same terms;
- temporary copies;
- every registered private backup.

A backup is not a lesser copy. It inherits the same deadline, is listed in the
registration, is a deletion target, and is re-checked on every retention
assertion. A backup whose bytes drift from the original is refused as a tamper
signal, because nothing in this module ever rewrites one.

## What is not covered, and is not touched

**No existing MatchMind production record and no historical research archive is
deleted by anything here.** The module deletes only raw response bytes inside a
store it was handed. It walks no tree, takes no glob, opens no database and has
no reach outside the paths listed in its own registration record.

The post-expiry position for **normalized production data** is unresolved and is
recorded as unresolved in `PROVIDER-RIGHTS-RESPONSE.md`. This policy does not
settle it and must not be read as settling it.

## Who may hold it and who may read it

Both are named in the registration record and neither has a default:

- `storage_id`, the one approved private location;
- `reviewers`, the explicitly authorized readers.

The provider's limit on reviewer access is quoted in the response record: access
must stay strictly limited to the audit, with no redistribution or reuse of the
raw data.

Raw bytes are kept out of public Git, hosted applications, model prompts and
uncontrolled synchronization. Nothing in this repository contains a raw body;
the captures live in private directories, mode `0700`, files mode `0600`,
created exclusively and `O_NOFOLLOW`, outside any checkout.

## Fail-closed behaviour

Every one of these refuses rather than proceeds:

| Situation | Refusal |
|---|---|
| Registering at or after the deadline | `retention_deadline_passed` |
| Asserting retainability at or after the deadline | `retention_deadline_passed` |
| Subscription recorded as ended, at any date | `subscription_ended` |
| Registration snapshot disagrees with the policy | `retention_policy_mismatch` |
| A retention record edited | `record_hash_mismatch` |
| A retention record removed | `missing_record` |
| A record's parent link broken | `broken_retention_chain` |
| An unexpected file in the store | `unexpected_retention_file` |
| Capture incomplete, or not the registered one | adapter refusal, `capture_not_the_registered_one` |
| A backup holding different bytes | `backup_copy_mismatch` |
| A deletion interrupted before completion | `deletion_in_progress` |
| Raw bytes already deleted | `raw_data_deleted` |
| Deleting without a recorded intent | `deletion_not_initiated` |
| A second registration over the same store | `retention_already_registered` |
| Windows | `posix_private_persistence_required` |

**An early end to the subscription stops retention immediately.** Cancellation,
a failed payment or a provider decision ends the permission on the day it
happens, not on the deadline, so `recordSubscriptionEnd` is durable and every
later retention assertion refuses. The deadline is a ceiling, never a licence to
run to it.

## Deletion, and how it is verified

Three separate durable steps, because a deletion that cannot prove itself is not
an auditable deletion.

1. **`beginDeletion`** writes the intent before anything is removed, naming
   every target and the reason: `rehearsal`, `retention_deadline`,
   `subscription_ended` or `director_instruction`. An interruption after this
   point is therefore visible as an interruption rather than as an intact store,
   and the next process resumes it instead of starting a second deletion. The
   receipt records whether it was resumed by a different process.
2. **`executeDeletion`** removes the raw bytes from every target and writes a
   receipt. Each target is recorded as `deleted`, `absent` or `unverified`, with
   the reason. Nothing is reported as deleted on the strength of having tried.
3. **`verifyDeletion`** re-reads the filesystem. A receipt is a claim, and a
   claim is not a check: verification fails if any target still holds bytes,
   including a copy restored after the fact, and fails if the receipt itself
   recorded an unverified target.

## What survives deletion

Only **non-reconstructive audit metadata**:

- the capture hash, the raw sha256 and the raw length;
- per target: path, role, status, sha256, length;
- counts, reasons, and the UTC times of intent and completion;
- the capture manifest, which holds request metadata, timestamps, HTTP status
  and hashes.

None of it reproduces a field of provider content. A sha256 attests to what was
destroyed and cannot rebuild it, which is exactly the property wanted: the audit
survives, the data does not. A test asserts the receipt contains no league name
and no fixture ID.

The manifest is deliberately kept. It records what was requested and when, which
is our own information, and it is what makes the deletion receipt meaningful
later.

## What this module is not

It constrains retention and grants nothing. There is no HTTP, no provider
client, no credential, no environment read, no database, no scheduler and no
financial state in the file. `grantsExecutionAuthority()` returns `false`, every
registration record carries `grants_execution_authority:false`, and
`executeRealTransportUnderRetention()` throws unconditionally, so this file
cannot become an acquisition path.

It also authorizes nothing to be captured. It says how a capture must be looked
after if one is ever separately approved.

## Verification

`audits/test/capture-retention.test.mjs`, 13 tests, run on Linux so the POSIX
paths are genuinely exercised. Covered: process restart, an early subscription
end, a passed deadline, interrupted deletion resumed across a real process
boundary, a backup cleared with the original, a copy restored after deletion, a
partial capture, tampered retention metadata both unhashed and re-hashed, a
missing record, and a receipt proven non-reconstructive.
