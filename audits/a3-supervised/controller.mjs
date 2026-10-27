// Separate one-fixture controller. Original Sunday and request executor unchanged.
import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {freeze} from '../a4/bounds.mjs';
import {assertPacket,readPacketSource} from '../a3-workflow/contract.mjs';
import {draftRequest,validateAnalysis} from '../a3-workflow/workflow.mjs';
import {verifyAccount,freezeProfile,dollarsToMicros,CEILING,comparisonModels} from '../phase8-continuation/contracts.mjs';
import {assertRuntime} from '../phase8-continuation/runtime.mjs';
import {ENGINE_SOURCE_SHA256} from '../phase8/engine.mjs';
import {assertSingleStore} from './local.mjs';
import {assertGenuineTransport} from './transport.mjs';
const plans=new WeakSet(),permits=new WeakMap();
function endpointContract(e){return{model_id:e.model_id,tag:e.tag,provider_name:e.provider_name,service_tier:e.service_tier,status:e.status,context_length:e.context_length,max_prompt_tokens:e.max_prompt_tokens,max_completion_tokens:e.max_completion_tokens,supported_parameters:[...(e.supported_parameters??[])].sort(),supports_tool_choice:e.supports_tool_choice,supports_implicit_caching:e.supports_implicit_caching,pricing:e.pricing};}
export function prepareOne(packet,engine,profile,now,{catalog}={}){
 const p=assertPacket(packet),s=readPacketSource(p),matches=engine?.predictions?.filter(r=>r.fixture_id===p.fixture.fixture_id)??[];
 if(profile.model!=='openai/gpt-6-luna'||profile.provider!=='OpenAI'||profile.tag!=='openai'||engine.build!==355||engine.source_sha256!==ENGINE_SOURCE_SHA256||engine.input_hash!==canonicalHash({...s,receipt_at_utc:p.source.received_at_utc})||matches.length!==1)throw Error('independent_engine_lineage');
 const e=matches[0];
 if(e.status!=='forecast'||e.eligible!==true||e.home!==p.fixture.home||e.away!==p.fixture.away||epochMicros(e.kickoff_at_utc)!==epochMicros(p.fixture.kickoff_at_utc)||epochMicros(e.generated_at_utc)<epochMicros(p.source.received_at_utc)||epochMicros(e.generated_at_utc)>epochMicros(now)||!Array.isArray(e.probabilities)||e.probabilities.length!==3||e.probabilities.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0||x>1)||Math.abs(e.probabilities.reduce((a,b)=>a+b,0)-1)>1e-8)throw Error('invalid_engine_forecast_lineage');
 if(!s.synthetic&&engine.synthetic_clock!==false)throw Error('genuine_engine_clock_required');
 const endpoints=catalog?.data?.endpoints?.filter(e=>canonicalHash(e)===profile.endpoint_hash)??[];if(endpoints.length!==1)throw Error('profile_catalog_binding_required');
 const draft=draftRequest(p,profile,now),body={version:'a3-supervised-one-v1',model:profile.model,fixture:p.fixture,packet:p,engine:structuredClone(e),engine_artifact:structuredClone(engine),profile:structuredClone(profile),endpoint_contract_hash:canonicalHash(endpointContract(endpoints[0])),draft_hash:draft.request_hash,body:draft.body,maximum_new_micros:profile.reserved_micros,dispatch_authorized:false};
 const plan=freeze({...body,request_hash:canonicalHash(body)});plans.add(plan);return plan;
}
function assertPlan(p){if(!plans.has(p))throw Error('unadmitted_supervised_plan');}
function t(s){return epochMicros(s);}
export function consumePermit(permit,now){const p=permits.get(permit);permits.delete(permit);if(!p||t(now)>=t(p.expires))throw Error('missing_expired_or_used_dispatch_permit');return freeze({...p,runtime:structuredClone(p.runtime)});}
export async function dispatchOne(plan,options){
 assertPlan(plan);const {store,authorization_id,readiness_id,checkpoint,transport,refresh}=options;
 if(plan.packet.source.classification==='a3_isolated_database_receipt')assertSingleStore(store);
 if(!authorization_id)throw Error('final_operator_authorization_required');
 const authorization=store.readAuthorization(authorization_id);if(!authorization)throw Error('immutable_final_operator_authorization_absent');
 if(options.supervised!==true)throw Error('explicit_supervised_execution_required');
 if(plan.packet.source.classification==='a3_isolated_database_receipt'&&(options.recoveryVerified!==true||options.externalCopyVerified!==true))throw Error('verified_recovery_and_external_copy_required');
 const readiness=readiness_id&&store.readReadiness(readiness_id);if(!readiness)throw Error('independent_capacity_and_schema_readiness_receipt_absent');
 if(readiness.job_id!==authorization.job_id)throw Error('readiness_authorization_job_mismatch');
 store.assertLedgerAnchor();
 if(store.hasSingleAttempt(authorization.job_id))throw Error('single_study_already_attempted_never_redispatch');
 if(typeof checkpoint!=='function'||typeof transport!=='function'||typeof refresh!=='function')throw Error('supervised_dependencies_required');
 if(plan.packet.source.classification==='a3_isolated_database_receipt')assertGenuineTransport(transport);
 const s=readPacketSource(plan.packet),ko=t(plan.fixture.kickoff_at_utc),sid=plan.request_hash.slice(0,48),reservation='a3one:'+sid;
 const gate=async()=>{
  let now=store.clock();const a=authorization.body,r=readiness.body;
  const timeGuard=at=>{
   if(!/^2026-10-(?:2[7-9]|3[01])$/u.test(at.slice(0,10))||a.issuance_date_utc!==at.slice(0,10)||t(at)<t(authorization.received_at)||t(at)>=t(a.expires_at_utc)||t(at)-t(authorization.received_at)>600000000n||ko-t(at)<=450000000n)throw Error('expired_authorization_or_issue_deadline');
   if(t(at)-t(s.collection?.earliest_receipt_at_utc??s.source_read_at_utc)>900000000n||t(at)-t(s.source_read_at_utc)>900000000n)throw Error('fresh_complete_history_required');
  };timeGuard(now);
  if(a.version!=='a3-single-final-v1'||a.fixture_id!==plan.fixture.fixture_id||a.request_hash!==plan.request_hash||a.packet_hash!==plan.packet.packet_hash||a.model!==plan.model||a.provider!=='OpenAI'||a.max_new_micros!==plan.maximum_new_micros||!(/^[a-f0-9]{64}$/u).test(a.operator_message_sha256??''))throw Error('authorization_scope_mismatch');
  // A caller flag cannot provide readiness. Only a separate immutable reviewed
  // receipt loaded by the pinned local repository can attest a complete bound.
  if(r.version!=='a3-reviewed-provider-bound-v1'||r.request_hash!==plan.request_hash||r.profile_hash!==plan.profile.profile_hash||r.schema_hash!==canonicalHash(plan.body.response_format.json_schema.schema)||!Number.isSafeInteger(r.complete_input_upper_tokens)||r.complete_input_upper_tokens<1||r.complete_input_upper_tokens>922000||r.complete_input_upper_tokens+plan.profile.physical_completion_max>plan.profile.context_length||r.schema_contract_reviewed!==true||r.output_contract_reviewed!==true||!(/^[a-f0-9]{64}$/u).test(r.review_artifact_sha256??''))throw Error('unverified_complete_capacity_or_schema_contract');
  const fresh=await refresh();now=store.clock();timeGuard(now);assertRuntime(fresh.runtime,now);
  for(const at of [fresh.observed_at_utc,fresh.fixture_received_at_utc])if(!at||t(at)>t(now)||t(now)-t(at)>120000000n)throw Error('fresh_account_and_fixture_observations_required');
  const profile=freezeProfile(fresh.catalog,now);
  const endpoint=fresh.catalog.data.endpoints.find(e=>canonicalHash(e)===profile.endpoint_hash);
  if(endpoint?.supports_implicit_caching!==false)throw Error('unbounded_implicit_cache_pricing');
  if(!Number.isSafeInteger(endpoint?.max_prompt_tokens)||r.complete_input_upper_tokens>endpoint.max_prompt_tokens)throw Error('endpoint_prompt_limit_unverified_or_exceeded');
  if(canonicalHash(endpointContract(endpoint))!==plan.endpoint_contract_hash)throw Error('endpoint_contract_changed');
  for(const field of ['model','tag','provider','context_length','physical_completion_max','prompt_cap','completion_cap','reserved_micros'])if(profile[field]!==plan.profile[field])throw Error('endpoint_contract_changed');
  const account=verifyAccount(fresh.key,fresh.credits,now,a.byok,comparisonModels('google/gemini-3-flash-preview'));
  if(account.key_identity_hash!==a.byok?.key_identity_hash)throw Error('dedicated_key_changed');
  const f=fresh.fixture;if(!f||String(f.fxid)!==plan.fixture.fixture_id||f.home!==plan.fixture.home||f.away!==plan.fixture.away||!['NS','SCHEDULED'].includes(f.status)||t(f.date+'T'+f.time+':00Z')!==ko)throw Error('fixture_eligibility_changed');
  const events=store.events(),holds=events.filter(e=>e.kind==='reservation'),retained=store.reservedMicros();
  if(events.some(e=>e.kind==='usage'&&e.body.halt===true)||holds.some(e=>e.body.integration==='openrouter-private-v1'&&e.body.key_identity_hash!==account.key_identity_hash)||retained<2753008)throw Error('ledger_history_key_or_halt_guard');
  const known=new Set(holds.filter(e=>e.body.integration==='openrouter-private-v1').map(e=>e.event_id)),reported=events.filter(e=>e.kind==='usage'&&e.body.status==='provider_response'&&known.has(e.parent_id)).reduce((n,e)=>n+dollarsToMicros(e.body.response.usage.cost),0);
  if(account.usage_micros>reported||account.usage_micros>retained)throw Error('unreconciled_account_usage');
  if(retained+(store.read(reservation)?0:plan.maximum_new_micros)>CEILING||account.remaining_micros<plan.maximum_new_micros||retained+(store.read(reservation)?0:plan.maximum_new_micros)>account.limit_micros)throw Error('shared_financial_headroom');
  const nextDay=new Date(Date.parse(now.slice(0,10)+'T00:00:00Z')+86400000).toISOString();
  const deadline=[t(nextDay),t(a.expires_at_utc),t(authorization.received_at)+600000000n,t(a.byok.recorded_at_utc)+600000000n,t(s.collection?.earliest_receipt_at_utc??s.source_read_at_utc)+900000000n,ko-450000000n,t(fresh.observed_at_utc)+120000000n,t(fresh.fixture_received_at_utc)+120000000n,t(fresh.runtime.checked_at_utc)+600000000n].reduce((a,b)=>a<b?a:b);
  return{now,account,runtime:fresh.runtime,dispatch_deadline_micros:deadline};
 };
 if(store.read(reservation))throw Error('request_already_attempted_never_redispatch');
 const first=await gate();
 const job=store.read(authorization.job_id),sourceEvent=job&&store.read(job.parent_id);if(!job||job.kind!=='job'||job.body.fixture_id!==plan.fixture.fixture_id||sourceEvent?.kind!=='packet'||canonicalHash(sourceEvent.body)!==plan.packet.source.source_hash||t(sourceEvent.received_at)!==t(plan.packet.source.received_at_utc))throw Error('immutable_job_binding');
 if(t(store.clock())>=first.dispatch_deadline_micros)throw Error('authorization_expired_before_atomic_reservation');
 store.reserveSingle(authorization_id,reservation,job.event_id,{reserved_micros:plan.maximum_new_micros,request_hash:plan.request_hash,integration:'openrouter-private-v1',key_identity_hash:first.account.key_identity_hash,profile:plan.profile,request:{body:plan.body,request_hash:plan.request_hash,arm:'A3'},authorization_id,readiness_id,gate_deadline_utc:new Date(Number(first.dispatch_deadline_micros/1000n)).toISOString()});
 store.append('usage',reservation+':dispatch',reservation,{status:'dispatched'});
 try{
  await checkpoint();const last=await gate();
  if(store.read(reservation+':commit')?.body?.status!=='accepted'||store.read(reservation+':dispatch')?.body?.status!=='dispatched')throw Error('immutable_dispatch_confirmation_missing');
  const permit=Object.freeze({kind:'a3-single-dispatch'});permits.set(permit,{used:false,genuine:plan.packet.source.classification==='a3_isolated_database_receipt'&&plan.engine_artifact.synthetic_clock===false,request_hash:plan.request_hash,body:plan.body,runtime:last.runtime,expires:authorization.body.expires_at_utc,beforeHttp:gate});
  const raw=await transport(permit);store.append('usage',reservation+':raw',reservation,{status:'provider_response',response:raw});
  if(!raw.usage||raw.usage.prompt_tokens>readiness.body.complete_input_upper_tokens||raw.usage.completion_tokens>plan.body.max_tokens||raw.usage.prompt_tokens+raw.usage.completion_tokens>plan.profile.context_length)throw Error('provider_usage_exceeds_reviewed_request_contract');
  const analysis=validateAnalysis(raw,plan.packet,plan.profile),now=store.clock();
  store.append('forecast',job.event_id+':A3',job.event_id,{arm:'A3',status:analysis.status,generated_at_utc:now,probabilities:analysis.probabilities,model:analysis.model,request_hash:plan.request_hash,source_hash:plan.packet.source.source_hash,packet_hash:plan.packet.packet_hash,prompt_hash:analysis.prompt_hash,schema_hash:analysis.schema_hash,generation_id:analysis.generation_id,provider_dispatch_verified:plan.packet.source.classification==='a3_isolated_database_receipt',analysis,risk:analysis.risk,uncertainty:analysis.uncertainty});
  store.append('usage',reservation+':result',reservation,{status:'response',response_hash:canonicalHash(raw)});await checkpoint();return analysis;
 }catch(error){
  store.append('usage',reservation+':halt',reservation,{status:'failed_or_ambiguous',halt:true,liability_retained:true});try{await checkpoint();}catch{}throw Error('single_request_stopped_retain_liability_no_retry');
 }
}
