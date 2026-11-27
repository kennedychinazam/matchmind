## Current checkpoint v12 - MM-08 local proposals accepted, 27 November 2026

MM-08's local diagnostics/deadline/monitoring proposals are accepted after primary code assessment and independent review. Final primary runs:27/27focusedNode checks,14/14realPostgreSQL diagnostics checks and2/2actualpinnedSDK checks with inert transports. These are separate runs; prior packets and failing fixture/baseline evidence remain preserved. New runtime helpers pass strict checkJS; exact candidate bundles14modules with a frozen SDK2.119.2 lock. The original minified collector still has248strict TypeScript errors: baseline/candidate diagnostic messages and multiplicities are identical, with no suppression. Strict typing remains a release gate.

Exact production/staging validator definitions were captured read-only and separately fingerprinted. The boolean validators remain byte-identical and authoritative. A private invoker sidecar supplies bounded field-path/reason/source-and-payload hashes in materializer MMV01 DETAIL, without raw rejected values, payload retention, new public access or relaxed limits. Actual materializer tests prove generic-before versus detailed-after rejection and rollback preservation. Production's misleading limit wording is corrected to its existing3000cards/4MiB; staging preserves its distinct contract. The historical rejected field remains unknown.

The actual hostedv58 collector pins release/collector-budget/refresh-af-v58-af47.ts at production commit2b42b1a. The local af-48 candidate adds proposed12-second provider/database transport deadlines covering headers and body, preserving existing stages, windows and explicit provider429 read retries. Timeout requests abort but never proves remote cancellation/rollback; the helper and pinnedSDK timeout tests do not replay reads/writes. This is not a hard total-invocation budget. The deployed collector does not use the old local post-write publication helper; display publication is a separate cron SQL job.

Monitoring keeps edition freshness, SQL enqueue and correlated downstream HTTP/application completion separate. At15:01:08UTC, read-only production metadata showed288displaySQLruns/0failures and144collectorSQLruns/0failures in24hours, newest edition14:58UTC. Collector HTTP completion remains explicitly unverified without an exact request ID. Project-wide HTTP aggregates and basic log-source counts are not collector completion proof. HTTP200 with application/write warnings remains partial. No current outage or historical root cause is claimed.

OPEN: matched SQL/Edge rollout and exact fresh fingerprints; staged timing and disposable-data acceptance; strict collector/MM05typing; exact downstream request-ID capture; approved private outer sink for safe MMV01 DETAIL and operational retention/alerts; hosted DETAIL preservation; all prior physical-phone, personal legacy, session and capacity/billing/retention gates. A failing materialize transaction cannot durably journal itself. No SQL installation, provider call, collector invocation, push delivery, personal-data clearing or deployment occurred. Production and preview remain unchanged; EDUVANTA was not accessed.

Next local job: MM-09 public edition/record loading, truthful empty/stale/retry states, per-resource hydration and foreground/network recovery. Its agent has begun bounded read-only inspection after MM-08 primary acceptance; no MM-09 repair is accepted. See MM08-DIAGNOSTICS-REVIEW.md and backend/collector-observability/README.md. Original MM-01–MM-29 ordering and subsequent findings remain intact.

# MM-08 inspection started - 27 November 2026

MM-07 local lifecycle checkpoint was accepted, committed and pushed as 85a15cca5c2b9d24b33f6bc0e0231267d365dc6b. Its immutable v11 packet and release gates remain in place. MM-08 is now active for bounded inspection; no MM-08 repair has been accepted or deployed. MM-09 has not started.

## Confirmed current source observations

A read-only pg_proc query fetched exactly schema_valid, payload_valid and materialize from the two named MatchMind projects, production toqfdrcjzwnlydqekude and staging rdcbnvfnxenrpnnwxszs. No personal rows, cron command text, secrets or rejected payloads were read. Raw responses and exact extracted definitions remain in workspace work/mm08-evidence.

Production materialize enforces 3000 cards and 4194304 bytes, but its bound-error wording still reports 1500 cards and 2 MiB. Its nested payload failure remains the generic Incomplete or unsupported presentation inventory, with only counts/bytes. Both schema_valid and payload_valid collapse caught exceptions to false, leaving the failed field/reason unavailable to callers. Production payload schema has cards/odds max3000, leans max1500; these are separate existing bounds and are not being raised. Staging has a distinct materializer and schema (including competitions); production SQL must not be copied blindly into it.

The historical 28 failures and 145-minute successful-edition gap are handover observations, not a current outage measurement. Their exact rejected payload/field was not retained in the supplied evidence. The present routine definitions do not establish which field failed historically. Do not invent a root cause or weaken validation to get a successful refresh.

Local refresh-presentation.mjs performs one post-write RPC, caps response cards at1500 and returns only unavailable on error; it has no explicit request deadline in that helper. This is an inspection of local proposal code, not proof that the current production Edge handler uses the same helper. Exact live collector/scheduler/downstream paths and safe status metadata are the next inspection step.

## Next bounded work and acceptance

1. Inspect named collector/refresh source and bounded operational status metadata; distinguish cron enqueue from actual downstream completion. Exclude credentials, user records and raw response bodies.
2. Build private field-path/reason diagnostics against the exact existing validator contract. Differential-test valid/invalid nested schema and relational constraints in isolated PostgreSQL; preserve every current acceptance/rejection and resource bound.
3. Propose rejected-attempt provenance using bounded metadata/hashes and validator/source versions. Do not start retaining raw provider payloads or create new retention rights. Consider transaction rollback explicitly: a journal written inside the failing materialize transaction would not survive its raised exception.
4. Add bounded request deadlines and truthful completion monitoring to the actual matched call path. A timeout cannot imply cancellation or replay an already committed source write. Test stalled/malformed/downstream failures without real provider calls.
5. Primary reviews code, before/after tests and operational wording before local acceptance. Hosted SQL/Edge rollout, rejected-data retention policy and alert delivery remain separate review gates. Then MM-09 follows in the original hierarchy.

Only MatchMind is in scope. No hosted writes, provider calls, authentication attempts, deletion, push delivery, data clearing or limit increases occurred during this inspection. Three prior agents exhausted usage; no retry loop was started. Primary continues the next bounded job directly.

production exact definition SHA-256:

- materialize: fa9281e283bce95c5ad911576ebedaf884da8f284881ab3e2334380bd81c7ffd
- payload_valid: cea48e3650c733d376ec614647014d7275d7e82678d86ae81ab17bf52ddc4b4c
- schema_valid: a71ea2ef1995e9ae582939d9d18f9d5f07c69a36097ac15e53e818a2410f3bf0

staging exact definition SHA-256:

- materialize: cf6d776b44baa938c3ec847c5d35c8f4fe8e1e6cdf74f6a19a20d9e8f22c5c61
- payload_valid: 31028fb378d5d2428992a75eda6776d3f4bda1176d9e4e91826cf77b426e67dc
- schema_valid: 933c26fbcb6c2e3d906c93c48e310ddd58527445d231036eca14de74fc4b109a
