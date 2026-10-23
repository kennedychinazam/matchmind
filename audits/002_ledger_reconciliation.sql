-- MatchMind PRO | Phase 1 | Independent record-vs-ledger reconciliation (read-only).
-- Mirrors key Build 355 published-record rules: build >= 62, 90-minute score validity,
-- postponed >=48h -> void, drawn DNB -> void, unsupported pick -> ungradeable.
-- IMPORTANT: The live application's JavaScript remains the source of truth for edge cases.
-- This query is an INDEPENDENT cross-check: investigate, do not silently overwrite either tally.
WITH joined AS (
 SELECT p.fxid,p.build,p.pick,p.market,p.made_at,p.kickoff,p.ktime,p.withheld_at,
        f.fxid AS fixture_id,f.date,f.time,f.status,f.provider,f.gh,f.ga,f.ft_h,f.ft_a,
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
by_grade AS (
 SELECT 'independent'::text AS source, grade AS category,count(*)::bigint AS n
 FROM graded GROUP BY grade
),
shared AS (
 SELECT coalesce((payload->>'total')::bigint,0) AS total,
        coalesce((payload->>'graded')::bigint,0) AS graded,
        coalesce((payload->>'excluded')::bigint,0) AS excluded,
        coalesce((payload->>'pending')::bigint,0) AS pending,
        (payload->>'voidLate')::bigint AS void_late,
        computed_at,build
 FROM public.shared_records WHERE key='engine'
),
live_reference AS (
 SELECT 'shared_record'::text AS source,'total'::text AS category,total AS n FROM shared
 UNION ALL SELECT 'shared_record','graded',graded FROM shared
 UNION ALL SELECT 'shared_record','excluded',excluded FROM shared
 UNION ALL SELECT 'shared_record','pending',pending FROM shared
 UNION ALL SELECT 'shared_record','void_late',void_late FROM shared
),
rollup AS (
 SELECT 'independent_rollup'::text AS source, 'graded_including_draw_void'::text AS category,
        count(*) FILTER (WHERE grade IN ('hit','miss','void_draw'))::bigint n FROM graded
 UNION ALL SELECT 'independent_rollup','win_rate_settled_pct_x100',
     CASE WHEN count(*) FILTER(WHERE grade IN ('hit','miss'))=0 THEN NULL
     ELSE round(10000.0*count(*) FILTER(WHERE grade='hit')
       /count(*) FILTER(WHERE grade IN ('hit','miss')))::bigint END FROM graded
)
SELECT source,category,n FROM by_grade
UNION ALL SELECT source,category,n FROM live_reference
UNION ALL SELECT source,category,n FROM rollup
ORDER BY source,category;
