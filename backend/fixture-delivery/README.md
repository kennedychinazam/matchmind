# Bounded fixture delivery — offline remediation proposal v1

Director authority: [PR22 comment6589779458](https://github.com/kennedychinazam/matchmind/pull/22#issuecomment-6589779458). Base `ea7e94de3a76487e3dd81c810b64627efd97ab0a`. **Not installed in production; not publication approval.**

## Working boundaries

`PROPOSAL-up.sql` removes generic anonymous fixture/provider reads and fences ordinary authenticated reads behind a private, expiring UID capability. It covers explicit copied-fact tables and dependent views/aliases, snapshots prior table/column SELECT ACLs, checks inherited access and unsafe roles, and fails transactionally on unsupported authority. It does not alter original source rows, forecasts, formulas or financial records. Existing service collector and explicitly enrolled publisher/research paths retain complete history. The new principal registry starts empty; an email label, user_metadata or query string grants nothing.

`matchmind_fixture_access_v1({})` returns a current caller capability, bounded by its private approval and a short expiry. `matchmind_display_v1({screen})` accepts only the fixed `scores`, `predictions`, `history`, `records` or `slips` screen. There is no caller-selected fixture, date, field list, offset, cursor, source table or history range. A private reader without raw-table privileges serves a current finite edition. Public wrappers are SECURITY INVOKER; narrowly owned private helpers have fixed search paths and explicit execution permissions.

`matchmind_publish_display_v1({})` is for a current enrolled publisher or the actual service role. A separate nonlogin, non-bypass materializer projects existing issued board outputs, immutable predictions, necessary fixture/settlement facts, aggregate records and issued slips. It never fits a model or accepts a caller-supplied document. All required immutable predictions and admitted issued-slip results must be accounted for. Unsupported fields, missing identities, invalid periods/values, duplicate IDs, inconsistent vectors or limits fail the edition; no evidence is silently truncated. Limits are1000 cards and512KiB per document, not a verified production inventory capacity.

The browser public path does not restore/refit the old provider corpus. It reads fixed presentation screens, preserves original forecast identity/kickoff/vector/pick and displays later withdrawal separately. Existing manual/custom CSV math remains local; explicitly authorized private loading retains full history. Generic local query chaining filters an already finite screen response and cannot select a larger server corpus. Scores retain current fixture metadata; prediction/history claims retain their immutable origin. Unknown or unavailable publication is shown honestly. Previously delivered raw bytes are preserved/quarantined, not deleted or falsely attributed to another account.

## Versioned contracts and hooks

- `contract.mjs`: closed field schemas, semantic validation and pure source projection. `updated_at`, original forecast `made_at`, materialization `as_of` and request receipt are different clocks. Materialization time is **not** proof of provider update time or genuine90-minute source authority.
- `fixture-cache-guard.mjs` + `ai-analyze-v17-cache-guard.patch`: apply only to the captured v17 function after verifying its exact source hash. Before fixture cache reads/generation, use the verified caller's JWT to check scoped access/current published fixture membership. Cached analysis/context is closed and bounded; the deployed `title/uri` source shape is preserved. Invalid/future timestamps or malformed live cache fail unavailable, without a generation fallback. This does not authorize any provider call or change model logic.
- `refresh-presentation.mjs` + `refresh-af-v54-presentation.patch`: apply only to the captured v54 collector after exact-source comparison. Four existing collection response paths call the fixed service-authorized materializer after source work. The original scheduler secret refusal, provider transformation and dry/probe behavior are preserved. One database call, no retries/provider calls; a refresh error is returned explicitly and cannot roll back successful ingestion. Normal collector cadence and publisher board publication can therefore refresh the finite projection without public refresh access.
- `robot/publish.mjs`: fixed diagnostic counts now use the authenticated, capability-checked browser publisher context after login, never anonymous select-star REST requests. Counts do not export rows or tokens.

The captured collector header has an older VerifyJWT comment; actual management metadata for v54 reports verify_jwt=true. Preserve the reviewed deployed setting and MM_CRON_SECRET guard; do not treat that stale comment as an instruction to disable authentication.

The two Edge patches are deployment artifacts only, not deployed functions. Full private captured source is deliberately outside this repository. A matching production version, required existing environment bindings, current schema and owner approval must be verified before applying any patch.

## Reproducible local verification

Pure/browser regressions: run the complete repository `test/*.test.mjs` on Node20 and24 with the existing offline Chromium harness and explicit PWA flags. Final exact commands, counts, failures and source hashes belong to the draft PR/private Director package.

Actual isolated database proof:

```
node backend/fixture-delivery/local-integration.mjs --run-local-synthetic /ABSOLUTE/PRIVATE/EVIDENCE/DIRECTORY
```

This command creates **new** synthetic Postgres/PostgREST containers, an internal network and volume, using pinned images. It never accepts a hosted URL or real key. It creates local synthetic accounts/rows and performs authorized synthetic writes and denied operations. Runtime JWTs/passwords stay in a private runtime file, never GitHub/logs. It retains the synthetic data and records container identities. Inspect the command and existing resource state before running; do not rerun merely to reproduce already unchanged proof. Actual UI/SDK tests against that stack are distinct from intercepted browser tests and from genuine Auth sign-in/physical-device acceptance.

## Real-environment acceptance and rollback

1. Director supplies a secret-free actual schema/grants/policies/trigger/view/function/config export and exact inventory sizes, or approves the narrowly specified reads needed to obtain them. No production fixture rows were read for this patch. Catalog metadata confirmed the permissive configuration, not an actual unauthenticated download or incident.
2. Build a production-equivalent **isolated nonproduction** deployment. Any hosted resource/cost/account creation and each implicit write or denied-operation probe need the individually scoped acceptance authorization. Do not reuse production credentials or user/provider datasets for synthetic testing.
3. Review exposed schemas, inherited roles, GraphQL/Realtime and every alternate raw-return path; verify the proposal preflight, source/forecast digests, private principal enrollment, full actual inventory/byte capacity, expiry, errors and collector/publisher cadence before installation approval.
4. After separately approved installation, test permitted screens plus raw-denial using anonymous, A/B ordinary, publisher, research and collector roles. Verify original probabilities/identity, real90-minute semantics, withdrawals/corrections, failed refresh, quota/outage recovery, account isolation and no secret disclosure. The local synthetic database proof is not deployed-policy equivalence.
5. Review both Edge patches against the then-current deployed source and apply only with explicit approval. No live generation, collection or push is implied. Validate cadence from permitted evidence and individually authorized local/nonproduction tests.
6. Rehearse `PROPOSAL-revert.sql` on nonproduction. It restores captured SELECT ACLs and removes new execution paths without deleting source/forecast rows or recovery records. **It can restore the previous broad exposure**; never execute it automatically or call it a safe public-release fallback. A failed real deployment requires a Director-approved maintenance/containment and revert decision.

Before merge, rollback is simply to discard this draft branch. No live database/application changed. Future production merge, SQL/Edge deployment, publication, paid action or data disposition requires separate Director approval.

## Rights and impact

Timestamps preserve their original text. The supported RFC3339 subset includes Z and explicit offsets up to ±15:59, with valid calendar/time components; no zone-less or future cache timestamp becomes trusted by normalization.

A finite browser response remains inspectable and recordable; repeated editions can be retained. Bounding fields and denying generic SQL do not themselves confer a data licence or guarantee scraping prevention. Four intended application uses are supported by Director-attested provider correspondence; specific transport/extractability, imagery/third-party rights, issued bookmaker-price displays, share images and retention questions remain in the rights review. API-Football remains primary. No provider contact, subscription/payment, migration or alternative-provider project was started.

Public users no longer receive arbitrary provider history/research datasets. Full-corpus research/calibration views require explicit private authority or a user-supplied CSV. Unissued/unpublished statistical detail and personal historical results outside admitted publication membership cannot be invented or obtained via an arbitrary-ID fallback; existing records remain intact and unavailable fields stay unknown. This is an explicit compatibility boundary, not a claim every research operation remains public. The actual inventory/capacity and operational cadence must pass acceptance before release.
