# Phase 4: isolated Supabase staging integration plan

Status: local preparation authorized. Hosted provisioning, hosted SQL, subscriptions and deployments are prohibited. Updated for the user-confirmed two active Free projects.

**Goal:** validate the approved Phase 3 subsystem against real Supabase service boundaries while preserving all existing public behavior and production resources.

**Architecture:** a full local Supabase stack in Codex Cloud first, with synthetic data, separate identities and a private collector workspace. Hosted staging is unavailable under the approved budget. No production branch preview or production publisher execution.

**Tech stack:** pinned Supabase CLI/Docker stack, PostgreSQL 17 compatibility, GoTrue/Auth, PostgREST, Edge Runtime, Node 20 and 24, Chromium, synthetic API-Football responses and the unchanged MatchMind feature builder.

**Spec and baseline:** user Phase 4 instructions; approved commit `88f3e084a725d8c17d7624d4edc392bc02032a7d`; `docs/PHASE3_IMPLEMENTATION_REPORT.md`; `docs/PHASE3_STAGING_RUNBOOK.md`; Phase 3 approved plan. Review focus: privilege boundaries, evidence completeness, optional-capture isolation, resource limits and recoverability.

## 1. Findings and boundaries

- Verified working branch: `codex/phase3-immutable-snapshots`, HEAD `88f3e08`. Keep PR #1 draft, targeting `feature/matchmind-quality-upgrade`. Preserve main, the original development branch and Build 355 recovery branch. Phase 4 implementation branching/PR organization can be decided after this plan is approved; do not retarget or merge PR #1.
- Phase 3 reports 99/99 tests on Node 20.20.2 and 24.19.0. Those results are existing evidence, not a new test run during this planning exercise.
- Ten private research tables have RLS; eight evidence tables are immutable. Capture health/backlog provide private repair and reconciliation. Shared manifests retain complete M14 dependencies up to an explicit 100,000-reference ceiling; there is no silent truncation.
- Local NOLOGIN roles do not constitute a Supabase JWT authorization design. Plain PostgreSQL tests do not certify Auth, PostgREST, managed-role privileges or hosted Edge compatibility.
- `audits/staging/bootstrap.sql` is synthetic test setup, not a hosted migration. Never apply it to an existing Supabase database or recreate managed Auth roles.
- The production robot has a hardcoded production backend and browser login behavior. Its dry-run setting does not establish isolation. Do not execute it against staging or repoint its production configuration.
- Original engine calculations, Smart Bet, UI, original prediction probabilities/picks/kickoffs/build identifiers and `AI_SHADOW_PAUSED=true` remain unchanged. Do not introduce or fit models.
- No production database operations, production source exports, real API-Football calls, paid AI requests, resource creation or Edge deployments occurred for this plan. Read-only organization/project metadata was inspected.

## Preparation outcome (2026-10-24)

CLI 2.122.0 installed successfully; Docker 28.4.0 and PostgreSQL tests operate. Default ECR pulls were forbidden; the official GHCR mirror worked. However, full image extraction on this 32 GB Docker-vfs workspace reduced free disk to about 4 GiB before startup. A reduced core-services attempt also approached exhaustion (about 2.2 GiB remaining at the next observation). Both were terminated; trial images/network were removed, restoring about 25 GiB free. No Supabase services started and no hosted project was contacted. Do not repeatedly retry the same downloads in this workspace.

The operational fallback is the original pinned PostgreSQL harness plus new historical concurrency and loopback-transport tests. The opt-in service probe fails closed when the required stack is absent. Auth/JWT/PostgREST/Edge results are blocked, not inferred from SQL. Practical future remedies are a larger Codex ephemeral filesystem or a platform-supported more efficient Docker storage backend configured by the environment owner; do not change the running daemon/storage driver yourself. Preloaded images still require enough expanded/runtime disk, so they are not a guaranteed solution.

See `audits/phase4/README.md` for trial commands, isolation, cleanup and deferred work, and `docs/PHASE4_LOCAL_PREPARATION_REPORT.md` for measured verification results.

## 2. Environment architecture and cost choice

### Gate A — full local Supabase in Codex Cloud

Run a pinned CLI/Docker stack on loopback/private Docker networks, with Auth, PostgREST and Edge Runtime. Use synthetic users and a local mail catcher; no real signup mail, push notifications or webhooks. Keep the existing isolated PostgreSQL regression harness as a separate fast test layer. Only explicitly approved development tools may use outbound network access; test application requests to production, API-Football and AI hosts must be denied.

No additional Supabase subscription is required. This does not promise free Codex compute or artifact storage beyond the user's existing entitlement. Pin the actual supported CLI/runtime versions during implementation and record image digests; do not assume local services exactly match hosted versions.

### Hosted staging — excluded from the current scope

The user has two active Free projects and explicitly declines pausing projects, subscriptions and paid resources. Do not provision another project or change either existing project. All implementation/testing stays in Codex Cloud; no hosted acceptance gate is executable in this scope.

The full-stack trial uses Supabase CLI 2.122.0 installed outside the public checkout. Its default public.ecr.aws registry is denied by workspace policy. CLI source confirms ghcr.io as an official fallback; the supported SUPABASE_INTERNAL_IMAGE_REGISTRY override can select this allowed mirror through the existing proxy with TLS verification enabled. No proxy bypass or production contact is necessary.

Create only a labeled internal Docker network, with host bindings defaulting to 127.0.0.1. Never link the CLI directory to a hosted project or supply an access token. Keep generated keys and CLI output outside Git. Verify actual network attachments, published bindings and absence of an external route before starting application tests. Docker/socket administrators remain trusted; these boundaries do not prevent a workspace administrator from deliberately overriding isolation.

If the official images or services cannot run, keep the existing pinned PostgreSQL 17 harness on --network none, with no published ports. Continue SQL/RLS/function/capture/concurrency/storage/restore verification there. Report Auth, JWT gateway, PostgREST and Edge Runtime checks as blocked rather than synthesizing a pass.

Expected additional Supabase/provider charge: $0. Existing Codex entitlement still applies. Initial capacity: approximately 9 GiB available RAM and 27 GiB disk; image installation and Docker vfs extraction consume substantial disk and contend with container startup. Reserve at least 4 GiB RAM and 8 GiB disk headroom, measure actual use, and stop load generation before exhaustion. Run complete regression and large stress jobs sequentially after image extraction. Keep collection synthetic and bounded; no paid capacity expansion.

## 3. Identities, permissions and private source handling

Keep `research` absent from PostgREST's exposed schemas. Add a deliberately small exposed RPC facade, provisionally `staging_api`, only if required. Expose only reviewed RPC signatures; no generic SQL/function proxy or broad tutorial GRANT ALL statements.

Use real synthetic Auth identities for publisher, reader and operator. A private, administrator-managed capability table keyed by `auth.uid()` authorizes each operation. No authorization from editable user metadata, email strings alone or caller-selected JWT roles. Check the live capability row on every privileged RPC so revocation works even with an unexpired token. Test JWT signature, expected issuer/project, audience and expiration; a project API key alone is not a user identity.

Facade functions must have fixed search paths, qualified object names, narrow owner privileges and revoked default PUBLIC EXECUTE. Do not grant collector/operator role membership to PostgREST's authenticator. The underlying research roles remain private. Review Supabase's managed-role restrictions before creating ownership chains; do not assume superuser privileges.

| Actor | Permitted scope | Required denial |
| --- | --- | --- |
| Anonymous / ordinary signed-in user | Existing intentionally public synthetic application reads | All private evidence, health, repair, collection and shadow operations |
| Staging publisher UID | Insert authorized synthetic predictions; monitored capture facade | Rewriting issued outputs; reading research/health; arbitrary repair |
| Research reader UID | Explicit paged research-read facade if approved | Health, mutation and repair |
| Operator UID | Sanitized health/backlog and bounded repair facade | Raw evidence mutation; original prediction rewriting |
| Private collector machine identity | Append-observation writer through constrained server connection | Public browser credentials; raw table writes; operator access |
| Setup administrator | Provision synthetic identities/migrations only | Routine use as the test identity or runtime publisher |

Use a dedicated least-privilege database login for the collector with only required role/function privileges, TLS and constrained connection settings; validate pooler/session role behavior. If an Edge adapter is required, preserve explicit caller authorization and narrow database permissions. Do not substitute a service-role client for permission tests. Store privileged setup keys separately from runtime secrets.

Private collector and function sources live in a user-approved private repository or access-controlled workspace outside the public checkout. Public artifacts contain contract fixtures, sanitized examples and version/hash references only. `.gitignore` alone is insufficient: add staged-content secret/source checks and inspect patches and logs before pushing. Never put secrets in chat, PR bodies, shell command arguments, browser storage exports or public CI artifacts. Do not expose protected CI secrets to forks or untrusted pull-request code. Obtain private access via an approved secret store; do not ask for pasted credentials.

## 4. Publisher and collector strategy

Create a new isolated publisher harness. It must require an explicit staging project allowlist, reject the production project, verify a server-side staging marker and issuer, and use a fresh browser profile with no production sessions. There is no default target and no production fallback.

Load an isolated test copy of the approved app with only checked backend/test-environment substitutions. Hash and compare the engine functions and use golden synthetic output comparisons against the approved revision. Do not edit or run the existing production robot. Intercept push, account deletion, AI, real collector and other side-effect endpoints. Preserve existing public behavior through the current regression suite and browser comparisons.

Use synthetic API-Football HTTP responses in a private collector adapter. Inject the staging destination and fake provider transport; fail closed if either is absent. Exercise corrections, duplicates, reschedules, cancellations, unknown values, changed lineups/odds and malformed responses. Accept evidence only at authoritative new server receipt time. Replaying a historical fixture today must never manufacture historical pre-issue availability. Use future synthetic issuance times after collection, or a separately controlled local clock test; do not backdate hosted receipt timestamps.

The winning public prediction INSERT remains authoritative. Optional capture failure must preserve that source row. A timeout or lost HTTP response can follow a committed insert: reconcile by fixture identifier, retry capture only and never republish merely because research failed. Verify unique-source and unique-snapshot constraints under racing requests. Explicit late repair remains `late_import` and does not become an original at-issue capture.

Real API-Football collection is outside this campaign. It would require separate approval, verified existing plan limits and a strict request budget. No production publisher execution is needed at any stage.

## 5. Local implementation sequence and deferred compatibility work

Each task starts with failing contract/regression tests, then the smallest implementation, then complete Node 20/24 regressions. Make independent reviewable commits; stop on failures before the next task. Paths below are proposed, not files already implemented.

1. **Isolation and local stack:** add `audits/phase4/` configuration templates, pinned stack setup and fail-closed target checks; test production-target rejection, missing settings and secret redaction. Boot services locally and verify health without public exposure. Preserve the existing harness.
2. **Hosted-compatible migrations and identities:** generate migration filenames through the selected CLI. Reconcile approved schema-only metadata with existing source tables, indexes, triggers, column grants and RLS. Adapt Phase 3 SQL without bootstrap. Add role/capability facade tests. Privately review all generated SQL; no hosted execution yet.
3. **Auth/PostgREST/Edge contract suite:** proposed `audits/test/supabase-*.integration.test.mjs` and private Edge adapter tests. Run HTTP requests with actual local Auth-issued tokens, not only SET ROLE. Compare errors, data visibility and grants. Verify managed-role ownership and dependency installation.
4. **Private collector and separate publisher harness:** implement fake provider transport, safe target validation, exact saved-output comparisons and capture/monitoring fault injection. Keep private implementation outside public Git.
5. **Performance and operations:** proposed `audits/phase4/performance.mjs`, sanitized result artifacts and private monitoring configuration. Execute the workloads below; complete backup/restore and rollback drills.
6. **Future compatibility package (documentation only):** assemble exact migration diff/order, restricted facade grants, rollback scripts, synthetic seed size, resource forecast and local evidence. Record the checks that cannot be certified locally. Do not request or create hosted capacity within the current assignment.
7. **Hosted compatibility — blocked and excluded:** retain an explicit matrix of managed-platform behaviors that local results cannot certify. No project creation, hosted SQL or function deployment is part of this assignment.

Minimum regression commands remain:

```sh
node --test audits/test/*.test.mjs
npm exec --yes --package=node@20.20.2 -- node --test audits/test/*.test.mjs
```

Node 24.19.0 is the approved comparison runtime; pin it explicitly if the workspace default changes. New full-stack tests must fail clearly on missing infrastructure, not silently skip. Keep expensive stress profiles explicit and run them as acceptance jobs with recorded datasets/seeds/configuration.

## 6. Supabase integration test matrix

- **Auth/JWT:** signup/login/refresh/logout, expired and malformed tokens, wrong-project issuer, wrong audience, forged metadata, valid token without capability, removed capability with still-valid JWT, disabled identity and unauthenticated requests. Verify stale access-token behavior rather than assuming logout immediately invalidates every issued token. Use local test email; hosted email flow needs an approved test mailbox/configuration.
- **RLS and PostgREST:** real anon/user/publisher/reader/operator HTTP sessions; private-schema queries and RPC name guessing; INSERT/UPDATE/DELETE/TRUNCATE denials; immutable output columns; unauthorized cross-identity access; pagination/row caps; error sanitization. Inspect schema cache reload behavior after migrations. Verify the actual role used by each request.
- **RPC:** explicit EXECUTE grants, parameter validation, payload limits, search-path attacks, idempotent retries, nulls/nonfinite values, transaction rollback, statement/lock timeouts and lost responses. Check HTTP response bodies as well as HTTP status.
- **Snapshots:** exact saved output/pick/kickoff/version, complete M14 feature-vector parity, authoritative receipt boundary, late import classification, manifest/chunk integrity, correction eligibility, chunk reuse and explicit >100,000-reference failure. Original baseline-input replay remains ineligible until an ordered input/configuration manifest exists.
- **Capture faults:** permission error, evidence admission exhaustion, monitor sink failure, function unavailable, deadlock/transient retry, timeout after commit and concurrent duplicate insertion. Require successful original publication when the optional research path fails and the source database can still commit. Reconciliation must identify missing snapshots even without health rows.
- **Edge Runtime:** pinned Deno/runtime dependencies, JWT validation and API-key header behavior, user-scoped versus privileged clients, secrets injection, CORS for the isolated origin, malformed requests, connection pooling/TLS, cancellation and provider mocks. Test authorization independently of CORS. Do not disable JWT verification to fix a 401 without a reviewed alternate authentication design. Test current signing-key/JWKS behavior on hosted staging; local success is not conclusive.
- **Compatibility:** all existing statistical engine and Smart Bet regressions, no public boot research fetches, original publisher unchanged, no real external side effects. Confirm modern TLS compatibility; the current Supabase changelog announces legacy TLS cipher removal, so pin modern clients rather than weakening transport settings.

## 7. Representative performance and resource verification

Use deterministic synthetic seeds, realistic distributions of teams/seasons/competitions and documented hardware/versions. Never generate load against production.

| Profile | Workload and assertion |
| --- | --- |
| Existing scaling baseline | Reproduce 51,866 observations / 10,444 selected references / 21 chunks; add 24,000 unrelated fields; compare every M14 feature with complete eligible history |
| Larger archive, local first | Grow to approximately one million observations across six seasons and multiple competitions; include many unrelated fixtures and corrections; verify index plans, bounded candidate selection and exact feature parity |
| Manifest boundary | 500/501 references, 200 chunks, exact 100,000 limit and over-limit explicit failure; no silent shortening |
| Publication concurrency | 100 distinct fixture predictions at concurrency 1, 2, 5 and 10; separately race duplicate fixture inserts; overlap collection and repair; inspect the shared admission lock |
| Collector cadence | Synthetic 60-second normal and 15-second stress ticks, with unchanged polling, 1%, 10% and 100% field changes; run fixed-duration bounded batches |
| Runtime overhead | Same engine workload/corpus/cache state with capture enabled/disabled; five warmups and at least 20 paired representative publisher batches; report median/p95/p99, timeouts, locks and network time |
| Growth and reads | Cold first manifest versus reused chunks, diverse teams/leagues, paged evidence reads, health failures and repair; measure allocated tables/indexes, transfer bytes and serialized payloads |

The Phase 3 local reference recorded approximately 0.61–0.70 seconds capture, about 4.76 MiB first-manifest allocation and 208 KiB subsequent growth with reuse. These are starting observations, not hosted promises or a monthly forecast.

Proposed acceptance gates: exact feature/output parity; no duplicate or lost original predictions; no missed failures after reconciliation; local existing five-second scaling ceiling retained. For the representative workload, target <=5% added publisher wall time in both median and p95 paired comparisons; report uncertainty and raw distributions. Report capture p95 and queue wait separately. If serialization cannot meet the target, stop and propose an independently reviewed optimization; do not relax it silently or change prediction calculations.

Estimate daily/monthly growth from measured changed observations, distinct manifest chunks, new predictions and health rows, including indexes and physical headroom. Derive API requests from batch count, publisher calls, retries, monitoring polls and paged evidence reads; derive egress from actual returned bytes. Distinguish logical research admission from whole-database disk, WAL and provider accounting. Run the million-observation profile only after measuring local memory/disk headroom. Hosted shared-compute performance remains unverified and is outside scope.

## 8. Monitoring, repair and recovery

- Private monitor runs every five minutes in an approved private Codex job or private CI environment; no public dashboard exposing research information. Record sanitized job receipts and an independent heartbeat outside the database. A paused/free project or stopped scheduler must alert through missing heartbeat, not appear healthy.
- Page `capture_backlog` and reconcile every published source identifier with snapshot existence; inspect health counters and disabled state. Alert on oldest pending >10 minutes, five new failures in five minutes, any `monitor_recorded:false`, two missing monitor heartbeats or resource-stop thresholds. Alert destination and recipient require user selection; do not message others during planning.
- Operator-only repair processes bounded batches, concurrency initially one, at most three attempts for classified transient failures with jitter. Permission/quota/invalid-history faults require correction or manual review, not endless retries. Preserve first failure, repair history/status and immutable originals. Report publication failures separately from optional research failures.
- Reserve physical headroom and monitor connection/lock limits. A full disk, unavailable database or absent monitor scheduler cannot be solved by an in-database health row alone.
- Before every migration and at least daily during an active campaign, create encrypted database exports into a user-approved private destination outside Git. Proposed RPO: 24 hours, tightened to one hour during active collection if measured export cost permits; proposed small-corpus RTO: 60 minutes, to be demonstrated rather than promised. No automatic backups/PITR are assumed on Free.
- Back up schema/data, reviewed role definitions without passwords, ownership/ACL mappings, RLS, functions, triggers, extensions and migration inventory. Back up private Edge source/configuration separately; secrets stay in their approved secret store with recovery access. Database backups do not include Storage objects; keep Storage unused or add separate verified object backup.
- Restore first into a fresh local full stack. Do not replay managed Supabase platform-role DDL blindly. Verify counts, SHA-256 manifests/chunks, foreign keys, owners, grants, Auth token/login behavior and deny cases after restore. Hosted restoration requires a separately approved disposable target and new target-specific credentials/issuer configuration.
- Rollback first disables capture/collection and revokes new facade execution while preserving original source publication and archived evidence. Export before destructive removal. Test original publication, then repair forward. Never rewrite immutable snapshots or run rollback against production. Document re-enable order and permission verification.

## 9. Next AI integration stage — preparation only

No provider secrets, model discovery requests, AI calls or paid activation are needed for Phase 4. Keep the existing public AI pause. Do not add a prediction model or public AI feature.

Design a provider-neutral internal request/response contract with explicit provider, exact model/API version, structured-output schema, prompt version, parameters, timeout and token limits. Prepare mocked native OpenAI and Gemini adapters; Gemini's OpenAI compatibility endpoint is not proof of identical semantics, tools or structured-output behavior. Test unsupported parameters, model 404, rate limits, refusals, malformed JSON and network uncertainty. No automatic switch to a different or paid model.

Default all spending/call limits to zero. A later approved pilot requires separate global, campaign and daily dollar limits, maximum requests/tokens and concurrency, and a kill switch. Reserve worst-case request cost atomically before dispatch, including output/thinking/tool costs; unknown pricing denies dispatch. Reconcile actual usage; conservatively retain reservations for uncertain billed outcomes. Retries consume their own reservation. Provider dashboards are a secondary check, not the sole enforcement mechanism. No real-call budget is approved by this plan.

Cache by environment, immutable snapshot/manifest hash, provider/model/API version, prompt/schema/parameters and tool/input versions. Use bounded retention and never reuse a result across different issue cutoffs. Log sanitized request IDs, version hashes, timing, tokens and estimated/actual spend without credentials or private raw payloads in public logs.

Separate operational attempts/errors from immutable successful shadow forecasts. The legacy `ai_shadow` fixture-only key must not let failed calls consume success slots. Any future shadow output stays private and cannot alter public predictions. A future prospective experiment needs its own approval, preregistered cohorts and frozen configurations; do not evaluate later-collected news as evidence available for an earlier prediction. Later-issued candidates need an appropriately matched baseline and explicit issuance time. Existing exact-baseline replay limitations remain disclosed.

## 10. Remaining dependencies and limits

No hosted project, pausing, subscription or spending approval is requested. Local synthetic work is already authorized. Full private collector/function compatibility requires an approved private source bundle outside public Git; no credentials need to be pasted in chat. A representative private schema inventory would improve compatibility, but no production export is authorized or required to proceed with synthetic tests.

If image downloads fail even through the official allowed mirror, restoring full-stack capability requires an approved cloud environment network configuration or preloaded trusted images, not a paid Supabase project. Do not bypass network policy. Use isolated PostgreSQL in the meantime.

Select a private backup/alert destination only if persistent scheduling is later needed; this preparation uses local private artifacts and no messages to others. AI credentials and real API budgets remain absent and zero.

Local full-stack tests, when operational, can certify the tested versions of Auth/PostgREST/Edge and our policies; they cannot certify hosted signing-key rotation, managed role differences, hosted gateway/TLS/quotas, production schema compatibility, email delivery or real shared-compute latency. No hosted or production readiness claim follows from local success.

## 11. Evidence and completion package

Record exact commits, service/runtime versions, synthetic seeds and dataset sizes; test counts on Node 20/24; denied-access matrix; baseline/output hashes; HTTP/Edge results; query plans and latency distributions; storage/API/egress forecasts; backup/restore timings; fault/repair evidence; sanitized credential scan and protected-branch/PR-draft checks. Update the implementation report and staging runbook after implementation. Distinguish local results from hosted evidence and blocked/not-run checks. Do not describe preparation as hosted approval or production readiness.

## 12. Official references reviewed

Current public references checked during planning; recheck pricing and API behavior before implementation:

- Supabase pricing: https://supabase.com/pricing
- Free project/account and organization billing rules: https://supabase.com/docs/guides/platform/billing-faq
- Spend cap exclusions: https://supabase.com/docs/guides/platform/cost-control
- Branch usage: https://supabase.com/docs/guides/platform/manage-your-usage/branching
- Local stack: https://supabase.com/docs/guides/local-development
- Data security: https://supabase.com/docs/guides/database/secure-data
- Exposed schemas: https://supabase.com/docs/guides/api/using-custom-schemas
- Edge authentication: https://supabase.com/docs/guides/functions/auth
- Backup boundaries: https://supabase.com/docs/guides/platform/backups
- Runtime/platform changes: https://supabase.com/changelog
- Gemini compatibility: https://ai.google.dev/gemini-api/docs/openai

The Markdown changelog endpoint was attempted but unsupported by the research tool; the official HTML changelog was used instead. Public documentation research and organization metadata reads did not invoke provider inference or execute database SQL.
