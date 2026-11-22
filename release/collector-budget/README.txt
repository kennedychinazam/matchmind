Build 368 collector headroom (refresh-af v58, tag af-47).
Measured from net._http_response, 2026-11-21 23:10 to 2026-11-22 05:00 UTC: runs took 36 to 105 s against the
150 s cron timeout. The longest ones end in the detail pass ("time budget" at the 90 s run budget `ye`), which
starts one more statistics + lineups + events item after 90 s.
Change: TIME_BUDGET = 78 s, checked before each detail item and each injuries step. The league fetch, odds pass,
odds backfill and snapshot insert keep the 90 s `ye` as before, so odds collection is unchanged.
Rollback: deploy refresh-af-v57-af46-rollback.ts (byte-identical to release/odds-display/refresh-af/refresh-af-v57-af46-deployed.ts).
