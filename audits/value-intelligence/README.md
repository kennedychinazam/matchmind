# Stage 1 — coherent football market mathematics

Research-only, offline and uncalibrated. **No actionable value selector exists in this stage.** No odds, model fitting, API client, paid call, bet placement or production integration is added. This directory is not imported by the application, publisher, old AI workflows or financial ledger.

## Scope and interfaces

```js
import {scorelineDistribution} from './scoreline.mjs';
import {marketProbabilities} from './markets.mjs';

// Synthetic rate example, not verified football inputs or a recommendation.
const d = scorelineDistribution({lambdaHome:1.8,lambdaAway:1.4,rho:0});
const probabilities = marketProbabilities(d);
```

`scorelineDistribution(parameters, options)` accepts only `lambdaHome`, `lambdaAway`, optional `rho`; options accept only `tailTolerance` and `maxGoals`. Unknown fields reject. Rates must be finite numbers in **[0,20]**; zero rates are degenerate Poisson distributions. `rho` is finite in [-1,1] and every Dixon–Coles factor must be nonnegative; invalid dependence rejects with no clamp/fallback. `rho=0` is independent Poisson; nonzero rho is explicitly labeled Dixon–Coles. No parameter is represented as learned or calibrated.

Default tail tolerance is **1e-12**, supported requests **1e-14 through 1e-4**. This is a numerical truncation setting, not a betting confidence level. Default per-side support limit is **128 goals**, allowed integer resource limits **0–256**. An insufficient support limit throws rather than returning an unbounded truncated distribution. Positive-rate grids include at least goals 0–4, preserving low-event categories and tiny positive one-goal events. A rate zero needs only its zero-goal cell. Required complete history is never an input to this module and is never truncated by its score-grid resource bound.

The returned object, nested metadata and cells are frozen. It reports rates/family, full normalized rectangular cells, support cutoffs, retained mass before normalization, factor, analytical tail upper bound, separate floating-point allowance and event-probability error allowance. Outputs are annotated `actionable:false`, `calibration:not_validated`. These annotations are honest research metadata, not a substitute for future admission controls.

## Mathematical model and numerics

Independent Poisson: `P(H=i,A=j)=exp(-h-a)*h^i/i!*a^j/j!`. Marginal PMFs use `p0=exp(-lambda)` and `p[k+1]=p[k]*lambda/(k+1)`; this is stable on the bounded domain. Beyond the mode, successive ratios decrease. For a retained cutoff k with lambda/(k+2)<1:

`P(X>k) <= p[k+1] / (1-lambda/(k+2))`.

Each marginal receives half the tail tolerance. The sum of marginal bounds majorizes omitted rectangle mass by the union bound. No cancellation-prone `1-roundedCDF` is used to establish that bound. The implementation adds a small relative roundoff padding and a subnormal floor to its computed bound. A zero-rate marginal has exactly zero tail. Summation uses compensation.

Dixon–Coles factors at (0,0), (0,1), (1,0), (1,1) are `1-h*a*rho`, `1+h*rho`, `1+a*rho`, `1-rho`. The correction preserves infinite-grid normalization when admissible. The same omitted-tail bound applies because only low cells are altered and the retained grid includes every nonzero corrected cell. Require all four factors nonnegative and finite. For positive rates the exact constraints include `rho>=max(-1/h,-1/a)` and `rho<=min(1,1/(h*a))`, as well as this module's declared [-1,1] domain. Degenerate-rate cases are checked directly, not by division by zero.

Cells are normalized by their explicitly recorded retained mass T. The returned point distribution is the original model **conditional on the retained rectangle**, not a claim of exact infinite support. For any event, the conditional-versus-infinite probability discrepancy is at most the omitted mass; it is not silently assigned to a home win/draw/total bucket. The aggregator separately checks a complete ordered rectangle and unit normalized mass rather than accepting caller-supplied error metadata as an excuse for a corrupt grid.

**Floating-point limitation:** the tail majorant is analytical. The separately named binary64 engineering allowance covers recurrence/products/tau/compensated sums/normalization on this small domain under ordinary binary64 rounding and a near-ulp `Math.exp`. JavaScript does not promise a formally outward-rounded transcendental implementation; this is **not formal interval certification** on arbitrary ECMAScript engines. Independent 75-digit Decimal references and boundary/property tests support the selected Node runtimes. Returned `eventProbabilityAllowance` combines truncation and engineering allowances; it is a numerical approximation allowance, never football parameter uncertainty or a statistical confidence interval. Extremely small mathematical probabilities below binary64 representability can still underflow to zero (for example, a four-goal event at rate 1e-100); representable retained events are preserved by smaller-side accumulation, but no infinite-precision guarantee is made. Formal interval arithmetic would be separately scoped. A requested tail tolerance smaller than the floating allowance does not make that total allowance smaller; inspect both fields.

## All fourteen regulation-time market selections

Every event concerns 90 minutes plus stoppage, excluding extra time and penalties. Codes:

| Code | Event |
|---|---|
| HOME / DRAW / AWAY | H>A / H=A / H<A |
| DC_1X / DC_12 / DC_X2 | home+draw / home+away / draw+away |
| BTTS_YES / BTTS_NO | both scores positive / complement |
| OVER_1_5 / UNDER_1_5 | total >=2 / <=1 |
| OVER_2_5 / UNDER_2_5 | total >=3 / <=2 |
| OVER_3_5 / UNDER_3_5 | total >=4 / <=3 |

Probability sums/complements, DC identities, O3.5<=O2.5<=O1.5 and BTTS<=O1.5 are tested. Both disjoint sides of each binary event are accumulated, then the smaller side is retained directly and only the larger side is formed by complement. This preserves tiny over-goal probabilities as well as tiny under-goal probabilities; at least 0–4 goals are retained for positive marginals so a zero-rate opponent does not eliminate every over-3.5 cell. Tiny roundoff excursions at endpoints alone are bounded to [0,1]; invalid model probabilities/mass reject, not normalize arbitrary invalid inputs. All values remain full precision until a future display boundary.

## Separately identified E-MARKET

`eMarketFromBuild355(engineResult, fixtureId, options)` in `e-market.mjs` derives this new research baseline from exactly one eligible row of a pinned offline engine artifact. It requires Build 355 source hash, full input hash, real/synthetic marker, valid fixture identity, complete original probability fields, matching artifact/row generation time and original issuance strictly before kickoff. It uses the frozen `lambdaH/lambdaA` and **rho=-0.08 tied to that pinned source**, with the new adaptive grid. `options` cannot override source, rho or model identity. Inadmissible old-clamp cases reject; they do not silently change the source rho.

The result is labeled **offline_derived_comparison_not_new_issuance**, preserving engine source/input hashes, original generation time, kickoff, synthetic marker and original probabilities/goals/BTTS separately from new market probabilities. No historical forecast/event is written. A JSON hash hint is not source authentication: the caller must independently verify the complete artifact/evidence lineage before any later study admission. This adapter does not authorize or dispatch anything.

E-MARKET is **not bit-for-bit the final published Build 355 market vector**:

- Same frozen rates and admissible rho reproduce its raw result grid within the independently bounded old/new truncation difference; tests call the actual pinned source method, not a duplicate implementation.
- Legacy grid retains 0–12 per side; new tails adapt to the requested bound and record omitted mass.
- Build 355 separately dampens goals/BTTS; E-MARKET keeps all fourteen marginals on one common distribution and does not apply that dampening.
- Build 355 clamps invalid tau; E-MARKET refuses such parameters.
- Historical A3 three-way probabilities are never converted into goals markets or reclassified as A4.

One integration test runs the actual unchanged offline browser engine on complete synthetic fixture inputs, passes its artifact to E-MARKET and verifies preserved original values and visible goals/BTTS distinction with zero outbound requests. Additional synthetic rate fixtures compare raw 1X2 against the source grid. No real match history or private financial/provider record is committed.

Regression-harness correction: `audits/phase8/engine.mjs` now sets a fixed browser Date only when the caller explicitly requests `nowUtc` synthetic execution. This replaces the racing install-clock/then-pause-at-the-same-instant sequence; timers continue normally. Real football execution still uses the genuine advancing clock, and the exact Build 355 HTML/model source is unchanged. The direct test oracle uses the same fixed-Date API. A delayed real-browser clock-setup regression verifies this without mocking the engine. An inherited 450-second dispatch test now fixes its supervisor date to the original Sunday independently of the host date, and an additional Monday rejection test requires zero reservation/checkpoint/HTTP. The actual Sunday restriction, real paid transport, source/capacity checks and immutable ledger code are unchanged.

## Future validated AI rates

The pure scoreline function is source-neutral: a later admitted, independently validated A4 mapping can supply its frozen rates and chosen admitted dependence parameters. This Stage 1 function does not pretend to validate those upstream football inputs, fit numerical boosts or manufacture calibration. No A4 invocation or bypass of existing source/model/BYOK/date/financial guards is added. Parameter uncertainty integration and bivariate/ensemble models remain later mathematical work; no independent market averaging is enabled here.

## Tests and reproducibility

`node --test audits/test/value-scoreline.test.mjs audits/test/value-e-market.test.mjs`

The standard full suite remains `node --test audits/test/*.test.mjs`, under Node 20.20.2 and 24.19.0. Seeded generators avoid a new dependency. Seven independent 75-digit Decimal reference cases include zero/tiny/high/asymmetric rates and nonzero rho; analytic Poisson totals/BTTS and exchange symmetry provide a separate oracle. DC four-cell shifts, invalid precision/domain/support/mass, deterministic replay, frozen outputs, E-MARKET provenance/immutability and actual engine parity/distinction are covered. Synthetic tests establish mathematical behavior, not predictive superiority, calibrated uncertainty or profitable value selection.
