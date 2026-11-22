# MatchMind handover, 22 November 2026

## Live state

- Production app: https://kennedychinazam.github.io/matchmind/, Build 368, `main` at 2b42b1a.
- Release and test branch: `ccr-5da6e9b3-3ms4v5`. It mirrors main and adds the test suite in `test/`.
- Build 355 is kept on branch `backup/build355-20261023` (commit 036f09b).
- Supabase production: `toqfdrcjzwnlydqekude`. Staging: `rdcbnvfnxenrpnnwxszs`.
- Data collector: edge function `refresh-af` v58 (af-47). It runs every 10 minutes and uses about 8,000 provider calls a day against a daily allowance of about 75,000.

## How data reaches visitors

- Visitors cannot read raw tables. They read bounded "editions" through these functions:
  - `matchmind_display_v1`: the screens.
  - `matchmind_history_v1`: past picks, 250 per page.
  - `matchmind_leans_v1`: Leans.
  - `matchmind_odds_v1`: odds.
  - `matchmind_match_context_v1`: one match's form, head to head, table and scorers.
- Edition rebuild: cron job `matchmind-display-refresh` (jobid 12) builds an edition every 5 minutes. It keeps the 3 newest, plus any built in the last 30 minutes.
- Bounds:
  - 3,000 cards and 4 MiB per edition.
  - 1,500 Leans, which are capped cleanly.
  - The current window is about 1,300 cards and 1.1 to 1.3 MB.
- Publisher: the robot account `bbec0ef1-...` is the only enrolled publisher (`mm_fixture_delivery.principals`, valid to 2027-11-21). The server decides who can publish.
- Picks robot: `publish-picks.yml` runs at 23:17, 05:17 and 17:17 UTC.

## What changed in this session

| Build | Change |
|---|---|
| 358 | Bounded display client. Anonymous visitors can no longer bulk-read fixtures. |
| 359 | Fixed the empty-app bug (reconstructed picks with build -1, and retries across editions). |
| 361 | Match detail panels restored to Build 355 quality: form, head to head, league table, goals, half-time/full-time, scorers, write-up. |
| 360, 362 | "No pick" reasons recorded. Strong / Lean / Too close to call tiers (Strong at max(0.75, competition bar)). Analysis league priority order with favourites first. |
| 363 | Edition bound raised to 3,000 cards and 4 MiB after the window overflowed (incident, 14:38 to 18:26 UTC on 21 Nov). |
| 364 | Lean label and 1X2 bar moved into the match page. Account notice hidden. |
| 365 | Cross-competition rating (XR). UEFA clubs (UCL, UEL, UECL, Super Cup, Club World Cup), CAF club competitions, and national teams (World Cup, Euros, AFCON, qualifiers, CHAN, Nations League, friendlies) are collected and priced. |
| 366 | Goals priced at this season's scoring level. U3.5 shift refit. Smart Bet legs at 70% or more, with no goals preference. |
| 367 | Short list chips ("No pick", blue Lean chip, "Void"). Odds reach the public app and the match page. Slip Generator fixed. Odds collected up to 7 days ahead. |
| 368 | Each Tips tab is chosen by its own market (Winner, Goals, BTTS Yes). Under 2.5 removed. BTTS No removed. Double chance and DNB recalibrated. Leans capped. Collector time budget. |

## Measured results (walk-forward backtests on real fixtures)

| Measure | Result |
|---|---|
| Official Strong picks | hit 79.2% against 79.2% stated, coverage about 45% |
| Leans | hit 68.4% against 69.7% stated |
| Under goals since Aug 2026 | was 75.5% against 79.3% stated; now 79.0% against 78.8% |
| Smart Bet Safe card | won 34.9% of days, now 46.3% (since Aug) |
| Straight win against BTTS Yes, at 65% or more | win 73.2% hit, ROI -1.4%; BTTS Yes about 61% hit, ROI -7.3% |

## Release and rollback files

- `release/production-cutover/`: the main migration (PROPOSAL-up/revert), LOGOS, readiness report.
- `release/capacity3/`, `release/odds-display/`, `release/lean-tiers/`, `release/match-context/`, `release/leans-cap/`, `release/collector-budget/`: each has up and down SQL or a rollback copy.
- Rolling back to Build 355: publish the 355 client with a higher cache number first, then run `PROPOSAL-revert.sql`. This brings back the old broad data exposure.
- Changing functions owned by `mm_display_*` roles: grant the role to current_user `with set true, inherit true` inside the transaction, then revoke it at the end (see LOGOS-up.sql).

## Open items

1. **Check the 17:17 UTC publish on 22 Nov.** It is the first run to write picks and Leans under Build 368. Check the market mix in `public.predictions` and `public.lean_picks`.
2. **MLS Strong picks overclaim.** Backtest: 76% hit against 82% stated. This needs its own calibration.
3. **UCL and UECL under XR overclaim at Strong.** They are capped at Lean until calibrated.
4. **Delete leftover branches.** Delete `diag-results` and `picks/build360` on GitHub. Earlier history of `diag-results` holds engine prices for withheld fixtures.
5. **Next 3 / Next 7 days on the Goals and BTTS tabs** read "Listed on the day they are issued", because public devices cannot price those days themselves.
6. **Played K League and MLS matches from 21 Nov** still read "No pick". There was no board row before kickoff, and nothing is reconstructed.
7. **Signed-in AI write-up** is not verified live, because there was no test account.
8. **Collector runs take about 79 s** against a 150 s cron timeout. Watch for growth.
9. **The refresh-af bundle imports one file from a GitHub raw URL pinned to commit 2b42b1a.** This is a deploy-time dependency only.
10. **Optional: the GitHub token for staging refresh dispatch** (`mm_preview_dispatch_token` in staging Vault) is still not needed. GitHub's own timer drives the preview.

## Health checks

```sql
select (select max(as_of) from mm_fixture_delivery.editions) newest_edition,
       (select count(*) filter(where status<>'succeeded') from cron.job_run_details
        where jobid=12 and start_time>now()-interval '1 hour') display_failures_1h;
```

On the live site, the header must read "● Published". If it reads "Unavailable", check `cron.job_run_details` for jobid 12 first.
