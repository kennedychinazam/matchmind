// Approved public Data API GETs only; no RPC, Edge Function, odds or model calls.
import {readSource,collectPages} from '../phase8/source.mjs';
import {ENGINE_COMP_IDS} from '../phase8/engine.mjs';
import {canonicalHash,epochMicros,utcInstant} from '../lib/snapshot-contract.mjs';
export const FIELDS='fxid,lid,lname,lcountry,season,date,time,status,home,away,gh,ga,ht_h,ht_a,ft_h,ft_a,provider,xg_h,xg_a,inj_h,inj_a';
export async function collectOneFixture(fixtureId,{read=readSource,clock=()=>new Date().toISOString(),onPage=()=>{}}={}){
 const start=utcInstant(clock()),id=Number(fixtureId);
 if(!Number.isSafeInteger(id)||id<=0)throw Error('fixture_id');
 const target=read('fixtures',{select:FIELDS,fxid:'eq.'+id,limit:2},{count:true});
 if(target.total!==1||target.rows.length!==1)throw Error('one_verified_fixture_required');const f=target.rows[0];
 if(!ENGINE_COMP_IDS.includes(f.lid)||!['NS','SCHEDULED'].includes(f.status)||!/^2026-10-(?:2[7-9]|3[01])$/u.test(f.date)||epochMicros(f.date+'T'+f.time+':00Z')<=epochMicros(start))throw Error('fixture_not_eligible_in_authorized_scope');
 const cutoff=new Date(start);cutoff.setUTCMonth(cutoff.getUTCMonth()-60);const history_cutoff=cutoff.toISOString().slice(0,10);
 const rows=[],pages=[],counts=Object.fromEntries(ENGINE_COMP_IDS.map(id=>[id,0]));
 const receipts=[target.received_at_utc];
 for(const lid of ENGINE_COMP_IDS){
  const q={select:FIELDS,lid:'eq.'+lid,date:'gte.'+history_cutoff,or:'(date.lte.'+start.slice(0,10)+',fxid.eq.'+id+')',order:'fxid.asc'};
  const first=read('fixtures',{...q,select:'fxid',limit:0},{count:true});if(!Number.isSafeInteger(first.total)||first.total<0)throw Error('source_count_required');
  receipts.push(first.received_at_utc);
  const group=await collectPages(async last=>{const page=read('fixtures',{...q,fxid:'gt.'+last,limit:1000});receipts.push(page.received_at_utc);onPage({lid,rows:page.rows.length});return{...page,total:first.total};});
  const last=read('fixtures',{...q,select:'fxid',limit:0},{count:true});receipts.push(last.received_at_utc);if(last.total!==first.total)throw Error('source_inventory_changed');
  rows.push(...group.rows);counts[lid]=group.rows.length;pages.push(...group.pages.map(p=>({...p,lid})));
  if(Buffer.byteLength(JSON.stringify(rows))>50*1024*1024)throw Error('complete_source_capacity_no_truncation');
 }
 const final=read('fixtures',{select:FIELDS,fxid:'eq.'+id,limit:2},{count:true});receipts.push(final.received_at_utc);
 const selected=rows.filter(r=>r.fxid===id);
 if(final.total!==1||selected.length!==1||canonicalHash(final.rows[0])!==canonicalHash(selected[0])||canonicalHash(final.rows[0])!==canonicalHash(f))throw Error('fixture_changed_during_collection');
 const measures=read('competition_measures',{select:'lid,gate,skill,data_size,build,computed_at',order:'lid.asc',limit:1000},{count:true});
 if(measures.total!==measures.rows.length)throw Error('measure_inventory_incomplete');receipts.push(measures.received_at_utc);
 const end=utcInstant(clock());for(const at of receipts)if(!at||epochMicros(at)<epochMicros(start)||epochMicros(at)>epochMicros(end))throw Error('source_receipt_chronology');
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.fxid-b.fxid);
 return{schema_version:1,...(read!==readSource?{synthetic:true}:{}),history_cutoff,history_complete:true,scope_competition_ids:[...ENGINE_COMP_IDS],inventory:{row_count:rows.length,competition_count:new Set(rows.map(r=>r.lid)).size,history_count:rows.filter(r=>['FT','AET','PEN','FINISHED'].includes(r.status)).length,competition_rows:counts},rows,measures:measures.rows,targets:[id],originals:[],odds:[],source_read_at_utc:end,collection:{kind:'a3_single_readonly_v1',started_at_utc:start,earliest_receipt_at_utc:receipts.reduce((a,b)=>epochMicros(a)<epochMicros(b)?a:b),finished_at_utc:end,atomic_database_snapshot:false,pages,initial_count:rows.length,final_count:rows.length,fixture_receipt:final,history_semantics:'complete fixed competition scope as collected; no claim of historical first receipt or regulation-only final scores'}};
}
