-- MatchMind Phase 2: reconciliation on CURRENT fixtures versus last published record.
-- READ ONLY. The shared record is a frozen tally from computed_at.
-- Because fixtures get updated, the current live table cannot fully reconstruct the old snapshot.
-- This query quantifies the discrepancy AND the number of changed underlying rows.
-- MatchMind PRO | Phase 1 | Independent record-vs-ledger reconciliation (read-only).
-- Mirrors key Build 355 published-record rules: build >= 62, 90-minute score validity,
-- postponed >=48h -> void, drawn DNB -> void, unsupported pick -> ungradeable.
-- IMPORTANT: The live application's JavaScript remains the source of truth for edge cases.
-- This query is an INDEPENDENT cross-check: investigate, do not silently overwrite either tally.
WITH joined AS (
 SELECT p.fxid,p.build,p.pick,p.market,p.made_at,p.kickoff,p.ktime,p.withheld_at,
        f.fxid AS fixture_id,f.date,f.time,f.status,f.provider,f.updated_at,f.gh,f.ga,f.ft_h,f.ft_a,
        CASE WHEN p.ktime ~ '^[0-9]{1,2}:[0-9]{2}'
          THEN ((p.kickoff::text||' '||substring(p.ktime from '^[0-9]{1,2}:[0-9]{2}'))::timestamp AT TIME ZONE 'UTC')
          ELSE (p.kickoff::timestamp AT TIME ZONE 'UTC') END AS original_kick,
        CASE WHEN f.time ~ '^[0-9]{1,2}:[0-9]{2}'
          THEN ((f.date::text||' '||substring(f.time from '^[0-9]{1,2}:[0-9]{2}'))::timestamp AT TIME ZONE 'UTC')
          ELSE (f.date::timestamp AT TIME ZONE 'UTC') END AS current_kick
 FROM public.predictions p LEFT JOIN public.fixtures f ON f.fxid=p.fxid
),
score AS (
 SELECT *,
   (upper(coalesce(status,'')) IN ('FINISHED','FT','AET','PEN')
        AND gh IS NOT NULL AND ga IS NOT NULL) AS finished,
   CASE WHEN ft_h IS NOT NULL AND ft_a IS NOT NULL AND gh IS NOT NULL AND ga IS NOT NULL
        AND ft_h>=0 AND ft_a>=0 AND ft_h<=gh AND ft_a<=ga THEN ft_h ELSE gh END AS score_h,
   CASE WHEN ft_h IS NOT NULL AND ft_a IS NOT NULL AND gh IS NOT NULL AND ga IS NOT NULL
        AND ft_h>=0 AND ft_a>=0 AND ft_h<=gh AND ft_a<=ga THEN ft_a ELSE ga END AS score_a
 FROM joined
),
states AS (
 SELECT *,
    (NOT finished AND kickoff < (now() AT TIME ZONE 'Africa/Lagos')::date
      AND (fixture_id IS NULL OR provider IS DISTINCT FROM 'af')) AS orphan,
    (NOT finished AND upper(coalesce(status,'')) IN ('1H','2H','HT','ET','BT','P','LIVE','INT')) AS in_play,
    (finished AND current_kick - original_kick >= interval '48 hours') AS played_late
 FROM score
),
classified AS (
 SELECT *,
  (NOT orphan AND NOT in_play
     AND (played_late OR (NOT finished AND now()-original_kick>=interval '48 hours'))) AS void_late,
  CASE WHEN score_h>score_a THEN '1'
       WHEN score_h=score_a THEN 'X' WHEN score_h<score_a THEN '2' END AS actual
 FROM states
),
graded AS (
 SELECT *,
  CASE
   WHEN build < 62 OR build IS NULL THEN 'excluded'
   WHEN orphan THEN 'orphan'
   WHEN in_play THEN 'in_play'
   WHEN void_late THEN 'void_late'
   WHEN NOT finished THEN 'pending'
   WHEN pick IN ('1','X','2','1X','X2','12') THEN
     CASE WHEN actual=pick OR (pick='1X' AND actual IN ('1','X'))
                      OR (pick='X2' AND actual IN ('X','2'))
                      OR (pick='12' AND actual IN ('1','2')) THEN 'hit' ELSE 'miss' END
   WHEN pick IN ('1D','2D') THEN CASE WHEN actual='X' THEN 'void_draw'
                             WHEN (pick='1D' AND actual='1') OR (pick='2D' AND actual='2') THEN 'hit'
                             ELSE 'miss' END
   WHEN pick IN ('O15','U15','O25','U25','O35','U35','BTS','NBT') THEN
     CASE WHEN (pick='O15' AND score_h+score_a>=2)
             OR (pick='U15' AND score_h+score_a<=1)
             OR (pick='O25' AND score_h+score_a>=3)
             OR (pick='U25' AND score_h+score_a<=2)
             OR (pick='O35' AND score_h+score_a>=4)
             OR (pick='U35' AND score_h+score_a<=3)
             OR (pick='BTS' AND score_h>0 AND score_a>0)
             OR (pick='NBT' AND (score_h=0 OR score_a=0)) THEN 'hit' ELSE 'miss' END
   ELSE 'ungradeable'
  END AS grade
 FROM classified
),
reference AS (SELECT computed_at,build,payload FROM public.shared_records WHERE key='engine'),
current_rollup AS (
 SELECT r.computed_at,
   count(*) AS total_now,
   count(*) FILTER(WHERE g.grade='excluded') AS excluded_now,
   count(*) FILTER(WHERE g.grade IN ('hit','miss','void_draw')) AS graded_now,
   count(*) FILTER(WHERE g.grade='hit') AS hits_now,
   count(*) FILTER(WHERE g.grade='miss') AS misses_now,
   count(*) FILTER(WHERE g.grade='void_draw') AS void_draw_now,
   count(*) FILTER(WHERE g.grade='void_late') AS void_late_now,
   count(*) FILTER(WHERE g.grade='pending') AS pending_now,
   count(*) FILTER(WHERE g.grade='orphan') AS orphan_now,
   count(*) FILTER(WHERE g.grade='in_play') AS in_play_now,
   count(*) FILTER(WHERE g.grade='ungradeable') AS ungradeable_now,
   count(*) FILTER(WHERE g.updated_at > r.computed_at) AS fixtures_changed_since_summary,
   count(*) FILTER(WHERE g.updated_at > r.computed_at AND g.finished) AS finished_changed_since_summary,
   count(*) FILTER(WHERE g.updated_at <= r.computed_at AND g.finished) AS finished_not_changed_since_summary
 FROM graded g CROSS JOIN reference r
 GROUP BY r.computed_at
)
SELECT r.build AS published_build,r.computed_at AS published_at,now() AS audited_at,
       x.total_now,
       (r.payload->>'total')::integer AS published_total,
       x.excluded_now,(r.payload->>'excluded')::integer AS published_excluded,
       x.graded_now,(r.payload->>'graded')::integer AS published_graded,
       x.graded_now-(r.payload->>'graded')::integer AS graded_delta,
       x.void_late_now,(r.payload->>'voidLate')::integer AS published_void_late,
       x.pending_now,(r.payload->>'pending')::integer AS published_pending,
       x.orphan_now,(r.payload->>'orphan')::integer AS published_orphans,
       x.ungradeable_now,(r.payload->>'ungradeable')::integer AS published_ungradeable,
       x.hits_now,x.misses_now,x.void_draw_now,x.in_play_now,
       x.fixtures_changed_since_summary,x.finished_changed_since_summary,x.finished_not_changed_since_summary,
       round(extract(epoch from(now()-r.computed_at))::numeric/3600,2) AS hours_since_published
FROM current_rollup x CROSS JOIN reference r;