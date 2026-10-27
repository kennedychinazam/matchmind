-- ADDITIVE, isolated research database only. Never apply to hosted Supabase.
-- Original weekend_append, Sunday dates, financial table and budget lock unchanged.
BEGIN;
SET LOCAL ROLE research_owner;
CREATE TABLE shadow_eval.a3_operator_receipts(
 receipt_id text PRIMARY KEY,kind text NOT NULL CHECK(kind IN('authorization','readiness')),
 job_id text NOT NULL REFERENCES shadow_eval.weekend_events(event_id),
 body jsonb NOT NULL,body_hash text NOT NULL,received_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE shadow_eval.a3_operator_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY private_a3_read ON shadow_eval.a3_operator_receipts FOR SELECT TO shadow_reader,shadow_operator USING(true);
GRANT SELECT ON shadow_eval.a3_operator_receipts TO shadow_reader,shadow_operator;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON shadow_eval.a3_operator_receipts FOR EACH STATEMENT EXECUTE FUNCTION research.immutable();
CREATE FUNCTION shadow_eval.a3_single_study(id text,b jsonb)RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE at timestamptz:=clock_timestamp();BEGIN
 IF jsonb_typeof(b)IS DISTINCT FROM 'object' OR NOT(b ?& ARRAY['version','issuance_date_utc','fixture_id','model','provider','one_request','source_hash'])OR EXISTS(SELECT FROM jsonb_object_keys(b)k WHERE k NOT IN('version','issuance_date_utc','fixture_id','model','provider','one_request','source_hash'))OR coalesce(b->>'issuance_date_utc','')='' OR coalesce(b->>'fixture_id','')='' OR coalesce(b->>'source_hash','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'closed single-study declaration required';END IF;
 IF id !~ '^[A-Za-z0-9:._-]{1,96}$' OR b->>'version' IS DISTINCT FROM 'a3-supervised-single-v1' OR b->>'issuance_date_utc' !~ '^2026-10-(2[7-9]|3[01])$' OR b->>'fixture_id' !~ '^[1-9][0-9]{0,17}$' OR b->>'model' IS DISTINCT FROM 'openai/gpt-6-luna' OR b->>'provider' IS DISTINCT FROM 'OpenAI' OR b->'one_request' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'invalid single-study declaration';END IF;
 PERFORM 1 FROM research.control FOR UPDATE;
 IF EXISTS(SELECT FROM shadow_eval.weekend_events WHERE event_id=id)THEN RAISE EXCEPTION 'single study already exists';END IF;
 PERFORM research.check_budget(octet_length(b::text)*4+65536);
 INSERT INTO shadow_eval.weekend_events VALUES(id,'study',NULL,encode(public.digest(b::text,'sha256'),'hex'),b,at);RETURN id;
END $$;
CREATE FUNCTION shadow_eval.a3_operator_record(k text,id text,jid text,b jsonb)RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j shadow_eval.weekend_events;s shadow_eval.weekend_events;BEGIN
 IF k NOT IN('authorization','readiness')OR id !~ '^[A-Za-z0-9:._-]{1,128}$' OR jsonb_typeof(b)IS DISTINCT FROM 'object' OR octet_length(b::text)>65536 THEN RAISE EXCEPTION 'invalid operator receipt';END IF;
 IF coalesce(b->>'request_hash','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'operator request hash required';END IF;
 SELECT * INTO STRICT j FROM shadow_eval.weekend_events WHERE event_id=jid AND kind='job';
 SELECT st.* INTO STRICT s FROM shadow_eval.weekend_events p JOIN shadow_eval.weekend_events st ON st.event_id=p.parent_id WHERE p.event_id=j.parent_id AND p.kind='packet' AND st.kind='study';
 IF s.body->>'version' IS DISTINCT FROM 'a3-supervised-single-v1' OR b->>'request_hash' !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'operator receipt scope';END IF;
 IF k='authorization' AND(b->>'version' IS DISTINCT FROM 'a3-single-final-v1' OR b->>'fixture_id' IS DISTINCT FROM j.body->>'fixture_id' OR b->>'issuance_date_utc' IS DISTINCT FROM s.body->>'issuance_date_utc' OR b->>'model' IS DISTINCT FROM 'openai/gpt-6-luna' OR b->>'provider' IS DISTINCT FROM 'OpenAI' OR coalesce(b->>'operator_message_sha256','') !~ '^[a-f0-9]{64}$' OR b->>'expires_at_utc' IS NULL OR b->>'max_new_micros' IS NULL OR(b->>'expires_at_utc')::timestamptz<=clock_timestamp() OR(b->>'expires_at_utc')::timestamptz>clock_timestamp()+interval '10 minutes' OR(b->>'max_new_micros')::bigint NOT BETWEEN 1 AND 5000000)THEN RAISE EXCEPTION 'invalid final authorization';END IF;
 IF k='readiness' AND(b->>'version' IS DISTINCT FROM 'a3-reviewed-provider-bound-v1' OR coalesce(b->>'review_artifact_sha256','') !~ '^[a-f0-9]{64}$' OR coalesce(b->>'profile_hash','') !~ '^[a-f0-9]{64}$' OR coalesce(b->>'schema_hash','') !~ '^[a-f0-9]{64}$' OR b->>'complete_input_upper_tokens' IS NULL OR(b->>'complete_input_upper_tokens')::bigint NOT BETWEEN 1 AND 922000 OR b->'schema_contract_reviewed' IS DISTINCT FROM 'true'::jsonb OR b->'output_contract_reviewed' IS DISTINCT FROM 'true'::jsonb)THEN RAISE EXCEPTION 'invalid reviewed bound';END IF;
 PERFORM 1 FROM research.control FOR UPDATE;PERFORM research.check_budget(octet_length(b::text)*4+65536);
 INSERT INTO shadow_eval.a3_operator_receipts VALUES(id,k,jid,b,encode(public.digest(b::text,'sha256'),'hex'),clock_timestamp());RETURN id;
END $$;
REVOKE ALL ON FUNCTION shadow_eval.a3_single_study(text,jsonb),shadow_eval.a3_operator_record(text,text,text,jsonb)FROM PUBLIC,anon,authenticated,shadow_runner;
GRANT EXECUTE ON FUNCTION shadow_eval.a3_single_study(text,jsonb),shadow_eval.a3_operator_record(text,text,text,jsonb)TO shadow_operator;
COMMIT;
