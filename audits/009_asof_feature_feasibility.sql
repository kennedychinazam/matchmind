-- Phase 3: Which historical features could a prediction have used?
-- READ ONLY. Past matches are strictly BEFORE the prediction's calendar day.
-- 'currentdb' means the feature exists now, NOT that it existed then.
-- 'lastupdate_preissue' is a conservative indication: later routine updates can hide
-- earlier availability, because this schema has no per-field first-observed timestamps.
-- The 180-day lookback approximates recent form; no attempt is made to fit a model.
WITH target AS (
 SELECT p.fxid,p.lid,p.home,p.away,p.kickoff,p.made_at
 FROM public.predictions p
 WHERE p.build>=62 AND p.ktime ~ '^[0-9]{1,2}:[0-9]{2}'
 AND p.made_at < (
   (p.kickoff::text || ' ' || substring(p.ktime from '^[0-9]{1,2}:[0-9]{2}'))::timestamp AT TIME ZONE 'UTC'
 ) AND p.kickoff BETWEEN DATE '2026-08-01' AND DATE '2026-10-23'
), history AS (
 SELECT t.fxid AS target_fxid,t.made_at, f.fxid AS hist_fxid,
  CASE WHEN f.home=t.home OR f.away=t.home THEN 1 ELSE 0 END AS for_home,
  CASE WHEN f.home=t.away OR f.away=t.away THEN 1 ELSE 0 END AS for_away,
  (f.xg_h IS NOT NULL AND f.xg_a IS NOT NULL)::int has_xg,
  (f.shots_h IS NOT NULL AND f.shots_a IS NOT NULL)::int has_shots,
  (f.lineup_h IS NOT NULL AND f.lineup_a IS NOT NULL)::int has_lineups,
  (f.updated_at <=t.made_at)::int was_updated_before_issue
 FROM target t LEFT JOIN public.fixtures f ON f.lid=t.lid
 AND f.date < t.kickoff AND f.date>=t.kickoff-interval '180 days'
 AND (f.home IN (t.home,t.away) OR f.away IN (t.home,t.away))
 AND upper(coalesce(f.status,'')) IN ('FINISHED','FT','AET','PEN')
 AND f.gh IS NOT NULL AND f.ga IS NOT NULL
), per_target AS (
 SELECT target_fxid,
 count(hist_fxid) FILTER (WHERE for_home=1) AS home_history,
 count(hist_fxid) FILTER (WHERE for_away=1) AS away_history,
 count(hist_fxid) FILTER (WHERE for_home=1 AND has_xg=1) AS home_xg_history,
 count(hist_fxid) FILTER (WHERE for_away=1 AND has_xg=1) AS away_xg_history,
 count(hist_fxid) FILTER (WHERE for_home=1 AND has_shots=1) AS home_shot_history,
 count(hist_fxid) FILTER (WHERE for_away=1 AND has_shots=1) AS away_shot_history,
 count(hist_fxid) FILTER (WHERE for_home=1 AND has_lineups=1) AS home_lineup_history,
 count(hist_fxid) FILTER (WHERE for_away=1 AND has_lineups=1) AS away_lineup_history,
 count(hist_fxid) FILTER (WHERE for_home=1 AND was_updated_before_issue=1) AS home_past_known,
 count(hist_fxid) FILTER (WHERE for_away=1 AND was_updated_before_issue=1) AS away_past_known,
 count(hist_fxid) FILTER (WHERE for_home=1 AND has_xg=1 AND was_updated_before_issue=1) AS home_xg_known,
 count(hist_fxid) FILTER (WHERE for_away=1 AND has_xg=1 AND was_updated_before_issue=1) AS away_xg_known
 FROM history GROUP BY target_fxid
)
SELECT count(*) AS target_n,
count(*) FILTER(WHERE home_history>=5 AND away_history>=5) AS both_teams_5_results,
count(*) FILTER(WHERE home_xg_history>=3 AND away_xg_history>=3) AS both_teams_3_xg_currentdb,
count(*) FILTER(WHERE home_shot_history>=3 AND away_shot_history>=3) AS both_teams_3_shots_currentdb,
count(*) FILTER(WHERE home_lineup_history>=3 AND away_lineup_history>=3) AS both_teams_3_lineups_currentdb,
count(*) FILTER(WHERE home_past_known>=5 AND away_past_known>=5) AS both_teams_5_results_lastupdate_preissue,
count(*) FILTER(WHERE home_xg_known>=3 AND away_xg_known>=3) AS both_teams_3_xg_lastupdate_preissue,
round(avg(home_history)::numeric,2) AS avg_home_history,
round(avg(away_history)::numeric,2) AS avg_away_history
FROM per_target;