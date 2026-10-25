import test,{beforeEach,afterEach} from 'node:test';import assert from 'node:assert/strict';
import {localDatabase} from '../test-support/local-db.mjs';import {repository} from '../phase6/repository.mjs';import {weekendStore} from '../phase8/store.mjs';
import {freezeProfile,buildRequest,verifyAccount} from '../phase8-continuation/contracts.mjs';
import {catalog,key,credits} from '../test-support/openrouter-fixtures.mjs';
const api=await import('../phase8-continuation/execute.mjs').catch(()=>({}));
const local=await import('../phase8-continuation/local.mjs').catch(()=>({}));
let db,store,job,p,request,cycle=0;
beforeEach(async()=>{db=localDatabase('openrouter-execution-'+(++cycle));await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);repository(db).install();store=weekendStore(db);store.install();const s=store.append('study','or-synthetic',null,{version:'weekend-v1',windows:['2026-10-24','2026-10-25'],kind:'synthetic_verification'}),pk=store.append('packet','or-packet',s,{synthetic:true});job=store.append('job','or-job',pk,{fixture_id:'1',kickoff_at_utc:new Date(Date.now()+3600000).toISOString(),original:null,provider_model:'openai/gpt-6-luna'});p=freezeProfile(catalog(),store.clock());request=buildRequest('A3',p,{fixture_id:'1',home:'A',away:'B',receipt_at_utc:store.clock(),facts:[{ref:'r',data:{synthetic:true}}]},store.clock());});
afterEach(()=>db.close());
const account=()=>verifyAccount(key(),credits(),store.clock());
function response(){return{id:'gen-synthetic',model:p.model,provider:p.provider,usage:{prompt_tokens:10,completion_tokens:20,cost:.001},choices:[{finish_reason:'stop',message:{content:JSON.stringify({abstain:false,reason:'supported',evidence_refs:['r'],probabilities:[.4,.3,.3]})}}]};}
test('a paid attempt is committed and checkpointed before one dispatch; duplicate cannot call again',async()=>{
 assert.equal(typeof api.executeRequest,'function');const order=[];
 const opts={kind:'synthetic_verification',account:account(),checkpoint:async()=>{order.push('checkpoint');},transport:async body=>{order.push('http');assert.equal(body.model,p.model);return response();}};
 const r=await api.executeRequest(store,{id:'or-1',job,request,profile:p},opts);assert.equal(r.status,'response');assert.deepEqual(order,['checkpoint','http','checkpoint']);assert.equal(store.reservedMicros(),306000);
 await assert.rejects(()=>api.executeRequest(store,{id:'or-1',job,request,profile:p},opts),/duplicate|conflict/);assert.equal(order.filter(x=>x==='http').length,1);
});
test('provider timeouts retain liability; checkpoint failure durably prevents subsequent dispatch',async()=>{
 assert.equal(typeof api.executeRequest,'function');let http=0;
 const r=await api.executeRequest(store,{id:'or-timeout',job,request,profile:p},{kind:'synthetic_verification',account:account(),checkpoint:async()=>{},transport:async()=>{http++;throw Error('sensitive network details');}});
 assert.equal(r.status,'failed');assert.equal(JSON.stringify(r).includes('sensitive'),false);assert.equal(http,1);assert.equal(store.reservedMicros(),306000);
 await assert.rejects(()=>api.executeRequest(store,{id:'or-checkpoint',job,request,profile:p},{kind:'synthetic_verification',account:account(),checkpoint:async()=>{throw Error('disk full');},transport:async()=>{http++;}}),/checkpoint/);
 assert.equal(http,1);assert.equal(store.reservedMicros(),612000);
 await assert.rejects(()=>api.executeRequest(store,{id:'or-after-halt',job,request,profile:p},{kind:'synthetic_verification',account:account(),checkpoint:async()=>{},transport:async()=>{http++;}}),/halted/);assert.equal(http,1);
});
test('foreign key identity, stale account evidence, missing runtime and changed request prevent dispatch',async()=>{
 assert.equal(typeof api.executeRequest,'function');await api.executeRequest(store,{id:'or-initial',job,request,profile:p},{kind:'synthetic_verification',account:account(),checkpoint:async()=>{},transport:async()=>response()});let calls=0;const options={kind:'football',account:account(),checkpoint:async()=>{},transport:async()=>{calls++;return response();}};
 await assert.rejects(()=>api.executeRequest(store,{id:'or-no-runtime',job,request,profile:p},options),/runtime|supervised/);
 await assert.rejects(()=>api.executeRequest(store,{id:'or-altered',job,request:{...request,body:{...request.body,tools:[{type:'web_search'}]}},profile:p},{...options,kind:'synthetic_verification'}),/hash|request/);
 await assert.rejects(()=>api.executeRequest(store,{id:'or-key-change',job,request,profile:p},{...options,kind:'synthetic_verification',account:{...account(),key_identity_hash:'f'.repeat(64)}}),/key/);
 assert.equal(calls,0);
});
test('restored shared ledger retains OpenRouter liability and all immutable original records',async()=>{
 await api.executeRequest(store,{id:'or-backup',job,request,profile:p},{kind:'synthetic_verification',account:account(),checkpoint:async()=>{},transport:async()=>response()});
 const dump=db.dump(),events=store.events();db.restore(dump);const restored=weekendStore({name:db.name,sql:s=>db.sql(s,'matchmind_restore')});assert.equal(typeof local.refreshWriter,'function');local.refreshWriter({name:db.name,sql:s=>db.sql(s,'matchmind_restore')});assert.equal(restored.reservedMicros(),306000);assert.deepEqual(restored.events(),events);
 assert.throws(()=>db.sql("SET ROLE authenticated;SELECT *FROM shadow_eval.weekend_events",'matchmind_restore'),/permission/);
 assert.equal(db.sql('SELECT count(*)FROM public.predictions'),'0');
});

test('a provider contract or cost violation halts the experiment instead of enabling another request',async()=>{
 let calls=0;const options={kind:'synthetic_verification',account:account(),checkpoint:async()=>{},transport:async()=>{calls++;const r=response();r.usage.cost=6;return r;}};
 const r=await api.executeRequest(store,{id:'or-bad-cost',job,request,profile:p},options);assert.equal(r.halt,true);assert.equal(r.status,'failed');
 await assert.rejects(()=>api.executeRequest(store,{id:'or-after-cost',job,request,profile:p},options),/halted/);assert.equal(calls,1);assert.equal(store.read('or-bad-cost:raw').body.response.usage.cost,6);
});
test('kickoff crossed during checkpoint prevents HTTP while retaining the admitted reservation',async()=>{
 // Keep SQL admission safely before the real kickoff. Only the synthetic
 // supervisor clock crosses it, after the reservation has been confirmed.
 const kickoff=store.read(job).body.kickoff_at_utc;let virtual=new Date(Date.parse(kickoff)-1000).toISOString(),http=0,checkpoints=0;
 store.clock=()=>virtual;
 const profile=freezeProfile(catalog(),virtual),nearKickoff=buildRequest('A3',profile,{fixture_id:'1',home:'A',away:'B',receipt_at_utc:virtual,facts:[{ref:'r',data:{synthetic:true}}]},virtual);
 await assert.rejects(()=>api.executeRequest(store,{id:'or-late-checkpoint',job,request:nearKickoff,profile},{kind:'synthetic_verification',account:account(),checkpoint:async()=>{checkpoints++;assert.equal(store.reservedMicros(),306000);virtual=new Date(Date.parse(kickoff)+1000).toISOString();},transport:async()=>{http++;}}),/late or stale dispatch after checkpoint/);
 assert.equal(checkpoints,1);assert.equal(http,0);assert.equal(store.reservedMicros(),306000);
});
test('real paid dispatch enforces the 450-second allowance after checkpoint',async()=>{
 const kickoff=store.read(job).body.kickoff_at_utc;
 let virtual=new Date(Date.parse(kickoff)-8*60000).toISOString(),http=0;
 store.clock=()=>virtual;
 const profile=freezeProfile(catalog(),virtual),bounded=buildRequest('A3',profile,{fixture_id:'1',home:'A',away:'B',receipt_at_utc:virtual,facts:[{ref:'r',data:{synthetic:true}}]},virtual);
 const runtime={checked_at_utc:virtual,runtime:{observations_current:true,spec_revision:'test',observed_spec_revision:'test',network_policy:{mode:'restricted',state:'enforced',effective_allowed_hosts:['openrouter.ai']},secrets:[{name:'OPENROUTER_API_KEY',state:'ready'}]}};
 await assert.rejects(()=>api.executeRequest(store,{id:'or-allowance',job,request:bounded,profile},{kind:'football',supervised:true,recoveryVerified:true,externalCopyVerified:true,runtime,account:account(),checkpoint:async()=>{virtual=new Date(Date.parse(kickoff)-6*60000).toISOString();},transport:async()=>{http++;return response();}}),/late or stale dispatch after checkpoint/);
 assert.equal(http,0);assert.equal(store.reservedMicros(),306000);
});
test('a halt arriving during checkpoint blocks the waiting attempt before HTTP',async()=>{
 let http=0;
 await assert.rejects(()=>api.executeRequest(store,{id:'or-concurrent-halt',job,request,profile:p},{kind:'synthetic_verification',account:account(),checkpoint:async()=>{store.append('usage','or-concurrent-halt:other','or-concurrent-halt',{status:'contract_violation',halt:true});},transport:async()=>{http++;return response();}}),/halted/);assert.equal(http,0);
});
test('a profile expiring during checkpoint cannot dispatch with its earlier admission',async()=>{
 let virtual=store.clock(),http=0;const old=new Date(Date.parse(virtual)-899000).toISOString(),profile=freezeProfile(catalog(),old);
 const r={...request,profile_hash:profile.profile_hash};const {request_hash,...body}=r;const {canonicalHash}=await import('../lib/snapshot-contract.mjs');r.request_hash=canonicalHash(body);
 const actual={...account(),observed_at_utc:virtual};store.clock=()=>virtual;
 await assert.rejects(()=>api.executeRequest(store,{id:'or-expired',job,request:r,profile},{kind:'synthetic_verification',account:actual,checkpoint:async()=>{virtual=new Date(Date.parse(virtual)+2000).toISOString();},transport:async()=>{http++;}}),/expired/);assert.equal(http,0);
});
test('post-response checkpoint failure is a durable stop and preserves the response and reservation',async()=>{
 let stages=0,http=0;const opts={kind:'synthetic_verification',account:account(),checkpoint:async()=>{if(++stages===2)throw Error('disk full');},transport:async()=>{http++;return response();}};
 await assert.rejects(()=>api.executeRequest(store,{id:'or-post-checkpoint',job,request,profile:p},opts),/checkpoint/);
 await assert.rejects(()=>api.executeRequest(store,{id:'or-after-post',job,request,profile:p},{...opts,checkpoint:async()=>{}}),/halted/);assert.equal(http,1);assert.equal(store.read('or-post-checkpoint:raw').body.response.id,'gen-synthetic');assert.equal(store.reservedMicros(),306000);
});
test('verified recorded charges remain inside their original reservations; unrecorded key spending blocks continuation',async()=>{
 await api.executeRequest(store,{id:'or-billed-1',job,request,profile:p},{kind:'synthetic_verification',account:account(),checkpoint:async()=>{},transport:async()=>response()});
 const k=key();k.data.usage=.001;k.data.limit_remaining=4.999;const c=credits();c.data.total_usage=.001;
 const checked=verifyAccount(k,c,store.clock());
 await api.executeRequest(store,{id:'or-billed-2',job,request,profile:p},{kind:'synthetic_verification',account:checked,checkpoint:async()=>{},transport:async()=>response()});
 assert.equal(store.reservedMicros(),612000);
 k.data.usage=.003;k.data.limit_remaining=4.997;c.data.total_usage=.003;let calls=0;
 await assert.rejects(()=>api.executeRequest(store,{id:'or-unknown-bill',job,request,profile:p},{kind:'synthetic_verification',account:verifyAccount(k,c,store.clock()),checkpoint:async()=>{},transport:async()=>{calls++;return response();}}),/usage|unrecorded/);assert.equal(calls,0);
});
