-- Isolated additive latch. All actual money stays in weekend_events.
BEGIN;
SET LOCAL ROLE research_owner;
CREATE TABLE shadow_eval.a3_single_attempts(
 study_id text PRIMARY KEY REFERENCES shadow_eval.weekend_events(event_id),
 job_id text NOT NULL REFERENCES shadow_eval.weekend_events(event_id),
 reservation_id text NOT NULL UNIQUE REFERENCES shadow_eval.weekend_events(event_id),
 request_hash text NOT NULL,received_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE shadow_eval.a3_single_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY private_attempt_read ON shadow_eval.a3_single_attempts FOR SELECT TO shadow_reader,shadow_operator USING(true);
GRANT SELECT ON shadow_eval.a3_single_attempts TO shadow_reader,shadow_operator;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON shadow_eval.a3_single_attempts FOR EACH STATEMENT EXECUTE FUNCTION research.immutable();
CREATE UNIQUE INDEX a3_one_operator_message ON shadow_eval.a3_operator_receipts((body->>'operator_message_sha256'))WHERE kind='authorization';
CREATE FUNCTION shadow_eval.a3_single_reserve(aid text,rid text,jid text,b jsonb)RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a shadow_eval.a3_operator_receipts;j shadow_eval.weekend_events;p shadow_eval.weekend_events;s shadow_eval.weekend_events;deadline timestamptz;at timestamptz;BEGIN
 PERFORM 1 FROM research.control FOR UPDATE;
 SELECT * INTO STRICT a FROM shadow_eval.a3_operator_receipts WHERE receipt_id=aid AND kind='authorization' AND job_id=jid;
 SELECT * INTO STRICT j FROM shadow_eval.weekend_events WHERE event_id=jid AND kind='job';
 SELECT * INTO STRICT p FROM shadow_eval.weekend_events WHERE event_id=j.parent_id AND kind='packet';
 SELECT * INTO STRICT s FROM shadow_eval.weekend_events WHERE event_id=p.parent_id AND kind='study';
 IF s.body->>'version' IS DISTINCT FROM 'a3-supervised-single-v1' OR s.body->'one_request' IS DISTINCT FROM 'true'::jsonb OR a.body->>'request_hash' IS DISTINCT FROM b->>'request_hash' OR a.body->>'max_new_micros' IS DISTINCT FROM b->>'reserved_micros' OR a.body->>'fixture_id' IS DISTINCT FROM j.body->>'fixture_id' OR a.body->>'issuance_date_utc' IS DISTINCT FROM to_char(clock_timestamp()AT TIME ZONE 'UTC','YYYY-MM-DD') THEN RAISE EXCEPTION 'atomic authorization scope';END IF;
 IF b->>'gate_deadline_utc' IS NULL OR b->>'readiness_id' IS NULL OR NOT EXISTS(SELECT FROM shadow_eval.a3_operator_receipts r WHERE r.receipt_id=b->>'readiness_id' AND r.kind='readiness' AND r.job_id=jid AND r.body->>'request_hash'=b->>'request_hash')THEN RAISE EXCEPTION 'atomic readiness or deadline absent';END IF;
 IF EXISTS(SELECT FROM shadow_eval.a3_single_attempts WHERE study_id=s.event_id)OR EXISTS(SELECT FROM shadow_eval.weekend_events r JOIN shadow_eval.weekend_events j2 ON j2.event_id=r.parent_id JOIN shadow_eval.weekend_events p2 ON p2.event_id=j2.parent_id WHERE r.kind='reservation' AND p2.parent_id=s.event_id)THEN RAISE EXCEPTION 'single study already attempted';END IF;
 IF a.body#>>'{byok,recorded_at_utc}' IS NULL OR p.body#>>'{collection,earliest_receipt_at_utc}' IS NULL THEN RAISE EXCEPTION 'source or operator original clock absent';END IF;
 deadline:=least((b->>'gate_deadline_utc')::timestamptz,(a.body->>'expires_at_utc')::timestamptz,a.received_at+interval '10 minutes',(a.body#>>'{byok,recorded_at_utc}')::timestamptz+interval '10 minutes',(p.body#>>'{collection,earliest_receipt_at_utc}')::timestamptz+interval '15 minutes',(j.body->>'kickoff_at_utc')::timestamptz-interval '450 seconds',((a.body->>'issuance_date_utc')::date+1)::timestamp AT TIME ZONE 'UTC');
 IF clock_timestamp()>=deadline THEN RAISE EXCEPTION 'atomic authorization/source deadline expired';END IF;
 PERFORM shadow_eval.weekend_append('reservation',rid,jid,b||'{"requires_confirmation":true}'::jsonb);
 PERFORM shadow_eval.weekend_append('confirmation',rid||':commit',rid,'{"status":"accepted"}'::jsonb);
 INSERT INTO shadow_eval.a3_single_attempts VALUES(s.event_id,jid,rid,b->>'request_hash',clock_timestamp());
 IF clock_timestamp()>=deadline THEN RAISE EXCEPTION 'atomic deadline crossed before reservation commit';END IF;
 RETURN rid;
END $$;
REVOKE ALL ON FUNCTION shadow_eval.a3_single_reserve(text,text,text,jsonb)FROM PUBLIC,anon,authenticated,shadow_runner;
GRANT EXECUTE ON FUNCTION shadow_eval.a3_single_reserve(text,text,text,jsonb)TO shadow_operator;
COMMIT;
