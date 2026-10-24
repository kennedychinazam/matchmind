# Phase 8 secure continuation — supervised handoff

This layer starts at Phase8 `9312a06` on `codex/phase8-openrouter-continuation`. Read [REPORT.md](REPORT.md) and [NEXT_CLOUD_TASK.md](NEXT_CLOUD_TASK.md). It does not deploy anything. Private forecast data, packets, SQL dumps, detailed football reports and credentials stay outside Git.

## Actual status

The owner confirmed downloading the complete Saturday archive and checksum and verifying them externally. A fresh local extraction and three-checkpoint restore verified145 unchanged E-Refreshed forecasts,725 original arm slots,93,680 source rows, engine-output/input parity, private grants and zero retained AI liability. The fourth, emergency dump was independently restored and matched the original immutable event set with zero liability. Its only text difference from the first dump is the randomized psql restriction marker. Unclassified/newer auxiliary records block continuation.

This task initially reported environment revision133 and subsequently136 and139. Both still reference the same old source configuration version and expose no secret binding or OpenRouter host. A metadata-only preflight stopped **before HTTP**. No authenticated OpenRouter request, paid inference, Sunday refresh or Monday evaluation has executed in this continuation. Actual new AI expenditure is **$0**. The public model catalog is evidence of advertised availability, not account authorization or tested inference compatibility.

## Restore securely

Use only a private task attachment or an owner-approved private transfer. Do not commit archives, put plaintext in public artifacts, paste credentials or grant unrestricted networking. If the next task has no private transfer capability, stop and report that blocker.

```sh
# New absolute directory outside the repository; input files remain untouched.
node audits/phase8-continuation/recovery.mjs \
  /private/matchmind-phase8-private-saturday.tgz \
  /private/matchmind-phase8-private-saturday.sha256 \
  /private/new-restored-saturday
```

The recovery tool checks the outer SHA256, member paths/types/count/size before extraction, exclusive0600 files and0700 directories. It restores each known checkpoint into cached pinned PostgreSQL17 containers with `--network none`, no published ports and no host data mount. SQL body hashes, unchanged event hashes/parents/receipts, increasing ledger liability, source packet, frozen engine output, permissions and250MiB quota must pass. It neither reissues forecasts nor upgrades historical timestamp provenance. Preserve all previous reports and the explicit selected latest backup:

`private-weekend-backup-20261024181506357312.sql` with `backup-20261024181506357312.sha256`.

Recovery verification is read-only. For a new supervised writable COPY, create the known NOLOGIN roles listed in `recovery.mjs`, restore that verified dump into an **empty isolated database**, and call `refreshWriter(db)` from `local.mjs`. This replaces only the reviewed local weekend writer/grants with the post-commit/kickoff guards at9312a06; it does not recreate tables or rewrite Saturday rows. Never apply it to hosted Supabase. The original dump predates those writer fixes; its already-reviewed Saturday batch witness is retained, not relabelled as a new confirmation.

## Runtime and metadata preflight

The cloud-environment status tool must be called in the new task. Save its non-secret `structuredContent` as `{checked_at_utc: actual_current_UTC, runtime: structuredContent}` in a private JSON file. Never synthesize a ready state from the owner's configuration claim. Require current observations, matching observed/desired revisions, enforced **restricted** networking including `openrouter.ai`, and the individual `OPENROUTER_API_KEY` binding in state`ready`. The code expects the safe binding fields `name` and `state`; verify the actual published metadata shape before activation. A proxy placeholder is passed normally to curl, never inspected/fingerprinted as the real credential. Do not change proxy/CA settings.

```sh
# Read-only metadata; never a completion, even if ready.
node audits/phase8-continuation/preflight-cli.mjs \
  /private/current-runtime-proof.json /private/new-preflight-output
```

The preflight admits only fixed key/credit/model GET routes. Its private output records safe failure categories, not response bodies or secrets. A denied credits route is a blocker; do not replace the experimental key with a management key. `verifyAccount` requires a finite non-resetting lifetime key cap<=US$5, nonmanagement/nonprovisioning paid access, BYOK included in the cap with no prior BYOK use, coherent usage/remaining values, unexpired access and a verified current credit balance. These account conditions have **not** been verified here. No key or account settings are changed by this code.

Profiles pin only `openai/gpt-6-luna` through the standard`openai` backend and `moonshotai/kimi-k2.5` through`novita`. Fresh profiles must advertise healthy structured-output, max-token and tool-choice-none support. Price changes above the explicit caps, missing components or unknown fees block. No automatic model/backend fallback, online suffix, browser/search plugin or billable tool is enabled. Current rate-limit permission/429 behavior still requires the first authenticated session.

## Supervised Sunday entry

`runSunday(options)` in `supervised.mjs` is the tested programmatic orchestration entry. It is **not an installed scheduler or an already-activated paid launcher**. The supervising agent must assemble and verify the local database and private files; no production process is invoked. The next task should use this entry after completing the gates below, rather than invent a second prediction engine.

1. Reverify archive/ancestry, owner retention and absence of unknown/in-flight earlier paid attempts. Start one approved supervised process; never parallelize separate restored database copies against the same key. A stale archive is not a new budget.
2. Verify actual UTC date October25. Collect a new complete packet using the existing read-only `audits/phase8/collect-source.mjs`; the source read must be within15minutes of admission. Engine-only operation needs no AI secret. The source exporter is not the production publisher or API-Football collector.
3. Restore the selected local copy, refresh only its local writer, obtain `weekendStore(db)`, and make `checkpointWriter(db,store,newPrivateDirectory,verifiedParentDumpSHA)` the checkpoint callback. It writes full exclusive dumps/checksums/metadata, fsyncs files/directories and chains each new dump to its predecessor. Check free physical disk before starting; retain every generation.
4. For paid mode only, construct `openrouterClient(freshRuntimeProof)` and use `providerPreflight(client,()=>store.clock())` before each request. Set `kind:'football'`, `supervised:true`, `recoveryVerified:true`, `externalCopyVerified:true`, `paid:true` only after the corresponding evidence actually passes. Pass the new source, store, client, preflight and checkpoint to `runSunday`. For engine-only mode use `paid:false`; absent AI arms remain visible failures.
5. Real execution always calls the exact existing `runEngine` without a clock override. Passing a replacement engine is rejected. `kind:'synthetic_verification'` is for synthetic data/rehearsal only; the real client refuses that mode and exposes no bare paid completion method.
6. The complete target roster is frozen **before** packet/job enrollment. One common engine job and two model-specific private jobs share each fixture/packet. All original probabilities/times are preserved. Every model has separate A1/A2/A3 slots; old Saturday blocked arms remain untouched. No public prediction write occurs.
7. Use kickoff/fixture ordering and balanced four-request fixture bundles: scout(A1/A2)+independentA3 for each model. All engine targets remain in the denominator. A450-second request allowance, complete lossless competition evidence, token-byte safety and remaining worst-case budget may exclude AI bundles; every reason is retained. No required history is truncated. Both AI models see identical columnar competition facts; A3 sees no engine forecast, gate probabilities or odds. Full engine loader input remains intact.
8. Scout A1 delegates to the existing Build355 context function. A rerun must reproduce the exact unadjusted baseline before its adjusted output is accepted. Missing evidence, failed contexts or refusals abstain/record the exact baseline fallback without scoring a fabricated AI forecast. A2 preserves veto decisions and their denominator.
9. Generate the private study with `exportContinuation(store)` and the report with `evaluateContinuation(study,store.clock())`. This exporter binds odds to their own packet receipt and includes undeclared jobs as explicit failed, **virtual export-only** rows. It invents no forecast timestamps. Do not use the older single-cohort report as a multi-model summary.
10. Checkpoint after the run, archive all new files plus complete ancestry, download and verify the new archive externally before closing the workspace. Record the actual commit, source/receipt times, model configuration and actual provider usage. Do not upload plaintext to public CI.

An interruption after the frozen Sunday study blocks another enrollment. All frozen targets remain in reports even if no jobs committed. Deliberate repair/reconciliation is required; it is not an automatic redispatch or silently fresh study. File-chain verification alone does not authorize a cold paid resume: restore the SQL and compare actual event hashes/receipts and liability against every retained predecessor, including the Saturday head. If the latest paid checkpoint or in-flight status is missing, **stop** until reconciled; do not resume from the older zero-liability Saturday archive.

## Budget and billing

The original `weekend_events` SQL authority remains the **one shared ledger** for every provider/model/study. No separate model budgets or daily resets exist. Reservations serialize under the inherited quota lock and cannot exceed5000000microdollars in total, including legacy holds. Successful calls also retain their full hold. No failure, timeout, cache discount, missing usage or retry creates a refund. Every retry needs a new reserved ID; an existing reservation cannot redispatch.

Nominal output is1024tokens. Because reasoning/output limits can be imperfect, reservation uses the advertised **physical completion maximum**, entire context and highest approved price tier, without cache/discount assumptions:

| Selected endpoint | Prompt/completion cap per million | Context / physical completion | Hold/request |
|---|---:|---:|---:|
| GPT-6Luna standard OpenAI | $0.20 / $0.75 | 1,050,000 /128,000 | $0.306000 |
| KimiK2.5 Novita | $0.57 / $2.85 | 262,144 /235,929 | $0.821820 |

One complete four-request fixture bundle holds$2.255640. With zero prior liability, these conservative quotes permit at most two full bundles before other admission constraints, **not an arbitrary two-match engine limit**. Cheaper actual responses do not release holds. Research guards do not assert that any provider can be forced to honor its catalog if the provider violates its billing contract; a returned cost/response contract violation durably halts further dispatch.

Known reported charges remain inside their original retained reservations. Account usage exceeding recorded OpenRouter charges/retained liability blocks new requests until reconciled, including charged timeouts with no returned generation. Charges are not repeatedly added on top of already-held money. Key/balance evidence expires after120seconds; profiles after15minutes; runtime proof after10minutes. All are rechecked after checkpoint and immediately before HTTP. A changed key hint is rejected; its hashed redacted label is an audit hint, **not a cryptographic key identity**. Dedicated-key custody and complete archive ancestry remain necessary.

The transport uses inherited HTTPS proxy/TLS, curl config on stdin, no credentials in argv, no redirects/curlrc, bounded body/time/token limits and no retries. Raw responses/usage stay private. Malformed/refused/truncated/unsourced outputs fail; returned contract failures and pre/post-request checkpoint failures record a durable halt. A failed checkpoint stops the supervisor even if its halt could not itself be persisted. The pre-dispatch marker/checkpoint already retains the full uncertain liability.

Completion usage is recorded as **reported**, not final verified billing. Use authenticated GET generation metadata and current key usage to reconcile every generation before claiming actual expenditure; a404/pending/missing response remains unknown. No automatic billing-finalization/refund mechanism is claimed. Existing report spending remains `null` when final total is unknown. In this continuation there were no live requests, so actual expenditure is verifiably$0.

## Monday and release

On actual October26, collect outcome revisions read-only, append real server receipts, and use a witnessed reporting cutoff. Preserve the original90-minute grading and separate48-hour void anchors. Compare original context, Saturday refresh, actually executed Sunday refresh and each provider arm on identical eligible fixtures. Show failed/abstained/un-enrolled arms, veto coverage, pending/missing outcomes, market receipt eligibility, accuracy, Brier/log loss, calibration and paired uncertainty. Different issuance times are explicitly exploratory. Never substitute today's odds for original-time market evidence or call a future-cutoff synthetic report a real Monday evaluation.

The prior combined local release candidate remains inherited; these changes add only private offline research/guards and the missing-event read fix. Full Supabase Auth/JWT/PostgREST/RPC/Edge compatibility, hosted private-schema permissions, live integration, production backup restoration and independent release approval remain unresolved. No October31 deployment approval is implied. Stop/revoke local writers using the existing rollback script, retain all records/liability, close the new draft if reverting code, and leave all prior PRs/protected branches intact.
