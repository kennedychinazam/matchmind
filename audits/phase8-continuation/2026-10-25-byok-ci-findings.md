# BYOK budget assessment and CI startup fix

This follow-up corrects the earlier advice that the owner necessarily had to enable the BYOK toggle. No paid inference is authorized by this report, and no account/key setting or spending guard is changed.

## What was verified

The continuation transport reads only `OPENROUTER_API_KEY` and sends it to fixed OpenRouter HTTPS routes. Its reviewed request builder supplies no upstream provider credential. The current managed environment reports only that dedicated secret binding. No OpenAI, Moonshot or Novita credential is used by this continuation. The legacy production AI path was not invoked or changed.

Fresh read-only key and credit metadata were checked privately. The dedicated key retains its nonresetting lifetime cap within the global US$5 ceiling; ordinary and BYOK usage were zero at that observation. Detailed account responses remain outside Git. Zero historical BYOK use does not prove that no provider credential is saved in the OpenRouter workspace.

OpenRouter's [BYOK documentation](https://openrouter.ai/docs/guides/overview/auth/byok) distinguishes OpenRouter credits from externally billed provider credentials. Its [OpenAPI contract](https://openrouter.ai/openapi.json) describes `include_byok_in_limit` as whether **external BYOK usage** is included in the credit limit. Provider ordering does not disable BYOK: the documentation states that a saved BYOK endpoint for a selected provider may be tried before shared capacity. Pinning `openai` or `novita` therefore does not independently establish credit-only routing.

The documented `GET /byok` credential listing requires a management key. It was not called, and no management credential was requested. The existing ordinary-key metadata cannot conclusively establish that the workspace has no saved provider credentials. The owner was asked to check the workspace Integrations/BYOK page without sharing any credential.

## Budget conclusion before inference

For a verified credit-only configuration with no applicable saved BYOK provider credentials, the dedicated nonresetting lifetime cap and the existing single fail-closed ledger satisfy the intended US$5 spending design. The BYOK inclusion flag has no additional spend to cover in that configuration. The ledger still retains every worst-case hold, including failures, uncertain calls and retries, across all models and checkpoints; ordinary key/account usage must reconcile before dispatch. No extra per-model or daily budget is introduced, and there are no refunds or automatic resets.

That conclusion is conditional on the credit-only configuration and exclusive supervised custody. Local absence of upstream credentials plus zero usage is insufficient to certify account-level absence. The prior unconditional BYOK-toggle advice was overly broad, but removing the guard solely because the toggle is not visible would also be unjustified. This task leaves `verifyAccount` unchanged and paid activation blocked until that evidence is resolved and reported. No BYOK credentials, management key, alternative paid transport or broader network permission were added. Other recovery, source, date, checkpoint and account guards still apply.

## CI root cause and change

Both failed runs on `4275d93` failed on Node 24 with the same missing PostgreSQL socket, in different tests: the read-only Phase 5 extraction test and the foreign-key-identity admission test. The other matrix job was cancelled after failure. Logs were read through the GitHub connector; the CLI log download redirect was inaccessible in this environment.

The pinned PostgreSQL image's entrypoint starts a temporary Unix-socket-only server, initializes the database, stops it, and then starts the final server. The old helper's `select 1` could succeed against the temporary server and return before that restart. Inspection of the pinned image confirmed its temporary server uses `listen_addresses=''`.

The test helper now requires `pg_isready` on loopback TCP and a successful SQL query before returning readiness. Containers remain network-none with no published ports; loopback is internal to the disposable container. This changes only local test startup, not production database access or operation retry behavior. Two deterministic regression tests simulate the temporary socket server/restart, SQL startup failure, final readiness and bounded failure exhaustion. Their initial run failed before the helper existed; the corrected focused checks passed. Remote and local verification results are recorded after completion.
