# Phase 5: statistical validation of MatchMind PRO

Research date: 24 October 2026. Branch: `codex/phase5-statistical-validation`, based on feature commit `68c00de`. Decision: **retain the live engine; no candidate has earned promotion.** This report is suitable for research review with the limitations below. It does not establish prospective performance or bookmaker-beating returns.

## Verified baseline and changing data

Production access used explicit `REPEATABLE READ READ ONLY` transactions with 15–30 second statement timeouts. No database writes, provider requests, deployments or AI calls were made. The private cohort was frozen at **05:14:56 UTC**, SHA-256 `94dd49b6a20cd1aff0efd9866030c5d2a07e493a73eec8bf0af7e30b659e2e01`. It contains the currently saved original forecasts, not reconstructed forecasts. A frozen export does not prove that every legacy source row has always been immutable.

| Measure | Previous audit, 23 October | Current frozen extraction |
|---|---:|---:|
| Total saved predictions | 2,185 | 2,198 |
| Eligible settled 1X2 forecasts | 1,912 | 1,929 |
| Original-model summed Brier | 0.60772 | 0.60794 |
| Original-model log loss | 1.01555 | 1.01583 |
| Original-model top-choice accuracy | 51.05% | 51.01% |
| Legacy market pairs | 816 | 816 |
| Model / market Brier on pairs | 0.61771 / 0.59053 | 0.61771 / 0.59053 |
| Model / market log loss on pairs | 1.02894 / 0.98933 | 1.02894 / 0.98933 |

All 1,929 eligible forecasts were issued before the previous audit cutoff, `2026-10-23T18:56:55Z`. Thus the 17 additional eligible rows reflect settlement/eligibility or other mutable-data revisions; they are not newly issued successful forecasts. The 13 new prediction rows are outside this settled cohort. There is no previous row-level export with which to identify all changed fixtures, outcomes or probabilities. Matching rounded market aggregates cannot prove that the 816 individual source rows were unchanged. At extraction, 1,639 fixture rows had been touched since the old cutoff; this is not a count of changed outcome labels. No missing probability triples or missing fixture joins were found. The latter is a literal join check, distinct from audit 002's provider/dead-fixture “orphan” category.

Settlement follows audit 003 unchanged: Build >=62, completed status, pre-original-kickoff issuance, current kickoff less than 48 hours after original kickoff, valid probabilities, and a complete valid 90-minute score pair in preference to total goals. Of 1,929 rows, 1,753 have such an FT pair; **six outcome labels would change if total goals were used instead**. Missing/invalid FT pairs retain the existing provider-goals fallback; its potential ambiguity is not silently repaired. Negative kickoff revisions remain eligible under the existing rule. No public grading rules or terminal-void policy were changed.

Audits 003, 004, 005, 006 and 008 were reviewed and run read-only; the frozen extraction independently reproduces their principal metrics offline. Audit 005's match-date splits reproduce exactly: Aug–Sep n=409 Brier `[.65966,.64549,.63488,.62783,.62434]`, October n=407 `[.57555,.56737,.56148,.55787,.55656]`, for market weights `[0,.25,.5,.75,1]`. Those periods were already inspected. New candidate evaluation below uses **issuance dates**, not match-date labels.

Audit 009's fixed August–23 October population remains n=1,997. Current counts: both sides >=5 results 1,438; >=3 xG matches 907; >=3 shot-stat matches **1,077** (previously 1,075); >=3 lineup matches **1,105** (previously 1,103). Last-update proxies remain 861 for results and 407 for xG. This demonstrates archive-content drift, not newly proven historical availability. A separate read-only repeat at 07:59 UTC confirms these counts. Audit 010 at that time counts 6,381 finished 2026 fixtures, versus the earlier 6,338, and 33.41% xG coverage versus 33.20%; the incomplete season continued changing during research. Its 2022–25 totals and xG percentages reproduce the prior report. These later coverage reads are not mixed into the 05:14 scoring cohort.

## Evidence limitations and bookmaker comparison

The eligible market benchmark uses the latest positive-price snapshot with legacy `captured_at <= issued_at`, positive kickoff lead, age <=24 hours and overround 1.00–1.30, with inverse odds normalized to one. Selection precedes the overround test, exactly as SQL 004; a rejected latest snapshot is not silently replaced with an older valid one. Original rounded model outputs remain unchanged; only non-identity candidate transforms normalize probabilities.

**Timestamp eligibility is not authoritative pre-issue receipt provenance.** Production has no `research` schema. A `now()` default on legacy timestamps does not prevent overrides. No non-internal odds receipt trigger was present. Of the 816 pairs, 799 link to the saved publication odds ID and timestamp, but that client linkage still cannot certify server receipt or immutability. Consequently no demonstrably receipt-verified historical market cohort has been established. These are explicitly **legacy timestamp-matched, exploratory** comparisons. Prospective evidence requires the stronger capture controls; nothing has been deployed to establish them here.

Coverage is 816/1,929 = **42.30%**. Unmatched original-model Brier is 0.60077 on 1,113 fixtures, versus 0.61771 on matched fixtures. Coverage is selected and results cannot be extrapolated automatically. Aggregate multi-book prices are a probability benchmark, not three executable prices from one bookmaker or a return-on-investment test.

On the same 816 pairs, model minus market Brier is **+0.02718**, log loss **+0.03961**. Descriptive 95% intervals for the Brier gap are:

| Method | Interval | Limitation |
|---|---|---|
| Paired independent normal approximation | +0.01451 to +0.03984 | Ignores dependence |
| Resample whole UTC issuance-week blocks | +0.01370 to +0.04260 | Only 9 blocks |
| Resample whole competitions | +0.01359 to +0.03878 | 44 competitions; shared teams/time remain |

Bootstrap intervals use 2,000 paired resamples, fixed seed, unequal cluster sizes preserved. These are separate sensitivity analyses, not a complete multiway-dependence solution. Repeated inspection, source provenance and selection remain limitations even when an interval excludes zero. Wilson event-rate intervals below also assume independent trials and are descriptive.

## Where the errors appear

The principal supported finding is weaker **conditional ranking**, especially for home and away, alongside some calibration error. It is not proof of a single causal defect in home advantage, shrinkage or draw adjustment.

| Outcome, paired n=816 | Observed | Model mean | Market mean | Model / market binary Brier | Model / market ranking AUC |
|---|---:|---:|---:|---|---|
| Home | 46.45% | 46.05% | 45.29% | .23584 / .21875 | .635 / .704 |
| Draw | 25.37% | 26.04% | 25.30% | .18940 / .18782 | .535 / .563 |
| Away | 28.19% | 27.91% | 29.42% | .19247 / .18396 | .643 / .698 |

Average class biases are modest. Home and away account for about 63% and 31% of the summed Brier deficit respectively; draw accounts for about 6%. A blanket draw or home intercept adjustment cannot be assumed to fix ranking. AUC is descriptive, not the selection objective. Fixed-bin ECE sometimes favours the model despite worse proper scores; ECE is sample/bin dependent and must not override Brier/log loss. Full class reliability bins, Wilson intervals and ECE are in the aggregate JSON.

| Top-choice confidence, full n=1,929 | n | Mean confidence | Actual hit rate | Brier |
|---|---:|---:|---:|---:|
| <40% | 276 | 36.97% | 40.22% | .66175 |
| 40–50% | 648 | 45.44% | 44.44% | .64924 |
| 50–60% | 622 | 54.72% | 54.50% | .59426 |
| 60–70% | 285 | 64.10% | 61.40% | .54858 |
| 70–80% | 75 | 74.05% | 73.33% | .42549 |
| >=80% | 23 | 84.18% | 69.57% | .49872 |

There is no consistent global overconfidence pattern. The highest band raises a concern but has only 23 matches, with observed-rate Wilson interval approximately 49.1–84.4%. It cannot justify a fitted high-confidence cap. Low-confidence underconfidence also cautions against universal flattening.

When top choices disagree (132 fixtures), model/market hit rates are 28.79%/37.12%; Brier .73114/.66549. When they agree (684), the Brier gap still favours the market by .01975. Large L1 probability disagreement >=.4 has n=70 and model Brier .75246, deficit .13387. These are descriptive error concentrations, not a retrospectively selected betting or exclusion policy.

Audit 008 reproduces 44 paired competitions, 19 with >=20 observations, only four of those with a model-favourable point estimate. MLS n=53 gap -.00418; Champions League n=29 -.08224; Segunda n=45 +.03537; League One n=36 +.09123. Competition aliases are grouped by stable `lid`, not display name. Neither a 29-match favourable result nor multiple uncorrected league tests warrant a league-specific release.

Today's same-league 180-day history diagnostic associates thinner histories with poorer model scores: both teams >=5 results n=1,397 Brier .60145, otherwise n=532 .62496. Their paired market deficits are .02630 and .03205 respectively. Requiring last-update-before-issue history gives n=844/.59400 versus n=1,085/.61878, but rewrites can remove genuinely earlier records from that proxy. Current xG-rich histories also associate with lower absolute loss while **not** consistently reducing the market deficit. Competition, season, strength and selection confound these comparisons. No candidate uses these mutable counts as historical features.

The JSON also reports lead time, saved expected total goals and build era. For example <=6-hour issuance has only 71 matches (Brier .68861), versus >72 hours n=929 (.59801); this does not establish that delaying publication is harmful. Build >=335 scores better absolutely but still trails the market on its own matched fixtures. Calendar/case-mix changes prevent attribution to a build change.

## Candidate experiments and existing adjustments

All experiments are exploratory. October and prior M14 2025–26 holdouts are exhausted. The grid and split choices here are research choices after those audits, not a prospective preregistration. No fitting of the live statistical engine occurred.

For each fit cutoff, only earlier issues with kickoff at least 72 hours earlier and current label-row `updated_at` before cutoff enter training: 197 rows at 15 September (only 19 market pairs), 1,271 at 1 October (360 pairs). This is a conservative **last-update proxy**, not authoritative outcome-receipt proof. Evaluation issues follow the cutoff; no later evaluation outcomes enter grid selection. A minimum 100 training observations is enforced per candidate.

Bounded training-log-loss grids: probability power alpha `[.6,.8,1,1.2]`, home/draw log offsets `[-.15,0,.15]` with away fixed zero; empirical-prior shrinkage `[0,.05,.1,.2]`. These are postprocessors of saved probabilities, not new live models. Identity wins ties. Probability-only shrinkage here is **not** evidence for data-quality-aware shrinkage, which needs genuine as-of quality inputs. **New market-informed fitting is blocked:** no authoritative pre-issue receipt cohort exists. The `[0,.25,.5,.75,1]` blend sweep above only reproduces the old conditional audit, whose best historical weight is market alone; it is not a newly validated candidate.

| Evaluation issuance window | All / paired n | Selected recalibration: Brier change vs original, all | Selected shrinkage: change, all | Market blend |
|---|---|---:|---:|---|
| 15–30 September | 265 / 119 | +.00074 | .00000 (identity) | Not fitted: provenance unverified |
| 1–14 October | 399 / 298 | +.00454 | +.00347 | Not fitted: provenance unverified |
| 15–24 October, through frozen export | 137 / 98 | -.00001 | +.00299 | Not fitted: provenance unverified |

At September cutoff recalibration selects alpha 1.2, offsets [-.15,-.15,0]; at October cutoff alpha .8, offsets [0,-.15,0], shrinkage .2. Direction instability and later failure argue against imposing global confidence changes.

The **identical market-paired** fixture comparisons are:

| Window | Candidate | n | Brier change vs original | Brier change vs market | Log-loss change vs original / market |
|---|---|---:|---:|---:|---|
| September | Recalibration | 119 | +.00531 | +.02947 | +.00603 / +.04116 |
| September | Identity shrinkage | 119 | .00000 | +.02416 | .00000 / +.03513 |
| 1–14 October | Recalibration | 298 | +.00406 | +.02534 | +.00640 / +.03759 |
| 1–14 October | Shrinkage | 298 | +.00456 | +.02584 | +.00685 / +.03803 |
| Later October | Recalibration | 98 | -.00198 | +.01192 | -.00441 / +.01897 |
| Later October | Shrinkage | 98 | +.00285 | +.01675 | +.00338 / +.02676 |

Full paired Brier/log-loss intervals against **both** references, including original on exactly the market-paired subset, are in `results/2026-10-24-analysis.json`. For illustration, October recalibration's all-row Brier change has league-bootstrap 95% interval approximately [.00000,.00956]; later October's [-.00817,.00683]. Later October's paired subset occupies only one issuance-week block, so its week interval is explicitly unavailable. Small block counts invalidate strong inferential claims. Market-only cannot satisfy a requirement to improve on the market.

Source review of existing Build 355 identifies what can and cannot explain 1X2 errors:

- Opponent-adjusted strengths, home/away baselines, league/cup shrinkage (8/32), very slow recency and newcomer prior already exist. `xcAdjust` operates in the published path. Publication-time strengths, pre-adjustment lambdas, opponent histories and adjustment eligibility are not fully archived, so their individual causal effects cannot be replayed honestly from today's fixtures.
- `TUNE.TEMP=1` skips the probability transform; a currently active temperature-flattening operation cannot explain this cohort. Goals/BTTS `DAMPEN` is not applied to 1X2. Form probability boost/penalty are zero; its badge is not a probability boost. Do not change these controls to fix an unrelated metric.
- Active Dixon–Coles rho is -.08. The audit executes the **existing** grid method offline on saved rounded lambdas. All 646 Build >=335 records reconstruct within .001 (maximum absolute probability error .0002914). Setting rho to zero gives Brier change **-.00106**, log loss **-.00176**, versus original; Brier week interval [-.00312,.00019], league interval [-.00265,.00048]. It still trails market Brier by .01636 on 451 pairs. This conditional, rounded-lambda sensitivity is not a historical-version replay, and does not justify removing the correction.
- Prior 300-match recency, M14 and form tuning cannot be re-enabled on spent holdouts. M14 is not in the ordinary published `fxPredict` path. Advanced features remain a plausible research direction only with exact existing feature construction and immutable pre-issue inputs; today's xG/lineups/injuries cannot be backfilled into a historical forecast.

## Ranked recommendations and rejected approaches

1. **Strongest evidence:** maintain a serious bookmaker comparator and investigate conditional ranking/information quality. The 816 legacy pairs consistently favour the market across proper scores and descriptive dependence checks. Establish genuine provenance before calling the next comparison prospective. This is an accuracy research prerequisite, not authorization for more infrastructure optimisation or production changes.
2. **Worth controlled research, not selection for release:** modest recalibration and data-quality-aware shrinkage with pre-issue quality counts. Current simple global settings fail temporal stability. Seek a narrowly stated, independent hypothesis before freezing one candidate; do not keep searching October for a winner.
3. **Lower-priority sensitivity:** draw correction, home-advantage/strength shrinkage, recency and cross-competition transfer. Preserve existing implementations; test one predeclared perturbation at a time only when its inputs and version can be reproduced. Current rho evidence is weak and does not close the bookmaker gap.
4. **Conditional future work:** existing advanced statistical features with reliable source coverage and controlled private evaluation. Missingness and provider-era drift are part of the hypothesis, not zero-valued xG imputations. Paid AI adds no established evidence and remains disabled.

Rejected for promotion: blanket confidence increases or flattening; league-specific settings selected on tiny strata; calling market-only blending incremental model skill; headline hit-rate or double-chance gains without proper-score gains; mutable historical feature reconstruction; reused “untouched” holdouts; turning on prior unsuccessful advanced/recency settings. No original prediction, engine calculation, Smart Bet or UI was changed.

## Prospective evaluation and delivery

The proposed private study and measurable dual-reference gates are specified in [SHADOW_PROTOCOL.md](SHADOW_PROTOCOL.md). **No candidate is selected or preregistered yet.** A human-reviewed protocol and candidate freeze must precede genuinely fresh issuance; calendar dates alone never confer prospectivity. No hosted writes, collector integration, shadow scheduler or provider activation is included in this PR.

Before any promotion, require material paired improvement versus original **and** eligible market, uncertainty under a predeclared dependence-aware analysis, sufficient coverage, successful receipt/settlement auditing and independent review. Illustrative power planning with observed paired SD .18461 requires approximately 10,700 independent pairs to detect .005, or 21,400 assuming design effect 2; detecting .002 takes roughly 66,874/133,747. These are planning approximations, not an established power calculation for a future candidate. A short 1,000-match pilot cannot prove a tiny bookmaker-relative gain. The existing 250 MB research budget and actual fresh-pair throughput must be checked for feasibility before a fixed study is approved; no budget increase is authorized.

Reproduction instructions and source lineage are in [README.md](README.md). The complete feature-branch suite passes **43 tests on Node 20.20.2 and Node 24.19.0**, including nine new research regressions. The analysis is byte-identical across both versions. Phase 3/4's 107-test suite is on the separate PR #1 branch and is not merged into this branch. Changed-file credential checks and protected-ref checks are part of final verification. All added computation runs offline; production SQL is strictly read-only.

Reversal consists of closing this draft PR or reverting its research/documentation/CI commits. There is no database migration, live-engine rollback or production restoration to execute. Remaining limitations: no authoritative historical receipt cohort, no old row-level mutation ledger, incomplete exact model-input replay, no untouched current holdout, selected market coverage, few time clusters, no hosted Supabase integration verification, and no candidate currently demonstrated better than both references.
