# Retention lifecycle: the seven failure cases

How the capture lifecycle and `RETENTION-POLICY.md` fit together, and what
happens at each point where they could come apart. The policy says what the
boundary is; this says what happens when something goes wrong near it.

Deletion deadline **2026-11-10T12:00:00Z**, unchanged. It is not extended
without verified continuous renewal and separate Director approval.

## The stages

`lifecycleState({captureDirectory, latchDirectory})` in `transport.mjs`:

| Stage | Governed | Meaning |
|---|---|---|
| `no_latch` | no | No ceiling exists yet. Nothing may dispatch |
| `ready` | no | Latch created, attempts unconsumed, nothing dispatched |
| `attempt_spent_no_capture` | no | An attempt was spent and no capture was stored |
| `capture_unregistered` | **no** | Raw bytes on disk, nothing governing them |
| `capture_incomplete` | no | Orphaned or partial, can never be registered |
| `store_unexpected_file` | no | A file the retention chain does not recognise |
| `registered` | yes | Under retention, inside the boundary |
| `subscription_ended` | yes | Permission has ended, bytes still present |
| `deletion_in_progress` | yes | A deletion was interrupted |
| `deleted` | yes | Receipt written, raw bytes gone |

## 1. A crash after receiving bytes, before retention registration

**The gap is real and it is not a code defect.** From the moment the bytes land
they are retained provider data held under the subscription terms. The
registration that governs them is written afterwards, so a crash in between
leaves bytes on disk with no policy record, no declared storage, no named
reviewers and no deletion target list.

Nothing can close that window entirely: the write and the registration cannot be
one atomic act across two different concerns. What is done instead:

- the window is made **visible** rather than silent. `lifecycleState` reports
  `capture_unregistered` with `governed:false` and the required action;
- the latch already holds a durable outcome record, so the fact that an attempt
  was spent survives the crash and the operator cannot be unaware of it;
- the resolution is **register, then delete**, never delete directly, because
  registering first is what produces an auditable receipt.

In the preflight this is steps 17 to 19, adjacent on purpose.

**Procedural, not enforced**: nothing compels the operator to run
`lifecycleState` after a crash.

## 2. Incomplete or orphaned private capture directories

A directory holding a manifest without bytes, bytes without a manifest, or bytes
that do not match the manifest hash.

- `readAdapterCapture` refuses, so `registerRetention` **cannot** take it under
  retention. There is nothing honest to attest to.
- `lifecycleState` reports `capture_incomplete`.
- Required action: remove it, and account for the spent attempt. The ceiling is
  not refundable, so an orphaned directory costs the attempt anyway.

## 3. Backup creation and registration failures

Backups are declared at registration and cannot be added later, so the failure
modes are: declared and never created, created and then lost, created and then
altered, or pointed somewhere unsafe.

| Failure | Refusal |
|---|---|
| Declared but absent, before any deletion | `backup_missing` |
| Contents drifted from the original | `backup_copy_mismatch` |
| Directory replaced with a symlink | `backup_directory_must_be_real_directory` |
| Relative, unresolved, duplicated, or the store itself | `retention_registration_backups` |

`backup_missing` is a change of position taken during this task. The earlier
behaviour treated an absent backup as one fewer place holding raw bytes, which
is true about the bytes and wrong about the operator: someone who declared a
backup believes a copy exists. Before a deletion is under way, a declared backup
that is not there is a failure. Once a deletion intent is recorded, an absent
backup is exactly what is wanted, and that path is reached before the check.

## 4. Early subscription termination

Cancellation, a failed payment, a provider decision. The permission ends with
the subscription, not at the deadline.

- `recordSubscriptionEnd(dir, {ended_at_utc, source})` writes a durable record.
- Every later `assertRetainable` and `readRetainedCapture` refuses with
  `subscription_ended`, at any date, well inside the deadline included.
- `complianceStatus` reports a **breach** while raw bytes remain.
- Deletion proceeds with reason `subscription_ended`, recorded as what it was.

## 5. Missed deletion deadlines and interrupted deletion

**Missed deadline.** Nothing here runs on a schedule, so a missed deadline
cannot be fixed automatically. The only honest alternative is to make it loud:
`complianceStatus(dir, nowUtc)` returns `compliant:false`, `overdue:true`,
`breach:true`, `overdue_since_utc`, a reason list, and a required action that
says this is a breach and not a warning.

`beginDeletion` is deliberately **not** gated on the deadline or on
retainability. Deletion is most needed exactly when retention has stopped being
valid, so gating it would be the one change that could strand raw data past the
boundary.

**Interrupted deletion.** The intent is durable before anything is removed, so
an interruption looks like an interruption:

- `assertRetainable` refuses with `deletion_in_progress`;
- `verifyDeletion` refuses with `deletion_incomplete`;
- re-running `executeDeletion` resumes the same deletion rather than starting a
  second one, and the receipt records `resumed:true` when a different process
  finished it;
- proven across a genuinely separate process, not by re-reading state in one.

**Deletion and verification approach.** Three separate durable steps: an intent
naming every target and the reason; a receipt marking each target `deleted`,
`absent` or `unverified` with its hash and length; and a verification that
**re-reads the filesystem**, because a receipt is a claim and a claim is not a
check. Verification fails if any target still holds bytes, including a copy
restored after the fact, and reports `attested` and `fully_attested` separately
from `verified`, since a target that was already gone leaves no hash to prove
what went.

## 6. Attempts to use retained bytes after the approved period

`readRetainedCapture(dir, nowUtc)` is the one supported way in. It asserts
retainability first, so it refuses past the deadline, after an early
subscription end, while a deletion is in progress, and after deletion.
Application code has no reason to open the file itself.

**This binds the tooling and nothing else.** It does not make the underlying
files unreadable. Anyone with filesystem access and any ordinary tool can read
the bytes until the deletion runs. Saying otherwise would be false.

## 7. Unauthorized copies and paths outside the registered store

| Control | Technically enforced? |
|---|---|
| An unexpected file inside the store | **Yes.** `unexpected_retention_file`, surfaced as `store_unexpected_file`. A stray copy in the store blocks registration |
| A backup directory replaced with a symlink | **Yes** |
| A backup whose bytes drifted | **Yes** |
| Deletion reaching every declared target | **Yes**, and verified by re-reading |
| A copy made anywhere outside the store and the declared backups | **No. Procedural only** |
| Who may read the bytes | **No. Procedural only.** Reviewers are named in the record; nothing enforces the list |
| Reading the bytes with a tool other than this one | **No. Procedural only** |
| Deleting on time | **No. Procedural only.** There is no scheduler. The breach is reported, not prevented |

## What remains procedural, stated together

So it is not spread across a document and lost:

1. **Copies outside the store.** The module reaches only the paths in its own
   registration. A copy made elsewhere is outside its knowledge entirely.
2. **Reader identity.** Named reviewers are recorded, not enforced.
3. **Reading by other means.** The guarded read binds this tooling; the files
   stay readable to the filesystem until deletion.
4. **Punctuality.** No scheduler exists, so the deadline is enforced as a
   refusal and a reported breach, never as an automatic deletion.
5. **Running the checks at all.** `lifecycleState` and `complianceStatus` report
   honestly when called. Nothing compels a call.

**The technical fix for items 1 and 3 is the same one**: encrypt the capture and
destroy the key at the deadline, so expiry makes the data unreadable rather than
merely unauthorized, wherever a copy happens to sit. That is the next real
hardening step. It is not implemented, and nothing in this document should be
read as if it were.

## Production and archives

Nothing in this lifecycle touches an existing MatchMind production record or a
historical research archive. It walks no tree, takes no glob, opens no database,
and reaches only the paths listed in its own registration record. The unresolved
question about **normalized production data after expiry** is recorded in
`PROVIDER-RIGHTS-RESPONSE.md` and asked in `PROVIDER-RIGHTS-FOLLOWUP.md`.
Nothing is deleted on the strength of that ambiguity.
