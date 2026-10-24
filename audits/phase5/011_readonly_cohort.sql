-- Phase 5 read-only legacy cohort extraction. Entire file is one READ ONLY transaction.
-- Data-quality history is today's mutable-row diagnostic, never candidate input evidence.
-- Snapshot captured_at is a legacy timestamp, not an authoritative server-receipt proof.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
-- MatchMind PRO | Phase 1 | Historical pre-kickoff 1X2 forecast audit.
-- READ ONLY. Evaluates probabilities (not blended market picks).
-- Build >=62 only; excludes draws/voids? No: ALL 1X2 outcomes including draws
-- are valid labels. It excludes 48h-late played matches to match publication rules.
-- Prices must be stored at issue time to support later CLV work; this script does not use prices.
-- Uses 90-minute score where a full, valid pair exists. UTC kickoff parsing follows Build 355 HH:MM data.
WITH joined AS (
 SELECT p.fxid,p.lid,p.lname,p.home,p.away,p.build,p.made_at,p.kickoff,p.ktime,p.xg_home,p.xg_away,p.odds_snap_id,p.odds_at_pick_at,
        p.p_home::double precision ph,p.p_draw::double precision pd,p.p_away::double precision pa,
        f.date,f.time,f.status,f.gh,f.ga,f.ft_h,f.ft_a,f.updated_at,f.season,
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
), history AS (
 SELECT t.fxid,
 count(f.fxid) FILTER(WHERE f.home=t.home OR f.away=t.home) hh,
 count(f.fxid) FILTER(WHERE f.home=t.away OR f.away=t.away) ah,
 count(f.fxid) FILTER(WHERE (f.home=t.home OR f.away=t.home) AND f.updated_at<=t.made_at) hk,
 count(f.fxid) FILTER(WHERE (f.home=t.away OR f.away=t.away) AND f.updated_at<=t.made_at) ak,
 count(f.fxid) FILTER(WHERE (f.home=t.home OR f.away=t.home) AND f.xg_h IS NOT NULL AND f.xg_a IS NOT NULL) hx,
 count(f.fxid) FILTER(WHERE (f.home=t.away OR f.away=t.away) AND f.xg_h IS NOT NULL AND f.xg_a IS NOT NULL) ax
 FROM scored t LEFT JOIN public.fixtures f ON f.lid=t.lid
 AND f.date<t.kickoff AND f.date>=t.kickoff-interval '180 days'
 AND (f.home IN(t.home,t.away)OR f.away IN(t.home,t.away))
 AND upper(coalesce(f.status,''))IN('FINISHED','FT','AET','PEN') AND f.gh IS NOT NULL AND f.ga IS NOT NULL
 GROUP BY t.fxid
), extracted AS (
 SELECT s.*,h.hh,h.ah,h.hk,h.ak,h.hx,h.ax,o.id snap_id,o.captured_at snap_at,o.h,o.d,o.a,o.books,
 CASE WHEN o.h>1 AND o.d>1 AND o.a>1 THEN 1.0/o.h+1.0/o.d+1.0/o.a END overround,
 extract(epoch from(s.made_at-o.captured_at))/3600.0 age_hours
 FROM scored s LEFT JOIN history h USING(fxid)LEFT JOIN LATERAL(
 SELECT id,captured_at,h,d,a,books FROM public.odds_snapshots o
 WHERE o.fxid=s.fxid AND o.captured_at<=s.made_at AND o.mins_to_kick>0 AND o.h>1 AND o.d>1 AND o.a>1
 ORDER BY o.captured_at DESC,o.id DESC LIMIT 1)o ON true
)
SELECT jsonb_build_object(
 'metadata',jsonb_build_object('read_at',clock_timestamp(),'transaction_read_only',current_setting('transaction_read_only'),
 'predictions',(SELECT count(*)FROM public.predictions),'fixtures',(SELECT count(*)FROM public.fixtures),'odds',(SELECT count(*)FROM public.odds_snapshots),
 'issued_before_previous_audit',(SELECT count(*)FROM public.predictions WHERE made_at<='2026-10-23T18:56:55Z'),
 'eligible_issued_before_previous_audit',(SELECT count(*)FROM scored WHERE made_at<='2026-10-23T18:56:55Z'),
 'fixtures_touched_since_previous_audit',(SELECT count(*)FROM public.fixtures WHERE updated_at>'2026-10-23T18:56:55Z'),
 'missing_probability_rows',(SELECT count(*)FROM public.predictions WHERE p_home IS NULL OR p_draw IS NULL OR p_away IS NULL),
 'orphan_predictions',(SELECT count(*)FROM public.predictions p LEFT JOIN public.fixtures f USING(fxid)WHERE f.fxid IS NULL),
 'research_schema_present',to_regnamespace('research')IS NOT NULL),
 'rows',(SELECT jsonb_agg(jsonb_build_object('id',fxid::text,'league',lid,'league_name',lname,'issued_at',made_at,'kickoff_at',issued_kickoff,
 'current_kickoff_at',current_kickoff,'label_updated_at',updated_at,'status',status,'actual',result_1x2,'h90',h90,'a90',a90,
 'used_ft',ft_h IS NOT NULL AND ft_a IS NOT NULL AND ft_h>=0 AND ft_a>=0 AND ft_h<=gh AND ft_a<=ga,
 'raw_result',CASE WHEN gh>ga THEN '1'WHEN gh=ga THEN 'X'ELSE '2'END,
 'build',build,'model',jsonb_build_array(ph,pd,pa),'xg',jsonb_build_array(xg_home,xg_away),
 'legacy_snapshot',CASE WHEN snap_id IS NOT NULL THEN jsonb_build_object('id',snap_id::text,'captured_at',snap_at,'age_hours',age_hours,'prices',jsonb_build_array(h,d,a),'overround',overround,'books',books,'linked',odds_snap_id=snap_id,'linked_timestamp_equal',odds_at_pick_at=snap_at)ELSE NULL END,
 'legacy_market_eligible',coalesce(age_hours BETWEEN 0 AND 24 AND overround BETWEEN 1 AND 1.30,false),
 'history_diagnostic',jsonb_build_object('home',hh,'away',ah,'home_lastupdate_proxy',hk,'away_lastupdate_proxy',ak,'home_xg_now',hx,'away_xg_now',ax)
 )ORDER BY made_at,fxid)FROM extracted))AS audit;
COMMIT;
