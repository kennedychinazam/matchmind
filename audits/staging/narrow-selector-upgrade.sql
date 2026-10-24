-- Disposable/staging artifact only; no hosted execution authorized. Research data is never rewritten.
BEGIN;
SET LOCAL ROLE research_owner;
CREATE OR REPLACE FUNCTION research.select_m14_evidence(fid bigint) RETURNS uuid[] LANGUAGE sql STABLE SET search_path=pg_catalog AS $select$
 WITH p AS (SELECT * FROM public.predictions WHERE fxid=fid),
 candidates AS MATERIALIZED (
  SELECT DISTINCT o.fixture_id FROM research.observations o,p
  WHERE o.availability='observed' AND o.observed_at_utc<=p.made_at AND (
   (o.field_name='lid' AND md5(o.value::text)=md5(to_jsonb(p.lid)::text) AND o.value=to_jsonb(p.lid)) OR
   (o.field_name IN('home','away') AND md5(o.value::text) IN(md5(to_jsonb(p.home)::text),md5(to_jsonb(p.away)::text)) AND o.value IN(to_jsonb(p.home),to_jsonb(p.away)))
  )
 ), meta AS MATERIALIZED (
  SELECT DISTINCT ON(o.fixture_id,o.field_name) o.fixture_id,o.field_name,o.value
  FROM research.observations o JOIN candidates c USING(fixture_id),p WHERE o.field_name IN('lid','home','away') AND o.availability='observed'
   AND o.observed_at_utc<=p.made_at AND (o.effective_at_utc IS NULL OR o.effective_at_utc<=p.made_at)
  ORDER BY o.fixture_id,o.field_name,o.observed_at_utc DESC,o.observation_id DESC
 ), scope AS (
  SELECT DISTINCT m.fixture_id FROM meta m,p WHERE m.fixture_id=p.fxid OR (m.field_name='lid' AND m.value=to_jsonb(p.lid)) OR (m.field_name IN('home','away') AND m.value IN(to_jsonb(p.home),to_jsonb(p.away)))
 ), latest AS MATERIALIZED (
  SELECT DISTINCT ON(o.fixture_id,o.field_name) o.fixture_id,o.field_name,o.value,o.observation_id FROM research.observations o JOIN scope s USING(fixture_id),p
  WHERE o.field_name<>'odds_1x2' AND o.availability='observed' AND o.observed_at_utc<=p.made_at
   AND (o.fixture_id=p.fxid OR o.played_at_utc IS NOT NULL OR o.field_name IN('lid','home','away','date','time','status','provider','home_logo','away_logo','season','round','referee','venue_id','inj_h','inj_a','lineup_h','lineup_a','formation_h','formation_a'))
   AND (o.played_at_utc IS NULL OR o.played_at_utc<o.observed_at_utc AND o.played_at_utc<p.made_at)
   AND (o.effective_at_utc IS NULL OR o.effective_at_utc<=p.made_at)
  ORDER BY o.fixture_id,o.field_name,o.observed_at_utc DESC,o.observation_id DESC
 ), rows AS MATERIALIZED (
  SELECT fixture_id,jsonb_object_agg(field_name,value) r FROM latest GROUP BY fixture_id
 ), target AS (
  SELECT p.*,t.r tr FROM p LEFT JOIN rows t ON t.fixture_id=p.fxid
 ), flags AS MATERIALIZED (
  SELECT x.fixture_id,x.r,(x.r->>'date')::date d,
   x.r->>'home' IN(p.home,p.away) OR x.r->>'away' IN(p.home,p.away) AS team,
   x.r->'lid'=to_jsonb(p.lid) AS league,
   (x.r->>'season')::integer IN((p.tr->>'season')::integer,(p.tr->>'season')::integer-1) AS table_season,
   p.tr->>'referee' IS NOT NULL AS referee_context
  FROM rows x CROSS JOIN target p WHERE x.r ? 'date'
 ), rest AS (
  SELECT DISTINCT ON(team_name) f.fixture_id FROM flags f CROSS JOIN target p
   CROSS JOIN LATERAL unnest(ARRAY[p.home,p.away]) team_name
  WHERE f.d<p.kickoff AND (f.r->>'home'=team_name OR f.r->>'away'=team_name)
  ORDER BY team_name,f.d DESC,f.fixture_id DESC
 ), contexts AS MATERIALIZED (
  SELECT f.*,
   f.fixture_id=p.fxid AS target,
   f.league AND f.d<p.kickoff AND (f.team OR f.table_season OR (f.referee_context AND p.kickoff-f.d<=540)) AS history,
   f.league AND f.team AND f.d<p.kickoff AND p.kickoff-f.d<=240 AS provider,
   f.league AND f.referee_context AND f.d<p.kickoff AND p.kickoff-f.d<=540 AS ref_form,
   f.team AND ((f.d>=p.kickoff-21 AND f.d<=p.kickoff+4) OR f.fixture_id IN(SELECT fixture_id FROM rest)) AS schedule
  FROM flags f CROSS JOIN target p
 )
 , wanted AS MATERIALIZED (
  SELECT DISTINCT fixture_id,unnest(
   CASE WHEN target OR provider THEN ARRAY['lid','home','away','date','time','status','gh','ga','ht_h','ht_a','ft_h','ft_a','provider','home_logo','away_logo','xg_h','xg_a','gprev_h','gprev_a','poss_h','poss_a','shots_h','shots_a','sot_h','sot_a','sib_h','sib_a','sob_h','sob_a','blocked_h','blocked_a','corners_h','corners_a','fouls_h','fouls_a','yellows_h','yellows_a','reds_h','reds_a','saves_h','saves_a','passacc_h','passacc_a','offsides_h','offsides_a','formation_h','formation_a','passes_h','passes_a','referee','venue_id','season','round','lineup_h','lineup_a','events','inj_h','inj_a'] ELSE '{}'::text[] END
   ||CASE WHEN history THEN ARRAY['lid','home','away','date','time','status','gh','ga','ht_h','ht_a','season','round'] ELSE '{}'::text[] END
   ||CASE WHEN ref_form THEN ARRAY['referee','events','home_logo','away_logo'] ELSE '{}'::text[] END
   ||CASE WHEN schedule THEN ARRAY['lid','home','away','date','time','status'] ELSE '{}'::text[] END
  ) field_name FROM contexts
 )
 SELECT coalesce(array_agg(o.observation_id ORDER BY o.fixture_id,o.field_name,o.observation_id),'{}'::uuid[])
 FROM latest o JOIN wanted w USING(fixture_id,field_name)
$select$;
REVOKE ALL ON FUNCTION research.select_m14_evidence(bigint) FROM PUBLIC,anon,authenticated;
RESET ROLE;
COMMIT;
