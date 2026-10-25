import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from '../test-support/local-db.mjs';
import {repository} from '../phase6/repository.mjs';
import {weekendStore} from '../phase8/store.mjs';
import {runSunday} from '../phase8-continuation/supervised.mjs';
import {continueSundayAI} from '../phase8-continuation/paid-continuation.mjs';
import {exportContinuation} from '../phase8-continuation/protocol.mjs';
import {executeRequest} from '../phase8-continuation/execute.mjs';
import {freezeProfile,verifyAccount} from '../phase8-continuation/contracts.mjs';
import {catalog,key,credits} from '../test-support/openrouter-fixtures.mjs';
import {canonicalHash} from '../lib/snapshot-contract.mjs';

async function setup(name){
 const db=localDatabase(name);await db.start();
 for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 repository(db).install();const store=weekendStore(db);store.install();return{db,store};
}
const source=()=>({synthetic:true,source_read_at_utc:new Date().toISOString(),rows:[1,2].map(fxid=>({fxid,lid:39,home:'H'+fxid,away:'A',date:'2026-10-25',time:'15:00',status:'NS'})),targets:[1,2],originals:[],odds:[]});
const engine=async packet=>({synthetic_clock:true,source_sha256:'synthetic',input_hash:canonicalHash(packet),predictions:packet.targets.map(id=>({fixture_id:String(id),status:'forecast',generated_at_utc:new Date().toISOString(),probabilities:[.5,.3,.2],prediction:{pW:.5,pD:.3,pL:.2},eligible:id===2,exclusion_reason:id===1?'low':null,decision:{pick:'1'},...(packet.contexts?.[id]?{a1:{prediction:{pW:.55,pD:.25,pL:.2}}}:{})}))});
const preflight=store=>async()=>({account:verifyAccount(key(),credits(),store.clock()),profiles:['openai/gpt-6-luna','moonshotai/kimi-k2.5'].map(m=>freezeProfile(catalog(m),store.clock()))});
const options=(store,s,extras={})=>({store,source:s,engine,kind:'synthetic_verification',synthetic:true,supervised:true,recoveryVerified:true,externalCopyVerified:true,checkpoint:async()=>{},...extras});

test('real continuation rejects stale source before any provider or database work',async()=>{
 const stale={history_complete:true,source_read_at_utc:'2026-10-25T02:00:00Z',rows:[],targets:[]};
 const fake={clock:()=> '2026-10-25T03:00:00Z',events:()=>{throw Error('database should not be reached')}};
 await assert.rejects(()=>continueSundayAI({store:fake,source:stale,kind:'football',paid:true,supervised:true,recoveryVerified:true,externalCopyVerified:true}),/fresh Sunday receipt required/);
});

test('original paid runner never dispatches an engine-excluded forecast',async()=>{
 const {db,store}=await setup('paid-eligible-gate');
 try{
  let calls=0;const client={execute:async()=>{calls++;throw Error('must not be called for excluded fixture')}};
  const s={...source(),targets:[1],rows:source().rows.slice(0,1)};
  await runSunday(options(store,s,{paid:true,client,preflight:preflight(store)}));
  assert.equal(calls,0);
  const jobs=store.events().filter(e=>e.kind==='job'&&e.body.cohort==='sunday-ai');
  assert.equal(jobs.length,2);
  for(const job of jobs)assert.equal(store.read(job.event_id+':A3').body.reason,'baseline_ineligible');
 }finally{db.close();}
});

test('append-only paid continuation links one eligible fixture to frozen Sunday and shares the retained ledger',async()=>{
 const {db,store}=await setup('paid-append-only');
 try{
  const s=source();await runSunday(options(store,s,{paid:false}));
  const before=store.events(),originalStudy=before.find(e=>e.kind==='study'&&e.body.experiment==='openrouter-private-v1');
  const originalForecast=store.read(originalStudy.event_id+':2:engine:E-Refreshed');
  let calls=0;const client={execute:(st,ctx,opts)=>executeRequest(st,ctx,{...opts,transport:async()=>{
   calls++;const refs=ctx.request.evidence_refs,scout=ctx.request.arm==='scout';
   return{id:'synthetic-'+calls,provider:ctx.profile.provider,model:ctx.profile.model,usage:{prompt_tokens:100,completion_tokens:80,cost:.001},choices:[{finish_reason:'stop',message:{content:JSON.stringify(scout?{abstain:false,reason:'supported',evidence_refs:refs,hm:1,am:1,veto:false}:{abstain:false,reason:'supported',evidence_refs:refs,probabilities:[.4,.3,.3]})}}]};
  }})};
  const out=await continueSundayAI(options(store,source(),{paid:true,client,preflight:preflight(store)}));
  assert.deepEqual(out.selected,['2']);assert.equal(calls,4);assert.equal(store.reservedMicros(),2255640);
  assert.equal(store.read(originalForecast.event_id).event_body_hash,originalForecast.event_body_hash);
  assert.equal(store.events().filter(e=>e.kind==='study'&&e.body.experiment==='openrouter-private-v1').length,1);
  const added=store.events().filter(e=>e.kind==='job'&&e.body.cohort==='sunday-ai-continuation');
  assert.equal(added.length,2);assert.equal(added.every(e=>e.body.baseline_forecast_id===originalForecast.event_id),true);
  const inputHashes=new Set(store.events().filter(e=>e.kind==='reservation').map(e=>e.body.request.input_hash));assert.equal(inputHashes.size,1);
  const view=exportContinuation(store),rows=view.records.filter(r=>r.fixture_id==='2'&&r.cohort==='sunday-ai');
  assert.equal(rows.length,2);assert.equal(rows.every(r=>r.forecasts.some(f=>f.arm==='E-Refreshed'&&f.status==='forecast')&&r.forecasts.some(f=>f.arm==='A3'&&f.status==='forecast')),true);
  assert.equal(store.events().filter(e=>e.kind==='forecast'&&e.body.reason==='paid_execution_disabled').length,12);
  await assert.rejects(()=>continueSundayAI(options(store,source(),{paid:true,client,preflight:preflight(store)})),/already paid continuation/);
 }finally{db.close();}
});

test('continuation rejects altered frozen baseline and never selects a missing fresh target',async()=>{
 const {db,store}=await setup('paid-lineage-rejection');
 try{
  await runSunday(options(store,source(),{paid:false}));
  let calls=0;const client={execute:async()=>{calls++;throw Error('unexpected provider call')}};
  const corrupt={...store,events:()=>store.events().map(e=>e.kind==='forecast'&&e.event_id.endsWith(':2:engine:E-Refreshed')?{...e,body:{...e.body,input_hash:'0'.repeat(64)}}:e)};
  await assert.rejects(()=>continueSundayAI(options(corrupt,source(),{paid:true,client,preflight:preflight(store)})),/frozen Sunday engine lineage mismatch/);
  assert.equal(calls,0);
  const missing=source();missing.targets=[1];missing.rows=missing.rows.filter(r=>r.fxid===1);
  const out=await continueSundayAI(options(store,missing,{paid:true,client,preflight:preflight(store)}));
  assert.deepEqual(out.selected,[]);assert.equal(out.decisions.find(d=>d.fixture_id==='2').reason,'fresh_source_target_missing');assert.equal(calls,0);
 }finally{db.close();}
});
