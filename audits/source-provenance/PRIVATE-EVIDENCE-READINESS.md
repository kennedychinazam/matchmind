# Private evidence readiness

What the existing file-only prototype and provider adapter already guarantee,
and what is still missing before real provider bodies could be retained. No
production infrastructure is provisioned here and none is proposed in this file.

## Verified, by test, on Linux Node 20.20.2 and 24.19.0

These are not design intentions. Each is asserted by a test that passes in the
focused run of `provider-capture-adapter.test.mjs`, `source-provenance.test.mjs`
and `attempt-latch.test.mjs`.

| Requirement | Mechanism | Where asserted |
|---|---|---|
| Directory is private | mode `0700` | adapter and latch tests read `statSync(dir).mode & 0o777` |
| Files are private | mode `0600` | both tests read each file's mode |
| Exclusive creation | `O_CREAT\|O_EXCL`, second write throws | adapter test re-writes the same directory |
| No symlink following | `O_NOFOLLOW` plus `lstat`, directory and file links refused | adapter test links a directory and a `response.bin`; latch test links a directory |
| Regular files only | `fstat` after open, `O_NONBLOCK` so a FIFO fails promptly instead of blocking | adapter FIFO test with a time-bounded child process |
| Readback integrity | stored bytes re-hashed on read, mutation rejected | adapter test rewrites `response.bin` then reads |
| Crash safety | file `fsync` then directory `fsync`; a partial record fails its own hash | latch chain verification |
| Tamper evidence | per-record `record_sha256` and `parent_sha256` chain | latch tamper, truncation and extra-file tests |
| Fails closed off POSIX | `posix_private_persistence_required` on Windows, nothing created | adapter and latch tests on win32 |

So the **mechanism** is in place and demonstrated. What follows is not mechanism.

## Still required, and none of it is code

### 1. Approved storage location

Missing. There is no approved path, host or volume for real provider bodies. The
modules take a caller-supplied absolute directory and enforce privacy on it;
they do not choose or bless a location. Needed: a named location, who
administers it, whether it is encrypted at rest, and whether it sits inside or
outside the research host that holds the private journal.

### 2. Independent backup

Missing. Nothing in either module copies evidence anywhere. The existing weekend
checkpoint chain is a separate mechanism for the research journal and is not
wired to capture evidence, deliberately. Needed: whether capture evidence is
backed up at all, to where, under whose control, and whether a backup copy
inherits the same retention clock and deletion obligation as the primary.

### 3. Retention schedule

Missing, and blocked on the provider. No duration can be set before the rights
answer in `PROVIDER-RIGHTS-INQUIRY.md` arrives, because the permitted duration
and the deletion obligation after subscription expiry are the inputs. Needed
once answered: a stated duration per evidence class (successful bodies, error
bodies, derived projections), a deletion procedure, and who verifies deletion
happened.

### 4. Integrity verification over time

Partly present. Integrity is verified **on read**: the adapter re-hashes stored
bytes and the latch verifies its whole chain. There is no scheduled or periodic
re-verification, and adding one would mean a scheduler, which this task
excludes. Needed: a decision on whether periodic verification is required, and
if so where it runs, since an on-read check cannot detect silent decay in
evidence nobody reads.

## Honest limits of what was verified

The POSIX guarantees were exercised in WSL Ubuntu 20.04 on this workstation and
in CI on `ubuntu-latest`. They have not been exercised on whatever host would
actually hold real evidence, and file modes are only as meaningful as the
account separation on that host. A `0600` file is private from other local users
and from nobody else.

Nothing in this assessment establishes a right to retain real bodies. That is
the provider question, and it is unanswered.
