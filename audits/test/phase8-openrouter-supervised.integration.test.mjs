import test from 'node:test';import assert from 'node:assert/strict';
import {localDatabase} from '../test-support/local-db.mjs';import {repository} from '../phase6/repository.mjs';import {weekendStore} from '../phase8/store.mjs';
import {catalog,key,credits} from '../test-support/openrouter-fixtures.mjs';import {freezeProfile,verifyAccount} from '../phase8-continuation/contracts.mjs';import {executeRequest} from '../phase8-continuation/execute.mjs';
const api=await import('../phase8-continuation/supervised.mjs').catch(()=>({}));
// The paid path needs a kickoff still more than the 450 second allowance away,
// so the anchor is relative and on a whole minute. A hardcoded wall-clock time
// silently expires and takes the whole paid branch with it.
const MINUTE=60000,AHEAD=new Date((Math.floor(Date.now()/MINUTE)+20)*MINUTE).toISOString();
const KICKOFF={date:AHEAD.slice(0,10),time:AHEAD.slice(11,19)};
test('supervised synthetic rehearsal freezes three model cohorts without changing originals and preserves all AI failures',async()=>{
 assert.equal(typeof api.runSunday,'function');const db=localDatabase('openrouter-supervised');await db.start();
 try{
  for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);repository(db).install();const store=weekendStore(db);store.install();
  const source={synthetic:true,source_read_at_utc:store.clock(),rows:[{fxid:1,lid:39,home:'A',away:'B',...KICKOFF,status:'NS'}],targets:[1],originals:[{fxid:1,p_home:.6,p_draw:.2,p_away:.2,made_at:'2026-10-23T10:00:00Z'}],odds:[]};
  let calls=0;const preflight=async()=>({account:verifyAccount(key(),credits(),store.clock()),profiles:['openai/gpt-6-luna','moonshotai/kimi-k2.5'].map(m=>freezeProfile(catalog(m),store.clock()))});
  const engine=async packet=>({synthetic_clock:true,input_hash:'a'.repeat(64),source_sha256:'b'.repeat(64),predictions:[{fixture_id:'1',generated_at_utc:store.clock(),status:'forecast',probabilities:[.5,.3,.2],prediction:{pW:.5,pD:.3,pL:.2},eligible:true,decision:{pick:'1'}}]});
  const client={execute:async(s,ctx,opts)=>executeRequest(s,ctx,{...opts,transport:async()=>{calls++;throw Error('synthetic timeout');}})};
  const out=await api.runSunday({store,source,engine,client,preflight,checkpoint:async()=>{},kind:'synthetic_verification',synthetic:true,paid:true});
  assert.equal(out.jobs,3);assert.equal(calls,4);assert.equal(store.events().filter(e=>e.kind==='forecast'&&e.body.arm==='E-Refreshed'&&e.body.status==='forecast').length,3);
  assert.equal(store.events().filter(e=>e.kind==='forecast'&&['A1','A2','A3'].includes(e.body.arm)&&e.body.status==='failed').length,6);
  assert.equal(store.events().filter(e=>e.kind==='job').every(e=>e.body.original.p_home===.6),true);assert.equal(store.reservedMicros(),2255640);assert.equal(db.sql('SELECT count(*)FROM public.predictions'),'0');
 }finally{db.close();}
});
test('successful synthetic model arms use exact delegated context, shared evidence and a measured bundle budget',async()=>{
 const db=localDatabase('openrouter-successful');await db.start();
 try{
  for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);repository(db).install();const store=weekendStore(db);store.install();
  const source={synthetic:true,source_read_at_utc:store.clock(),rows:[1,2,3].map(fxid=>({fxid,lid:39,home:'A'+fxid,away:'B',...KICKOFF,status:'NS'})),targets:[1,2,3],originals:[],odds:[]},before=JSON.stringify(source);
  const preflight=async()=>({account:verifyAccount(key(),credits(),store.clock()),profiles:['openai/gpt-6-luna','moonshotai/kimi-k2.5'].map(m=>freezeProfile(catalog(m),store.clock()))});
  const engine=async packet=>({synthetic_clock:true,input_hash:'a'.repeat(64),source_sha256:'b'.repeat(64),predictions:packet.targets.map(id=>({fixture_id:String(id),generated_at_utc:store.clock(),status:'forecast',probabilities:[.4,.35,.25],prediction:{pW:.4,pD:.35,pL:.25},...(packet.contexts?.[id]?{a1:{prediction:{pW:.45,pD:.3,pL:.25}}}:{}),eligible:true,decision:{pick:'1'}}))});
  let calls=0;const client={execute:async(s,ctx,opts)=>executeRequest(s,ctx,{...opts,transport:async()=>{
   calls++;const refs=ctx.request.evidence_refs,scout=ctx.request.arm==='scout',openai=ctx.profile.model.startsWith('openai');
   const decision=scout?{abstain:false,reason:'supported',evidence_refs:refs,hm:openai?1.05:1,am:openai ? .95 : 1,veto:openai}:{abstain:false,reason:'supported',evidence_refs:refs,probabilities:[.3,.3,.4]};
   return{id:'gen-synthetic-'+calls,provider:ctx.profile.provider,model:ctx.profile.model,usage:{prompt_tokens:100,completion_tokens:80,cost:.001},choices:[{finish_reason:'stop',message:{content:JSON.stringify(decision)}}]};
  }})};
  const out=await api.runSunday({store,source,engine,client,preflight,checkpoint:async()=>{},kind:'synthetic_verification',synthetic:true,paid:true});
  assert.equal(out.fixtures,3);assert.equal(out.jobs,9);assert.equal(calls,8);assert.equal(store.reservedMicros(),4511280);assert.equal(JSON.stringify(source),before);
  const events=store.events(),jobs=events.filter(e=>e.kind==='job'),third=jobs.filter(e=>e.body.fixture_id==='3'&&e.body.provider_model);
  assert.equal(events.filter(e=>third.some(j=>j.event_id===e.parent_id)&&e.kind==='forecast'&&e.body.reason==='insufficient_balanced_bundle_budget').length,6);
  for(const model of ['openai/gpt-6-luna','moonshotai/kimi-k2.5']){
   const j=jobs.find(e=>e.body.fixture_id==='1'&&e.body.provider_model===model),a1=store.read(j.event_id+':A1').body;
   assert.deepEqual(a1.probabilities,model.startsWith('openai')?[.45,.3,.25]:[.4,.35,.25]);assert.equal(store.read(j.event_id+':A3').body.status,'forecast');
  }
  const reqs=events.filter(e=>e.kind==='reservation');assert.equal(new Set(reqs.slice(0,4).map(e=>e.body.request.input_hash)).size,1);
  assert.equal(db.sql('SELECT count(*)FROM public.predictions'),'0');
 }finally{db.close();}
});
test('interruption before the first job blocks duplicate study enrollment and exports the full failed roster',async()=>{
 const db=localDatabase('openrouter-interrupted');await db.start();
 try{
  for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);repository(db).install();const store=weekendStore(db);store.install();
  store.append('study','interrupted-study',null,{version:'weekend-v1',windows:['2026-10-24','2026-10-25'],experiment:'openrouter-private-v1',roster:[{fixture_id:'1',league:39,kickoff_at_utc:'2026-10-25T15:00:00Z',original:null}]});
  await assert.rejects(()=>api.runSunday({store,kind:'synthetic_verification',synthetic:true,source:{synthetic:true},paid:false}),/enrolled/);
  assert.equal(store.events().filter(e=>e.kind==='study').length,1);assert.equal(store.events().filter(e=>e.kind==='job').length,0);
  const {exportContinuation,evaluateContinuation}=await import('../phase8-continuation/protocol.mjs');const report=evaluateContinuation(exportContinuation(store),'2026-10-26T08:00:00Z');
  assert.equal(report.sunday.coverage.roster,1);assert.equal(report.models['openai/gpt-6-luna'].arms.A3.failed,1);
 }finally{db.close();}
});
