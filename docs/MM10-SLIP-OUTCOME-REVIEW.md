# MM-10 slip outcome review

## Current checkpoint v14 - MM-10 local DNB repair accepted, 28 November 2026

MM-10 local presentation arithmetic and labels are accepted after primary math/code/phone-width assessment and separate independent review. Final HTML SHA-256:c1a33debed85fcdf357a37d9f7b71a2c877b606f0f6485e02d6427c53b230d6e; worker remains e1535f343745966a5a7adb818feba0a4216b8646a8c3cf5de097deda86104860. Primary24/24unit/issued-bundle/preview-provenance checks,6/6full-app slip browser checks at320/390px,12/12corrected legacy mobile checks and1/1exact-source PWA offline/update/rollback check passed. Counts describe separate runs, not a cumulative unique-test claim. Before failures and fixture corrections remain preserved.

For DNB leg conditional win share q and same-source draw probability D, the helper derives win q(1-D), void D and loss(1-q)(1-D). Under the visible independence assumption it computes full win, reduced return, all-void stake refund and any-loss probabilities in O(number of legs). The two-leg75%conditional/20%draw reproduction now shows36%full win,24%reduced return,4%stake back and36%loss, replacing the wrong56.3%headline/44%loss. The complete-data expected gross return remains14.848 per hypothetical10 stake, displayed14.85.

Public output has four short DNB outcome labels, Full-win odds/Max $10 return, a compact independence/conditional-percentage disclosure, and the optional Why panel's conditional no-loss payout range and gross return including losses. Missing or invalid outcome data never substitutes draw0 or invents aggregate probabilities/EV. Prices must be finite numbers above1; incomplete/invalid/overflowing prices suppress aggregate cash/range/EV and cannot print Infinity/NaN. Known all-win bookmaker quotes remain separately conditional when probabilities are unavailable. Identity/code/market/duplicate-fixture/20-leg guards are explicit. Pure tests include60deterministic exhaustive small-slip comparisons and endpoint/20-leg/missing/domain/price/overflow cases. Full-app tests use the actual board candidate and bookmaker-price paths, not a candidate stub, and preserve issued fixtures/board/archive bytes and a personal-storage sentinel.

Independent and primary exact-function checks confirm slipPool, slipCandidatesFromBoard, slipToTarget, rungsFor, gradePick, dailyLogGrade and retryPersonalStorage are unchanged. Selection, target search, risk eligibility, model, grading, publication, account deletion and personal storage were not repaired or reinterpreted here. The conservative bookmaker-contract payout range is retained when a model draw estimate is zero: a model estimate does not change settlement terms. This nonblocking review point and the reasoning are recorded in the primary review.

Test corrections: the first browser run after the repair used case-sensitive assertions against CSS-uppercased labels; assertions now follow the visible labels case-insensitively. A default-parameter fixture replaced explicit undefined with valid defaults; invalid probes now override finished fixture fields. The legacy mobile suite had two pre-MM09 Record-copy expectations and a hardcoded Build362; tests now check accepted short copy and the positive source-declared build. Runtime copy/build was not changed to satisfy those stale tests. New screenshot capture waits for the existing toast to disappear naturally; no UI warning is suppressed in product code.

All hosted/deployment, inherited typing, request-ID/outer diagnostic-sink, physical-phone, controlled legacy cleanup, session and capacity/billing/retention gates remain OPEN. Production/preview deployments are unchanged. No provider request, actual bet/payment, hosted mutation, data clearing or EDUVANTA access occurred. Necessary verified repair-branch Git actions remain authorized; release build assignment and production rollout are separate.

Next job: MM-11 Strong/Lean/informational/withheld parity across list, hero, market panel and narrative, including no-pick floor reason. Bounded read-only inspection/plan has begun after MM-10 local acceptance. Preserve the accepted v5 handling of a later withheld marker and original issued claim/vector. No MM-11 runtime repair is accepted yet; MM-12 has not started.

# MM-10 independent review and primary decisions

28 November 2026, Africa/Lagos. Root completed the candidate after the implementation agent's earlier usage limit. The agent subsequently performed a separate bounded read-only review on this resumed day; no further delegation loop occurred.

Reviewed app SHA-256: c1a33debed85fcdf357a37d9f7b71a2c877b606f0f6485e02d6427c53b230d6e. The independent reviewer found no high-priority math, provenance, missing-data or price-gate issue. Exact function comparisons against HEAD89d41fb confirm slipPool, slipCandidatesFromBoard, slipToTarget, rungsFor, gradePick, dailyLogGrade and retryPersonalStorage remain unchanged. Root also limits its byte diff to the helper, genSlip presentation and a no-price explanation.

The reviewer raised one nonblocking endpoint: model draw probability zero still leaves a DNB contract's possible stake-back minimum in the no-loss payout range. Root retains the conservative bookmaker-contract range. Model estimates do not change settlement terms or establish a draw is physically impossible. The four estimated probabilities and expected gross return are exact for the supplied model inputs; the displayed payout range is a contract bound, not a claim that each amount has positive modeled probability. No extra public explanation is needed.

Before failures are retained. The first browser run after implementation failed case-sensitive label assertions because CSS uppercases the existing label elements; the fixture assertions now match labels case-insensitively. A default-parameter fixture incorrectly substituted valid defaults for explicit undefined inputs; invalid/missing input probes now override the finished fixture fields directly. These corrections changed tests only.

An existing director-mobile suite had two pre-MM10 Record-copy assertions and a hardcoded Build362 assumption, while the accepted MM09 candidate uses the shorter Record temporarily unavailable and actual Build368. Root corrected the assertions to the accepted copy and the source-declared positive build; it did not change runtime copy/build to satisfy stale tests. Initial failures remain in primary-legacy-pwa.log. No deployment, provider request, actual bet/payment, account action or personal-data clearing occurred.

# MM-10 DNB slip inspection and proposed minimal repair

27 November 2026, Africa/Lagos. MM-09 local repair was accepted by primary before this next job started. This is READ-ONLY source inspection and an inert actual-function VM proof. No repository source/test/docs/Git changes, browser/provider/network calls, hosted operations, personal-data reads, model/grading change or issued-claim mutation occurred. Owning HTML SHA-256: `4ca653ae19d83726f4e4a9131d240281ac565615fcfd7597452bbad7f02d010a`.

Evidence: `readonly-dnb-proof.mjs` executes actual `slipPool()` / `genSlip()` with invented board legs and inert DOM/save callbacks; `readonly-dnb-proof.json` includes rendered text and exhaustive independent outcome enumeration. No actual bet, stake or payment is processed.

## Owning source and confirmed defects

- `rungsFor()` around5569–5580 explicitly prices DNB as the selected team's win share conditional on the result not being a draw. The displayed DNB percentage is therefore not its unconditional outright-win probability.
- `slipCandidatesFromBoard()` around19647–19690 carries the existing board code/probability and `pDraw:r.pd`; `slipPool()` around19726 keeps one selection per fixture and attaches only existing bookmaker prices. Preserve these issued inputs and selection/risk behavior.
- `genSlip()` around19825–19841 multiplies every `l.prob` into `comb`, including conditional DNB probabilities. Its headline “To land” and High/Balanced/Long-shot badge use that product. With DNB, this is neither the probability of full quoted payout nor the probability of surviving without losing.
- Around19885, `loseNote` says “Every leg must win” and uses `1-comb` as the chance of losing. A DNB draw is a void, so the slip can avoid losing without every leg winning. The complement is the wrong event.
- Around19849–19867 the existing DNB return range/expected-return factor already accounts for wins and voids **when complete draw probabilities and bookmaker prices exist**. The existing EV formula is not the bug demonstrated here. Its minimum-to-maximum range excludes the zero-return loss case but does not state its no-losing-leg condition clearly; the headline still quotes only the maximum return as “$10 returns.”
- The DNB range is gated by `market==='Draw No Bet' && pDraw!=null`. A DNB code with missing draw probability still gets a numeric headline/loss claim and a single quoted return, silently treating missing void information as if it did not matter. A valid conditional percentage alone cannot determine outright win/void/loss.
- The generator's public output/Why text does not disclose the between-match independence assumption. One selection per fixture prevents a direct within-match multiplication, but does not prove separate football matches are independent.

## Smallest actual-function before proofs

Two invented DNB legs each have conditional win share75%, draw probability20%, and different fixture IDs. Existing bookmaker prices are1.80 and1.60. Each leg's unconditional outcomes are win60%, void20%, lose20%.

| Event | Exact independent enumeration | Actual current headline |
| - | - | - |
| Every leg wins/full quoted payout | 36% | “To land56.3%” |
| Reduced return, at least one win and at least one void | 24% | No distinct probability |
| Every leg voids/stake refunded | 4% | No distinct probability |
| Any leg loses | 36% | “44% chance this loses” |
| Sum | 100% | — |

The exhaustive nine-outcome oracle gives $28.80 for two wins, $18/$16 for one win plus one void, $10 for all void, and $0 when either leg loses. Expected gross return for a hypothetical $10 is $14.848, matching the existing EV formula. This supports correcting interpretation/labels without changing the underlying model or repricing a claim.

One DNB75%/draw20% plus an ordinary win80% leg currently prints To land60% and loss40%; the independent categories are full48%, reduced16%, refund0%, loss36%. A DNB75% leg with unknown draw probability currently prints To land75% and loss25% with no draw-range note; its unconditional categories are actually unavailable.

## Proposed repair, awaiting primary assessment

1. Add one small pure **presentation arithmetic** helper for selected existing legs. Identify DNB by canonical code1D/2D, retain its existing conditional probability and same-source draw probability, and derive `W=q*(1-D)`, `V=D`, `L=(1-q)*(1-D)`. Ordinary binary win/loss legs have `W=p`, `V=0`, `L=1-p`. Reject missing/nonfinite/out-of-range/incoherent inputs and duplicate fixture identities instead of substituting a current model, missing draw0, new odds or another fixture. Do not alter board/Tips claims, risk eligibility or candidate ordering.
2. Under the stated independence assumption compute `full=product(W)`, `survive=product(W+V)`, `refund=product(V)`, `reduced=survive-full-refund`, `loss=1-survive`. Clamp only tiny floating-point residuals and verify the four mutually exclusive categories sum to1. This is O(number of legs), not3^20 enumeration in the app. Use exhaustive independent enumeration only as the small-fixture test oracle.
3. Present four concise outcomes for a DNB-containing slip: **Full win, Reduced return, Stake back, Lose**. The headline probability and any retained probability badge must identify their event consistently; use full-win probability rather than the conditional product. Keep the public copy short. Add one compact line such as “Model estimates; assumes independent matches.” Clarify that each DNB leg's unchanged percentage excludes draws.
4. Keep bookmaker-price fencing. With complete prices, call the product full-win odds and label the top hypothetical amount **Max $10 return**; describe any positive return range as conditional on no losing leg. The average is an estimated **gross return including losses**, not profit or a guaranteed payout. Without all bookmaker prices, show no total/range/expected-money figure. With missing DNB outcome data, show “Probability unavailable” rather than fabricated aggregate chances; known bookmaker maximum prices can remain separately factual if clearly conditional.
5. Keep ordinary no-DNB slips mathematically identical (`full=product(p)`, reduced/refund0, loss complement). Do not change settlement, grading, model calibration, publisher issuance, account flows, physical storage, provider calls or the target-selection algorithm. Only clarify a target's displayed product as full-win odds here; broader target/risk UX remains MM-20.

## Required regression and visual acceptance

- Before/after actual `genSlip()` assertions for the two-DNB and mixed fixtures above; all four displayed probabilities agree with the oracle and current issued input bytes stay unchanged.
- Exhaustive small examples with one/two/several DNB voids, mixed ordinary legs, all void, at least one loss, and either DNB side. Total probability1 and expected gross return match direct enumeration; no-DNB outputs preserve baseline arithmetic.
- Validate null/undefined/NaN/Infinity/out-of-range draw/conditional probabilities, no non-draw outcomes, duplicate fixture IDs, empty input and the20-leg bound. No silent fallback or manufacture of new vector/price evidence.
- Missing/partial bookmaker prices retain the existing no-money gate. The current complete-data EV remains equivalent. Code/market labels cannot silently switch a DNB into an ordinary win event.
- Root independent actual-UI checks at320/390px, including Why disclosure and missing-data state, with short accessible copy and no overflow. Existing issued-claim, per-fixture slip-pool and publisher isolation tests remain intact. Search found current UI/filter smoke coverage in `test/director-mobile-display.test.mjs` around147, but no dedicated DNB slip outcome enumeration suite.

After primary accepts MM-10 local repair, MM-11 follows. Earlier hosted/release/physical gates remain open; this plan is not deployment authorization.
