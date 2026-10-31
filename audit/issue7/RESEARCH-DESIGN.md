# Research design for F1 to F5 — read-only proposal, nothing implemented

Issue #7 phase 2, second deliverable. 31 October 2026.

**No model mathematics is changed by this document.** It proposes experiments and names what each
would need. Every item is a proposal awaiting Director sign-off.

**The three 27 October misses are not a target.** They motivated the audit and they are excluded
from every fit, tuning grid and threshold below. Using them would be fitting to the sample that
raised the alarm, and the resulting numbers would mean nothing. They may be read once, at the very
end, as a narrative check on a design already fixed, and never as evidence that it works.

## What is being corrected, and what each finding actually is

| # | Finding | Character |
|---|---|---|
| F1 | `xcAttack` normalises to a team's own league, so no absolute inter-division anchor exists | structural absence |
| F2 | a cup's own `avgH`/`avgA` can absorb a seeding rule and become an away-strength term | confounded estimator |
| F3 | cup shrink at `K=32` compresses opponent-quality distinction | fitted trade-off, not a bug |
| F4 | the newcomer floor keys on appearance count, not tier | correct as designed, insufficient alone |
| F5 | a missing league source scores `y=1` where league-average maps to `1.0985` | asymmetric default |

F1 and F2 are one defect seen twice: the engine holds no division identity, and it infers home
advantage from a sample where venue is correlated with strength. F3, F4 and F5 are secondary and
should not be touched until F1 and F2 are settled, because each would otherwise be re-tuned against
a biased baseline.

## Step 0, before any modelling: measure the confound

Description only. No fitting, no new holdout consumed, no statistical capital spent.

For every competition in `XC_SHAPE.COMPS`, over the loaded corpus, compute:

1. `avgH` and `avgA` as `strengths2` computes them, and the ratio `avgA / avgH`.
2. The same two figures for the equivalent league competitions, as a control.
3. The share of ties in which the home side is from a lower tier than the away side, which needs
   the tier field from step 1 below.
4. The correlation between venue and the tier gap, per competition and per round where round is
   recoverable.

**Decision rule, pre-committed:** if `avgA / avgH` in the cups is within the range the control
leagues show, F2 is immaterial in practice and steps 2 and 3 drop to low priority. If it sits
outside that range, F2 is material and the per-competition venue term in step 2 is justified.

This step needs read access to the fixture corpus, which is governed by Issue #8. **It must not run
until provider-data rights are settled.** Until then, the magnitude of F2 on real data stays
unmeasured and the audit says so.

## Step 1: an explicit common cross-division strength scale

The structural fix for F1. A tier field, then a rating on one scale.

**Data.** Each competition gains a declared `tier` (1 for a top division, 2 for a second, and so
on) and a `country`. Cups get no tier of their own; a cup tie's two sides each carry the tier of
their own concurrent league. The field is declared by us, in configuration, from public competition
structure. It is not derived from provider data and it is not fitted.

**Estimator.** Fit one attack and one defence per club on the **pooled** corpus of every loaded
competition, with a per-competition scoring-level offset and a per-tier strength offset, rather
than fitting each competition in isolation as `strengths2` does today. Cup ties are the links that
identify the tier offsets, because they are the only fixtures where clubs from different tiers meet.

**Why this is the right shape.** `xcAttack`'s within-division ratio is invariant to division level
by construction, proven in `t2-division.mjs`. No weight applied to a division-blind quantity can
recover the level. The level has to enter as its own parameter, identified by cross-tier fixtures.

**Identification risk, stated up front.** Cup ties are few and non-random: the draw pairs tiers in a
structured way and the lower-tier side usually hosts. The tier offsets will be weakly identified and
correlated with the venue term from step 2. The two must be fitted **jointly**, never in sequence,
or the venue term will absorb the tier effect and vice versa. If the joint fit does not converge on
the available cross-tier sample, the honest outcome is a wide interval and an abstention rule, not
a point estimate.

**Falsifiable prediction, pre-registered before fitting:** on held-out cup ties, a model with tier
offsets should beat the current model on 1X2 log loss, and the improvement should be concentrated in
ties with a tier gap of two or more. If the gain is flat across tier gaps, the tier term is not
doing what it claims and should be rejected however good its pooled number looks.

## Step 2: separating cup seeding from genuine home advantage

The fix for F2. Today, venue enters only as `avgH : avgA` fitted per competition, so a competition
whose draw correlates venue with strength yields a venue term that is partly a strength term.

**Proposal.** Replace the per-competition pair with a venue term that is identified **within club**
rather than across the competition: estimate home advantage from the same clubs playing home and
away, pooled across competitions, with a per-competition deviation only where the data supports one.
A neutral-venue flag for finals and fixed-venue rounds, declared in configuration, not inferred.

**Control that makes this testable.** In a league, home and away assignment is balanced by the
fixture list, so the pooled within-club estimate and the current per-competition estimate should
agree. In a cup with a seeding rule they should diverge, and the size of the divergence is the size
of the confound. That comparison is the experiment, and it needs no new holdout because it is a
description of two estimators on the same data.

**Pre-registered prediction:** the two estimates agree within noise in leagues and diverge in cups,
with the divergence tracking the venue-tier correlation measured in step 0. If leagues also diverge,
the within-club estimator is mis-specified and the proposal fails.

## Step 3: opponent strength across divisions

F3 is a fitted trade-off: Build 318 chose cup shrink 32 and improved the cup home-win slope from
0.666 to 1.034. `t8-final.mjs` shows that choice also compresses the Giant-to-Minnow attack ratio
from 1.276 at league shrink to 1.034 at cup shrink, on one synthetic contrast.

**Do not re-tune the shrink in isolation.** It is currently absorbing the bias that steps 1 and 2
remove. Once a tier offset and an unconfounded venue term exist, a cup rating has more information
behind it and the correct shrink will be different. Re-fit it **after** steps 1 and 2, on a fresh
window, as part of the same pre-registration.

**Measurement to carry through:** opponent-strength discrimination should be reported as a named
metric, not inferred from a ratio in one synthetic case. Proposal: on held-out fixtures, the
correlation between a club's fitted attack and the mean fitted strength of the opposition it faced.
A well-specified model shows near zero; a model that rewards weak schedules shows positive.

## Step 4: missing league history

F5 and F4 together. Two concrete, cheap changes, each with its own test.

1. **The neutral default is wrong by construction.** `y = A + B·x` maps an exactly-average club
   (`x = 1`) to `1.0985`, while a club with no concurrent record is given `1`. Absence is therefore
   scored below average. The neutral value should be `A + B`, so that "no information" and "exactly
   average" coincide. One constant, and it removes a systematic penalty on the side with the thinner
   record, which in a cup is usually the lower-tier side.
2. **`MIN_SRC = 10` is a cliff.** A club with nine qualifying appearances contributes nothing and a
   club with ten contributes fully. Proposal: replace the threshold with a confidence weight that
   rises with appearances, so that evidence enters in proportion to how much of it there is. This
   is the same shape as `NEWCOMER`'s ramp and should reuse it rather than invent a second curve.

Neither change needs the three misses, and both are testable on a fresh window.

## Step 5: pre-registered out-of-sample calibration and abstention

**The Build 335 holdout is spent.** Its own note records that SAME and ONE sit on the edge of the
fitted grid and are lower bounds, and that the holdout cannot be re-used to widen it. Nothing below
touches it.

**Design.**

- **Filing first.** A pre-registration document, committed before any fit, naming the hypotheses,
  the estimator, the metrics, the decision rules, the data window and the stopping rule. The repo
  already works this way (`MatchMind-SHRINK-TYPE-PREREG.md`, `MatchMind-XCWEIGHT-PREREG.md`), and
  this proposal should follow the same convention rather than a new one.
- **Time-safe split.** Fit on fixtures before a declared cut date, evaluate only after it, with the
  cut chosen before looking at results. Walk-forward within the fit window, never a random split,
  because fixtures are ordered and a club's rating leaks across time.
- **No hindsight.** The corpus for each fixture must be the corpus as it stood before that kick-off.
  `t1-minsrc.mjs` shows `xcSource` already respects "strictly before date"; the evaluation harness
  must do the same.
- **Primary metrics.** 1X2 log loss and Brier, with calibration slope and intercept. Reported
  overall and split by: league versus cup, tier gap (0, 1, 2+), and home-side tier relative to the
  away side. The split by tier gap is the whole point and must be declared primary, not exploratory.
- **Secondary.** DNB wins, voids and losses as three separate counts, never a single rate.
- **Benchmarks declared in advance.** The current Build 355 model, and two trivial baselines: the
  competition's base rates, and home-or-draw. A change that does not beat Build 355 on the tier-gap
  buckets has failed whatever it does overall.
- **Abstention.** The confidence gate should be re-derived per stratum rather than globally, because
  a cup tie with a two-tier gap is a different estimation problem from a league fixture. Proposal:
  abstain when the posterior interval on the 1X2 split is wider than a declared threshold, which
  requires the model to carry an uncertainty it currently does not. That is a larger change and
  should be its own filing.
- **Sample size, honestly.** Cross-tier cup ties are rare. Before fitting anything, count the
  available held-out cross-tier fixtures and state the minimum detectable effect. If the count is
  too small to resolve a tier offset, the correct outcome is to publish the interval and keep
  abstaining on those ties, not to ship a point estimate.

## Recalculating the calibration baseline

The shipped `LEGAL_CLAIMED 77.0`, `LEGAL_LANDED 73.7`, `LEGAL_GAP 3.3` are a 17 October snapshot
over 1,654 graded picks, with `STILL NEEDED` still in the file. Any evaluation must recompute from
the immutable archive, split as above, before a single parameter moves. The shipped constants are
not a baseline and the Director's review already said so.

**This also depends on Issue #8.** The archive and the corpus are provider-origin data.

## Sequencing, and what gates what

| Order | Work | Blocked by |
|---|---|---|
| 0 | measure the cup venue-tier confound | Issue #8 data rights |
| 1 | declare tier and country configuration | nothing |
| 2 | joint fit: tier offsets and within-club venue term | step 0 outcome, a filing, a fresh window |
| 3 | neutral default `A+B`, and the `MIN_SRC` ramp | nothing; small and independently testable |
| 4 | re-fit cup shrink | steps 1 and 2 |
| 5 | per-stratum abstention and model uncertainty | its own filing |

Step 3 is the only item that could proceed now. Steps 0 and 2 are the substance and both wait on
data rights and a pre-registration.

## What this design deliberately does not propose

- No change to `K.CROSS`. Its own filing measured that arm at 0.20σ, a flat null. Changing it would
  look like addressing the tier gap while F1 remains.
- No re-use of the Build 335 holdout.
- No fitting against the three 27 October ties.
- No change to the 145 frozen forecasts, the published record, or any archived settlement. A model
  change applies to future forecasts only; the record stays as it was issued.
- No AI in the numbers. Issue #7 item 7 keeps engine-only, AI-only and combined as separate arms,
  and no AI output may enter a probability until its incremental value is measured on held-out data.
