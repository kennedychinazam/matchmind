import {readFileSync} from 'node:fs';
import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {rawHash,safeClone,freeze,parseBoundedJSON} from '../a4/bounds.mjs';
import {validate} from '../a4/schema.mjs';
import {validateFootballText} from '../a4/text-policy.mjs';
import {buildRequest,parseResponse,validateRequest} from '../phase8-continuation/contracts.mjs';
import {assertPacket,readPacketSource} from './contract.mjs';
import {readRetained,RETAINED} from './authority.mjs';
import {ENGINE_SOURCE_SHA256} from '../phase8/engine.mjs';
import {cloneReplay} from './replay-bounds.mjs';
export const PROMPT=readFileSync(new URL('./prompts/1.0.0.md',import.meta.url),'utf8');
export const RESPONSE_SCHEMA=freeze(JSON.parse(readFileSync(new URL('./response.schema.json',import.meta.url))));
export const PROMPT_HASH=rawHash(PROMPT),SCHEMA_HASH=canonicalHash(RESPONSE_SCHEMA);
const manifest=JSON.parse(readFileSync(new URL('./artifact-manifest.json',import.meta.url)));
if(manifest.version!=='1.0.0'||manifest.prompt_sha256!==PROMPT_HASH||manifest.response_schema_canonical_sha256!==SCHEMA_HASH)throw Error('A3_prompt_or_schema_version_identity_changed');
const models=new Set(['openai/gpt-6-luna','google/gemini-3-flash-preview']),analyses=new WeakSet();
export function draftRequest(packet,profile,now){
 const p=assertPacket(packet);if(!models.has(profile.model))throw Error('model_not_selected_for_this_workflow');
 if(epochMicros(now)<epochMicros(p.source.received_at_utc)||epochMicros(now)>=epochMicros(p.fixture.kickoff_at_utc))throw Error('draft_chronology');
 if(epochMicros(now)-epochMicros(p.source.source_read_at_utc)>900000000n)throw Error('fresh_receipted_source_required_for_request_draft');
 const old=buildRequest('A3',profile,p.evidence,now),body=structuredClone(old.body);
 // checkProfile inside buildRequest pins plain decimal caps. Shift the decimal
 // in text before conversion: binary multiplication serialized 0.20 as
 // 0.19999999999999998, potentially excluding the approved long-context tier.
 // This changes only this versioned isolated draft, never historical requests.
 body.provider.max_price={prompt:Number(profile.prompt_cap+'e6'),completion:Number(profile.completion_cap+'e6')};
 body.max_tokens=4096;if(body.max_tokens>profile.physical_completion_max)throw Error('insufficient_output_capacity');
 body.messages=[{role:'system',content:PROMPT},{role:'user',content:JSON.stringify(p)}];
 body.response_format={type:'json_schema',json_schema:{name:'independent_a3_football_v1',strict:true,schema:RESPONSE_SCHEMA}};
 const bytes=Buffer.byteLength(JSON.stringify(body));if(bytes+16384+body.max_tokens>profile.context_length)throw Error('complete_evidence_exceeds_conservative_byte_proxy_no_truncation');
 const draft={version:'a3-offline-request-v1.1.0',arm:'A3-OFFLINE',live_dispatch_enabled:false,packet_hash:p.packet_hash,prompt_version:'1.0.0',prompt_hash:PROMPT_HASH,schema_hash:SCHEMA_HASH,profile_hash:profile.profile_hash,input_bytes:bytes,capacity_status:'byte_proxy_only_provider_tokenization_and_schema_unverified',body};
 return freeze({...draft,request_hash:canonicalHash(draft)});
}
export function validateAnalysis(response,packet,profile){
 const p=assertPacket(packet),content=response?.choices?.[0]?.message?.content;
 if(!models.has(profile.model)||typeof content!=='string'||Buffer.byteLength(content)>32768)throw Error('bounded_analysis_response_required');
 const checkAt=epochMicros(profile.observed_at_utc)>=epochMicros(p.source.received_at_utc)?profile.observed_at_utc:p.source.received_at_utc;
 buildRequest('A3',profile,p.evidence,checkAt); // Reuse unchanged pinned profile checks.
 const v=validate(parseBoundedJSON(content).value,RESPONSE_SCHEMA);
 if(v.fixture_id!==p.fixture.fixture_id||v.packet_hash!==p.packet_hash)throw Error('response_fixture_or_packet_identity');
 const refs=p.evidence.facts.map(f=>f.ref),labels=[p.fixture.home,p.fixture.away,p.fixture.competition,p.fixture.country];
 for(const list of [v.evidence_refs,...v.analysis.map(a=>a.evidence_refs),v.risk.evidence_refs])if(new Set(list).size!==list.length||list.some(ref=>!refs.includes(ref)))throw Error('unverified_or_duplicate_evidence_reference');
 for(const text of [...v.analysis.map(a=>a.statement),v.risk.explanation,...v.uncertainty.limitations])validateFootballText(text,'commentary',labels);
 const legacy=Object.fromEntries(['abstain','reason','probabilities','evidence_refs'].map(k=>[k,v[k]]));
 // Reuse the established provider/usage/probability/abstention validator while
 // preserving the richer original content's hash. No original parser is changed.
 const projected={...response,choices:response.choices.map(c=>({...c,message:{...c.message,content:JSON.stringify(legacy)}}))};
 const parsed=parseResponse('A3',projected,profile,refs);
 if(v.abstain?(v.analysis.length!==0||v.risk.status!=='insufficient_evidence'):(!v.analysis.length||!v.risk.evidence_refs.length))throw Error('inconsistent_analysis_or_risk');
 const result=freeze({version:'a3-analysis-v1',status:v.abstain?'abstain':'forecast',fixture_id:v.fixture_id,packet_hash:p.packet_hash,model:profile.model,provider:profile.provider,generation_id:parsed.generation_id,probabilities:v.probabilities,reason:v.reason,evidence_refs:v.evidence_refs,analysis:v.analysis,risk:v.risk,uncertainty:v.uncertainty,response_hash:canonicalHash(response),prompt_version:'1.0.0',prompt_hash:PROMPT_HASH,schema_hash:SCHEMA_HASH,semantic_support_verified:false,provider_dispatch_verified:false,actionable:false});
 analyses.add(result);return result;
}
export function freezeComparison(packet,engine,ai,{created_at_utc}={}){
 const p=assertPacket(packet),e=safeClone(engine);epochMicros(created_at_utc);
 if(epochMicros(created_at_utc)<epochMicros(p.source.received_at_utc)||e.build!==355||e.fixture_id!==p.fixture.fixture_id||!Array.isArray(e.probabilities)||e.probabilities.length!==3||e.probabilities.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0||x>1)||Math.abs(e.probabilities.reduce((a,b)=>a+b,0)-1)>1e-8)throw Error('comparison_engine_or_time');
 if(!Array.isArray(ai)||ai.some(a=>!analyses.has(a)||a.packet_hash!==p.packet_hash)||new Set(ai.map(a=>a.model)).size!==ai.length)throw Error('unvalidated_or_duplicate_ai_comparison');
 const body={version:'a3-comparison-v1',mode:'offline_comparison_not_new_issuance',created_at_utc,fixture:p.fixture,source:p.source,packet_hash:p.packet_hash,engine:e,engine_lineage:'caller_artifact_requires_retained_lineage_or_future_receipt_binding',ai:[...ai],limitations:p.limitations,calibration:'not_validated',new_prediction_issued:false,live_dispatch_enabled:false,actionable:false};
 return freeze({...body,comparison_hash:canonicalHash(body)});
}

// Only the exact accepted retained journal can supply historical lineage.
// No new issuance, engine computation, prompt substitution or provider call.
export function replayLegacyEvents(packet,metadata,inputEvents,{created_at_utc}={}){
 const p=assertPacket(packet),events=cloneReplay(inputEvents),enrolled=safeClone(metadata);
 if(epochMicros(enrolled.received_at)!==epochMicros(p.source.received_at_utc)||events.some(e=>e.kind==='packet'))throw Error('replay_receipt_or_inventory');
 const one=(xs,why)=>{if(xs.length!==1)throw Error(why);return xs[0];};
 const jobFor=model=>one(events.filter(e=>e.kind==='job'&&e.parent_id===enrolled.event_id&&e.body.fixture_id===p.fixture.fixture_id&&e.body.provider_model===model),'retained_job');
 const forecast=(job,arm)=>one(events.filter(e=>e.kind==='forecast'&&e.parent_id===job.event_id&&e.body.arm===arm),'retained_forecast');
 const receiptOrder=(...times)=>{const ns=times.map(epochMicros);if(ns.some((n,i)=>i&&n<ns[i-1]))throw Error('retained_issuance_chronology');};
 function requestFor(job,arm){
  const r=one(events.filter(e=>e.kind==='reservation'&&e.parent_id===job.event_id&&e.body.request?.arm===arm),'retained_request');
  const request=r.body.request,profile=r.body.profile;
  validateRequest(request,profile,r.received_at);
  if(canonicalHash(JSON.parse(request.body.messages[1].content))!==canonicalHash(p.evidence))throw Error('retained_request_source_equivalence');
  if(request.body.model!==job.body.provider_model)throw Error('retained_model_identity');
  return{r,request,profile};
 }
 function rawFor(r){return events.filter(e=>e.kind==='usage'&&e.parent_id===r.event_id&&e.body.status==='provider_response');}
 function riskFor(job){
  const f=forecast(job,'A2'),{r,request,profile}=requestFor(job,'scout'),raw=one(rawFor(r),'retained_risk_response');
  const d=parseResponse('scout',raw.body.response,profile,request.evidence_refs).decision;
  if(f.body.request_hash!==request.request_hash||f.body.generation_id!==raw.body.response.id||(d.abstain?(f.body.status!=='abstain'||f.body.reason!==d.reason):(f.body.status!=='forecast'||f.body.veto!==d.veto)))throw Error('retained_risk_decision_binding');
  receiptOrder(enrolled.received_at,r.received_at,raw.received_at,f.received_at,p.fixture.kickoff_at_utc);
  return{arm:'A2',status:d.abstain?'abstain':d.veto?'veto':'no_veto',reason:d.reason,original_record_id:f.event_id,original_record_hash:f.event_body_hash,request_hash:request.request_hash,prompt_hash:rawHash(request.body.messages[0].content),received_at_utc:f.received_at,narrative:null,narrative_status:'not_in_original_structured_contract',changes_A3_probabilities:false};
 }
 const engineJob=jobFor(null),engineEvent=forecast(engineJob,'E-Refreshed'),eb=engineEvent.body;
 const engineInput=canonicalHash({...readPacketSource(p),receipt_at_utc:p.source.received_at_utc});
 if(eb.status!=='forecast'||eb.engine_source_hash!==ENGINE_SOURCE_SHA256||eb.input_hash!==engineInput)throw Error('retained_engine_binding');
 receiptOrder(enrolled.received_at,eb.generated_at_utc,engineEvent.received_at,p.fixture.kickoff_at_utc);
 const engine={build:355,fixture_id:p.fixture.fixture_id,probabilities:[...eb.probabilities],source_hash:eb.engine_source_hash,original_arm:'E-Refreshed',original_record:engineEvent};
 const ai=[];
 for(const model of models){
  const job=jobFor(model),f=forecast(job,'A3'),{r,request,profile}=requestFor(job,'A3'),raws=rawFor(r),risk=riskFor(job);
  if(f.body.request_hash!==request.request_hash||f.body.ai_evidence_hash!==request.input_hash||f.body.input_hash!==engineInput)throw Error('retained_A3_binding');
  let row={version:'retained-A3-replay-v1',fixture_id:p.fixture.fixture_id,packet_hash:p.packet_hash,model,provider:profile.provider,request_hash:request.request_hash,prompt_hash:rawHash(request.body.messages[0].content),prompt_version:'original-openrouter-private-v1',response_schema_hash:canonicalHash(request.body.response_format.json_schema.schema),source_evidence_hash:request.input_hash,received_at_utc:f.received_at,original_generated_at_utc:f.body.generated_at_utc,original_record_id:f.event_id,original_record_hash:f.event_body_hash,risk,analysis:null,analysis_status:'not_in_original_structured_contract',uncertainty:{calibration:'not_validated',limitations:p.limitations},semantic_support_verified:false,actionable:false};
  if(!raws.length){
   const stop=events.filter(e=>e.kind==='usage'&&e.parent_id===r.event_id&&e.body.status==='blocked_before_http'&&e.body.reason==='operator_confirmation_expired_by_completion_of_pre_http_checkpoint');
   if(stop.length!==1||f.body.status!=='failed')throw Error('unverified_missing_response');
   row={...row,status:'unavailable',reason:'expired_authorization_before_http',probabilities:null,generation_id:null,response_hash:null,original_stored_status:f.body.status,no_redispatch:true};
  }else{
   const raw=one(raws,'retained_A3_response'),parsed=parseResponse('A3',raw.body.response,profile,request.evidence_refs),d=parsed.decision;
   if(f.body.status!==(d.abstain?'abstain':'forecast')||f.body.generation_id!==parsed.generation_id||canonicalHash(f.body.probabilities??null)!==canonicalHash(d.probabilities))throw Error('retained_A3_decision');
   receiptOrder(enrolled.received_at,r.received_at,raw.received_at,f.body.generated_at_utc,f.received_at,p.fixture.kickoff_at_utc);
   row={...row,status:d.abstain?'abstain':'forecast',reason:d.reason,probabilities:d.probabilities,evidence_refs:d.evidence_refs,generation_id:parsed.generation_id,response_hash:canonicalHash(raw.body.response)};
  }
  if(epochMicros(created_at_utc)<epochMicros(f.received_at))throw Error('replay_cannot_predate_original_record');
  row=freeze(row);analyses.add(row);ai.push(row);
 }
 return freezeComparison(p,engine,ai,{created_at_utc});
}
export function replayRetained(packet,handle,{created_at_utc}={}){
 const p=assertPacket(packet),{events,packet:enrolled}=readRetained(handle);
 if(p.source.source_hash!==RETAINED.source_hash||p.source.classification!=='accepted_historical_receipt_replay')throw Error('retained_source_binding');
 const {body:sourceBody,...metadata}=enrolled;
 const comparison=replayLegacyEvents(p,metadata,events.filter(e=>e.kind!=='packet'),{created_at_utc}),{comparison_hash,...body}=comparison;
 const verified={...body,engine_lineage:'exact_accepted_journal_and_unchanged_Build355_record',retained_lineage:{journal_sha256:RETAINED.journal_sha256,packet_event_id:enrolled.event_id,packet_event_body_hash:enrolled.event_body_hash,source_canonical_hash:RETAINED.source_hash,legacy_request_view_hash:canonicalHash(p.evidence),not_a_new_recovery_verification:true},original_published_E_status:'not_reconstructed; preserve_existing_E_abstention'};
 return freeze({...verified,comparison_hash:canonicalHash(verified)});
}
