# October 24 continuation runtime follow-up

Starting source: `84e42b2`, on `codex/phase8-openrouter-continuation`; existing draft PR 6 targets `codex/phase8-weekend-testing-ai`. This records a new task's observations; the earlier report remains a historical record.

The owner privately supplied the complete Saturday archive and its matching outer SHA256. Private files, metadata bodies, logs and extracted data remain outside Git. The existing recovery CLI completed successfully in disposable network-none PostgreSQL containers using the pinned PostgreSQL 17 digest. It verified the three chronological checkpoints and classified the emergency dump as an equivalent event set, with 145 unchanged refreshed forecasts, 725 original arm slots, 93,680 source rows, exact archived engine parity, private grants, the unchanged relation quota and zero retained AI liability. The selected latest dump remains `private-weekend-backup-20261024181506357312.sql`. No historical record was rewritten.

## Runtime and metadata observations

The environment tool reported current observations, matching desired/observed revision 9, enforced restricted networking including `openrouter.ai`, and the individual `OPENROUTER_API_KEY` binding ready. Source configuration version: `cecfgver_6adcf55c9fd481a1b1f317641aa84074`. This differs from the previously blocked source version; readiness was observed rather than inferred from a revision increment.

The existing metadata-only preflight actually ran and returned `ready:false`, `blocked_gate:key_restrictions`, `paid_inference_executed:false`. Fixed read-only key, credits and model endpoint GETs succeeded. An allowlisted inspection identified `include_byok_in_limit:false` as a failed requirement. No secret value, identifying key label or account identifier was printed or committed.

The account responses were inspected privately for lifetime cap, usage, balance and privilege requirements; their detailed values remain outside Git. These are time-limited observations, not permission for future dispatch. The deprecated rate-limit field does not establish actual request-rate permission or 429 behavior.

Both exact requested model profiles passed the existing `freezeProfile` contracts: `openai/gpt-6-luna` with the pinned standard OpenAI backend, and `moonshotai/kimi-k2.5` with Novita. This verifies advertised metadata contracts, not paid inference compatibility.

## Activation remains blocked

The existing requirement that BYOK spending be included in the lifetime cap remains unchanged. The owner must enable that setting on the dedicated key through the provider's supported controls before a fresh metadata preflight can pass. Do not replace the credential with a management key, weaken the guard, or infer permission from available credit. No key/account setting was changed here.

No completion POST, paid inference, Sunday refresh or Monday evaluation ran. No paid launcher was assembled while the account gate failed. Genuine Sunday execution remains restricted to October 25 UTC, and Monday evaluation to an actual October 26 witnessed cutoff. Before any later paid activation, recheck runtime/account/profiles, complete SQL ancestry and any intervening/in-flight executions, exclusive key/ledger custody, fresh checkpoint restoration, source/date guards and external recovery retention. A zero-usage metadata observation does not replace complete paid-checkpoint reconciliation.

Production Build 355, publisher, collector, hosted SQL/Supabase, protected branches and PRs 1–5 remain outside this task's write scope. Hosted Auth/JWT/RLS, PostgREST/RPC, Edge Runtime, private permission/integration checks, production backup restoration and release approval remain unresolved. No October 31 deployment approval is implied.

## Regression investigation

Initial complete-suite runs on both runtimes exposed the inherited test `kickoff crossed during checkpoint prevents HTTP while retaining the admitted reservation`: its two-second real kickoff could elapse during database admission under load, before its intended checkpoint. A focused Node 20 rerun reproduced missing retained liability because admission was already rejected. This was a test setup failure; no real provider request was involved.

The test now uses the existing safely future SQL job and a synthetic supervisor clock just before kickoff. Its checkpoint verifies the committed reservation, then explicitly crosses kickoff; the test requires one checkpoint, zero HTTP calls and unchanged retained liability. There is no sleep or short real-time race. The real SQL store, reservation/confirmation and production dispatch checks remain in use; no runtime implementation changed. Removing the post-checkpoint kickoff rejection would make the test fail. Focused runs passed on Node 20.20.2 and Node 24.19.0.

The initial Node 20 suite finished with 228 passes and two failures: the kickoff timing test and a missing referenced Phase 5 commit in the fresh checkout. Fetching the exact existing commit restored the latter test's Git fixture without changing a branch. Overlapping reruns caused local Docker setup timeouts and were stopped; abandoned disposable containers were removed. Final verification runs are sequential by runtime. A fresh read-only review found no important issue in the test change or the reviewed documentation; private recovery/provider observations were not independently reverified by that reviewer.

Final complete sequential runs (`node --test audits/test/*.test.mjs`, installed Chromium):

| Runtime | Passed | Failures / cancellations / skips | Duration |
| --- | --- | --- | --- |
| Node 20.20.2 | 230/230 | 0 / 0 / 0 | 302.424 seconds |
| Node 24.19.0 | 230/230 | 0 / 0 / 0 | 450.143 seconds |

`git diff --check` passed. Public engine, service worker and production publisher bytes match starting HEAD. All remote branch heads matched the pre-follow-up snapshot before push; the push is limited to this continuation branch. No archive, checksum, private dump, source packet or account response was added to Git. Remote CI completion is separate from these actual local test results.
