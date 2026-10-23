// Server-side staging adapter. No HTTP, provider SDK or browser credentials.
import {canonicalHash,canonicalJSON,validateObservation,LIMITS} from '../lib/snapshot-contract.mjs';
import {FIXTURE_FIELDS} from '../lib/asof-features.mjs';
const inputKeys=['runId','fixtureId','sourceKind','fields','sourceRef','playedAt','effectiveAt'];
function contentUuid(value) {
 const h=canonicalHash(value).slice(0,32).split('');h[12]='5';h[16]='8';
 const s=h.join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}
export async function appendObservedFields(input,writer) {
 for(const k of Object.keys(input)) if(!inputKeys.includes(k)) throw Error('unexpected ingestion field: '+k);
 if(!input.fields || Object.getPrototypeOf(input.fields)!==Object.prototype) throw Error('field object required');
 const rows=Object.entries(input.fields).map(([field,value])=>{
  if(!FIXTURE_FIELDS.includes(field)&&!(input.sourceKind==='odds'&&field==='odds_1x2')) throw Error('unsupported field: '+field);
  const sourceHash=canonicalHash({field,value,source:input.sourceRef});
  const row={observation_id:contentUuid({run:input.runId,fixture:input.fixtureId,field,sourceHash}),fixture_id:String(input.fixtureId),source_kind:input.sourceKind,source_ref:input.sourceRef,collector_run_id:input.runId,field_name:field,value,availability:value===null?'unknown':'observed',feature_schema_version:1,source_hash:sourceHash,played_at_utc:input.playedAt??null,effective_at_utc:input.effectiveAt??null};
  // Preliminary shape/size check only; discard these local timestamps. The SQL writer
  // exclusively assigns authoritative received_at/observed_at at ingestion.
  validateObservation(row,{receiptAt:new Date().toISOString()});return row;
 });
 if(rows.length>LIMITS.batchCount||Buffer.byteLength(canonicalJSON(rows))>LIMITS.batchBytes) throw Error('batch size exceeded');
 const receipt=await writer(structuredClone(rows));
 if(receipt?.error) throw Object.assign(Error('observation writer refused'),{code:receipt.error.code??'XX000'});
 if(!Array.isArray(receipt?.ids)||receipt.ids.length!==rows.length||receipt.ids.some(id=>typeof id!=='string'||!(/^[0-9a-f-]{36}$/i).test(id))) throw Error('observation receipt missing/invalid');
 return {observation_ids:[...receipt.ids],receipt};
}
