import test from 'node:test';import assert from 'node:assert/strict';
import {source,RECEIPT} from '../test-support/a3-workflow.mjs';
import {syntheticSource} from '../a3-workflow/authority.mjs';import {buildPacket} from '../a3-workflow/contract.mjs';
import {freezeProfile} from '../phase8-continuation/contracts.mjs';import {catalog,key,credits} from '../test-support/openrouter-fixtures.mjs';
import {prepareOne,dispatchOne,consumePermit} from '../a3-supervised/controller.mjs';
import {singleTransport,assertGenuineTransport} from '../a3-supervised/transport.mjs';
import {decision,envelope} from '../test-support/a3-workflow.mjs';
import {collectOneFixture} from '../a3-supervised/source.mjs';
import {canonicalHash} from '../lib/snapshot-contract.mjs';
const AT='2026-10-27T12:00:00Z';
const singleCatalog=()=>{const c=catalog();c.data.endpoints[0].supports_implicit_caching=false;return c;};
function fixture(){const s=source();s.rows[1].date='2026-10-28';s.rows[0].date='2026-10-26';s.source_read_at_utc=AT;return s;}
function plan(){const s=fixture(),p=buildPacket(syntheticSource(s,AT),1),profile=freezeProfile(singleCatalog(),AT);return prepareOne(p,{build:355,source_sha256:'c915f9820c363786f4848ba6ba0f935a100a03f4507505c3b3bf029357e29b10',input_hash:canonicalHash({...s,receipt_at_utc:p.source.received_at_utc}),generated_at_utc:AT,synthetic_clock:true,predictions:[{fixture_id:'1',status:'forecast',eligible:true,probabilities:[.6,.25,.15],generated_at_utc:AT,kickoff_at_utc:p.fixture.kickoff_at_utc,home:p.fixture.home,away:p.fixture.away}]},profile,AT,{catalog:singleCatalog()});}
function memory(){const events=[];return{clock:()=>AT,read:()=>null,readAuthorization:()=>null,readReadiness:()=>null,append:(...x)=>events.push(x),events:()=>events,reservedMicros:()=>2753008};}
test('one-fixture preparation preserves independent packet and Build355 lineage without reserving',()=>{const p=plan();assert.equal(p.model,'openai/gpt-6-luna');assert.equal(p.maximum_new_micros,306000);assert.equal(p.body.max_tokens,4096);assert.equal(p.dispatch_authorized,false);assert.deepEqual(p.engine.probabilities,[.6,.25,.15]);assert.equal(p.fixture.fixture_id,'1');assert.ok(!p.body.messages[1].content.includes('probabilities'));});
test('missing final immutable operator authorization stops before reservation/checkpoint/transport',async()=>{const store=memory();let calls=0;await assert.rejects(()=>dispatchOne(plan(),{store,authorization_id:null,clock:()=>AT,checkpoint:()=>{calls++;},transport:()=>{calls++;}}),/authorization/);assert.equal(store.events().length,0);assert.equal(calls,0);});
test('caller supplied final-authorization flag or arbitrary plan cannot enable dispatch',async()=>{const store=memory();await assert.rejects(()=>dispatchOne({...plan(),dispatch_authorized:true},{store,authorization_id:'fake',final_authorized:true}),/plan/);assert.equal(store.events().length,0);});
for(const change of [e=>e.input_hash='a'.repeat(64),e=>e.build=356,e=>e.predictions[0].home='Reversed',e=>e.predictions[0].eligible=false,e=>e.predictions[0].probabilities=[.9,.9,.9]])test('independent engine lineage rejects alteration: '+String(change),()=>{const p=plan(),e=structuredClone(p.engine_artifact);change(e);assert.throws(()=>prepareOne(p.packet,e,p.profile,AT));});
test('readonly collection covers all fixed competitions and exact inventory, excludes odds/engine data',async()=>{
 const s=fixture(),calls=[];
 const read=(table,q)=>{calls.push({table,q});if(table==='competition_measures')return{rows:[],total:0,received_at_utc:AT,body_hash:canonicalHash([]),server_date:AT};if(q.fxid==='eq.1')return{rows:[s.rows[1]],total:1,received_at_utc:AT,body_hash:canonicalHash([s.rows[1]]),server_date:AT};const lid=Number(q.lid?.slice(3)),all=lid===39?s.rows:[];const rows=q.limit===0?[]:all.filter(x=>x.fxid>Number(q.fxid?.slice(3)??0)).sort((a,b)=>a.fxid-b.fxid);return{rows,total:all.length,received_at_utc:AT,body_hash:canonicalHash(rows),server_date:AT};};
 const r=await collectOneFixture(1,{read,clock:()=>AT});assert.equal(r.rows.length,2);assert.equal(r.scope_competition_ids.length,55);assert.equal(r.inventory.row_count,2);assert.deepEqual(r.odds,[]);assert.deepEqual(r.originals,[]);assert.ok(calls.every(c=>['fixtures','competition_measures'].includes(c.table)));assert.equal(r.synthetic,true);
});
function scenario(){
 const p=plan(),k=key();k.data.include_byok_in_limit=false;k.data.workspace_id='synthetic-workspace';
 const identity=canonicalHash({label:k.data.label,limit:5,reset:null}),state={now:AT,refreshes:0,calls:0,checkpoints:0};
 const authorization={job_id:'job',received_at:AT,body:{version:'a3-single-final-v1',fixture_id:'1',request_hash:p.request_hash,packet_hash:p.packet.packet_hash,model:p.model,provider:'OpenAI',max_new_micros:306000,operator_message_sha256:'a'.repeat(64),issuance_date_utc:'2026-10-27',expires_at_utc:'2026-10-27T12:10:00Z',byok:{version:'credit-only-operator-v1',workspace_id:'synthetic-workspace',key_identity_hash:identity,credential_count:0,confirmed_absent_providers:['OpenAI','Moonshot','Novita','Google','Google AI Studio'],recorded_at_utc:AT}}};
 const readiness={job_id:'job',received_at:AT,body:{version:'a3-reviewed-provider-bound-v1',request_hash:p.request_hash,profile_hash:p.profile.profile_hash,schema_hash:canonicalHash(p.body.response_format.json_schema.schema),complete_input_upper_tokens:10000,schema_contract_reviewed:true,output_contract_reviewed:true,review_artifact_sha256:'b'.repeat(64)}};
 const events=[{kind:'reservation',event_id:'old',body:{reserved_micros:2753008,integration:'openrouter-private-v1',key_identity_hash:identity}}],map=new Map([['job',{kind:'job',event_id:'job',parent_id:'packet',body:{fixture_id:'1'}}],['packet',{kind:'packet',event_id:'packet',received_at:p.packet.source.received_at_utc,body:fixture()}]]);
 let attempted=false;
 const store={clock:()=>state.now,assertLedgerAnchor:()=>true,hasSingleAttempt:()=>attempted,read:id=>map.get(id)??null,events:()=>events,reservedMicros:()=>events.filter(e=>e.kind==='reservation').reduce((n,e)=>n+e.body.reserved_micros,0),readAuthorization:()=>authorization,readReadiness:()=>readiness,append(kind,id,parent_id,body){const e={kind,event_id:id,parent_id,body};events.push(e);map.set(id,e);if(kind==='reservation')map.set(id+':commit',{body:{status:'accepted'}});},reserveSingle(auth,id,job,b){if(attempted)throw Error('already attempted');attempted=true;this.append('reservation',id,job,b);}};
 const refresh=async()=>{state.refreshes++;return{observed_at_utc:state.now,fixture_received_at_utc:state.now,runtime:{checked_at_utc:state.now,runtime:{observations_current:true,spec_revision:'1',observed_spec_revision:'1',network_policy:{mode:'restricted',state:'enforced',effective_allowed_hosts:['openrouter.ai']},secrets:[{name:'OPENROUTER_API_KEY',state:'ready'}]}},catalog:singleCatalog(),key:k,credits:credits(),fixture:{...fixture().rows[1]}};};
 const options={store,supervised:true,authorization_id:'operator',readiness_id:'review',checkpoint:async()=>{state.checkpoints++;},refresh,transport:async permit=>{const token=consumePermit(permit,state.now);await token.beforeHttp();state.calls++;return envelope(decision(p.packet),p.profile);}};
 return{p,state,options,authorization,readiness,store};
}
test('one authorized synthetic request retains its hold and complete records, never retries',async()=>{const s=scenario();const result=await dispatchOne(s.p,s.options);assert.equal(result.status,'forecast');assert.equal(s.state.calls,1);assert.equal(s.store.reservedMicros(),3059008);assert.equal(s.store.events().filter(e=>e.kind==='reservation').length,2);assert.equal(s.store.events().filter(e=>e.kind==='forecast').length,1);await assert.rejects(()=>dispatchOne(s.p,s.options),/never_redispatch/);assert.equal(s.state.calls,1);});
for(const mutate of [s=>s.authorization.body.request_hash='bad',s=>s.authorization.body.packet_hash='bad',s=>s.authorization.body.model='other',s=>s.authorization.body.max_new_micros=1,s=>s.authorization.body.expires_at_utc='2026-10-27T11:59:00Z',s=>s.readiness.body.complete_input_upper_tokens=922001,s=>s.readiness.body.schema_hash='bad',s=>s.authorization.body.byok.recorded_at_utc='2026-10-25T12:00:00Z'])test('failed independent admission has no new hold or HTTP: '+String(mutate),async()=>{const s=scenario();mutate(s);await assert.rejects(()=>dispatchOne(s.p,s.options));assert.equal(s.store.reservedMicros(),2753008);assert.equal(s.state.calls,0);});
test('expiry during pre-HTTP checkpoint retains liability and does not call provider',async()=>{const s=scenario();s.options.checkpoint=async()=>{s.state.now='2026-10-27T12:11:00Z';};await assert.rejects(()=>dispatchOne(s.p,s.options),/retain_liability/);assert.equal(s.store.reservedMicros(),3059008);assert.equal(s.state.calls,0);});
test('expiry while refreshing metadata is caught before a reservation',async()=>{const s=scenario(),refresh=s.options.refresh;s.options.refresh=async()=>{const result=await refresh();s.state.now='2026-10-27T12:11:00Z';return result;};await assert.rejects(()=>dispatchOne(s.p,s.options));assert.equal(s.store.reservedMicros(),2753008);assert.equal(s.state.calls,0);});
test('failed or ambiguous HTTP attempt is not retried and retains liability',async()=>{const s=scenario();s.options.transport=async permit=>{consumePermit(permit,s.state.now);s.state.calls++;throw Error('ambiguous');};await assert.rejects(()=>dispatchOne(s.p,s.options),/retain_liability/);assert.equal(s.state.calls,1);assert.equal(s.store.reservedMicros(),3059008);await assert.rejects(()=>dispatchOne(s.p,s.options));assert.equal(s.state.calls,1);});
for(const field of ['prompt_tokens','completion_tokens'])test('reported usage beyond the reviewed request bound halts without a forecast: '+field,async()=>{const s=scenario();s.options.transport=async permit=>{consumePermit(permit,s.state.now);const raw=envelope(decision(s.p.packet),s.p.profile);raw.usage[field]=field==='prompt_tokens'?10001:4097;return raw;};await assert.rejects(()=>dispatchOne(s.p,s.options),/retain_liability/);assert.equal(s.store.reservedMicros(),3059008);assert.equal(s.store.events().filter(e=>e.kind==='forecast').length,0);assert.equal(s.store.events().filter(e=>e.body?.status==='provider_response').length,1);});
test('real transport rejects arbitrary permit before external HTTP',async()=>{let calls=0;const send=singleTransport({credential:'synthetic',execute:()=>{calls++;}});await assert.rejects(()=>send({authorized:true}),/permit/);assert.equal(calls,0);});
test('injected provider execution cannot be certified as a genuine transport',()=>{assert.throws(()=>assertGenuineTransport(async()=>({model:'openai/gpt-6-luna'})),/genuine_bound/);assert.throws(()=>assertGenuineTransport(singleTransport({credential:'synthetic',execute:()=>''})),/genuine_bound/);});
test('a valid synthetic controller permit is explicitly ineligible for the real transport',async()=>{const s=scenario();s.options.transport=async permit=>{const p=consumePermit(permit,s.state.now);assert.equal(p.genuine,false);return envelope(decision(s.p.packet),s.p.profile);};await dispatchOne(s.p,s.options);});
test('consuming a permit cannot expose mutable state or permit a second consumption',async()=>{const s=scenario();s.options.transport=async permit=>{const p=consumePermit(permit,s.state.now);assert.throws(()=>{p.genuine=true;},TypeError);assert.throws(()=>{p.body.model='other';},TypeError);assert.throws(()=>consumePermit(permit,s.state.now),/permit/);return envelope(decision(s.p.packet),s.p.profile);};await dispatchOne(s.p,s.options);});
test('fresh endpoint telemetry does not change the pinned safety contract',async()=>{const s=scenario(),refresh=s.options.refresh;s.options.refresh=async()=>{const f=await refresh();Object.assign(f.catalog.data.endpoints[0],{latency_last_30m:Math.random(),uptime_last_30m:99.9,throughput_last_30m:123});return f;};await dispatchOne(s.p,s.options);assert.equal(s.state.calls,1);});
test('an absent shared-ledger ancestry stops even an otherwise approved plan before liability',async()=>{const s=scenario();s.store.assertLedgerAnchor=()=>{throw Error('accepted_shared_ledger_ancestry_missing_or_changed');};await assert.rejects(()=>dispatchOne(s.p,s.options),/ancestry/);assert.equal(s.state.calls,0);assert.equal(s.store.reservedMicros(),2753008);});
test('an existing attempt latch blocks a changed request hash before another reservation',async()=>{const s=scenario();s.store.hasSingleAttempt=()=>true;await assert.rejects(()=>dispatchOne(s.p,s.options),/already_attempted/);assert.equal(s.store.reservedMicros(),2753008);assert.equal(s.state.calls,0);});
test('expiry during synchronous final job reads is caught before reservation',async()=>{const s=scenario(),read=s.store.read;s.store.read=id=>{const r=read(id);if(id==='packet')s.state.now='2026-10-27T12:11:00Z';return r;};await assert.rejects(()=>dispatchOne(s.p,s.options),/expired/);assert.equal(s.store.reservedMicros(),2753008);});

// Regression: generic catches must retain safe phase evidence, never arbitrary messages.
test('pre-reservation rejection reports its safe phase without changing the ledger',async()=>{
 const s=scenario();s.options.authorization_id=null;
 await assert.rejects(()=>dispatchOne(s.p,s.options),e=>{
  assert.equal(e.diagnostic?.phase,'pre_reservation_validation');
  assert.equal(e.diagnostic?.code,'final_operator_authorization_required');
  assert.equal(e.diagnostic?.http_state,'not_started');return true;
 });assert.equal(s.store.reservedMicros(),2753008);
});
test('checkpoint creation failure is retained in the immutable halt without leaking error text',async()=>{
 const s=scenario();s.options.checkpoint=async()=>{throw Error('secret sk-private request-body sensitive');};
 await assert.rejects(()=>dispatchOne(s.p,s.options),e=>{assert.equal(e.diagnostic?.phase,'checkpoint_creation');return true;});
 const halt=s.store.events().find(e=>e.body?.halt===true);
 assert.equal(halt.body.diagnostic.phase,'checkpoint_creation');
 assert.equal(halt.body.diagnostic.code,'unclassified_failure');
 assert.equal(halt.body.diagnostic.http_state,'not_started');
 assert.ok(!JSON.stringify(halt).includes('sk-private'));assert.equal(s.state.calls,0);
});
test('a live but insufficient authorization window stops before reservation and transport',async()=>{
 const s=scenario();s.authorization.body.expires_at_utc='2026-10-27T12:00:30Z';
 await assert.rejects(()=>dispatchOne(s.p,s.options),/insufficient_pre_http_window/);
 assert.equal(s.store.reservedMicros(),2753008);assert.equal(s.state.calls,0);assert.equal(s.state.checkpoints,0);
});
test('post-response checkpoint failure is distinguished from AI validation failure',async()=>{
 const s=scenario();s.options.checkpoint=async()=>{if(++s.state.checkpoints===2)throw Error('private filesystem path');};
 await assert.rejects(()=>dispatchOne(s.p,s.options),e=>{assert.equal(e.diagnostic?.phase,'post_response_checkpoint');return true;});
 assert.equal(s.store.events().find(e=>e.body?.halt===true).body.diagnostic.phase,'post_response_checkpoint');
 assert.equal(s.store.events().filter(e=>e.kind==='forecast').length,1);assert.equal(s.state.calls,1);
});
test('separate checkpoint verification failure is identified before any provider call',async()=>{
 const s=scenario();s.options.verifyCheckpoint=async()=>{throw Error('checksum mismatch private path');};
 await assert.rejects(()=>dispatchOne(s.p,s.options),e=>{assert.equal(e.diagnostic?.phase,'checkpoint_verification');assert.equal(e.diagnostic.halt_checkpoint_failed,true);return true;});
 assert.equal(s.state.calls,0);assert.equal(s.store.reservedMicros(),3059008);
});
test('offline staged wrapper records complete safe phases without collecting or authorizing',async t=>{
 const {stageExecution}=await import('../a3-supervised/execution.mjs');
 const {mkdtempSync,readFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');
 const dir=mkdtempSync(tmpdir()+'/mm-staged-');t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const s=scenario();let now='2026-10-27T11:59:59Z',verified=0;
 const wrapper=stageExecution({directory:dir,clock:()=>now,checkpoint:s.options.checkpoint,verifyCheckpoint:()=>{verified++;},refresh:s.options.refresh,transport:s.options.transport});
 assert.equal(s.store.events().length,1);assert.equal(s.state.refreshes,0);assert.equal(s.state.calls,0);
 now=AT;await wrapper.run(s.p,{store:s.store,authorization_id:'operator',readiness_id:'review',supervised:true});
 const rows=readFileSync(dir+'/diagnostics.jsonl','utf8').trim().split('\n').map(JSON.parse);
 assert.ok(rows.some(r=>r.phase==='checkpoint_verification'));assert.ok(rows.some(r=>r.phase==='ai_validation'));
 assert.equal(verified,2);assert.equal(rows[0].wrapper_stage_sha256,wrapper.receipt_hash);assert.equal(s.state.calls,1);
});
test('a wrapper staged after source availability fails closed before liability',async t=>{
 const {stageExecution}=await import('../a3-supervised/execution.mjs');const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');
 const dir=mkdtempSync(tmpdir()+'/mm-staged-');t.after(()=>rmSync(dir,{recursive:true,force:true}));const s=scenario();
 const wrapper=stageExecution({directory:dir,clock:()=>AT,checkpoint:s.options.checkpoint,verifyCheckpoint:()=>{},refresh:s.options.refresh,transport:s.options.transport});
 await assert.rejects(()=>wrapper.run(s.p,{store:s.store,authorization_id:'operator',readiness_id:'review',supervised:true}),/not_staged_before/);
 assert.equal(s.state.calls,0);assert.equal(s.store.reservedMicros(),2753008);
});
for(const [name,mutate,phase] of [
 ['reservation rejected',s=>s.store.reserveSingle=()=>{throw Error('private SQL');},'reservation_and_confirmation'],
 ['confirmation committed but caller response failed',s=>{const reserve=s.store.reserveSingle.bind(s.store);s.store.reserveSingle=(...args)=>{reserve(...args);throw Error('private SQL response');};},'reservation_and_confirmation'],
 ['dispatch-intent persistence failed',s=>{const append=s.store.append.bind(s.store);s.store.append=(kind,id,parent,body)=>{if(id.endsWith(':dispatch'))throw Error('private SQL');return append(kind,id,parent,body);};},'reservation_and_confirmation'],
 ['final admission after checkpoint failed',s=>{const refresh=s.options.refresh;s.options.refresh=async()=>{if(s.state.checkpoints)throw Error('private account');return refresh();};},'final_provider_admission'],
 ['AI response rejected',s=>s.options.transport=async permit=>{consumePermit(permit,s.state.now);const r=envelope(decision(s.p.packet),s.p.profile);r.choices[0].finish_reason='length';return r;},'ai_validation']
])test('original failure stage survives: '+name,async()=>{
 const s=scenario();mutate(s);await assert.rejects(()=>dispatchOne(s.p,s.options),e=>{assert.equal(e.diagnostic.phase,phase);assert.ok(!JSON.stringify(e.diagnostic).includes('private'));return true;});assert.equal(s.state.calls,0);
 const held=s.store.reservedMicros()>2753008;
 if(held){assert.equal(s.store.events().filter(e=>e.body?.halt).length,1);await assert.rejects(()=>dispatchOne(s.p,s.options));}
});
test('six-minute margin is strict and is rechecked after initial metadata refresh',async()=>{
 const s=scenario();s.state.now='2026-10-27T12:04:00Z';await assert.rejects(()=>dispatchOne(s.p,s.options),/insufficient_pre_http_window/);assert.equal(s.store.reservedMicros(),2753008);
 const a=scenario();a.state.now='2026-10-27T12:03:59.999Z';await dispatchOne(a.p,a.options);assert.equal(a.state.calls,1);
 const b=scenario(),refresh=b.options.refresh;b.options.refresh=async()=>{const fresh=await refresh();b.state.now='2026-10-27T12:04:00Z';fresh.observed_at_utc=b.state.now;fresh.fixture_received_at_utc=b.state.now;fresh.runtime.checked_at_utc=b.state.now;return fresh;};
 await assert.rejects(()=>dispatchOne(b.p,b.options),/insufficient_pre_http_window/);assert.equal(b.store.reservedMicros(),2753008);
});
test('initial diagnostic failure cannot reserve and is explicitly reported',async()=>{
 const s=scenario();s.options.recordDiagnostic=()=>{throw Error('secret fs failure');};await assert.rejects(()=>dispatchOne(s.p,s.options),e=>{assert.equal(e.diagnostic.diagnostic_write_failed,true);return true;});assert.equal(s.store.reservedMicros(),2753008);assert.equal(s.state.calls,0);
});
test('a forged staging capability cannot enable a request',async()=>{
 const s=scenario();s.options.executionStage={version:'a3-offline-wrapper-v1'};await assert.rejects(()=>dispatchOne(s.p,s.options),/not_staged_before/);assert.equal(s.store.reservedMicros(),2753008);
});
test('wrapper receipt tampering and dependency replacement stop before any paid operation',async t=>{
 const {stageExecution}=await import('../a3-supervised/execution.mjs'),{mkdtempSync,writeFileSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os');
 for(const mode of ['tampered','override']){const dir=mkdtempSync(tmpdir()+'/mm-stage-');t.after(()=>rmSync(dir,{recursive:true,force:true}));const s=scenario();
  const wrapper=stageExecution({directory:dir,clock:()=> '2026-10-27T11:59:59Z',checkpoint:s.options.checkpoint,verifyCheckpoint:()=>{},refresh:s.options.refresh,transport:s.options.transport});
  if(mode==='tampered')writeFileSync(dir+'/wrapper-stage.json','{}');
  await assert.rejects(()=>wrapper.run(s.p,{store:s.store,authorization_id:'operator',readiness_id:'review',supervised:true,...(mode==='override'?{refresh:()=>{throw Error('must not call');}}:{})}),/artifact_changed|cannot_be_overridden/);
  assert.equal(s.store.reservedMicros(),2753008);assert.equal(s.state.calls,0);
  await assert.rejects(()=>wrapper.run(s.p,{}),/already_used/);
 }
});
test('staged source hash bindings cannot be mutated through the returned receipt',async t=>{
 const {stageExecution}=await import('../a3-supervised/execution.mjs'),{mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os');
 const dir=mkdtempSync(tmpdir()+'/mm-stage-');t.after(()=>rmSync(dir,{recursive:true,force:true}));const s=scenario();
 const wrapper=stageExecution({directory:dir,clock:()=> '2026-10-27T11:59:59Z',checkpoint:s.options.checkpoint,verifyCheckpoint:()=>{},refresh:s.options.refresh,transport:s.options.transport});
 assert.throws(()=>{wrapper.receipt.artifacts['controller.mjs']='forged';},TypeError);
});
test('late preparation stops before opening another authorization window',()=>{
 const p=plan();assert.throws(()=>prepareOne(p.packet,p.engine_artifact,p.profile,'2026-10-27T12:10:00Z',{catalog:singleCatalog()}),/insufficient_pre_http_window/);
});
