-- Apply only to the isolated synthetic DB after snapshot-schema.sql + permissions.sql.
BEGIN;
SET LOCAL ROLE research_owner;
CREATE OR REPLACE FUNCTION research.capture_prediction(fid bigint) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET timezone='UTC' AS $$
DECLARE p public.predictions;body jsonb;original jsonb;prior research.prediction_snapshots;sid uuid;receipt timestamptz;ko timestamptz;
 ids uuid[];oid uuid;obs research.observations;kind text;odds jsonb;prob_sum numeric;mid uuid;manifest research.evidence_manifests;BEGIN
 SELECT * INTO STRICT p FROM public.predictions WHERE fxid=fid;
 original:=jsonb_build_object('fxid',p.fxid,'lid',p.lid,'lname',p.lname,'kickoff',p.kickoff,'ktime',p.ktime,'home',p.home,'away',p.away,'p_home',p.p_home,'p_draw',p.p_draw,'p_away',p.p_away,'xg_home',p.xg_home,'xg_away',p.xg_away,'pick',p.pick,'pick_prob',p.pick_prob,'build',p.build,'made_at',p.made_at,'market',p.market,'odds_snap_id',p.odds_snap_id,'odds_at_pick',p.odds_at_pick,'odds_at_pick_at',p.odds_at_pick_at);
 SELECT * INTO prior FROM research.prediction_snapshots WHERE fixture_id=fid;
 IF FOUND THEN
  IF prior.envelope->'source_prediction'<>original THEN RAISE EXCEPTION 'conflicting original prediction';END IF;
  RETURN prior.snapshot_id;
 END IF;
 PERFORM research.check_budget(65536);
 IF p.ktime IS NULL OR p.ktime !~ '^\d{2}:\d{2}(:\d{2})?$' THEN RAISE EXCEPTION 'invalid original kickoff';END IF;
 ko:=research.utc_instant(p.kickoff::text||'T'||p.ktime||CASE WHEN length(p.ktime)=5 THEN ':00Z' ELSE 'Z' END);
 receipt:=clock_timestamp();
 IF p.made_at IS NULL OR p.made_at>=ko OR p.made_at>receipt OR p.build IS NULL OR p.build<62
 OR p.pick IS NULL OR p.market IS NULL OR p.home IS NULL OR p.away IS NULL OR p.lid IS NULL
 OR p.p_home IS NULL OR p.p_draw IS NULL OR p.p_away IS NULL
 OR p.p_home NOT BETWEEN 0 AND 1 OR p.p_draw NOT BETWEEN 0 AND 1 OR p.p_away NOT BETWEEN 0 AND 1
 OR p.pick_prob IS NULL OR p.pick_prob NOT BETWEEN 0 AND 1 OR p.xg_home IS NULL OR p.xg_away IS NULL OR p.xg_home<0 OR p.xg_away<0 OR p.xg_home::text IN ('NaN','Infinity','-Infinity') OR p.xg_away::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'invalid original probability/lineage';END IF;
 prob_sum:=p.p_home::numeric+p.p_draw::numeric+p.p_away::numeric;
 IF abs(prob_sum-1)>.005 THEN RAISE EXCEPTION 'invalid probability distribution';END IF;
 -- Only the INSERT trigger may classify a contemporaneous capture. Explicit repair/import
 -- calls always remain late_import, even if they happen within seconds of issuance.
 kind:=CASE WHEN pg_trigger_depth()>0 AND receipt-p.made_at<=interval '10 seconds' THEN 'at_issue' ELSE 'late_import' END;
 ids:=research.select_m14_evidence(fid);
 -- Only already-recorded server-receipt odds can qualify. Never backdate a new
 -- observation using the mutable/legacy odds table's captured_at.
 SELECT o.observation_id,o.value INTO oid,odds FROM research.observations o WHERE o.availability='observed' AND o.observed_at_utc<=p.made_at AND o.fixture_id=fid AND o.field_name='odds_1x2'
  AND o.source_kind='odds' AND o.value->>'fxid'=fid::text
  AND research.utc_instant(o.value->>'captured_at')<=p.made_at
  AND research.utc_instant(o.value->>'captured_at')>=p.made_at-interval '24 hours'
  AND (o.value->>'mins_to_kick')::numeric>0
  AND (o.value->>'h')::numeric>1 AND (o.value->>'d')::numeric>1 AND (o.value->>'a')::numeric>1
  AND (1/(o.value->>'h')::numeric+1/(o.value->>'d')::numeric+1/(o.value->>'a')::numeric) BETWEEN 1 AND 1.30
  ORDER BY research.utc_instant(o.value->>'captured_at') DESC,(o.value->>'id')::bigint DESC LIMIT 1;
 IF oid IS NOT NULL THEN ids:=array_append(ids,oid);END IF;
 IF cardinality(ids)>100000 THEN RAISE EXCEPTION 'complete evidence manifest exceeds supported size' USING ERRCODE='54000';END IF;
 PERFORM research.check_budget(cardinality(ids)*200+65536);
 mid:=research.store_evidence_manifest(ids,jsonb_build_object('version','m14-dependencies-v1','build',p.build,'league_id',p.lid,'home',p.home,'away',p.away));
 SELECT * INTO STRICT manifest FROM research.evidence_manifests WHERE manifest_id=mid;
 sid:=gen_random_uuid();
 body:=jsonb_build_object('snapshot_id',sid,'fixture_id',fid::text,'prediction_build',p.build,'model_version','build'||p.build,'model_version_source','derived_from_build','run_id',gen_random_uuid(),'issue_time_utc',to_char(p.made_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'kickoff_at_utc',to_char(ko AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'probabilities',jsonb_build_array(p.p_home,p.p_draw,p.p_away),'pick',p.pick,'pick_probability',p.pick_prob,'market',p.market,'expected_goals',jsonb_build_array(p.xg_home,p.xg_away),'fixture_version_hash',encode(public.digest(original::text,'sha256'),'hex'),'feature_schema_version',1,'source_hash',encode(public.digest(original::text,'sha256'),'hex'),'settlement_policy_version','build355-90m-48h-v1','source_prediction',original,'preissue_odds',odds,'evidence_manifest',jsonb_build_object('manifest_id',mid,'payload_hash',manifest.payload_hash,'evidence_count',manifest.evidence_count,'chunk_count',jsonb_array_length(manifest.body->'chunks'),'selection_version','m14-dependencies-v1'),'hash_scheme','pg-jsonb-v1','missing',jsonb_build_array('original_ordered_engine_inputs','model_configuration_manifest'));
 IF octet_length(body::text)>65536 THEN RAISE EXCEPTION 'envelope size exceeded' USING ERRCODE='54000';END IF;
 PERFORM research.check_budget(octet_length(body::text)*2+cardinality(ids)*256);
 INSERT INTO research.prediction_snapshots(snapshot_id,fixture_id,issue_time_utc,prediction_build,received_at_utc,model_version,capture_kind,replay_eligible,replay_reason,payload_hash,envelope,evidence_manifest_id)
 VALUES(sid,fid,p.made_at,p.build,receipt,'build'||p.build,kind,false,'original ordered engine inputs/configuration were not archived',encode(public.digest(body::text,'sha256'),'hex'),body,mid);
 RETURN sid;
END $$;
CREATE OR REPLACE FUNCTION research.capture_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM research.try_capture_prediction(NEW.fxid);
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 -- Protect source publication even if the monitoring entrypoint itself is broken.
 -- The operator-only source/snapshot reconciliation detects this missing receipt.
 RAISE WARNING 'research entrypoint unavailable for fixture %, SQLSTATE %',NEW.fxid,SQLSTATE;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION research.append_shadow(b jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE base research.prediction_snapshots;prior jsonb;sid uuid;sum_p numeric;v jsonb;BEGIN
 PERFORM research.check_object(b,ARRAY['shadow_id','snapshot_id','candidate_version','configuration_hash','visibility','probabilities','pick','feature_manifest_hash','fallback_reason','cohort','confirmatory_eligible','issued_pick_is_baseline'],65536);
 PERFORM research.check_budget(octet_length(b::text)*2);
 IF b->>'visibility' IS DISTINCT FROM 'shadow' OR b->'confirmatory_eligible' IS DISTINCT FROM 'false'::jsonb OR b->'issued_pick_is_baseline' IS DISTINCT FROM 'true'::jsonb
  OR jsonb_typeof(b->'configuration_hash') IS DISTINCT FROM 'string' OR jsonb_typeof(b->'feature_manifest_hash') IS DISTINCT FROM 'string'
  OR (b->>'configuration_hash' ~ '^[0-9a-f]{64}$') IS DISTINCT FROM true OR (b->>'feature_manifest_hash' ~ '^[0-9a-f]{64}$') IS DISTINCT FROM true
  OR jsonb_typeof(b->'candidate_version') IS DISTINCT FROM 'string' OR length(b->>'candidate_version') NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'invalid private shadow lineage';END IF;
 SELECT * INTO STRICT base FROM research.prediction_snapshots WHERE snapshot_id=(b->>'snapshot_id')::uuid;
 IF b->>'cohort' IS DISTINCT FROM (CASE WHEN base.issue_time_utc>='2026-11-01T00:00:00Z'::timestamptz THEN 'prospective' WHEN base.issue_time_utc>='2026-10-01T00:00:00Z'::timestamptz THEN 'exploratory' ELSE 'development' END) THEN RAISE EXCEPTION 'incorrect issuance cohort';END IF;
 IF b->'fallback_reason'<>'null'::jsonb THEN
  IF jsonb_typeof(b->'fallback_reason') IS DISTINCT FROM 'string' OR b->>'fallback_reason' NOT IN ('adjustment_disabled','missing_evidence','model_unavailable') THEN RAISE EXCEPTION 'invalid fallback reason';END IF;
  IF b->'probabilities' IS DISTINCT FROM base.envelope->'probabilities' THEN RAISE EXCEPTION 'fallback must equal original baseline';END IF;
 END IF;
 IF b->'pick' IS DISTINCT FROM base.envelope->'pick' THEN RAISE EXCEPTION 'issued baseline pick changed';END IF;
 IF jsonb_typeof(b->'probabilities') IS DISTINCT FROM 'array' OR jsonb_array_length(b->'probabilities')<>3 THEN RAISE EXCEPTION 'invalid shadow probabilities';END IF;
 sum_p:=0;
 FOR v IN SELECT * FROM jsonb_array_elements(b->'probabilities') LOOP
  IF jsonb_typeof(v)<>'number' OR (v::text)::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'invalid shadow probabilities';END IF;
  sum_p:=sum_p+(v::text)::numeric;
 END LOOP;
 IF abs(sum_p-1)>.005 THEN RAISE EXCEPTION 'invalid shadow probabilities';END IF;
 sid:=(b->>'shadow_id')::uuid;
 SELECT envelope INTO prior FROM research.shadow_forecasts WHERE shadow_id=sid OR (snapshot_id=(b->>'snapshot_id')::uuid AND candidate_version=b->>'candidate_version' AND configuration_hash=b->>'configuration_hash');
 IF FOUND THEN IF prior<>b THEN RAISE EXCEPTION 'conflicting shadow identifier';END IF;RETURN sid;END IF;
 INSERT INTO research.shadow_forecasts VALUES(sid,(b->>'snapshot_id')::uuid,b->>'candidate_version',b->>'configuration_hash','shadow',b);
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION research.capture_prediction(bigint),research.capture_insert(),research.append_shadow(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION research.capture_prediction(bigint) FROM research_publisher,research_operator;
GRANT EXECUTE ON FUNCTION research.try_capture_prediction(bigint) TO research_publisher,research_operator;
GRANT EXECUTE ON FUNCTION research.append_shadow(jsonb) TO research_collector;
RESET ROLE;
DROP TRIGGER IF EXISTS research_capture ON public.predictions;
CREATE TRIGGER research_capture AFTER INSERT ON public.predictions FOR EACH ROW EXECUTE FUNCTION research.capture_insert();
COMMIT;
