# Isolated real-data preview

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

Only approved shared `board`, `engine` and `clv` projections are included. Slip coverage is **today's issued slips only**: some historical bundles exceed the existing reviewed contract bound, so incomplete financial/history trackers are hidden in this preview mode. No accounts, private controls, raw payloads, provider keys, financial tables or unpublished selections are exported. Bounded fixture coverage is not a full-season league table; unavailable standings remain explicitly unavailable.

The 15-minute schedule remains `8,23,38,53 * * * *`, independent of development commit changes. Each accepted mirror records its source capture time, latest fixture source update, publication time, SHA-256 and counts. Editions expire after 24 hours. A schedule is not evidence of a successful refresh; inspect the latest successful receipt and hosted status. App deployment time is distinct from source freshness.

## Verification and rollback

`test/real-preview-mirror.test.mjs` uses an isolated Docker Postgres and synthetic browser responses; it never calls production. Run it with `test/staging-preview.test.mjs`. The real builder is separate from the unchanged synthetic builder. Generated real files must be scanned against all locally available protected values before pushing. Missing protected values cannot be certified by a scan.

`verify-hosted.mjs` checks the expected development SHA, staging edition, complete approved fixture inventory and prediction count, original probability display, competition filter, match details, truthful standings limitation, no QA fixtures, guest mode and network isolation at 320px and 390px. The preview workflow retains screenshots and non-private acceptance evidence.

After every publication the runner compares staging readers with the private source request by fixture ID, every projected prediction field and original timestamp, and the exact payload digest. Confirm the QA source relations still match their private backup fingerprints. Keep extracted requests outside the repository with mode 0600; they are not deployment artifacts.

To stop refresh and hide real data, an administrator sets `mm_preview_mirror.configuration.enabled=false` in staging. This blocks both publication and display; no production state changes. To roll back one faulty edition, disable first, review evidence, remove only that identified mirror edition administratively, then re-enable a reviewed unexpired edition. Do not relabel an expired edition as fresh. QA source tables and original synthetic reader remain unchanged, so restoring the prior preview workflow/builder restores the QA mode without restoring database rows. The private typed, verified QA backups remain available for controlled restoration if unrelated changes later damage those tables. Do not restore source tables merely to switch preview modes.

## Recovery status

The earlier six implementation files were recovered on 2026-11-12. The temporary 745-card / 247-prediction extraction was lost when the environment disconnected; those counts are historical evidence, not a current acceptance result. Two matching GET-only source reads at 2026-11-12 18:31:40 UTC found 739 fixtures and 241 linked predictions, with latest fixture update 18:30:24 UTC and payload SHA-256 `aeabb04f03b4681cfb033bc351d78df885905bd91430c87be6d7a41ff14f6855`. This extraction remained private and was not published. No remote endpoint installation, real-data transfer or hosted real-data acceptance has yet been verified. The existing proposed settlement migrations remain inactive.
