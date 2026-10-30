import test from 'node:test';import assert from 'node:assert/strict';
import {localDatabase} from '../test-support/local-db.mjs';import {repository} from '../phase6/repository.mjs';import {weekendStore} from '../phase8/store.mjs';
import {runSunday} from '../phase8-continuation/supervised.mjs';
import {PROSPECTIVE,resultsView,resultsReport,exportContinuation,evidenceView} from '../phase8-continuation/protocol.mjs';
import {freezeProfile,verifyAccount,buildRequest} from '../phase8-continuation/contracts.mjs';import {executeRequest} from '../phase8-continuation/execute.mjs';
import {catalog,key,credits} from '../test-support/openrouter-fixtures.mjs';import {GEMINI,geminiCatalog} from '../test-support/gemini-fixtures.mjs';
const ahead=new Date((Math.floor(Date.now()/60000)+30)*60000).toISOString();
const source=()=>({synthetic:true,source_read_at_utc:new Date().toISOString(),rows:[{fxid:1,lid:94,home:'H',away:'A',date:ahead.slice(0,10),time:ahead.slice(11,19),status:'NS',gh:null,ga:null}],targets:[1],originals:[],odds:[]});
const engineFor=store=>async packet=>({synthetic_clock:true,source_sha256:'synthetic',input_hash:'a'.repeat(64),predictions:packet.targets.map(id=>({fixture_id:String(id),generated_at_utc:store.clock(),status:'forecast',probabilities:[.5,.3,.2],prediction:{pW:.5,pD:.3,pL:.2},decision:{pick:'1'},eligible:true}))});
const options=(store,extra={})=>({store,source:source(),engine:engineFor(store),kind:'synthetic_verification',synthetic:true,paid:false,checkpoint:async()=>{},...extra});
async function setup(label){const db=localDatabase(label);await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);repository(db).install();const store=weekendStore(db);store.install();return{db,store};}
test('Gemini selection is refused outside the prospective study before any journal mutation',async()=>{
 const store={clock:()=>new Date().toISOString(),events:()=>[],append:()=>{throw Error('unexpected mutation');}};
 await assert.rejects(()=>runSunday(options(store,{prospectiveModel:GEMINI})),/prospective/);
 await assert.rejects(()=>runSunday(options(store,{cohorts:PROSPECTIVE,prospectiveModel:'other/model'})),/model/);
});
test('explicit Gemini study preserves Kimi history and shared hold, counts one bundle and retains malformed response failure',async()=>{
 const {db,store}=await setup('gemini-study');
 try{
  await runSunday(options(store));const original=store.events(),job=original.find(e=>e.kind==='job');store.reserve('retained',job.event_id,306000,'a'.repeat(64));
  const before=store.events().map(e=>store.read(e.event_id)),seen=[];
  const preflight=async()=>({account:verifyAccount(key(),credits(),store.clock(),undefined,['openai/gpt-6-luna',GEMINI]),profiles:[freezeProfile(catalog(),store.clock()),freezeProfile(geminiCatalog(),store.clock())]});
  const client={execute:(s,ctx,o)=>executeRequest(s,ctx,{...o,transport:async()=>{
   seen.push(ctx.request);const scout=ctx.request.arm==='scout';
   const decision=scout?{abstain:false,reason:'supported',evidence_refs:ctx.request.evidence_refs,hm:1,am:1,veto:false}:{abstain:false,reason:'supported',evidence_refs:ctx.request.evidence_refs,probabilities:[.4,.3,.3]};
   return{id:'synthetic-'+seen.length,model:ctx.profile.model,provider:ctx.profile.provider,usage:{prompt_tokens:100,completion_tokens:10,cost:.001},choices:[{finish_reason:ctx.profile.model===GEMINI&&!scout?'length':'stop',message:{content:JSON.stringify(decision)}}]};
  }})};
  await runSunday(options(store,{cohorts:PROSPECTIVE,prospectiveModel:GEMINI,paid:true,client,preflight}));
  const events=store.events();assert.equal(seen.length,4);assert.equal(new Set(seen.map(r=>r.input_hash)).size,1);assert.equal(store.reservedMicros(),2753008);
  for(const e of before)assert.deepEqual(store.read(e.event_id),e);
  const study=events.find(e=>e.kind==='study'&&e.body.experiment===PROSPECTIVE.experiment);assert.deepEqual(study.body.models,['openai/gpt-6-luna',GEMINI]);
  const geminiJob=events.find(e=>e.kind==='job'&&e.body.provider_model===GEMINI);assert(geminiJob.event_id.endsWith(':gemini'));assert.equal(store.read(geminiJob.event_id+':A3').body.status,'failed');
  const report=resultsReport(resultsView(store),store.clock());assert(report.models['moonshotai/kimi-k2.5']);assert(report.prospective_models[GEMINI]);assert(!report.prospective_models['moonshotai/kimi-k2.5']);assert.equal(report.prospective_models[GEMINI].arms.A3.n,0);assert.equal(report.reserved_liability_usd,2.753008);
  await assert.rejects(()=>runSunday(options(store,{cohorts:PROSPECTIVE,prospectiveModel:GEMINI})),/enrolled/);
 }finally{db.close();}
});
test('complete evidence beyond Gemini conservative capacity creates no paid reservation or HTTP dispatch',async()=>{
 const {db,store}=await setup('gemini-capacity');
 try{
  const packet=source();packet.rows[0].complete_fact='x'.repeat(1048576);let calls=0;
  await runSunday(options(store,{source:packet,cohorts:PROSPECTIVE,prospectiveModel:GEMINI,paid:true,preflight:async()=>({profiles:[freezeProfile(catalog(),store.clock()),freezeProfile(geminiCatalog(),store.clock())]}),client:{execute:async()=>{calls++;throw Error('should not dispatch');}}}));
  assert.equal(calls,0);assert.equal(store.reservedMicros(),0);assert.equal(store.events().filter(e=>e.body.reason==='complete_evidence_exceeds_safe_context').length,6);
 }finally{db.close();}
});
test('interrupted Gemini enrollment reports missing Gemini jobs using the declared model identities',()=>{
 const events=[{event_id:'interrupted-prospective',kind:'study',received_at:new Date().toISOString(),body:{version:'weekend-v1',experiment:PROSPECTIVE.experiment,models:['openai/gpt-6-luna',GEMINI],roster:[{fixture_id:'1',league:94,kickoff_at_utc:ahead,original:null}]}}];
 const study=exportContinuation({events:()=>events,read:()=>null});assert.equal(study.records.filter(r=>r.provider_model===GEMINI).length,1);assert.equal(study.records.filter(r=>r.provider_model==='moonshotai/kimi-k2.5').length,0);
});
test('an empty declared Gemini roster retains its model identity in the report',()=>{
 const events=[{event_id:'empty',kind:'study',received_at:new Date().toISOString(),body:{version:'weekend-v1',experiment:PROSPECTIVE.experiment,models:['openai/gpt-6-luna',GEMINI],roster:[]}}];
 const report=resultsReport(resultsView({events:()=>events,read:()=>null}),new Date().toISOString());
 assert(report.prospective_models[GEMINI]);assert(!report.prospective_models['moonshotai/kimi-k2.5']);
});
test('balanced Gemini admission checks the larger scout body before any OpenAI dispatch',async()=>{
 const {db,store}=await setup('gemini-boundary');
 try{
  const packet=source();packet.rows[0].complete_fact='';const now=store.clock();
  const profiles=[freezeProfile(catalog(),now),freezeProfile(geminiCatalog(),now)];
  const body=buildRequest('A3',profiles[1],evidenceView(packet,1,now),now).body;
  packet.rows[0].complete_fact='x'.repeat(1048576-17408-Buffer.byteLength(JSON.stringify(body)));
  const ev=evidenceView(packet,1,now);
  assert.equal(Buffer.byteLength(JSON.stringify(buildRequest('A3',profiles[1],ev,now).body))+17408,1048576);
  assert.equal(Buffer.byteLength(JSON.stringify(buildRequest('scout',profiles[1],ev,now).body))+17408,1048611);
  let calls=0;
  await runSunday(options(store,{source:packet,cohorts:PROSPECTIVE,prospectiveModel:GEMINI,paid:true,preflight:async()=>({profiles}),client:{execute:async()=>{calls++;throw Error('should not dispatch');}}}));
  assert.equal(calls,0);assert.equal(store.reservedMicros(),0);
 }finally{db.close();}
});
