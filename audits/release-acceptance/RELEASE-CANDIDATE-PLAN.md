# Release candidate plan, Build 358

Prepared 9 November 2026. Nothing in this plan has been applied, merged, installed or deployed.
Each step needs Director approval where marked.

## 1. Version and cache change (not applied)

Three edits, one commit, made on a candidate branch after approval. Applying them on PR 26 now
would break `test/integration-build357.test.mjs`, which pins 357.

| File | From | To |
|---|---|---|
| `index.html` line 1032 | `const APP_BUILD = 357;` | `const APP_BUILD = 358;` |
| `sw.js` line 2 | `const CACHE = 'matchmind-v357';` | `const CACHE = 'matchmind-v358';` |
| `test/integration-build357.test.mjs` lines 24 and 25 | 357 | 358 |

Other tests with 357 in them (branding-rights, display-read-truthfulness, edition-ordering,
fixture-delivery-*, mobile-*, played-no-snapshot-headline) must be checked one by one. Change only
those that pin the build number.

Update banner: `mmVersionWatch()` fetches `sw.js` with `no-store` and reads `matchmind-vNNN`. When
that number exceeds the tab's `APP_BUILD`, the "Build 358 is available, tap to reload" bar shows.
Bumping both values together is what arms it. Bumping only one breaks it.

Reader limits:
- Build 355 and 357 readers see the banner only after they go online once. Until then they keep the
  old shell and the old calendar day refusal.
- index.html must stay pure CRLF.

## 2. Candidate assembly (needs Director approval)

1. PR 26 targets `claude/blocker-closure-20261106`, not `main`. Map the stack of base branches back
   to `main` and list every commit between them.
2. Cut one candidate branch from the verified PR 26 head plus the version commit above.
3. Run the full suite and the five CI jobs on that exact head. Record the SHA.
4. Database and client ship together. Never SQL alone, never browser code alone.

## 3. Hosted order (each step needs separate Director authorization)

1. Staging: install the reviewed `PROPOSAL-up.sql` (blob to be recorded at that head). Staging still
   runs the earlier migration.
2. Staging: run the unauthenticated HTTP checks only. Do not repeat the privileged Auth test.
3. Operator device checks against the staging candidate (section 4).
4. Production migration, then client deploy, in that order, only after step 3 passes and the
   licence question is answered.

Rollback: `PROPOSAL-revert.sql` was rehearsed on staging. The client rollback is the previous
build's `sw.js` and `index.html`; readers get the banner for it only if its number is higher, so
a rollback ships as Build 359 with old content, never as a lower number.

## 4. Operator actions

1. Samsung Galaxy S23 Ultra and a real iPhone on Safari: `DEVICE-ACCEPTANCE-S23-IPHONE.md`.
2. `OPERATOR-CHECKLIST-ROLLING-EDITION.md`. A5 checks the new chip: `Updated Nh ago` past 7 hours,
   `Live` after a publisher run. Do not stop the publisher.
3. Someone reads the API-Football terms and answers the fixture facts question. No provider contact.
4. Record each result in the PR. Nothing is marked passed without a person on a device.
