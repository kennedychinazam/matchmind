# Build 357 release remediation — Director review only

Publication remains **NO-GO**. This isolated patch extends accepted draft PR #15 (`a1599cb9d71babebc2292b7fbbc3e95546bbc32d`). It does not authorize a merge, deployment, historical regrade, provider request, account change, or data deletion.

## Verified defects and corrections

- Login/signup promise rejection recovers the form safely; completion tolerates replacement account DOM. Failed logout retains the session. Initial session failures are handled. Sync badges distinguish unverified, pending, failed and acknowledged writes. Account epochs prevent delayed reads/writes from being attributed to a different account; queued upserts serialize completion. This is client-side correctness, not proof of hosted RLS.
- Shared result observations refresh after three minutes, including already-final fixtures. The query carries the database's `updated_at` separately from local receipt time; this is **not** an upstream-provider timestamp. Missing goals and withdrawals enter the existing settlement registry before filtering. Explicit ordinary FT observations from this consumer enroll in that registry, preserving ordering, equal-time refusal and newer recovery. Other untracked FT fallback and accepted settlement functions are unchanged. Expired cached results cannot grade a shared leg; query omission does not manufacture a withdrawal or refresh freshness. Cached historical bytes and issued legs are preserved.
- Probability bars use the same complete published-board vector as their board selection, or display unavailable. They no longer borrow a local vector for an incomplete board row. Played fixtures require a complete stored vector; no retrospective replacement is displayed. Missing historical probabilities stay missing, while actual zero remains zero. Signed percentage differences/returns retain their generic formatting.
- DNB explanations distinguish conditional probabilities and withhold an unattributable outright breakdown. Market-specific headline calibration is not silently replaced by an outright vector. Provider percentage input requires all three valid fields and a rounding-compatible total. Provider analysis is view-only: it does not rewrite the engine pick or enter engine history. A new analysis generation prevents late provider/AI completions from repainting a different fixture. Provider errors clear dependent output and provider text is escaped. Margin-adjusted market probability is labeled as such; its arithmetic is unchanged.

No numerical model formula, Build 355 source, frozen forecast, research ledger, archive, SQL, collector or service-worker file changes in this patch. The app still uses Build 357/cache357 as an unpublished candidate; release-version/cache decisions require a separately approved integration artifact.

## Verification

`test/release-remediation.test.mjs` adds twenty intercepted-browser tests. The original eleven regressions failed on the accepted baseline before fixes. Review found and corrected additional banker availability, signed-formatting, played wording and FT withdrawal cases. Tests use invented rows/accounts and stubbed SDK methods; no provider, real account or hosted write is exercised. Full Node 20.20.2 / Node 24.19.0 matrix runs the complete `test/*.test.mjs` suite. Exact final-commit CI links and counts belong in the draft PR/Director checkpoint, not inferred from this document.

Use `git -c core.whitespace=cr-at-eol diff --check`: index.html retains its existing CRLF. Browser results are not physical-device, source-authenticity, legal or production acceptance evidence.

## Safe integration strategy — no merges performed

The reviewed ancestry is main → PR #12 (`d418514…`) → PR #14 (`581ccc5…`) → PR #15 (`a1599cb…`) → this branch. Review the combined diff from main as well as each incremental patch. Keep all drafts until the owner approves integration. If approved later, integrate dependencies in order or prepare a separately reviewed consolidated candidate; do not merge a dependent patch alone. Recheck exact heads, combined CI, published assets/cache update, and the final whole-application artifact after any rebase or integration. A green child-branch run does not prove a later merge artifact.

## Release blockers / owner-controlled evidence

- Genuine period/source authority remains incomplete: plausible stored full-time pairs are not proof of 90-minute authenticity. Cached observations outside a refreshed session are not retrospectively authenticated. No new source collection or historical repair is performed.
- API-Football redistribution/retention scope needs applicable accepted terms, authenticated account/official evidence, per-field publication rights, crest rights and a per-copy lifecycle decision. Owner-relayed support statements remain qualified evidence. Recorded pilot cutoff: **2026-11-10T12:00:00Z**; recorded Ultra expiry: **2026-11-11T13:47:51Z**. These are separate obligations pending authoritative verification; renewal alone does not extend a pilot undertaking. Do not delete archives or renew anything under this patch.
- Private nonproduction live/backend acceptance must establish RLS isolation, publisher permissions, account recovery, collector freshness and errors. Test accounts, each hosted mutation/denied-write probe, and implicit login/publisher writes require appropriate owner scope first. No live acceptance was performed here.
- Actual iOS/Android and desktop acceptance, installed-PWA update/offline tests and rollback rehearsal remain outstanding. Intercepted Chromium is not a substitute.
- Independent A3 and the historical research global halt remain separate from optional app commentary. Do not advertise unverified AI accuracy, calibrated profitability, or a genuine unavailable prediction.

The private Director package contains `RIGHTS-DECISION.md`, `ACCEPTANCE.md`, independent debugging/review evidence, full error records and exact CI receipts. It contains no credential values in the public patch.

## Rollback

Before deployment there is nothing live to roll back. Close or leave this draft unapplied to return to the accepted #15 candidate. If its code is later integrated under separate authorization, revert the remediation commit on a new reviewed branch, rerun both complete suites, and obtain explicit release approval. Any deployed cache/version rollback requires its own reviewed artifact and acceptance test; do not reset published forecasts, source records, archives or the financial ledger.
