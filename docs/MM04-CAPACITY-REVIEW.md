# MM-04 capacity review — 26 November 2026

Status: read-only investigation and proposed prevention plan complete for primary assessment. No retention implementation, hosted staging acceptance, cleanup, plan upgrade or deployment is accepted by this report.

## Scope and evidence

Only MatchMind production `toqfdrcjzwnlydqekude` and staging `rdcbnvfnxenrpnnwxszs` were queried. EDUVANTA and all other projects were excluded; project/organization listings were not requested. Hosted operations were catalog/aggregate SELECTs only. No credentials, tokens, user rows, provider payload values, cron commands or cron return messages were retrieved. Column names such as command/return_message appear only in catalog metadata. No source/runtime changes, Git writes, SQL mutations, DDL, vacuum, deletion, cache/session-setting changes, spend or deployment occurred.

Machine-readable evidence with exact SQL, project scope, results and limitations is in `work/mm04-capacity-20261126.json`. Q1 initially used three SELECT statements; the connector returned only the last column-metadata result. Q2 therefore returns size and relation results together in one SELECT. Q3 inventories indexes, FK/catalog dependencies and public relation names. Q4 produces bounded cron ages, a recent-odds sample and routine-name dependency candidates. Queries were not repeated for unchanged observations.

Production Q2 timestamp: **2026-11-26 09:24:24.698473 UTC / 10:24:24.698473 Lagos**. Staging: 09:24:25.403039 UTC. Q4 aggregate timestamp: 09:25:11.860196 UTC. Each query is its own observation; the database continued normal activity.

## Physical allocation and observed change

| Metric, bytes | 25 Nov 19:19:48 UTC | 26 Nov Q2 | Change |
| --- | ---: | ---: | ---: |
| Production current database | 421,194,899 | 424,283,283 | +3,088,384 |
| Staging current database | 18,192,051 | 18,192,051 | 0 |
| Production fixtures total | 248,250,368 | 249,839,616 | +1,589,248 |
| Production odds_snapshots total | 116,703,232 | 117,522,432 | +819,200 |
| Production cron.job_run_details total | 33,636,352 | 34,332,672 | +696,320 |

Production is 424.283 decimal MB / approximately 404.628 MiB. Leading three relations total 401,694,720 bytes, **94.676%** of the measured database. Relation deltas need not sum to database delta because other allocations change. The older 417,213,587-byte handover snapshot lacks a verified interval here and must not be used to calculate a rate.

The timed interval is 14.07686 hours. Its net physical allocation change corresponds arithmetically to **5.265 decimal MB/day over this interval only**. This is an observation, not a sustained growth forecast: page allocation, churn, autovacuum/reuse, TOAST and workload vary. No row-insert rate can be inferred from physical bytes alone. Staging's flat allocation does not prove freshness or working RPCs.

| Production relation | Main heap | Table including TOAST/auxiliary | Indexes | TOAST total (already included in table) | Total | Approx. live / dead tuples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fixtures | 142,819,328 | 216,014,848 | 33,824,768 | 73,129,984 | 249,839,616 | 137,831 / 12,473 |
| odds_snapshots | 112,664,576 | 113,410,048 | 4,112,384 | 688,128 | 117,522,432 | 56,359 / 0 |
| cron.job_run_details | 33,136,640 | 33,169,408 | 1,163,264 | 8,192 | 34,332,672 | 0 / 0 (unusable) |
| predictions | 638,976 | 679,936 | 237,568 | 8,192 | 917,504 | 3,080 / 97 |
| predictions_retired | 532,480 | 573,440 | 98,304 | 8,192 | 671,744 | 0 / 0 (unpopulated) |
| competition_measures | 81,920 | 122,880 | 16,384 | 8,192 | 139,264 | 68 / 28 |

Do not add TOAST twice. Table size includes TOAST and auxiliary forks; main heap excludes those. Tuple values are PostgreSQL estimates, not exact counts or reclaimable bytes. Fixtures' estimated dead fraction is about 8.30% of estimated live+dead tuples; different row widths/TOAST mean this is not a byte-recovery estimate. Its last autovacuum was 06:51:30 UTC and autoanalyze 08:50:41 UTC. Odds planner rows 54,949 differ from live estimate 56,359, illustrating drift. Cron planner rows are -1 and live/dead both zero despite the bounded exact count below: those stats cannot certify emptiness or absence of bloat. No bloat extension or expensive relation scan was run.

Staging's leading relation is mm_preview_mirror.editions: 5,324,800 bytes, including 5,259,264 TOAST bytes and 16,384 index bytes; stats estimate 38 live / 0 dead. It has a substantially different schema from production (e.g. staging odds_snapshots contains fxid/prices, without production captured_at/id). Staging is unsuitable for directly rehearsing production retention until schema and representative synthetic workload are prepared and verified.

## Cron age and incident evidence

Q4 selects only runid/start_time/end_time/status, ordered by indexed runid, with a hard 60,001-row cap. It observed **51,033 visible rows**, below the cap, so these aggregate ages cover the visible table at that query snapshot. This is one bounded pass over roughly 34 MB allocated; no expensive unbounded provider-payload scan was used.

| Age at Q4 | Rows |
| --- | ---: |
| Under 1 day | 721 |
| 1 to under 7 days | 3,772 |
| 7 to under 30 days | 9,959 |
| 30 to under 90 days | 24,377 |
| At least 90 days | 12,204 |
| Null start_time | 0 |

Oldest start: 25 July 2026 03:00:00.194882 UTC. Newest: 26 November 09:23:00.512048 UTC. There were **79 non-succeeded rows**, including **6 older than 30 days**, and no rows with null end_time. This does not prove downstream delivery success: a succeeded cron wrapper can still enqueue a failed provider/refresh operation.

There are 36,581 rows older than 30 days; 36,575 of those have succeeded status. These are *policy-review candidates*, not approved deletion targets. Counts have risen by 425 versus yesterday; old-age buckets also change as rows age, so their delta is not an insertion count. If a future observation reaches the cap, label buckets partial and redesign the read rather than silently extrapolate.

## Dependencies that block blanket retention

Q3 found valid production indexes: fixtures date, primary fxid, league+fxid, league+updated time, provider, provider+status+date, detail queue and stuck-fixture partial indexes. Odds has primary id and (fxid, captured_at DESC). Cron has only primary runid. There is **no standalone captured_at index or cron start_time index** in this inventory. Time-only cleanup can scan/sort; a future design must choose bounded PK candidates plus timestamp recheck or separately review an appropriate index. No index creation/drop is proposed for immediate execution. An unused-index notice would not justify removing these indexes.

No FK involving the selected fixtures/odds/prediction/history/calibration/cron tables was returned. Catalog dependencies include fixtures -> competitions/fixtures_lean views and odds_snapshots -> odds_latest view. Q4 source-text matching (without returning routine bodies) also found mm_fixture_delivery.odds_projection(cards jsonb) and extensions.grant_pg_cron_access(). Catalog absence is incomplete evidence: routine bodies, dynamic SQL, collectors, publisher code, archives and external analysis can depend on these tables without a recorded FK.

Local source confirms why deleting down to one latest snapshot per fixture would lose evidence:

- `release/odds-display/ODDS-DISPLAY-up.sql:24-30` chooses a pre-kickoff capture for current public prices; that is only one consumer.
- `index.html:12460` records that fixtures hold closing 1X2 prices while other markets require odds_snapshots. `index.html:15332-15369` retains the capture-time history used for pricing/record research. Issuance-time prices and closing prices are different evidence.
- `index.html:3642,6404` and the archived handover describe 60-month competition/history dependencies; prediction records, retired claims, calibration cohorts and settlement corrections must survive.
- `competition_measures`, `predictions`, `predictions_retired`, shared records and AI shadow evidence are small relative to fixtures/odds. Their removal would save little while weakening auditability.

This review establishes a dependency checklist, not a complete archive validation. No raw odds/history payload was exported or archive restore attempted.

## Proposed policy, pending concrete review and authorization

1. **Cron first, after incident review:** retain all recent 30-day runs. Propose eligible *successful* runs older than 30 days for a private, sanitized operational archive/rollup before bounded expiry. Retain non-succeeded runs for at least 90 days and retain incident-held records until the incident is resolved and evidence preservation is verified. The six older failures must be accounted for explicitly. Preserve enqueue/downstream timing correlations and relevant MM-08 publication-gap evidence. Do not export raw command/return_message values into this report or a public repository; a separately reviewed archive must redact secrets and define access/retention.
2. **Odds/history:** retain all captures now. Before any thinning, define immutable issuance-time and closing-price evidence per published/retired/Lean/slip/CLV record, market/bookmaker selection, capture UTC, source/algorithm version, confidence/claim version, result/correction lineage and calibration cohort. Verify coverage and deterministic replay against a private archive with manifest, count, schema/version and cryptographic hashes, including a restore test. Only then consider archiving redundant intermediate captures beyond a proposed 90-day online window. Ninety days is a review proposal, not an established safe horizon; reproduce longer pricing/calibration windows before adopting it.
3. **Fixtures:** retain the required 60-month compact history and every referenced forecast/settlement/evaluation fixture. Inventory which bulky event/lineup/provider fields are actually required by context, grading and research before proposing an archival projection. Do not truncate all old fixtures or discard TOAST based only on size. Archive access controls, licensing and restore/replay requirements need review.
4. **Maintenance:** distinguish reusable free space from reducing physical allocation. Any future bounded deletion should be followed by normal observed maintenance behavior. Do not promise deletion will immediately shrink disk/billing. No immediate VACUUM FULL, table rewrite, blanket delete or plan upgrade is proposed. Any such operation needs a separate lock, temporary-space, backup/rollback and authorization review.

## Trend, verified headroom and alert proposal

The actual account plan, billed usage, provisioned disk, cluster total, WAL and quota were **not inspected**. No billing headroom or days-to-quota can be stated. [Supabase database/disk docs](https://supabase.com/docs/guides/platform/database-size) distinguish cluster database metrics, other disk files and daily metric updates; our current-database SELECT is narrower. [Disk billing docs](https://supabase.com/docs/guides/platform/manage-your-usage/disk-size) distinguish provisioned paid-plan disk from Free database-size limits. The [changelog](https://supabase.com/changelog.md) was checked; no relevant change requires a mutation for these SELECT measurements. No price/plan recommendation follows from physical size.

Propose, without configuring an automation or cron job:

- Record Q2 physical bytes/components once daily at a consistent UTC time for at least 7 days, preferably 14, alongside source build, workload and any maintenance events. Use relation estimates; cap any row-age query. Retain at least 30 daily observations locally/private operational telemetry. Derive 7/14-day net slope with range, including flat/shrinking intervals.
- Obtain a read-only receipt for **these exact projects** from their Usage/Database Reports/Database Settings showing timestamp, units, actual plan, corresponding quota/provisioned disk and same-metric usage. Avoid organization/project enumeration or credential access.
- Once capacity C and usage U are verified in matching units/metric, calculate headroom C-U and utilization U/C. Propose warning at 80%, critical at 90%, plus warning when measured same-metric runway is below 30 days and critical below 14 days. Runway uses conservative positive multi-day growth, never this single interval alone. For paid provisioned disk include operational WAL/temp/maintenance reserve; a billing allowance is not necessarily an operational capacity ceiling. If C is unverified, quota/runway alerts remain unavailable.
- Independently flag physical net growth over 10 decimal MB/day across two daily observations (a provisional investigation threshold, not a quota), stale daily telemetry over 36 hours, or zero/uninitialized statistics on a major relation. Preserve incident evidence and investigate volume/churn before choosing retention or spend. No automatic cleanup or upgrade.

## Separate capacity surfaces and next gates

Parent's 26 November 09:05 UTC public validation receipt reports 1,342 cards, 303 predictions and 688,613 compact bytes, with staging mirror unavailable/HTTP500. These were not remeasured here. Local reviewed staging bounds are 1,500 cards / 2 MiB versus production 3,000 / 4 MiB. Compact public bytes are not necessarily the validator's exact serialization, and payload limit headroom must be measured in its own format. Increasing those limits neither repairs database growth nor the S20 localStorage failure.

The S20 storage issue concerns origin/device browser persistence and owner recovery. Physical hosted bytes cannot establish its exception/cause, and deleting hosted history would not prove a phone-storage fix. MM-01 physical/legacy gates and MM-03 hosted fresh-staging acceptance remain open.

**Next safe action:** primary review of this evidence and proposed policy; obtain same-metric plan/usage receipt for the two exact projects and continue daily read-only trend collection. No further runtime work was started. Any retention implementation requires an explicit reviewed candidate, archive/restore and dependency checks, representative staging acceptance, performance/lock/space bounds and separate database-mutation authorization. Broad source changes remain behind fresh hosted staging acceptance. MM-05 remains the next hierarchy item only after primary acceptance and its applicable gates.
