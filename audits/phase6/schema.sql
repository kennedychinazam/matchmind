-- LOCAL DISPOSABLE PostgreSQL ONLY; not a hosted Supabase migration.
BEGIN;
CREATE ROLE shadow_operator NOLOGIN;
CREATE ROLE shadow_runner NOLOGIN;
CREATE ROLE shadow_reader NOLOGIN;
GRANT research_reader TO shadow_runner,shadow_reader;
CREATE SCHEMA shadow_eval AUTHORIZATION research_owner;
REVOKE ALL ON SCHEMA shadow_eval FROM PUBLIC,anon,authenticated;
SET LOCAL ROLE research_owner;
ALTER DEFAULT PRIVILEGES IN SCHEMA shadow_eval REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE shadow_eval.candidates(candidate_id text PRIMARY KEY CHECK(candidate_id ~ '^[0-9a-f]{64}$'),version text NOT NULL UNIQUE,envelope jsonb NOT NULL,registered_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE shadow_eval.jobs(job_id text PRIMARY KEY,candidate_id text NOT NULL REFERENCES shadow_eval.candidates,
 fixture_id bigint NOT NULL,snapshot_id uuid REFERENCES research.prediction_snapshots,source_prediction jsonb NOT NULL,
 declared_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(candidate_id,fixture_id));
CREATE INDEX ON shadow_eval.jobs(snapshot_id);
CREATE TABLE shadow_eval.results(job_id text PRIMARY KEY REFERENCES shadow_eval.jobs,envelope jsonb NOT NULL,received_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE shadow_eval.attempts(attempt_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,job_id text NOT NULL REFERENCES shadow_eval.jobs,
 state text NOT NULL CHECK(state IN('failed','completed')),code text NOT NULL CHECK(code IN('capture_missing','candidate_execution_failed','persistence_failed','completed','missing_evidence','unverified_capture','unverified_model_artifact')),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX ON shadow_eval.attempts(job_id);
CREATE TABLE shadow_eval.settlements(job_id text NOT NULL REFERENCES shadow_eval.jobs,revision integer NOT NULL,envelope jsonb NOT NULL,
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),payload_hash text NOT NULL,PRIMARY KEY(job_id,revision));
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['candidates','jobs','results','attempts','settlements']LOOP
  EXECUTE format('ALTER TABLE shadow_eval.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON shadow_eval.%I FOR EACH STATEMENT EXECUTE FUNCTION research.immutable()',t);
  EXECUTE format('GRANT SELECT ON shadow_eval.%I TO shadow_reader,shadow_operator',t);
  EXECUTE format('CREATE POLICY private_read ON shadow_eval.%I FOR SELECT TO shadow_reader,shadow_operator USING(true)',t);
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA shadow_eval TO shadow_reader,shadow_operator,shadow_runner;
-- All research and shadow payloads/indexes share the ORIGINAL ceiling and lock.
-- Reserve up to 1 MiB for bounded operational receipts inside that same ceiling.
CREATE OR REPLACE FUNCTION research.check_budget(extra_bytes bigint)RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE ctl research.control;used bigint;reserve bigint;BEGIN
 SELECT * INTO STRICT ctl FROM research.control FOR UPDATE;
 IF NOT ctl.enabled THEN RAISE EXCEPTION 'research capture disabled';END IF;
 SELECT coalesce(sum(pg_total_relation_size(oid)),0)INTO used FROM pg_class WHERE relnamespace IN('research'::regnamespace,'shadow_eval'::regnamespace)AND relkind IN('r','S');
 reserve:=least(1048576,ctl.max_bytes/10);
 IF extra_bytes<0 OR used+extra_bytes>ctl.max_bytes-reserve THEN RAISE EXCEPTION 'shared research storage limit exceeded' USING ERRCODE='54000';END IF;
END $$;
CREATE FUNCTION shadow_eval.register_candidate(b jsonb)RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior jsonb;cid text:=b->>'candidate_id';BEGIN
 IF jsonb_typeof(b)<>'object' OR octet_length(b::text)>32768 OR cid !~ '^[0-9a-f]{64}$'
 OR b->>'adapter_sha256' !~ '^[0-9a-f]{64}$' OR b->>'feature_source_hash' !~ '^[0-9a-f]{64}$'
 OR b->>'configuration_hash' !~ '^[0-9a-f]{64}$' OR b->>'study_kind' NOT IN('synthetic_verification','historical_exploratory') THEN RAISE EXCEPTION 'invalid candidate';END IF;
 PERFORM research.utc_instant(b->>'frozen_at_utc');
 PERFORM pg_advisory_xact_lock(hashtextextended(cid,0));
 SELECT envelope INTO prior FROM shadow_eval.candidates WHERE candidate_id=cid;
 IF FOUND THEN IF prior<>b THEN RAISE EXCEPTION 'candidate conflict';END IF;RETURN cid;END IF;
 PERFORM research.check_budget(octet_length(b::text)*4+65536);
 INSERT INTO shadow_eval.candidates VALUES(cid,b->>'version',b,clock_timestamp());RETURN cid;
END $$;
CREATE FUNCTION shadow_eval.declare_job(jid text,cid text,fid bigint,sid uuid)RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE source jsonb;prior shadow_eval.jobs;BEGIN
 IF jid IS NULL OR jid !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid job';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(jid,0));
 IF sid IS NOT NULL THEN
  SELECT envelope->'source_prediction' INTO STRICT source FROM research.prediction_snapshots WHERE snapshot_id=sid AND fixture_id=fid;
 ELSE SELECT to_jsonb(p) INTO STRICT source FROM public.predictions p WHERE fxid=fid;
 END IF;
 SELECT * INTO prior FROM shadow_eval.jobs WHERE job_id=jid OR(candidate_id=cid AND fixture_id=fid);
 IF FOUND THEN
  IF prior.job_id<>jid OR prior.candidate_id<>cid OR prior.fixture_id<>fid OR prior.snapshot_id IS DISTINCT FROM sid OR prior.source_prediction<>source THEN RAISE EXCEPTION 'job conflict';END IF;RETURN jid;
 END IF;
 PERFORM research.check_budget(octet_length(source::text)*4+65536);
 INSERT INTO shadow_eval.jobs(job_id,candidate_id,fixture_id,snapshot_id,source_prediction)VALUES(jid,cid,fid,sid,source);RETURN jid;
END $$;
CREATE FUNCTION shadow_eval.save_result(b jsonb)RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j shadow_eval.jobs;s research.prediction_snapshots;c shadow_eval.candidates;prior jsonb;mh text;v jsonb;total numeric:=0;BEGIN
 IF jsonb_typeof(b)IS DISTINCT FROM 'object' OR octet_length(b::text)>32768 THEN RAISE EXCEPTION 'invalid result';END IF;
 SELECT * INTO STRICT j FROM shadow_eval.jobs WHERE candidate_id=b->>'candidate_id' AND snapshot_id=(b->>'snapshot_id')::uuid FOR UPDATE;
 SELECT * INTO STRICT c FROM shadow_eval.candidates WHERE candidate_id=j.candidate_id;
 SELECT * INTO STRICT s FROM research.prediction_snapshots WHERE snapshot_id=j.snapshot_id;
 SELECT payload_hash INTO STRICT mh FROM research.evidence_manifests WHERE manifest_id=s.evidence_manifest_id;
 IF b->'visibility' IS DISTINCT FROM '"shadow"'::jsonb OR b->'confirmatory_eligible' IS DISTINCT FROM 'false'::jsonb
 OR b->'configuration_hash' IS DISTINCT FROM c.envelope->'configuration_hash' OR b->'candidate_version' IS DISTINCT FROM c.envelope->'version'
 OR b->'study_kind' IS DISTINCT FROM c.envelope->'study_kind'
 OR b->>'baseline_payload_hash' IS DISTINCT FROM s.payload_hash OR b->>'evidence_manifest_hash' IS DISTINCT FROM mh
 OR (b->>'feature_manifest_hash' ~ '^[0-9a-f]{64}$')IS DISTINCT FROM true
 OR (b->>'result_id' ~ '^[0-9a-f]{64}$')IS DISTINCT FROM true THEN RAISE EXCEPTION 'result lineage invalid';END IF;
 IF b->>'status'='fallback' THEN
  IF b->>'reason' NOT IN('unverified_capture','unverified_model_artifact','missing_evidence','candidate_execution_failed')
  OR b->'reason' IS NULL OR b->'reason'='null'::jsonb OR b->'probabilities' IS DISTINCT FROM s.envelope->'probabilities' THEN RAISE EXCEPTION 'fallback must equal original';END IF;
 ELSIF b->>'status'='forecast' THEN
  IF b->'reason' IS DISTINCT FROM 'null'::jsonb OR s.capture_kind<>'at_issue' THEN RAISE EXCEPTION 'invalid forecast capture';END IF;
 ELSE RAISE EXCEPTION 'invalid result status';END IF;
 IF jsonb_typeof(b->'probabilities')IS DISTINCT FROM 'array' OR jsonb_array_length(b->'probabilities')<>3 THEN RAISE EXCEPTION 'invalid probabilities';END IF;
 FOR v IN SELECT * FROM jsonb_array_elements(b->'probabilities')LOOP
  IF jsonb_typeof(v)<>'number' OR(v::text)::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'invalid probabilities';END IF;total:=total+(v::text)::numeric;
 END LOOP;
 IF abs(total-1)>.005 THEN RAISE EXCEPTION 'invalid probabilities';END IF;
 SELECT envelope INTO prior FROM shadow_eval.results WHERE job_id=j.job_id;
 IF FOUND THEN IF prior<>b THEN RAISE EXCEPTION 'result conflict';END IF;RETURN j.job_id;END IF;
 PERFORM research.check_budget(octet_length(b::text)*4+65536);
 INSERT INTO shadow_eval.results VALUES(j.job_id,b,clock_timestamp());RETURN j.job_id;
END $$;
CREATE FUNCTION shadow_eval.record_attempt(jid text,st text,cd text)RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE used bigint;ceiling bigint;aid bigint;BEGIN
 SELECT max_bytes INTO ceiling FROM research.control FOR UPDATE;
 SELECT coalesce(sum(pg_total_relation_size(oid)),0)INTO used FROM pg_class WHERE relnamespace IN('research'::regnamespace,'shadow_eval'::regnamespace)AND relkind IN('r','S');
 IF used+16384>ceiling THEN RAISE EXCEPTION 'operational storage limit exceeded' USING ERRCODE='54000';END IF;
 IF(SELECT count(*)FROM shadow_eval.attempts WHERE job_id=jid)>=8 OR(SELECT count(*)FROM shadow_eval.attempts)>=10000 THEN RAISE EXCEPTION 'attempt limit reached';END IF;
 INSERT INTO shadow_eval.attempts(job_id,state,code)VALUES(jid,st,cd)RETURNING attempt_id INTO aid;RETURN aid;
END $$;
CREATE FUNCTION shadow_eval.settle(jid text,b jsonb)RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j shadow_eval.jobs;rev integer;c shadow_eval.candidates;at timestamptz:=clock_timestamp();BEGIN
 SELECT * INTO STRICT j FROM shadow_eval.jobs WHERE job_id=jid FOR UPDATE;
 SELECT * INTO STRICT c FROM shadow_eval.candidates WHERE candidate_id=j.candidate_id;
 IF b->>'fixture_id' IS DISTINCT FROM j.fixture_id::text THEN RAISE EXCEPTION 'settlement fixture mismatch';END IF;
 IF b->>'kind' IS DISTINCT FROM c.envelope->>'study_kind' OR jsonb_typeof(b->'fixture')IS DISTINCT FROM 'object' OR octet_length(b::text)>16384 THEN RAISE EXCEPTION 'invalid settlement';END IF;
 IF b->>'kind'<>'synthetic_verification' AND research.utc_instant(concat(b#>>'{fixture,date}','T',b#>>'{fixture,time}',':00Z'))>at THEN RAISE EXCEPTION 'future settlement';END IF;
 PERFORM research.check_budget(octet_length(b::text)*4+65536);
 SELECT coalesce(max(revision),0)+1 INTO rev FROM shadow_eval.settlements WHERE job_id=jid;
 INSERT INTO shadow_eval.settlements VALUES(jid,rev,b,at,encode(public.digest(b::text,'sha256'),'hex'));RETURN rev;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shadow_eval FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION shadow_eval.register_candidate(jsonb),shadow_eval.declare_job(text,text,bigint,uuid),shadow_eval.settle(text,jsonb)TO shadow_operator;
GRANT EXECUTE ON FUNCTION shadow_eval.save_result(jsonb),shadow_eval.record_attempt(text,text,text)TO shadow_runner;
COMMIT;
