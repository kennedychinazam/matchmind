# Phase 3 Immutable As-of Snapshots Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task after review. Steps use checkbox syntax. Codex Cloud is the sole coding agent.

**Goal:** Preserve original issued predictions and provably pre-issue evidence in an isolated append-only research archive, without changing production behavior.

**Architecture:** A private research schema stores versioned field observations, immutable prediction envelopes, evidence manifests and separate shadow forecasts. A staging-only database capture hook copies the winning publisher insert; a restricted collector writer records field observations at ingestion. An offline adapter supplies only eligible archived inputs to the existing M14 feature builder.

**Tech Stack:** Node.js built-in test runner and crypto, PostgreSQL 17, local Docker, existing browser JavaScript and Supabase publisher/collector interfaces.

**Spec:** `docs/CODEX_PHASE3_HANDOFF.md`, `audits/PHASE3_FINDINGS.md`, `docs/MATCHMIND_BUILD355_RECOVERY_BASELINE.md`.

## Global constraints

- Development branch: `feature/matchmind-quality-upgrade`; leave `main` and `backup/build355-20261023` untouched.
- Production Supabase `toqfdrcjzwnlydqekude` is inspection-only. No production SQL writes, function deployments, publishing, merge or website deployment.
- Never call paid AI APIs, edit billing, enable shadow AI, create paid resources, or commit private function sources or secrets.
- No engine replacement, threshold retuning, 300-match recency activation, live M14 activation, or reuse of spent holdouts as fresh evidence.
- Original probabilities, issued pick, issuance timestamp and original kickoff remain unchanged. Candidate forecasts are explicitly `shadow` and private.
- `?blobs=1` remains opt-in; ordinary boot payloads must not grow.
- Preserve existing 90-minute score and 48-hour void behavior; no production grading changes.
- No production migrations without fresh user approval and a tested backup. Git recovery alone is not a database or function backup.

## Verified starting point — 2026-10-23

- Repository remote: `https://github.com/kennedychinazam/matchmind.git`.
- Checked-out branch: `feature/matchmind-quality-upgrade`.
- Local HEAD, fetched remote ref and `git ls-remote` branch tip all equal `68c00ded8043b7ee1a15937db1a32c01d932f4e7` (`docs: index as-of feature experiments and Codex-only task`). Working tree was clean before this plan.
- `node --test audits/test/*.test.mjs`: exit 0; 34 passed, 0 failed/cancelled/skipped/todo; Node v24.19.0. CI uses Node 20; verify both during implementation.
- `index.html`, `robot/publish.mjs` and `.github/workflows/publish-picks.yml` have no diff from protected Build 355 commit `036f09b29f27a10c7d8bdcec1f16efd557c714e4`.
- Read the handoff, recovery baseline, audit README and findings, audit SQL 001–010, tests and relevant app/publisher code. No AGENTS.md was found in the repository or workspace ancestors.
- Supabase connector access works for schema/policy inspection and private `refresh-af` source retrieval. Source inspected in tool memory only, not copied into this public repository.
- MatchMind has no Supabase development branches. The other visible project is unrelated and must not be reused. Docker daemon 28.4.0 is available; `psql` and Supabase CLI were not found. No local DB or staging integration has yet been created or tested.

## Inspection and boundaries

| Existing source | Verified meaning and integration consequence |
| --- | --- |
| `index.html:10039` `archivePrediction(L,f,p)` | Publisher-only; queues `fxid`, original `kickoff`/`ktime`, rounded `p_home/p_draw/p_away`, expected goals, issued `pick`, `pick_prob`, `market`, `build`, `made_at`. `made_at` is client-generated issuance, not database receipt time. |
| `flushPredictionArchive()` | Inserts with duplicate-ignore on `fxid`, then reads back the winning row. Capture that actual database insert, never a losing device's pending payload. Later drift and withholding are distinct operations. |
| `stampPublicationPrices()` | Stores `odds_snap_id`, `odds_at_pick_at`, `odds_at_pick`; chooses captures at/before `made_at`, nonnegative minutes-to-kickoff, over a 36-hour query window. Preserve this behavior. Research benchmark separately uses the existing strict positive lead time and 24-hour freshness contract. |
| `public.predictions` | Primary key `fxid`; original probability/pick/build/time columns plus mutable drift/withholding fields. A research envelope copies only original lineage; it never rewrites this table. Column-level UPDATE grants also require verification before staging capture integration. |
| `public.fixtures` | `fxid`, `lid`, `season`, `provider`, schedule, scores and sparse stats/blobs; no native immutable fixture version or per-field observation time. Use content hashes for new versions, never pretend `updated_at` is a version history. |
| Private `refresh-af` v54 | `mapFixture` stamps `updated_at` on base and history upserts by `fxid`; separate passes update detail fields. Both repeated rewrites and separately patched details defeat inference of per-field availability from `updated_at`. |
| `public.odds_snapshots` | `id`, `fxid`, `captured_at`, `mins_to_kick`, `books`, aggregate market columns and optional JSON. Index `(fxid,captured_at DESC)`. Copy selected evidence into research storage to survive later source changes. |
| Production RLS | Enabled on all three tables. Public SELECT policies; prediction INSERT/drift UPDATE policies restrict publisher JWT email. Broad table grants on fixtures/odds do not establish write access through RLS. Do not copy those broad grants to research tables. |
| Statistical engine | `strengths2` already supplies opponent adjustment/shrinkage/recency; `fxPredict` adds `xcAdjust`; Dixon–Coles is already active. `matchFeatures` and M14 fitting are separate research code. Adapt archived inputs to that code, not a second feature implementation. |
| Robot/workflow | Robot defaults to the live URL, includes production REST reads, persistent auth and an AI-shadow step in its normal flow. `MM_DRY_RUN=1` alone is not isolation. Never launch this robot against production from this branch. |

## Proposed provenance and data model

All new names below are planned interfaces, not existing deployed objects. Use private schema `research`; keep it outside exposed API schemas. Enable RLS defensively, revoke schema/table/function rights from PUBLIC/anon/authenticated, revoke default public function EXECUTE, and grant only narrowly scoped local collector/publisher/research roles. No browser service-role credential. Mutation guards reject UPDATE/DELETE; owner/superuser bypass remains an explicit administrative trust boundary. Hashes detect payload changes but do not independently authenticate a source or prove historical timing.

| Table | Required contract |
| --- | --- |
| `research.observations` | `observation_id uuid PK`, `fixture_id bigint`, `source_kind text`, `source_ref text`, `collector_run_id uuid`, `field_name text`, `value jsonb`, `availability text` (`observed`/`unknown`), `observed_at_utc timestamptz nullable`, `received_at_utc timestamptz` server-assigned, `effective_at_utc timestamptz nullable`, `played_at_utc timestamptz nullable`, `feature_schema_version integer`, `payload_hash text` SHA-256, `source_hash text`. Each correction appends a new value version. Unknown timing requires null observed time and is ineligible. |
| `research.prediction_snapshots` | `snapshot_id uuid PK`, unique `(fixture_id,issue_time_utc,prediction_build)`, original probability triple/pick/market/expected goals, original kickoff, `prediction_build integer`, `model_version text`, `run_id uuid`, `issue_time_utc timestamptz` copied exactly from `made_at`, server receipt, fixture version hash, feature schema version, source hash, payload hash, `settlement_policy_version='build355-90m-48h-v1'`, `capture_kind` (`at_issue`/`late_import`), replay eligibility/reason. Never relabel older builds as Build 355. |
| `research.snapshot_evidence` | `(snapshot_id,observation_id)` composite PK/FKs; explicit evidence role and source-fixture identity. Includes copied odds evidence, value-version references and a manifest of missing required fields. No cascading deletes from mutable production tables. |
| `research.shadow_forecasts` | `shadow_id uuid PK`, `snapshot_id` FK, candidate version/hash, run ID, frozen configuration hash/time, probability triple, feature-manifest hash, `visibility='shadow'` constrained, fallback/abstention reason. Unique `(snapshot_id,candidate_version,configuration_hash)`; no public query path. |

Indexes: observations `(fixture_id,field_name,observed_at_utc DESC,observation_id)` plus `(collector_run_id)`; prediction snapshots unique lineage key and `(issue_time_utc,fixture_id)`; evidence PK plus reverse observation FK index; shadow unique version key. Do not add or change production indexes.

Timing contract:

- Timestamp input requires an explicit `Z` or valid numeric offset and a real calendar date; normalize to UTC, reject ambiguous/invalid values. Preserve original source timestamps separately from ingestion receipt.
- For each actual value version used: trusted `observed_at_utc <= issue_time_utc`; historical completed evidence additionally requires `played_at_utc < observed_at_utc` and `< issue_time_utc`. A correction received after issue cannot inherit the first observation time of an older different value.
- New collector observation times are server ingestion times. Earlier provider times are metadata unless independently archived and authenticated; callers cannot backdate trusted receipt or supply arbitrary historical observation times.
- Late migration/import copies retain original issuance plus current receipt and `capture_kind='late_import'`. Current fixture contents never become historical evidence. Only independently proven earlier immutable evidence can make a historical replay eligible; otherwise report incomplete, with missingness.
- Snapshot creation after publication is acceptable only if its complete manifest refers to already archived eligible evidence. Receipt time alone cannot prove that a browser used that evidence. Record the exact ordered baseline input manifest/configuration for true baseline recomputation; otherwise guarantee only exact saved-output reproduction and label input replay incomplete.
- Research odds selection reuses `selectPreIssueSnapshot`: same fixture, positive minutes-to-kickoff, age <=24 hours, captured at/before issuance, valid fair-market triple, newest timestamp then highest ID. Store the original publication-price stamp separately so its 36-hour policy is never silently replaced.
- Probability values must be finite numbers in [0,1], length three, sum tolerance <=0.005 for stored rounded baseline; preserve exact values rather than renormalizing. Null optional fields remain null with explicit missingness, never invented zeros.

## Cost, retention and repair

- Append changed allowlisted field values, not every full provider response or identical poll. Keep a separate per-run receipt summary if needed. Deduplicate content by fixture/field/source/value hash while preserving first capture of each correction version and its ordering.
- Proposed initial limits to enforce in tests: 16 KiB canonical field payload, 64 KiB prediction/shadow envelope, 500 evidence links per envelope, 100 envelopes per batch, <=2 MiB batch. Oversize input fails visibly; never silently truncate evidence or hide missing fields.
- Illustrative storage budget: 2,000 new field versions/day at 1 KiB + 100 envelopes/day at 8 KiB is ~2.73 MiB/day or ~82 MiB/30 days before indexes/WAL/backups. Measure real tuple/index bytes locally; this is an estimate, not a Supabase billing guarantee. Stop collection at a proposed 250 MiB research budget rather than purchase capacity automatically.
- Retain referenced immutable evidence and predictions for the experiment lifetime; no automatic deletion in this task. Unreferenced raw blobs are not stored. Long-term compressed export/checksum verification and retention changes need a separately reviewed policy; never delete evidence underneath a saved forecast.
- Rollback in staging: disable capture hooks/writer first, revoke writer rights, preserve/export research tables and hashes, verify publisher still works. Forward repair appends a superseding version and records its reason; no UPDATE to accepted evidence. Destructive schema removal is allowed only on the disposable synthetic DB after restoration has been demonstrated.

## Review focus

1. A corrected xG/lineup value arrives after issue: the earlier prediction must exclude that version even if today's fixture row contains it (Task 1/3).
2. Two publishers race or a batch retries: only the winning public row gets an envelope, and conflicting duplicate IDs must be reported (Task 2/4).
3. A timezone offset crosses a day/cohort boundary: eligibility and cohort follow the UTC issuance instant (Task 1/3).
4. Missing evidence, permission failure or oversize payload: fail visibly without fabricating inputs or enabling a second publication path (Task 1/2/4).
5. A rescheduled fixture becomes void, then live/finished: document non-monotonic current derivation and preserve original kickoff and grading policy (Task 5).

## Staged implementation tasks

### Task 1: Pure provenance/envelope validation

**Create:** `audits/lib/snapshot-contract.mjs`, `audits/test/snapshot-contract.test.mjs`.
**Reuse:** `audits/lib/research-contract.mjs`, `audits/lib/bookmaker-metrics.mjs`.
**Interfaces:** `validateObservation(input) -> Observation`; `validatePredictionSnapshot(input) -> PredictionSnapshot`; `canonicalHash(value) -> string`. Validation throws on invalid data; canonical JSON sorts object keys, preserves array order, rejects non-JSON/nonfinite values.

- [ ] Write failing tests for explicit-offset UTC equivalence, invalid dates/offsets, unknown fields, required missing keys, unknown timing/null semantics, value-version hashes, 16/64 KiB boundaries, finite rounded probability triples and post-issue evidence rejection.
- [ ] Run `node --test audits/test/snapshot-contract.test.mjs`; confirm new assertions fail before implementation.
- [ ] Implement only the validation/canonicalization contract above, with shared probability/timing helpers where their behavior agrees. Preserve all 34 existing tests.
- [ ] Run focused tests and `node --test audits/test/*.test.mjs`; commit this independent contract change on the feature branch.

### Task 2: Isolated schema, roles and append-only enforcement

**Create:** `audits/staging/compose.yml`, `audits/staging/bootstrap.sql`, `audits/staging/snapshot-schema.sql`, `audits/staging/rollback.sql`, `audits/staging/permissions.sql`, `audits/test/snapshot-db.integration.test.mjs`.
**Interfaces:** private SQL `research.append_observations(jsonb) -> uuid[]`; `research.capture_prediction(bigint) -> uuid`. Collector can call the former; the publisher capture hook calls the latter. Research reader has SELECT only. All database access in integration tests is local.

- [ ] Add a local PostgreSQL 17 service with a pinned image digest selected during implementation, loopback-only port, synthetic schemas/roles and no production connection credentials. Reject any DB host outside localhost/the test container network and the production project ref in configuration.
- [ ] Write permission tests: anon/unrelated authenticated roles cannot SELECT/INSERT/UPDATE/DELETE/TRUNCATE or invoke writers; authorized insert works; UPDATE/DELETE and conflicting duplicate identifiers fail; identical transport retries return the existing ID after hash verification. Also inspect function EXECUTE grants, default privileges, constraints and column-level source grants.
- [ ] Implement the four-table schema, indexes, constraints and immutable guards. Any necessary trigger-owned privileged function stays private with fixed search_path, minimal owner permissions and revoked public EXECUTE. App roles never acquire research table rights.
- [ ] Run the SQL integration suite with synthetic data, verify permission-denied paths, enforce the same validation in SQL as in Node, and test migration/rollback/reapply plus backup/restore equality.
- [ ] Commit only SQL and local harness files. If a deployable Supabase migration is later needed, first discover CLI help and generate its filename with the CLI; never apply it to production in this task.

### Task 3: As-of manifest and existing-M14 adapter

**Create:** `audits/lib/asof-features.mjs`, `audits/lib/shadow-forecast.mjs`, `audits/test/asof-features.test.mjs`, `audits/test/shadow-forecast.test.mjs`.
**Interfaces:** `buildAsOfInputs({snapshot,observations}) -> {league,fixture,index,manifest,missing}`; `shadowForecast({snapshot,inputs,enabled,adjust}) -> ShadowForecast`. `adjust` is an injected existing-model adapter; this task does not fit/promote a new probability adjustment.

- [ ] Write synthetic tests for a prior match whose result existed before issue but xG/lineup arrived after issue; assert those fields remain null, even when a separate mutable latest row is populated. Add a pre-issue value followed by post-issue correction and assert the exact earlier version/hash is selected.
- [ ] Build only from eligible immutable observations; exclude mutable fixture reads. Adapt all dependencies consumed by existing `matchFeatures(L,f,upTo,idx)`, including metadata, schedules and helper caches, not just xG. Missing unproven dependencies stay missing or cause explicit abstention.
- [ ] Load existing feature functions into an offline harness with isolated state and no network; compare its feature vector to the existing builder on the same synthetic inputs. Do not copy its feature formulas or invoke `m14RunHoldout`.
- [ ] Assert disabled adjustment or missing required evidence yields exactly the stored baseline triple and issued pick, with `visibility='shadow'` and explicit fallback reason; no normalization/rounding drift. No real model improvement claim follows from these identity tests.
- [ ] Verify UTC cohort boundaries through `fixedResearchCohort`; >=`2026-11-01T00:00:00Z` is only a prospective label. Candidate freeze-before-first-issue and independent sample/inference preregistration remain separate release gates.
- [ ] Run focused and full Node suites, then commit.

### Task 4: Staging capture and publisher-safe collection

**Create:** `audits/staging/capture-hooks.sql`, `audits/staging/collector-adapter.mjs`, `audits/staging/publisher-harness.mjs`, `audits/test/snapshot-capture.integration.test.mjs`.
**Interfaces:** `appendObservedFields({runId,fixtureId,sourceKind,fields},writer) -> Promise<Receipt>`; writer is injected and available only server-side. Staging INSERT hook captures the actual `predictions` row; staging collector records observations from successful provider responses before they can be used for a subsequent issuance.

- [ ] Test collector backfill/upsert and detail-patch sequences, duplicate publisher races, delayed flush, zero available odds, late imports and denied writer operations. Assert source prediction bytes remain unchanged and no late evidence is certified as at-issue.
- [ ] Wire only synthetic collector responses/local staging tables. Extract the minimum adapter contract from the privately inspected collector; do not commit its full source or call provider endpoints. Eventual private collector deployment is a separate approved step.
- [ ] Capture original probability/pick/issuance/kickoff/build and source hashes; preserve pre-issue odds using the research selector and retain the original price stamp independently. Join by fxid and explicit snapshot/observation IDs; no name-based joins.
- [ ] Keep staging integration separate from `index.html`, the live robot and production workflow. Browser tests block all external networking, persistent production profiles, collector functions and paid AI endpoints; credentials are synthetic. Do not rely on the live robot's dry-run flag.
- [ ] Make research capture errors visible in staging and label incomplete captures; test local publisher compatibility both with the hook enabled and disabled. No extra public prediction insertion path is introduced.
- [ ] Run DB capture tests plus all Node tests; commit.

### Task 5: Grading, resource limits and review handoff

**Create:** `audits/test/snapshot-replay.integration.test.mjs`, `audits/test/snapshot-budgets.test.mjs`, `docs/PHASE3_STAGING_RUNBOOK.md`.
**Update:** `audits/README.md`; optionally add an isolated CI job after its local commands pass. Leave the production publisher workflow unchanged.

- [ ] Add original-kickoff reschedule integration scenarios at 47h59m, exactly 48h and later, plus an unplayed terminal-void observation followed by LIVE/finished data. Preserve and test current grader results, explicitly document non-monotonic derivation without a persisted terminal ledger. Describe a future append-only settlement event ledger; do not change production grading now.
- [ ] Replay synthetic snapshots and verify source hashes, as-of evidence, paired fixture identity, baseline fallback equality and private shadow visibility. Verify no mutation of source predictions or candidate data leaking into public reads.
- [ ] Test proposed bounds: 0 added ordinary-boot research requests/bytes; 0 added provider HTTP calls; max 100 envelopes/500 links each/2 MiB batch; at most one batched writer request plus two transient retries with the same IDs; 10-second local research-write timeout. Record local time/tuple/index measurements, and separately report integration overhead target <=5% against the same synthetic publisher workload. These are proposed gates, not measured performance claims.
- [ ] Document exact tested Docker/Node commands, prerequisites, local-only endpoint guards, roles, expected outputs, schema apply/repair/rollback/restore procedure, retention/size measurements, and all remaining limitations. Do not present a vanilla PostgreSQL role test as full Supabase Auth/PostgREST validation.
- [ ] Run `node --test audits/test/*.test.mjs` on Node 20 and available current Node, plus the local DB suites using their documented explicit command. No integration suite may silently skip absent infrastructure and still be reported as passing.
- [ ] Review the full branch diff for protected branch/backend changes, secrets, unintended payload growth and behavioral drift. Prepare a draft PR on the feature branch with exact diff, test evidence and staging instructions; never merge/deploy. Attach the PR to this chat when created. Confirm the intended PR base before choosing `main` versus a separate review branch, and do not modify either protected ref.

## Gates and current completion state

This document completes the requested inspection and staged plan; implementation has not started. Only this plan file has been added. Local database creation, schema testing, private staging integration and performance validation are future work, not completed verification.

No repository or read-only Supabase capability was missing during inspection. A remote MatchMind staging project/branch and staging publisher identity were not found. The proposed synthetic local DB needs no paid resource or production credentials; a full hosted Supabase integration test must wait for a separately configured isolated staging instance/identity. If that capability or private collector access is unavailable when required, stop and report it rather than testing against production.

Before any future production backend change: privately back up all five deployed function sources, export schema/policies/grants/indexes/cron, create and restore-test a recoverable database backup, review staging results, and obtain explicit user approval. Neither Git branch protection nor this plan satisfies those gates.
