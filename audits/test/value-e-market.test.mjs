import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {chromium} from 'playwright-core';
import {loadSavedLambdaGrid} from '../phase5/saved-lambda.mjs';
import {scorelineDistribution} from '../value-intelligence/scoreline.mjs';
import {marketProbabilities} from '../value-intelligence/markets.mjs';
const moduleURL=new URL('../value-intelligence/e-market.mjs',import.meta.url),source=readFileSync(new URL('../../index.html',import.meta.url),'utf8'),sourceHash=createHash('sha256').update(source).digest('hex');
async function api(){assert.ok(existsSync(moduleURL),'separate E-MARKET adapter required');return import(moduleURL);}
const near=(a,b,t=2e-10)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
function artifact(){return{schema_version:1,build:355,source_sha256:sourceHash,input_hash:'a'.repeat(64),synthetic_clock:true,generated_at_utc:'2026-10-24T12:00:00.000Z',predictions:[{fixture_id:'900001',lid:39,home:'Home',away:'Away',kickoff_at_utc:'2026-10-25T12:00:00.000Z',generated_at_utc:'2026-10-24T12:00:00.000Z',status:'forecast',eligible:true,exclusion_reason:null,probabilities:[.5,.25,.25],prediction:{lambdaH:1.8,lambdaA:1.4,pW:.5,pD:.25,pL:.25,over:{1.5:.7,2.5:.55,3.5:.3},btts:.6}}]};}
test('E-MARKET is a new derived research baseline and preserves original forecast identity and bytes',async()=>{
 const {eMarketFromBuild355}=await api(),a=artifact(),before=structuredClone(a),out=eMarketFromBuild355(a,'900001');
 assert.deepEqual(a,before);assert.equal(out.arm,'E-MARKET');assert.equal(out.actionable,false);assert.equal(out.calibration,'not_validated');assert.equal(out.synthetic_clock,true);assert.deepEqual(out.original.probabilities,a.predictions[0].probabilities);
 assert.equal(out.source.engine_input_hash,a.input_hash);assert.equal(out.source.engine_source_sha256,sourceHash);assert.equal(out.source.engine_generated_at_utc,a.generated_at_utc);assert.equal(out.distribution.parameters.rho,-.08);assert.equal(out.source.authentication,'caller_must_verify_artifact_lineage');
 assert.deepEqual(out.probabilities,marketProbabilities(scorelineDistribution({lambdaHome:1.8,lambdaAway:1.4,rho:-.08})));
 assert.notDeepEqual([out.probabilities.HOME,out.probabilities.DRAW,out.probabilities.AWAY],out.original.probabilities);assert.throws(()=>{out.original.probabilities[0]=1;});
});
test('E-MARKET raw 1X2 converges to pinned Build 355 source grid when tail and transforms coincide',async()=>{
 const {eMarketFromBuild355}=await api(),oracle=loadSavedLambdaGrid(source);
 for(const[h,a]of [[.2,.2],[1,1],[1.8,1.4],[2.3,1.1],[3,2]]){
  const input=artifact();Object.assign(input.predictions[0].prediction,{lambdaH:h,lambdaA:a});const out=eMarketFromBuild355(input,'900001'),want=oracle.predict(h,a,-.08);
  // The legacy source truncates at 12 per side; allow its independently bounded
  // omitted mass rather than asserting expanded tails are bit-identical.
  const tail=l=>{let p=Math.exp(-l);for(let k=1;k<=13;k++)p*=l/k;return p/(1-l/14);};
  const tolerance=tail(h)+tail(a)+out.distribution.error.eventProbabilityAllowance;
  [out.probabilities.HOME,out.probabilities.DRAW,out.probabilities.AWAY].forEach((p,i)=>near(p,want[i],tolerance));
 }
});
test('wrong, ambiguous, late, malformed or ineligible engine artifacts cannot become E-MARKET',async()=>{
 const {eMarketFromBuild355}=await api();
 const edits=[a=>a.build=356,a=>a.source_sha256='b'.repeat(64),a=>a.input_hash='',a=>a.synthetic_clock='false',a=>a.predictions.push(structuredClone(a.predictions[0])),a=>a.predictions[0].eligible=false,a=>a.predictions[0].status='failed',a=>a.predictions[0].generated_at_utc='2026-10-25T12:00:00Z',a=>a.predictions[0].kickoff_at_utc='bad',a=>a.predictions[0].prediction.lambdaH=30,a=>a.predictions[0].probabilities[0]=.9,a=>a.predictions[0].prediction.btts=NaN];
 for(const edit of edits){const a=artifact();edit(a);assert.throws(()=>eMarketFromBuild355(a,'900001'));}
 assert.throws(()=>eMarketFromBuild355(artifact(),'absent'));assert.throws(()=>eMarketFromBuild355(artifact(),'900001',{rho:0}));
});
test('actual offline Build 355 run supplies rates while damped markets remain visibly distinct',async()=>{
 const {eMarketFromBuild355}=await api(),{runEngine,ENGINE_COMP_IDS}=await import('../phase8/engine.mjs');const rows=[];
 for(let i=0;i<60;i++)rows.push({fxid:1000+i,lid:39,lname:'Premier League',lcountry:'England',season:2026,date:new Date(Date.UTC(2026,6,1+i)).toISOString().slice(0,10),time:'12:00',home:i%2?'Away':'Home',away:i%2?'Home':'Away',gh:i%2?i%3:3+i%3,ga:i%2?2:0,ht_h:1,ht_a:0,status:'FT',provider:'af',ft_h:null,ft_a:null});
 rows.push({fxid:900001,lid:39,lname:'Premier League',lcountry:'England',season:2026,date:'2026-10-25',time:'12:00',home:'Home',away:'Away',gh:null,ga:null,status:'NS'});rows.sort((a,b)=>a.date.localeCompare(b.date)||a.fxid-b.fxid);
 const p={schema_version:1,scope_competition_ids:[...ENGINE_COMP_IDS],receipt_at_utc:'2026-10-24T11:59:00.000Z',source_read_at_utc:'2026-10-24T11:58:00.000Z',history_cutoff:'2021-10-24',history_complete:true,rows,targets:[900001],inventory:{row_count:61,competition_count:1,history_count:60,competition_rows:Object.fromEntries(ENGINE_COMP_IDS.map(id=>[id,id===39?61:0]))},measures:[{lid:39,gate:{ready:true,bar:.7,edgeFloor:0,met:true},skill:null,build:355,computed_at:'2026-10-24T10:00:00Z'}],originals:[]};
 // Inject actual scheduler latency after clock setup, keeping the real browser,
 // context, source and engine. install()+pauseAt(the same instant) must not race
 // the host clock; the synthetic Date must stay fixed without freezing timers.
 const originalLaunch=chromium.launch;
 chromium.launch=async function(...args){
  const browser=await originalLaunch.apply(this,args),newContext=browser.newContext.bind(browser);
  browser.newContext=async(...args)=>{const context=await newContext(...args),newPage=context.newPage.bind(context);
   context.newPage=async(...args)=>{const page=await newPage(...args);for(const method of ['install','setFixedTime']){const real=page.clock[method].bind(page.clock);page.clock[method]=async(...args)=>{const result=await real(...args);await pause(100);return result;};}return page;};return context;};return browser;
 };
 let result;try{result=await runEngine(p,{nowUtc:'2026-10-24T12:00:00.000Z'});}finally{chromium.launch=originalLaunch;}
 assert.equal(result.generated_at_utc,'2026-10-24T12:00:00.000Z');
 const before=JSON.stringify(result),baseline=eMarketFromBuild355(result,'900001'),original=result.predictions[0];
 assert.equal(JSON.stringify(result),before);assert.equal(result.network.outbound_requests,0);assert.equal(baseline.distribution.parameters.lambdaHome,original.prediction.lambdaH);assert.equal(baseline.distribution.parameters.lambdaAway,original.prediction.lambdaA);
 assert.deepEqual(baseline.original.probabilities,original.probabilities);assert.equal(baseline.original.btts,original.prediction.btts);assert.equal(baseline.original.over['2.5'],original.prediction.over['2.5']);
 assert.ok(Math.abs(baseline.probabilities.BTTS_YES-original.prediction.btts)>1e-5);assert.ok(Math.abs(baseline.probabilities.OVER_2_5-original.prediction.over['2.5'])>1e-5);
});
