# Pilot transport boundary

`transport.mjs`. The smallest real-transport integration for the single-batch
pilot. **It cannot send a request, and the reason is structural rather than a
branch anyone can edit.**

## Two deliberate absences

A real request needs a credential and a permission. Neither exists here.

**No credential, anywhere.** `buildRequest` returns `header_names:
['x-apisports-key']` and no header values. There is no environment read, no
credential file, no secret and no place to put one. A transport that wrapped the
platform's own `fetch` would send an unauthenticated request and get a 403.
Binding a credential is part of the separately approved implementation, not of
this file.

**No installed trust anchor.** `DIRECTOR_AUTHORITY.public_key_spki_base64` is
`null`. Every real dispatch must present a Director-signed, exact-scope
authorization, and with no key installed there is nothing to verify it against,
so `authorizeExecution` refuses with `director_public_key_not_installed` and
`executeRealTransport` can never get past it.

That second absence is the whole inertness mechanism. It is worth being precise
about why it cannot be worked around.

## What cannot confer execution permission

| Attempt | Why it fails |
|---|---|
| Flipping a flag | The anchor is not a flag. It is a frozen `null` where a public key would be, so there is nothing to verify a signature against. Setting a boolean somewhere supplies no key |
| Creating a fresh latch directory | The signed statement names **one** latch directory. A different directory needs a different signature, which needs the private key |
| Opening a synthetic session | `createSyntheticSession` is in-process only and grants nothing. The durable ceiling is the latch |
| Writing a self-issued authorization record | It would be unsigned, and no key is installed to verify it even if it were. The private key is the Director's and is generated outside this repository |
| Re-running an old authorization | Replay is bound to the named latch directory, whose one attempt is consumed before dispatch and never refunded, and a pre-existing latch directory is refused outright. A replay finds the attempt spent |
| Widening the window | A window longer than 24 hours is refused as `authorization_window_too_long`. A standing permission is not an exact scope |

## The authorization, exactly

Ed25519 over `canonicalJSON(statement)`. The statement is closed and every field
is checked after the signature verifies, because a valid signature over the
wrong scope authorizes nothing:

| Field | Checked against |
|---|---|
| `plan_hash` | the reviewed `pilotPlan().plan_hash` |
| `request_hash` | `canonicalHash(buildRequest(kind))`, rebuilt locally |
| `kind` | `fixture` or `status`, and the kind being dispatched |
| `latch_directory` | the directory actually in use |
| `storage_directory` | the store actually in use |
| `not_before_utc` / `not_after_utc` | the current clock, and a 24 hour maximum span |
| `nonce` | 32 to 64 hex characters, recorded for audit |

Refusals: `director_public_key_not_installed`,
`authorization_signature_invalid`, `authorization_scope_mismatch`,
`authorization_plan_mismatch`, `authorization_request_mismatch`,
`authorization_version_mismatch`, `authorization_window_too_long`,
`authorization_not_yet_valid`, `authorization_expired`, `authorization_nonce`,
`invalid_authorization_window`, `invalid_clock`, `malformed_authorization`.

`verifyAuthorizationWith` is exported as a pure function taking an explicit
public key, so the cryptography is genuinely tested with a throwaway keypair.
**A test cannot reach the real path that way**: `authorizeExecution` reads the
installed anchor and nothing else.

## The request

Reuses the production convention observed in Build 355 `index.html`: the fixed
host at line 2596 and the single `x-apisports-key` header at line 2640.

| | |
|---|---|
| Fixture | `GET https://v3.football.api-sports.io/fixtures?ids=788036-788048-788038` |
| Metadata | `GET https://v3.football.api-sports.io/status`, separately capped |
| Redirects | `error`, never followed |
| Automatic retries | `0` |
| Additional queries | `0` |
| Max attempts | `1` each |

**One deliberate divergence from production.** Production throws on a non-2xx
and discards the body. The pilot must preserve every body, error bodies most of
all, because that is the evidence and the provider has confirmed in writing that
error bodies may be retained on the same terms.

## The rehearsal path

`rehearseDispatch` runs the real sequence with an injected transport, so the
ordering guarantees are tested rather than asserted:

1. A non-simulated call or a non-function transport is refused **before**
   anything is consumed. A refused dispatch costs nothing.
2. The durable attempt is reserved through the latch **before** the transport is
   called. A test asserts the remaining allowance is already zero from inside
   the transport callback.
3. The transport is called **once**. A 3xx is captured, not followed. Nothing
   re-dispatches.
4. The bytes are copied and hashed **before** any parsing, by the existing
   adapter.
5. The outcome is recorded either way. A transport that throws has possibly
   reached the provider, so the attempt is still spent and the outcome is
   `failed`. Nothing refunds.
6. A response the adapter refuses, a credential header among them, records
   `unusable` with a fixed label. **The response never reaches a record**, and a
   test asserts the secret appears nowhere in the latch files.

Latch kinds map as `fixture` to `fixture` and `status` to `metadata`, so the
optional metadata attempt is capped independently and the two never share an
allowance.

## Lifecycle visibility

`lifecycleState({captureDirectory, latchDirectory})` names the stage:
`no_latch`, `ready`, `attempt_spent_no_capture`, `capture_unregistered`,
`capture_incomplete`, `store_unexpected_file`, `registered`,
`subscription_ended`, `deletion_in_progress`, `deleted`. Each carries
`governed`, `raw_bytes_present` and a required action. See
`RETENTION-LIFECYCLE.md` for what each one means and what closes it.

## Intended Linux runtime

| | |
|---|---|
| Host | WSL2 Ubuntu 20.04 on the owner's Windows 10 machine |
| Runtimes | Node 20.20.2 and 24.19.0 at `~/.local/nodejs/` |
| Platform | POSIX required. Every persistence path refuses on Windows with `posix_private_persistence_required` |
| Egress | restricted to `v3.football.api-sports.io:443` for the execution window |
| Not needed | Docker, a database, a scheduler, a hosted service |

**This is a candidate, not an approval.** The owner names the environment.

## Secret boundary

- No module in this repository reads an environment variable, a credential file
  or a secret. None should be changed to.
- The request object names the credential header and never carries its value, so
  no manifest, record, report or log can contain one.
- The adapter refuses any response header matching
  `authorization|api.*key|cookie|secret|token` before it can be stored.
- The credential is supplied only inside the separately approved real transport,
  which does not exist, and reaches nothing that is written to disk.
- **No credential was created, read, requested or transferred in this task.**

## Private evidence storage requirements

Enforced by the code, so the approved location has to satisfy them: an absolute,
fully resolved path; a real parent directory, not a symlink, owned by the
executing user and not group or world accessible; the capture directory created
exclusively by the adapter at mode `0700` with files at `0600` and `O_NOFOLLOW`;
outside every Git checkout, hosted application and synchronized folder.

The owner must still name the path, its administrator and its encryption
posture. The modules enforce privacy on a directory they are handed. They do not
bless one, and they do not encrypt.

## Standing position

No request was sent. No credential exists here. No key is installed. Dispatch is
simulated-only, the real path refuses at the missing anchor, and
`grantsExecutionAuthority()` returns `false`.
