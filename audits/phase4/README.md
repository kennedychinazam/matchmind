# Local-only Phase 4 preparation

No hosted project, Supabase login/link, production robot, real provider request or deployment is part of these tools. Private collector/function sources must stay outside this public checkout.

## Current entry points

- `node --test audits/test/*.test.mjs`: includes transport isolation and historical-capture concurrency regressions, alongside all existing tests.
- `node audits/phase4/verify-stack.mjs`: explicit full-service HTTP characterization probe. Requires the private CLI runtime described below. Absence of the stack fails, never skips. This opt-in probe is separate from the PostgreSQL regression suite; a green regression suite does not certify it.
- Existing scaling tests compare every M14 feature with full eligible history, then add 24,000 unrelated fields. Existing schema tests cover backup/restore and rollback. No tests use live API-Football or AI services.

`local-transport.mjs` permits only explicit numeric IPv4 loopback HTTP origins, restricted paths, fixed request options and no redirects. It is test transport, not the production publisher. Do not supply arbitrary agents/dispatchers or use the production robot's dry-run mode. A loopback check is not enough to contain arbitrary private code: that code must execute inside an isolated network with no production secrets, and its transport must also be injected/allowlisted.

The PostgreSQL harness runs with `--network none`, no published ports, a pinned image and tmpfs. The concurrency test validates those properties before publication. Docker administrators remain trusted.

## Recreating the CLI investigation

Use the existing local Docker Unix socket; clear inherited remote Docker endpoint/context selectors. Install CLI 2.122.0 into `/workspace/matchmind-tools/phase4` (outside Git) with an exact npm dependency and keep its lockfile there. Review package installation scripts before use. Do not install hosted credentials or copy a production environment file.

Initialize `/workspace/matchmind-tools/phase4/runtime` with `supabase init --workdir ...`. CLI initialization is local only. Disable telemetry with `supabase telemetry disable`. Never run login, link, db push, projects, secrets or functions deploy. Keep stdout/status files mode 600 outside Git, since successful startup/status includes local keys.

Use a network created with:

```sh
docker --host=unix:///var/run/docker.sock network create --internal \
  --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 \
  --label matchmind.phase4.synthetic=true mm-phase4-local
```

The default ECR registry is denied by this workspace policy. CLI v2.122.0 source (`apps/cli-go/internal/utils/docker.go`) confirms `ghcr.io` is its official fallback. `SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io` selects that allowed registry through the existing proxy with TLS checks unchanged. This is not permission to change network policy or bypass its proxy.

`supabase start --network-id mm-phase4-local --workdir ...` attempted the full stack but image extraction approached the disk stop threshold. Stop that attempt before exhaustion. A reduced core trial excludes Studio, Storage, analytics, Realtime, pooler and database metadata services:

```sh
SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io supabase start \
  --exclude studio,storage-api,imgproxy,logflare,vector,realtime,supavisor,postgres-meta \
  --network-id mm-phase4-local --workdir /workspace/matchmind-tools/phase4/runtime
```

Use the installed binary, not an unpinned `npx` invocation. Inspect actual container networks/ports before requests: all attachments must be the internal network and published host addresses must be 127.0.0.1. Do not expose a cloud public preview/tunnel. An explicit non-loopback CLI bind must be treated as a failed isolation gate, not ignored. Never use `--ignore-health-check` to report success.

## Resource and shutdown rules

This workspace has roughly 32 GB filesystem capacity and 9.7 GiB RAM. Docker vfs stores/extracts many full intermediate layers; summed image sizes significantly understate transient disk use. Stop pulls/load if free disk reaches 4 GiB or available memory reaches 4 GiB. Do not run heavy regression/benchmark jobs during image extraction. No subscription, additional hosted project or paid resource is an alternative in this scope.

Stop only this private runtime with the pinned CLI's reviewed `stop --workdir ...` command. Keep local dumps outside Git before destructive reset. Remove only known trial containers, the labeled trial network and specifically recorded downloaded images; never use broad prune or change the Docker storage driver. Existing isolated PostgreSQL tests remain runnable independently.

For research rollback, use the existing tested `audits/staging/rollback.sql` only inside the disposable database. It disables capture and writer permissions while preserving source predictions and archived evidence. Never point it at Supabase production.

## Deferred work

The service probe tests local synthetic signup/user validation, invalid JWT denial, PostgREST, owner RLS and RPC privileges. Its temporary probe table/function are removed; its synthetic Auth user is removed after probe completion. It is a characterization scaffold, not a hosted permission migration or complete Phase 4 acceptance suite. JWT expiry/wrong-project cases, Edge request handling, research identity facades, realistic publisher browser transport and private collector compatibility need further verified work once the relevant services/source are available. Do not claim those checks passed based on PostgreSQL tests.

Full snapshot replay of the original baseline still lacks its historical ordered engine-input/configuration manifest. M14 feature parity and saved-output identity do not remove that limitation.

AI preparation remains mocked/design-only: provider/model-version contracts, cache keys including immutable snapshots and issue cutoffs, separate attempts/errors and successful private shadow forecasts, zero-default budgets with atomic worst-case reservations and no automatic paid/model fallback. No real inference requests or new prediction models are authorized.

## Capture profiling and proposed optimizations

`node audits/phase4/profile-capture.mjs /tmp/mm-profile.json` profiles budget locks, selection, manifest storage and capture work in cloned synthetic databases. Repeat with `reverse` to change variant order, or `focused` for current/narrow-selector only. It requires the existing pinned image, makes no provider requests and installs no services. It compares exact evidence and full M14 features; focused runs also compare all manifest roots. Raw synthetic results stay outside Git; reviewed aggregates are under `results/`. Read `docs/PHASE4_CAPTURE_PERFORMANCE_REVIEW.md` for results, limitations and the separate durable-asynchronous proposal. Candidate SQL is applied only inside disposable clones; no staging SQL artifact is patched by the profiler.
