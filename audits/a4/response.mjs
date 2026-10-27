// Evidence/reference/arithmetic checks are necessary, not proof of semantic
// entailment. No categorical feature is admitted to a forecast in this stage.
import {validate,RESPONSE_SCHEMA,DICTIONARY,footballText} from './schema.mjs';
import {assertPacket} from './evidence.mjs';
import {freeze,hash,rawHash,canonicalJSON,safeClone,parseBoundedJSON} from './bounds.mjs';
import {PROMPT_VERSION,PROMPT_HASH} from './prompt.mjs';
export const MODELS=Object.freeze(['openai/gpt-6-luna','google/gemini-3-flash-preview']);
const analyses=new WeakSet();
export function assertAnalysis(r){if(!analyses.has(r))throw Error('unvalidated_analysis_capability');return r;}
function ensure(ok,reason){if(!ok)throw Error(reason);}
function exactNumberToken(token,value){
 function fraction(s){if(typeof s!=='string'||s.length>128)throw Error('unsupported_numerical_claim');const m=s.match(/^(-?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/);if(!m||Math.abs(Number(m[4]??0))>400)throw Error('unsupported_numerical_claim');const power=Number(m[4]??0)-(m[3]?.length??0),n=BigInt(m[2]+(m[3]??''))*(m[1]? -1n:1n);return power>=0?[n*10n**BigInt(power),1n]:[n,10n**BigInt(-power)];}
 const a=fraction(token),b=fraction(JSON.stringify(value));return a[0]*b[1]===b[0]*a[1];
}
function sameSet(a,b){return a.length===b.length&&new Set(a).size===a.length&&a.every(x=>b.includes(x));}
export function validateResponse(raw,packet,options){assertPacket(packet);const o=safeClone(options);ensure(Object.keys(o).length===1&&MODELS.includes(o.model),'unauthorized_model_or_option');const digest=typeof raw==='string'?rawHash(raw):null;
 try{ensure(typeof raw==='string'&&Buffer.byteLength(raw)<=131072,'response_bound_exceeded');let q;try{q=validate(raw,RESPONSE_SCHEMA);}catch{throw Error('malformed_or_invalid_response');}
  ensure(q.packet_hash===packet.packet_hash&&canonicalJSON(q.fixture)===canonicalJSON(packet.fixture),'fixture_or_packet_identity');ensure(sameSet(q.reason_codes,[...new Set(q.reason_codes)]),'duplicate_reason');ensure(q.status==='abstain'?q.reason_codes.length>0:q.reason_codes.length===0,'status_reason_contract');ensure(q.topics.every((t,i)=>t.topic===DICTIONARY.topics[i])&&q.features.every((f,i)=>f.feature_id===DICTIONARY.features[i]),'missing_duplicate_or_unordered_entries');
  ensure(q.status==='abstain'||packet.essential_complete,'essential_evidence_missing');
  const numberTokens=parseBoundedJSON(raw).tokens;
  const observations=new Map(packet.observations.map(x=>[x.observation_id,x])),metrics=new Map(packet.metrics.map(m=>[m.metric_id,m])),claims=new Map();
  function refs(item){ensure(new Set(item.evidence_refs).size===item.evidence_refs.length&&item.evidence_refs.every(id=>observations.has(id)),'false_source_reference');ensure(new Set(item.metric_refs).size===item.metric_refs.length&&item.metric_refs.every(id=>metrics.has(id)),'false_metric_reference');}
  const identityLabels=[packet.fixture.home,packet.fixture.away,packet.fixture.competition,packet.fixture.country,packet.fixture.venue].filter(v=>v!==null);
  function prose(s){footballText(s,'commentary',identityLabels);ensure(!/[0-9]/u.test(s),'unsupported_numerical_claim');}
  for(const [claimIndex,c] of q.numeric_claims.entries()){ensure(!claims.has(c.claim_id),'duplicate_numeric_claim');const m=metrics.get(c.metric_ref);ensure(m&&exactNumberToken(numberTokens.get(JSON.stringify(['numeric_claims',String(claimIndex),'value'])),m.value)&&m.complete&&m.value!==null&&!m.conflict&&m.value===c.value&&m.unit===c.unit&&m.denominator===c.denominator&&sameSet(m.observation_refs,c.observation_refs),'unsupported_numerical_claim');claims.set(c.claim_id,c);}
  function claimLinks(item){ensure(new Set(item.claim_refs).size===item.claim_refs.length,'duplicate_claim_reference');for(const id of item.claim_refs){const c=claims.get(id);ensure(c&&item.metric_refs.includes(c.metric_ref)&&c.observation_refs.every(ref=>item.evidence_refs.includes(ref)),'claim_citation_mismatch');}}
  for(const t of q.topics){refs(t);claimLinks(t);prose(t.conclusion);t.limitations.forEach(prose);const intrinsic=['identity_context','data_quality_uncertainty'].includes(t.topic),supported=packet.topics.find(x=>x.topic===t.topic).observation_refs;if(['supported','partial'].includes(t.state)&&!intrinsic)ensure(t.evidence_refs.length>0&&t.evidence_refs.every(ref=>supported.includes(ref)),'topic_support_missing');if(t.state==='unavailable')ensure(!t.evidence_refs.length&&!t.metric_refs.length&&!t.claim_refs.length,'unavailable_has_claims');}
  for(let i=0;i<q.features.length;i++){const f=q.features[i];refs(f);claimLinks(f);prose(f.rationale);prose(f.counterevidence);f.limitations.forEach(prose);
   if(f.level===null){ensure(Object.values(f.warrant).every(x=>x===null||x==='unknown'),'null_feature_warrant');continue;}
   ensure(q.status!=='abstain'&&f.evidence_refs.length>0&&f.limitations.length>0,'unsupported_feature');ensure(f.evidence_refs.every(id=>observations.get(id).missingness==='observed'),'unknown_is_not_neutral');
   if(i<4){const team=i%2===0?q.fixture.home_team_id:q.fixture.away_team_id,left=metrics.get(f.warrant.left_metric),right=metrics.get(f.warrant.right_metric),attack=i<2;
    ensure(f.warrant.basis==='underlying_vs_surface'&&left&&right&&left.complete&&right.complete&&left.team_id===team&&right.team_id===team&&left.window===right.window&&left.denominator===right.denominator&&left.field===(attack?'xg_for':'xg_against')&&right.field===(attack?'goals_for':'goals_against'),'unsupported_directional_warrant');const relation=left.value>right.value?'gt':left.value<right.value?'lt':'eq';ensure(f.warrant.relation===relation&&f.level===(relation==='gt'?1:relation==='lt'?-1:0),'incorrect_categorical_direction');ensure([left.metric_id,right.metric_id].every(id=>f.metric_refs.includes(id))&&[...left.observation_refs,...right.observation_refs].every(id=>f.evidence_refs.includes(id)),'warrant_citation_mismatch');
   }else{const required=i===4?'tactical_observation':i===7?'competition_context':'availability_observation',basis=i===4?'matchup_context':i===7?'schedule_context':'availability_context';ensure(f.warrant.basis===basis&&f.warrant.left_metric===null&&f.warrant.right_metric===null&&f.warrant.relation===null,'unsupported_context_warrant');const relevant=f.evidence_refs.map(id=>observations.get(id)).filter(o=>o.field===required);ensure(relevant.length>0,'context_support_missing');if(i===4||i===7)ensure([q.fixture.home_team_id,q.fixture.away_team_id].every(team=>relevant.some(o=>o.team_id===team)),'both_team_context_required');else ensure(relevant.some(o=>o.team_id===(i===5?q.fixture.home_team_id:q.fixture.away_team_id)),'context_team_mismatch');}
  }
  const citedContradictions=new Set();for(const c of q.contradictions){prose(c.description);ensure(new Set(c.evidence_refs).size===c.evidence_refs.length&&c.evidence_refs.every(id=>observations.has(id)),'false_contradiction_reference');c.evidence_refs.forEach(id=>citedContradictions.add(id));}
  for(const conflict of packet.contradictions){ensure(conflict.observation_refs.every(id=>citedContradictions.has(id)),'unreported_source_conflict');for(const f of q.features)if(f.evidence_refs.some(id=>conflict.observation_refs.includes(id)))ensure(f.level===null,'conflicting_feature');}
  if(q.status==='abstain')ensure(q.features.every(f=>f.level===null)&&q.numeric_claims.length===0,'abstention_has_features_or_numbers');
  q.limitations.forEach(prose);prose(q.summary);
  const accepted=freeze({status:q.status==='abstain'?'accepted_abstention':'accepted_for_offline_review',model:o.model,prompt_version:PROMPT_VERSION,prompt_hash:PROMPT_HASH,packet_hash:packet.packet_hash,response_hash:digest,analysis:q,analysis_hash:hash(q),feature_admission:false,requires_semantic_review:q.status!=='abstain',numerical_mapping_enabled:false,reasons:[]});analyses.add(accepted);return accepted;
 }catch(e){return freeze({status:'rejected',model:o.model,packet_hash:packet.packet_hash,response_hash:digest,feature_admission:false,requires_semantic_review:true,numerical_mapping_enabled:false,reasons:[e.message]});}
}
