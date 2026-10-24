# Phase 4 local preparation report

## Scope and decision

Prepared in Codex Cloud on `codex/phase3-immutable-snapshots`, based on approved `88f3e08`. The user has two active Free projects and declines pausing, subscriptions and paid resources. Hosted staging is excluded. PR #1 remains open/draft targeting `feature/matchmind-quality-upgrade`; no PR deployment, merge or production change occurred.

## Local stack investigation

- Docker 28.4.0 works via the local Unix socket. Node 24.19.0 is installed; Node 20.20.2 is available for regression comparisons.
- Supabase CLI 2.122.0 installed in private scratch `/workspace/matchmind-tools/phase4`; no login/link, production credentials or hosted commands used. Telemetry disabled. Generated configuration/logs are outside the public repository.
- The default ECR image endpoint returned Forbidden. CLI source confirms GHCR as its official fallback; selecting it through the supported registry override successfully downloaded images through the existing proxy/TLS checks.
- Full CLI startup did not complete: Docker-vfs image extraction consumed nearly all of a 32 GB filesystem. A reduced core-services trial also approached exhaustion. Both attempts were terminated, no Supabase service stack started, and specifically downloaded trial images/the unused internal network were removed. About 25 GiB free disk was restored; the original pinned PostgreSQL image was retained. No broad Docker prune, daemon/storage-driver change or network-policy bypass was used.
- This is a workspace disk/storage-driver limitation, not evidence that local Supabase requires a subscription. A larger Codex filesystem or platform-provided efficient Docker backend may resolve it. Do not retry unchanged downloads or change the active daemon yourself.

## Changes

- `audits/phase4/local-transport.mjs`: test-only loopback origin/path validation, fixed method/options, ten-second timeout and redirect refusal. No hosted target or arbitrary fetch dispatcher accepted.
- `audits/test/phase4-isolation.test.mjs`: proves local requests work and rejects remote targets, embedded credentials, alternate hosts, unsafe paths and remote redirects. Written and observed failing before the transport implementation.
- `audits/test/phase4-concurrency.integration.test.mjs`: verifies no-network/no-port container isolation; seeds realistic multi-season evidence; captures at concurrency 1/2/5/10; races five identical fixture inserts; verifies 19 unique source/snapshot pairs, original probabilities/build, empty backlog and stable repaired hash. Emits latency/storage measurements.
- `audits/phase4/verify-stack.mjs`: explicit opt-in local service characterization scaffold. Rejects linked projects, requires the internal network/loopback bindings, then would exercise synthetic Auth/JWT/PostgREST/RLS/RPC. It was run and failed at the missing-stack gate as intended. Downstream service assertions remain unexecuted and are not acceptance evidence.
- `audits/phase4/README.md`: exact investigation versions/commands, isolation and cleanup rules, resource bounds and deferred checks.
- `docs/superpowers/plans/2026-10-24-phase4-isolated-supabase-staging.md`: revised local-only architecture, permissions, private source handling, performance profiles, recovery and zero-spend AI preparation.

No application, statistical engine, Smart Bet, production publisher, existing SQL artifact, model calculation or public UI file was changed. New public files contain only our synthetic test infrastructure; no private collector/function source was imported.

## Database, performance and storage evidence

The fallback remains the original pinned PostgreSQL 17 harness: network none, no exposed ports, temporary storage, synthetic rows only. It does not use Supabase project quota.

The new concurrency workload uses 51,857 observations. A standalone run recorded maximum request times of 923/1,568/3,418/3,440 ms at concurrency 1/2/5/10 and 2,449,408 bytes research growth for 19 predictions. A complete Node 20 run recorded 549/923/2,263/4,349 ms and 2,433,024 bytes. These runs overlapped image extraction and/or regression activity: they establish correctness under contention, not clean throughput, production performance or the <=5% publisher-overhead gate.

Existing scaling coverage independently checks the entire M14 feature vector with 51,866 observations, 10,444 selected references and 21 chunks, then 24,000 unrelated fields. First-manifest allocation remains 4,988,928 bytes; subsequent shared-history capture adds 212,992 bytes. Latest exact run values are recorded below after verification. These are local allocation figures, not a validated monthly storage or Supabase billing estimate.

Prepared future profiles include larger local archives, explicit manifest ceilings, correction/unchanged polling at 60-second and 15-second synthetic cadence, collection/capture overlap, cold versus shared manifests, paired publisher baselines and storage/index/transfer accounting. One-million-observation soak and representative browser-publisher overhead are not yet executed. Do not infer them from the 19-prediction regression.

## Security and production preservation

The PostgreSQL test process cannot route to production from its no-network container. The loopback transport rejects hosted requests before fetch and refuses redirects. The attempted service stack used an internal Docker network with default loopback binding; no services reached the HTTP-testing stage. Docker/workspace administrators remain trusted and can override test isolation deliberately. The workspace's general outbound policy itself still allows the production hostname; that policy is not claimed to be a production firewall for arbitrary host processes.

Remote branch verification preserved: main and Build 355 backup at `036f09b29f27a10c7d8bdcec1f16efd557c714e4`, original feature at `68c00ded8043b7ee1a15937db1a32c01d932f4e7`, Codex remote at `88f3e084a725d8c17d7624d4edc392bc02032a7d`. PR #1 draft/base verified read-only. No source pushes were needed for preparation.

## Publisher, collector and AI limits

The production robot has hardcoded production settings: do not execute it, including dry-run. Its orchestration and saved-output behavior can be tested through existing injected local callbacks; real browser/backend transport needs a separate isolated harness. The collector adapter accepts synthetic held responses without provider requests. Full private collector/Edge compatibility needs an approved private source bundle outside public Git and working local services. Do not copy credentials or private code into this repository.

AI remains disabled. The plan specifies versioned native/compatible provider contracts, mocked errors, immutable-input cache keys, separate attempt/success records, zero-default spend limits, atomic worst-case reservations and future prospective shadow evaluation. No provider/model was activated, no new model introduced and no inference call made. Paid or free provider calls are not part of this preparation.

## Recovery and operational limits

Existing automated tests verify durable capture failures, private backlog/repair, permission/quota errors, failed health logging, backup/restore equality and preserved ACLs. Research rollback remains `audits/staging/rollback.sql` executed only within a disposable database. It disables capture/writers without deleting archived evidence or rewriting originals. Container teardown removes synthetic state.

Keep any persistent dump encrypted outside Git; private source/configuration and secret recovery are separate. No persistent external alert scheduler or offsite backup service was provisioned. Monitoring job survival, paused hosted projects, hosted recovery time and hosted platform authentication behavior remain unverified.

## Verification results

Final test results are appended after both complete runtime runs. The explicit service probe is blocked by absent infrastructure; it is not silently skipped or counted among passing database tests.

Final complete regressions:

| Runtime | Command | Result |
| --- | --- | --- |
| Node 20.20.2 | `npm exec --yes --package=node@20.20.2 -- node --test audits/test/*.test.mjs` | 101 passed, 0 failed, 0 skipped; 85.39 s |
| Node 24.19.0 | `node --test audits/test/*.test.mjs` | 101 passed, 0 failed, 0 skipped; 109.42 s |

Node 24 scaling: 603 ms first capture; 637 ms after unrelated archive growth to 75,876 observations. First-manifest growth 4,988,928 bytes; next capture 212,992 bytes. Node 24 concurrency maximum request latency: 854/1,545/3,449/6,046 ms at 1/2/5/10 workers. This includes queue wait, Docker-exec transport and other regression activity. The ten-worker result makes admission serialization a material performance limitation; it is not a demonstrated publisher-runtime acceptance pass.

All 99 existing tests plus two new regressions passed on both runtimes. The service probe separately failed at its absent-stack assertion: Auth/JWT/PostgREST/Edge behavior was not executed and remains blocked. JavaScript syntax checks passed. Seven new files were scanned for private keys, secret tokens, JWT literals and credential-bearing database URLs, with zero pattern matches; generated CLI logs/configuration were not staged. No private backend source or production credentials were supplied. All disposable PostgreSQL test containers were removed after verification.

## Follow-on profiling and remote verification

Preparation commit `bb37440` is now pushed; PR #1 remains draft. Its Node 20.20.2 and 24.19.0 remote CI logs explicitly show 101/101 tests with zero failures/skips. See `docs/PHASE4_CAPTURE_PERFORMANCE_REVIEW.md` and the aggregate benchmark artifact for run links, global admission-lock timing, full-history selector/manifest profiles, two-order comparative experiments, focused Node 20 verification, and the separate durable-asynchronous design proposal. No capture SQL or architecture change was installed. Narrowing a materialized selector projection improved the synthetic ten-worker maximum server time by approximately 21–22% in the Node 24 campaigns while preserving the checked evidence/features; all 54 manifest roots match in the focused Node 20 comparison. The old standalone test peaked at 3.59 seconds when rerun alone, so the previous six-second maximum is not a stable service-time estimate. Hosted/service and representative publisher-overhead gates remain open.
