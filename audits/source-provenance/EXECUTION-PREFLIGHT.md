# Pilot execution preflight and GO / NO-GO

29 October 2026. For the single three-fixture pilot and nothing wider.

**Standing position: NO-GO.** Nothing here authorizes a request. The provider
gate is now conditionally satisfied; the owner's gates are not.

## 1. Exact scope

| | |
|---|---|
| Request | **one** `GET /fixtures?ids=788036-788048-788038` |
| Host | `v3.football.api-sports.io`, TLS, port 443 |
| Header | `x-apisports-key`, the direct API-SPORTS subscription |
| Optional second | **at most one** `GET /status`, separately authorized, separately reserved |
| Retries | none |
| Redirects | not followed |
| Fallbacks | none, including no RapidAPI host |
| Batches | one, never a second |

A non-2xx, an empty response or an error body **ends the pilot**. It is not a
reason to try again, and the provider has confirmed in writing that such a body
may be retained as diagnostic evidence, so the attempt still produces something
worth keeping.

## 2. What is actually known about the account, and what is not

This section exists because the difference is easy to lose and expensive to get
wrong.

### Observed on the account

| Fact | Value | Source |
|---|---|---|
| Subscription tier | Ultra | the Director's statement, read from the dashboard |
| Expiry | 2026-11-11T13:47:51Z | the Director's statement, read from the dashboard |

**I did not observe either myself.** Claude Code Local holds no API-Football
dashboard session and no credential.

### Published list, not account facts

Recorded on 26 October 2026 from `api-football.com/pricing`: Free $0 / 100 per
day, Pro $19 / 7,500, Ultra $29 / 75,000, Mega $39 / 150,000 per month, with
season restrictions on the free plan. **A published tier figure is not a
measurement of this account's remaining headroom**, and it says nothing about
the per-minute limit.

### Not observed at all

1. Remaining daily request allowance.
2. The per-minute rate limit and its remaining headroom, which is a separate
   limit from the daily one.
3. Historical-season entitlement covering fixture IDs 788036, 788048, 788038.
4. Whether those three IDs belong to a season this subscription may read.

### A second trap: production's own limiter

Build 355's API-Football client self-throttles to **nine requests per
sixty-one seconds** and tells the user it is hitting a ten-per-minute free-plan
limit (`index.html:2607`, `:2633`, `:2642`, `:2644`). **That calibration is the
free tier, not this subscription.** It is harmless for a single request, but
anyone diagnosing a real rate limit using those messages would be misled, and
the numbers must not be read as this account's per-minute headroom. Reported and
deliberately not changed, because Build 355 is protected.

### A trap to avoid

Our test fixtures contain `x-ratelimit-requests-limit: 75000`,
`x-ratelimit-requests-remaining: 70000`, `x-ratelimit-limit: 450` and
`x-ratelimit-remaining: 449`, and `provider-adapter.example.mjs` carries the
same shape. **Those are synthetic values written for the tests and the
example.** They are not observations of this account and must never be quoted as
entitlement. A rate-limit header from a real response would be a sample taken
after the fact, which is also not an entitlement.

## 3. Execution environment

Candidate, requiring the owner to approve it as *the* environment:

| | |
|---|---|
| Host | WSL2 Ubuntu 20.04 on the owner's Windows 10 machine |
| Runtimes | Node 20.20.2 and 24.19.0, at `~/.local/nodejs/` |
| Platform requirement | POSIX. Every module here refuses on Windows with `posix_private_persistence_required` |
| Egress | restricted to `v3.football.api-sports.io:443` for the duration |
| Docker | not needed; no database is involved |

**Claude Code Local does not hold the authenticated Work browser session**, has
no API key, and must not be assumed to acquire either. Every step below marked
*owner* is the owner's to perform, in their own session, on their own machine.

The credential reaches only the separately reviewed real transport, by a path
that transport defines. **No module in this repository reads an environment
variable, a credential file or a secret of any kind**, and none should be
changed to.

## 4. Private storage

Constraints the code already enforces, so the approved location has to satisfy
them:

- an absolute, fully resolved path;
- a parent directory that is real, not a symlink, owned by the executing user,
  and not group or world accessible;
- the capture directory created by the adapter itself, exclusively, mode `0700`,
  with files mode `0600` and `O_NOFOLLOW`;
- outside every Git checkout, every hosted application and every synchronized
  folder.

Candidate: a directory under the WSL user's home, created for this pilot alone.

**The owner must name**: the exact path, its administrator, and its encryption
posture. The modules enforce privacy on a directory they are handed; they do not
bless one, and they do not encrypt.

## 5. Backup

An owner decision, and a consequential one. If a backup is taken:

- it must be an absolute path to a **real directory**, not a symlink, which is
  now checked at registration and again at every read and every deletion;
- it is declared at registration, at most eight, and cannot be added later;
- **it inherits the same deletion deadline as the original**, and deletion
  clears it;
- its contents must stay byte-identical to the original, or retention refuses
  with `backup_copy_mismatch`.

If no backup is taken, a single disk loss ends the evidence. That is a real
trade and it is the owner's to make, not mine.

## 6. The attempt ceiling, unchanged

One fixture attempt and one separately reserved metadata attempt, permanently.

- Consumed before dispatch, never after.
- **Never refunded**, including for a failure or an ambiguous outcome, because an
  uncertain request may still have reached the provider.
- The latch directory is created once; a directory that already exists is
  refused with `latch_already_exists`, so re-opening cannot reset a ceiling.
- A second latch directory is not a second authority: dispatch is
  simulated-only and the real transport throws.
- Proven across a genuinely separate process, not by re-reading state in one.

At execution time the latch must exist at the approved location and show both
attempts **unconsumed**. If it shows either consumed, the pilot is over.

## 7. The checklist

Order matters. Every *owner* step happens in the owner's own session.

### Before anything is sent

| # | Who | Step | Done when |
|---|---|---|---|
| 1 | owner | Read the dashboard: current plan, renewal state, remaining daily allowance, per-minute limit | The four values are written down, with the time read |
| 2 | owner | Confirm the three fixture IDs fall in an entitled season | Confirmed, or the pilot is rescoped |
| 3 | owner | Decide: run now, or renew first and revise the deadline | Decision recorded (see section 9) |
| 4 | owner | Name the private storage path, its administrator, its encryption posture, **and the storage label and reviewer names the retention registration will carry** | All five recorded. The preflight now refuses without the label and reviewers, before the attempt is reserved |
| 5 | owner | Decide the backup arrangement, or decide against one | Recorded either way |
| 6 | owner | Name the execution environment, its **system clock source**, and the execution window | Recorded. The host clock decides authorization validity, so an unsynchronised host is a stop |
| 7 | owner | Approve the real transport implementation, separately reviewed | A reviewed implementation exists and is approved in writing |
| 8 | owner | Authorize, or withhold, the single `/status` request | Recorded either way |
| 9 | operator | Create the latch directory at the approved location | `readLatch` shows `{fixture:1,metadata:1}` |
| 10 | operator | Confirm the latch's plan hash matches the reviewed `pilotPlan` | No `plan_hash_mismatch` |
| 11 | operator | Confirm the retention policy loads and the deadline is still ahead | `retentionPolicy()` returns the 2026-11-10T12:00:00Z deadline |
| 12 | operator | Rehearse the whole path on synthetic bytes in the approved environment | Capture, registration, deletion and verification all pass there |

**Any row unsatisfied is a stop.** Row 7 is the one that cannot be shortened:
there is no real transport in this repository, and writing one is a separate
reviewed task.

### At execution

| # | Who | Step |
|---|---|---|
| 12a | operator | Confirm the execution host's clock is synchronised and correct in UTC | Checked within the hour before execution. The pipeline reads this clock and no caller can override it |
| 13 | operator | Reserve the fixture attempt through the latch, before dispatch |
| 14 | operator | Send the one request. No retry, no redirect, no fallback |
| 15 | operator | Record the outcome through the latch, whatever it was |
| 16 | operator | Capture the exact bytes received, successful or not, via the adapter |
| 17 | operator | Write the capture to the approved private store |
| 18 | operator | Copy to the backup, if one was approved |

### Immediately after

| # | Who | Step | Done when |
|---|---|---|---|
| 19 | operator | `registerRetention` with the storage id, the authorized reviewers and the backup paths | A registration record exists |
| 20 | operator | `assertRetainable` | Returns `retainable:true`, with `backups_verified` matching what was taken |
| 21 | operator | `analyzeCapture` against the normalized records | Analysis recorded; `source_review_admissible` stays `false` |
| 22 | operator | Confirm no raw body reached Git, a hosted application, a model prompt or a synced folder | Confirmed |
| 23 | owner | Review the outcome and decide whether anything further is authorized | Recorded |

### Before 2026-11-10T12:00:00Z

| # | Who | Step | Done when |
|---|---|---|---|
| 24 | operator | `beginDeletion` with reason `retention_deadline` | Intent record written |
| 25 | operator | `executeDeletion` | Receipt written, every target `deleted` |
| 26 | operator | `verifyDeletion` | `verified:true`, `raw_bytes_remaining:0`, `fully_attested:true` |
| 27 | operator | Report the receipt hashes to the owner | Reported |

If the subscription ends before that date, `recordSubscriptionEnd` is written
first and steps 24 to 27 run immediately with reason `subscription_ended`.

## 8. GO / NO-GO

The inquiry's twelve rows, with today's status.

| # | Condition | Status | Basis |
|---|---|---|---|
| 1 | Exact-body retention | **GO** | Written permission, conditional on an active subscription |
| 2 | Error-body retention | **GO** | Explicitly covered, for diagnostic or audit purposes |
| 3 | Reviewer access | **GO, narrowed** | Permitted, but strictly limited to the audit, no redistribution or reuse |
| 4 | Retention period | **GO** | No separate maximum during an active subscription |
| 5 | Post-expiry obligation | **GO for the pilot captures** | Not covered after expiry; enforced by a 2026-11-10T12:00:00Z deletion deadline with a verified procedure |
| 6 | Model evaluation | **GO** | Internal evaluation permitted while the subscription is active |
| 7 | Status and score semantics | **GO** | FT, AET, PEN defined; `score.fulltime` confirmed as the regular-time result, excluding extra time and penalties |
| 8 | Access and quota | **NO-GO** | Nothing about this account's headroom or historical entitlement has been observed |
| 9 | Approved storage location | **NO-GO** | No path, administrator or encryption posture named |
| 10 | Retention schedule in place | **GO** | Policy written, enforced in code, 15 tests, deletion rehearsed and verified |
| 11 | Execution authority | **NO-GO** | The real transport implementation now exists (`REAL-TRANSPORT.md`) and is inert: no Director key installed, no credential bound, no window, no owner permission. See below |
| 12 | Durable latch provisioned | **NO-GO** | Not created at an approved location, because there is no approved location |

**Seven GO, four NO-GO, one narrowed.** Rows 1 to 7 were the provider's and are
now answered. Rows 8 to 12 are the owner's, and four of the five are open.

Row 1 gated everything and has cleared. Row 11 now gates everything. Its one
part that work in this repository could deliver, step C below, is delivered; the
remaining three parts are the owner's and no amount of work here can clear
them.

## 8a. What closing row 11 now requires

The transport boundary exists (`TRANSPORT-BOUNDARY.md`), the real transport
implementation now exists too (`REAL-TRANSPORT.md`), and both are inert for one
structural reason: no Director public key is installed to verify the exact-scope
authorization every dispatch must present, so the only function that can open a
socket refuses. Closing row 11 therefore means four distinct things, in order,
of which **step C is now done and awaiting review**:

| # | Who | Step |
|---|---|---|
| A | owner | Generate an ed25519 keypair **outside this repository**, on a machine Claude Code does not touch, and keep the private key |
| B | reviewer | Separately review the authorization process itself, then install only the public key as the module's anchor |
| C | owner | Review and approve a real transport implementation that binds the credential. **It now exists**: `real-transport.mjs`, described in `REAL-TRANSPORT.md`, 27 tests, eight findings fixed. The Director's independent review of `b8f5ab6` conditionally accepted it and raised two more, D01 and D02, both now closed. It awaits the owner's written approval |
| D | owner | Sign one exact-scope statement: plan hash, request hash, kind, latch directory, store, a window of at most 24 hours, and a nonce |

**Claude Code must not perform step A or hold any part of the private key**, and
has not. Step B is the one that ends inertness, which is why it is a reviewed
process and not an edit.

Step C delivered `real-transport.mjs`: the credential binding, the real
`node:https` client, the bounded body read, the target assertion, the preflight
gate and the single ordered pipeline. It designs nothing new; the request
inventory, the authorization verifier, the attempt ceiling, the capture adapter
and the retention lifecycle are imported unchanged. Three decisions it could not
make alone are documented rather than bypassed: the `accept-encoding: identity`
header (DECISION-1), that a declared backup is the operator's copy to make
(DECISION-3), and that one clock governs everything (DECISION-6).

The Director's independent review raised two findings against it, both closed:

**D01, the authorization clock.** The real entry point forwarded a
caller-supplied `nowUtc` into authorization verification, the retention
preflight and the attempt reservation. Once the anchor is installed, that would
have let an expired but validly signed authorization be replayed against an
earlier timestamp. Reproduced against `b8f5ab6`: an authorization that expired
on 2026-10-01 dispatched on 2026-10-30, and the permanent attempt was consumed.
There is now no caller-supplied timestamp in the pipeline at all. Real
authorization validity, the subscription and retention deadlines and the
reservation read the host clock; it is read again immediately before the
reservation and everything time-dependent re-checked; a backwards clock and an
unusable clock value both fail closed; rehearsals keep deterministic injected
clocks. **Step 6 of this checklist now implies approving the environment's
clock**, because a host whose clock is wrong produces a wrong judgement and
nothing in software fixes that from inside the host.

**D02, the retention registration inputs.** The preflight treated `storageId`
and `reviewers` as optional while `registerRetention` requires them, so a
missing or malformed value surfaced only after the permanent attempt had been
consumed, leaving raw provider bytes ungoverned on disk for a refusal that was
free to make. Reproduced against `b8f5ab6`. Both are mandatory in the preflight
now, and row 19 below cannot be reached with inputs row 4 has not settled.

## 9. The timing decision the owner has to make

The deletion deadline is **2026-11-10T12:00:00Z**, twelve days out. The pilot's
whole purpose is internal evaluation against retained bodies, and the
permission for that evaluation ends with the subscription.

So there are two coherent plans and one incoherent one:

1. **Run soon, finish the evaluation before 10 November.** Workable only if rows
   8 to 12 close quickly and the analysis genuinely fits the window.
2. **Renew the subscription first, then revise the deadline.** The Director
   already reserved the right to revise it after verified continuous renewal.
   This is the better plan if the evaluation needs longer than twelve days.
3. **Run late and hope.** This produces raw bodies that must be deleted almost
   immediately, which is the worst of both outcomes: the quota is spent, the
   attempt ceiling is consumed permanently, and the evidence is destroyed before
   it has been used.

**My recommendation is plan 2.** The attempt ceiling is permanent and
unrefundable, so spending it against a twelve-day window is a poor trade when
renewal is cheap and moves the boundary honestly.

## 10. Exact owner approvals still required

In writing, each separately:

1. Current account facts from the dashboard: plan, renewal state, remaining
   daily allowance, per-minute limit, and the time read.
2. Historical-season entitlement for 788036, 788048, 788038.
3. The approved private storage path, its administrator, its encryption posture.
4. The backup arrangement, or an explicit decision against one.
5. The approved Linux execution environment and the execution window.
6. Approval of the real-transport implementation that binds the credential,
   which now exists at `real-transport.mjs` and needs an independent review and
   written approval. Acceptance or rejection of DECISION-1, DECISION-3 and
   DECISION-6 in `REAL-TRANSPORT.md` is part of that approval.
6a. Generation of the Director ed25519 keypair outside this repository, review
   of the authorization process, and installation of the public key as the
   module's anchor.
6b. One signed exact-scope authorization statement, valid for at most 24 hours.
7. Explicit permission to send the one `/fixtures` request.
8. Separately, permission to send the one `/status` request, or a decision
   against it.
9. The timing decision in section 9.
10. Any revision to the deletion deadline, which is valid only after verified
    continuous renewal.

Nothing in this repository can supply any of the ten.

## 11. Unresolved, and reaching beyond the pilot

**Normalized production data after expiry.** The provider's reply permits
retaining derived models, parameters, analyses and outputs, and does not cover
retaining raw API data after the subscription ends. MatchMind's production store
and its research packets hold normalized **field-for-field copies** of provider
values, which is arguably reproduction of the raw data rather than derivation
from it. The reply does not answer this, and it affects the production fixtures
store and the 93,680 and 93,545 row packets inside the private checkpoints, not
just the pilot.

Nothing is deleted on the strength of that ambiguity, and this preflight does
not propose deleting anything in production. The question needs either
continuous renewal, so the condition never lapses, or one follow-up question to
the same support channel asking specifically whether normalized field-level
copies count as raw API data for the post-expiry rule. The second is cheap and
should be asked before 11 November. Full detail is in
`PROVIDER-RIGHTS-RESPONSE.md`.

Also unresolved, and smaller: the provider specified **no deletion grace period
and no backup-verification method**, which is why both are set conservatively
here rather than inferred.

## 12. Non-actions

No provider request, no credential, no dashboard session, no hosted Supabase
use, no paid inference, no prediction, no reservation, no financial-control
change, no merge and no deployment. PR #6 remains draft and unmerged. The
retained $0.306000 reservation is untouched, and the one global $5.00 lifetime
ceiling is unchanged. OpenRouter is not connected to this environment and
nothing here touches it.
