# MM-05 AI prompt provenance and quota review

Current phase: local repair and synthetic verification accepted by primary on 27 November 2026; hosted rollout remains open. Hosted behavior remains unchanged. Only MatchMind is in scope.

The named production `ai-analyze` function was retrieved read-only on 26 November 2026. It remains version 17 with gateway JWT verification enabled. Its exact source SHA-256 is `f6fba8320f767a0c9eabb1cd7430d2484c70cb26ae06f746d72b1eee5ac8545b`. Raw source and catalog captures remain outside Git under the workspace's `work/mm05-evidence/` directory. No credentials, cache contents, user rows or provider calls were requested.

Primary independently reviewed the captured handler and catalog. Caller-authored `prompt` and `fxid` determine shared generation, and caches are keyed solely by fixture ID without source provenance. Quota is read and checked before provider work, then independently upserted as `used + 1`; concurrent calls can lose increments. The service role bypasses row security, so row policies do not repair either handler defect.

The accepted local plan builds shared fixture prompts from approved server facts, versions cache provenance, atomically reserves quota and shared work, records dispatch before provider work, and fences completion against stale sources and tokens. Discovery, legitimate private/manual requests, grounded parsing, configured limits and free cache hits must remain supported. A queued client request must capture its fixture target before awaiting or entering the queue.

Verification must reproduce the original defects and exercise the patched captured handler with synthetic providers plus isolated PostgreSQL concurrency tests. It must cover limit races, shared-work deduplication, free cache hits, changed inputs, stale completion, UTC rollover, failure/uncertainty, private modes and role/grant negatives. Unknown provider outcomes must not produce a free retry or an unsafe quota refund. No exactly-once external billing guarantee is assumed.

The bounded local runtime repair is accepted; this is not hosted or release acceptance. Production SQL and Edge deployment require a concrete rollout review, including old v17 requests already in flight, counter preservation, rollback and verification. No migration, provider invocation, quota reset or cache cleanup has occurred.

Next job after MM-05 assessment and its applicable gates: MM-06 server-side prediction issuance and immutable published fields. It has not started.

Primary independently reproduced the baseline using the exact captured handler, with an in-memory SDK/provider and no network. Starting at count4 with limit5, two concurrent synthetic generations succeeded while the stored count became5; counting both would yield6. Both caller-authored prompts reached the synthetic provider and produced unbound fixture-cache writes. Evidence: workspace work/mm05-primary-baseline.json and its actual-handler harness. This is before-fix evidence only, not candidate acceptance.


## Primary continuation review — 27 November 2026

Primary found and reproduced an additional SQL completion hole: missing/null/non-string text could bypass a nullable predicate. Completion now requires an object with nonblank bounded string text and bounded JSON bytes. A regression checks that malformed completion neither finalizes nor refunds dispatched work, then permits a valid completion with the same token.

Primary also corrected client quota ownership/day handling, rejection order for a wrong-fixture response, unknown usage display, and pending/retained-work flags so those known server outcomes cannot automatically trigger a second personal-key generation. The focused client suite passed14/14. The credential throttle fixture now captures only its intended long timer and has a bounded test timeout; a targeted browser check passed1/1. SQL test errors preserve stderr rather than replacing useful diagnostics with an empty error.

The exact captured v17 rebuild produces handler SHA25696ecc715aee22e4e9ec1338757d208c2547ba04a7317761216bcd9c7c8563ace. Deno2.9.5 bundling succeeds (17modules). Default strict Deno type checking fails:40diagnostics for the original capture and35for the candidate, including four new implicit callback binding types. No strict-type pass is claimed; this remains a rollout preparation limitation. The unversioned remote Supabase SDK import is inherited from v17; local synthetic tests do not prove a future hosted dependency resolution.

The broader primary run retained67passes and2failures: the SQL assertion exposed a test-error-detail issue after the runtime guard fix, and the credential file was stopped after a single-slot timer stub hung. Its account ownership and exact-app PWA cases passed. These failed/incomplete receipts are preserved. The corrected handler/PostgreSQL/client/credential acceptance run finished54/54 passed,0failed,0skipped,0cancelled (work/mm05-primary-corrected.log).

Exact-app PWA proof work/mm05-primary-pwa.json is PASS, with app SHA2569fce3822952e48394f99f5a480e28987b64f96092973a94e81bdcced7eba2c98 and unchanged normal-worker SHA256e1535f343745966a5a7adb818feba0a4216b8646a8c3cf5de097deda86104860. This is isolated desktop lifecycle evidence, not a phone or deployed MM-05 claim.


Primary acceptance: the local behavioral repair and synthetic verification are accepted on27November2026. The54test clean run exercises the actual patched captured handler and network-isolated PostgreSQL protocol plus current client and browser credential fences. The prior exact-app PWA PASS remains bound to unchanged app bytes. Earlier failures remain evidence, not waived checks. Strict-type/dependency preparation and the matched SQL/Edge/client stop/drain, rollback and hosted acceptance procedure remain open; the SQL file is a proposal only. No production/staging AI deployment, migration, quota reset, cache deletion or paid provider call occurred. Next job: MM-06 server-side prediction issuance and immutable published fields, starting with one bounded read-only agent inspection and a concrete local plan.
