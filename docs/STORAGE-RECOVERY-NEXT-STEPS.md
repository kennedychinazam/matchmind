# Storage recovery acceptance protocol and remaining gates

This continues MM-01, STOR-01 and STOR-02 in ISSUE-REGISTER.md. The offline recovery correction is a local candidate; these further items remain open. Preserve original owner and legacy data and require explicit authorization before hosted changes. No phone data has been cleared.

## Local v4 implementation

Future bulk-cache writes now go to an app-path/owner-scoped IndexedDB store. Personal partition writes and cloud sync stay independent. The application bounds each generation at 8 MiB, total retained data at 32 MiB and owner slots at four. Transactional preparation, SHA-256 readback and guarded promotion retain one previous committed generation; stale owner/source/live-load contexts cannot restore over newer data. Custom CSV, basketball and scorer input is protected from ordinary cache clearing. Corrupt generations remain retained and block replacement pending explicit recovery.

Legacy migration is copy-only: eligible regenerable blobs may be verified in IDB, but original localStorage values remain. An older tab can still write a key without a cooperating lock, and localStorage has no atomic compare-and-delete primitive. Controlled cleanup, older-tab/rollback acceptance and physical-phone measurements remain open. Do not describe this as freeing all existing S20 storage or resolving its on-device exception.

The acceptance suite includes cache failure isolation, denied/blocked/version-conflict IDB, aborted promotion, corrupt/expired generations, total/per-generation/slot bounds, concurrent-tab conflict, source/account/explicit-input fences, custom-input reload, private provider revocation and reset. Current results belong to the live continuation handover and versioned verification artifact.

## Bounded bulk-cache migration

1. Inventory only MatchMind's known cache keys and exact IndexedDB stores. Classify shared football data, custom CSV/scorer/basketball input, credentials, owner records/favourites and legacy ownerless data separately. Classifying everything in `mm_public_state_v1` as regenerable is insufficient if it contains custom input.
2. Use a MatchMind/app-scope-specific IndexedDB namespace. Production and preview share the GitHub Pages origin; a worker scope does not isolate localStorage or IndexedDB. Retain the preview builder's explicit storage prefix. Do not enumerate or modify sibling applications.
3. Store recent shared football cache in a versioned, single-active-generation record with size, source kind, capture/expiry time and digest. Bound bytes and generation count; refuse an oversized write with a cache-only failure. Keep small personal data and auth ownership decisions independent of this optional store.
4. Write, complete the transaction, read back and verify a new cache generation before publishing its pointer. Keep the previous verified generation during the transaction. A blocked database, quota error, interrupted upgrade or digest failure must leave the old generation usable and personal writes/sync unaffected.
5. Keep old localStorage copies until controlled cleanup can establish safe older-tab/rollback conditions, regenerable contents and a verified durable copy. Legacy/owner/custom-input data needs explicit preservation and its own lifecycle. Do not use origin-wide `clear()`, broad cache deletion or browser clear-all.
6. Restore asynchronously with owner/source/epoch and freshness fences. A late IDB result must not replace a newer public edition or another owner's data. Provider-only cached material must remain inaccessible to ordinary clients after publisher authority is lost.
7. Acceptance must cover near-quota upgrade, IDB denied/blocked/version conflict, interrupted transaction, two concurrent tabs, rollback, expired data, source/owner change, custom imports, fresh-device cloud hydration and physical browser/PWA contexts. Measure startup/egress before publication.

## Corrupt partition reconciliation — locally implemented

The protocol below is now implemented and locally accepted; see MM01-RECOVERY-REVIEW.md. It remains the acceptance specification. Physical-phone, controlled legacy cleanup and older-tab gates are still open.

1. Distinguish malformed JSON, unsupported personal/provenance shape, blocked reads and quota errors. Keep the original bytes untouched and sync paused for unreadable data. Current local code validates durable hydration metadata and fails closed.
2. A future reconciliation flow must first create a versioned durable backup under the same owner association, verify its digest and byte length, then read it back after transaction completion. A backup failure must prevent replacement. Do not rely on a second localStorage copy when quota is the original problem.
3. Read cloud data as a separate candidate, validate owner and field types, and show which source/version will be kept. Never reassign legacy ownerless favourites to whichever account signs in next. Preserve original prediction history and favourite deletion stamps.
4. Save the reconciled owner partition only after backup verification and current owner/epoch validation. Upload only after a successful validated cloud merge and local persistence. If cloud is offline, any valid retained owner edits must remain durable locally, with unsynced status.
5. Keep retryable partial outcomes. Backup, local save and cloud synchronization are distinct successes; no success message may imply all three occurred. No automatic deletion of corrupt originals, credentials or backups is authorized by the current candidate.
6. Test malformed/unsupported metadata, differing backup contents, cloud unavailable, reload/restart, account switching during each await, rollback and repeated attempts. Physical-phone testing remains separate from desktop Chromium tests.

## Immediate next evidence

Both install URLs are now confirmed as production. Both are installed from Chrome and show Build 368. Compare exact Chrome versions, installed worker state and the failing storage stage without requesting the confirmed facts again. Investigate S20 prior-preview/legacy storage only through scoped byte counts and error types. The physical database capacity metric cannot explain a localStorage exception by itself. The next storage implementation should be driven by this scoped evidence and the transaction tests above.
