# Final Phase 4 evaluation

Status: complete. The limited selector change is adopted in branch SQL only. Production and hosted services are untouched. Infrastructure optimization stops here unless a critical correctness/security defect is found; accuracy, calibration, bookmaker comparisons and controlled shadow evaluation are next.

## Decision and measurements

Four independent paired rounds ran in fixed AB/BA/AB/BA order: repeated/diverse teams across two competitions, fresh/prefilled immutable manifests, and 1/2/5/10 workers. Each trial used a clone of the same 76,497-observation archive, fresh statistics, the cached PostgreSQL 17 image and no network. There were 576 timed captures and 128 trial runs. No extra images or services were installed.

The rule was fixed before measurement: all success/parity checks; no cell client/server median or p95 regression exceeding both 5% and 10 ms; at least 12/16 cells improving server median and p95; and pooled median/p95 at least 5% faster. The candidate passed: **16/16 cells improved both server median and p95; no meaningful client/server regression**.

Pooled server median: **782 → 644.5 ms (17.6% faster)**. P95: **2,016 → 1,766 ms (12.4% faster)**. Maximum: 2,602 → 2,401 ms. Maxima were not the decision criterion.

| Ten workers | Current median / p95 / max (ms) | Narrow median / p95 / max (ms) |
| --- | ---: | ---: |
| repeat, fresh | 1302.5 / 2126 / 2210 | 1107 / 1785 / 1856 |
| repeat, reused | 1079 / 1856 / 2010 | 853 / 1586 / 1626 |
| diverse, fresh | 1492.5 / 2460 / 2602 | 1269 / 2343 / 2401 |
| diverse, reused | 832.5 / 1432 / 1468 | 717.5 / 1157 / 1181 |

The change retains only fixture ID, field name, value and observation ID in the materialized intermediate result. Eligibility filters, latest-version ordering, history scope, probabilities, models, hashing, quotas, publication trigger and permissions are unchanged. No outbox was implemented. The original global admission lock remains; its summed budget-check median at ten workers fell about 1,100→925 ms for repeated/fresh and 1,233→1,033 ms for diverse/fresh. This is wait plus quota bookkeeping, not a pure lock timer.

Resource artifacts include per-cell median/p95/max, wait samples, stage times, allocated tables/indexes and PostgreSQL counters. Temporary-byte counters include setup/validation; Node observer RSS is not database RSS. Maximum trial database size was 107.8 MiB; the separate 30-diverse-capture storage test reached 154.4 MiB of research data/indexes. Two-CPU local results are not a hosted SLA or proof of <=5% representative publisher overhead. Four paired rounds give only four one-worker samples per cell; the archived decision is deliberately conservative, not a statistical confidence guarantee.

## Correctness and regressions

- All **576/576 captures** succeeded with no backlog; every stored snapshot hash and manifest read/count was verified. Current/candidate roots matched in every paired trial. Full M14 vectors matched full eligible history for all 20 distinct target/root combinations; immutable inputs allowed caching that reference check across trials.
- The new temporary-write regression failed against the wide implementation and passed after the change. It compares actual EXPLAIN/BUFFERS writes and all evidence IDs with the pinned wide reference.
- Upgrade/reapplication/rollback tests preserve original envelope/hash and private permissions. All existing timing, unverified-correction, Unicode, quota, monitoring, publisher-race, replay and browser/Smart Bet regressions remain in the complete suite.
- **Node 20.20.2: 107/107; Node 24.19.0: 107/107**, zero failures/cancellations/skips. The six added tests cover decision safety and projection/upgrade behavior. The existing statistical engine and UI were not changed.

## Measured storage and projections

Data and all indexes (including TOAST indexes) are accounted separately. The seeded archive uses 70.02 MiB: 61.01 MiB observation data, 9.01 MiB indexes, approximately 0.01 MiB control data. Thirty repeat-pair captures raise total allocation to 80.21 MiB; thirty diverse captures raise it to 154.38 MiB. After the first ten, marginal manifest data+indexes are about **156 KiB/prediction repeated versus 2.72 MiB/prediction diverse**. These are synthetic page-allocation slopes, not universal rates.

Polling used the real append/dedup path: 100 fixtures × six fields × 21 polls. Zero-change polls retained 600 rows with **zero subsequent storage growth**; nominal 1%/10% change profiles retained 698/1,696 rows. Constant odds prices with new ID/receipt envelopes retained **2,100/2,100 versions**. Stable source identifiers are essential; volatile provenance/envelope fields can defeat value deduplication.

Assumptions: new fixtures/day equal predictions/day; 36 initial fields/new fixture, six polled fields; one odds observation per poll; no purge, compression redesign or paid expansion. Repeat/diverse mixtures use measured post-startup slopes. A documented linear growth of selected history (12 additional references per new fixture per competition group) increases cumulative manifest requirements; this is illustrative, not an upper bound. Forecast indexes are not double-counted. A **25% reserve** is applied to totals for planning.

| Scenario | Predictions/day | Poll interval / active hours | Changed fields | Repeat-style share | 30 days MiB | 90 days MiB | 180 days MiB |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| small shadow pilot | 2 | 15 min / 6 h | 1% | 95% | 116.2 | 177.9 | 281.4 |
| focused coverage | 10 | 5 min / 6 h | 5% | 50% | 741.5 | 2,326.4 | 5,396.3 |
| broad frequent collection | 30 | 1 min / 12 h | 10% | 10% | 5,418.1 | 20,355.2 | 53,450.8 |

Totals above include the initial archive and reserve. Values above the budget describe unconstrained required capacity, not allowed writes. The pilot’s 95% repeat-style assumption is optimistic; real match diversity can materially increase requirements.

| 30-day components, before reserve (MiB) | Observations | Manifests/chunks | Snapshots | Operational | All indexes |
| --- | ---: | ---: | ---: | ---: | ---: |
| small shadow pilot | 64.98 | 4.79 | 0.17 | 0.02 | 23.01 |
| focused coverage | 103.28 | 123.42 | 0.86 | 0.09 | 365.55 |
| broad frequent collection | 1,226.65 | 732.07 | 2.58 | 0.24 | 2,372.95 |

The unchanged admission setting is **262,144,000 bytes = 250 MiB**, not a physical disk/WAL cap. With reserve, the small pilot crosses 200 MiB around day 111 and 250 MiB around day 154; focused coverage crosses around days 6/8; broad frequent collection around days 1/2. Actual admission can reject earlier because it reserves estimated pending work. Keep the existing 150 MiB warning / 200 MiB collection-stop planning thresholds; do not automatically raise budgets, drop referenced evidence or shorten manifests.

Uncertainty: page granularity, normalized-member index amplification, changing chunk boundaries/reuse, larger real lineups/events, new competition archive seeds, unbounded target history and mutable health bloat. Forecasts exclude WAL, backups, other application/Auth data, AI payloads and external API quotas/costs. The 25% reserve does not certify an upper bound. Payload sizes and cohort reuse need confirmation before any future collection.

## Minimal safe next steps

1. Preserve this reviewed version and choose a short, explicitly bounded future trial that fits measured capacity. Monitor actual category growth and private backlog; keep paid AI/provider calls disabled.
2. In a future adequate environment, verify Auth-issued JWTs/issuer/audience/expiry/revocation, actual-user RLS, PostgREST/RPC exposure and Edge authentication/runtime behavior. Local SQL-role tests do not establish those guarantees. No further Supabase installation is authorized in this workspace.
3. Obtain private collector/schema/function contracts outside public Git and test a separate isolated publisher harness. Do not run the production robot against staging. Original baseline-input/configuration replay remains incomplete; do not relabel reconstruction as pre-issue evidence.
4. Before separately approved deployment, privately back up and restore-test, review managed-role grants and exact migration targeting, exercise failure monitoring/reconciliation, and retain the existing publication-preserving rollback. No deployment or hosted resource creation is authorized here.

Fresh disposable installs use the changed `evidence-manifests.sql`. Existing reviewed local schemas use `audits/staging/narrow-selector-upgrade.sql` transactionally as the established owner; rollback uses `narrow-selector-rollback.sql`. Both replace only the function and preserve evidence. These are local SQL artifacts, not an executed Supabase migration history. A hosted migration still needs separate compatibility review/approval.

Asynchronous receipt/outbox remains a documented future option with the previously stated commit-visibility and optional-receipt durability tradeoff. **No further infrastructure optimization is planned.** Next work should focus on statistical accuracy, calibration, valid as-of bookmaker comparisons and controlled private shadow evaluation, without activating provider calls.

Machine-readable evidence and formulas: `audits/phase4/results/2026-10-24-final-evaluation.json`, `2026-10-24-storage-polling.json`, `2026-10-24-storage-forecast.json`; reproduction commands are in `audits/phase4/README.md`.
