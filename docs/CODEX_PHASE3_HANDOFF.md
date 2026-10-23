# Codex Cloud handoff — MatchMind Phase 3: Immutable As-of Features (FIRST IMPLEMENTATION TASK)

**Coding agent:** **OpenAI Codex Cloud only.**
**Repo:** https://github.com/kennedychinazam/matchmind
**Development branch:** `feature/matchmind-quality-upgrade`
**Protected recovery branch:** `backup/build355-20261023` at `036f09b29f27a10c7d8bdcec1f16efd557c714e4`
**Production branch:** `main`, must remain untouched.
**Supabase production reference:** `toqfdrcjzwnlydqekude` (read-only for this task).
**Paid AI:** intentionally paused. NEVER call a paid AI API, edit billing, or enable shadow AI.

## Context you must read before proposing changes

1. `index.html` — especially `footballEngine.strengths2`, `fxPredict`, `matchFeatures`, `m14Rows`, `m14Split`, `m14Fit`, `autoGate`, `gradePick`, `pickVerdict`, `m14RunHoldout` and all comments describing earlier failed model experiments.
2. `robot/publish.mjs` and `.github/workflows/publish-picks.yml`. Only the signed-in publisher is allowed to write prediction records; the robot must NEVER run a normal production publish from a development branch.
3. `docs/MATCHMIND_BUILD355_RECOVERY_BASELINE.md`; `audits/README.md`, `PHASE2_FINDINGS.md`, `PHASE3_FINDINGS.md`; audit scripts 001–010 and all Node tests.
4. The existing Supabase production schema and RLS policies (inspection only). Five Edge Functions are deployed separately and are NOT checked into public GitHub. No secrets should appear in commits.

## Assignment

Prepare and implement an **isolated, append-only, time-safe feature and prediction snapshot subsystem**, sufficient to later evaluate candidate statistical models without using information that arrived after a prediction was issued.

This first Codex task is NOT to replace the prediction engine or to improve visible confidence numbers. It is to build an auditable foundation that preserves the original prediction and evidence state so improvements can be tested legitimately.

### Step A — Inspect and design (complete before modifying backend)

- Identify the existing single source of predictions, the original prediction issuance timestamp, fixture version and source fields, the current odds snapshot scheme, and how collector backfills overwrite `fixtures.updated_at`.
- Document data model and write/read boundaries, RLS/role principles, join keys, required indexes, schema/data cost, retention policy and rollback strategies.
- Determine whether staging Supabase is available. If not, propose a no-cost local test DB or an isolated staging plan. **Never create paid resources or use production migrations without a fresh user approval and tested backup.**
- Produce a precise field-provenance contract (e.g., `fixture_id`, `prediction_build`, `model_version`, `issue_time_utc`, `source_kind`, `observed_at_utc`, `effective_at_utc`, `feature_schema_version`, `payload_hash`) and a low-cost, append-only storage strategy. Optional sparse provider fields remain null, not made-up zero.
- In the existing app, `?blobs=1` enables full research data at significant egress cost. Do not make it the default or grow normal user boot payloads.
- Explain how to avoid a snapshot created long after issuance being mislabeled as historical.

### Step B — Implement in development/staging only

- Create an isolated schema migration and reversible/forward repair plan, tested on an isolated environment.
- Implement a small snapshot writer suitable for the existing publisher/collector flow, with no service-role token in browser JavaScript or logs and no accidental public insert/update privileges.
- Preserve **pre-issue** odds data at time of prediction; pre-issue snapshot must never choose a post-issue bookmaker value.
- Design immutable evidence for historical prior-match stats (xG, shots, starting XI, injuries if available), with per-field first-observed time or an explicit `unknown` state. Treat mutable historical fixture rows as unverified, not as a time machine.
- Store original Build 355 baseline probabilities, issued market pick, run/build identifiers, 90-minute settlement policy version and source hashes without rewriting published `predictions`.
- Keep all candidate model forecasts separate from the original archive, explicitly `shadow` and not shown to public users.
- Add tests that reject future data, duplicate snapshot identifiers, malformed probability distributions, unexpected growth/missing fields, incorrect timezone offsets, and backend permission errors.
- Protect the existing 48h-late terminal-void behavior; do not silently change the historical grading rule.

### Step C — Validate and report

- Existing `node --test audits/test/*.test.mjs` must pass.
- Add a synthetic set of fixtures where a past match's xG/lineup is ingested *after* a future prediction is issued: candidate feature builder must refuse that information, even if the latest `fixtures` row contains it.
- Add an integration test with a fixture rescheduled across the 48h rule; note that today's derived void can be non-monotonic without a persisted terminal state. A design proposal may be included; **do not change production grading in this task**.
- Test candidate shadow output equality to baseline when feature data is missing or feature adjustment is disabled. Do not create duplicate public prediction paths.
- Test upper bounds for cold-boot data volume, collector HTTP quotas and publisher runtime before shipping.
- Supply a pull request, its diff, tests run and exact staging instructions. The PR must not modify live `main`, deploy production functions, change production database, or activate paid AI.
- If the required repository, Supabase or test credentials are unavailable, **stop and report precisely which capability is missing**. Never invent credentials or silently change the objective.

## Scientific acceptance gate

1. A past prediction can be replayed using *only* evidence with `observed_at <= issued_at`.
2. Original published probabilities and issuance times are immutable.
3. Alternative predictions are labelled and isolated.
4. No real production writes or paid provider calls in test runs.
5. All data sources, field provenance, missingness and cost impacts are documented.
6. Existing UI, Smart Bet, owner features, authentication, website deployment and publisher behavior remain unchanged.

### Existing measured findings (must not be re-tuned on the same dataset)

- Pre-kickoff historical 1X2: 1,912, summed Brier 0.60772.
- 816 matched pre-issue bookmaker snapshots: MatchMind summed Brier 0.61771 vs bookmaker 0.59053.
- 2022 provider xG coverage 5.76%, 2023 24.53%, 2024 27.73%, 2025 39.51%, 2026 33.20%.
- Among 1,997 past issued picks, today's DB gives >=3 historical xG matches for both teams in 907; using last-update-before-issue restriction leaves only 407.
- Prior 300-match recency experiment was inconclusive and left disabled; M14 holdout history is device-local and must not be silently reused as a fresh untouched test.
- 34 independent audit regression tests were already passing in GitHub CI before this handoff.

**IMPORTANT:** Respond with the inspection, architecture and staged implementation plan before any potentially consequential database or Edge Function write. Your work must use Codex exclusively.
