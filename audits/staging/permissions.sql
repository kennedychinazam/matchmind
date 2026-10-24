BEGIN;
REVOKE ALL ON SCHEMA research FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA research FROM PUBLIC,anon,authenticated,research_collector,research_publisher,research_reader;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research FROM PUBLIC,anon,authenticated,research_collector,research_publisher,research_reader;
GRANT USAGE ON SCHEMA research TO research_collector,research_publisher,research_reader;
GRANT SELECT ON research.observations,research.prediction_snapshots,research.snapshot_evidence,research.shadow_forecasts TO research_reader;
DROP POLICY IF EXISTS research_read ON research.observations;
CREATE POLICY research_read ON research.observations FOR SELECT TO research_reader USING(true);
DROP POLICY IF EXISTS research_read ON research.prediction_snapshots;
CREATE POLICY research_read ON research.prediction_snapshots FOR SELECT TO research_reader USING(true);
DROP POLICY IF EXISTS research_read ON research.snapshot_evidence;
CREATE POLICY research_read ON research.snapshot_evidence FOR SELECT TO research_reader USING(true);
DROP POLICY IF EXISTS research_read ON research.shadow_forecasts;
CREATE POLICY research_read ON research.shadow_forecasts FOR SELECT TO research_reader USING(true);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['evidence_chunks','evidence_chunk_members','evidence_manifests','evidence_manifest_chunks'] LOOP
  EXECUTE format('GRANT SELECT ON research.%I TO research_reader',t);
  EXECUTE format('DROP POLICY IF EXISTS research_read ON research.%I',t);
  EXECUTE format('CREATE POLICY research_read ON research.%I FOR SELECT TO research_reader USING(true)',t);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION research.read_snapshot_evidence(uuid) TO research_reader;
GRANT EXECUTE ON FUNCTION research.append_observations(jsonb) TO research_collector;
UPDATE research.control SET enabled=true;
COMMIT;
