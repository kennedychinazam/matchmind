# MatchMind PRO — Build 355 Recovery Baseline

**Captured:** 2026-10-23
**Production source repository:** `kennedychinazam/matchmind`
**Original deployed commit:** `036f09b29f27a10c7d8bdcec1f16efd557c714e4`
**Recovery branch:** `backup/build355-20261023`
**Working branch:** `feature/matchmind-quality-upgrade`
**Supabase project ref:** `toqfdrcjzwnlydqekude`

## Recovery scope

The recovery branch fixes the original website and GitHub publisher code at the listed commit. It does **not** back up Supabase production database records, settings, function secrets, or the deployed Edge Function source code. Restoring GitHub alone does not restore the database or deployed functions.

All new application work must remain on the development branch or a separate staging workspace until reviewed and approved. Do not modify `main`, manually run production publishing, change paid AI settings, or deploy SQL/Edge Functions without a separate verified rollback path.

## Supabase Edge Functions — inventory only (not copied to public GitHub)

| Function | Deployed version | JWT verification | Bundle SHA-256 |
|---|---:|:---:|---|
| `ai-analyze` | 17 | enabled | `dc6dde9ec55c388350013e13cbf4bca2afa9b8a30bab7a0d9e8339e89ebbf2e0` |
| `ai-shadow` | 2 | enabled | `ac0a17d24aa349bd1467c642c33493eabba0864ff271102f9554cf2206b64284` |
| `refresh-af` | 54 | enabled | `53d5588d1f9d95d210a0c18f01644366d40469b54c95be38d7ac969d4ed303b8` |
| `send-push` | 9 | disabled (function enforces its own checks) | `d15ea2e781430f30c15304646d7105b00001199c7c18a5c9aab0633db1ffe43d` |
| `delete-account` | 2 | enabled | `3b44d4dff34c6611573d2f1b5c86673b8e6c984055a90125dda26c170cbca315` |

The 5 source files were inspected through the Supabase connector and checked for common literal credential patterns, but this is not a comprehensive secrets audit. Because this repository is public, **do not add those server-side sources, private keys, service-role tokens, CRON authentication secrets, or .env files here** without a dedicated security review and deliberate decision.

## Before any production backend change

1. Export current Edge Function sources into protected **private storage** with suitable access controls.
2. Produce and test a recoverable production database backup; do not mistake a Git backup for a data backup.
3. Record schemas, RLS policies, indexes, extensions, cron jobs, and connection permissions.
4. Develop and test migrations on staging; include forward, backward, and data-loss assessments.
5. Test GitHub Actions and user-visible predictions against the Build 355 baseline.
6. Obtain explicit approval before deploying a production change.

## Initial data-audit findings

- Historical 1X2 independent provisional measurement: 1,763 eligible pre-kickoff completed predictions, approximately 50.37% most-probable-outcome accuracy, Brier score (sum of three components) 0.6146, log loss 1.0257.
- The 53 records whose creation timestamps are after kickoff are old reconstructed Build -1 entries and were excluded.
- This is **not** the blended-market headline pick accuracy and must not replace the official grading metric.
- Historical match and odds records are available. Some advanced match features are sparse or not live in the core forecast.
- AI shadow is intentionally paused, and paid AI must remain disabled pending approval.

**Restoration note:** To restore application code, deploy the tree associated with the exact baseline commit on `main` using a reviewed revert/reset procedure. Do not force-push `main` without explicit authorisation. Restoring Supabase requires the separately tested backend/database procedure.
