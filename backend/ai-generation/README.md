# MM-05 AI generation candidate — local review only

This candidate is not deployed. It changes neither model calibration, issued predictions, settlement, nor `AI_CONTEXT_ON`. No real provider calls are part of its tests.

## Baseline and artifacts

The private captured `ai-analyze` v17 source must have exact SHA-256 `f6fba8320f767a0c9eabb1cd7430d2484c70cb26ae06f746d72b1eee5ac8545b`. Gateway JWT verification stays enabled. `build-candidate.mjs` refuses any other baseline and applies `ai-analyze-v17-security.patch` with exact context/count checks. It emits the private candidate and hash outside Git; the raw captured function remains outside Git.

The deployed provider definitions, environment-driven provider discovery and grounded context parser remain in the original handler. `provider-fetch.mjs` preserves the finite model-404 and rate-limit retry behavior, adds a 45-second request deadline and bounds returned text. Transport uncertainty is not retried. Raw provider responses, prompts, credentials and exception strings are not logged.

The deployable bundle needs the patched `index.ts`, `backend/ai-generation/{generation-contract,generation-service,provider-fetch}.mjs` and existing `backend/fixture-delivery/fixture-cache-guard.mjs`, with that relative directory layout. It uses existing environment bindings; the optional raw-principal private-fixture path additionally uses Supabase's existing anonymous/publishable key binding. No key values belong in source or the review packet.

## Shared versus private requests

Shared fixture prompts are built only from approved server facts. SQL uses the current public display RPCs and one bounded public history page. Its ID lookup reads only a fixture's date to locate that existing page; the public history RPC decides what is returned. The currently inspected history implementation keys by current `fixtures.date`, while the returned prediction retains its original `kickoff`. Neither is replaced. Invalid/missing/mixed/expired envelope metadata fails before allocation or provider work.

The public display/history wrappers are security invokers. Catalog inspection found that the service role can execute those wrappers but lacks execution on their inner approved projection functions. The SQL proposal therefore captures the original ACLs and grants only `mm_fixture_delivery.display(text)` and `mm_fixture_delivery.history(date,bigint)` execution to the service role. It grants no new anonymous/authenticated access and changes no raw-read policy. The integration fixture models and verifies this actual two-layer ACL chain; BYPASSRLS alone is insufficient.

The closed source contract rejects extra fields, invalid IDs/calendars/times and malformed probability metadata. No raw provider blobs, injury fields, arbitrary client prose or earlier AI write-up become shared grounding. A semantic source hash includes the original stored facts; volatile edition capture timestamps are audit metadata, not reasons to regenerate identical analysis every five minutes. Cache identity also includes mode, effective provider and prompt version. Provider comparison therefore remains distinct. Template changes require a new prompt version.

The prompt and API provenance distinguish issued, issued-withdrawn, reconstructed, informational and no-pick inputs. Build -1 and absent issuance are never upgraded to an original published claim. Actual stored values remain intact. The shared UI caption says “verified fixture data”; private/legacy engine-input paths retain their existing description.

Provider discovery remains free and reports the verified caller's own current UTC-day usage. Nonfixture/manual/basketball prompts remain unshared. A currently approved raw principal can retain a private, unshared fixture prompt when the healthy public projection confirms it is not shared; ordinary callers cannot use that fallback. Membership uncertainty does not become a private fallback. Private prompts/results are not persisted in shared cache state. Legacy `match_analysis` and `match_context` rows are ignored by this candidate and are not deleted or rewritten.

## Quota and work lifecycle

The existing positive configured daily ceiling is preserved. A transaction locks the usage row and serializes a work key. Admission allocates a daily request slot before provider dispatch. The physical `ai_usage.count` only increases; confirmed pre-dispatch refunds are a separate private credit, so old upserts cannot lower the new counter. Effective `used` is physical count minus verified credits. An allocation retained after dispatch/uncertainty remains used even if no usable report returns. UI counters merge errors under the existing account fence, ignore other UTC days and describe request slots rather than claiming every allocation is a successful analysis.

Concurrent equivalent shared requests have one provider owner. Others receive busy or a free validated cache hit. Cache hits do not consume a new slot, including at the daily ceiling. New quota-denied private hashes do not create work rows. Analysis/context expiry remains 12/6 hours; known-complete expired work can obtain a new charged allocation.

The handler durably marks dispatch before any provider request. A reserved lease expires after two minutes. If it was never marked dispatched, a service-only recovery transaction retires the old token and refunds exactly once. Cross-owner and previous-day recovery happen in their own transaction, preserving lock order; the handler makes one bounded prepare retry. Deleted-owner pre-dispatch work can retire without recreating that user or usage.

Dispatched/uncertain work is never silently refunded or reissued on lease expiry. It may complete with its original token if source and ownership are still valid. After at least 15 minutes, an operator can explicitly authorize another **charged** attempt using the service-only reconciliation routine below. That action fences the old token, retains its allocation and records a resolution ID/note. The handler never invokes it automatically. It does not prove the earlier external call was unbilled or stopped: another attempt may incur another provider charge. Exactly-once external billing is not claimed.

Completion checks owner/token/state and current semantic source. It cannot overwrite another source/version key, accept a stale token or resurrect a deleted account. Shared cache text/context is validated before storage and again before reuse. An unconfirmed completion retains the allocation; it never falls back to another paid generation.

## Local verification

`node --test test/ai-generation.test.mjs test/ai-generation-client.test.mjs`

The test requires the exact private v17 capture (`MM_AI_V17_SOURCE` can name it), Node 24 and the configured Docker CLI context. It executes the actual patched v17 handler with a synthetic SDK/provider and real PostgreSQL transactions in its own pinned Postgres 16.6 container with `--network none`. Host fetch is forbidden. Only that test's container is removed. It covers quota/deduplication races, discovery/private/compare/context modes, cache lifetime/provenance, source changes, stale completion, refunds under a reduced limit, cross-user/deleted-owner/day recovery, denied-hash storage growth, explicit funded retry, permissions, and client account/day/target fences.

The primary's before-proof receipt `work/mm05-primary-baseline.json` records two successful synthetic v17 provider calls starting at used 4/limit 5 with only used 5 persisted, and caller-controlled content reaching both unbound fixture writes. The primary also preserved a before-proof of repeated expired-token refunds under a reduced ceiling. These are synthetic reproductions, not production exploitation evidence.

## Hosted rollout is a separate gate

Do not install `PROPOSAL-up.sql` or publish the Edge patch from this local review. Obtain owner authorization for a concrete matched SQL/Edge/client rollout after primary assessment. Installation must preflight current versions, schema, grants, existing usage validity, required source RPC contracts and the exact baseline. It aborts if the protocol schema already exists. No usage reset or existing-cache cleanup is proposed.

Before installing/admitting the new handler, stop or isolate incoming v17 generation and establish evidence that old provider work and database writes are drained. Old v17 has no reservation protocol and no provider timeout, so publishing another version alone is not drain evidence. Its in-flight calls can otherwise complete after cutover. The monotonic trigger prevents decreases but cannot discover/count legacy calls already sent or prevent an equal stale write from losing their increment. Keep generation unavailable until that cutover is safe; do not infer completion merely from a deploy response or a quiet browser.

Rehearse on a disposable nonproduction setup with synthetic users/providers. Test rollback/maintenance and client compatibility before any production SQL/Edge action. Existing captured payloads and original usage remain intact. Production provider invocation and physical-phone acceptance require their own evidence.

## Explicit reconciliation proposal (never automatic)

After separately authorized operator review of one uncertain work item and at least the 15-minute cooldown, use `mm_ai_authorize_retry_v1(work_key, lease_token, resolution_id, note)`. Obtain its key/token from permitted private operational evidence; never expose them to clients. Supply a unique resolution UUID and a bounded nonsecret reason acknowledging another potentially paid attempt. The routine grants no quota credit and does not execute a provider request. A later normal request must pass its own daily admission again. Do not reuse this mechanism for credential rotation, cache cleanup, account erasure or a quota reset.

See `ROLLBACK.md` for the fail-closed recovery limit.
