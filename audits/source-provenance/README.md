# Offline source provenance prototype v1

**Synthetic-only infrastructure. Genuine source-review admission remains NO-GO.** No network client, provider request, database/enrollment capability, executable study, financial operation or prediction path is present. These files do not modify A3/A4 prompts/contracts, Build355, the continuation policy or production collectors.

## Existing components reused

- `audits/a4/bounds.mjs`: duplicate-key/prototype-safe bounded JSON, plain-data cloning, recursive freeze, raw SHA256. Limits:16MiB raw response, depth12,500000 nodes,65536 array items,128 object keys,8192 characters/string.
- `audits/lib/snapshot-contract.mjs`: canonical hashes, explicit-offset timestamps and microsecond chronology.
- `audits/a4/text-policy.mjs`: existing field-aware football identity validation, encoded contamination and price/instruction rejection. No policy change.
- `audits/phase8/source.mjs`: inspected read-only collector/inventory pattern; **not imported**, because it performs HTTP and only returns normalized database values.
- `audits/a3-supervised/source.mjs`, `audits/a3-workflow/authority.mjs`: inspected complete-history/source-capability boundaries; **not changed/imported**. A synthetic capture cannot mint one of those capabilities.

## Capture → projection → reconciliation

`captureResponse({bytes,metadata})` copies exact Uint8Array/Buffer simulated HTTP bytes and freezes a closed manifest. Raw bytes are hashed, never normalized; malformed UTF8/JSON/API errors are still preserved. `verifyCapture` verifies manifest and byte bindings before bounded parsing. It reports returned IDs, safe error presence, inventory completeness and a strictly selected football projection. Raw API errors remain in private bytes, not in reports. Metadata preserves original timestamp spelling; validated offsets must be explicit and start≤receipt, provider Date≤receipt. Caller-supplied simulated clocks/provider labels are **not independent source identity or time authority**.

Closed metadata: capture_id (1–80 safe characters), fixed provider/base and `/fixtures`, query either exact ordered requested-ID list (≤20 IDs) or league/season strings, complete requested_ids (≤65536 unique positive safe integers), request_started_at_utc, response_received_at_utc, nullable provider_date_utc, HTTP100–599, exact `application/json`, collector_commit (64 lowercase hex), transformation_version=`raw-fixture-projection-v1`. Input objects use the existing safeClone bounds. Non2xx, nonempty/missing API errors, count/query mismatch, multiple pages or unexpected/missing returned IDs prevent completeness. Future provider adapters may need explicit versioned compatibility changes; current local validity proves no actual provider compatibility.

Raw provider fields are never passed wholesale into an analyst. The review projection only contains fixture ID/date/original status short, league ID/name/country/season, team IDs/names, original goals and halftime/fulltime/extratime/penalty score objects. Unrequested fields, commentary, odds and prediction aliases remain private raw bytes. Names pass the existing football identity policy. Original raw status long/elapsed, unknown fields, nulls and absent fields remain losslessly available in raw bytes even when not in the review projection. Unknown original short status is retained if syntactically safe; no status collapse. Retention here is raw-evidence preservation at this prototype layer, not a claim that the code is recognized: this prototype validates the character pattern `^[A-Z0-9]{1,16}$` and holds no vocabulary. Deciding whether a pilot inventory is complete belongs to the provider adapter, which withholds its review projection and fails completeness for any code outside its recorded vocabulary while leaving these raw bytes untouched. The two statements govern different layers and do not conflict; see [PROVIDER-ADAPTER.md](PROVIDER-ADAPTER.md). Malformed identity, score or future completed-match date quarantines that row as incomplete.

`reconcile({captures,normalized,synthetic_period_rule})` is pure and never mutates either input. Required IDs come from a duplicate-free, bounded, closed legacy-field list matching existing football projections. Each required row produces exactly one record and counts: `supported`, `conflicting`, `missing`, `duplicated`, `incomplete`, or `period-unverified`. No duplicate/correction winner is chosen, including identical observations from repeated captures. Bad/partial inventory marks affected records incomplete; no capture for a required ID marks it missing. Returned league/season values must match a season query, independently of its echoed parameters. Conflicting means identity/orientation/UTC kickoff/competition/country/provider/status mapping or a present normalized score differs from its corresponding raw field; missing/null mismatches are not silently filled. Unknown/missing period remains unverified/incomplete. Fields without raw support (xG and injury tokens) are explicitly listed as unverified; supported never certifies them. Original scores are never replaced and `gh/ga` are never redefined as regulation scores.

**Supported means only supported under the explicit fictional test rule**, not authentic football or source authority. Default has no rule and cannot produce supported regulation labels. Optional `synthetic-fulltime-v1` uses a complete fulltime pair as fictional regulation, requires final goals, rejects fulltime exceeding goals and FT final/fulltime disagreement, and never uses AET/PEN totals or penalty scores instead. CANC/ABD/NS/TBD/unknown statuses cannot be supported historical results. This is an algorithm demonstration, not a rule about real API-Football semantics.

Every report remains `classification=synthetic_reconciliation_only` and `source_review_admissible=false`, even if all rows are synthetically supported. No real receipt/approval parameter exists. Normalized record hashes and raw capture references preserve traceability, not authenticity or semantic proof. No API produces an approved A3 packet.

## File-only immutability and revisions

`writeCapture(absoluteDirectory,capture)` verifies first, creates an exclusive0700 directory, writes response.bin and manifest.json exclusively0600, fsyncs files/directory. Existing directories/symlinks never overwrite originals. `readCapture` bounds regular-file sizes, refuses terminal file symlinks and rechecks hashes. Raw memory buffers remain caller-mutable; any change invalidates their manifest hash. File tampering remains detectable. This is not tamper-proof storage, an atomic multi-file transaction or a replacement for existing checkpoint/backup procedures. A crash/write error may leave an incomplete directory; never reuse it or infer success. Parent-directory fsync/platform crash guarantees and genuine immutable storage require separate acquisition review.

`correctionSidecar` requires actual projected records in both captures, exact capture hashes and later request-start after previous receipt. It records reason, fixture, prior/next hashes and new receipt without changing either manifest. `writeCorrection` stores a closed hash-checked sidecar in its own exclusive private directory. A correction observes changed source data; it does not establish an earlier value or automatically supersede a prior observation. Sidecar authenticity still requires independent review of both referenced captures.

## Reproduce synthetic examples/tests

From repository root:

```sh
node audits/source-provenance/example.mjs > /private/path/synthetic-example.json
node --test audits/test/source-provenance.test.mjs
```

All example IDs/teams, clocks, collector hash, scores and rules are explicitly synthetic. The example includes exact base64 simulated HTTP bytes, manifest, unchanged normalized record, default period-unverified review, fictional-rule-supported review and correction sidecar. Keep even simulated raw bundles outside public artifacts if later replaced with private evidence. Never place genuine raw responses in Git. Node20/24 CI discovers the new test via the existing `audits/test/*.test.mjs` command.

## Future acquisition — documentation only

Existing deployed `refresh-af` source uses `/fixtures?league=<id>&season=<year>` and `/fixtures?ids=<IDs>` with a20-ID batch limit in retained code; this is not a fresh entitlement check. Capture original fixture.status, goals, all score components, query/paging/error metadata and exact bytes. A season response may return a whole season with few calls; reconcile the full expected ID inventory and all pages, including unplayed/cancelled/abandoned rows. Do not filter only FT. Exact-ID batches target gaps and cap unintended scope. For1891 known rows,20-ID batches imply at least95 requests if that endpoint/limit applies;95 is not a guaranteed total or free budget. For1885 finished rows the same rounded lower count is95.

Fewest-request plan: inspect account entitlements/documented coverage first without a football query; determine provider-supported seasons and pagination; compare full season-call count against required-ID batch count; capture complete season inventories where demonstrably cheaper and use by-ID batches only for documented gaps. Every request consumes approved quota even if subscription-included. Errors/partial inventories stop; no automatic retry or silent reuse. Additional `/fixtures/events` only if needed and separately authorized to resolve periods with documented timing semantics—minute91 alone is not extra time. No odds endpoint is needed. Required xG/other observations still need their own period/source definitions when material; this prototype does not certify them.

Before any real call, Director must approve: existing access method, current account plan and historical-season entitlements, remaining daily/per-minute quotas, actual endpoint batch/page limits, cost/overages and spending ceiling treatment, retention/redistribution rights, exact scope/request cap, credential/network boundary and raw-evidence privacy/backup arrangements. Prior26October public list observations (not current account facts): Free$0/100 daily, Pro$19/7500, Ultra$29/75000, Mega$39/150000 monthly; free seasons restricted. Sources https://www.api-football.com/documentation_v3 and https://www.api-football.com/pricing . No fresh external verification or subscription is performed. Current isolated prototype does not authorize host/credential changes or invoke a hosted collector.

## Retention of real captures

Provider rights are no longer unanswered. API-SPORTS support confirmed in writing on 29 October 2026 that exact response bodies, including error bodies, may be stored for internal use and internal model evaluation **while the subscription remains active**, and that retention of raw API data after it ends is not covered. The wording is quoted exactly in [PROVIDER-RIGHTS-RESPONSE.md](PROVIDER-RIGHTS-RESPONSE.md), which also records what the reply does not grant and the unresolved question about normalized production data after expiry.

The condition is enforced rather than noted: [RETENTION-POLICY.md](RETENTION-POLICY.md) and `retention.mjs` hold a deletion deadline of 2026-11-10T12:00:00Z, ahead of the 2026-11-11T13:47:51Z expiry, covering original bodies, error bodies, temporary copies and every registered backup, with a durable intent, a deletion receipt and a verification step that re-reads the filesystem instead of trusting the receipt. Retention also stops at once if the subscription ends early. Nothing there touches a production record or the historical research archive, and it authorizes no capture.

## Prepared transport boundary — inert

[TRANSPORT-BOUNDARY.md](TRANSPORT-BOUNDARY.md) and `transport.mjs` prepare the single-batch request using the production convention observed at `index.html:2596` and `:2640`: the fixed API-SPORTS host and the one `x-apisports-key` header. It cannot send a request, for two structural reasons rather than a branch anyone can edit. It holds no credential and never reads one, so the request it builds names the header and never its value. And no Director public key is installed, so the exact-scope signed authorization every real dispatch must present has nothing to verify it against. Dispatch is simulated-only, redirects are never followed, nothing retries, and the durable attempt is consumed before the transport is called and never refunded.

## The real transport — present, and still inert

[REAL-TRANSPORT.md](REAL-TRANSPORT.md) and `real-transport.mjs` are the
implementation the preflight named as missing. They add only the integration the
other modules leave out: a runtime-only credential binding that calls its
supplier once and keeps the value in a closure no accessor can reach, the real
`node:https` client, a bounded body read that runs before any parsing, a target
assertion that rebuilds the request rather than trusting a caller, a preflight
that refuses everything refusable before the ceiling is touched, and one ordered
pipeline from authorization to retention registration.

It cannot reach the provider. The only function that can open a socket refuses
unless the call came from its own authorized pipeline, and refuses again while
no Director public key is installed. Nothing here installed a key, bound a
credential, created a latch at an approved location or sent a request, and no
credential was created, read, requested or transferred. Three decisions that
needed the owner rather than a default are documented in that file instead of
being taken quietly.

## Independent source review before any future GO

A reviewer independent of the collector must verify actual authorized provider connection/account evidence (redacted), trustworthy capture process/clocks, exact endpoint/response/version and immutable receipt/backup linkage. A label or hash alone proves none of those facts. Reconcile every required record by exact provider fixture/competition/team IDs and orientation, original raw pointers, scores/null/missingness, original status and revision order; partial data cannot certify a cohort.

Review applicable provider definitions and genuine examples for FT/AET/PEN, fulltime versus cumulative/period-only extratime/penalty scores, stoppage-time treatment and any metric period. If supported, future records may have a reviewed explicit regulation rule; this prototype deliberately supplies none for genuine data. Sample examples validate a mapping but cannot cover missing records. Raw current acquisitions can establish availability for a later target forecast, never historical first receipt or an earlier prediction cutoff. Preserve old exports and attach new observations/corrections; no overwrite/backdate/drop/subtraction to manufacture regulation evidence. Any unresolvable row remains blocked under the unchanged complete-history A3 requirements.

Only after this authority is independently established could a separately approved, versioned genuine source adapter be designed using existing enrollment/checkpoint protocols. Continuation installation, new-study approval, capacity choice, fresh owner coordination, all runtime/financial/BYOK/backup gates and exact paid authorization remain separate. No current or future fixture, including Fiorentina, is admitted or granted an extended authorization by this prototype.
