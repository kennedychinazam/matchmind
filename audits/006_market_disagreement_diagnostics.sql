-- READ ONLY: class-level calibration and where bookmaker/model differ on identical pre-issue fixtures.
-- The "agreement" rows reuse the two Brier columns for total multiclass Brier, while
-- their other percent columns are TOP-1 hit rates (not observed class frequencies).
-- Class rows contain the per-class binary Brier score.
-- MatchMind Phase 2: fair 1X2 market probabilities versus frozen pre-kickoff model.
-- READ ONLY. No odds captured after the prediction creation time are eligible.
-- Cohort is PAIRWISE: precisely the same fixtures and resolved scores for both forecasts.
-- The market prices are the snapshot's aggregated 1X2 decimal prices, de-vigged within 1X2.
-- Only snapshots <=24 hours before publication, and >0 minutes before kickoff, are included.
WITH joined AS (
 SELECT p.fxid,p.lid,p.build,p.made_at,p.kickoff,p.ktime,
        p.p_home::double precision ph,p.p_draw::double precision pd,p.p_away::double precision pa,
        f.date,f.time,f.status,f.gh,f.ga,f.ft_h,f.ft_a,
        ((p.kickoff::text || ' ' || left(p.ktime,5))::timestamp AT TIME ZONE 'UTC') AS orig_ko,
        ((f.date::text || ' ' || left(f.time,5))::timestamp AT TIME ZONE 'UTC') AS current_ko
 FROM public.predictions p JOIN public.fixtures f USING(fxid)
 WHERE p.build>=62 AND f.status IN ('FINISHED','FT','AET','PEN')
   AND f.gh IS NOT NULL AND f.ga IS NOT NULL
   AND p.ktime ~ '^[0-9]{1,2}:[0-9]{2}' AND f.time ~ '^[0-9]{1,2}:[0-9]{2}'
   AND p.p_home BETWEEN 0 AND 1 AND p.p_draw BETWEEN 0 AND 1 AND p.p_away BETWEEN 0 AND 1
   AND abs(p.p_home::numeric+p.p_draw::numeric+p.p_away::numeric-1)<0.005
), paired AS (
 SELECT j.*,o.id snap_id,o.captured_at snap_at,o.h,o.d,o.a,o.books,
        extract(epoch from (j.made_at-o.captured_at))/3600.0 AS snapshot_age_hours
 FROM joined j
 LEFT JOIN LATERAL (
   SELECT id,captured_at,h,d,a,books FROM public.odds_snapshots o
   WHERE o.fxid=j.fxid AND o.captured_at<=j.made_at AND o.mins_to_kick>0
     AND o.h>1 AND o.d>1 AND o.a>1
   ORDER BY o.captured_at DESC,o.id DESC LIMIT 1
 ) o ON true
 WHERE j.made_at < j.orig_ko AND j.current_ko-j.orig_ko < interval '48 hours'
), valid AS (
 SELECT *,CASE WHEN ft_h IS NOT NULL AND ft_a IS NOT NULL AND ft_h>=0 AND ft_a>=0
               AND ft_h<=gh AND ft_a<=ga THEN ft_h ELSE gh END AS h90,
          CASE WHEN ft_h IS NOT NULL AND ft_a IS NOT NULL AND ft_h>=0 AND ft_a>=0
               AND ft_h<=gh AND ft_a<=ga THEN ft_a ELSE ga END AS a90,
          (1.0/h + 1.0/d + 1.0/a) AS overround
 FROM paired WHERE snap_id IS NOT NULL AND snapshot_age_hours BETWEEN 0 AND 24
), probs AS (
 SELECT *,1.0/(h*overround) AS mh, 1.0/(d*overround) AS md,
          1.0/(a*overround) AS ma
 FROM valid WHERE overround BETWEEN 1.00 AND 1.30
), scored AS (
 SELECT *,CASE WHEN h90>a90 THEN '1' WHEN h90=a90 THEN 'X' ELSE '2' END AS actual,
      CASE WHEN ph>=pd AND ph>=pa THEN '1' WHEN pd>ph AND pd>=pa THEN 'X' ELSE '2' END AS eng_choice,
      CASE WHEN mh>=md AND mh>=ma THEN '1' WHEN md>mh AND md>=ma THEN 'X' ELSE '2' END AS market_choice,
      power(ph-CASE WHEN h90>a90 THEN 1 ELSE 0 END,2)
       +power(pd-CASE WHEN h90=a90 THEN 1 ELSE 0 END,2)
       +power(pa-CASE WHEN h90<a90 THEN 1 ELSE 0 END,2) AS eng_brier,
      power(mh-CASE WHEN h90>a90 THEN 1 ELSE 0 END,2)
       +power(md-CASE WHEN h90=a90 THEN 1 ELSE 0 END,2)
       +power(ma-CASE WHEN h90<a90 THEN 1 ELSE 0 END,2) AS market_brier,
      -ln(greatest(1e-12,CASE WHEN h90>a90 THEN ph WHEN h90=a90 THEN pd ELSE pa END)) AS eng_log,
      -ln(greatest(1e-12,CASE WHEN h90>a90 THEN mh WHEN h90=a90 THEN md ELSE ma END)) AS market_log
 FROM probs
),
class_view AS (
 SELECT s.fxid,s.date,dim.name,dim.model_p,dim.market_p,dim.y
 FROM scored s
 CROSS JOIN LATERAL
 (VALUES ('home'::text,s.ph,s.mh,(s.actual='1')::int),
         ('draw',s.pd,s.md,(s.actual='X')::int),
         ('away',s.pa,s.ma,(s.actual='2')::int)) AS dim(name,model_p,market_p,y)
),
results AS (
 SELECT 'class'::text AS segment,name::text AS label,count(*) AS n,
   round(avg(y)::numeric,5) AS observed_rate,
   round(avg(model_p)::numeric,5) AS engine_mean_prob,
   round(avg(market_p)::numeric,5) AS bookmaker_mean_prob,
   round(avg(model_p-y)::numeric,5) AS engine_bias,
   round(avg(market_p-y)::numeric,5) AS bookmaker_bias,
   round(avg(power(model_p-y,2))::numeric,5) AS engine_binary_brier,
   round(avg(power(market_p-y,2))::numeric,5) AS bookmaker_binary_brier
 FROM class_view GROUP BY name
 UNION ALL
 SELECT 'agreement','same top outcome',count(*),
   round(avg((actual=eng_choice)::int)::numeric,5),
   round(avg((actual=market_choice)::int)::numeric,5),
   NULL::numeric,NULL::numeric,NULL::numeric,
   round(avg(eng_brier)::numeric,5),round(avg(market_brier)::numeric,5)
 FROM scored WHERE eng_choice=market_choice
 UNION ALL
 SELECT 'agreement','different top outcomes',count(*),
   round(avg((actual=eng_choice)::int)::numeric,5),
   round(avg((actual=market_choice)::int)::numeric,5),
   NULL::numeric,NULL::numeric,NULL::numeric,
   round(avg(eng_brier)::numeric,5),round(avg(market_brier)::numeric,5)
 FROM scored WHERE eng_choice<>market_choice
)
SELECT * FROM results ORDER BY segment,label;