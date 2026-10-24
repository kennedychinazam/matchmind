# MatchMind PRO — Independent Review Dossier and Change Ledger
**Created:** 2026-10-24 (Africa/Lagos)  
**Purpose:** durable, source-linked handoff to Claude for an independent technical, statistical, security, reproducibility, and release-readiness review.  
**Scope:** work known through Phase 4 commit `e5580b3`, plus the **assigned but not yet completed** Phase 5.  
**Maintenance rule:** append new milestones and corrections as they occur; do not rewrite history or convert proposals into completed results.  
**Documentation branch:** `docs/claude-review-ledger-20261024` (documentation only; deliberately separate from Codex's engineering branches).

> **Important:** This is an evidence index and factual working log, not a substitute for independently reading code, reproducing SQL, or performing security tests. Label all facts by source: **G** = independently confirmed from GitHub source/branch/CI metadata; **C** = reported by Codex and documented in committed reports/tests; **A** = analysis from historical read-only audit results; **P** = proposal/not implemented. Never infer production release approval from a green development CI job.

## 1. Project identity, intent, permissions
- Public app: https://kennedychinazam.github.io/matchmind/
- Public GitHub source: https://github.com/kennedychinazam/matchmind
- Current production application baseline: Build 355, `036f09b29f27a10c7d8bdcec1f16efd557c714e4`. This commit is both `main` and `backup/build355-20261023` at the last independent check on 2026-10-24. **G**
- Audit development base: `feature/matchmind-quality-upgrade` at `68c00ded8043b7ee1a15937db1a32c01d932f4e7`. **G**
- Phase 3/4 working head: `codex/phase3-immutable-snapshots` at `e5580b36876b11640bcae5958b971604b3f17876`. **G**
- Draft PR #1: https://github.com/kennedychinazam/matchmind/pull/1 ; head `codex/phase3-immutable-snapshots`, base `feature/matchmind-quality-upgrade`, unmerged at last check. **G**
- Production Supabase reference: `toqfdrcjzwnlydqekude`. Its two Free-plan hosted project slots are in use (per owner). No hosted project was created or paused. No production migration, deployment, paid AI activation or merge was authorized. **C / owner instruction**
- **Agent policy:** OpenAI Codex Cloud is the **only agent authorized for substantial coding/implementation**. ChatGPT conducts read-only GitHub/Supabase analysis, creates independent documentation/review and supplies specifications. Claude is planned as an **independent reviewer after development**, not as an alternative coding agent during the build.
- Do not run `robot/publish.mjs` or its dry-run mode against production from a development checkout; the robot contains production defaults. Do not expose Supabase service-role keys or private Edge Function sources in the public repository.
- Five deployed private Edge Functions, inventory at Build 355: `ai-analyze` v17, `ai-shadow` v2, `refresh-af` v54, `send-push` v9, `delete-account` v2. Private sources and production database **have not been recoverably backed up/restored** as part of Phases 1–4. Their current deployed versions should be reverified before future deployment.
- All model/AI spending remains at zero; owner is willing to pay **only when a controlled AI shadow pilot is justified by evidence**. No provider calls, billing changes or credentials should be assumed.

## 2. Timeline of decisions and measurable results

### 2026-10-23 — Recovery / initial audits (Phases 1–2) [G/A]
1. Preserved Build 355 in `backup/build355-20261023`; created `feature/matchmind-quality-upgrade`. **Code/Git backup only**, not Supabase DB/Edge Function backup.
2. Wrote `docs/MATCHMIND_BUILD355_RECOVERY_BASELINE.md` and ten SQL audit scripts `audits/001_*.sql` through `audits/010_*.sql`, audit findings, 34 pure Node regression tests, development-only audit workflow. 
3. Data quality: sample of 1,554 finished fixtures in trailing 30 days had xG on 600 (38.61%), shots on 809 (52.06%), lineups on 779 (50.13%), opening odds on 1,442 (92.79%), closing odds on 1,341 (86.29%), structured injuries on 0; source data incomplete.
4. Independent historical eligible pre-issue 1X2 model cohort: **n=1,912**; top-outcome accuracy **51.05%**, summed multiclass Brier **0.60772**, log loss **1.01555**. Equal 1/3 probability baseline Brier **0.66667**, log loss **1.09861**.
5. Strict paired pre-issue bookmaker sample **n=816**: MatchMind Brier **0.61771**, log loss **1.02894**, top-1 **50.49%**; fair/de-vigged aggregate bookmaker Brier **0.59053**, log loss **0.98933**, top-1 **51.84%**. Lower scores are better. Market prices are aggregated, not necessarily executable prices from one bookmaker; sample selection is nonrandom and covers ~42.7% of the 1,912. Bookmaker snapshots must precede issuance, be <=24h old, have positive lead and valid 1X2.
6. Disagreement: 132/816 (16.18%) most likely outcomes differed; MatchMind correct 28.79% vs market 37.12% on these. By league, 44 leagues represented; only 19 had n>=20, and 4 of those had lower model Brier point estimates; **insufficient for subgroup promotion**.
7. Exploratory blend with calendar split: greater market weight improved historical Brier, with market-only best among tested weights. October data were already examined and **are not a clean holdout**. No blend approved for production.
8. Published shared-record snapshot at Build 354 was stale relative to later fixture edits: earlier graded 1,874 vs regrade 1,912; 455 fixtures updated after snapshot. State-machine risk: nominal 48h terminal void could be non-monotonic when recomputed from mutable fixture data. **Potential specification risk, not verified production bug**.

### 2026-10-23 — Source/feature feasibility (Phase 3 research) [A/G]
1. Existing `footballEngine.strengths2` already implements opponent-adjusted strength/shrinkage/home effects/recency; `fxPredict` applies selective `xcAdjust`; Dixon–Coles correction active with `RHO=-0.08`. **Do not describe these as newly introduced.**
2. `TUNE.HALF_LIFE=10000` (weak recency); earlier 300-match decay candidate had marginal historical gains but failed its acceptance bound, left disabled. M14 `matchFeatures` / `m14Rows` / `m14Split` / `m14Fit` exist, but M14 not wired to public issuance. Device-local holdout history cannot prove globally untouched data.
3. In 1,997 historical predictions: both teams >=5 earlier scored league matches in 1,438; both teams >=3 historical xG matches according to today's mutable DB in 907, but only 407 under conservative last-update-before-issue constraint. **Today's fixture contents cannot prove historical feature availability.**
4. Older finished-fixture xG coverage: 2022 5.76%, 2023 24.53%, 2024 27.73%, 2025 39.51%, 2026 partial 33.20%. Missing xG/lineups not zeros. No retrospective time-travel.
5. Added `docs/CODEX_PHASE3_HANDOFF.md`, `audits/PHASE2_FINDINGS.md`, `audits/PHASE3_FINDINGS.md` to constrain immutable snapshot engineering. Original tests 34/34.
6. Codex Cloud initial clone failed via proxy port 8080; owner configured/published the selected `kennedychinazam/matchmind` environment, checked out correct development branch and confirmed 34/34 tests; no production action.

### 2026-10-23/24 — Codex Phase 3 immutable research infrastructure [C/G]
1. Codex created `codex/phase3-immutable-snapshots` from development base. Plan: `docs/superpowers/plans/2026-10-23-phase3-immutable-asof-snapshots.md`.
2. First implementation `33ee671`: private `research` schema, immutable observations, frozen prediction envelopes, evidence links, private shadow outputs, Node/provenance contracts, local PostgreSQL 17 Docker tests, publisher/collector synthetic harness, backup/rollback runbook; 88/88 passing in Node 20/24 CI. Existing `index.html`, robot and production publishing workflow unchanged.
3. Safety boundaries: immutable originally published `p_home/p_draw/p_away`, pick, `made_at`, original kickoff and build; snapshots store server `received_at` separately from client `made_at`; newly collected feature evidence uses authoritative receipt times, never post-issue data or unverified retrospective source timestamps. Missing baseline inputs/config manifest makes **exact original-input replay incomplete**, although original saved-output reproduction remains possible.
4. Independent review identified competition-wide evidence selector could exceed 500 links and research failure warnings might not be durable. Codex fixed as of `88f3e08`: versioned M14 dependency selection, 500-reference immutable chunks, shared manifests capped at 100,000 references, legacy/manifest read compatibility, private `capture_health`, backlog/reconciliation and operator repair. 75,876 synthetic observations tested and 99/99 regressions passed Node 20/24. Source publication remains successful when optional research capture fails; source-to-snapshot backlog can discover missing records. No guarantees during total database outage, and long-term storage cost remains open.
5. Research helper `audits/lib/shadow-forecast.mjs` is private audit code; **not** public prediction path or evidence of improved prediction accuracy.
6. **Critical production gate:** private collector function source, hosted Supabase Auth/PostgREST permissions, RLS/JWT/Edge Runtime, real publisher transport, representative <=5% publisher overhead, database + five functions private backup/restore still unverified.

### 2026-10-24 — Phase 4 isolated testing, performance and storage [C/G]
1. Owner has both Supabase Free-plan project slots occupied; no third hosted project allowed. Codex installed Supabase CLI 2.122.0, but Docker-vfs image extraction consumed constrained 32 GB workspace disk. Official GHCR registry mirror was reachable but full and reduced stacks were stopped/cleaned; about 25 GiB free restored. **Auth/JWT/PostgREST/Edge Runtime tests did not run**. Do not retry unchanged large images in that environment. Local network-disabled pinned PostgreSQL 17 remains operational.
2. `bb37440` prepared no-network/loopback synthetic tests; 101/101 Node 20/24. 
3. Through `d4cb337`, profiling of 76,497 synthetic observations identified a global `research.control` admission-budget row lock held throughout expensive evidence/manifest processing. Ten-worker lock wait dominated. Draft asynchronous immutable receipt/outbox proposal is **not implemented**; its unavoidable durability-vs-publication-availability tradeoff remains unresolved.
4. One narrow-selector candidate retains only `fixture_id,field_name,value,observation_id` instead of `o.*` in materialized intermediate `latest`. One early mixed-workload burst showed median regression ~8%; Codex did not promote then.
5. Fixed final AB/BA/AB/BA paired comparison with repeated/diverse teams, fresh/reused manifest, worker concurrency 1/2/5/10, 76,497 synthetic observations: **576/576 captures** and evidence checks pass; 20 distinct M14 feature vectors equal full historical reference; **16/16 workload cells** improved server median and p95 under preregistered gate. Pooled median **782 -> 644.5 ms** (-17.6%); p95 **2,016 -> 1,766 ms** (-12.4%); maximum 2,602 -> 2,401 ms. A small repeatable SQL projection improvement, **not improved football prediction accuracy** and **not** validated hosted speed/SLA.
6. Narrow selector implemented `0b54f7c` and report committed `e5580b36876b11640bcae5958b971604b3f17876`. `audits/staging/narrow-selector-upgrade.sql` and rollback are local/staging artifacts; no hosted migration. **107/107 tests** on Node 20 and Node 24 as reported, latest remote PR CI green at https://github.com/kennedychinazam/matchmind/actions/runs/40064291519 (Node 20 decoded logs explicitly confirm 107/107). PR #1 remains draft, unmerged.
7. Storage: synthetic seeded archive 70.02 MiB. Thirty repeated-pair captures total 80.21 MiB vs thirty diverse captures total 154.38 MiB; extra marginal evidence/manifests ~156 KiB per repeat prediction vs 2.72 MiB per diverse prediction after early captures. Odds new receipt/IDs can prevent effective deduplication even if odds prices don't change.
8. Capacity projections including seeded archive + assumptions + 25% reserve (MiB at 30/90/180 days):
   - Small shadow pilot (2 predictions/day; 15min polls/6h): **116 / 178 / 281**.
   - Focused (10/day; 5min polls/6h): **742 / 2,326 / 5,396**.
   - Broad (30/day; 1min polls/12h): **5,418 / 20,355 / 53,451**.
   - Current research admission budget is unchanged **250 MiB**; focused scenario passes 250 MiB planning need around day 8, broad around day 2, small pilot around day 154. **These are synthetic requirement projections, not charges or authorized capacity increases; actual rejection can occur sooner.** They exclude WAL, backups, Auth tables, AI payloads and some provider usage costs. No automatic increase, purge or truncation.
9. **Decision:** Phase 4 infrastructure tuning closed; no installed production changes. Relevant reproducible artifacts: `docs/PHASE4_FINAL_REPORT.md`, `docs/PHASE4_CAPTURE_PERFORMANCE_REVIEW.md`, `audits/phase4/results/2026-10-24-final-evaluation.json`, `2026-10-24-storage-forecast.json`, `2026-10-24-storage-polling.json`, `audits/phase4/README.md`.

### 2026-10-24 — Phase 5 statistical research assignment [P / user confirmed submission]
User gave the following objective to **Codex Cloud**: create isolated `codex/phase5-statistical-validation` from `feature/matchmind-quality-upgrade` (not PR #1); audit prior 001–010 SQL, reproduce eligible n=1,912 / strict n=816 baselines if possible using read-only sources; investigate home/draw/away calibration, proper-scoring losses, market disagreement, odds coverage/selection, weak subgroups; test **conservative** recalibration, pre-issue market informed comparisons, as-of data-quality shrinkage and existing M14 feature research only with valid time provenance; use chronological splits, distinguish exploratory from genuinely untouched samples, preregister future evaluation and leave all public predictions unchanged; prepare research report and independent draft PR. 
**At creation of this document the Phase 5 branch/PR was NOT YET VISIBLE in GitHub. Do not infer it exists, its tests pass or that a candidate beats market.** Future update must record actual branch/commit/PR, cohort freeze, dataset fingerprints, result reproducibility and no leakage.

## 3. Source-of-truth audit artifacts (review these directly)
- Recovery baseline: `docs/MATCHMIND_BUILD355_RECOVERY_BASELINE.md` on `feature/matchmind-quality-upgrade`.
- Read-only metrics: `audits/001_data_quality.sql`, `002_ledger_reconciliation.sql`, `003_probability_calibration.sql`, `004_preissue_market_benchmark.sql`, `005_time_split_blend_experiment.sql`, `006_market_disagreement_diagnostics.sql`, `007_shared_record_freshness.sql`, `008_league_market_diagnostics.sql`, `009_asof_feature_feasibility.sql`, `010_historical_feature_coverage.sql`.
- Phase 2/3 interpretation: `audits/PHASE2_FINDINGS.md` and `audits/PHASE3_FINDINGS.md`.
- Phase 3 design/implementation: `docs/CODEX_PHASE3_HANDOFF.md`, approved phase3 plan; `docs/PHASE3_IMPLEMENTATION_REPORT.md`; `docs/PHASE3_STAGING_RUNBOOK.md`.
- SQL: `audits/staging/snapshot-schema.sql`, `evidence-manifests.sql`, `capture-monitoring.sql`, `capture-hooks.sql`, `permissions.sql`, `rollback.sql`, `narrow-selector-upgrade.sql`, `narrow-selector-rollback.sql`.
- Runtime and tests: `audits/lib/snapshot-contract.mjs`, `asof-features.mjs`, `shadow-forecast.mjs`, `research-contract.mjs`, `audits/test/*.test.mjs`; `.github/workflows/audit-regression.yml` on Codex branch.
- Phase 4 report: `docs/PHASE4_FINAL_REPORT.md`, `docs/PHASE4_LOCAL_PREPARATION_REPORT.md`, `docs/PHASE4_CAPTURE_PERFORMANCE_REVIEW.md`; reproducible scripts and JSON under `audits/phase4/`.
- PR and CI evidence: https://github.com/kennedychinazam/matchmind/pull/1 ; https://github.com/kennedychinazam/matchmind/actions/runs/40064291519 .
- **Trust note:** A documentation index does not prove claims of no production writes; verify branch diffs, hosted schema drift/change history, Edge deployment history, CI logs, and access logs independently where available.

## 4. Scientific / leakage controls for the independent reviewer
- Do not conflate graded marketed tip or Double Chance hit-rate with top-1 1X2 accuracy, Brier score, log loss, or positive expected returns. No profitability has been demonstrated.
- Never treat aggregate bookmaker odds as an executable bet or late/closing prices as preissue inputs.
- For paired assessment, compare frozen baseline/market/candidate on **identical fixture IDs**, outcome rules and eligible issuance times. De-vig market correctly; separate missing odds cohort.
- Keep model selection, calibration, and candidate freezing distinct from a future **prospective** untouched evaluation. Historical October 2026 and earlier device-local M14 holdouts are not untouched simply because labelled as tests.
- Pre-label issue >= `2026-11-01T00:00:00Z` as prospective only; a label alone does not guarantee blindness or contemporaneous evidence.
- No xG, lineup, injury, odds or fixture field may be accepted as-of issuance without trustworthy per-version receipt/availability evidence. `updated_at` on mutable fixtures is insufficient; later immutable records cannot certify earlier source availability. Microseconds/time offsets and observation correction sequences matter.
- Model statistical assumptions: require paired Brier/log loss uncertainty, cluster-aware team/league/time handling, temporal folds, meaningful coverage/abstention, selection biases, candidate freeze and market-only baseline. Small or previously inspected subgroups are exploratory.
- Assess whether optional research capture fails open for original publication, and consequences: missed immutable receipt cannot be truthfully reconstructed; `research.capture_backlog` may flag missing lineage but does not prove old evidence. 48h void is a potential non-monotonic derived-state issue.
- Distinguish actual pre-publication feature data, M14 feature parity on **synthetic data**, and historic original baseline input replay (still incomplete).
- Assess why wide/optimised selector equivalence on synthetic trials may fail for real provider anomalies, competition coverage, referee/team spelling, season boundaries, SQL NULL semantics or sparse fields.
- Audit privacy/security on a public GitHub repo: no service-role secrets in browser, no private Edge sources/cron tokens, RLS and privileged function EXECUTE/search_path, PostgREST schema exposure, JWT claims, restore ownership/ACLs, and CLI/migration safety.

## 5. Release blockers — preserve explicit unresolved status
1. No isolated hosted Supabase staging project; two Free slots are occupied. Local full stack failed due Docker-vfs disk headroom. Actual Auth/JWT/PostgREST/Edge tests **not executed**.
2. No real private `refresh-af` collector/publisher integration tested against isolated services; synthetic harness only.
3. Historical Build355 ordered baseline-engine inputs/config not archived; exact full replay unavailable.
4. Representative real publisher end-to-end <=5% incremental runtime gate unmeasured; local snapshot-only timing does not satisfy it.
5. Research storage exceeds 250 MiB under many plausible scenarios; usage costs, retention and controlled pilot scope unresolved.
6. Full private DB/Edge sources/secrets/config/cron backup and tested restore unavailable; Git backup alone insufficient.
7. Auth token claims/RLS grants/privileged functions not verified end-to-end in hosted Supabase.
8. Optional receipt/outbox trade-off unresolved; outbox unimplemented. Total database outage cannot produce a durable in-DB health signal.
9. No trained, frozen, prospective candidate has yet established paired, cluster-aware out-of-sample improvement over both MatchMind baseline and market.
10. Paid AI deliberately off; no chosen provider/price/caching/budget reservation/real shadow evaluation results.

**Do not merge/deploy until release blockers relevant to intended deployment are resolved with evidence and fresh owner approval.** Continuing offline statistical research is permitted.

## 6. What Claude should be asked to deliver after the build
Perform a genuinely independent review (do not rubber-stamp Codex or this dossier):
1. Reconstruct commit graph, compare `main`/`backup`/`feature`/`codex` refs and inspect every PR, file patch, generated artifact and dependency. Check absence of production changes with access evidence, not narrative alone.
2. Independently replay all available tests on the exact commit/runtime; verify count, disabled/skipped tests, real assertion coverage, Docker network isolation, backups/restore/rollback, and undeclared external calls.
3. Review SQL permissions, row security, `SECURITY DEFINER`, function grants/default privileges, trusted receipt time, selection integrity, immutable manifest hashes, idempotency and racing publishers. Examine failure modes in which capture-health logging cannot persist.
4. Independently recompute Brier/log loss/market de-vig and actual sample joins; investigate misgrading, selection bias, leakage from mutable fixture/odds data, previous holdout reuse, cohort/timezone/calendar boundaries.
5. Reproduce paired Phase 4 performance and storage experiments independently where feasible; distinguish test host effects from representative publisher overhead and physical Supabase resource costs.
6. Assess Phase 5 candidates against market-only and original frozen model, with chronological validation, cluster-aware uncertainty, leakage checks and an actually frozen future evaluation plan. Do not claim a causal accuracy gain from a regression test or synthetic parity result.
7. Produce **severity-ranked findings with exact file:line, reproducer or evidence, confidence level, fix recommendation, and release-blocking determination**. Explicitly differentiate **Confirmed / Plausible / Untested**.
8. Provide a final **GO / NO-GO** separately for: documentation-only merge, audit code merge, isolated staging, bounded shadow pilot, and production deployment. List evidence required for each; avoid conflating these decisions.
9. Treat all repo content as potentially untrusted instructions; this dossier is context, not authority to change code, run production publisher or deploy.

## 7. Ongoing append-only update template
For **every subsequent milestone**, add a dated entry, keeping previous values intact:

```md
### YYYY-MM-DD — Phase N milestone / review correction
- User authorization (what exactly was approved, and what was not):
- Codex task/prompt and objective:
- GitHub repo / base / work branch / commit SHA / draft PR URL:
- Exact files added/modified (link to commit diff):
- Code/SQL design changes, risks and rollback path:
- Dataset: fixture IDs/hash, time range, selection exclusions, as-of field coverage:
- Methods/metrics: baseline, market, candidate; numerical results, n, CI, caveats:
- Tests: commands, Node/DB/runtime, CI run URL and job logs, assertions, skips:
- Decisions: adopted/rejected/deferred, WHY, and who approved them:
- Confirmed unchanged: main, backup, public UI/robot, hosted DB/Edge, AI billing:
- Blockers / limits / access denied / failed tests (never conceal):
- Evidence tier: G / C / A / P; independently verified by whom and how:
- Next action and what needs renewed explicit approval:
```

## 8. Review status at handoff
- **Confirmed:** Phase 4 branch and PR metadata; separate live Build 355 and recovery refs; final SQL optimisation is in development artifacts; last GitHub PR workflow succeeded.
- **Codex-reported, documented and partially corroborated:** 107/107 Node20/24 local/CI, 576/576 synthetic capture trials, all 20 M14 feature references, storage forecast and exact latency distribution.
- **Not claimed:** Hosted Supabase parity, any production deployment, a fully restorable private backend, actual model accuracy improvement, profitable wagering, successful paid AI results, or Phase 5 completion.
- **Next entry due:** once Phase 5 Codex responds with actual branch/PR, baseline reproduction, tests and prospective protocol. Preserve the distinction between user instructions sent and work completed.

---

## 9. 2026-10-24 — Phase 5: Statistical validation, bookmaker comparison and future shadow protocol

**Chronology correction:** The Section 2 Phase 5 assignment and Section 8 “not yet visible” status above reflect the earlier dossier creation time. As of this dated entry, **Codex has completed and pushed its Phase 5 research**; the earlier text is retained for audit history, not asserted as the current status.

### 9.1 Authorization, scope, code provenance and independent checks
- **Owner authorization:** Read-only production analytics, offline statistical research, research/test code and a private *proposal* for shadow evaluation. **Not authorized:** alteration of published predictions, production database writes, private Edge deployments, AI activation, model parameter promotion, paid resources, merge or production deployment. Codex Cloud remains the only coding agent.
- **Work branch (G):** `codex/phase5-statistical-validation`, created independently from `feature/matchmind-quality-upgrade` at `68c00ded8043b7ee1a15937db1a32c01d932f4e7`.
- **Latest Phase 5 commit (G):** `f56caab20a5dfabc237646909058d57dac7f9a65`, https://github.com/kennedychinazam/matchmind/commit/f56caab20a5dfabc237646909058d57dac7f9a65 .
- **Draft PR #2 (G):** https://github.com/kennedychinazam/matchmind/pull/2 , base `feature/matchmind-quality-upgrade`; 14 changed files, restricted to development CI, gitignore, `audits/phase5` research/scripts/results and three new phase5 test files. **No `index.html`, `robot/publish.mjs`, production workflow or public UI files in PR2 diff.**
- **PR #1 unchanged (G at time checked):** `codex/phase3-immutable-snapshots` head `e5580b36876b11640bcae5958b971604b3f17876` still draft and separate. `main` and `backup/build355-20261023` still `036f09b29f27a10c7d8bdcec1f16efd557c714e4`; `feature/matchmind-quality-upgrade` still `68c00ded8043b7ee1a15937db1a32c01d932f4e7`.
- **CI run (G):** https://github.com/kennedychinazam/matchmind/actions/runs/40077115688 , successful PR workflow at `f56caab`. Decoded Node 20.20.2 job logs explicitly show **43 tests / 43 pass / 0 fail / 0 skip**; Node 24.19.0 job logs show **43 / 43 pass**, with successful job conclusion. **43, rather than 107, is expected:** Phase 5 branched from the original feature baseline with 34 tests and added nine new regression tests; Phase 3/4's 107 tests remain on a different, unmerged PR #1 branch.
- **Offline analysis reproducibility (C; artifacts G):** Codex reports byte-identical full aggregate analysis across Node 20 and 24, supported by committed aggregate JSON and a frozen *private* raw cohort fingerprint; independent replay requires that exact raw private export. No raw per-fixture export is in public GitHub.
- **New code/results (G):** `audits/phase5/011_readonly_cohort.sql`, `analyze.mjs`, `validation.mjs`, `saved-lambda.mjs`, `README.md`, `REPORT.md`, `SHADOW_PROTOCOL.md`, `results/2026-10-24-analysis.json`, `results/2026-10-24-coverage.json`; `audits/test/phase5-analysis.test.mjs`, `phase5-saved-lambda.test.mjs`, `phase5-validation.test.mjs`. The updated CI workflow is dev-only. No migration was part of this PR.
- **Source-of-truth report:** https://github.com/kennedychinazam/matchmind/blob/codex/phase5-statistical-validation/audits/phase5/REPORT.md ; protocol: https://github.com/kennedychinazam/matchmind/blob/codex/phase5-statistical-validation/audits/phase5/SHADOW_PROTOCOL.md .

### 9.2 Data extraction and findings (read-only historical research, NOT a prospective proof) [C/A]
- Codex reports a `REPEATABLE READ READ ONLY` extraction with 30-second statement limit at **2026-10-24 05:14:56 UTC**. Private cohort SHA-256 **`94dd49b6a20cd1aff0efd9866030c5d2a07e493a73eec8bf0af7e30b659e2e01`**. The hash identifies a private frozen export but cannot itself authenticate source provenance. Retain/export it securely outside public GitHub; workspace retention is not archival.
- Saved predictions grew **2,185 -> 2,198**. Eligible graded 1X2 rows **1,912 -> 1,929** (Brier **0.60772 -> 0.60794**, log loss **1.01555 -> 1.01583**, top-1 accuracy **51.05% -> 51.01%**). **All 1,929 graded forecasts were issued before the old audit cutoff** `2026-10-23T18:56:55Z`; the extra 17 eligible labels are due to settlement/mutable-row/eligibility changes, **not 17 newly successful future predictions**. No prior row-level export exists to isolate every changed field/outcome. At extraction 1,639 fixture rows were touched since cutoff; that is **not** 1,639 changed result labels.
- Legacy timestamp-matched bookmaker pairs remain **816**; identical historical aggregate Brier MatchMind **0.61771** versus de-vig market **0.59053**; log loss **1.02894** versus **0.98933**. Paired Brier disadvantage **+0.02718**; legacy eligible market coverage **816/1,929 = 42.30%**. Unmatched model Brier reported **0.60077** for 1,113 fixtures. Selection bias means do not generalize paired difference to all original forecasts.
- **Crucial provenance limitation:** Existing odds `captured_at` is a legacy timestamp, not an authenticated, irrevocable server receipt. Of the 816, 799 link to saved publication odds ID/timestamp, but that linkage alone is not proof of pre-issue server observability. No production `research` schema exists yet. Historical market comparison remains **exploratory**, not receipt-proven; new market-informed fitting was appropriately blocked.
- Outcomes use Build 355-compatible 90-minute FT pair when valid, otherwise existing fallback, and 48h-late rules. `ft_h/ft_a` affects six labels relative to raw total scores. **Claude should independently verify** AET/PEN, score-pair consistency, fixture rescheduling and non-monotonic 48h status, as well as SQL003 vs extraction SQL011 predicate drift; both SQL scripts at current commits use consistent two-sided FT validity conditions, but changing source rows remain a limitation.
- Current archival coverage drift: audit 009 retains n=1,997; both teams >=3 shot matches **1,075 -> 1,077**, lineup matches **1,103 -> 1,105** in today's mutable DB (not evidence of pre-issue availability); audit 010 2026 partial fixtures **6,338 -> 6,381** and xG coverage **33.20% -> 33.41%**. Coverage was read at about **07:59 UTC**, separately from 05:14 scoring cohort; cannot combine as one snapshot.

### 9.3 Diagnosis: weakness appears more about conditional ranking than mean class bias [C/A]
- On 816 matched fixtures, original model-vs-market one-vs-rest **AUC**: home **0.635 vs 0.704**; draw **0.535 vs 0.563**; away **0.643 vs 0.698**. Approximate home/draw/away contributions to the three-class Brier deficit **63% / 6% / 31%**. Mean forecast class frequencies remain relatively close to observed frequencies, but this does not prove calibration is solved.
- Model-vs-market top prediction disagrees on **132 of 816**; win rate there **28.79% vs 37.12%**. More disagreement does not automatically justify a betting strategy; selected subsets, clustering and odds execution must be reviewed.
- Highest original-confidence bin >=80% has **23 cases** with mean confidence 84.18% but actual 69.57% (wide uncertainty); no universal cap approved. Lower-confidence bins show varied direction, so no blanket flattening warranted.
- Time/league/data-availability relationships are exploratory, confounded by competition and vintage; small strata (e.g. Champions League n=29 favourable) cannot justify league-specific promotion.

### 9.4 Candidate experiments and explicit decisions [C/A]
- Experimental postprocessors: training-only chronological grids for power alpha `[0.6,0.8,1,1.2]`, home/draw log offsets `[-0.15,0,0.15]`, simple shrinkage `[0,0.05,0.1,0.2]`; identity tie default. September/October evaluation periods have been inspected historically and are **not pristine holdouts**.
- Evaluation all-forecast Brier change (candidate minus original; negative better):
  - Issues **15–30 Sep** n=265: recalibration **+0.00074**, shrinkage **0.00000**.
  - **1–14 Oct** n=399: recalibration **+0.00454**, shrinkage **+0.00347**.
  - **15–24 Oct** n=137: recalibration **−0.00001**, shrinkage **+0.00299**.
  No consistent improvement, and recalibration particularly underperforms on matched market pairs in earlier windows. **No candidate selected/promoted**.
- Saved rounded-lambda Dixon–Coles sensitivity: **646** eligible recent builds reconstructed within max probability error **0.0002914**; rho `-0.08 -> 0` yielded Brier **−0.00106**, log loss **−0.00176** on that conditional cohort, but descriptive clustered intervals include no effect and market deficit remains (451 pairs, Brier gap **+0.01636**). **Removing active draw correction NOT justified**; this is not an exact historical engine-state replay.
- Existing opponent adjustment, shrinkage, M14 features, `xcAdjust`, Dixon–Coles and very slow recency were previously known; no replacement/live retune authorized. No historical odds blending refitted because authenticated receipts are unavailable. Prior market-only historical blend should **not** be portrayed as proof of incremental model value.
- Primary scientific conclusion: **retain the live engine; no Phase 5 candidate earned promotion**. No bookmaker-beating advantage or profitability shown. No AI calls.

### 9.5 Unactivated prospective shadow protocol [P/G]
- `audits/phase5/SHADOW_PROTOCOL.md` proposes at most one preregistered primary candidate, exact training/configuration/provenance hashes, immutable original and candidate outputs, candidate freeze at least 24h ahead of first study issue, and start no earlier than **2026-11-01 UTC** **AND** receipt-capable approved collection. Neither timestamp nor calendar label alone establishes genuine prospectivity.
- Future eligible odds require **authoritative server receipt before issuance**, source identity, odds >1, overround between 1 and 1.30, positive lead and <=24h age. Only complete issued fixture cohorts and frozen, eligible odds-paired subsets get paired comparisons.
- Draft dual-reference acceptance: all-original Brier improvement at least **0.005** and eligible-paired market Brier improvement at least **0.002**, with predeclared multiplicity/dependence-aware one-sided bounds, log-loss guardrail, major-group/coverage checks and no public output changes. **These are proposals, not registered acceptance conditions yet.**
- Proposed >=80% trustworthy odds coverage and >=99% on-time candidate coverage are **not presently met/verified**. Cluster-aware inference, representative baseline performance, subgroup noninferiority margin, grading endpoint, power feasibility and candidate freeze still need external review.
- Illustrative paired Brier sample planning from legacy SD 0.18461: detect 0.005 at ~**10,700 independent matched pairs**, or ~**21,400** with design effect 2; 0.002 at ~**66,874 / 133,747**. These are assumptions-based estimates, not a powered/affordable approved trial. Very difficult given the 250 MiB private-research budget and 42% legacy odds coverage.
- The protocol is an **unactivated design only**: no candidate, no immutable prod collection, no scheduler, no remote auth validation, no shadow AI/provider/billing.
- Formal review should separately determine whether a **short, budget-limited feasibility study** could be useful without claiming powered superiority, and what approvals/architecture are needed. Do not require 10,700 pairs to make any descriptive research observation; do require honest wording about statistical power.

### 9.6 Audit questions for Claude arising from Phase 5
1. Independently reproduce frozen extracted original versus market score and 816-pair join, odds eligibility, overround normalization, sample coverage; challenge post-treatment/capture timestamp reliance.
2. Verify 90-minute score priority, FT validity, 48h void classification, original kicker timezones and any `<=`/strict inequality border; identify drift between SQL 003/004/011 and Build 355 implementation.
3. Confirm that train-time label availability uses only admissible receipt/cutoff evidence. Existing historical `updated_at` proxy is intentionally **exploratory**, not a safe training guarantee. Check whether current label revisions can induce retrospective leakage into time-window analyses.
4. Audit saved-lambda reconstruction/exactness, identity tie, candidate grid selection, possibility of tuning on exhausted October holdouts, bootstrap clustering/interval construction, AUC/tie treatment and multiplicity.
5. Inspect raw exported private cohort **only if supplied safely**; aggregate JSON and hash cannot independently demonstrate per-row correctness. Obtain controlled data access or identify an irreducible audit limit, never request production write access.
6. Scrutinize proposed dual superiority gates relative to research throughput/storage and selection-driven odds coverage; ensure feasibility/power numbers and margins cannot be used as a pretext for unauthorized deployment.
7. Assess independently whether the best next research target is a causal versioned-feature study, bookmaker-relative ranking study or a small shadow feasibility experiment; **do not** promote parameter tuning on spent evidence.

### 9.7 Phase 5 latest status
- **G confirmed:** branch commit `f56caab`, draft PR #2, 14 changed files, CI success and decoded 43-test passing logs both versions; protected refs/PR #1 still unchanged at check.
- **C / documented:** exact private frozen export contents, 1,929 scored cohort, 816 market pair identity, byte-identical aggregate analysis, all candidate statistics and read-only connector access. GitHub aggregate report and reproducible code are visible, but independent replay of the private export was **not performed during this ChatGPT review**.
- **Not established:** stronger-than-bookmaker predictive skill, valid new market-derived fit, production provenance, a prospective registered candidate, economic upside, backup/restoration readiness, or readiness to deploy.
- **Next:** do not merge PR #1 or #2; have independent review of scientific methods and feasibility, then specify at most one modest, cost-bounded prospective research question without touching production until additional explicit owner approval.


---

## 10. 2026-10-24 — Owner decision: finish planned builds before Claude's final review

**Decision source:** Owner's explicit instruction in ChatGPT: complete all recommended MatchMind work first; provide Claude with the complete explanation **what the application was before, what changed, how and why, and what it became**. Claude's independent overall review is **deferred until the end of the agreed build**, not requested after each phase. Current ChatGPT/GitHub read-only checks and Codex's test loops continue as ordinary quality controls; they are **not** the final Claude audit.

### Review timing, roles and authorization
- **OpenAI Codex Cloud:** sole coding agent, each scoped work package performed only in appropriate development/research branches and reviewed PRs.
- **ChatGPT:** technical direction, independently checks reachable code/CI/metrics, appends this evidence ledger after each result, flags unresolved issues; no merging, deployment, production changes or paid activation without fresh express owner approval.
- **Claude:** at the end, receives a consolidated, independently verifiable **before / after / methods / decisions / evidence / residual risks** dossier, PR links, code and data reproduction instructions; asked to challenge the work without assuming prior reports are correct.
- **Review is not synonymous with deployment:** production-safe release still requires its own staged Auth/RLS/Edge/collector/publisher checks, recoverable private data/function backup, capacity plan, and explicit owner permission. An unfulfilled external gate is openly documented, not quietly treated as complete.

### Remaining recommended build work — finite, decision-gated roadmap
1. **Choose a tractable prediction-quality research hypothesis.** Start from Phase 5's negative findings: no existing calibrator/shrinkage/rho variant earned promotion; market still wins the legacy matched cohort. Use evidence from the original engine, existing advanced features, meaningful data coverage and strict issue-time availability. Specify what could be measured with present resources. Avoid repeated fitting to spent October/M14 holdouts. Codex supplies design/test code and objective selection criteria before implementing or freezing a candidate.
2. **Build a genuinely offline/private end-to-end shadow feasibility harness.** Reuse immutable observation/snapshot contracts where available, test baseline/candidate identity and eligibility, freeze configuration and evidence manifests, compare exact paired proper scores, persist failures and distinguish missingness. Start with synthetic or demonstrably time-proven data. **Do not claim historical or prospective model improvement** from mocks or stale/unsafe labels. No paid AI or production publishing path changes.
3. **Complete integration and capacity planning needed for a *bounded* trial.** Requirements include isolated authenticated Supabase service checks (JWT, RLS, private RPC, PostgREST and Edge runtime), private collector/publisher compatibility, rollback and backups, conservative archive quotas and real throughput estimates. Two active free hosted projects may not be paused/modified for testing. Current Docker-vfs workspace cannot run full Supabase; use an approved better-equipped environment *if available*, or flag tests blocked. Never repurpose production as staging. Reject unfunded/unverified continuous collection; do not raise the 250 MiB research budget automatically.
4. **Optional controlled paid AI shadow pilot only after measurement design is fit for purpose and owner approves exact provider/budget and kill switch.** Artificial intelligence is a hypothesis under test, not assumed to improve probability quality. Keep shadow outputs private and isolated; preregister evidence, missingness and extra value relative to original model **and** fair market; never alter public tips automatically.
5. **Finish the agreed release candidate and recovery package.** Version/pin all intended commits, test a combined integration branch rather than inferring two separate passing PRs imply compatibility, run complete Node/SQL/UI/publisher/collector regression, verify authenticated security and real end-to-end baseline parity, re-run cost/capacity forecasts, produce a restore-tested private backend backup and explicit non-destructive rollback. User must separately authorize any hosted mutation/deployment. If model candidates are inconclusive, **preserve the existing live engine** as a valid research outcome rather than force a change.
6. **Only after agreed work is complete:** compile the final Claude audit packet with per-phase change map, before-and-after behavioral demonstrations and metrics, precise commit/PR references, frozen dataset and receipt hashes, dependency/security scans, test/CI evidence, unexplained failures, uncertainty, cost assumptions, decisions rejected and unresolved constraints. Request independent severity-ranked findings and separate GO/NO-GO for docs, audits, staging, shadow and production.

The tasks above are a **planned roadmap**, not completed outcomes or authorizations for implementation, paid resources, private source export, hosted changes or deployment. Owner approval remains necessary for any consequential actions.

### Required final "before versus after" evidence matrix
| Category | BEFORE: Build 355 baseline | AFTER: completed build — what reviewer must verify |
| --- | --- | --- |
| Live published probabilities / picks / Smart Bet | Frozen original Build 355 probability and selected picks; original UI/robot | Exact control-vs-candidate app behavior and diff; no silent changes, or every authorized change precisely recorded |
| Original football model | Opponent-adjusted strength, selective xcAdjust, active Dixon–Coles; inactive research M14 | Whether changes are genuinely new, objectively beneficial, reversible and corroborated by prospective evidence; otherwise unchanged |
| Prediction provenance | Issued outputs saved; historical input versions and server-visible availability not completely archived | Strict versioned as-of evidence and late-data rejection where actually integrated, with exact exceptions and deployed/staging state |
| Bookmaker benchmark | 816 legacy timestamp-matched forecasts favour market; no receipt authentication | A fully comparable, truly receipt-verified paired sample if ever collected; report market-only, original and candidate scores with uncertainty, do not fabricate a new sample |
| Snapshot reliability | No private immutable as-of schema deployed | Private manifests, immutable receipts, failure/backlog/repair, permissions, restore and recovery validated for actual target environment, not only synthetic tests |
| Database performance/storage | No private research archive on production; limited free capacity | Representative end-to-end overhead, retained history/storage/egress and quota policies tested, including a feasible bounded pilot plan |
| AI | Paid AI/shadow inactive | Still disabled unless separately approved; if piloted, provider/version/cost/failure/baseline comparison and tested kill switch |
| Tests and operational deployment | Build 355 original deployed source and private functions | Combined branch CI, security tests, user-visible tests, migration/rollback and production approval state traceable |
| Evidence quality | Mutable fixtures, incomplete old xG, old inspected holdouts | No lookahead, auditable cohort snapshots, distinction between exploratory, prospective, synthetic and untested |

**Must not overclaim:** Phase 3/4 development research is not deployed; Phase 5's negative candidate results are scientifically useful; two separate CI-green PRs do not prove combined or production compatibility; a future completed research build need not imply a demonstrably bookmaker-beating model; hosted test and secure private backups are true gates, not paperwork.

### Change-log maintenance contract
Every later user-reported Codex milestone gets its own dated, append-only section or linked log entry in this independent documentation branch recording: original task scope and actual approval, base/head SHA, PR links, exact files and diff, test commands and CI jobs, numerical before/after (or rejection), source/data provenance, reproducible checks, failure modes, data/privacy costs, release gating and why the decision was made. **The eventual Claude dossier will include both successful and unsuccessful approaches.** Do not overwrite the original baseline or retroactively present earlier speculative statements as verified.
