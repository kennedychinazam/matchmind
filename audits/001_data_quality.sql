-- MatchMind PRO | Phase 1 | Read-only fixture and data integrity audit.
-- RUN BY HAND in the Supabase SQL editor. No tables, functions, indexes, or settings are modified.
-- The date window excludes the current, possibly incomplete, UTC day.
-- Coverage is measured on finished fixtures; missing optional provider fields are not automatically ingestion faults.
WITH
finished_30 AS MATERIALIZED (
 SELECT * FROM public.fixtures
 WHERE date >= current_date - 30 AND date < current_date
   AND upper(coalesce(status,'')) IN ('FINISHED','FT','AET','PEN')
   AND gh IS NOT NULL AND ga IS NOT NULL
),
upcoming_7 AS MATERIALIZED (
 SELECT * FROM public.fixtures
 WHERE date >= current_date AND date < current_date + 7
   AND upper(coalesce(status,'')) IN ('NS','SCHEDULED')
),
f AS (SELECT count(*)::numeric AS n FROM finished_30),
u AS (SELECT count(*)::numeric AS n FROM upcoming_7),
measurements AS (
 SELECT count(*)::numeric AS n,
        count(*) FILTER (WHERE computed_at < now() - interval '72 hours')::numeric AS old_n,
        max(computed_at) AS latest
 FROM public.competition_measures
),
pred_integrity AS (
 SELECT count(*)::numeric AS total,
        count(*) FILTER (WHERE f.fxid IS NULL)::numeric AS orphan,
        count(*) FILTER (WHERE p.p_home IS NULL OR p.p_draw IS NULL OR p.p_away IS NULL)::numeric AS missing_probs,
        count(*) FILTER (WHERE p.p_home NOT BETWEEN 0 AND 1
            OR p.p_draw NOT BETWEEN 0 AND 1 OR p.p_away NOT BETWEEN 0 AND 1
            OR abs(p.p_home::numeric+p.p_draw::numeric+p.p_away::numeric-1)>0.005)::numeric AS bad_probs,
        count(*) FILTER (WHERE p.ktime IS NULL OR btrim(p.ktime)='')::numeric AS missing_ktime
 FROM public.predictions p LEFT JOIN public.fixtures f ON f.fxid=p.fxid
),
snap_integrity AS (
 SELECT count(*)::numeric AS total,
        count(*) FILTER (WHERE f.fxid IS NULL)::numeric AS orphan,
        count(*) FILTER (WHERE o.captured_at IS NULL OR o.mins_to_kick IS NULL)::numeric AS no_timing,
        count(*) FILTER (WHERE o.h IS NULL OR o.d IS NULL OR o.a IS NULL
               OR o.h<=1 OR o.d<=1 OR o.a<=1)::numeric AS bad_1x2
 FROM public.odds_snapshots o LEFT JOIN public.fixtures f ON f.fxid=o.fxid
),
measure AS (
 SELECT 'recent_finished_fixtures'::text AS metric, (SELECT n FROM f) AS observed,
        NULL::numeric AS eligible, 'completed fixture rows in previous 30 UTC days'::text AS explanation
 UNION ALL SELECT 'recent_90min_score_valid',
   count(*) FILTER (WHERE ft_h IS NOT NULL AND ft_a IS NOT NULL
      AND ft_h>=0 AND ft_a>=0 AND ft_h<=gh AND ft_a<=ga)::numeric,
   (SELECT n FROM f), 'valid 90-minute score pair; other rows use fallback goals'
 FROM finished_30
 UNION ALL SELECT 'recent_xg_coverage',
   count(*) FILTER (WHERE xg_h IS NOT NULL AND xg_a IS NOT NULL)::numeric,
   (SELECT n FROM f), 'xG provider availability, not necessarily model usage'
 FROM finished_30
 UNION ALL SELECT 'recent_shots_coverage',
   count(*) FILTER (WHERE shots_h IS NOT NULL AND shots_a IS NOT NULL)::numeric,
   (SELECT n FROM f), 'both teams have shots data'
 FROM finished_30
 UNION ALL SELECT 'recent_lineups_coverage',
   count(*) FILTER (WHERE lineup_h IS NOT NULL AND lineup_a IS NOT NULL)::numeric,
   (SELECT n FROM f), 'both lineups available after match'
 FROM finished_30
 UNION ALL SELECT 'recent_opening_odds_coverage',
   count(*) FILTER (WHERE odds_open_h > 1 AND odds_open_d > 1 AND odds_open_a > 1)::numeric,
   (SELECT n FROM f), 'valid three-way opening odds'
 FROM finished_30
 UNION ALL SELECT 'recent_closing_odds_coverage',
   count(*) FILTER (WHERE odds_close_h > 1 AND odds_close_d > 1 AND odds_close_a > 1)::numeric,
   (SELECT n FROM f), 'valid three-way closing odds'
 FROM finished_30
 UNION ALL SELECT 'recent_injury_text_coverage',
   count(*) FILTER (WHERE nullif(btrim(inj_h),'') IS NOT NULL
                      OR nullif(btrim(inj_a),'') IS NOT NULL)::numeric,
   (SELECT n FROM f), 'at least one injury ID list; not verified player availability'
 FROM finished_30
 UNION ALL SELECT 'recent_weather_coverage',
   count(*) FILTER (WHERE wx_temp IS NOT NULL OR wx_rain IS NOT NULL OR wx_wind IS NOT NULL)::numeric,
   (SELECT n FROM f), 'at least one weather measurement'
 FROM finished_30
 UNION ALL SELECT 'upcoming_fixtures_7d',(SELECT n FROM u), NULL::numeric, 'future scheduled fixtures within seven UTC days'
 UNION ALL SELECT 'upcoming_opening_odds_7d',
   count(*) FILTER (WHERE odds_open_h>1 AND odds_open_d>1 AND odds_open_a>1)::numeric,
   (SELECT n FROM u), 'three-way prices among scheduled fixtures'
 FROM upcoming_7
 UNION ALL SELECT 'upcoming_venue_ids_7d',
   count(*) FILTER (WHERE venue_id IS NOT NULL)::numeric,
   (SELECT n FROM u), 'venue ID availability'
 FROM upcoming_7
 UNION ALL SELECT 'prediction_orphans',(SELECT orphan FROM pred_integrity),(SELECT total FROM pred_integrity),'forecast missing fixture'
 UNION ALL SELECT 'prediction_missing_probs',(SELECT missing_probs FROM pred_integrity),(SELECT total FROM pred_integrity),'at least one 1X2 probability missing'
 UNION ALL SELECT 'prediction_bad_probs',(SELECT bad_probs FROM pred_integrity),(SELECT total FROM pred_integrity),'non-finite range or probabilities not summing to one'
 UNION ALL SELECT 'prediction_missing_kickoff_time',(SELECT missing_ktime FROM pred_integrity),(SELECT total FROM pred_integrity),'prediction snapshot missing ktime'
 UNION ALL SELECT 'snapshot_orphans',(SELECT orphan FROM snap_integrity),(SELECT total FROM snap_integrity),'bookmaker snapshot missing fixture'
 UNION ALL SELECT 'snapshot_missing_timing',(SELECT no_timing FROM snap_integrity),(SELECT total FROM snap_integrity),'odds snapshot missing timestamp or minutes-to-kickoff'
 UNION ALL SELECT 'snapshot_invalid_three_way_price',(SELECT bad_1x2 FROM snap_integrity),(SELECT total FROM snap_integrity),'odds missing or at most 1.0'
 UNION ALL SELECT 'competition_measurements_older_72h',(SELECT old_n FROM measurements),(SELECT n FROM measurements),'age flag only: recomputation cadence needs confirming'
 UNION ALL SELECT 'structured_injury_rows',(SELECT count(*)::numeric FROM public.injuries),NULL::numeric,'separate structured injury table currently unused'
 UNION ALL SELECT 'ai_context_rows',(SELECT count(*)::numeric FROM public.match_context),NULL::numeric,'empty expected when AI context disabled'
)
SELECT metric, observed::bigint AS observed, eligible::bigint AS eligible,
       CASE WHEN eligible > 0 THEN round(observed * 100 / eligible, 2) ELSE NULL END AS pct,
       explanation
FROM measure ORDER BY metric;
