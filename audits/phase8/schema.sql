-- DISPOSABLE LOCAL POSTGRESQL ONLY. Never apply to a hosted project.
BEGIN;
SET LOCAL ROLE research_owner;
CREATE TABLE shadow_eval.weekend_events(
 event_id text PRIMARY KEY,kind text NOT NULL CHECK(kind IN('study','packet','job','forecast','label','reservation','usage','confirmation')),
 parent_id text REFERENCES shadow_eval.weekend_events,event_body_hash text NOT NULL,body jsonb NOT NULL,
 received_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX ON shadow_eval.weekend_events(kind,parent_id);
ALTER TABLE shadow_eval.weekend_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON shadow_eval.weekend_events FOR EACH STATEMENT EXECUTE FUNCTION research.immutable();
GRANT SELECT ON shadow_eval.weekend_events TO shadow_reader,shadow_operator;
CREATE POLICY private_read ON shadow_eval.weekend_events FOR SELECT TO shadow_reader,shadow_operator USING(true);
CREATE FUNCTION shadow_eval.weekend_append(k text,id text,parent text,b jsonb)RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior shadow_eval.weekend_events;p shadow_eval.weekend_events;cost bigint;used bigint;probs jsonb;v jsonb;total numeric:=0;j shadow_eval.weekend_events;at timestamptz;deadline timestamptz;BEGIN
 IF id !~ '^[A-Za-z0-9:._-]{1,128}$' OR k NOT IN('study','packet','job','forecast','label','reservation','usage','confirmation') OR jsonb_typeof(b)IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid weekend event';END IF;
 -- The original quota lock also serializes the total budget across ALL studies.
 PERFORM 1 FROM research.control FOR UPDATE;
 at:=clock_timestamp();
 SELECT * INTO prior FROM shadow_eval.weekend_events WHERE event_id=id;
 IF FOUND THEN IF prior.kind<>k OR prior.parent_id IS DISTINCT FROM parent OR prior.body<>b OR(k='usage' AND b->>'status'='dispatched')THEN RAISE EXCEPTION 'weekend event conflict';END IF;RETURN id;END IF;
 IF k='study' THEN
  IF parent IS NOT NULL OR b->'windows' IS DISTINCT FROM '["2026-10-24","2026-10-25"]'::jsonb OR b->>'version' IS DISTINCT FROM 'weekend-v1' THEN RAISE EXCEPTION 'invalid fixed weekend study';END IF;
 ELSE
  SELECT * INTO STRICT p FROM shadow_eval.weekend_events WHERE event_id=parent;
  IF (k='packet' AND p.kind<>'study')OR(k='job' AND p.kind<>'packet')OR(k IN('forecast','label','reservation')AND p.kind<>'job')OR(k='usage' AND p.kind<>'reservation')OR(k='confirmation' AND p.kind NOT IN('forecast','reservation'))THEN RAISE EXCEPTION 'weekend relationship mismatch';END IF;
 END IF;
 IF k='job' THEN
  IF(b->>'fixture_id' ~ '^[1-9][0-9]{0,17}$')IS DISTINCT FROM true OR b->>'kickoff_at_utc' IS NULL THEN RAISE EXCEPTION 'invalid job fixture';END IF;
  PERFORM(b->>'kickoff_at_utc')::timestamptz;
 END IF;
 IF k='forecast' THEN
  IF(b->>'arm' IN('E','E-Refreshed','A1','A2','A3'))IS DISTINCT FROM true OR(b->>'status' IN('forecast','failed','abstain'))IS DISTINCT FROM true THEN RAISE EXCEPTION 'invalid forecast arm/status';END IF;
  IF EXISTS(SELECT FROM shadow_eval.weekend_events e WHERE e.kind='forecast' AND e.parent_id=parent AND e.body->>'arm'=b->>'arm')THEN RAISE EXCEPTION 'duplicate forecast conflict';END IF;
  IF b->>'status'='forecast' THEN
   IF b->'requires_confirmation' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'forecast requires commit confirmation';END IF;
   deadline:=(p.body->>'kickoff_at_utc')::timestamptz;
   IF at>=(p.body->>'kickoff_at_utc')::timestamptz OR(b->>'generated_at_utc')IS NULL OR(b->>'generated_at_utc')::timestamptz>at OR(b->>'generated_at_utc')::timestamptz<p.received_at THEN RAISE EXCEPTION 'late forecast or invalid generation receipt';END IF;
   IF b->>'arm'='A2' THEN IF jsonb_typeof(b->'veto')IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid veto';END IF;
   ELSE
    probs:=b->'probabilities';IF jsonb_typeof(probs)IS DISTINCT FROM 'array' OR jsonb_array_length(probs)<>3 THEN RAISE EXCEPTION 'invalid probabilities';END IF;
    FOR v IN SELECT *FROM jsonb_array_elements(probs)LOOP IF jsonb_typeof(v)IS DISTINCT FROM 'number' OR(v::text)::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'invalid probabilities';END IF;total:=total+(v::text)::numeric;END LOOP;
    IF abs(total-1)>.005 THEN RAISE EXCEPTION 'invalid probability mass';END IF;
   END IF;
  END IF;
 END IF;
 IF k='reservation' THEN
  IF b->'requires_confirmation' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'reservation requires commit confirmation';END IF;
  deadline:=(p.body->>'kickoff_at_utc')::timestamptz;
  cost:=(b->>'reserved_micros')::bigint;
  IF cost IS NULL OR cost<1 OR cost>5000000 OR(b->>'request_hash' ~ '^[0-9a-f]{64}$')IS DISTINCT FROM true THEN RAISE EXCEPTION 'invalid budget reservation';END IF;
  SELECT coalesce(sum((body->>'reserved_micros')::bigint),0)INTO used FROM shadow_eval.weekend_events WHERE kind='reservation';
  IF used+cost>5000000 THEN RAISE EXCEPTION 'weekend AI budget exhausted';END IF;
  IF at>=(p.body->>'kickoff_at_utc')::timestamptz THEN RAISE EXCEPTION 'late AI request';END IF;
 END IF;
 IF k='confirmation' THEN
  IF(b->>'status' IN('accepted','failed'))IS DISTINCT FROM true THEN RAISE EXCEPTION 'invalid confirmation';END IF;
  IF b->>'status'='accepted' THEN
   SELECT * INTO STRICT j FROM shadow_eval.weekend_events WHERE event_id=p.parent_id;
   deadline:=(j.body->>'kickoff_at_utc')::timestamptz;
  END IF;
 END IF;
 IF k='usage' AND b->>'status'='dispatched' THEN
  SELECT * INTO STRICT j FROM shadow_eval.weekend_events WHERE event_id=p.parent_id;
  deadline:=(j.body->>'kickoff_at_utc')::timestamptz;
  IF NOT EXISTS(SELECT FROM shadow_eval.weekend_events e WHERE e.kind='confirmation' AND e.parent_id=parent AND e.body->>'status'='accepted')THEN RAISE EXCEPTION 'reservation commit confirmation absent';END IF;
 END IF;
 PERFORM research.check_budget(octet_length(b::text)*4+65536);
 at:=clock_timestamp();IF deadline IS NOT NULL AND at>=deadline THEN RAISE EXCEPTION 'late kickoff admission';END IF;
 INSERT INTO shadow_eval.weekend_events VALUES(id,k,parent,encode(public.digest(b::text,'sha256'),'hex'),b,at);
 IF deadline IS NOT NULL AND clock_timestamp()>=deadline THEN RAISE EXCEPTION 'late kickoff insertion';END IF;RETURN id;
END $$;
REVOKE ALL ON FUNCTION shadow_eval.weekend_append(text,text,text,jsonb)FROM PUBLIC,anon,authenticated,shadow_runner;
GRANT EXECUTE ON FUNCTION shadow_eval.weekend_append(text,text,text,jsonb)TO shadow_operator;
COMMIT;
