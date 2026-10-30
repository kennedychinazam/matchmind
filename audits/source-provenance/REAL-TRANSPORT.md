# Real transport integration

`real-transport.mjs`. The implementation `EXECUTION-PREFLIGHT.md` section 8a
step C named as missing. It now exists.

**It still cannot reach the provider**, and the reason is the same structural
absence as before: the only function that can open a socket refuses unless the
Director's public key is installed, and it is not. Nothing in this task
installed a key, bound a credential, created a latch at an approved location or
sent a request.

## What this closes, and what it does not

| Preflight row | Before | Now |
|---|---|---|
| 8a step C, a reviewed real transport that binds the credential | did not exist | exists, awaiting independent review and the owner's written approval |
| 8a step A, the Director keypair | owner's, outside this repository | unchanged. Not generated, not held, not requested |
| 8a step B, installing the public key | reviewed process | unchanged. Not installed |
| 8a step D, one signed exact-scope statement | owner's | unchanged. None exists |
| 11, execution authority | NO-GO | still NO-GO. Steps A, B and D are open |

Step C was the only one any amount of work in this repository could close. The
other three are the owner's, and this module makes none of them easier to skip.

## Nothing new was designed

The request inventory, the authorization format and its verifier, the attempt
ceiling, the capture adapter and the retention lifecycle are imported unchanged
from `transport.mjs`, `attempt-latch.mjs`, `provider-adapter.mjs` and
`retention.mjs`. No file among them was edited. What is new is only the
integration those four leave out: a credential binding, a real `node:https`
client, a bounded body read, a target assertion, a preflight gate, and the one
pipeline that puts them in the right order.

No collector, scheduler, database, deployment or financial path is touched. No
environment variable is read. Build 355, the production `refresh-af` collector,
the normalized archive, the A3/A4 contracts, the immutable journals, the
$5.00 lifetime OpenRouter ceiling and the retained reservations are untouched.

## The order, which is the whole safety property

`runPilot` is the only dispatch sequence in the module.

| # | Step | Cost if it refuses |
|---|---|---|
| 1 | Verify the Director-signed, exact-scope authorization | nothing |
| 2 | Rebuild the request locally and assert it against the permitted inventory | nothing |
| 3 | Preflight every refusable condition | nothing |
| 4 | **Reserve the durable attempt** | from here, spent and never refunded |
| 5 | Dispatch **once**, carrying the credential | spent |
| 6 | Clear the credential; refuse a response that echoed it | spent |
| 7 | Copy and hash the bytes **before** any parsing | spent |
| 8 | Record the outcome, whatever it was | spent |
| 9 | Persist privately, verified by reading it back | spent |
| 10 | Register retention immediately | spent |

Steps 1 to 3 are free on purpose. A refused dispatch must cost nothing, because
the ceiling is one attempt and nothing refunds it. Steps 9 and 10 are adjacent
on purpose: the window between them is the ungoverned window
`RETENTION-LIFECYCLE.md` section 1 describes, and it is as short as two
different concerns can be made.

## One pipeline, two boundaries

The real entry and the rehearsal entry differ in exactly two values, and share
every line between them.

| | `executeAuthorizedPilot` | `rehearsePilotExecution` |
|---|---|---|
| Verifier | `authorizeExecution`, which reads the installed anchor | `verifyAuthorizationWith` with a key the caller names |
| Client | `realHttpsClient`, token-bound | an injected function |
| Reachable today | **no**, refuses at the missing anchor | yes, against synthetic responses |

So the ordering the tests prove is the ordering a real run would have. The real
entry refuses to accept `client`, `verify`, `simulated` or `clock` from a
caller, and the rehearsal entry refuses `realHttpsClient` and refuses to run
unless `simulated` is literally `true`.

**This is the residual risk, named plainly**: the `node:https` call itself is
reviewed by reading, never by executing. Its argument handling, its TLS options
and its one-attempt behaviour are read from the Node documentation and from the
code, and the first genuine execution will be the pilot. That is unavoidable
without sending a request, which is exactly what is not authorized.

## The credential

Runtime only. Never embedded, stored, written, hashed, logged or returned.

`bindCredential({supply})` calls `supply` **exactly once**, at bind time, and
keeps the value in a closure rather than on a property. There is no accessor
that returns it. `toJSON`, `toString` and the Node inspect hook all report the
header name and the state, so no log line, template or `console.log` can print
it. The holder is frozen.

| | |
|---|---|
| Where it goes | into one request header, `x-apisports-key`, matching Build 355 `index.html:2640` |
| How long it lives | from bind until the dispatch settles, success or failure. The binding clears it in a settlement handler |
| Reuse | refused. A consumed or discarded binding cannot be used again |
| Validation | printable, 16 to 256 characters, at bind time, so an unusable credential costs no attempt |
| Wrong provider | a value starting `sk-`, `eyJ` or `bearer` is refused. An OpenRouter or JWT secret must never be sent to API-Football |
| Supplied by | the operator, at execution time. No module in this repository reads an environment variable or a credential file, and none should be changed to |

**The echo tripwire.** A provider that reflects the key into a header or a body
would otherwise put it into evidence we are about to write to disk. The response
is scanned for the value, and for its base64 form, inside the same single use
while the value is still reachable, so the scan cannot be skipped by clearing
early. A match records `credential_echoed_in_response` and throws. The response
never reaches a record, and the label never carries the value.

**No credential was created, read, requested or transferred in this task.**

## The request, on the wire

| | |
|---|---|
| Fixture | `GET https://v3.football.api-sports.io/fixtures?ids=788036-788048-788038` |
| Metadata | `GET https://v3.football.api-sports.io/status`, separately authorized and separately reserved |
| Port | 443, TLS, `minVersion` TLSv1.2, `rejectUnauthorized` true, SNI pinned to the host |
| Agent | `agent:false`, a fresh one-off agent. No pooling, no reuse, no second socket |
| Redirects | never followed. `https.request` does not follow one, so a 3xx arrives as a response and is captured as one |
| Retries | none. One attempt, one socket |
| Fallback hosts | none, including no RapidAPI host |
| Request body | none |

The request object is rebuilt locally from `pilotPlan()` and then checked
against the permitted inventory. A caller cannot name a host, a path, a query,
a port, a userinfo prefix, a fragment, a method or a second endpoint:
`assertPermittedTarget` rebuilds the expected request and compares the canonical
hash.

### DECISION-1: `accept-encoding: identity`

The reviewed request names one header. On the wire, Node adds `Host` and
`Connection` whatever we do, so "one header" was never literally true, and this
module sends a third: `accept-encoding: identity`.

Why, rather than leaving it out: nothing here decompresses, because the captured
bytes must be the bytes received. Without an explicit identity encoding a
compressed body would be captured as bytes the adapter refuses with
`inconsistent_content_decoding`, and the unrefundable attempt would buy nothing.
If the provider compresses anyway, the response is reported as compressed and
refused rather than silently decoded.

The result records `wire_header_names` so a reviewer sees the full list without
reading the code. **This is a decision for the owner to accept or reject**, not
a change to the reviewed request hash, which is unchanged.

## The bounded body read

`collectBoundedBody` reads at most the reviewed `max_body_bytes` and stops. It
runs before any decoding, parsing or projection, and the bytes then go to the
existing adapter, which copies and hashes them before `JSON.parse` is reached.

| Outcome | Recorded as |
|---|---|
| Whole body inside the cap | `complete: true` |
| Body overruns the cap | truncated at exactly the cap, `body_exceeded_limit` |
| Stream fails mid-body | kept as far as it got, `body_stream_interrupted` |
| Connection closed before the body finished | `body_not_fully_received` |

A truncated body is still evidence, and the attempt that bought it is spent
either way, so it is kept and marked incomplete rather than discarded. The
adapter then reports `inventory_complete: false`, which is the honest answer.

## Evidence and retention

Capture goes to the existing adapter and the existing store: an exclusively
created private directory at mode `0700`, files at `0600`, `O_NOFOLLOW`, fsynced,
and verified by reading it back and comparing the capture hash and the bytes.
`registerRetention` runs immediately after, under the unchanged policy:
subscription expiry **2026-11-11T13:47:51Z**, deletion deadline
**2026-11-10T12:00:00Z**, covering original bodies, error bodies, temporary
copies and every registered backup.

The preflight refuses outright once the deadline has passed or the subscription
has expired, so the pipeline cannot acquire bytes it has no permission to hold.

### DECISION-3: a declared backup is not copied here

`retention.mjs` never copies raw bytes, and neither does this. With a backup
declared, the pipeline registers it and reports `backups_declared` with
`backups_verified: null` and the required action, instead of asserting a
retainability it cannot honestly reach. The copy is preflight step 18 and the
check is step 20, in that order. A declared backup that does not exist refuses
later with `backup_missing`, and one whose bytes drift refuses with
`backup_copy_mismatch`.

### DECISION-6: which clock is which

The capture's `request_started_at_utc` and `response_received_at_utc` are read
from the process clock either side of the dispatch, so the capture's chronology
is observed rather than asserted by the caller. The authorization, latch and
retention clock stays the explicitly supplied `nowUtc`, as everywhere else in
this repository. `request_id` and `collector_sha256` remain the caller's, and
the commit hash is the operator's to supply at execution.

## Refusals

Free, before anything is consumed:

`director_public_key_not_installed`, `client_requires_authorized_pipeline`,
`real_execution_boundaries_are_not_caller_supplied`,
`simulated_rehearsal_required`, `injected_client_required`,
`real_client_forbidden_in_rehearsal`, `director_public_key_required`,
`credential_supply_function_required`, `credential_supply_failed`,
`credential_shape_invalid`, `credential_binding_required`,
`credential_consumed`, `credential_discarded`, `credential_consumer_required`,
`forbidden_request_target`, `forbidden_request_shape`, `invalid_timeout`,
`invalid_body_limit`, `readable_body_required`, `clock_function_required`,
`authorization_request_mismatch`, and every refusal `transport.mjs` already
lists, plus `preflight_refused:` carrying one or more of:
`unknown_request_kind`, `posix_private_persistence_required`,
`absolute_latch_directory_required`, `absolute_storage_directory_required`,
`invalid_clock`, `retention_deadline_passed`, `subscription_expired`,
`invalid_adapter_metadata`, `retention_registration_storage`,
`retention_registration_reviewers`, `retention_registration_backups`,
`backup:…`, `latch_missing`, `latch_unreadable:…`,
`latch_directory_not_private`, `fixture_attempt_exhausted`,
`metadata_attempt_exhausted`, `storage_directory_exists`, `storage_parent:…`.

After the attempt is spent, and therefore loud rather than quiet:

| Refusal | What it means | Attempt |
|---|---|---|
| `pilot_dispatch_failed` | the request failed and **delivery is ambiguous**. It may have reached the provider | spent |
| `credential_echoed_by_provider` | the response reflected the key. Nothing is stored | spent |
| `pilot_response_unusable` | the adapter refused the response. Nothing is stored | spent |
| `pilot_evidence_not_persisted` | the bytes are not on disk. Account for the spent attempt | spent |
| `pilot_retention_not_registered` | **raw provider bytes are on disk with nothing governing them.** Register, then delete. Never delete directly | spent |

The last two carry the `lifecycleState` reading and the required action on the
error itself, because at that point no code is wrong and the only honest
response is to be loud.

## Independent review of this module

Six findings against my own work, all fixed before delivery. Three were
reproduced by probe rather than inferred.

**R01, critical, authorization bypass.** `realHttpsClient` was exported and
directly callable. An importer holding a key could call it with the legitimate
request and reach the provider, bypassing the Director authorization, the
attempt ceiling and the retention policy together, making every gate in the
module optional. Reproduced: a direct call with a synthetic secret and the real
request passed every check and proceeded to open a socket. Corrected to refuse
on a module-private token that only `executeAuthorizedPilot` can mint and never
passes to a caller-supplied function, and independently on the missing anchor.
Covered by a regression that tries the call bare, with six forged tokens
including `Symbol.for('authorized_dispatch')`, and wrapped.

**R02, privacy.** The dispatch failure attached the client's error as
`cause`. The client is holding the credential at the moment it fails, so its
message is the one piece of text in the pipeline that could carry a secret.
Reproduced: a client whose error quoted the key put the key into `error.cause`.
Corrected to drop the error and report a fixed label with
`transport_error: 'withheld_may_contain_credential'`. Covered by a regression
that asserts the secret appears nowhere in the error, its own properties
included.

**R03, correctness.** The pipeline asserted retainability immediately after
registering a declared backup, which can never pass, because nothing copies the
backup. Every run that declared one failed with `backup_missing` after the
attempt was already spent. Reproduced by the backup test. Corrected per
DECISION-3.

**R04, cost.** An unusable storage label, reviewer list or backup path was only
discovered after the attempt was reserved, leaving raw bytes ungoverned for a
refusal that was free to make. Corrected: the preflight validates all three,
mirroring `retention.mjs`, which stays the authority.

**R05, robustness.** A `supply` accessor could return one function to the type
check and a different one to the call. Corrected to read through the property
descriptor once and refuse anything that is not a plain value.

**R06, platform.** `process.getuid()` is undefined on Windows and would have
thrown a `TypeError` after the platform refusal had already been recorded, so
the refusal list would never have been returned. Corrected: the storage parent
check is skipped on `win32`, where every persistence path already refuses.

Considered and deliberately not changed: the secret is held in a closure from
bind until the dispatch settles, rather than supplied at dispatch time. Binding
later would shorten the window, and would mean an unusable credential costs the
unrefundable attempt. The ceiling is worth more than the few milliseconds.

## Verification

`audits/test/real-transport.test.mjs`, 20 tests, synthetic injected clients
only. Nothing in it opens a socket, reads an environment variable or names a
real credential.

| Covered | How |
|---|---|
| Missing, unsigned and malformed authorization | 14 variants, each asserted to leave the attempt unspent |
| Wrong signature, wrong key, tampered statement | a throwaway keypair and a second one |
| Wrong scope, wrong kind, wrong plan, wrong request, extra signed field | signed correctly and still refused |
| Expired and not-yet-valid authorization | both sides of the signed window |
| Self-issued authorization | shaped right, signed by nobody |
| Duplicate attempts | second dispatch refused in the same process, fresh store and all |
| Process restart | a **genuinely separate process** reads the spent attempt and refuses |
| Concurrent dispatch | two processes on a shared start barrier, exactly one winner |
| Network errors and ambiguous delivery | three failing clients, attempt spent, outcome `failed`, one call only |
| Partial, oversized and invalid responses | truncated, 16 MiB + 1, compressed, status 99, credential-shaped header |
| Bounded body read | four outcomes directly, against real streams |
| Credential leakage | the value is absent from every latch record, retention record, manifest, stored file, result and error |
| Credential echo | body, base64 body and header, with nothing stored |
| Capture and registration failure | a store that appears mid-flight; a declared backup that disappears mid-flight |
| Expired subscription and passed deadline | at the deadline and past expiry, attempt unspent |
| Inventory bypass | ten forbidden targets, five forbidden shapes, a third endpoint that cannot be named |
| Real path unreachable | synchronous refusal at the anchor, boundaries refused, client token refused |

Run it:

```sh
node --test audits/test/real-transport.test.mjs
```

## Intended runtime

Unchanged from `TRANSPORT-BOUNDARY.md`: POSIX required, WSL2 Ubuntu 20.04 as the
candidate host, Node 20.20.2 and 24.19.0, egress restricted to
`v3.football.api-sports.io:443` for the execution window, no Docker, no
database, no scheduler. **The owner names the environment.**

## Standing position

No request was sent. No credential exists here. No key is installed. The real
client refuses on a token and on the missing anchor,
`grantsExecutionAuthority()` returns `false` and `realDispatchReachable()`
returns `false`.
