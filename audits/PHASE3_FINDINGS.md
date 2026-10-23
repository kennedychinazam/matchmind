# MatchMind — Phase 3 statistical research and leakage audit

**Captured:** 2026-10-23. **Development branch only.** Supabase project `toqfdrcjzwnlydqekude`.
**Base:** protected Build 355, `036f09b29f27a10c7d8bdcec1f16efd557c714e4`.

## Findings from existing full application source

**Do not rebuild work that is already present.**

- `footballEngine.strengths2()` implements opponent-adjusted attack and defence ratings, a home/away league baseline, iterative strength solving, league/cup-specific shrinkage and recency weighting. `fxPredict()` applies `xcAdjust` on specific eligible fixtures. A live `M14` feature-based adjustment is **not** in the ordinary `fxPredict` path.
- `footballEngine.marketsFor()` already supports a Dixon–Coles low-score correction (active `ENGINE2.RHO = -0.08`). The model is not a basic uncorrected independent-Poisson engine.
- `TUNE.HALF_LIFE = 10000` currently represents very slow recency decay. A prior `[40,80,150,300,600,10000]` walk-forward comparison found a slight improvement at 300, but it did not pass the previously registered holdout lower-bound rule; it was deliberately left off. **Do not rerun the same historical holdout and call it new confirmation.**
- M14 includes `matchFeatures`, `m14Rows`, train/validation/holdout splits (train seasons 2022–23, validation 2024, holdout 2025 onward), ridge fitting, missingness indicators, and a holdout history stored *locally* on the browser device. The server connector cannot prove which devices have spent that holdout. **Treat previously inspected 2025–26 data as exploratory, not a pristine holdout.**
- Player absence vectors and opponent-adjusted historical features are partially developed. Do not add independent parallel implementations to the live app.

## Audited market comparisons

See `PHASE2_FINDINGS.md` and `004_preissue_market_benchmark.sql`.
In the 816 fixture **paired** valid pre-issue odds cohort, model Brier 0.61771 versus fair 1X2 bookmaker Brier 0.59053. The market baseline is stronger here; this says nothing by itself about profitable betting.

`008_league_market_diagnostics.sql` found 44 leagues in the paired cohort, but **only 19 leagues had >=20 matched predictions**. Among those 19 small descriptive strata, just **4** had a lower point-estimate Brier for the existing model. The sample is too small and heavily selected for custom league-by-league promotions. E.g., Champions League (lid 2) looked favourable over 29 matches; do not use a league's 29 matches to select its model.

## Feature feasibility — same historical issuance dates

`009_asof_feature_feasibility.sql` examined 1,997 pre-kickoff issued predictions from August–23 October 2026; a historical match must have played *before* the prediction calendar day, within the prior 180 days. Current database coverage is **not** proof of pre-issue access.

| Availability condition | Prediction fixtures |
|---|---:|
| Both sides had >=5 preceding scored league matches | 1,438 / 1,997 |
| Both sides had >=3 preceding historical xG matches in today's DB | 907 / 1,997 |
| Both sides had >=3 preceding historical shot-stat matches in today's DB | 1,075 / 1,997 |
| Both sides had >=3 preceding historical lineup matches in today's DB | 1,103 / 1,997 |
| Both sides had >=5 preceding results whose rows were last updated before issue | 861 / 1,997 |
| Both sides had >=3 preceding xG matches whose rows were last updated before issue | 407 / 1,997 |

`updated_at <= issued_at` is a **conservative, incomplete** availability test. It may reject records that actually existed before issue but were routinely rewritten afterward. It cannot replace a per-feature first-observed timestamp.

## Coverage of the provider's finished-fixture archive

`010_historical_feature_coverage.sql` returns 2022: 18,832 fixtures / xG 5.76%; 2023: 18,700 / 24.53%; 2024: 18,884 / 27.73%; 2025: 18,921 / 39.51%; 2026: 6,338 / 33.20% (incomplete year). These cover *all* provider competitions, not just the M14 model subset. Some leagues never provide xG. Thus low xG coverage on older training seasons is a genuine obstacle to advanced models and can lead to misleading training/holdout drift.

## What we learned, and what NOT to do

1. **Do not** add a brand-new opponent-strength engine; it already exists.
2. **Do not** turn on 300-match recency or M14 solely because they showed partial benefits historically; prior tuning has consumed that evidence.
3. **Do not** backtest xG, lineups, injuries or shot measures taken from today's completed fixture row as though they existed before an old prediction. Backtests must read archived first-observed snapshots, not mutable `fixtures` data.
4. **Do not** promote per-league alternatives on tiny samples or inspect a proposed future holdout multiple times to select settings.
5. **Do not** compare selected tip/Double Chance hit rates with 1X2 top-choice accuracy or assume either indicates bookmaker-beating profits.
6. **Do not** backfill missing xG with invented values. Separate missingness from zero; track source coverage per competition.

## Release experiment specification — preregistration before collecting fresh test data

- **Control:** exact existing Build 355 probability output and issued pick, saved immutably. No retuned thresholds or altered publication gates.
- **Candidate 1:** preregistered alternative using different recency/shrinkage conditions, *only if* trained on a new, genuinely separated period. Prior 300-match improvement is already exploratory and must not count as fresh evidence.
- **Candidate 2:** the existing M14 feature layer when its inputs can be proven to have been observed before the prediction and have adequate coverage. Use exactly the existing feature builder with only the minimum integration adaptation; do not invent an additional competing feature pipeline.
- **Candidate 3:** optional fair-bookmaker blending as a **benchmark or candidate**, not a forced choice, and only when actual pre-issue odds are recorded and valid. Evaluate whether it beats market alone, not merely baseline alone.
- **Prospective period:** issue timestamp >= 2026-11-01T00:00:00Z is prelabelled `prospective` by `audits/lib/research-contract.mjs`. Prior data including October is research/development or exploratory. Final release evaluation requires both a frozen candidate implementation **before its first test issue** and a future sample not used for tuning.
- **Metrics:** paired multiclass Brier (sum scale), log loss, calibration by class, exact issued market-pick grading using 90-minute scores and the 48-hour void policy, n and missing-coverage/abstention rates, league and pre-kickoff lead-time segments, and de-vigged market comparison on same fixtures.
- **Accept only** if prospective comparison supports a material improvement in the primary proper-scoring metric, secondary proper score is not degraded, there is no significant deterioration in major competitions or market grades, and the inputs are provably as-of. Do not interpret an uncorrected pooled confidence interval as a complete proof under team/competition clustering. Decide exact magnitude and cluster-aware inference method *before* the future blind test.
- **All candidate forecasts are shadow outputs.** Production predictions, odds history and graded original picks remain untouched. No paid AI calls.

## New automated audit contracts

`audits/lib/research-contract.mjs` enforces observed_at <= issued_at, historical match played_at < observed_at, chronological cohort labels, immutable pre-kickoff issue, and paired baseline/candidate scores on identical fixtures; missing timestamps or unprovable features **fail closed**. Tested by `audits/test/research-contract.test.mjs`.

## Recommended next phase / Codex-only boundary

The next substantial step is a **full-codebase integration**: append-only versioned pre-issue feature snapshots, isolated backend read patterns, publisher-safe collection, per-field `observed_at`, immutable original prediction lineage, and a staging-only dry run covering the full app and Supabase Edge Functions. This is where **Codex Cloud must be used exclusively as coding agent**, not another agent. See `docs/CODEX_PHASE3_HANDOFF.md`. None of those backend production changes have been deployed.

**Safety gate:** Verify private function-source and database restoration before creating production migrations or editing the live `refresh-af` function. Make staging changes first. Preserve the current release and recovery branch.
