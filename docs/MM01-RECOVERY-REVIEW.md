# MM-01 local recovery review — 26 November 2026

Accepted local implementation; the full MM-01 device/legacy gate remains open. This continues the existing v5 candidate and original priority register.

## Result

Corrupt owner data now has an explicit **Review recovery → Use reviewed copy** flow. Before offering replacement, it saves and verifies an immutable backup of the original bytes, known session edits and the reset baseline captured after this owner's failed read. The dedicated app-scoped IndexedDB store is excluded from ordinary recent-cache clearing/reset. Backups are bounded at 8 MiB per entry, 32 MiB retained payload and 64 entries; a capacity or integrity failure prevents replacement.

The reviewed copy combines validated data from the same cloud owner with changes known to have been made in this owner session. Favourite additions/deletion stamps and records follow existing merge rules. Only preferences changed from the captured reset baseline override cloud preferences. Corrupt original contents and ownerless legacy data are never guessed or assigned to the signed-in account.

Account, client, epoch, original-byte, session-edit and cloud-copy checks invalidate stale confirmation. Backup ordering uses a transaction-assigned sequence, with sequence/ID consistency verified before recovery. A damaged sequence test reproduced an older-session selection before that final guard; it now fails closed. An offline review can still preserve session edits durably for a later reload and review.

If another tab has already written a valid same-owner partition, Retry/account selection merges the known session edits with that valid data and confirms the local write before depending on cloud availability. A continued write failure retains a retryable merged in-memory snapshot. Confirmed reconciliation enables cloud synchronization; upload failure leaves the local copy durable and the badge reports failure separately.

## Verification and primary assessment

- Agent final focused run: **57/57 passed**, no failures or skips, covering reconciliation, original storage recovery and account ownership. Source SHA-256 `352e2f76dd49f88a737f5dd14dc854033b0ddc5b292e5ae3c06e2c7240bf0d15`.
- Additional external-valid repair/reload cases: **2/2 passed** on that source, including offline account-away/back.
- Primary final run after adding the sequence/ID guard: **21/21 passed**, no failures or skips. Includes the 18 reconciliation cases and three independent confirmation/integrity tests. Accepted local source SHA-256 `671d133c1c8f9b68aac2eb1a3df1ec6bf2a69df274ff8d86bbbcfe283cb2d1a7`.
- Earlier preliminary account/cache/confirmation checks: **50/50 passed**; source changed during the approved follow-up correction, so this is supporting evidence rather than one exact final-source receipt.
- Primary inspected the actual button-driven recovery review at a synthetic 390-pixel viewport. Text and buttons were readable without horizontal clipping. This is not physical-phone acceptance.
- Logs: `mm01-reconciliation-accepted-source-focused.log`, `mm01-external-valid-reload-final.log`, `mm01-primary-final-acceptance.log`, `mm01-backup-sequence-before.log` under local `work/`. Superseded test-only IDB key-order assertion was corrected; reload semantics were retained and verified.

The final cumulative candidate must rerun the combined regression/PWA gate and bind receipts to its exact source after subsequent accepted jobs. These per-job receipts do not substitute for that gate.

## Remaining gates

localStorage has no atomic compare-and-set shared with older tabs. The review explicitly asks the user to close other MatchMind tabs before replacement. The app rejects observed changes during review, but cannot guarantee coordination with an uncooperative old tab during the final synchronous write.

Controlled legacy cleanup remains open: old copies are retained, so this candidate does not immediately free all existing S20 quota. Real S20/S23 error stages, exact Chrome versions and installed-worker/storage context remain unmeasured. Both production install URLs, Chrome installation and visible Build 368 are already confirmed. No phone personal data was read, exported or cleared.

No hosted mutation, push, merge or deployment was performed. EDUVANTA was not accessed. The user's conditional authorization for necessary commits/pushes/merges applies after verified job completion; deployment remains separate.

**Next job: MM-02 publisher-session containment**, assigned only after this primary acceptance. MM-01 retains its external acceptance gates in the issue register.
