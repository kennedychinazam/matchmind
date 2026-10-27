import test from 'node:test';import assert from 'node:assert/strict';
import {source,decision,envelope} from '../test-support/a3-workflow.mjs';
import {syntheticSource} from '../a3-workflow/authority.mjs';import {buildPacket} from '../a3-workflow/contract.mjs';
import {PROMPT_HASH,SCHEMA_HASH} from '../a3-workflow/workflow.mjs';
import {catalog,key,credits} from '../test-support/openrouter-fixtures.mjs';import {freezeProfile} from '../phase8-continuation/contracts.mjs';
import {canonicalHash} from '../lib/snapshot-contract.mjs';import {prepareOne,dispatchOne,consumePermit} from '../a3-supervised/controller.mjs';
const AT='2026-10-27T12:00:00Z',KO='2026-10-28T22:30:00Z',EXPERIMENT='santos-palmeiras-1492438-20261028-a3-capacity-risk-v1';
const cat=()=>{const c=catalog();c.data.endpoints[0].supports_implicit_caching=false;return c;};
function fixture(override={}){const s=source();s.source_read_at_utc=AT;s.rows=s.rows.map((r,i)=>({...r,fxid:i===1?1492438:2,lid:71,home:'Santos',away:'Palmeiras',lname:'Brasileirao Serie A',lcountry:'Brazil',date:i===1?'2026-10-28':'2026-10-26',time:i===1?'22:30':'14:00',...(i===1?override:{})}));s.targets=[s.rows[1].fxid];return s;}
function scenario(override={}){
 const src=fixture(override),packet=buildPacket(syntheticSource(src,AT),src.targets[0]),profile=freezeProfile(cat(),AT);
 const p=prepareOne(packet,{build:355,source_sha256:'c915f9820c363786f4848ba6ba0f935a100a03f4507505c3b3bf029357e29b10',input_hash:canonicalHash({...src,receipt_at_utc:packet.source.received_at_utc}),synthetic_clock:true,predictions:[{fixture_id:packet.fixture.fixture_id,status:'forecast',eligible:true,probabilities:[.6,.25,.15],generated_at_utc:AT,kickoff_at_utc:packet.fixture.kickoff_at_utc,home:packet.fixture.home,away:packet.fixture.away}]},profile,AT,{catalog:cat()});
 const k=key(),identity=canonicalHash({label:k.data.label,limit:5,reset:null});k.data.include_byok_in_limit=false;k.data.workspace_id='synthetic-workspace';
 const state={now:AT,calls:0,checkpoints:0,attempt:false,capacityAttempt:null};
 const body={version:'a3-capacity-risk-exception-v1',experiment_id:EXPERIMENT,director_approved:true,director_approval_sha256:'d'.repeat(64),study_id:'study',job_id:'job',fixture_id:'1492438',kickoff_at_utc:KO,issuance_date_utc:'2026-10-27',expires_at_utc:'2026-10-27T12:10:00Z',request_hash:p.request_hash,request_body_hash:canonicalHash(p.body),packet_hash:packet.packet_hash,prompt_hash:PROMPT_HASH,schema_hash:SCHEMA_HASH,profile_hash:profile.profile_hash,endpoint_contract_hash:p.endpoint_contract_hash,model:p.model,provider:'OpenAI',backend:'openai',input_bytes:Buffer.byteLength(JSON.stringify(p.body)),complete_input_upper_tokens:null,capacity_status:'unverified',provider_input_cap_tokens:922000,context_tokens:1050000,physical_output_tokens:128000,output_tokens:4096,schema_contract_reviewed:true,output_contract_reviewed:true,review_artifact_sha256:'e'.repeat(64)};
 const exception={receipt_id:'exception',kind:'capacity_exception',study_id:'study',job_id:'job',received_at:AT,body_hash:canonicalHash(body),body};
 const authorization={job_id:'job',received_at:AT,body:{version:'a3-single-final-v1',fixture_id:'1492438',request_hash:p.request_hash,packet_hash:packet.packet_hash,model:p.model,provider:'OpenAI',max_new_micros:306000,operator_message_sha256:'a'.repeat(64),issuance_date_utc:'2026-10-27',expires_at_utc:'2026-10-27T12:10:00Z',capacity_exception_id:'exception',capacity_exception_body_hash:exception.body_hash,capacity_status:'unverified',byok:{version:'credit-only-operator-v1',workspace_id:'synthetic-workspace',key_identity_hash:identity,credential_count:0,confirmed_absent_providers:['OpenAI','Moonshot','Novita','Google','Google AI Studio'],recorded_at_utc:AT}}};
 const events=[{kind:'reservation',event_id:'old',body:{reserved_micros:2753008,integration:'openrouter-private-v1',key_identity_hash:identity}}],map=new Map([['job',{kind:'job',event_id:'job',parent_id:'packet',body:{fixture_id:'1492438'}}],['packet',{kind:'packet',event_id:'packet',parent_id:'study',received_at:AT,body:src}]]);
 const store={clock:()=>state.now,assertLedgerAnchor:()=>true,hasSingleAttempt:()=>state.attempt,hasCapacityAttempt:()=>state.capacityAttempt!==null,read:id=>map.get(id)??null,readAuthorization:()=>authorization,readReadiness:()=>null,readCapacityException:id=>id==='exception'?exception:null,events:()=>events,reservedMicros:()=>events.filter(e=>e.kind==='reservation').reduce((n,e)=>n+e.body.reserved_micros,0),append(kind,id,parent_id,b){const e={kind,event_id:id,parent_id,body:b};events.push(e);map.set(id,e);},reserveCapacity(auth,id,job,b){assert.equal(state.capacityAttempt,null);state.capacityAttempt=id;state.attempt=true;this.append('reservation',id,job,b);map.set(id+':commit',{body:{status:'accepted'}});}};
 const options={store,authorization_id:'final',capacity_exception_id:'exception',supervised:true,checkpoint:async()=>{state.checkpoints++;},refresh:async()=>({observed_at_utc:state.now,fixture_received_at_utc:state.now,runtime:{checked_at_utc:state.now,runtime:{observations_current:true,spec_revision:'1',observed_spec_revision:'1',network_policy:{mode:'restricted',state:'enforced',effective_allowed_hosts:['openrouter.ai']},secrets:[{name:'OPENROUTER_API_KEY',state:'ready'}]}},catalog:cat(),key:k,credits:credits(),fixture:src.rows[1]}),transport:async permit=>{const v=consumePermit(permit,state.now);await v.beforeHttp();state.calls++;return envelope(decision(packet),profile);}};
 return{p,options,store,state,exception,authorization};
}
test('explicit single Santos exception records unknown capacity without a fake bound or extra request',async()=>{
 const s=scenario(),result=await dispatchOne(s.p,s.options);assert.equal(result.status,'forecast');assert.equal(s.state.calls,1);assert.equal(s.state.checkpoints,2);assert.equal(s.store.reservedMicros(),3059008);
 const f=s.store.events().find(e=>e.kind==='forecast');assert.equal(f.body.capacity_status,'unverified');assert.equal(f.body.complete_input_upper_tokens,null);assert.equal(f.body.capacity_exception_id,'exception');
 await assert.rejects(()=>dispatchOne(s.p,s.options),/attempted|redispatch/);assert.equal(s.state.calls,1);
});
for(const override of [{fxid:1},{home:'Palmeiras',away:'Santos'},{lid:39},{date:'2026-10-29'},{time:'22:31'}])test('a fully bound exception cannot expand the intended target: '+JSON.stringify(override),async()=>{
 const s=scenario(override);s.exception.body.fixture_id=s.p.fixture.fixture_id;s.exception.body.kickoff_at_utc=s.p.fixture.kickoff_at_utc;s.authorization.body.fixture_id=s.p.fixture.fixture_id;
 await assert.rejects(()=>dispatchOne(s.p,s.options));assert.equal(s.state.calls,0);assert.equal(s.store.reservedMicros(),2753008);
});
test('a newly dated exception and approval cannot renew expired source evidence',async()=>{
 const s=scenario();s.state.now='2026-10-27T12:16:00Z';s.authorization.received_at=s.state.now;s.authorization.body.byok.recorded_at_utc=s.state.now;s.exception.received_at=s.state.now;s.exception.body.expires_at_utc=s.authorization.body.expires_at_utc='2026-10-27T12:20:00Z';
 await assert.rejects(()=>dispatchOne(s.p,s.options),/fresh_complete_history/);assert.equal(s.state.calls,0);assert.equal(s.store.reservedMicros(),2753008);
});
test('a changed endpoint prompt limit cannot bypass the fixed capacity-exception contract',async()=>{
 const s=scenario(),refresh=s.options.refresh;s.options.refresh=async()=>{const f=await refresh();f.catalog.data.endpoints[0].max_prompt_tokens=922001;return f;};
 await assert.rejects(()=>dispatchOne(s.p,s.options),/endpoint/);assert.equal(s.store.reservedMicros(),2753008);assert.equal(s.state.calls,0);
});
for(const [name,mutate] of Object.entries({
 'missing final authorization':s=>s.options.authorization_id=null,
 'unknown exception':s=>s.options.capacity_exception_id='unknown',
 'ambiguous normal and exception receipts':s=>s.options.readiness_id='review',
 'caller flag only':s=>{delete s.options.capacity_exception_id;s.options.capacity_risk_approved=true;},
 'wrong receipt kind':s=>s.exception.kind='readiness',
 'unapproved Director decision':s=>s.exception.body.director_approved=false,
 'missing approval hash':s=>delete s.exception.body.director_approval_sha256,
 'wrong experiment':s=>s.exception.body.experiment_id='another',
 'wrong fixture':s=>s.exception.body.fixture_id='1',
 'wrong study':s=>s.exception.body.study_id='other',
 'wrong job':s=>s.exception.body.job_id='other',
 'wrong request':s=>s.exception.body.request_hash='f'.repeat(64),
 'wrong body':s=>s.exception.body.request_body_hash='f'.repeat(64),
 'wrong packet':s=>s.exception.body.packet_hash='f'.repeat(64),
 'wrong prompt':s=>s.exception.body.prompt_hash='f'.repeat(64),
 'wrong schema':s=>s.exception.body.schema_hash='f'.repeat(64),
 'wrong profile':s=>s.exception.body.profile_hash='f'.repeat(64),
 'wrong endpoint':s=>s.exception.body.endpoint_contract_hash='f'.repeat(64),
 'wrong model':s=>s.exception.body.model='other',
 'wrong provider':s=>s.exception.body.provider='Azure',
 'wrong backend':s=>s.exception.body.backend='openai/flex',
 'wrong kickoff':s=>s.exception.body.kickoff_at_utc='2026-10-28T22:31:00Z',
 'wrong issuance date':s=>s.exception.body.issuance_date_utc='2026-10-28',
 'expired exception':s=>s.exception.body.expires_at_utc=AT,
 'future receipt':s=>s.exception.received_at='2026-10-27T12:01:00Z',
 'overlong exception lifetime':s=>s.exception.body.expires_at_utc='2026-10-27T12:11:00Z',
 'fabricated input count':s=>s.exception.body.complete_input_upper_tokens=355927,
 'omitted null input count':s=>delete s.exception.body.complete_input_upper_tokens,
 'false verified capacity':s=>s.exception.body.capacity_status='verified',
 'wrong byte size':s=>s.exception.body.input_bytes++,
 'wrong prompt limit':s=>s.exception.body.provider_input_cap_tokens=1000000,
 'wrong context limit':s=>s.exception.body.context_tokens=2000000,
 'wrong physical output limit':s=>s.exception.body.physical_output_tokens=64000,
 'wrong output allocation':s=>s.exception.body.output_tokens=8192,
 'unreviewed schema':s=>s.exception.body.schema_contract_reviewed=false,
 'unreviewed output':s=>s.exception.body.output_contract_reviewed=false,
 'unrecognized extra field':s=>s.exception.body.bypass=true,
 'final approval lacks risk acceptance':s=>delete s.authorization.body.capacity_exception_id,
 'final approval changed receipt hash':s=>s.authorization.body.capacity_exception_body_hash='f'.repeat(64),
 'final approval falsely claims verified capacity':s=>s.authorization.body.capacity_status='verified',
 'expired BYOK':s=>s.authorization.body.byok.recorded_at_utc='2026-10-26T12:00:00Z',
 'financial ceiling reached':s=>s.store.events()[0].body.reserved_micros=5000000,
 'prior global halt':s=>s.store.events().push({kind:'usage',body:{halt:true}}),
 'reused experiment in another study':s=>s.state.capacityAttempt='previous-reservation',
})){test('exception fails before synthetic liability or transport: '+name,async()=>{const s=scenario();mutate(s);const before=s.store.reservedMicros();await assert.rejects(()=>dispatchOne(s.p,s.options));assert.equal(s.state.calls,0);assert.equal(s.state.checkpoints,0);assert.equal(s.store.reservedMicros(),before);});}
for(const [name,change] of Object.entries({runtime:f=>f.runtime.runtime.network_policy.mode='unrestricted',fixture:f=>f.fixture.status='LIVE',backend:f=>f.catalog.data.endpoints[0].tag='openai/flex',billing:f=>{f.key.data.usage=.1;f.key.data.limit_remaining=4.9;}}))test('capacity exception cannot bypass fresh '+name+' admission',async()=>{
 const s=scenario(),refresh=s.options.refresh;s.options.refresh=async()=>{const f=await refresh();change(f);return f;};await assert.rejects(()=>dispatchOne(s.p,s.options));assert.equal(s.state.calls,0);assert.equal(s.store.reservedMicros(),2753008);
});
for(const [name,mutate] of Object.entries({
 'exception expires during checkpoint':s=>s.options.checkpoint=async()=>{s.state.now='2026-10-27T12:10:00Z';},
 'checkpoint fails':s=>s.options.checkpoint=async()=>{throw Error('synthetic checkpoint failure');},
 'exception expires immediately before HTTP':s=>s.options.transport=async permit=>{const v=consumePermit(permit,s.state.now);s.state.now='2026-10-27T12:10:00Z';await v.beforeHttp();s.state.calls++;},
 'HTTP is ambiguous':s=>s.options.transport=async permit=>{consumePermit(permit,s.state.now);s.state.calls++;throw Error('synthetic ambiguity');},
 'provider rejects':s=>s.options.transport=async permit=>{consumePermit(permit,s.state.now);s.state.calls++;throw Error('synthetic HTTP400');},
 'usage exceeds endpoint prompt':s=>s.options.transport=async permit=>{consumePermit(permit,s.state.now);const r=envelope(decision(s.p.packet),s.p.profile);r.usage.prompt_tokens=922001;return r;},
 'usage exceeds output cap':s=>s.options.transport=async permit=>{consumePermit(permit,s.state.now);const r=envelope(decision(s.p.packet),s.p.profile);r.usage.completion_tokens=4097;return r;},
 'invalid usage count':s=>s.options.transport=async permit=>{consumePermit(permit,s.state.now);const r=envelope(decision(s.p.packet),s.p.profile);r.usage.prompt_tokens=-1;return r;},
 'truncated response':s=>s.options.transport=async permit=>{consumePermit(permit,s.state.now);const r=envelope(decision(s.p.packet),s.p.profile);r.choices[0].finish_reason='length';return r;},
})){test('exception failure retains synthetic liability, halts and prevents redispatch: '+name,async()=>{const s=scenario();mutate(s);await assert.rejects(()=>dispatchOne(s.p,s.options),/retain_liability/);assert.equal(s.store.reservedMicros(),3059008);assert.equal(s.store.events().filter(e=>e.kind==='forecast').length,0);assert.equal(s.store.events().filter(e=>e.body?.halt===true).length,1);const calls=s.state.calls;await assert.rejects(()=>dispatchOne(s.p,s.options));assert.equal(s.state.calls,calls);});}
test('synthetic usage at the declared prompt cap is observed without certifying input capacity',async()=>{
 const s=scenario();s.options.transport=async permit=>{consumePermit(permit,s.state.now);const r=envelope(decision(s.p.packet),s.p.profile);r.usage.prompt_tokens=922000;return r;};await dispatchOne(s.p,s.options);
 const f=s.store.events().find(e=>e.kind==='forecast');assert.equal(f.body.capacity_status,'unverified');assert.equal(f.body.complete_input_upper_tokens,null);
});
test('post-response checkpoint failure retains the raw response and immutable forecast without retry',async()=>{
 const s=scenario();s.options.checkpoint=async()=>{if(++s.state.checkpoints===2)throw Error('synthetic post-response backup failure');};await assert.rejects(()=>dispatchOne(s.p,s.options),/retain_liability/);
 assert.equal(s.state.calls,1);assert.equal(s.store.reservedMicros(),3059008);assert.equal(s.store.events().filter(e=>e.body?.status==='provider_response').length,1);assert.equal(s.store.events().filter(e=>e.kind==='forecast').length,1);assert.equal(s.store.events().filter(e=>e.body?.halt===true).length,1);await assert.rejects(()=>dispatchOne(s.p,s.options));assert.equal(s.state.calls,1);
});
test('an abstention remains an abstention and consumes the single synthetic attempt',async()=>{
 const s=scenario();s.options.transport=async permit=>{consumePermit(permit,s.state.now);s.state.calls++;const d=decision(s.p.packet);Object.assign(d,{abstain:true,reason:'missing_evidence',probabilities:null,analysis:[],evidence_refs:[],risk:{status:'insufficient_evidence',explanation:'Essential evidence remains incomplete.',evidence_refs:[]}});return envelope(d,s.p.profile);};
 const r=await dispatchOne(s.p,s.options);assert.equal(r.status,'abstain');assert.equal(r.probabilities,null);await assert.rejects(()=>dispatchOne(s.p,s.options));assert.equal(s.state.calls,1);
});
