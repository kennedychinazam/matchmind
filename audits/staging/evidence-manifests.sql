-- Additive local migration; apply after snapshot-schema.sql and before capture hooks.
BEGIN;
SET LOCAL ROLE research_owner;
CREATE TABLE research.evidence_chunks (
 chunk_hash text PRIMARY KEY CHECK(chunk_hash ~ '^[0-9a-f]{64}$'),
 member_count integer NOT NULL CHECK(member_count BETWEEN 1 AND 500)
);
CREATE TABLE research.evidence_chunk_members (
 chunk_hash text NOT NULL REFERENCES research.evidence_chunks(chunk_hash),
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 500),
 observation_id uuid NOT NULL REFERENCES research.observations(observation_id),
 PRIMARY KEY(chunk_hash,ordinal),UNIQUE(chunk_hash,observation_id)
);
CREATE INDEX ON research.evidence_chunk_members(observation_id);
CREATE TABLE research.evidence_manifests (
 manifest_id uuid PRIMARY KEY,payload_hash text NOT NULL UNIQUE,
 evidence_count integer NOT NULL CHECK(evidence_count BETWEEN 0 AND 100000),
 body jsonb NOT NULL CHECK(octet_length(body::text)<=65536)
);
CREATE TABLE research.evidence_manifest_chunks (
 manifest_id uuid NOT NULL REFERENCES research.evidence_manifests(manifest_id),
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 200),
 chunk_hash text NOT NULL REFERENCES research.evidence_chunks(chunk_hash),
 PRIMARY KEY(manifest_id,ordinal)
);
ALTER TABLE research.prediction_snapshots ADD COLUMN evidence_manifest_id uuid REFERENCES research.evidence_manifests(manifest_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['evidence_chunks','evidence_chunk_members','evidence_manifests','evidence_manifest_chunks'] LOOP
  EXECUTE format('ALTER TABLE research.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON research.%I FOR EACH STATEMENT EXECUTE FUNCTION research.immutable()',t);
 END LOOP;
END $$;
CREATE INDEX observations_m14_scope_idx ON research.observations(field_name,md5(value::text),observed_at_utc DESC,fixture_id) WHERE availability='observed' AND field_name IN('lid','home','away');
CREATE FUNCTION research.store_evidence_manifest(ids uuid[],spec jsonb) RETURNS uuid LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE part uuid[];hashes text[]:='{}';ch text;body jsonb;mh text;mid uuid;i integer;created integer;BEGIN
 IF cardinality(ids)>100000 OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids)x) THEN
  RAISE EXCEPTION 'complete evidence manifest exceeds supported size or contains duplicates' USING ERRCODE='54000';
 END IF;
 FOR i IN 1..cardinality(ids) BY 500 LOOP
  part:=ids[i:least(i+499,cardinality(ids))];
  ch:=encode(public.digest(to_jsonb(part)::text,'sha256'),'hex');
  INSERT INTO research.evidence_chunks VALUES(ch,cardinality(part)) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS created=ROW_COUNT;
  IF created>0 THEN
   INSERT INTO research.evidence_chunk_members SELECT ch,n::integer,id FROM unnest(part)WITH ORDINALITY AS v(id,n);
  END IF;
  hashes:=array_append(hashes,ch);
 END LOOP;
 body:=jsonb_build_object('selection',spec,'chunks',to_jsonb(hashes),'evidence_count',cardinality(ids),'hash_scheme','pg-jsonb-v1');
 mh:=encode(public.digest(body::text,'sha256'),'hex');
 SELECT manifest_id INTO mid FROM research.evidence_manifests WHERE payload_hash=mh;
 IF mid IS NOT NULL THEN RETURN mid;END IF;
 mid:=gen_random_uuid();
 INSERT INTO research.evidence_manifests VALUES(mid,mh,cardinality(ids),body);
 INSERT INTO research.evidence_manifest_chunks SELECT mid,n::integer,h FROM unnest(hashes)WITH ORDINALITY AS v(h,n);
 RETURN mid;
END $$;
-- M14 dependency contract: unbounded target-team result history, full current/
-- previous season for standings, provider form <=240d, referee history <=540d,
-- and cross-competition schedule windows plus the latest older rest fixture.
CREATE FUNCTION research.select_m14_evidence(fid bigint) RETURNS uuid[] LANGUAGE sql STABLE SET search_path=pg_catalog AS $select$
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
  SELECT DISTINCT ON(o.fixture_id,o.field_name) o.* FROM research.observations o JOIN scope s USING(fixture_id),p
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
CREATE FUNCTION research.read_snapshot_evidence(sid uuid) RETURNS SETOF research.observations LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE mid uuid;m research.evidence_manifests;c record;ids uuid[];all_count integer:=0;actual_chunks text[];BEGIN
 SELECT evidence_manifest_id INTO STRICT mid FROM research.prediction_snapshots WHERE snapshot_id=sid;
 IF mid IS NULL THEN
  RETURN QUERY SELECT o.* FROM research.snapshot_evidence e JOIN research.observations o USING(observation_id) WHERE e.snapshot_id=sid;
  RETURN;
 END IF;
 SELECT * INTO STRICT m FROM research.evidence_manifests WHERE manifest_id=mid;
 IF encode(public.digest(m.body::text,'sha256'),'hex')<>m.payload_hash THEN RAISE EXCEPTION 'manifest integrity failure';END IF;
 SELECT coalesce(array_agg(chunk_hash ORDER BY ordinal),'{}'::text[]) INTO actual_chunks FROM research.evidence_manifest_chunks WHERE manifest_id=mid;
 IF to_jsonb(actual_chunks) IS DISTINCT FROM m.body->'chunks' THEN RAISE EXCEPTION 'manifest chunk order integrity failure';END IF;
 FOR c IN SELECT x.*,h.member_count FROM research.evidence_manifest_chunks x JOIN research.evidence_chunks h USING(chunk_hash) WHERE x.manifest_id=mid ORDER BY x.ordinal LOOP
  SELECT array_agg(observation_id ORDER BY ordinal) INTO ids FROM research.evidence_chunk_members WHERE chunk_hash=c.chunk_hash;
  IF cardinality(ids) IS DISTINCT FROM c.member_count OR encode(public.digest(to_jsonb(ids)::text,'sha256'),'hex')<>c.chunk_hash THEN RAISE EXCEPTION 'evidence chunk integrity failure';END IF;
  all_count:=all_count+cardinality(ids);
 END LOOP;
 IF all_count<>m.evidence_count THEN RAISE EXCEPTION 'incomplete evidence manifest';END IF;
 RETURN QUERY SELECT o.* FROM research.evidence_manifest_chunks x JOIN research.evidence_chunk_members v USING(chunk_hash) JOIN research.observations o USING(observation_id) WHERE x.manifest_id=mid ORDER BY x.ordinal,v.ordinal;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research FROM PUBLIC,anon,authenticated;
COMMIT;
