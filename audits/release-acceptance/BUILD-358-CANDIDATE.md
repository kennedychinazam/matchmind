# Build 358 candidate

9 November 2026. Source only. Not merged, not deployed, no migration installed anywhere.

Branch `claude/build-358-candidate-20261109`, cut from the reviewed PR 26 head `ba8306f`
(`claude/staging-s1-s2-20261107`). Nothing was rebased, merged or rewritten. PR 26 stays draft.

## Ancestry, main to candidate

PR bases form one chain. Every branch head below is an ancestor of the candidate (checked with
`git merge-base --is-ancestor`). All PRs are open and unmerged. `main` is `036f09b`, the merge base
is `036f09b`, and the candidate is 59 commits ahead of it (82 files, 14,382 insertions, 406 deletions
in total across the stack).

| Order | PR | Branch | Head | Base |
|---|---|---|---|---|
| 1 | 18 | `codex/release-candidate-20261102` | `8acf621` | `main` |
| 2 | 21 | `codex/combined-security-20261102` | `34005c1` | PR 18 branch |
| 3 | 22 | `codex/release-final-20261102` | `ea7e94d` | PR 21 branch |
| 4 | 23 | `codex/public-fixture-remediation-20261102` | `7ed7a9f` | PR 22 branch |
| 5 | 24 | `claude/release-acceptance-20261106` | `20884c8` | PR 23 branch |
| 6 | 25 | `claude/blocker-closure-20261106` | `c63e6e6` | PR 24 branch |
| 7 | 26 | `claude/staging-s1-s2-20261107` | `ba8306f` | PR 25 branch |
| 8 | none | `claude/build-358-candidate-20261109` | the candidate commit | PR 26 head |

Consequence: merging PR 26 alone would not reach `main`. The stack merges bottom to top, or the
candidate is delivered as one reviewed squash. That choice is the Director's.

## Delta from `ba8306f`

| File | Change |
|---|---|
| `index.html` | `APP_BUILD` 357 to 358. CRLF kept. |
| `sw.js` | `CACHE` `matchmind-v357` to `matchmind-v358`. |
| `test/integration-build357.test.mjs` | pins 358 for both values |
| `test/pwa-lifecycle.test.mjs` | baseline is now 358, the synthetic update is 359 and the forward rollback is 360. New sha256 of `sw.js` pinned. |
| `.github/workflows/build357-integration.yml` | the candidate branch added to the push list so the five CI jobs run on it |
| `audits/release-acceptance/BUILD-358-CANDIDATE.md` | this file |

Not touched: formulas, thresholds, grading, archives, settlements, the migration, the publisher, the
manifest, quotas. `launch-readiness` and `mobile-pwa-acceptance` derive the build from the page, so
they needed no edit.

## Readers

`mmVersionWatch()` reads `matchmind-v358` from `sw.js` and shows the reload bar to any tab whose
`APP_BUILD` is lower. Builds 355 and 357 see it after one online visit. Until then they keep the old
shell and the old calendar day refusal.

## Preview URL

None exists. No preview, staging client or hosted migration for Build 358 has been created.
Physical checks need a real accessible candidate first. Hosted staging runs the earlier migration.
