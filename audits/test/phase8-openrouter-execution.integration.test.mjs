import test,{before,after} from 'node:test';import assert from 'node:assert/strict';
import {localDatabase} from '../test-support/local-db.mjs';import {repository} from '../phase6/repository.mjs';import {weekendStore} from '../phase8/store.mjs';
import {freezeProfile,buildRequest,verifyAccount} from '../phase8-continuation/contracts.mjs';
import {catalog,key,credits} from '../test-support/openrouter-fixtures.mjs';
const api=await import('../phase8-continuation/execute.mjs').catch(()=>({}));
const db=localDatabase('openrouter-execution');let store,job,p,request;
before(async()=>{await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);repository(db).install();store=weekendStore(db);store.install();const s=store.append('study','or-synthetic',null,{version:'weekend-v1',windows:['2026-10-24','2026-10-25'],kind:'synthetic_verification'}),pk=store.append('packet','or-packet',s,{synthetic:true});job=store.append('job','or-job',pk,{fixture_id:'1',kickoff_at_utc:new Date(Date.now()+3600000).toISOString(),original:null,provider_model:'openai/gpt-6-luna'});p=freezeProfile(catalog(),store.clock());request=buildRequest('A3',p,{fixture_id:'1',home:'A',away:'B',receipt_at_utc:store.clock(),facts:[{ref:'r',data:{synthetic:true}}]},store.clock());});
after(()=>db.close());
const account=()=>verifyAccount(key(),credits(),store.clock());
function response(){return{id:'gen-synthetic',model:p.model,provider:p.provider,usage:{prompt_tokens:10,completion_tokens:20,cost:.001},choices:[{finish_reason:'stop',message:{content:JSON.stringify({abstain:false,reason:'supported',evidence_refs:['r'],probabilities:[.4,.3,.3]})}}]};}
test('a paid attempt is committed and checkpointed before one dispatch; duplicate cannot call again',async()=>{
 assert.equal(typeof api.executeRequest,'function');const order=[];
 const opts={kind:'synthetic_verification',account:account(),checkpoint:async()=>{order.push('checkpoint');},transport:async body=>{order.push('http');assert.equal(body.model,p.model);return response();}};
 const r=await api.executeRequest(store,{id:'or-1',job,request,profile:p},opts);assert.equal(r.status,'response');assert.deepEqual(order,['checkpoint','http','checkpoint']);assert.equal(store.reservedMicros(),306000);
 await assert.rejects(()=>api.executeRequest(store,{id:'or-1',job,request,profile:p},opts),/duplicate|conflict/);assert.equal(order.filter(x=>x==='http').length,1);
});
test('checkpoint failure and provider timeouts retain full liability and never automatically retry',async()=>{
 assert.equal(typeof api.executeRequest,'function');let http=0;
 await assert.rejects(()=>api.executeRequest(store,{id:'or-checkpoint',job,request,profile:p},{kind:'synthetic_verification',account:account(),checkpoint:async()=>{throw Error('disk full');},transport:async()=>{http++;}}),/checkpoint/);assert.equal(http,0);assert.equal(store.reservedMicros(),612000);
 const r=await api.executeRequest(store,{id:'or-timeout',job,request,profile:p},{kind:'synthetic_verification',account:account(),checkpoint:async()=>{},transport:async()=>{http++;throw Error('sensitive network details');}});
 assert.equal(r.status,'failed');assert.equal(r.reason,'provider_or_response_failure');assert.equal(JSON.stringify(r).includes('sensitive'),false);assert.equal(http,1);assert.equal(store.reservedMicros(),918000);
});
test('foreign key identity, stale account evidence, missing runtime and changed request prevent dispatch',async()=>{
 assert.equal(typeof api.executeRequest,'function');let calls=0;const options={kind:'football',account:account(),checkpoint:async()=>{},transport:async()=>{calls++;return response();}};
 await assert.rejects(()=>api.executeRequest(store,{id:'or-no-runtime',job,request,profile:p},options),/runtime|supervised/);
 await assert.rejects(()=>api.executeRequest(store,{id:'or-altered',job,request:{...request,body:{...request.body,tools:[{type:'web_search'}]}},profile:p},{...options,kind:'synthetic_verification'}),/hash|request/);
 await assert.rejects(()=>api.executeRequest(store,{id:'or-key-change',job,request,profile:p},{...options,kind:'synthetic_verification',account:{...account(),key_identity_hash:'f'.repeat(64)}}),/key/);
 assert.equal(calls,0);
});
test('restored shared ledger retains both legacy and OpenRouter liability and all immutable original records',()=>{
 const dump=db.dump(),events=store.events();db.restore(dump);const restored=weekendStore({name:db.name,sql:s=>db.sql(s,'matchmind_restore')});assert.equal(restored.reservedMicros(),918000);assert.deepEqual(restored.events(),events);
 assert.throws(()=>db.sql("SET ROLE authenticated;SELECT *FROM shadow_eval.weekend_events",'matchmind_restore'),/permission/);
 assert.equal(db.sql('SELECT count(*)FROM public.predictions'),'0');
});
