# Isolated real-data preview

## Current repair candidate — 26 November 2026

The current CLI in `refresh.mjs` uses `collectPublicEdition()` from `public-edition-source.mjs`. It reads only the five approved public screens through **POST `matchmind_display_v1`** on production `toqfdrcjzwnlydqekude`. These are read-only data RPCs. It does not query anonymous raw fixture/prediction tables or fall back to the legacy GET collectors. Those collectors remain synthetic regression fixtures, not a recovery route when public access fails.

The original-logo collector also uses approved finite public RPC metadata: staging cards first, with a production public-screen supplement when older materializations omit logo fields. It never uses production raw-table GET. Stage/prod editions are independently consistent; every staging fixture must match exact source identity and approved original media URLs. Production advertised paging is not followed; missing destination membership fails.

All screens must identify the same edition, capture and expiry. The source must be fresh, complete and inside the reviewed contract bounds; unsupported or inconsistent data stops publication. Raw provider history and competition facts are not fetched. Current-client detail parity remains a separate staging acceptance requirement; do not claim old Build 355 parity solely because the projection validates.

Read-only observation at 09:05 UTC on 26 November: the approved production source validated at 1,342 cards, 303 predictions and 688,613 compact payload bytes. This is a point-in-time preflight, not a publication receipt. Staging status returned JSON null and its public Scores RPC returned HTTP 500 / `P0002` / `Verified real-data mirror unavailable`. No refresh, writer-token use, backend installation or deployment occurred.

Before hosted staging acceptance:

1. Finish local candidate review and exact-source regression/PWA receipts. Preserve `BUILD-INFO.json` with source and output hashes; use original logos for a hosted build. `--qa-no-logos` artifacts are local QA only.
2. Review existing protected environment/token bindings using metadata only. Do not paste or retrieve token values. Do not reinstall historical SQL or rotate credentials merely because these older instructions exist.
3. Prepare the preview workflow to check out the exact reviewed repair commit. It currently still names the older `codex/wo62b-public-release-20261110` branch. The template is not evidence that the candidate has been deployed.
4. Obtain separate authorization for the concrete staging refresh/Pages deployment. The user's conditional commit/push/merge permission does not by itself change this deployment gate. Keep production unchanged.
5. Require fresh source capture, successful staging-only publication and readback, expected build/source/output hashes, actual hosted consumer parity and mobile/PWA acceptance. A local source projection or synthetic browser pass is not hosted acceptance.

## Historical setup and capacity notes

The notes below preserve prior rollout history. In particular, their GET/raw-reader description predates the current bounded-RPC repair and must not be used to reopen anonymous raw access. Installation and migration instructions are not new execution authorization.

Production `toqfdrcjzwnlydqekude` is a GET-only anonymous source in the protected runner. The browser uses only staging `rdcbnvfnxenrpnnwxszs`. Nothing here installs `matchmind-settlement/2`, changes production, or generates forecasts.

## Protected setup required before installation

Repository: **kennedychinazam/matchmind-preview** (not the source repository).

1. A repository administrator creates the GitHub Actions environment **matchmind-real-data-preview**, restricting deployment branches to the preview repository's actual default branch. Retain any required environment approvals. The workflow on that branch checks out the trusted MatchMind development branch. Do not grant this environment to pull requests or forks.
2. Generate one random token of at least 32 bytes using a password manager or a secure administrative runner. Store it as the environment secret **MM_STAGING_MIRROR_TOKEN**. Do not use a Supabase service-role key. Never paste the token into chat, SQL text, logs, repository files, or workflow inputs.
3. In that same secure context compute the lowercase SHA-256 hex digest of the UTF-8 token, without a trailing newline. The matching private staging configuration must contain `decode(<digest>, 'hex')` in `mm_preview_mirror.configuration.token_sha256`. The digest is not a writer credential, but keep it in administrative configuration rather than public artifacts.
4. Before installing, confirm that the environment secret exists and the administrator has the matching digest. Run `INSTALL-staging-only.sql` **only in the staging project's administrative SQL connection**, in a session with `set mm.preview_token_sha256 = '<64-character digest>';`. The script refuses to install without this setting. It also requires the existing staging-specific schema. Do not run it against production. No installation is authorized until the protected environment setup is verified.
5. The installation transaction locks the five existing QA relations against concurrent writes, snapshots them privately, restores every snapshot through the original table type in a temporary table, and verifies complete JSON equality and fingerprints before committing. A failed check rolls everything back. Verify five rows with `verified=true` in `mm_preview_mirror.qa_backup`, no public table grants, and absence of `mm_settlement` before first publication.
6. Install the workflow from `matchmind-preview.workflow.yml` at `.github/workflows/matchmind-preview.yml` on the preview repository's default branch. It preserves the existing Pages address and schedule. The protected refresh runs before any real-mode build or deployment and fails before source requests if the token is missing. A workflow reference alone is not proof that the environment is protected or configured.
7. Run the existing workflow manually after setup. Require a successful refresh receipt, source/destination equality verification, Pages deployment, and hosted mobile acceptance before declaring the preview ready.

The dedicated token can only append closed, bounded, validated staging mirror editions. It cannot change staging source tables, QA backups, credentials, or production. Rotate it by updating both the environment secret and private hash in a controlled administrative session. The endpoint does not provide a service-role authentication fallback.

## Projection and integrity

`refresh.mjs` selects explicit contract columns from `fixtures`, `predictions`, `shared_records`, and `daily_slips`. It reads the UTC date window day minus six through day plus seven, plus exact fixture references required by the published board and today's issued slips. Each paginated query requires a stable exact count; the complete closed payload is capped at 1,000 cards and 512 KiB. Two complete reads must match before publication. A changing source fails safely and retains the previous edition.

Only AF fixtures and already-issued, non-null locked predictions with their original fixture identities, probabilities, kickoff fields and publication timestamps are projected. The closed schema removes provider/private extras. The immutable JSON edition store explicitly bridges production's typed dates/real numbers and staging's text/numeric schema without coercing or replacing source tables. It does not backfill settlement reasons or recalculate published records.

Only approved shared `board`, `engine` and `clv` projections are included. Slip coverage is the current and the previous UTC day's issued slips (`STAGING-tips-continuity-up.sql`, installed on `rdcbnvfnxenrpnnwxszs` on 2026-11-16 as the owner role; function md5 `a3568787c70e35833c958ea1276027b5` before, `c4cce72434de52045fb17ffbb0ac2735` after, owner, SECURITY DEFINER, search_path and grants unchanged, 23 editions untouched; `MM_MIRROR_PREVIOUS_ISSUE=1` is set on the refresh step). Rollback is `STAGING-tips-continuity-down.sql` after unsetting that variable. Historical bundles: some historical bundles exceed the existing reviewed contract bound, so incomplete financial/history trackers are hidden in this preview mode. No accounts, private controls, raw payloads, provider keys, financial tables or unpublished selections are exported. Bounded fixture coverage is not a full-season league table; unavailable standings remain explicitly unavailable.

The 15-minute schedule remains `8,23,38,53 * * * *`, independent of development commit changes. Measured 2026-11-14 to 2026-11-16, GitHub honoured that schedule four to six times a day (runs at 00:57, 07:45, 14:59, 20:18, 00:00 and 06:09 UTC on 15-16 November), never every 15 minutes: scheduled workflows are queued at GitHub's discretion and high-frequency crons are dropped under load. The workflow itself is not the cause; a manual `workflow_dispatch` runs within seconds. The reliable strategy inside the existing infrastructure is an external dispatch of this same workflow (`POST /repos/kennedychinazam/matchmind-preview/actions/workflows/matchmind-preview.yml/dispatches`) from the production `pg_cron` schedule that already fires `refresh-af` every ten minutes. That needs a fine-grained GitHub token with Actions write on the preview repository stored as a production Vault secret, which is a new credential the Director must create; until then the cron stays as the fallback and `workflow_dispatch` is the on-demand path. A scheduled refresh that does not run leaves the previous edition in place; it never publishes a partial one. Each accepted mirror records its source capture time, latest fixture source update, publication time, SHA-256 and counts. Editions expire after 24 hours. A schedule is not evidence of a successful refresh; inspect the latest successful receipt and hosted status. App deployment time is distinct from source freshness.

## Board rows and rescheduled kickoffs

A board row carries the kickoff at board build time. The provider reschedules upcoming fixtures between board builds (2026-11-16 00:00 UTC: eight fixtures, Brentford-Everton among them, moved a day or more after the 21:54 UTC board, and the refresh was refused as `Board fixture identity mismatch`). Board identity is fixture id, competition and both teams; date and time are read from the fixture record, which is what every consumer and `boardRowFor` key on. Neither the board row nor the fixture is rewritten, and the analysis projector still declines a board result whose row no longer matches the kickoff it was built for.

## Capacity: the 2026-11-19 refresh outage

From 2026-11-19 04:05 UTC every refresh was refused by the staging publisher with HTTP 400, and the last edition expired at 2026-11-19 23:06 UTC. `mm_fixture_delivery.payload_valid` applied a 524288-byte legacy gate to the whole analysis-stripped edition, measured as PostgreSQL jsonb text. The real window grew from 710 fixtures on 16 November to 858 on 20 November, and the stripped edition reached about 557,000 bytes. JavaScript measured the same payload in compact JSON and passed it, so only the database refused it, and the refresh logged nothing but the status code.

Old clients apply the 512 KiB bound to one screen response and refuse an oversized one themselves, so the edition-wide gate protected nobody. `STAGING-capacity-up.sql` removes it, and removes the board kickoff comparison that the JavaScript validators dropped on 16 November. The 1 MiB full-edition bound and the 1000-card bound stay, and v1 still strips analysis and bundles over 40 legs. `STAGING-capacity-down.sql` restores the exact earlier text. A refused refresh now prints the publisher's reason.

Remaining margin, measured 2026-11-20: the first edition after the fix (`5f36484c`, 858 fixtures, 265 issued forecasts) is 872,196 bytes against the 1,048,576-byte bound, about 1,016 bytes a fixture. The window reaches about 988 fixtures on 26 November, which projects to roughly 1,004,000 bytes and sits against the 1000-card bound. Either bound is likely to refuse a refresh in the last week of November. A refused refresh keeps the previous edition until it expires 24 hours later, then the preview shows data as unavailable. Raising a reviewed bound or narrowing the 14-day window is a Director decision.

## Per-competition facts: goal-market base rates and the League Table (Build 355 parity)

Build 355 prices Over 1.5/2.5/3.5 and BTTS with `footballEngine.marketsFor(lambdaH, lambdaA, rates())` and draws the League Table with `tableAsOf`/`tableAt`/`seasonRoster`/`latestSeasonOf`, all over the competition's finished matches in the browser. **Window: 60 months.** 355's league read is `date >= cacheCutoff()` with `CACHE_MONTHS = 60` (build 306): the recent half is read first and the settled half in the background, before the daily issue. The comment at that read still says "24 months"; it was written before build 306. `COMPETITION_MONTHS` in `analysis-projection.mjs` is the single constant, counted back from the capture day (UTC) and including that day. Score rule: 355 `settledScore`. A finished status (`FT`, alias `FINISHED`, `AET`, `PEN`) needs both goals. A whole, non-negative `ft_h`/`ft_a` pair no greater than the final score is used; otherwise the final score is used. On 2026-11-20 every in-window production row was stored as `FINISHED`.

The runner reads only explicit columns (`fxid,lid,season,round,date,status,home,away,gh,ga,ft_h,ft_a,updated_at`). Reads are GET-only and AF-only, one competition at a time, in eleven half-year slices; the largest slice measured on 2026-11-20 held 791 rows, under readPages' 1000-row bound. Upcoming `NS` fixtures up to 60 days ahead (355 `LEAGUE_AHEAD_DAYS`) are also read, for the season and the roster. The finished rows never leave the runner. Each competition publishes, once, the counts `n/btts/o15/o25/o35` and a table of at most 64 rows. A larger table is omitted, never truncated. A failed or oversized read omits that competition's entry and adds an `analysis_warnings` row. The browser turns the counts into the same object `rates()` returns, with the same rule that fewer than 30 results gives `null`. It registers the competition's DAMPEN exactly as `registerLeagueDampen` does, then calls the unchanged engine. Read budget upper bound: 100 competitions × 11 reads × 5 pages × 2 passes, plus the upcoming reads. On 2026-11-20 it is about 1,000 GETs per pass.

Transport: `STAGING-analysis2-up.sql` adds `competitions` to the closed `payload_valid` schema. `display()` returns it on scores/predictions/history. `v1` and `v2` strip it, because their open tabs refuse unknown envelope keys, and the new `mm_preview_display_v3` returns it. **Order:** install the SQL, deploy the UI that reads v3, then publish. `STAGING-analysis2-down.sql` drops v3 and restores the exact prior function text. Stored editions are untouched.

## Verification and rollback

`test/real-preview-mirror.test.mjs` uses an isolated Docker Postgres and synthetic browser responses; it never calls production. Run it with `test/staging-preview.test.mjs`. The real builder is separate from the unchanged synthetic builder. Generated real files must be scanned against all locally available protected values before pushing. Missing protected values cannot be certified by a scan.

`verify-hosted.mjs` checks the expected development SHA, staging edition, complete approved fixture inventory and prediction count, original probability display, competition filter, match details, truthful standings limitation, no QA fixtures, guest mode and network isolation at 320px and 390px. The preview workflow retains screenshots and non-private acceptance evidence.

After every publication the runner compares staging readers with the private source request by fixture ID, every projected prediction field and original timestamp, and the exact payload digest. Confirm the QA source relations still match their private backup fingerprints. Keep extracted requests outside the repository with mode 0600; they are not deployment artifacts.

To stop refresh and hide real data, an administrator sets `mm_preview_mirror.configuration.enabled=false` in staging. This blocks both publication and display; no production state changes. To roll back one faulty edition, disable first, review evidence, remove only that identified mirror edition administratively, then re-enable a reviewed unexpired edition. Do not relabel an expired edition as fresh. QA source tables and original synthetic reader remain unchanged, so restoring the prior preview workflow/builder restores the QA mode without restoring database rows. The private typed, verified QA backups remain available for controlled restoration if unrelated changes later damage those tables. Do not restore source tables merely to switch preview modes.

## Recovery status

The earlier six implementation files were recovered on 2026-11-12. The temporary 745-card / 247-prediction extraction was lost when the environment disconnected; those counts are historical evidence, not a current acceptance result. Two matching GET-only source reads at 2026-11-12 18:31:40 UTC found 739 fixtures and 241 linked predictions, with latest fixture update 18:30:24 UTC and payload SHA-256 `aeabb04f03b4681cfb033bc351d78df885905bd91430c87be6d7a41ff14f6855`. This extraction remained private and was not published. No remote endpoint installation, real-data transfer or hosted real-data acceptance has yet been verified. The existing proposed settlement migrations remain inactive.

## Capacity options awaiting decision

Prepared 2026-11-20, not installed. Each option is a separate local branch from `9c3c355` and can be taken alone. Nothing below has been run against a hosted database.

Measured fact that applies to both: the staging byte bounds measure PostgreSQL `jsonb::text` (`octet_length(v::text)` in `payload_valid`), which prints a space after every `:` and `,`. On a synthetic edition shaped like the real one (about 1,027 compact bytes a card) that text is 1.1155 times the compact JSON the JavaScript validators measure. So the SQL 1 MiB gate is reached at roughly 940,000 compact bytes (about 915 cards at today's density), earlier than the 26 November projection above, which compares compact bytes with the bound. The real ratio has not been measured on a real edition.

### Option A: raise bounds (branch `capacity/options-20261120`)

Bounds after: 1500 cards and 2 MiB (2,097,152 bytes) for the full edition, in every copy:
`contract.mjs` (`MAX_DOCUMENT_BYTES`, `PAYLOAD_SCHEMA.cards.max`), `refresh.mjs` (`MAX_SOURCE_ROWS`, derived from the contract, drives the pagination loop, the source count bound and the linked inventory bound), `index.html` (`FIXTURE_DISPLAY_SCHEMA` cards max, `fixtureEnvelope` card and byte bounds), `staging/original-logos.mjs` (catalog and membership bounds; without this the workflow's logo step fails at 1001 cards after a successful refresh), and staging SQL via `STAGING-capacity2-up.sql` (`payload_valid` schema `"max":1500` and `octet_length(v::text)>2097152`; `publish` `octet_length(wire)>2097152`). Unchanged: the board's 1000-row bound (it covers seven days ahead), 128 slips, 90/40 legs, the v1 strip, the 14-day window, and the production delivery path (`PROPOSAL-up.sql`, `refresh-presentation.mjs`), which stay at 1000 cards and 512 KiB.

Headroom: the card bound binds first; 2 MiB of jsonb text is about 1,880,000 compact bytes, about 1,830 cards.

Client cost, local Chromium 1243 headless at 390x844, synthetic TEST ONLY editions (60 competitions over 14 days, every card with analysis, a third with forecasts), median of 5 fresh pages, milliseconds:

| cards | compact bytes | JSON.parse | fixtureEnvelope validate | Scores load (3 RPCs+validate+state) | Scores render | Analysis load (loadCloudLeagues) | Analysis render | JS heap MB |
|---|---|---|---|---|---|---|---|---|
| 858 | 881,388 | 5.2 | 66.6 | 73.1 | 1.7 | 95.9 | 3.3 | 16.1 |
| 1000 | 1,027,620 | 5.4 | 56.8 | 79.7 | 2.3 | 136.8 | 4.4 | 17.5 |
| 1500 | 1,545,968 | 8.0 | 75.0 | 105.6 | 1.6 | 159.2 | 5.1 | 34.9 |
| 1500, 4x CPU throttle | | 22.0 | 238.5 | 306.0 | 7.9 | 643.2 | 25.5 | 32.6 |

(4x throttle at 858 cards: load 196.6 / 341.7 ms.) Render is cheap because both lists render one day; the cost is in validating and building state from three whole-edition screen responses. Not measured: real phones, network transfer of a 1.5 MB response three times per load, service-worker cache size.

User-visible: nothing changes until the window passes 1000 cards; then the preview keeps refreshing instead of going to "data unavailable". Legacy (v1) clients already refuse oversized screen responses themselves and keep doing so.

Combined rollout with Analysis v3, fixed order (both edit the `payload_valid` schema literal): `STAGING-analysis2-up.sql`, then `STAGING-capacity2-up.sql`; roll back `STAGING-capacity2-down.sql`, then `STAGING-analysis2-down.sql`. capacity2-up refuses unless analysis2 is installed, and analysis2-down refuses while capacity2 is installed. `test/rollout-analysis2-capacity2-sql.test.mjs` reproduces the installed staging state (INSTALL, analysis, issued-tips, tips-continuity, capacity), checks its recorded md5s, runs both steps and both rollbacks, and prints the function md5s after each step (`ROLLOUT_MD5`).

Install order: `STAGING-capacity2-up.sql` (admin connection; it switches to `mm_preview_mirror_owner` for the publisher), then deploy the code. Rollback: revert the Option A commit and redeploy first, then run `STAGING-capacity2-down.sql`, which restores the exact earlier text of both functions and refuses to run if the up file is not installed. Editions published above the old bounds stay readable until they expire. Tests: `test/capacity2-sql.test.mjs` (Docker, CI-style) and `test/capacity-bounds-consistency.test.mjs`.

### Option C considered: Build 355's direct reads (not prepared)

Production Build 355 (`origin/main:index.html`) has no 1000-card or 1 MiB ceiling because it has no edition. Each signed-in client reads production tables itself: `fetchLeagueFixtures` pages `supa.from(LEAN_VIEW)` per competition with `.range()` at `PAGE = 5000`, a constant coupled to the project's Data API `Max rows` setting (raised to 5,000 on 2026-09-08); `fetchAllRows` pages other tables the same way; settled history is cached in IndexedDB (`HIST_DB`) so later loads start at a cutoff. Its own notes measure 26,346 rows and 17.8 to 98.5 s forced league loads, and name the hazard: the loops stop on a short page, so a lowered server cap truncates silently with no error.

It does not fit the mirror: the preview client must never read the production source (the real-preview builder blocks every origin but staging RPCs), the source reader is the runner's bounded GET with exact `count=exact` totals rather than a short-page stop, and a reader must see one atomic, digest-checked edition. Splitting the mirror edition per screen or per day would keep those properties, but it is a new design (multi-document atomic publish, per-day readers, client merging, new verification), not 355's approach, and it is not prepared here.
