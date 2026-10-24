-- Private operational state; no prediction payloads and no public privileges.
-- Apply after permissions.sql and before (re)installing capture-hooks.sql.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='research_operator') THEN CREATE ROLE research_operator NOLOGIN;END IF;
END $$;
SET LOCAL ROLE research_owner;
CREATE TABLE IF NOT EXISTS research.capture_health (
 fixture_id bigint PRIMARY KEY,
 state text NOT NULL CHECK(state IN('pending','disabled','captured','repaired')),
 first_failure_at timestamptz,
 last_attempt_at timestamptz NOT NULL,
 repaired_at timestamptz,
 attempts bigint NOT NULL CHECK(attempts>0),
 failures bigint NOT NULL CHECK(failures>=0),
 last_sqlstate text NOT NULL CHECK(last_sqlstate ~ '^[0-9A-Z]{5}$'),
 snapshot_id uuid REFERENCES research.prediction_snapshots(snapshot_id),
 CHECK((state IN('captured','repaired'))=(snapshot_id IS NOT NULL AND repaired_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS capture_health_pending_idx ON research.capture_health(fixture_id) WHERE state IN('pending','disabled');
ALTER TABLE research.capture_health ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON research.capture_health FROM PUBLIC,anon,authenticated,research_reader,research_collector,research_publisher,research_operator;
DROP POLICY IF EXISTS operator_read ON research.capture_health;
CREATE POLICY operator_read ON research.capture_health FOR SELECT TO research_operator USING(true);
GRANT USAGE ON SCHEMA research TO research_operator;
GRANT SELECT ON research.capture_health TO research_operator;
CREATE OR REPLACE FUNCTION research.try_capture_prediction(fid bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE sid uuid;code text;recorded boolean:=true;at timestamptz;BEGIN
 -- The failed capture's writes/locks roll back to this savepoint; source publication
 -- remains in the outer transaction. Monitoring is written AFTER that rollback.
 BEGIN
  IF NOT (SELECT enabled FROM research.control) THEN RAISE EXCEPTION 'capture disabled' USING ERRCODE='55000';END IF;
  sid:=research.capture_prediction(fid);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE;
 END;
 at:=clock_timestamp();
 BEGIN
  IF code IS NOT NULL THEN
   -- This bounded one-row-per-fixture operational queue bypasses evidence quota
   -- admission so that quota exhaustion itself can still be recorded.
   INSERT INTO research.capture_health(fixture_id,state,first_failure_at,last_attempt_at,attempts,failures,last_sqlstate)
   VALUES(fid,CASE WHEN code='55000' THEN 'disabled' ELSE 'pending' END,at,at,1,1,code)
   ON CONFLICT(fixture_id) DO UPDATE SET state=excluded.state,last_attempt_at=at,first_failure_at=coalesce(capture_health.first_failure_at,at),
    repaired_at=null,snapshot_id=null,attempts=capture_health.attempts+1,
    failures=capture_health.failures+1,last_sqlstate=code;
  ELSE
   INSERT INTO research.capture_health(fixture_id,state,last_attempt_at,repaired_at,attempts,failures,last_sqlstate,snapshot_id)
   VALUES(fid,'captured',at,at,1,0,'00000',sid)
   ON CONFLICT(fixture_id) DO UPDATE SET state=CASE WHEN capture_health.failures>0 THEN 'repaired' ELSE 'captured' END,
    last_attempt_at=at,repaired_at=at,attempts=capture_health.attempts+1,snapshot_id=sid;
  END IF;
 EXCEPTION WHEN OTHERS THEN
  recorded:=false;
  -- Physical storage/monitoring permission failures cannot be made durable in
  -- this same database. The private source-vs-snapshot reconciliation is the backstop.
  RAISE WARNING 'research monitoring unavailable for fixture %, SQLSTATE %',fid,SQLSTATE;
 END;
 RETURN jsonb_build_object('snapshot_id',sid,'error',CASE WHEN code IS NOT NULL THEN jsonb_build_object('code',code) END,
  'monitor_recorded',recorded,'fixture_id',fid);
END $$;
CREATE OR REPLACE FUNCTION research.capture_backlog(page_size integer DEFAULT 100,after_fixture_id bigint DEFAULT 0)
RETURNS TABLE(fixture_id bigint,state text,attempts bigint,last_sqlstate text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF page_size IS NULL OR page_size NOT BETWEEN 1 AND 1000 OR after_fixture_id IS NULL THEN RAISE EXCEPTION 'invalid backlog page';END IF;
 RETURN QUERY SELECT p.fxid,coalesce(h.state,'unrecorded'),coalesce(h.attempts,0),h.last_sqlstate
 FROM public.predictions p LEFT JOIN research.prediction_snapshots s ON s.fixture_id=p.fxid
 LEFT JOIN research.capture_health h ON h.fixture_id=p.fxid
 WHERE p.fxid>after_fixture_id AND (s.snapshot_id IS NULL OR h.state IN('pending','disabled'))
 ORDER BY p.fxid LIMIT page_size;
END $$;
REVOKE ALL ON FUNCTION research.try_capture_prediction(bigint),research.capture_backlog(integer,bigint) FROM PUBLIC,anon,authenticated,research_reader,research_collector,research_publisher,research_operator;
GRANT EXECUTE ON FUNCTION research.try_capture_prediction(bigint) TO research_publisher,research_operator;
GRANT EXECUTE ON FUNCTION research.capture_backlog(integer,bigint) TO research_operator;
COMMIT;
