# Offline injected provider capture adapter

Baseline: `748dc6b8f4ac635175a4e116a06bc15f3b2d237a`. Synthetic-only software extension; genuine acquisition remains NO-GO. Original `offline.mjs`, A3/A4 contracts, Build355 and production `refresh-af` are unchanged.

## Boundary and reuse

`provider-adapter.mjs` imports the accepted capture/projection/reconciliation functions plus existing bounded JSON, safe plain-data cloning, canonical/raw hashes, UTC chronology and football identity policy. It reuses refresh-af v54's fixed API-SPORTS origin, GET fixture query and maximum-20-ID batching convention. It deliberately does not import the deployed handler, Deno.serve, Supabase client, environment access or retry loop.

`pilotPlan()` binds exactly `GET /fixtures?ids=788036-788048-788038`, one fixture attempt, no redirects/retries/additional queries, 16MiB body ceiling, and a separate optional one-attempt `/status` metadata plan. The plan is synthetic and cannot grant dispatch authority. `createSyntheticSession()` only accepts inert response data through `captureFixture(response,metadata)` and `captureStatus(response,metadata)`. An attempt is consumed **before** validation, including invalid/failed/partial responses. New synthetic sessions are independently labelled rehearsals, not a way to reset an operational attempt. There is no genuine operational latch or approval loader in this stage.

`executeRealTransport()` always throws without inspecting its arguments. Passing approval flags, a callback, native Response or credentials cannot enable it. No HTTP client, executable real-transport CLI, scheduler, database writer or financial path exists.

## Response and receipt

Response has exactly `status`, `headers`, `body` (native Uint8Array/Buffer), `body_complete` (boolean), and `content_decoding` (`mode`: none/automatic/unknown; `encoding`: identity/gzip/br/deflate/unknown). Getters, shared memory, custom response callbacks and nonstandard byte prototypes reject. Bytes are copied and hashed before decoding/parsing. Unknown decoding remains explicit and cannot yield complete inventory. Automatic decoding records the representation delivered by the HTTP client, **not compressed wire octets**; compressed Content-Length is not compared with decompressed length.

Metadata has exactly `request_id`, UTC-Z request/receipt clocks, and `collector_sha256` (source artifact digest, not a 40-character Git commit). Simulated clocks/hashes/labels are not independent provenance. Safe response headers retain content type/length/encoding, provider date, separate daily/minute counters and numeric Retry-After. Credential-bearing header names reject; other unapproved headers are discarded. Missing counters never become zero. Original body bytes, including malformed bodies/API errors, stay private and unchanged; safe analysis never forwards error text.

The closed receipt binds plan/request identity, original HTTP status, safe headers, byte-representation/decoding declarations, completeness, clocks, byte length and body SHA256 under its own canonical hash. Returned buffers remain mutable; every analysis/read/write verifies their hashes. Hashes provide integrity, not authenticity. HTTP 206, redirects, non-JSON/non-200 responses, incomplete lengths/bodies, malformed data, duplicate/missing/extra IDs, invalid statuses and paginated responses cannot produce complete inventory.

## Projection and reconciliation

`analyzeCapture(capture,normalized)` requires the complete unique three-row inventory. It reuses prototype validation and reconciles without the optional fictional period rule: even a matching valid response stays `period-unverified`; it never certifies regulation semantics or source admission. All analysis remains synthetic, provider authenticity/period semantics unverified, source_review_admissible=false. Successful and failed observations refer to the persisted adapter receipt hash, not an unpublished intermediate prototype hash.

`originals` contains the accepted safe fixture/league/team/score projection plus a `status` object preserving short/long/elapsed/extra when present. All original fixture.status fields and all score components, including unknown fields and null/missing distinctions, remain in raw bytes. Unknown status properties are not promoted to the review projection. Invalid status text/clock types quarantine the response. Normalized scores are compared, never replaced, and AET/PEN totals are not reinterpreted as regulation goals.

## Private persistence

`writeAdapterCapture(absoluteDirectory,capture)` creates an exclusive owned 0700 directory under an existing owned/private real parent; response.bin and manifest.json use exclusive 0600 writes. Files and directory are synchronized. Verified readback is mandatory before returning success. Existing directories/files are never reused, partial persistence remains an incomplete directory, and symlinks/nonregular/oversize/wrong-owner/nonprivate files reject. The caller must keep evidence outside public Git. POSIX privacy/synchronization is supported; Windows fails closed **before creation**, rather than treating mode bits as a Windows ACL guarantee. Readback is integrity verification, not tamper-proof storage or a multi-file atomic transaction; parent-directory crash durability and an independent backup remain later acquisition gates.

## Examples and verification

`node audits/source-provenance/provider-adapter.example.mjs` prints an explicitly synthetic example with base64 exact bytes, receipt and deterministic analysis. It has no network/credential path. Optional `--retained-selection /private/pilot-selection-evidence.json` builds simulated responses against the previously verified retained three-row selection and prints only receipt hashes/classifications. Its illustrative FT/AET/PEN labels are **not historical status assertions**. The complete retained exports stay private and untouched.

Run `node --test audits/test/provider-capture-adapter.test.mjs`; full regressions use the unchanged Node20.20.2/24.19.0 CI matrix. Focused tests exercise byte integrity, complete statuses/scores, null/missingness, partial/malformed/error/binary responses, inventory/query/page checks, credential exclusion, one-attempt latches, disabled real transport, deterministic reconciliation, tampering, private exclusive persistence and symlink/FIFO refusal. Windows checks the explicit unsupported-persistence branch; Linux CI must exercise positive persistence and FIFO behavior.

## Remaining genuine-acquisition prerequisites

Separate Director approval is needed for a versioned real transport binding, current access and separate daily/minute quota evidence, exact scope/one-attempt limit and execution window, private raw/error-response retention rights/duration, private POSIX output and backup arrangements, and independently reviewed source/period evidence. Reuse an existing approved credential only then; create none for this implementation. A real transport must durably consume its attempt before I/O and must not restore it after an ambiguous result. Synthetic session latches do not implement that later operational authority. Capturing three real statuses may still leave category coverage incomplete. No expired fixture policy, global halt change, new study, inference or reservation follows from this module.

## Error register and review record

- Initial native worktree creation rejected a source path outside this chat's roots; isolated local clone of the accepted commit used instead. Original source worktrees preserved.
- Accepted baseline's two persistence tests fail on native Windows with EPERM directory fsync; original code left unchanged. Full Linux Node20/24 CI is required.
- Failing-first API assertion observed undefined functions before implementation. Initial behavior run exposed an API-SPORTS credential-header matcher gap; corrected and rerun.
- Independent reviewer reproduced HTTP206 incorrectly accepted as complete and successful observations referring to an unpublished intermediate hash. Added failing regressions for both; corrected before delivery.
- Reviewer identified potential FIFO blocking before fstat on POSIX; a timeout-bounded subprocess regression and regular/nonblocking open checks address it. Exact execution/review receipts accompany the final report.

STOP FOR DIRECTOR REVIEW. PR6 remains draft and unmerged. No genuine acquisition, credential use, production collector/SQL/configuration change, inference or reservation is performed.
