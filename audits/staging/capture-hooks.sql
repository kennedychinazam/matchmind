-- Apply only to the isolated synthetic DB after snapshot-schema.sql + permissions.sql.
BEGIN;
SET LOCAL ROLE research_owner;
CREATE FUNCTION research.capture_prediction(fid bigint) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p public.predictions;body jsonb;original jsonb;prior research.prediction_snapshots;sid uuid;receipt timestamptz;ko timestamptz;
 ids uuid[];oid uuid;obs research.observations;kind text;odds jsonb;prob_sum numeric;BEGIN
 PERFORM research.check_budget(65536);
 SELECT * INTO STRICT p FROM public.predictions WHERE fxid=fid;
 original:=jsonb_build_object('fxid',p.fxid,'lid',p.lid,'lname',p.lname,'kickoff',p.kickoff,'ktime',p.ktime,'home',p.home,'away',p.away,'p_home',p.p_home,'p_draw',p.p_draw,'p_away',p.p_away,'xg_home',p.xg_home,'xg_away',p.xg_away,'pick',p.pick,'pick_prob',p.pick_prob,'build',p.build,'made_at',p.made_at,'market',p.market,'odds_snap_id',p.odds_snap_id,'odds_at_pick',p.odds_at_pick,'odds_at_pick_at',p.odds_at_pick_at);
 SELECT * INTO prior FROM research.prediction_snapshots WHERE fixture_id=fid;
 IF FOUND THEN
  IF prior.envelope->'source_prediction'<>original THEN RAISE EXCEPTION 'conflicting original prediction';END IF;
  RETURN prior.snapshot_id;
 END IF;
 IF p.ktime IS NULL OR p.ktime !~ '^\d{2}:\d{2}(:\d{2})?$' THEN RAISE EXCEPTION 'invalid original kickoff';END IF;
 ko:=research.utc_instant(p.kickoff::text||'T'||p.ktime||CASE WHEN length(p.ktime)=5 THEN ':00Z' ELSE 'Z' END);
 receipt:=clock_timestamp();
 IF p.made_at IS NULL OR p.made_at>=ko OR p.made_at>receipt OR p.build IS NULL OR p.build<62
 OR p.pick IS NULL OR p.market IS NULL OR p.home IS NULL OR p.away IS NULL OR p.lid IS NULL
 OR p.p_home IS NULL OR p.p_draw IS NULL OR p.p_away IS NULL
 OR p.p_home NOT BETWEEN 0 AND 1 OR p.p_draw NOT BETWEEN 0 AND 1 OR p.p_away NOT BETWEEN 0 AND 1
 OR p.pick_prob IS NULL OR p.pick_prob NOT BETWEEN 0 AND 1 OR p.xg_home IS NULL OR p.xg_away IS NULL OR p.xg_home<0 OR p.xg_away<0 THEN RAISE EXCEPTION 'invalid original probability/lineage';END IF;
 prob_sum:=p.p_home::numeric+p.p_draw::numeric+p.p_away::numeric;
 IF abs(prob_sum-1)>.005 THEN RAISE EXCEPTION 'invalid probability distribution';END IF;
 -- Only the INSERT trigger may classify a contemporaneous capture. Explicit repair/import
 -- calls always remain late_import, even if they happen within seconds of issuance.
 kind:=CASE WHEN pg_trigger_depth()>0 AND receipt-p.made_at<=interval '10 seconds' THEN 'at_issue' ELSE 'late_import' END;
 WITH latest AS (
  SELECT DISTINCT ON(fixture_id,field_name) observation_id,fixture_id,field_name,value
  FROM research.observations WHERE availability='observed' AND observed_at_utc<=p.made_at
   AND (played_at_utc IS NULL OR played_at_utc<observed_at_utc AND played_at_utc<p.made_at)
   AND (effective_at_utc IS NULL OR effective_at_utc<=p.made_at)
  ORDER BY fixture_id,field_name,observed_at_utc DESC,observation_id DESC
 ), scope AS (
  SELECT DISTINCT fixture_id FROM latest WHERE fixture_id=fid OR field_name='lid' AND value=to_jsonb(p.lid)
   OR field_name IN ('home','away') AND value IN(to_jsonb(p.home),to_jsonb(p.away))
 ) SELECT coalesce(array_agg(l.observation_id),'{}'::uuid[]) INTO ids FROM latest l JOIN scope s USING(fixture_id);
 IF cardinality(ids)>500 THEN RAISE EXCEPTION 'evidence link limit exceeded' USING ERRCODE='54000';END IF;
 -- Only already-recorded server-receipt odds can qualify. Never backdate a new
 -- observation using the mutable/legacy odds table's captured_at.
 SELECT o.value INTO odds FROM research.observations o WHERE o.observation_id=ANY(ids) AND o.fixture_id=fid AND o.field_name='odds_1x2'
  AND o.source_kind='odds' AND o.value->>'fxid'=fid::text
  AND research.utc_instant(o.value->>'captured_at')<=p.made_at
  AND research.utc_instant(o.value->>'captured_at')>=p.made_at-interval '24 hours'
  AND (o.value->>'mins_to_kick')::numeric>0
  AND (o.value->>'h')::numeric>1 AND (o.value->>'d')::numeric>1 AND (o.value->>'a')::numeric>1
  AND (1/(o.value->>'h')::numeric+1/(o.value->>'d')::numeric+1/(o.value->>'a')::numeric) BETWEEN 1 AND 1.30
  ORDER BY research.utc_instant(o.value->>'captured_at') DESC,(o.value->>'id')::bigint DESC LIMIT 1;
 sid:=gen_random_uuid();
 body:=jsonb_build_object('snapshot_id',sid,'fixture_id',fid::text,'prediction_build',p.build,'model_version','build'||p.build,'model_version_source','derived_from_build','run_id',gen_random_uuid(),'issue_time_utc',to_char(p.made_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'kickoff_at_utc',to_char(ko AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'probabilities',jsonb_build_array(p.p_home,p.p_draw,p.p_away),'pick',p.pick,'pick_probability',p.pick_prob,'market',p.market,'expected_goals',jsonb_build_array(p.xg_home,p.xg_away),'fixture_version_hash',encode(public.digest(original::text,'sha256'),'hex'),'feature_schema_version',1,'source_hash',encode(public.digest(original::text,'sha256'),'hex'),'settlement_policy_version','build355-90m-48h-v1','source_prediction',original,'preissue_odds',odds,'evidence_ids',to_jsonb(ids),'hash_scheme','pg-jsonb-v1','missing',jsonb_build_array('original_ordered_engine_inputs','model_configuration_manifest'));
 IF octet_length(body::text)>65536 THEN RAISE EXCEPTION 'envelope size exceeded' USING ERRCODE='54000';END IF;
 PERFORM research.check_budget(octet_length(body::text)*2+cardinality(ids)*256);
 INSERT INTO research.prediction_snapshots VALUES(sid,fid,p.made_at,p.build,receipt,'build'||p.build,kind,false,'original ordered engine inputs/configuration were not archived',encode(public.digest(body::text,'sha256'),'hex'),body);
 FOREACH oid IN ARRAY ids LOOP
  SELECT * INTO STRICT obs FROM research.observations WHERE observation_id=oid;
  INSERT INTO research.snapshot_evidence VALUES(sid,oid,CASE WHEN obs.field_name='odds_1x2' THEN 'odds' ELSE 'feature' END,obs.fixture_id);
 END LOOP;
 RETURN sid;
END $$;
CREATE FUNCTION research.capture_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT (SELECT enabled FROM research.control) THEN RETURN NEW;END IF;
 BEGIN
  PERFORM research.capture_prediction(NEW.fxid);
 EXCEPTION WHEN OTHERS THEN
  -- A failed research write is rolled back within this subtransaction. Source
  -- publication survives; the local publisher harness separately checks receipt.
  RAISE WARNING 'research capture failed fixture %, SQLSTATE %',NEW.fxid,SQLSTATE;
 END;
 RETURN NEW;
END $$;
CREATE FUNCTION research.append_shadow(b jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE base research.prediction_snapshots;prior jsonb;sid uuid;sum_p numeric;v jsonb;BEGIN
 PERFORM research.check_object(b,ARRAY['shadow_id','snapshot_id','candidate_version','configuration_hash','visibility','probabilities','pick','feature_manifest_hash','fallback_reason','cohort','confirmatory_eligible','issued_pick_is_baseline'],65536);
 PERFORM research.check_budget(octet_length(b::text)*2);
 IF b->>'visibility' IS DISTINCT FROM 'shadow' OR b->'confirmatory_eligible' IS DISTINCT FROM 'false'::jsonb OR b->'issued_pick_is_baseline' IS DISTINCT FROM 'true'::jsonb
  OR b->>'configuration_hash' !~ '^[0-9a-f]{64}$' OR b->>'feature_manifest_hash' !~ '^[0-9a-f]{64}$'
  OR jsonb_typeof(b->'candidate_version') IS DISTINCT FROM 'string' OR length(b->>'candidate_version') NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'invalid private shadow lineage';END IF;
 SELECT * INTO STRICT base FROM research.prediction_snapshots WHERE snapshot_id=(b->>'snapshot_id')::uuid;
 IF b->'pick'<>base.envelope->'pick' THEN RAISE EXCEPTION 'issued baseline pick changed';END IF;
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
GRANT EXECUTE ON FUNCTION research.capture_prediction(bigint) TO research_publisher;
GRANT EXECUTE ON FUNCTION research.append_shadow(jsonb) TO research_collector;
RESET ROLE;
CREATE TRIGGER research_capture AFTER INSERT ON public.predictions FOR EACH ROW EXECUTE FUNCTION research.capture_insert();
COMMIT;
