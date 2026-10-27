-- Optional additive extension for the isolated database ONLY.
-- Does not replace any existing function, table, policy or financial ledger.
BEGIN;
SET LOCAL ROLE research_owner;
CREATE TABLE shadow_eval.a3_capacity_exceptions(
 receipt_id text PRIMARY KEY,study_id text NOT NULL REFERENCES shadow_eval.weekend_events(event_id),
 job_id text NOT NULL REFERENCES shadow_eval.weekend_events(event_id),
 body jsonb NOT NULL,body_hash text NOT NULL,received_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE UNIQUE INDEX capacity_director_approval_once ON shadow_eval.a3_capacity_exceptions((body->>'director_approval_sha256'));
ALTER TABLE shadow_eval.a3_capacity_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY capacity_private_read ON shadow_eval.a3_capacity_exceptions FOR SELECT TO shadow_reader,shadow_operator USING(true);
GRANT SELECT ON shadow_eval.a3_capacity_exceptions TO shadow_reader,shadow_operator;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON shadow_eval.a3_capacity_exceptions FOR EACH STATEMENT EXECUTE FUNCTION research.immutable();
CREATE TABLE shadow_eval.a3_capacity_attempts(
 experiment_id text PRIMARY KEY CHECK(experiment_id='santos-palmeiras-1492438-20261028-a3-capacity-risk-v1'),
 exception_id text NOT NULL UNIQUE REFERENCES shadow_eval.a3_capacity_exceptions(receipt_id),
 study_id text NOT NULL REFERENCES shadow_eval.weekend_events(event_id),
 reservation_id text NOT NULL UNIQUE REFERENCES shadow_eval.weekend_events(event_id),received_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE shadow_eval.a3_capacity_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY capacity_attempt_private_read ON shadow_eval.a3_capacity_attempts FOR SELECT TO shadow_reader,shadow_operator USING(true);
GRANT SELECT ON shadow_eval.a3_capacity_attempts TO shadow_reader,shadow_operator;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON shadow_eval.a3_capacity_attempts FOR EACH STATEMENT EXECUTE FUNCTION research.immutable();
CREATE FUNCTION shadow_eval.a3_capacity_record(id text,jid text,b jsonb)RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j shadow_eval.weekend_events;p shadow_eval.weekend_events;s shadow_eval.weekend_events;at timestamptz;field text;
 keys text[]:=ARRAY['version','experiment_id','director_approved','director_approval_sha256','study_id','job_id','fixture_id','kickoff_at_utc','issuance_date_utc','expires_at_utc','request_hash','request_body_hash','packet_hash','prompt_hash','schema_hash','profile_hash','endpoint_contract_hash','model','provider','backend','input_bytes','complete_input_upper_tokens','capacity_status','provider_input_cap_tokens','context_tokens','physical_output_tokens','output_tokens','schema_contract_reviewed','output_contract_reviewed','review_artifact_sha256'];
BEGIN
 IF id !~ '^[A-Za-z0-9:._-]{1,128}$' OR jsonb_typeof(b)IS DISTINCT FROM 'object' OR octet_length(b::text)>8192 OR NOT(b ?& keys)OR EXISTS(SELECT FROM jsonb_object_keys(b)k WHERE k<>ALL(keys))THEN RAISE EXCEPTION 'closed capacity exception receipt required';END IF;
 FOREACH field IN ARRAY ARRAY['director_approval_sha256','request_hash','request_body_hash','packet_hash','prompt_hash','schema_hash','profile_hash','endpoint_contract_hash','review_artifact_sha256']LOOP
  IF jsonb_typeof(b->field)IS DISTINCT FROM 'string' OR coalesce(b->>field,'') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'capacity exception hash required';END IF;
 END LOOP;
 IF b->>'version' IS DISTINCT FROM 'a3-capacity-risk-exception-v1' OR b->>'experiment_id' IS DISTINCT FROM 'santos-palmeiras-1492438-20261028-a3-capacity-risk-v1' OR b->'director_approved' IS DISTINCT FROM 'true'::jsonb OR b->'complete_input_upper_tokens' IS DISTINCT FROM 'null'::jsonb OR b->>'capacity_status' IS DISTINCT FROM 'unverified' OR b->'schema_contract_reviewed' IS DISTINCT FROM 'true'::jsonb OR b->'output_contract_reviewed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'unverified Director exception required';END IF;
 IF b->>'fixture_id' IS DISTINCT FROM '1492438' OR b->>'kickoff_at_utc' IS DISTINCT FROM '2026-10-28T22:30:00Z' OR b->>'model' IS DISTINCT FROM 'openai/gpt-6-luna' OR b->>'provider' IS DISTINCT FROM 'OpenAI' OR b->>'backend' IS DISTINCT FROM 'openai' OR b->'provider_input_cap_tokens' IS DISTINCT FROM '922000'::jsonb OR b->'context_tokens' IS DISTINCT FROM '1050000'::jsonb OR b->'physical_output_tokens' IS DISTINCT FROM '128000'::jsonb OR b->'output_tokens' IS DISTINCT FROM '4096'::jsonb OR b->>'prompt_hash' IS DISTINCT FROM '19b28b55107630126de37f4b1fc1d52afc01aba1ebef9c9c802b289c2af406cf' OR b->>'schema_hash' IS DISTINCT FROM '7347a74b07cc5f0379db773dc4f174fe12d6c6ebf083fedf422379acaee5f500' OR jsonb_typeof(b->'input_bytes')IS DISTINCT FROM 'number' OR coalesce(b->>'input_bytes','') !~ '^[1-9][0-9]{0,6}$' OR(b->>'input_bytes')::bigint>1050000 THEN RAISE EXCEPTION 'fixed fixture or contract scope';END IF;
 SELECT * INTO STRICT j FROM shadow_eval.weekend_events WHERE event_id=jid AND kind='job';
 SELECT * INTO STRICT p FROM shadow_eval.weekend_events WHERE event_id=j.parent_id AND kind='packet';
 SELECT * INTO STRICT s FROM shadow_eval.weekend_events WHERE event_id=p.parent_id AND kind='study';
 IF b->>'study_id' IS DISTINCT FROM s.event_id OR b->>'job_id' IS DISTINCT FROM jid OR s.body->>'version' IS DISTINCT FROM 'a3-supervised-single-v1' OR s.body->'one_request' IS DISTINCT FROM 'true'::jsonb OR j.body->>'fixture_id' IS DISTINCT FROM '1492438' OR s.body->>'fixture_id' IS DISTINCT FROM '1492438' OR b->>'issuance_date_utc' IS DISTINCT FROM s.body->>'issuance_date_utc' OR j.body->>'kickoff_at_utc' IS DISTINCT FROM '2026-10-28T22:30:00Z' OR p.body->'targets' IS DISTINCT FROM '[1492438]'::jsonb OR(SELECT count(*)FROM jsonb_array_elements(p.body->'rows')r WHERE r->>'fxid'='1492438')<>1 OR(SELECT count(*)FROM jsonb_array_elements(p.body->'rows')r WHERE r->>'fxid'='1492438' AND r->>'home'='Santos' AND r->>'away'='Palmeiras' AND r->>'lid'='71' AND r->>'date'='2026-10-28' AND r->>'time'='22:30')<>1 THEN RAISE EXCEPTION 'capacity study source identity mismatch';END IF;
 PERFORM 1 FROM research.control FOR UPDATE;at:=clock_timestamp();
 IF b->>'issuance_date_utc' NOT IN('2026-10-27','2026-10-28')OR b->>'issuance_date_utc' IS DISTINCT FROM to_char(at AT TIME ZONE 'UTC','YYYY-MM-DD')OR b->>'expires_at_utc' IS NULL OR p.body#>>'{collection,earliest_receipt_at_utc}' IS NULL OR(p.body#>>'{collection,earliest_receipt_at_utc}')::timestamptz>at OR(b->>'expires_at_utc')::timestamptz<=at OR(b->>'expires_at_utc')::timestamptz>least(at+interval '10 minutes','2026-10-28T22:22:30Z'::timestamptz,(p.body#>>'{collection,earliest_receipt_at_utc}')::timestamptz+interval '15 minutes')THEN RAISE EXCEPTION 'capacity receipt date or expiry';END IF;
 PERFORM research.check_budget(octet_length(b::text)*4+65536);
 INSERT INTO shadow_eval.a3_capacity_exceptions VALUES(id,s.event_id,jid,b,encode(public.digest(b::text,'sha256'),'hex'),clock_timestamp());RETURN id;
END $$;
CREATE FUNCTION shadow_eval.a3_capacity_reserve(aid text,rid text,jid text,b jsonb)RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a shadow_eval.a3_operator_receipts;e shadow_eval.a3_capacity_exceptions;j shadow_eval.weekend_events;p shadow_eval.weekend_events;s shadow_eval.weekend_events;deadline timestamptz;
BEGIN
 -- Same shared financial/resource lock as ordinary reservation; no second ledger.
 PERFORM 1 FROM research.control FOR UPDATE;
 SELECT * INTO STRICT a FROM shadow_eval.a3_operator_receipts WHERE receipt_id=aid AND kind='authorization' AND job_id=jid;
 SELECT * INTO STRICT e FROM shadow_eval.a3_capacity_exceptions WHERE receipt_id=b->>'capacity_exception_id' AND job_id=jid;
 SELECT * INTO STRICT j FROM shadow_eval.weekend_events WHERE event_id=jid AND kind='job';
 SELECT * INTO STRICT p FROM shadow_eval.weekend_events WHERE event_id=j.parent_id AND kind='packet';
 SELECT * INTO STRICT s FROM shadow_eval.weekend_events WHERE event_id=p.parent_id AND kind='study';
 IF EXISTS(SELECT FROM shadow_eval.a3_capacity_attempts)OR EXISTS(SELECT FROM shadow_eval.a3_single_attempts WHERE study_id=s.event_id)OR EXISTS(SELECT FROM shadow_eval.weekend_events r JOIN shadow_eval.weekend_events j2 ON j2.event_id=r.parent_id JOIN shadow_eval.weekend_events p2 ON p2.event_id=j2.parent_id WHERE r.kind='reservation' AND p2.parent_id=s.event_id)THEN RAISE EXCEPTION 'capacity experiment or study already attempted';END IF;
 IF s.body->>'version' IS DISTINCT FROM 'a3-supervised-single-v1' OR s.body->'one_request' IS DISTINCT FROM 'true'::jsonb OR e.study_id IS DISTINCT FROM s.event_id OR e.body->>'fixture_id' IS DISTINCT FROM j.body->>'fixture_id' OR a.body->>'fixture_id' IS DISTINCT FROM '1492438' OR a.body->>'request_hash' IS DISTINCT FROM b->>'request_hash' OR e.body->>'request_hash' IS DISTINCT FROM b->>'request_hash' OR a.body->>'packet_hash' IS DISTINCT FROM e.body->>'packet_hash' OR a.body->>'issuance_date_utc' IS DISTINCT FROM to_char(clock_timestamp()AT TIME ZONE 'UTC','YYYY-MM-DD')OR a.body->>'issuance_date_utc' IS DISTINCT FROM e.body->>'issuance_date_utc' OR a.body->>'capacity_exception_id' IS DISTINCT FROM e.receipt_id OR a.body->>'capacity_exception_body_hash' IS DISTINCT FROM e.body_hash OR b->>'capacity_exception_body_hash' IS DISTINCT FROM e.body_hash OR a.body->>'capacity_status' IS DISTINCT FROM 'unverified' OR b->>'capacity_status' IS DISTINCT FROM 'unverified' OR b->'complete_input_upper_tokens' IS DISTINCT FROM 'null'::jsonb OR a.body->'max_new_micros' IS DISTINCT FROM '306000'::jsonb OR b->'reserved_micros' IS DISTINCT FROM '306000'::jsonb THEN RAISE EXCEPTION 'atomic capacity authorization scope';END IF;
 IF b#>>'{profile,profile_hash}' IS DISTINCT FROM e.body->>'profile_hash' OR b#>>'{profile,model}' IS DISTINCT FROM 'openai/gpt-6-luna' OR b#>'{profile,context_length}' IS DISTINCT FROM '1050000'::jsonb OR b#>'{profile,physical_completion_max}' IS DISTINCT FROM '128000'::jsonb OR b#>>'{request,body,model}' IS DISTINCT FROM 'openai/gpt-6-luna' OR b#>'{request,body,max_tokens}' IS DISTINCT FROM '4096'::jsonb OR b#>'{request,body,stream}' IS DISTINCT FROM 'false'::jsonb OR b#>'{request,body,tools}' IS DISTINCT FROM '[]'::jsonb OR b#>'{request,body,plugins}' IS DISTINCT FROM '[]'::jsonb OR b#>>'{request,body,tool_choice}' IS DISTINCT FROM 'none' OR b#>'{request,body,provider,only}' IS DISTINCT FROM '["openai"]'::jsonb OR b#>'{request,body,provider,allow_fallbacks}' IS DISTINCT FROM 'false'::jsonb OR b#>'{request,body,provider,require_parameters}' IS DISTINCT FROM 'true'::jsonb OR b#>'{request,body,provider,max_price}' IS DISTINCT FROM '{"prompt":0.2,"completion":0.75}'::jsonb THEN RAISE EXCEPTION 'capacity request endpoint or output scope';END IF;
 IF b->>'gate_deadline_utc' IS NULL OR a.body#>>'{byok,recorded_at_utc}' IS NULL OR p.body#>>'{collection,earliest_receipt_at_utc}' IS NULL THEN RAISE EXCEPTION 'capacity source or authorization deadline absent';END IF;
 deadline:=least((b->>'gate_deadline_utc')::timestamptz,(a.body->>'expires_at_utc')::timestamptz,a.received_at+interval '10 minutes',(a.body#>>'{byok,recorded_at_utc}')::timestamptz+interval '10 minutes',(p.body#>>'{collection,earliest_receipt_at_utc}')::timestamptz+interval '15 minutes',(e.body->>'expires_at_utc')::timestamptz,e.received_at+interval '10 minutes','2026-10-28T22:22:30Z'::timestamptz,((a.body->>'issuance_date_utc')::date+1)::timestamp AT TIME ZONE 'UTC');
 IF clock_timestamp()>=deadline THEN RAISE EXCEPTION 'atomic capacity authorization/source deadline expired';END IF;
 PERFORM shadow_eval.weekend_append('reservation',rid,jid,b||'{"requires_confirmation":true}'::jsonb);
 PERFORM shadow_eval.weekend_append('confirmation',rid||':commit',rid,'{"status":"accepted"}'::jsonb);
 INSERT INTO shadow_eval.a3_single_attempts VALUES(s.event_id,jid,rid,b->>'request_hash',clock_timestamp());
 INSERT INTO shadow_eval.a3_capacity_attempts VALUES(e.body->>'experiment_id',e.receipt_id,s.event_id,rid,clock_timestamp());
 IF clock_timestamp()>=deadline THEN RAISE EXCEPTION 'atomic capacity deadline crossed before reservation commit';END IF;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION shadow_eval.a3_capacity_record(text,text,jsonb),shadow_eval.a3_capacity_reserve(text,text,text,jsonb)FROM PUBLIC,anon,authenticated,shadow_runner;
GRANT EXECUTE ON FUNCTION shadow_eval.a3_capacity_record(text,text,jsonb),shadow_eval.a3_capacity_reserve(text,text,text,jsonb)TO shadow_operator;
COMMIT;
