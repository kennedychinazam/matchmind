# Phase 4 capture performance investigation and proposals

Historical record through `d4cb337`. The final approved limited evaluation is in `docs/PHASE4_FINAL_REPORT.md`: the narrow projection subsequently passed the paired matrix and was adopted in branch SQL. The outbox remains unimplemented. Earlier measurements and proposal status below are retained as historical context.

Status: profiling and review proposal only. No installed capture SQL, statistical engine, public publisher, collector or production resource has changed. Continue on `codex/phase3-immutable-snapshots`; keep PR #1 draft. No Supabase installation/image download, hosted SQL, Edge deployment or provider call is part of this investigation.

## Published preparation and CI

`bb37440828615ec05bb22b9a3cbf4dcf5e5e03f6` was pushed to the existing Codex branch. PR #1 remains draft and targets `feature/matchmind-quality-upgrade`.

Both push and pull-request workflows passed. The push run is https://github.com/kennedychinazam/matchmind/actions/runs/40060814249 and the PR run is https://github.com/kennedychinazam/matchmind/actions/runs/40060818104. Decoded job logs for jobs `120773697322` (Node 24.19.0) and `120773697442` (Node 20.20.2) explicitly report **101 tests, 101 passed, zero failed/cancelled/skipped**. The shell log download was blocked by the workspace's redirect-destination policy; the GitHub connector successfully read the decoded logs. No policy bypass was used.

## Reproducible measurement

Run `node audits/phase4/profile-capture.mjs /tmp/mm-profile.json`, then repeat with `/tmp/mm-profile-reverse.json reverse`. A `focused` argument selects only current/narrow-selector experiments. Require the existing pinned image locally; the script checks for it and does not install Supabase. Use the original PostgreSQL harness with network none, tmpfs and Docker-exec/Unix-socket access. It closes its container even on a failed assertion.

Corpus: 76,497 authoritative synthetic observations, including five seasons, two relevant competitions, 2,000 unrelated fixtures and 64 equivalent future target fixtures. Each variant runs in a fresh clone of the same seeded/ANALYZE'd database. Publish 54 distinct predictions in three bursts each at concurrency 1, 2, 5 and 10. The first prediction creates a new manifest; subsequent ones reuse much of the historical chunk storage. Do not call the first capture a cold host/page-cache test.

Instrument only cloned database functions, never the SQL artifacts in `audits/staging`. Record elapsed time around budget checks, evidence selection, manifest storage and the full capture; sample `pg_stat_activity` wait events and blockers. Record client time separately from server timestamps. Expand the selector's body for `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`. Profiling table writes and Docker-exec sampling add overhead to all variants.

The workspace has a two-CPU cgroup quota. The two Node 24 campaigns reverse variant order to reduce ordering bias. Each variant has only 30 ten-worker request samples: p95 and maxima are descriptive local measurements, not service-level guarantees. Absolute comparisons with the previous suite are confounded by host load, ANALYZE, target fixture metadata, cache state and instrumented transport. No representative browser-publisher runtime was measured.

Aggregate results are in `audits/phase4/results/2026-10-24-capture-profile.json`. Full synthetic raw events, selected IDs and query plans were generated outside Git in `/tmp`; the aggregate includes their hashes and exact query/latency counters. Rerunning generates new timing samples, not identical file hashes.

## Where time goes

`research.check_budget()` takes `SELECT ... FOR UPDATE` on the singleton `research.control` row. `capture_prediction()` calls it before selecting evidence, then calls it twice more before committing. The first row lock remains held for the entire publication transaction. Every concurrent capture and observation writer using that guard queues behind it. This is a deliberate admission safeguard; removing it without a replacement would weaken quota/concurrency guarantees.

Forward current-implementation measurements:

| Stage | Measurement |
| --- | --- |
| Budget checks, one worker | Median 2.4 ms summed per capture |
| Budget checks, ten workers | Median 959.5 ms summed per capture, dominated by waiting |
| Evidence selection, ten workers | Median 184.9 ms per capture |
| Reused manifest storage, ten workers | Median 14.1 ms per capture |
| First new manifest storage | 186.5 ms |
| Other exclusive capture work | Median 4.5 ms across requests |
| Total server time, ten workers | Median 1,146 ms, maximum 2,085 ms |

The exclusive remainder subtracts each request's own measured stages before aggregation. It includes validation, odds lookup, envelope construction/hash, snapshot INSERT and other capture overhead; it is not a separately instrumented snapshot INSERT. Source transaction/health overhead is outside the raw-capture wrapper. Stage medians must not be added or subtracted as if they were one request.

Wait sampling observed 149 tuple-lock and 51 transaction-ID-lock samples in the current forward campaign, versus 70 active/no-wait samples and six temporary-file I/O samples. Sampling is neither exact accumulated wait time nor a percentage of CPU. Together with budget timings and the guarded code path it identifies lock convoying, rather than manifest hashing, as the dominant concurrency issue.

The original unchanged standalone concurrency regression was also rerun: approximately 495/724/1,849/3,585 ms maximum client time at 1/2/5/10 workers. All 19 source/snapshot pairs were present, duplicate insert races converged and backlog was empty. This did not reproduce the earlier six-second maximum on an otherwise quiet workspace. Do not claim the difference is a measured code improvement: that test's code was unchanged.

## Comparative experiments

The proposed selector change is confined to cloned databases: replace the `latest` materialized CTE's `o.*` projection with `o.fixture_id,o.field_name,o.value,o.observation_id`. All eligibility predicates, DISTINCT ON ordering, dependency windows, target history, chunking, hashing and publication/capture control flow stay intact. Filtering can still read the original observation columns without retaining all of them in the materialized result.

Forward campaign:

| Variant | Ten-worker server median / max | Ten-worker client max | Selector temp write blocks |
| --- | --- | --- | --- |
| Current | 1,146 / 2,085 ms | 2,594 ms | 4,381 |
| JIT off | 1,132 / 2,028 ms | 2,454 ms | 4,381 |
| JIT off + 64 MB work_mem | 1,130 / 2,039 ms | 2,514 ms | 0 |
| Proposed narrow projection | 871 / 1,627 ms | 2,174 ms | 462 |

Reverse campaign current versus narrow: server median/max **1,194/2,067 ms** versus **901/1,639 ms**; client maximum **2,592 ms** versus **2,111 ms**. The narrow projection reduces server maximum by about 21–22% in both orders. In the forward campaign, selector median falls from about 178 ms to 143 ms across single-worker bursts. Temporary writes fall about 89%; one PostgreSQL block is 8 KiB.

Every variant produced 54 source predictions, 54 snapshots, 10,828 evidence references for the checked target and zero backlog. The checked target's complete ordered evidence IDs and full M14 feature vector were identical between variants. Research table/index allocation after 54 predictions was about 87.7 MB in each variant, differing by only a few allocated pages; this optimization changes transient query work, not evidence retention. A focused Node 20 run additionally compares the hash of all 54 ordered manifest roots, as recorded in the result artifact.

Recommendation: review the narrow projection as the first small implementation candidate, with the full eligibility/Unicode/correction/manifest/permission/repair suites and more alternating mixed-team bursts before adoption. Require no material regression on representative mixtures, not only improved repeat-pair maxima. It reduces the work performed while the admission lock is held, and changes no model inputs. The benchmark already tests this projection in isolation; it has not been applied to branch SQL.

A separate **mixed-team/two-competition workload** publishes 18 different targets in one burst each at 1/2/5/10 workers (`focused diverse`). It is more representative of new manifest creation than repeated Arsenal/Liverpool targets. All 18 ordered manifest roots match between variants, the checked full feature vector matches, and both have zero backlog. Current versus narrow maximum server time is **2,566 versus 2,292 ms**; client maximum is **3,033 versus 2,742 ms**. However, ten-worker server median is **1,340 versus 1,447.5 ms**, an approximately 8% regression in this small single burst. Do not present the projection as a universal throughput win. More repeated/alternating diverse batches are an implementation acceptance gate.

This workload also exposes the cost of weaker chunk reuse: median manifest storage is about **117 ms current / 110 ms narrow**, versus approximately 14 ms in the repeat-pair workload. Research allocation reaches about **128.2 MB for 18 diverse captures**, compared with approximately 87.7 MB for 54 repeat-pair captures, including the common archive baseline. Capacity forecasts must account for team/league diversity and content-addressed reuse, not multiply one favorable subsequent-capture size by the daily prediction count.

Do not adopt a blanket JIT or memory change from these results. EXPLAIN reports no JIT activity for this query; disabling it has no demonstrated benefit. Larger work_mem removes spills but does not meaningfully improve the serialized burst; its memory cost can multiply across query nodes/connections. Leave the admission lock in place for this first optimization.

Also evaluate routine ANALYZE after substantial staging loads and bounded capture-worker concurrency. The current experiments explicitly use fresh statistics; they do not quantify the isolated effect of ANALYZE. Pacing capture calls can reduce per-request queue depth but does not remove the serialized service-time throughput limit. Do not claim a six-to-two-second model/engine speedup.

## Durable asynchronous architecture — design proposal, not implemented

A potentially larger improvement separates a cheap immutable publication receipt from expensive research enrichment. It needs a new reviewed contract; moving work to a fire-and-forget Edge call or rereading mutable source rows later is insufficient.

1. In the actual winning source INSERT transaction, freeze NEW's original output/issue/build/kickoff payload, source hash, selection/code version, authoritative enqueue time and stable idempotency key in a private immutable publication receipt. Create a durable job reference atomically. ON CONFLICT losers create neither receipts nor competing jobs.
2. Freeze evidence membership/visibility at publication. A future worker must not include an observation merely because it carries a pre-issue timestamp if it was not committed/available at publication. Use a reviewed collector-finalization ledger/commit visibility watermark with a brief shared ordering boundary, plus existing server receipt, effective/played-time rules. A sequence alone is not a commit-order watermark. The current archive lacks this new ledger: original issuance-time membership cannot simply be invented later.
3. Workers claim private mutable jobs with bounded concurrency, leases and `FOR UPDATE SKIP LOCKED`. They read immutable receipts and the frozen eligible observation view, never mutable live fixtures. Jobs track pending/running/completed/retry/manual-review states without overwriting receipts/evidence.
4. Use idempotent snapshot/manifest writes and atomic completion. Crash after write/before acknowledgement must converge to the existing snapshot. Preserve full history and explicit manifest ceilings; never shorten evidence to fit a deadline.
5. Preserve distinct original issuance/receipt and enrichment-completion times. A late worker must not masquerade as the old ten-second `at_issue` trigger capture, nor turn repairs/backfills into original evidence. Existing Phase 3 snapshots remain unchanged; exact original baseline replay stays ineligible without its input/configuration manifest.
6. Reconcile source-to-receipt, receipt-to-job and job-to-snapshot independently, with an external scheduler heartbeat. Operators can repair failures without republishing predictions; ordinary application identities cannot read the queue or research data.
7. Replace long quota locking only with a tested admission-reservation/finalization design, accounting for parallel writes, chunk deduplication, rollback, physical headroom and recovery. Admission is still not a hard disk/WAL/billing cap.

There is an unavoidable failure-policy decision: a receipt/job written atomically with publication cannot both be guaranteed durable and be optional when that write itself fails. Failing publication gives atomic durability; allowing publication requires reconciliation and an explicit unavailable-provenance state if no original receipt was saved. The existing requirement prefers successful original publication. Therefore retain that behavior, surface missing receipts, and **do not promise exact historical reconstruction after a failed receipt write**. Escalate the guarantee tradeoff before implementing the queue.

No asynchronous prototype or latency claim is presented as validated. Its acceptance work must cover winner races, collector commits straddling issuance, backdated/late evidence, worker death/lease expiry, duplicate/out-of-order jobs, permission/storage/monitor failures, timeout-after-commit, immutable receipt guards, paged reconciliation and restore. Measure original-publication commit latency separately from time-to-complete-snapshot and enforce an approved backlog-age bound. The <=5% representative publisher-overhead requirement remains unverified.

## Remaining platform and AI gates

A future adequately resourced local service environment must verify real Auth-issued JWTs, wrong issuer/audience/signature/expiry, capability revocation, user-metadata forgery, RLS across actual identities, restricted PostgREST schema/RPC exposure, schema-cache refresh, API-key versus JWT headers, and Edge-runtime authorization/cancellation/pooling behavior. Hosted signing-key rotation, gateway/TLS/quotas, managed-role differences, email delivery and shared-compute behavior still require a separately approved compatible environment. No hosted project or full-stack installation is authorized now.

Keep AI disabled and provider credentials absent. Future private AI shadow execution uses immutable snapshot/manifest and issue-cutoff hashes, exact provider/model/API/prompt/schema versions, provider-specific compatibility mocks, cache isolation and separate operational attempts versus valid immutable outputs. Default budget/call limits are zero; require atomic worst-case spend reservations, bounded retries, explicit pricing, reconciliation and a kill switch before any later approved requests. Never let later-collected news count as evidence for an earlier issue, contaminate public outputs or activate a new model automatically.

## Review decision requested next

Review the narrow-projection optimization first. Keep the asynchronous receipt/visibility-ledger/worker design as a separate architecture proposal with explicit durability semantics and migration/rollback review. Until then, installed capture SQL and public behavior remain unchanged. Rollback of profiling is simply container teardown and removal of synthetic artifacts; no database migration has been applied outside disposable clones.
