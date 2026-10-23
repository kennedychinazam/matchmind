-- Phase 3 — provider match-statistics coverage by historical season; read-only.
-- All 55 API-Football competitions in production, not necessarily the 11 M14 training leagues.
-- Season=2026 may still be underway; never interpret as a final full-season percentage.
-- Percentages reflect today's archive, not field availability at historical issue time.
SELECT season,
count(*) AS n_finished,
count(*) FILTER(WHERE xg_h IS NOT NULL AND xg_a IS NOT NULL) AS n_xg,
count(*) FILTER(WHERE poss_h IS NOT NULL AND poss_a IS NOT NULL) AS n_poss,
count(*) FILTER(WHERE shots_h IS NOT NULL AND shots_a IS NOT NULL) AS n_shots,
count(*) FILTER(WHERE lineup_h IS NOT NULL AND lineup_a IS NOT NULL) AS n_lineups,
count(*) FILTER(WHERE ht_h IS NOT NULL AND ht_a IS NOT NULL) AS n_half_time,
count(distinct lid) AS competitions,
round(100.0*count(*) FILTER(WHERE xg_h IS NOT NULL AND xg_a IS NOT NULL)/NULLIF(count(*),0),2) AS pct_xg
FROM public.fixtures
WHERE provider='af' AND season BETWEEN 2022 AND 2026
 AND upper(coalesce(status,'')) IN ('FINISHED','FT','AET','PEN')
 AND gh IS NOT NULL AND ga IS NOT NULL
GROUP BY season ORDER BY season;