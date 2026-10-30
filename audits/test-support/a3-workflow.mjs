export const RECEIPT='2026-10-25T12:00:00.000Z';
export function source(){
 const row={fxid:1,lid:39,home:'Synthetic Home',away:'Synthetic Away',lname:'Synthetic League',lcountry:'Test',provider:'af',season:2026,date:'2026-10-26',time:'14:00',status:'NS',gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,xg_h:null,xg_a:null,inj_h:'',inj_a:''};
 return{schema_version:1,synthetic:true,source_read_at_utc:'2026-10-25T11:59:00Z',history_complete:true,targets:[1],rows:[{...row,fxid:2,date:'2026-10-24',status:'FINISHED',gh:2,ga:1,ft_h:2,ft_a:1,xg_h:1.5,xg_a:null},row],odds:[{price:1.9}],originals:[{p_home:.9}],measures:[],scope_competition_ids:[39]};
}
export function decision(packet){return{fixture_id:packet.fixture.fixture_id,packet_hash:packet.packet_hash,abstain:false,reason:'supported',probabilities:[.45,.3,.25],evidence_refs:packet.evidence.facts.map(f=>f.ref),analysis:[{statement:'The limited historical scoring evidence warrants a cautious home preference.',evidence_refs:packet.evidence.facts.map(f=>f.ref)}],risk:{status:'concern',explanation:'Limited history and missing chance evidence leave substantial uncertainty.',evidence_refs:packet.evidence.facts.map(f=>f.ref)},uncertainty:{calibration:'not_validated',limitations:['Synthetic example only; no empirical calibration.']}};}
export function envelope(d,profile){return{id:'synthetic-generation',model:profile.model,provider:profile.provider,choices:[{finish_reason:'stop',message:{content:JSON.stringify(d)}}],usage:{prompt_tokens:100,completion_tokens:200,cost:0}};}

// Complete fake legacy journal for CI; no private source/forecast is embedded.
export async function legacyFixture(){
 const {syntheticSource}=await import('../a3-workflow/authority.mjs'),{buildPacket}=await import('../a3-workflow/contract.mjs');
 const {canonicalHash}=await import('../lib/snapshot-contract.mjs');
 const {freezeProfile,buildRequest}=await import('../phase8-continuation/contracts.mjs');
 const {catalog}=await import('./openrouter-fixtures.mjs'),{geminiCatalog}=await import('./gemini-fixtures.mjs');
 const s=source(),packet=buildPacket(syntheticSource(s,RECEIPT),1),metadata={event_id:'synthetic-packet',received_at:RECEIPT,event_body_hash:'a'.repeat(64)};
 const events=[],t='2026-10-25T12:03:00Z';
 const add=(kind,id,parent,body,received_at='2026-10-25T12:04:02Z')=>{body=JSON.parse(JSON.stringify(body));const e={kind,event_id:id,parent_id:parent,body,received_at,event_body_hash:canonicalHash(body)};events.push(e);return e;};
 const engineInput=canonicalHash({...s,receipt_at_utc:RECEIPT});
 add('job','engine',metadata.event_id,{fixture_id:'1',provider_model:null});
 add('forecast','engine:E-Refreshed','engine',{arm:'E-Refreshed',status:'forecast',probabilities:[.6,.25,.15],generated_at_utc:'2026-10-25T12:02:00Z',engine_source_hash:'c915f9820c363786f4848ba6ba0f935a100a03f4507505c3b3bf029357e29b10',input_hash:engineInput});
 for(const [tag,profile]of [['openai',freezeProfile(catalog(),RECEIPT)],['gemini',freezeProfile(geminiCatalog(),RECEIPT)]]){
  add('job',tag,metadata.event_id,{fixture_id:'1',provider_model:profile.model});
  for(const arm of ['scout','A3']){
   const request=buildRequest(arm,profile,packet.evidence,t),id=tag+':'+arm;
   add('reservation',id,tag,{request,profile},t);
   const blocked=tag==='gemini'&&arm==='A3',abstain=tag==='openai'&&arm==='scout';
   let d={abstain,reason:abstain?'missing_evidence':'supported',evidence_refs:abstain?[]:request.evidence_refs};
   d=arm==='scout'?{...d,hm:abstain?null:1,am:abstain?null:1,veto:abstain?null:false}:{...d,probabilities:[.45,.3,.25]};
   const r=envelope(d,profile);r.id=id;
   if(blocked)add('usage',id+':stop',id,{status:'blocked_before_http',reason:'operator_confirmation_expired_by_completion_of_pre_http_checkpoint'});
   else add('usage',id+':raw',id,{status:'provider_response',response:r},'2026-10-25T12:04:00Z');
   add('forecast',id+':forecast',tag,{arm:arm==='scout'?'A2':'A3',status:blocked?'failed':abstain?'abstain':'forecast',reason:blocked?'provider_or_response_failure':d.reason,generation_id:blocked?null:r.id,request_hash:request.request_hash,input_hash:engineInput,ai_evidence_hash:request.input_hash,generated_at_utc:'2026-10-25T12:04:01Z',...(arm==='A3'?{probabilities:blocked?undefined:d.probabilities}:{veto:d.veto})});
  }
 }
 // JSON records cannot carry undefined properties.
 return{packet,metadata,events:JSON.parse(JSON.stringify(events))};
}
