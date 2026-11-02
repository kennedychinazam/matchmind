# Build 357 draft integration control record

Status: **DRAFT / UNMERGED / UNDEPLOYED**, 1 November 2026. This record carries no merge or production authorization.

## Exact lineage

- Stable production branch `main`: `036f09b29f27a10c7d8bdcec1f16efd557c714e4`, Build 355, unchanged.
- Launch work: draft [PR #10](https://github.com/kennedychinazam/matchmind/pull/10), head `101d8c438c4acfef7b69b784da3921d9d6705c45` (Build 356).
- Settlement safety: draft [PR #11](https://github.com/kennedychinazam/matchmind/pull/11), head `14c824f12266e08b0b1be743c6d63d513b3c7695`, including recovery R7.
- Separate integration: draft [PR #12](https://github.com/kennedychinazam/matchmind/pull/12) from the original `main`, Build 357. Neither source PR was merged. Research PR #6 remains draft.

Build 357 combines first-visit fallback, honest statistical prediction descriptors, conditional DNB disclosure, saved-key restoration, fail-closed AET/PEN 90-minute settlement, stale-history bypass refusal and source-timestamp-aware recovery. It increments `APP_BUILD` and the service worker cache to `357` together.

## Test record

GitHub Actions [combined run 41264672308](https://github.com/kennedychinazam/matchmind/actions/runs/41264672308):
- Node 20.20.2: **36 tests passed, zero failed, zero skipped**.
- Node 24.19.0: **36 tests passed, zero failed, zero skipped**.
- Composition: 14 Build356 launch regressions; 20 settlement/consumer tests, including the R7 corrective-replay paths; 2 combined release integration checks.
- Tests used localhost with off-host application requests blocked. **The live GitHub Pages, Supabase happy path, authenticated sync, provider fixture acquisition, real fixture grading and production RLS remain unverified.**

The combined DNB test deliberately separates **forecast confidence disclosure** from **settlement grading**. A previously published DNB probability stays an explanatory forecast even while the 90-minute result is unavailable. The fixture must show its AET result as `90' n/a` and must not receive a grade chip. A withheld pick must not show a DNB confidence note.

## Integrity, scope and known limitations

- Preserved the Dixon–Coles coefficient, cup/league shrink constants, cross-competition weights, newcomer floor, lambda assembly, DNB conversion, grading formula, original 145 frozen forecasts, research controls and $5 OpenRouter lifetime cap. No model mathematics was intentionally changed. No production database or provider data was written.
- A provider `score.fulltime` pair can be plausible but wrong. Build 320 identified 7 of 128 audited extra-time cases with this defect, which Build357 does not infer or repair. No retroactive regrading.
- The R7 in-session source registry never substitutes a cached 3–2 AET final for an authoritative 2–2 90-minute corrected score. When timestamps exist, an older or undated observation cannot override a newer timestamped refusal. The scope remains only observations actually seen in the current session.
- No real-data forecast reconstruction or empirical new cross-division model calibration was executed. Build355's cup seeding/home-away confound and inter-division level issue remain research blockers.

## Go / No-Go

- **GO:** offline code review and read-only owner-controlled preview with synthetic or independently authorized data.
- **NO-GO:** merging to public `main`, publicly inviting users, enabling AI spend, changing RLS, acquiring provider fixtures or deploying before separate owner approval.
- Blocking gates: [Issue #8](https://github.com/kennedychinazam/matchmind/issues/8) publication/crest rights, subscription expiry **2026-11-11T13:47:51Z**, raw-data deletion deadline for original pilot **2026-11-10T12:00Z**; [Issue #9](https://github.com/kennedychinazam/matchmind/issues/9) production live verification, access controls and owner release decision.

## Rollback plan for a future approved deployment

1. Before any authorized release, verify the deployed exact commit, preserve existing main Build355 SHA and immutable forecast/financial audit evidence privately; do not reset spending latches or original archives.
2. Only deploy after explicit owner authority and rights clearance. Record the actual release commit, public URL, observed build/cache and a browser/Supabase happy-path verification result.
3. If a release defect occurs, suspend invitations and the publisher as necessary under separately approved operational controls. Return the application to a previously approved code revision using a **revert commit** with the owner's consent, not a force push.
4. On any rollback, use a **new forward-incrementing service-worker cache/build version** so clients receive an upgrade notice rather than retaining broken Build357 assets. Restoring the literal Build355 cache identifier is not a safe rollback.
5. Confirm the version banner, scores, sync, 90-minute settlement and financial halt after rollback. Preserve all original provider data and archive evidence subject to Issue #8 retention rights. No automatic destructive database rollback.
