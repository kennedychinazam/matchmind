# MatchMind — Phase 1 Read-only Audit Toolkit

**Branch:** `feature/matchmind-quality-upgrade`  
**Original protected version:** Build 355, commit `036f09b29f27a10c7d8bdcec1f16efd557c714e4`  
**Production project:** `toqfdrcjzwnlydqekude`  
**Safety:** No SQL in this directory creates, updates, or deletes production records. The independent JavaScript grader is **not** wired into the live app.

## What is implemented

| Artifact | Purpose |
|---|---|
| `001_data_quality.sql` | Source completeness for finished/upcoming fixtures, probability validity, forecast/snapshot referential integrity, model-measure age |
| `002_ledger_reconciliation.sql` | Independently grade published picks against Build 355's 90-minute/DNB/48-hour void rules and compare with the most recently published `shared_records.engine` |
| `003_probability_calibration.sql` | Pre-kickoff 1X2 probability Brier/log loss, most likely outcome accuracy, monthly performance, confidence buckets, uniform 1/3 benchmark |
| `004_preissue_market_benchmark.sql` | Pairwise model versus bookmaker de-vigged 1X2 forecasts, restricting odds to a valid <=24-hour snapshot *before* each prediction |
| `005_time_split_blend_experiment.sql` | Exploratory model/market probability blends across earlier and later time periods (no weights for release) |
| `006_market_disagreement_diagnostics.sql` | Per-outcome average calibration and disagreement between model and market's top 1X2 selection |
| `007_shared_record_freshness.sql` | Quantify differences between the saved publisher tally and the changing live fixture table, including post-tally updates |
| `lib/bookmaker-metrics.mjs` and `test/bookmaker-metrics.test.mjs` | Independent de-vig, time-safe snapshot selection and paired scoring regression coverage |
| `PHASE2_FINDINGS.md` | Evidence, caveats and next-phase release gates |

| `lib/independent-grade.mjs` | Standalone grading and proper scoring functions, used **only** in tests |
| `test/independent-grade.test.mjs` | Regression tests for all headline/goals markets, HT/FT, DNB, 90-minute scores, postponements and probability scoring |

## How to run

1. Open Supabase's SQL Editor for project `toqfdrcjzwnlydqekude`.
2. Open each numbered SQL file and execute its **SELECT-only** contents. It is safe to run them repeatedly.
3. Run the regression suite locally with Node.js 20+ (no NPM packages required):

   ```sh
   node --test audits/test/independent-grade.test.mjs
   ```

4. Save the outputs with the query execution time; do not replace production data with derived audit data.
5. If the independent ledger and the shared-record summary disagree, first compare `shared_records.computed_at` against now. The live fixtures table changes continuously; exact count parity requires comparing the same fixture snapshot, not a stale published summary against the current DB.

## Important definitions

- All recent-coverage denominators use finished match rows from the previous **30 complete UTC days**. They are **not** per-competition percentiles. `NULL` for an unsupported xG, weather, or lineup field is not by itself a broken API.
- An xG or shots column being populated does **not** imply the live statistical predictor uses it. In Build 355, `fxPredict` uses the primary results-based engine plus a cross-competition adjustment; `matchFeatures` is a separate research layer.
- The `001` query's age-of-measurements metric is a warning **only**: publishing measurements may be recomputed on a different cadence, and age by itself cannot prove failure.
- `002` keeps drawn Draw No Bet as a `void_draw`; its win rate denominator is **hits + misses**, not all completed fixtures. Predictions before Build 62 and reconstructed Build -1 records are excluded. The query cannot reconstruct exactly how a fixture or its odds looked hours earlier without historical snapshots.
- `003` grades the **1X2 probability distribution** separately from published slips/Double Chance/goal-market selections; a hit rate from `002` must never be compared directly to the `003` top-1 hit rate. It includes drawn matches as legitimate class X outcomes.
- The multiclass Brier score in `003` is **sum of three squared class errors**, range 0 to 2; the uniform 1/3 benchmark is 2/3 (0.66667). Other conventions divide by 3; don't mix these scales.
- `003` excludes records at/after their original kickoff, reconstructed builds, fixtures played 48+ hours late, and invalid probability triples. It compares against a fixed uniform 1/3 benchmark, not against bookmaker implied odds or a strong empirical prior. The benchmark is a minimum quality check, not proof of a betting advantage.
- No AI calls are made. The AI context/shadow features remain paused.

## First execution, 2026-10-23

The three SQL files were executed against the live database through a read-only connection. Key observations:

- The fixture/data audit found no orphaned predictions or bookmaker snapshots, no missing stored 1X2 probabilities, and no invalid three-way probability totals.
- The independent grading cohort and the latest published `shared_records.engine` were **not synchronised in time**. Do not label the difference a bug until compared at the same snapshot.
- Pre-kickoff 1X2 probability cohort: 1,912 fixtures, **51.05%** top-1 outcome accuracy, summed Brier **0.60772**, log loss **1.01555**. Uniform 1/3 baseline: Brier **0.66667**, log loss **1.09861**.
- High-confidence bins have small samples; confidence >=80% had only 23 matches and should not be independently recalibrated from those matches.

## Next gates before any production change

1. Verify actual cron function responses (a pg_cron `succeeded` status means an HTTP request was enqueued, not necessarily that the Edge Function completed successfully).
2. Snapshot shared-record and fixture results at the same cut-off for an exact grading reconciliation; investigate 48-hour postponements as match status changes.
3. Add bookmaker closing-price benchmark and walk-forward calibration validation, withholding a test period.
4. Record source freshness thresholds per competition before triggering automatic alerts.
5. If an accuracy-improving model passes holdout, integrate it into the shared prediction engine via isolated staging, not by separately changing public screen calculations.

Never push service-role or billing keys into this public repository. Do not deploy server-side Edge Function copies here without security review.
