import { canonicalHash, canonicalJSON, validatePredictionSnapshot, probabilities, epochMicros, utcInstant } from '../lib/snapshot-contract.mjs';
import { buildAsOfInputs, existingMatchFeatures, ASOF_IMPLEMENTATION_HASH } from '../lib/asof-features.mjs';
import { ADAPTERS } from './adapters.mjs';
function frozen(x){if(x&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x);}return x;}
const HASH=/^[0-9a-f]{64}$/;
export function freezeCandidate(spec,registry=ADAPTERS){
 if(!spec||Object.keys(spec).sort().join(',')!=='adapter_id,configuration,frozen_at_utc,study_kind,version')throw Error('invalid candidate descriptor');
 if(typeof spec.version!=='string'||!/^[a-zA-Z0-9_.-]{1,100}$/.test(spec.version))throw Error('invalid candidate version');
 const adapter=registry[spec.adapter_id];if(!adapter||!HASH.test(adapter.sha256))throw Error('unknown adapter');
 if(!['synthetic_verification','historical_exploratory'].includes(spec.study_kind))throw Error('unsupported study kind');
 if(!spec.configuration||Object.getPrototypeOf(spec.configuration)!==Object.prototype||Buffer.byteLength(canonicalJSON(spec.configuration))>16384)throw Error('invalid candidate configuration');
 adapter.validate(spec.configuration);
 const body={...structuredClone(spec),frozen_at_utc:utcInstant(spec.frozen_at_utc),adapter_sha256:adapter.sha256,
  feature_source_hash:ASOF_IMPLEMENTATION_HASH,required_features:[...(adapter.required_features??[])],configuration_hash:canonicalHash(spec.configuration)};
 return frozen({...body,candidate_id:canonicalHash(body)});
}
export function verifyCandidate(candidate,registry=ADAPTERS){
 const spec=Object.fromEntries(['version','adapter_id','configuration','frozen_at_utc','study_kind'].map(k=>[k,candidate?.[k]]));
 const expected=freezeCandidate(spec,registry);
 if(canonicalJSON(candidate)!==canonicalJSON(expected))throw Error('candidate identity/source/configuration changed');
 return expected;
}
// Input must come from the private repository's integrity-checked manifest export.
// A JSON field alone cannot authenticate database receipt provenance.
export function evaluateJob({candidate,snapshot,capture,observations},registry=ADAPTERS){
 const c=verifyCandidate(candidate,registry),s=validatePredictionSnapshot(snapshot),adapter=registry[c.adapter_id];
 if(!capture||!HASH.test(capture.payload_hash)||!HASH.test(capture.manifest_hash))throw Error('missing capture provenance');
 const issue=epochMicros(s.issue_time_utc);
 let reason=null,diagnostics={xgEdge:null,excluded_observations:0},featureHash=canonicalHash({unavailable:true}),output=[...s.probabilities];
 try{
  if(capture.capture_kind!=='at_issue')reason='unverified_capture';
  else if(c.adapter_id==='identity-v1')output=adapter.execute({baseline:[...s.probabilities],features:{},configuration:structuredClone(c.configuration)});
  else if(c.adapter_id==='m14-xgedge-v1'&&c.study_kind!=='synthetic_verification')reason='unverified_model_artifact';
  else {
   const eligible=(observations??[]).filter(o=>{try{return epochMicros(o.received_at_utc)<issue&&epochMicros(o.observed_at_utc)===epochMicros(o.received_at_utc);}catch{return false;}});
   const inputs=buildAsOfInputs({snapshot:s,observations:eligible});
   const features=existingMatchFeatures(inputs);
   featureHash=inputs.manifest.hash;
   diagnostics={xgEdge:features?.xgEdge??null,excluded_observations:(observations??[]).length-eligible.length+inputs.manifest.excluded.length,
    selected_observations:inputs.manifest.selected.length,feature_source_hash:inputs.manifest.implementation_hash};
   if(!features||c.required_features.some(k=>typeof features[k]!=='number'||!Number.isFinite(features[k])))reason='missing_evidence';
   else output=adapter.execute({baseline:[...s.probabilities],features:structuredClone(features),configuration:structuredClone(c.configuration)});
  }
  if(!reason)output=probabilities(output);
 }catch{reason='candidate_execution_failed';}
 if(reason)output=[...s.probabilities];
 return frozen({result_id:canonicalHash({candidate_id:c.candidate_id,snapshot_id:s.snapshot_id}),snapshot_id:s.snapshot_id,candidate_id:c.candidate_id,
  candidate_version:c.version,configuration_hash:c.configuration_hash,baseline_payload_hash:capture.payload_hash,evidence_manifest_hash:capture.manifest_hash,
  feature_manifest_hash:featureHash,probabilities:output,visibility:'shadow',status:reason?'fallback':'forecast',reason,diagnostics,
  study_kind:c.study_kind,confirmatory_eligible:false});
}
