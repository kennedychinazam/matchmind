# MM-06 prediction issuance integrity - local proposal

No hosted installation is authorized or executed. Production-specific proposal only; staging has broader synthetic publisher grants and lacks final_prob/final_at. The proposal intentionally rejects that shape. Do not install the production file in staging or weaken its checks to make it fit.

## Evidence

The parent captured only named MatchMind project catalogs on27November2026. Production capture time is2026-11-27T02:49:05.623489+00:00. Local private evidence remains in workspace work/mm06-evidence/production-catalog-20261127.json and staging-catalog-20261127.json. The original production file SHA is recorded in production-contract.synthetic.json. The synthetic fixture preserves relevant schema, policy and grant operators/roles, replacing only the publisher email with an invented example.invalid identity and limiting fixture columns to the seven used here. It contains no real rows, tokens or provider requests.

Production already restricts authenticated UPDATE to final_pick/final_prob/final_at/withheld_at. This proposal does NOT claim ordinary clients can rewrite original fields now. The additive trigger extends original-field immutability through service_role and enforces exact server issuance admission, which current retained RLS date-only INSERT does not do. It leaves existing RLS, authenticated grants and DELETE behavior unchanged.

Before-proof in work/mm06-evidence/sql-before.json records a synthetic authorized-publisher live-build insert for a past finished fixture carrying a1900 caller timestamp under the captured production role/RLS/grant shape. This is local capability evidence, not an observed production exploit. Client-before logs preserve the actual queue crossing kickoff and identity/session replacement while prices awaited.

## Proposed semantics

A new live record requires canonical existing fixture fxid/league/home/away/date/time, positive build<=1000000, NS status, future exact UTC kickoff and the current server five-UTC-date-day ceiling. The client retains its existing three-day publication horizon; the database ceiling is not silently changed to three days. NULL/unknown/malformed time or status fails closed for NEW live issuance. New canonical fixture/league IDs must be positive and both team labels must be nonblank and at most160characters, even when matching NULL/invalid client values would otherwise compare equal. Existing rows are not revalidated.

UTC parser accepts hour:minute, optional seconds/fraction, or a full matching calendar date with T/space plus that time and optional Z/+00:00. Numeric time ranges are checked before a cast. Different date, nonzero timezone offset, junk suffix, midnight24:00 and invalid minute/second are refused. It does not guess a missing time. Existing original data are never normalized.

The guard locks the fixture FOR SHARE, then captures clock_timestamp. A statement waiting for the fixture lock cannot use its earlier statement_timestamp or caller made_at to sneak through kickoff. New made_at is always that server sample. Duplicate-ignore replay sees an existing record and preserves first-writer-wins, including replay after kickoff; an ON CONFLICT UPDATE still reaches original-field comparison and cannot promote/change the original.

Reconstruction remains the current publisher's explicitly separate build=-1 admission: canonical PAST finished FT/FINISHED/AET/PEN fixtures only, server made_at, historical label retained, no promotion or replacement of a live row. It is not a timing bypass for a positive build. No public bypass flag or broader role is introduced. Authorization continues to be decided by the existing RLS/grants, with no inference from current_user inside a security-definer function.

All columns except the four existing metadata columns are immutable using NULL-safe whole-row JSON comparison. Future added columns are frozen by default. Drift requires a nonempty bounded final_pick and finite probability in[0,1]; final_at is server-stamped. Withdrawal is a first event: its initial supplied nonnull value becomes server time, and an existing event cannot be cleared or replaced. A true metadata no-op may remain a no-op without revalidating a legacy original. Changed metadata requires valid known old/current UTC times, NS status and server time strictly before the EARLIER original/current kickoff. Rescheduling cannot reopen a past claim. Unknown legacy time produces an explicit failure, never an implicit historical repair. Settlement does not get an original-field exception.

## Private guard owner and privilege limits

The dedicated mm_prediction_guard is NOLOGIN/NOINHERIT/NOBYPASSRLS. No API or service role receives membership. Its functions are private with fixed search_path=pg_catalog and revoked PUBLIC/anon/authenticated/service_role execution. Schema access is revoked from those roles. It receives only fixture identity SELECT, UPDATE(fxid) needed for row-lock admission, and prediction fxid SELECT for duplicate detection. Role-specific fixture SELECT/UPDATE USING policies permit locking; WITH CHECK(false) blocks actual fixture row changes by this role. It is not a new client write route. Installer membership is temporary and revoked at transaction end. The isolated PG suite must verify this under the function owner, not substitute a superuser query for the guard.

No DELETE trigger/grant, retention/erasure change, new exposed RPC or original-row rewrite is included. Existing lean_picks and prospective settlement-cohort migrations are not installed or modified.

## Verification

Run node --test test/prediction-issuance-client.test.mjs test/prediction-issuance-sql.test.mjs. SQL tests use their own pinned Postgres16.6 network-none container, invented rows/JWTs and no host mounts. They remove only their own named container. They reproduce the original policy behavior before installing the proposal locally, preserve that original row across installation, verify role/grant boundaries, every original field, metadata, timestamps, cutoff/horizon, reconstruction/legacy compatibility, duplicate races and a real fixture-lock delay crossing kickoff. Browser function tests execute actual client functions in an offline VM with deferred SDK doubles. Root separately owns full-browser/PWA checks and acceptance.

## Hosted gate and rollback

This file is NOT a release instruction. Before any hosted action, root must review current named-project exact catalog fingerprints, issuer/service/maintenance dependencies, lock and drain procedures, function ownership/RLS, rollback, staging adaptation and matched client/server acceptance. Current preflight assertions are conservative shape guards, not a substitute for a complete fresh catalog review. Drifted policies/privileges require explicit review; do not auto-replace them. Production and staging require distinct reviewed proposals.

Do not blindly drop the guard or restore a permissive policy when a deployment fails. Disable new issuance while preserving all originals, collect failure evidence and prepare an explicitly reviewed removal/restoration transaction. The role and its fixture policies/column privileges must be removed together only after no owned helper/trigger depends on them; no destructive removal script is supplied. Never rewrite made_at, promote reconstruction, delete original rows or widen authenticated grants to make acceptance pass. MM-07 remains a separate job.

Official references checked27November2026: Supabase changelog https://supabase.com/changelog.md ; triggers https://supabase.com/docs/guides/database/postgres/triggers ; RLS https://supabase.com/docs/guides/database/postgres/row-level-security . Recent listed breaking changes concern CLI/branch APIs and do not justify hosted actions. No CLI migration was generated: the SQL is explicitly an unexecuted review proposal, not a migration installation.
