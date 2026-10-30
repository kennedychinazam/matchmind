# Blinded semantic review rubric v0.1 — design only

Review only whether an interpretation is supported **at issuance**, not whether it eventually won. Reviewers receive anonymous case ID, exact feature definition, proposed category, cited source facts/metric units/windows/denominators, source availability/missingness, relevant counterevidence and the candidate's limitations. Exclude target results, post-cutoff facts, bookmaker prices/implied probabilities, original engine forecasts, author/model identity, provider brand and any chosen bet. Pseudonyms must preserve team/venue orientation and dependency without enabling casual outcome lookup. Do not search the match or use memory of its outcome.

For each criterion record `pass`, `fail`, `uncertain` or `not_applicable`, with source-reference IDs and concise reasons:

1. `evidence_support`: Do the cited facts entail the stated observation? Existence of a citation alone is insufficient.
2. `direction`: Does the conclusion point the right way under the feature's approved definition? Arithmetic sign is necessary where relevant, not a learned football effect size.
3. `counterevidence`: Were important contrary facts, sample effects, opposition/venue differences and alternative explanations considered?
4. `missingness`: Are unavailable/null/unknown facts honest? Neutral cannot replace unknown.
5. `feature_semantics`: Does the assessment follow the exact approved meaning, appropriate comparison/window and team orientation?
6. `no_invention`: Were tactics, player roles/importance, injury/rotation, rest, psychology or numerical claims invented?
7. `no_overstatement`: Does wording exceed what this evidence establishes? No proof of sustainability, calibration, causality or predictive effect follows from a persuasive narrative or a small sample.

Use the approved v0.2.0 feature dictionary; do not reinterpret level signs. Null is an appropriate, often preferable assessment. A well-qualified interpretation can be source-supported without any demonstrated usefulness for prediction. Any accepted review remains distinct from training admission/calibration.

## Procedure and independence

Freeze packet/response/prompt/schema/feature-dictionary hashes and claim-level review scope before assignment. The coordinator retains the author/model mapping separately; the reviewer sees only a blinded source-grounded case. Use two independently assigned reviewers, neither the author nor participants in that model's generation. Reviewers write votes without seeing each other's answers. Verify reviewer identity, independence, conflict disclosures, qualification and evidence access outside the model; an AI or a JSON `reviewer_kind=human` cannot authenticate a reviewer or approve its own reasoning.

At least one qualified human football/data reviewer and a separate source/statistical check are proposed for any real use. AI checks may assist arithmetic or flag questions but do not become their own semantic approval. Human staffing, training and identity authority are **not implemented or verified here**.

A missing vote, unsupported claim, uncertainty or any material disagreement blocks feature admission and goes to a third independently assigned senior reviewer. Preserve all original votes/reasons and the minority view. The third reviewer may request evidence, reject, or sustain uncertainty; no automatic majority vote, favorable-model selection, cherry-picked response or automatic retry. A changed evidence/response/version creates a new review revision and keeps the earlier artifact. Never repair a pre-match interpretation with later information.

Unanimous support is only an annotation candidate. It cannot admit a feature into rate models until source authority, reviewer authenticity, empirical extraction reliability, training support and frozen numerical mapping are separately approved. No actionable forecast or value pick follows from review agreement.

## Validation and reliability

Start with synthetic source-grounded cases and independently adjudicated edge cases, then a preregistered blinded sample of genuine admissible packets when authorized. Measure per-criterion agreement, disagreement/escalation, unsupported-statement rate, missingness/sign errors, adjudication reversals and model/competition strata. Report raw confusion tables and base rates; chance-corrected agreement needs appropriate confidence intervals and prevalence caveats. Cluster uncertainty by match/related evidence, not individual correlated claims. Include abstained/rejected cases; do not measure only persuasive successful responses. Sample size and tolerances need pilot variance/prevalence and a justified development plan, not invented defaults.

The included cases are fictional and adjudicated in separate assistant contexts, not by human football experts or distinct MatchMind provider calls. Their errors may remain correlated. They illustrate the procedure; they do not establish inter-rater reliability, genuine semantic accuracy or predictive contribution.
