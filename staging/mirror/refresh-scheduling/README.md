# Refresh scheduling options

Nothing in this directory is installed. Verified facts are dated 2026-11-20 (read-only catalog
and GitHub API reads); everything else is labelled as a proposal.

## How Build 355 keeps production fresh (verified)

- Production `cron.job` (project toqfdrcjzwnlydqekude): job 9 `refresh-af-10min`, schedule
  `*/10 * * * *`, active, command calls Edge Function `refresh-af` through `net.http_post`
  (pg_net). Jobs 3 `push-kickoff` and 7 `push-result` (`*/10`) and 5 `push-digest` (`0 7 * * *`)
  also use pg_net. The command text was not printed (it contains a key).
- `cron.job_run_details` for job 9 in the last 24 h: 144 runs, all `succeeded` (latest
  2026-11-20 17:20 UTC). That is the cadence GitHub's scheduler does not deliver.
- Production extensions: pg_cron 1.6.4, pg_net 0.20.4, supabase_vault 0.3.1; `vault.secrets`
  holds 1 secret (count only read).

## How the preview refresh behaves today (verified)

- `kennedychinazam/matchmind-preview` (public, default branch `main`),
  `.github/workflows/matchmind-preview.yml`, cron `8,23,38,53 * * * *` plus `workflow_dispatch`.
- Since 2026-11-19 00:00 UTC GitHub started only 2 `schedule` runs (vs 2 manual dispatches).
  Of the last 10 runs, the 7 `schedule` runs were 2 success / 5 failure; the 2 dispatches today
  succeeded. Runs take 3.5-5 minutes.
- The 5 scheduled failures inspected end in step "Refresh bounded public records into isolated
  staging" with `Staging-only publication HTTP 400` from `mm_preview_publish_v1`. **More frequent
  triggering does not fix that error; it must be diagnosed separately** (not done here).
- The published preview page fetches `mm_preview_display_v2` / `mm_preview_status_v1` from staging
  at runtime (`REAL_GUARD` in `staging/build-real-preview.mjs`), so data freshness depends only on
  the `refresh` job publishing a new staging edition, not on the Pages rebuild.

## Option A (recommended): staging pg_cron + pg_net calls GitHub `workflow_dispatch`

Uses existing free infrastructure: Supabase staging (pg_cron/pg_net available, Vault installed)
and GitHub Actions (public repo). `workflow_dispatch` runs are queued on demand, not best-effort
like `schedule`. The existing workflow already accepts `workflow_dispatch` and has
`concurrency: matchmind-preview-pages, cancel-in-progress: false`, so overlapping dispatches
queue (GitHub keeps at most one pending run per group; a newer pending run replaces it).

Director steps (Claude must not create or request the credential):

- **A1. Create a fine-grained personal access token** on GitHub (Settings > Developer settings >
  Fine-grained tokens): resource owner `kennedychinazam`; repository access "Only select
  repositories" = `kennedychinazam/matchmind-preview`; repository permissions **Actions: Read and
  write** (Metadata: Read is added automatically); nothing else; expiry per policy (e.g. 90 days,
  calendar the renewal).
- **A2. Store it in staging Vault yourself** (SQL editor of rdcbnvfnxenrpnnwxszs):
  `select vault.create_secret('<token>', 'mm_preview_dispatch_token', 'GitHub Actions dispatch for matchmind-preview');`
- **A3. Run `STAGING-dispatch-up.sql`** on staging. It installs pg_cron and pg_net (DDL) and
  schedules `mm-preview-dispatch` at `1,16,31,46 * * * *`. It refuses if the secret is missing.
- **A4. Optional**: leave the workflow's own `schedule:` in place as a second trigger, or remove
  it to avoid duplicate runs; both are safe with the concurrency group.
- **A5. Check** with `STAGING-dispatch-check.sql`: GitHub answers `204` to a valid dispatch.

Request budget per run (from `docs/director/analysis-data-audit.md`): history reads are GET-only
against production PostgREST, at most 1000 GETs per run (100 competitions x 5 pages x 2 passes)
plus the bounded fixture/prediction/record/slip reads; this is an upper bound, not an observed
count. No paid provider request occurs. At 96 runs/day the upper bound is about 96,000 GETs/day
plus 96 GitHub API POSTs/day (GitHub REST limit 5,000/hour per token). Actions minutes: public
repository, about 4-5 min/run, about 7 runner-hours/day. The audit document asks that this budget
be monitored before increasing frequency; 15 min matches the workflow's existing intent.

Failure behaviour: a failed dispatch (401 expired token, 404, network) appears in
`net._http_response` with a non-204 code and starts no run; the last published staging edition
stays served until its `expires_at` (rolling 24 h), after which the client fails closed. A failed
workflow (tests or the publish 400 above) publishes nothing and leaves the previous edition.
pg_cron keeps firing; nothing retries in a loop.

Rollback: `STAGING-dispatch-down.sql` (unschedules the job, deletes the Vault secret), then revoke
the token on GitHub. The workflow is unchanged, so its own schedule continues as before.

## Option B: staging-side scheduled mirror (no GitHub in the loop)

A staging pg_cron job could GET the public production REST source with pg_net and call
`mm_preview_publish_v1` directly. Not recommended now: the projection, validation and
analysis logic lives in `staging/mirror/refresh.mjs` and `analysis-projection.mjs` (JavaScript)
and would have to be re-implemented in SQL or an Edge Function and re-verified against the
existing tests; pg_net is asynchronous, so a multi-page capture needs a state machine across cron
ticks. It also removes the per-run test gate the workflow applies before publishing.

## Option C: a production cron job

Production already has pg_cron/pg_net/Vault, but adding a job there is a production change, and
the preview must not depend on production configuration. Not proposed.
