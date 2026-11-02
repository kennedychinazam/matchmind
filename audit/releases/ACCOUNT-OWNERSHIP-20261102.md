# Offline account-ownership correction — Director review

Baseline `8acf62144c8a5df759ab95c98d813d7de4e171e5`; isolated from the Search patch. This correction partitions favourites/removal stamps, personal prediction history and account preferences. It does not change Build355 formulas, canonical frozen forecasts, source records, historical archives, financial controls or hosted schema.

## Ownership and preservation

Personal data uses separate `mm_personal_v1:owner:<encoded user ID>` keys; guest/unassigned state uses a separate key. Authentication transitions save the outgoing valid slice, detach it before incoming rendering/merge, and select only the matching partition. Reads, snapshots, persistence, queued writes and asynchronous personal effects require matching owner and authentication epoch. An owner-bound successful cloud read is required before cloud writes; returned row identity and shape are checked. Fresh-device account preferences are restored before the first save; existing matching local preferences are retained under the documented local-wins rule.

Original ownerless `mm_state` is retained exactly in `mm_state_UNASSIGNED` before the shared cache can be replaced. A version marker alone cannot authorize losing ownerless fields. Conflicting backups, malformed partitions or failed preservation pause admission and retain original stored strings. No legacy or guest data is assigned to the next account, imported, repaired or uploaded automatically. Account UI reports paused/unavailable storage and retained unassigned legacy data without exposing its contents.

Async fixture/history/settlement and notification-preference operations carry their starting owner/epoch across awaits. Stale operations cannot append personal records, repaint personal affordances or register changes under the next account. Notification transport was tested only through synthetic stubs; this is no live subscription/RLS/delivery verification.

## Verification and boundaries

Twenty new offline ownership cases cover switching, logout, return/reload, empty/populated accounts, guest/legacy refusal, malformed/colliding/failed storage preservation, wrong-owner/failed cloud reads and writes, delayed producers, preferences and private UI. Initial and independently discovered failures were retained before correction. The original71 cases remain: three auth fixtures establish the newly required owner/read precondition; original test names and assertions are retained. Full local Node20/24 counts and exact-commit GitHub CI are reported in the draft PR. Independent security review found no remaining reproduced defect in this favourites/history/preferences scope; it is not whole-system release approval.

Existing device-wide API-Football and personal AI key stores are **outside this partition correction**. They are not encrypted or isolated by account, and logout is not complete secret erasure. Keyless, route-blocked acceptance is required under the current no-inference scope; account-owned credential isolation requires a separate Director decision. Existing possibly misattributed cloud records are not retroactively identified or repaired. Origin storage is not a defence against a person controlling the browser profile or arbitrary origin script.

No genuine account, provider, hosted SQL/write, notification permission/subscription, paid inference, merge or deployment was performed. Deployed RLS/auth/backend, physical-device/PWA, source rights and publication gates remain open. Keep this PR draft and publication NO-GO.

## Rollback

Before deployment, leave the patch unapplied and preserve its evidence. The old baseline has a known account-isolation defect: do not treat a revert to it as a safe enabled-sync release. Any later rollback requires a separately approved containment/revert artifact, independent CI and cache/version acceptance. Preserve all owner partitions and unassigned backup keys; never restore ambiguous legacy bytes into active private state or delete them as rollback. No production migration or cleanup is authorized by this document.
