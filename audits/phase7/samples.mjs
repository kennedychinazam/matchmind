import {canonicalHash,canonicalJSON,epochMicros,validatePredictionSnapshot,snapshotFromCapture}from '../lib/snapshot-contract.mjs';
import {buildAsOfInputs,existingMatchFeatures,FIXTURE_FIELDS}from '../lib/asof-features.mjs';
import {publishedVerdict,settledScore,resultCode}from '../lib/independent-grade.mjs';
import {verifyDataset,rawHash}from './attestation.mjs';
const HASH=/^[0-9a-f]{64}$/;
const fail=reason=>{throw Error(reason);};
function proofText(text,hash){if(typeof text!=='string'||!HASH.test(hash)||rawHash(text)!==hash)fail('manifest/value integrity failure');return JSON.parse(text);}
export function completeEvidence(row,payload){
 const m=row.manifest,body=proofText(m?.body_text,m?.payload_hash);
 if(m.payload_hash!==row.capture?.manifest_hash||body.hash_scheme!=='pg-jsonb-v1'||body.selection?.version!=='m14-dependencies-v1'||!Array.isArray(m.chunks)||m.chunks.length!==body.chunks?.length)fail('manifest root mismatch');
 const all=[],seen=new Set();
 for(const[cidx,c]of m.chunks.entries()){
  if(c.ordinal!==cidx+1||c.chunk_hash!==body.chunks[cidx]||!Array.isArray(c.members)||c.member_count!==c.members.length||c.members.length<1||c.members.length>500)fail('manifest chunk count/order');
  const ids=c.members.map((v,i)=>{if(v.ordinal!==i+1||seen.has(v.observation_id))fail('duplicate manifest observation/order');seen.add(v.observation_id);return v.observation_id;});
  if(rawHash('['+ids.map(JSON.stringify).join(', ')+']')!==c.chunk_hash)fail('manifest chunk hash mismatch');
  for(const id of ids){const o=payload.observations[id];if(!o||o.observation_id!==id)fail('manifest observation missing');
   if(canonicalJSON(proofText(o.value_text,o.payload_hash))!==canonicalJSON(o.value))fail('observation value mismatch');all.push(o);}
 }
 if(all.length!==body.evidence_count)fail('manifest evidence count mismatch');
 return all;
}
function labelAt(row,s,cutoff,exported,kind){
 const revisions=new Set();let prior=0,priorAt=null,best=null;
 for(const l of row.settlements??[]){
  if(!Number.isSafeInteger(l.revision)||l.revision<=prior||revisions.has(l.revision))fail('conflicting/out-of-order settlement revision');revisions.add(l.revision);prior=l.revision;
  const at=epochMicros(l.received_at_utc),body=proofText(l.envelope_text,l.payload_hash);
  if(priorAt!==null&&at<priorAt)fail('settlement revision chronology');priorAt=at;
  if(at>exported||String(body.fixture_id)!==s.fixture_id||body.kind!==kind)fail('settlement source/fixture mismatch');
  const finished=epochMicros(body.event_finished_at_utc);
  if(finished<epochMicros(s.kickoff_at_utc)||finished>at)fail('outcome event/receipt chronology');
  if(at<cutoff)best={...body,revision:l.revision,receipt:l.received_at_utc,label_hash:l.payload_hash};
 }
 if(!best)return{reason:'outcome_unavailable_at_cutoff'};
 const f=best.fixture,v=publishedVerdict(row.source_prediction,f,Number(cutoff/1000n));
 if(v.voidLate)return{reason:'void_48h'};
 if(v.excluded||!v.done)return{reason:'unsettled_or_excluded'};
 const sc=settledScore(f),actual=resultCode(sc?.h,sc?.a);
 if(!actual)return{reason:'invalid_outcome'};
 if(/^(AET|PEN)$/.test(String(f.status??'').trim().toUpperCase())&&![f.ft_h,f.ft_a].every((n,i)=>Number.isInteger(n)&&n>=0&&n<=[f.gh,f.ga][i]))return{reason:'ambiguous_90m'};
 return{actual,label_hash:best.label_hash,label_revision:best.revision,label_received_at_utc:best.receipt};
}
export function prepareSamples(packet,policy,labelCutoff){
 const signed=verifyDataset(packet,policy),p=signed.payload,cutoff=epochMicros(labelCutoff),exported=epochMicros(p.exported_at_utc),eligible=[],rejected=[],seen=new Set();
 for(const row of p.examples){
  if(!row?.fixture_id||seen.has(String(row.fixture_id)))fail('duplicate/missing fixture');seen.add(String(row.fixture_id));
  if(!row.snapshot){rejected.push({fixture_id:row.fixture_id,reason:'capture_missing'});continue;}
  const observations=completeEvidence(row,p);
  const decoded=proofText(row.capture?.envelope_text,row.capture?.payload_hash);
  if(canonicalJSON(decoded)!==canonicalJSON(row.snapshot))fail('snapshot envelope mismatch');
  const s=decoded.source_prediction?snapshotFromCapture(decoded):validatePredictionSnapshot(decoded),issue=epochMicros(s.issue_time_utc);
  if(s.fixture_id!==String(row.fixture_id))fail('snapshot fixture mismatch');
  let reason=null;
  try{
   const receipt=epochMicros(row.capture.received_at_utc);
   if(row.capture.capture_kind!=='at_issue'||receipt<issue||receipt-issue>10000000n||receipt>exported)reason='unverified_capture';
   for(const o of observations){
    const at=epochMicros(o.received_at_utc);
    if(o.availability!=='observed'||o.feature_schema_version!==1||!HASH.test(o.source_hash)||at!==epochMicros(o.observed_at_utc)||at>=issue||at>exported||o.value===null||
     o.played_at_utc&&(epochMicros(o.played_at_utc)>=at||epochMicros(o.played_at_utc)>=issue)||o.effective_at_utc&&epochMicros(o.effective_at_utc)>at)reason='invalid_evidence_receipt';
    if(!FIXTURE_FIELDS.includes(o.field_name)&&o.field_name!=='odds_1x2')reason='unsupported_evidence';
    if(String(o.fixture_id)===s.fixture_id&&['gh','ga','ft_h','ft_a','xg_h','xg_a'].includes(o.field_name))reason='target_outcome_evidence';
   }
  }catch{reason='invalid_evidence_receipt';}
  if(reason){rejected.push({fixture_id:row.fixture_id,reason});continue;}
  const original=row.source_prediction;
  if(canonicalJSON([original.p_home,original.p_draw,original.p_away])!==canonicalJSON(s.probabilities)||epochMicros(original.made_at)!==issue||String(original.fxid)!==s.fixture_id||original.build!==s.prediction_build)fail('original source mismatch');
  const inputs=buildAsOfInputs({snapshot:s,observations:observations.filter(o=>o.field_name!=='odds_1x2')}),features=existingMatchFeatures(inputs);
  if(!inputs.fixture||inputs.fixture.home!==original.home||inputs.fixture.away!==original.away||inputs.league?.id!==original.lid||inputs.fixture.date!==s.kickoff_at_utc.slice(0,10))reason='target_identity_missing';
  else if(!Number.isFinite(features?.xgEdge))reason='feature_missing';
  else if(s.probabilities[0]<=0||s.probabilities[2]<=0)reason='conditional_probability_boundary';
  const label=labelAt(row,s,cutoff,exported,p.dataset_kind);
  if(reason||label.reason){rejected.push({fixture_id:row.fixture_id,reason:reason??label.reason});continue;}
  eligible.push({fixture_id:s.fixture_id,id:s.fixture_id,snapshot_id:s.snapshot_id,issued_at:s.issue_time_utc,kickoff_at_utc:s.kickoff_at_utc,league:original.lid,baseline:[...s.probabilities],xgEdge:features.xgEdge,
   evidence_manifest_hash:row.capture.manifest_hash,feature_manifest_hash:inputs.manifest.hash,...label,
   sample_hash:canonicalHash({snapshot_id:s.snapshot_id,baseline:s.probabilities,xgEdge:features.xgEdge,evidence:row.capture.manifest_hash,feature:inputs.manifest.hash,label})});
 }
 return{dataset_hash:signed.dataset_hash,dataset_kind:p.dataset_kind,exported_at_utc:p.exported_at_utc,label_cutoff_utc:labelCutoff,roster:p.examples.length,eligible,rejected};
}
