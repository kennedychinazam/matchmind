-- Isolated synthetic PostgreSQL only. Additive; Phase 6 registry remains unchanged.
BEGIN;
SET LOCAL ROLE research_owner;
CREATE TABLE shadow_eval.training_datasets(dataset_hash text PRIMARY KEY,kind text NOT NULL CHECK(kind='synthetic_verification'),header jsonb NOT NULL,registered_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE shadow_eval.training_examples(dataset_hash text NOT NULL REFERENCES shadow_eval.training_datasets,fixture_id bigint NOT NULL,snapshot_id uuid REFERENCES research.prediction_snapshots,body jsonb NOT NULL,PRIMARY KEY(dataset_hash,fixture_id));
CREATE INDEX ON shadow_eval.training_examples(snapshot_id);
CREATE TABLE shadow_eval.training_artifacts(artifact_hash text PRIMARY KEY,dataset_hash text NOT NULL REFERENCES shadow_eval.training_datasets,version text NOT NULL UNIQUE,body jsonb NOT NULL,protocol_hash text NOT NULL,registered_at timestamptz NOT NULL DEFAULT clock_timestamp());
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['training_datasets','training_examples','training_artifacts']LOOP
  EXECUTE format('ALTER TABLE shadow_eval.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON shadow_eval.%I FOR EACH STATEMENT EXECUTE FUNCTION research.immutable()',t);
  EXECUTE format('GRANT SELECT ON shadow_eval.%I TO shadow_reader,shadow_operator',t);
  EXECUTE format('CREATE POLICY private_read ON shadow_eval.%I FOR SELECT TO shadow_reader,shadow_operator USING(true)',t);
 END LOOP;
END $$;
CREATE FUNCTION shadow_eval.register_training_dataset(h jsonb,rows jsonb)RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE key text:=h->>'dataset_hash';prior jsonb;r jsonb;s research.prediction_snapshots;BEGIN
 IF(h->>'kind'='synthetic_verification')IS DISTINCT FROM true OR(key ~ '^[0-9a-f]{64}$')IS DISTINCT FROM true OR jsonb_typeof(rows)IS DISTINCT FROM 'array' OR jsonb_array_length(rows)>1000 OR octet_length(h::text)+octet_length(rows::text)>2097152 THEN RAISE EXCEPTION 'invalid synthetic training dataset';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(key,0));
 SELECT header INTO prior FROM shadow_eval.training_datasets WHERE dataset_hash=key;
 IF FOUND THEN
  IF prior<>h OR jsonb_array_length(rows)<>(SELECT count(*)FROM shadow_eval.training_examples WHERE dataset_hash=key) OR EXISTS(SELECT FROM jsonb_array_elements(rows)x WHERE NOT EXISTS(SELECT FROM shadow_eval.training_examples e WHERE e.dataset_hash=key AND e.fixture_id=(x->>'fixture_id')::bigint AND e.body=x))THEN RAISE EXCEPTION 'training dataset conflict';END IF;RETURN key;
 END IF;
 IF(h->>'roster')::int<>jsonb_array_length(rows)THEN RAISE EXCEPTION 'training roster mismatch';END IF;
 PERFORM research.check_budget((octet_length(h::text)+octet_length(rows::text))*4+131072);
 INSERT INTO shadow_eval.training_datasets VALUES(key,'synthetic_verification',h,clock_timestamp());
 FOR r IN SELECT * FROM jsonb_array_elements(rows)LOOP
  IF r->>'snapshot_id' IS NOT NULL THEN
   SELECT * INTO STRICT s FROM research.prediction_snapshots WHERE snapshot_id=(r->>'snapshot_id')::uuid AND fixture_id=(r->>'fixture_id')::bigint;
   IF r->>'status'='eligible' AND(r#>'{sample,baseline}')IS DISTINCT FROM s.envelope->'probabilities' THEN RAISE EXCEPTION 'training original probabilities mismatch';END IF;
  END IF;
  INSERT INTO shadow_eval.training_examples VALUES(key,(r->>'fixture_id')::bigint,(r->>'snapshot_id')::uuid,r);
 END LOOP;RETURN key;
END $$;
CREATE FUNCTION shadow_eval.register_training_artifact(b jsonb,protocol text)RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a shadow_eval.training_artifacts;h shadow_eval.training_datasets;key text:=b->>'artifact_hash';BEGIN
 IF b->>'artifact_kind' IS DISTINCT FROM 'synthetic_training' OR b->'production_ready' IS DISTINCT FROM 'false'::jsonb OR b->'confirmatory_eligible' IS DISTINCT FROM 'false'::jsonb OR(key ~ '^[0-9a-f]{64}$')IS DISTINCT FROM true OR(protocol ~ '^[0-9a-f]{64}$')IS DISTINCT FROM true OR jsonb_typeof(b->'beta')IS DISTINCT FROM 'number' OR(b->>'beta')::numeric NOT BETWEEN -1 AND 1 OR octet_length(b::text)>2097152 THEN RAISE EXCEPTION 'invalid synthetic coefficient artifact';END IF;
 SELECT * INTO STRICT h FROM shadow_eval.training_datasets WHERE dataset_hash=b->>'training_dataset_hash';
 PERFORM pg_advisory_xact_lock(hashtextextended(key,0));
 SELECT * INTO a FROM shadow_eval.training_artifacts WHERE artifact_hash=key;
 IF FOUND THEN
  IF a.body<>b OR a.protocol_hash<>protocol THEN RAISE EXCEPTION 'training artifact conflict';END IF;
 ELSE
  PERFORM research.check_budget(octet_length(b::text)*4+65536);
  INSERT INTO shadow_eval.training_artifacts VALUES(key,h.dataset_hash,b->>'version',b,protocol,clock_timestamp())RETURNING * INTO a;
 END IF;
 RETURN jsonb_build_object('dataset_kind','synthetic_verification','source',h.header->'source','artifact_hash',key,'training_dataset_hash',h.dataset_hash,'protocol_hash',a.protocol_hash,'registered_at_utc',to_char(a.registered_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
END $$;
REVOKE ALL ON FUNCTION shadow_eval.register_training_dataset(jsonb,jsonb),shadow_eval.register_training_artifact(jsonb,text)FROM PUBLIC,anon,authenticated,shadow_runner;
GRANT EXECUTE ON FUNCTION shadow_eval.register_training_dataset(jsonb,jsonb),shadow_eval.register_training_artifact(jsonb,text)TO shadow_operator;
COMMIT;
