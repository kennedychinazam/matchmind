-- MatchMind PRO | Phase 1 | Historical pre-kickoff 1X2 forecast audit.
-- READ ONLY. Evaluates probabilities (not blended market picks).
-- Build >=62 only; excludes draws/voids? No: ALL 1X2 outcomes including draws
-- are valid labels. It excludes 48h-late played matches to match publication rules.
-- Prices must be stored at issue time to support later CLV work; this script does not use prices.
-- Uses 90-minute score where a full, valid pair exists. UTC kickoff parsing follows Build 355 HH:MM data.
WITH joined AS (
 SELECT p.fxid,p.build,p.made_at,p.kickoff,p.ktime,
        p.p_home::double precision ph,p.p_draw::double precision pd,p.p_away::double precision pa,
        f.date,f.time,f.status,f.gh,f.ga,f.ft_h,f.ft_a,
        CASE WHEN p.ktime ~ '^[0-9]{1,2}:[0-9]{2}'
          THEN ((p.kickoff::text||' '||substring(p.ktime from '^[0-9]{1,2}:[0-9]{2}'))::timestamp AT TIME ZONE 'UTC')
          ELSE (p.kickoff::timestamp AT TIME ZONE 'UTC') END AS issued_kickoff,
        CASE WHEN f.time ~ '^[0-9]{1,2}:[0-9]{2}'
          THEN ((f.date::text||' '||substring(f.time from '^[0-9]{1,2}:[0-9]{2}'))::timestamp AT TIME ZONE 'UTC')
          ELSE (f.date::timestamp AT TIME ZONE 'UTC') END AS current_kickoff
 FROM public.predictions p JOIN public.fixtures f ON f.fxid=p.fxid
 WHERE p.build >= 62 AND upper(coalesce(f.status,'')) IN ('FINISHED','FT','AET','PEN')
       AND f.gh IS NOT NULL AND f.ga IS NOT NULL
),
scores AS (
 SELECT *,
   CASE WHEN ft_h IS NOT NULL AND ft_a IS NOT NULL AND ft_h>=0 AND ft_a>=0
           AND ft_h<=gh AND ft_a<=ga THEN ft_h ELSE gh END AS h90,
   CASE WHEN ft_h IS NOT NULL AND ft_a IS NOT NULL AND ft_h>=0 AND ft_a>=0
           AND ft_h<=gh AND ft_a<=ga THEN ft_a ELSE ga END AS a90
 FROM joined
),
eligible AS (
 SELECT *,greatest(ph,pd,pa) AS stated_confidence,
    CASE WHEN ph>=pd AND ph>=pa THEN '1' WHEN pd>ph AND pd>=pa THEN 'X' ELSE '2' END AS selected_1x2,
    CASE WHEN h90>a90 THEN '1' WHEN h90=a90 THEN 'X' ELSE '2' END AS result_1x2
 FROM scores
 WHERE made_at < issued_kickoff
   AND current_kickoff-issued_kickoff < interval '48 hours'
   AND ph BETWEEN 0 AND 1 AND pd BETWEEN 0 AND 1 AND pa BETWEEN 0 AND 1
   AND abs(ph+pd+pa-1)<0.005
),
scored AS (
 SELECT *,
   CASE WHEN selected_1x2=result_1x2 THEN 1.0 ELSE 0.0 END AS top1_hit,
   ((ph-CASE WHEN result_1x2='1' THEN 1 ELSE 0 END)^2
    +(pd-CASE WHEN result_1x2='X' THEN 1 ELSE 0 END)^2
    +(pa-CASE WHEN result_1x2='2' THEN 1 ELSE 0 END)^2) AS brier_sum,
   -ln(greatest(1e-12,CASE result_1x2 WHEN '1' THEN ph WHEN 'X' THEN pd ELSE pa END)) AS log_loss
 FROM eligible
),
groups AS (
 SELECT 'overall'::text grp,'all eligible'::text label,count(*)::bigint n,
        round(100*avg(top1_hit)::numeric,2) top1_accuracy_pct,
        round(avg(brier_sum)::numeric,5) brier_sum,
        round(avg(log_loss)::numeric,5) log_loss,
        round(avg(stated_confidence)::numeric,5) avg_stated_confidence,
        round(avg(top1_hit)::numeric,5) observed_hit_rate
 FROM scored
 UNION ALL
 SELECT 'monthly',to_char(date,'YYYY-MM'),count(*)::bigint,
        round(100*avg(top1_hit)::numeric,2),
        round(avg(brier_sum)::numeric,5),round(avg(log_loss)::numeric,5),
        round(avg(stated_confidence)::numeric,5),round(avg(top1_hit)::numeric,5)
 FROM scored GROUP BY to_char(date,'YYYY-MM')
 UNION ALL
 SELECT 'confidence_bin',
       CASE WHEN stated_confidence<0.4 THEN '<40%'
            WHEN stated_confidence<0.5 THEN '40-49.9%'
            WHEN stated_confidence<0.6 THEN '50-59.9%'
            WHEN stated_confidence<0.7 THEN '60-69.9%'
            WHEN stated_confidence<0.8 THEN '70-79.9%'
            ELSE '80-100%' END,
        count(*)::bigint,
        round(100*avg(top1_hit)::numeric,2),
        round(avg(brier_sum)::numeric,5),round(avg(log_loss)::numeric,5),
        round(avg(stated_confidence)::numeric,5),round(avg(top1_hit)::numeric,5)
 FROM scored GROUP BY 2
 UNION ALL
 SELECT 'benchmark','uniform 1/3',count(*)::bigint,
        NULL::numeric,round((2.0/3)::numeric,5),round(ln(3.0)::numeric,5),
        round((1.0/3)::numeric,5),NULL::numeric FROM scored
)
SELECT * FROM groups ORDER BY
 CASE grp WHEN 'overall' THEN 0 WHEN 'benchmark' THEN 1 WHEN 'monthly' THEN 2 ELSE 3 END,
 label;
