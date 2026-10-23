// Audit/staging only. Receipt timestamps come from the trusted ingestion boundary,
// never from a caller's JSON payload. SQL independently enforces this contract.
import { createHash } from 'node:crypto';
export const LIMITS = Object.freeze({fieldBytes:16384,envelopeBytes:65536,evidenceLinks:500,batchCount:100,batchBytes:2097152});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash=/^[0-9a-f]{64}$/;
export function canonicalJSON(value) {
 if(value===null || typeof value==='boolean' || typeof value==='string') return JSON.stringify(value);
 if(typeof value==='number' && Number.isFinite(value)) return JSON.stringify(value);
 if(Array.isArray(value)) {
  if(Object.keys(value).length!==value.length) throw Error('invalid JSON array');
  return '['+value.map(canonicalJSON).join(',')+']';
 }
 if(value && Object.getPrototypeOf(value)===Object.prototype) return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON(value[k])).join(',')+'}';
 throw Error('invalid JSON value');
}
export function canonicalHash(value) { return createHash('sha256').update(canonicalJSON(value)).digest('hex'); }
export function utcInstant(value) {
 const m=typeof value==='string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/);
 if(!m) throw Error('invalid timestamp: explicit UTC offset required');
 const [,ys,mos,ds,hs,ms,ss,,offset,,oh,om]=m;
 const [y,mo,d,h,mi,s]=[ys,mos,ds,hs,ms,ss].map(Number);
 const leap=y%4===0 && (y%100!==0 || y%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 if(y<1||mo<1||mo>12||d<1||d>days[mo-1]||h>23||mi>59||s>59||offset!=='Z'&&(Number(oh)>14||Number(om)>59||Number(oh)===14&&Number(om)!==0)) throw Error('invalid timestamp');
 const n=Date.parse(value); if(!Number.isFinite(n)) throw Error('invalid timestamp');
 return new Date(n).toISOString();
}
function shape(input,keys,max) {
 if(!input||Object.getPrototypeOf(input)!==Object.prototype) throw Error('object required');
 if(Buffer.byteLength(canonicalJSON(input))>max) throw Error('payload size exceeded');
 for(const k of Object.keys(input)) if(!keys.includes(k)) throw Error('unexpected field: '+k);
 for(const k of keys) if(!(k in input)) throw Error('missing field: '+k);
 return structuredClone(input);
}
function text(v,name) {if(typeof v!=='string'||!v.trim()||v.length>256) throw Error('invalid '+name);}
function common(x) {
 if(typeof x.fixture_id!=='string'||!(/^[1-9]\d{0,17}$/).test(x.fixture_id)) throw Error('invalid fixture_id');
 if(x.feature_schema_version!==1) throw Error('unsupported schema version');
 if(!hash.test(x.source_hash)) throw Error('invalid source hash');
}
export function probabilities(p) {
 if(!Array.isArray(p)||p.length!==3||p.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)||Math.abs(p.reduce((a,b)=>a+b,0)-1)>.005) throw Error('invalid probabilities');
 return [...p];
}
export const OBSERVATION_FIELDS=['observation_id','fixture_id','source_kind','source_ref','collector_run_id','field_name','value','availability','feature_schema_version','source_hash','effective_at_utc','played_at_utc'];
export function validateObservation(input,{receiptAt}={}) {
 if(!receiptAt) throw Error('authoritative receipt required');
 const receipt=utcInstant(receiptAt),x=shape(input,OBSERVATION_FIELDS,LIMITS.envelopeBytes); common(x);
 for(const k of ['observation_id','collector_run_id']) if(!uuid.test(x[k])) throw Error('invalid '+k);
 for(const k of ['source_ref','field_name']) text(x[k],k);
 if(!['collector','odds','fixture'].includes(x.source_kind)) throw Error('invalid source kind');
 if(!['observed','unknown'].includes(x.availability)) throw Error('invalid availability');
 if(x.availability==='unknown'&&x.value!==null) throw Error('unknown evidence must be null');
 if(x.availability==='observed'&&x.value===null) throw Error('observed evidence needs value');
 if(Buffer.byteLength(canonicalJSON(x.value))>LIMITS.fieldBytes) throw Error('field size exceeded');
 for(const k of ['effective_at_utc','played_at_utc']) if(x[k]!==null) x[k]=utcInstant(x[k]);
 if(x.played_at_utc && x.played_at_utc>=receipt) throw Error('played time must precede receipt');
 if(x.effective_at_utc && x.effective_at_utc>receipt) throw Error('effective time is in future');
 return {...x,received_at_utc:receipt,observed_at_utc:x.availability==='observed'?receipt:null,payload_hash:canonicalHash(x.value)};
}
export const SNAPSHOT_FIELDS=['snapshot_id','fixture_id','prediction_build','model_version','run_id','issue_time_utc','kickoff_at_utc','probabilities','pick','pick_probability','market','expected_goals','fixture_version_hash','feature_schema_version','source_hash','settlement_policy_version'];
export function validatePredictionSnapshot(input) {
 const x=shape(input,SNAPSHOT_FIELDS,LIMITS.envelopeBytes); common(x);
 for(const k of ['snapshot_id','run_id']) if(!uuid.test(x[k])) throw Error('invalid '+k);
 for(const k of ['model_version','pick','market']) text(x[k],k);
 if(!Number.isInteger(x.prediction_build)||x.prediction_build<62) throw Error('invalid prediction build');
 if(!hash.test(x.fixture_version_hash)) throw Error('invalid fixture hash');
 x.issue_time_utc=utcInstant(x.issue_time_utc);x.kickoff_at_utc=utcInstant(x.kickoff_at_utc);
 if(x.issue_time_utc>=x.kickoff_at_utc) throw Error('issuance must precede kickoff');
 x.probabilities=probabilities(x.probabilities);
 if(typeof x.pick_probability!=='number'||!Number.isFinite(x.pick_probability)||x.pick_probability<0||x.pick_probability>1) throw Error('invalid pick probability');
 if(!Array.isArray(x.expected_goals)||x.expected_goals.length!==2||x.expected_goals.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0)) throw Error('invalid expected goals');
 if(x.settlement_policy_version!=='build355-90m-48h-v1') throw Error('unknown settlement policy');
 return x;
}
