# MatchMind PRO — Phase 2 evidence and decisions

Captured: 2026-10-23. Production app: Build 355 (`036f09b29f27a10c7d8bdcec1f16efd557c714e4`).
Source: read-only queries against Supabase project `toqfdrcjzwnlydqekude`.
Branch: `feature/matchmind-quality-upgrade`.

## Executive decision

**Do not change the live prediction engine or activate paid AI based on these findings.** Existing pre-match 1X2 forecasts beat a uniform 1/3 baseline, but **underperform a fair bookmaker probability benchmark on identical fixtures**. An exploratory mixture of the two improves as more bookmaker weight is applied; this is not evidence the model adds useful information to the market. Research must focus on incremental information and prospective, time-safe validation.

## Audited prediction cohorts

1. Full historical eligible settled 1X2 prediction cohort (Build >=62, pre-kickoff, no 48h-late played fixture): **1,912**. Average 1X2 most-likely outcome hit rate **51.05%**, summed multiclass Brier **0.60772**, log loss **1.01555**. Uniform 1/3 Brier **0.66667**, log loss **1.09861**.
2. Strict market-matched cohort: **816** of these 1,912, where an aggregated 1X2 odds snapshot existed **before prediction publication**, within the preceding **24 hours**, and the three decimal prices were positive and implied a reasonable overround. Latest eligible snapshot per match selected by captured_at, id. Bookmaker margin removed by normalising inverse 1X2 odds.
3. On these exact same 816 fixtures:

| Metric | MatchMind | Fair bookmaker benchmark | MatchMind minus market |
|---|---:|---:|---:|
| Top-1 1X2 accuracy | 50.49% | 51.84% | -1.35 percentage points |
| Multiclass Brier (sum of three errors; lower is better) | 0.61771 | 0.59053 | +0.02718 |
| Log loss (lower is better) | 1.02894 | 0.98933 | +0.03961 |

Illustrative normal-approximate paired 95% CI for mean Brier *difference*: **+0.01451 to +0.03984**. This is descriptive and does not account for clustering by teams, competitions, selection bias or repeated inspection. No claim about profit, actual arbitrage prices or absolute market efficiency.

**Odds aggregation caveat:** `odds_snapshots.h/d/a` are aggregate observed prices, not necessarily three prices available from a single bookmaker at the same instant. They form a benchmark distribution after de-vigging, not a guaranteed executable betting strategy. No post-publication or closing odds were used in the pre-issue comparison.

**Coverage caveat:** paired n=816/1,912 is about 42.7%. The other predictions did not have the same valid, timely pre-publication snapshot. This can introduce selection bias. Snapshot data began in August 2026. Do not generalise results unqualified across all competition types or earlier months.

## Market disagreement diagnostics

- Model and bookmaker most-likely picks disagreed on **132/816** fixtures (16.18%). On these 132, MatchMind was correct **28.79%** and the bookmaker benchmark **37.12%**.
- Outcome-class average forecast versus realised proportion:

| Class | Observed | Model mean | Market mean |
|---|---:|---:|---:|
| Home | 46.446% | 46.049% | 45.286% |
| Draw | 25.368% | 26.045% | 25.296% |
| Away | 28.186% | 27.906% | 29.418% |

Average class bias is modest. The market has lower per-class Brier for all three classes; **do not assume** an intercept adjustment solves the problem. Investigate the discriminative ranking and probability sharpness, competition heterogeneity, model-strength shrinkage, opponent quality, cross-competition transfer and feature availability.

## Exploratory blend, *not* a model selected for release

Weight `w` blends `(1-w)*model + w*market`. Existing weights `w=0,0.25,0.5,0.75,1` were compared with a calendar split.
- Aug–Sep (n=409) Brier: **0.65966, 0.64549, 0.63488, 0.62783, 0.62434**, respectively.
- October (n=407) Brier: **0.57555, 0.56737, 0.56148, 0.55787, 0.55656**, respectively.

Higher market weight improved these observed scores. October was **already examined during the preceding benchmark audit** and is **not a pristine holdout**. No weight is approved for production. All comparisons should be repeated prospectively on newly issued fixtures or with a genuinely untouched holdout.

## Published shared-record reconciliation

Latest `shared_records.engine` observed: build 354, computed **2026-10-23 13:46:28 UTC**.
Current independent regrade at **18:56:55 UTC**:

| Metric | Published earlier | Current regrade |
|---|---:|---:|
| Total predictions | 2,185 | 2,185 |
| Excluded historical rows | 53 | 53 |
| Graded, including drawn DNB voids | 1,874 | 1,912 |
| 48h-late voids | 69 | 36 |
| Pending | 157 | 139 |
| Orphans | 32 | 32 |

**455 fixture rows were updated after the published summary** (292 of the now-finished fixtures were touched). Therefore these tallies are **not aligned in time**. No exact parity claim or bug conclusion is justified without replaying the same immutable fixture snapshot, including statuses and 48-hour late-void transitions. The current data model stores mutable fixture status, not a full historical status ledger.

**Potential specification risk to research:** Build 355 comments declare a 48-hour void final, but if the fixture was unplayed at +48h (graded void), and subsequently receives a finished status with a fixture date inside the original 48 hours, its current derivation can classify it as settled. This is a *logical non-monotonicity risk*, not proof that it has occurred in production. A safe correction may require a persisted, append-only terminal void event or audit snapshot, deployed only with a migration and staging test.

## Audit artifacts

- `001_data_quality.sql`: source completeness/integrity.
- `002_ledger_reconciliation.sql`: independent grading logic.
- `003_probability_calibration.sql`: overall 1X2 reliability bins.
- `004_preissue_market_benchmark.sql`: time-safe pairwise market comparison.
- `005_time_split_blend_experiment.sql`: exploratory blending with marked time periods.
- `006_market_disagreement_diagnostics.sql`: bias and disagreement population.
- `007_shared_record_freshness.sql`: stale summary versus changing fixture table.
- `lib/independent-grade.mjs`, `lib/bookmaker-metrics.mjs`, `test/*.test.mjs`: pure dependency-free regression tests.
- `.github/workflows/audit-regression.yml`: test on development branch only.

## Next development gate (Phase 3)

1. Preserve immutable **pre-issue fixture features and market snapshots** before any fitted feature/model comparison. Don't backfill data fetched after an outcome into a prior forecast.
2. Preregister a small number of non-overlapping candidates, e.g. baseline engine, an alternative opponent-weighted/team-strength update, and baseline plus genuinely available pre-match features. Revisit prior M13/M14 holdout results before re-testing them.
3. Use chronological folds across competitions with all model tuning confined to training/validation periods. Keep a future, untouched cohort (including market benchmark) for release decision.
4. Measure proper 1X2 scores, calibration, by-market selected-pick grades, sample sizes and bookmaker-relative Brier/log loss. Treat marketing hit rate and profitability as different objectives.
5. Reject improvements without adequate coverage or reproducible out-of-sample improvement. Any accepted model change is merged only after end-to-end regression and staging testing.

### Deployment status

Changes remain **only** on `feature/matchmind-quality-upgrade`. Protected Build 355 backup branch and production `main` are unchanged. Production Supabase and paid AI configuration unchanged. Do not port the audit helper directly into live app as an alternative grader: the app's one-source-of-truth architecture must remain intact.
