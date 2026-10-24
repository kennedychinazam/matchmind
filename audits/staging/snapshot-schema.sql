-- Research migration: tested only on disposable PostgreSQL 17. No production apply.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE SCHEMA research AUTHORIZATION research_owner;
REVOKE ALL ON SCHEMA research FROM PUBLIC,anon,authenticated;
SET LOCAL ROLE research_owner;
ALTER DEFAULT PRIVILEGES IN SCHEMA research REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE research.control (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), enabled boolean NOT NULL DEFAULT true,max_bytes bigint NOT NULL DEFAULT 262144000 CHECK(max_bytes>0));
INSERT INTO research.control DEFAULT VALUES;
CREATE TABLE research.observations (
 observation_id uuid PRIMARY KEY,fixture_id bigint NOT NULL,source_kind text NOT NULL,source_ref text NOT NULL,
 collector_run_id uuid NOT NULL,field_name text NOT NULL,value jsonb NOT NULL,availability text NOT NULL CHECK(availability IN ('observed','unknown')),
 observed_at_utc timestamptz,received_at_utc timestamptz NOT NULL,effective_at_utc timestamptz,played_at_utc timestamptz,
 feature_schema_version integer NOT NULL CHECK(feature_schema_version=1),payload_hash text NOT NULL,source_hash text NOT NULL,
 input jsonb NOT NULL,
 CHECK((availability='unknown' AND observed_at_utc IS NULL AND value='null'::jsonb) OR (availability='observed' AND observed_at_utc=received_at_utc AND value<>'null'::jsonb)),
 CHECK(played_at_utc IS NULL OR played_at_utc<received_at_utc),CHECK(effective_at_utc IS NULL OR effective_at_utc<=received_at_utc)
);
CREATE INDEX ON research.observations(fixture_id,field_name,observed_at_utc DESC,observation_id);
CREATE INDEX ON research.observations(collector_run_id);
CREATE TABLE research.prediction_snapshots (
 snapshot_id uuid PRIMARY KEY,fixture_id bigint NOT NULL,issue_time_utc timestamptz NOT NULL,prediction_build integer NOT NULL,
 received_at_utc timestamptz NOT NULL,model_version text NOT NULL,capture_kind text NOT NULL CHECK(capture_kind IN ('at_issue','late_import')),
 replay_eligible boolean NOT NULL DEFAULT false,replay_reason text NOT NULL,payload_hash text NOT NULL,envelope jsonb NOT NULL,
 UNIQUE(fixture_id,issue_time_utc,prediction_build)
);
CREATE INDEX ON research.prediction_snapshots(issue_time_utc,fixture_id);
CREATE TABLE research.snapshot_evidence (
 snapshot_id uuid NOT NULL REFERENCES research.prediction_snapshots(snapshot_id),observation_id uuid NOT NULL REFERENCES research.observations(observation_id),
 evidence_role text NOT NULL,source_fixture_id bigint NOT NULL,
 PRIMARY KEY(snapshot_id,observation_id)
);
CREATE INDEX ON research.snapshot_evidence(observation_id);
CREATE TABLE research.shadow_forecasts (
 shadow_id uuid PRIMARY KEY,snapshot_id uuid NOT NULL REFERENCES research.prediction_snapshots(snapshot_id),candidate_version text NOT NULL,
 configuration_hash text NOT NULL,visibility text NOT NULL CHECK(visibility='shadow'),envelope jsonb NOT NULL,
 UNIQUE(snapshot_id,candidate_version,configuration_hash)
);
CREATE FUNCTION research.immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'immutable research record';END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['observations','prediction_snapshots','snapshot_evidence','shadow_forecasts'] LOOP
  EXECUTE format('ALTER TABLE research.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON research.%I FOR EACH STATEMENT EXECUTE FUNCTION research.immutable()',t);
 END LOOP;
END $$;
ALTER TABLE research.control ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION research.check_object(b jsonb,keys text[],max_bytes integer) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF jsonb_typeof(b) IS DISTINCT FROM 'object' OR octet_length(b::text)>max_bytes THEN RAISE EXCEPTION 'object/payload size invalid'; END IF;
 IF EXISTS(SELECT FROM jsonb_object_keys(b) k WHERE NOT k=ANY(keys)) OR EXISTS(SELECT FROM unnest(keys) k WHERE NOT b ? k) THEN RAISE EXCEPTION 'unexpected or missing field'; END IF;
END $$;
CREATE FUNCTION research.utc_instant(v text) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE r timestamptz;BEGIN
 IF v IS NULL OR v !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$'
 OR substring(v,12,2)::int>23 OR substring(v,15,2)::int>59 OR substring(v,18,2)::int>59
 OR (right(v,1)<>'Z' AND (substring(v from '([0-9]{2}):[0-9]{2}$')::int>14 OR right(v,2)::int>59 OR (substring(v from '([0-9]{2}):[0-9]{2}$')::int=14 AND right(v,2)::int<>0)))
 THEN RAISE EXCEPTION 'invalid timestamp';END IF;
 r:=v::timestamptz; RETURN r;
END $$;
CREATE FUNCTION research.check_budget(extra_bytes bigint) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE ctl research.control;used bigint;BEGIN
 SELECT * INTO STRICT ctl FROM research.control FOR UPDATE;
 IF NOT ctl.enabled THEN RAISE EXCEPTION 'research capture disabled';END IF;
 SELECT coalesce(sum(pg_total_relation_size(c.oid)),0) INTO used FROM pg_class c WHERE c.relnamespace='research'::regnamespace AND c.relkind='r';
 IF used+extra_bytes>ctl.max_bytes THEN RAISE EXCEPTION 'research storage limit exceeded' USING ERRCODE='54000';END IF;
END $$;
CREATE FUNCTION research.append_observations(batch jsonb) RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b jsonb;prior jsonb;ids uuid[]:='{}';oid uuid;receipt timestamptz;played timestamptz;effective timestamptz;latest research.observations;BEGIN
 IF jsonb_typeof(batch) IS DISTINCT FROM 'array' OR jsonb_array_length(batch)>100 OR octet_length(batch::text)>2097152 THEN RAISE EXCEPTION 'batch size invalid';END IF;
 PERFORM research.check_budget(octet_length(batch::text)*2);
 FOR b IN SELECT * FROM jsonb_array_elements(batch) LOOP
  PERFORM research.check_object(b,ARRAY['observation_id','fixture_id','source_kind','source_ref','collector_run_id','field_name','value','availability','feature_schema_version','source_hash','effective_at_utc','played_at_utc'],65536);
  IF b->>'observation_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR b->>'collector_run_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'invalid UUID';END IF;
  IF jsonb_typeof(b->'fixture_id')<>'string' OR b->>'fixture_id' !~ '^[1-9][0-9]{0,17}$' OR b->'feature_schema_version'<>'1'::jsonb
   OR b->>'source_hash' !~ '^[0-9a-f]{64}$' OR b->>'source_kind' NOT IN ('collector','odds','fixture')
   OR b->>'availability' NOT IN ('unknown','observed') THEN RAISE EXCEPTION 'invalid observation identity/schema';END IF;
  IF jsonb_typeof(b->'field_name') IS DISTINCT FROM 'string' OR length(b->>'field_name') NOT BETWEEN 1 AND 256
   OR jsonb_typeof(b->'source_ref') IS DISTINCT FROM 'string' OR length(btrim(b->>'source_ref')) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'invalid field/source';END IF;
  IF b->>'field_name' NOT IN ('lid','home','away','date','time','status','gh','ga','ht_h','ht_a','ft_h','ft_a','provider','home_logo','away_logo','xg_h','xg_a','gprev_h','gprev_a','poss_h','poss_a','shots_h','shots_a','sot_h','sot_a','sib_h','sib_a','sob_h','sob_a','blocked_h','blocked_a','corners_h','corners_a','fouls_h','fouls_a','yellows_h','yellows_a','reds_h','reds_a','saves_h','saves_a','passacc_h','passacc_a','offsides_h','offsides_a','formation_h','formation_a','passes_h','passes_a','referee','venue_id','season','round','lineup_h','lineup_a','events','inj_h','inj_a','odds_1x2') THEN RAISE EXCEPTION 'unsupported observation field';END IF;
  IF octet_length((b->'value')::text)>16384 THEN RAISE EXCEPTION 'field size exceeded';END IF;
  IF (b->>'availability'='unknown') IS DISTINCT FROM (b->'value'='null'::jsonb) THEN RAISE EXCEPTION 'unknown value mismatch';END IF;
  oid:=(b->>'observation_id')::uuid;
  SELECT input INTO prior FROM research.observations WHERE observation_id=oid;
  IF FOUND THEN
   IF prior<>b THEN RAISE EXCEPTION 'conflicting observation identifier';END IF;
   ids:=array_append(ids,oid);CONTINUE;
  END IF;
  SELECT * INTO latest FROM research.observations WHERE fixture_id=(b->>'fixture_id')::bigint AND field_name=b->>'field_name' AND source_kind=b->>'source_kind' AND source_ref=b->>'source_ref' ORDER BY received_at_utc DESC,observation_id DESC LIMIT 1;
  IF FOUND AND latest.value=b->'value' AND latest.availability=b->>'availability'
   AND latest.input->'played_at_utc'=b->'played_at_utc' AND latest.input->'effective_at_utc'=b->'effective_at_utc' THEN
   ids:=array_append(ids,latest.observation_id);CONTINUE;
  END IF;
  receipt:=clock_timestamp();
  played:=CASE WHEN b->'played_at_utc'='null'::jsonb THEN null ELSE research.utc_instant(b->>'played_at_utc') END;
  effective:=CASE WHEN b->'effective_at_utc'='null'::jsonb THEN null ELSE research.utc_instant(b->>'effective_at_utc') END;
  IF played>=receipt OR effective>receipt THEN RAISE EXCEPTION 'future observation chronology';END IF;
  IF b->>'field_name'='odds_1x2' AND b->>'availability'='observed' THEN
   PERFORM research.check_object(b->'value',ARRAY['id','fxid','captured_at','mins_to_kick','h','d','a'],16384);
   IF b->>'source_kind'<>'odds' OR b->'value'->>'fxid' IS DISTINCT FROM b->>'fixture_id'
    OR jsonb_typeof(b->'value'->'id') IS DISTINCT FROM 'number' OR (b->'value'->>'id') !~ '^[1-9][0-9]*$' OR (b->'value'->>'id')::numeric>9007199254740991
    OR jsonb_typeof(b->'value'->'mins_to_kick') IS DISTINCT FROM 'number'
    OR jsonb_typeof(b->'value'->'h') IS DISTINCT FROM 'number' OR jsonb_typeof(b->'value'->'d') IS DISTINCT FROM 'number' OR jsonb_typeof(b->'value'->'a') IS DISTINCT FROM 'number'
    OR (b->'value'->>'h')::numeric<=1 OR (b->'value'->>'d')::numeric<=1 OR (b->'value'->>'a')::numeric<=1
    OR research.utc_instant(b->'value'->>'captured_at')>receipt THEN RAISE EXCEPTION 'invalid odds chronology/identity/prices';END IF;
  END IF;

  INSERT INTO research.observations VALUES(oid,(b->>'fixture_id')::bigint,b->>'source_kind',b->>'source_ref',(b->>'collector_run_id')::uuid,b->>'field_name',b->'value',b->>'availability',CASE WHEN b->>'availability'='observed' THEN receipt END,receipt,effective,played,1,encode(public.digest((b->'value')::text,'sha256'),'hex'),b->>'source_hash',b);
  ids:=array_append(ids,oid);
 END LOOP;RETURN ids;
END $$;
COMMIT;
