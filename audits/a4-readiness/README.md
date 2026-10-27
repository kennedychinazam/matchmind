# Stage 3C source and semantic readiness — research only

The Director accepted Stage3A/3B at `c7c3a3af6e4a30847e31863a6126456382b7e6cc`. This stage makes the explicitly authorized field-aware text-filter correction and supplies an isolated synthetic semantic-review routing demonstrator. Full real-source coverage, provenance/capacity research and dated financial-feasibility findings are in the private downloadable Stage3C review package; private source/journal/financial records are not in this checkout.

## Field-aware correction

`audits/a4/text-policy.mjs` introduces implementation policy `a4-text-policy-v0.2.1`. This is not a new analyst prompt/schema. Active prompt v0.2.0, approved baseline v0.1.0, field dictionary, schemas and artifact-manifest hashes are unchanged.

The old implementation applied one banned-word regex to all text, incorrectly rejecting source-bound labels such as **Odds BK**, **Roi Et United** and **Engineers FC**. The corrected call sites distinguish:

- **Identity labels:** exact home/away/competition/country/venue labels from the schema-validated source capability. A word also used in betting/model vocabulary does not alone invalidate a name. Instructions, embedded structures, explicit forecast/price facts, controls and concealed payloads still reject. The capability may be synthetic or exploratory; the label never becomes genuine real-world authority by passing a text check.
- **Identifiers/source references:** bounded opaque ASCII reference syntax, not commentary or a dereferenced URL. Known odds/engine/model collection namespaces and encoded/instruction/data payloads remain rejected, including hyphenated namespaces. Football references such as `football:odds-bk:123` and opaque hashes remain identifiable as references. Exact source equality, field allowlists and source capability checks remain mandatory.
- **Statistical observations:** fixed field/type/unit/scope and numerical checks remain authoritative. Numeric values are not classified by a vocabulary regex. Unknown/extra/aliased fields and nested structures remain rejected by the closed source contract.
- **Untrusted commentary:** the conservative forbidden-content rules remain. Exact admitted identity labels may be mentioned as names after global instruction/data/encoding checks; the exception never exempts adjacent prices, predictions or instructions. The response's existing prohibition on unverified numerical prose remains unchanged. Numeric team names can be represented in fixture identity; their numerical digits in free prose remain subject to the existing v0.2.0 rule.

Percent/HTML/backslash encodings, compatibility-form ambiguity, invisible control characters and decoded instruction/data payloads reject. Base64 inspection is bounded; if a payload is still encoded beyond the inspected depth, it is quarantined rather than silently accepted. No input string is rewritten in the evidence artifact. Negative text checks are not a universal semantic/steganography detector, nor a substitute for verified source identity, field lineage and independent review. Ambiguous encodings and unapproved reference formats fail closed rather than being guessed.

Tests reproduce the legitimate-name bug before implementation and verify model-independent packet/response handling, malicious labels, source-reference namespaces, nested/aliased fields, encoded attempts, fake authority and adjacent prohibited facts. Independent code review exposed phrased-data and hyphen-boundary regressions plus an encoding-depth limitation; each received failing-first tests and fixes.

## Semantic review design and prototype

`SEMANTIC-REVIEW-RUBRIC.md` defines blinded source/claim review, seven criteria, independence, counterevidence/missingness, disagreement/escalation and empirical reliability limits. `semantic-cases.synthetic.json` has eight fictional cases with no real match outcomes, prices, engine forecasts or model identity. Two separate assistant contexts adjudicated the same cases without seeing each other's ratings. Their original and normalized records are in `adjudications/`; none is a human expert gold label or a real OpenAI/Gemini experiment.

`semantic-review.mjs` accepts only closed **synthetic** case/assignment/vote shapes. It rejects self-assignment, duplicate/unassigned reviewers, invented citations, unexpected outcome/odds/model fields and inconsistent supported votes. Any missing vote, criterion disagreement or uncertainty routes to escalation; no favorable majority or model cherry-picking. Agreement creates only a synthetic annotation route. Reviewer identity is explicitly unverified, authenticated real review remains required, and **feature_admission/actionable/trained_mapping_enabled are always false**. A JSON reviewer label cannot authenticate a human or promote a model's own reasoning.

All eight overall classifications agreed in this tiny fictional exercise, but only 53/56 criterion comparisons agreed. Criterion disagreement/uncertainty still escalates. This is a procedure demonstration, not measured real-football accuracy, reviewer reliability or a trained labeling protocol. Preserve minority reasons and source/version hashes, and use genuinely independent qualified reviewers before any later feature admission.

## Remaining gates and stop

Readiness is separate from acceptance of the corrected software. Existing historical field presence is not original first-receipt proof; genuine prior A3 enrollment must be preserved as genuine, but it does not automatically configure new A4 authority. Real regulation-time labels, complete advanced windows, source semantics, genuine new cutoff receipts, reviewer authenticity and provider/token/schema contracts remain separate gates.

Current complete-packet capacity is not established by the synthetic bytes or a nominal million-token context. Exact-model tokenizer availability, schema subsets, reasoning, cache/long-context pricing and actual complete historical scope require evidence. Lossless columns/dictionary transformations must preserve every required observation/null/type/receipt/reference and need explicitly versioned adapters; do not shorten history to pass admission. No such adapter is installed here.

Funding uses the existing shared lifetime ledger, including every retained liability. Actual spend already represented by retained holds must not be counted twice. Public headline pricing or source credits cannot override that ledger, and dated cost scenarios are not worst-case reservations or financial authorization. No study sample size, coefficient, rate multiplier or value threshold is installed.

No real inference, new reservation, trained coefficient, goal-rate adjustment, value recommendation, provider/source integration, hosted write, production/Build356 change, merge or deployment is permitted. Original Sunday/BYOK/provider restrictions and all accepted research remain intact. Keep PR6 draft and stop for Director review.
