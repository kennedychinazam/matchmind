import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';

const SOURCE=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const NOW='2026-10-24T12:00:00.000Z';
const SCOPE=JSON.parse(SOURCE.match(/const COMP_IDS = (\[[^;]+\]);/)[1]);
const moduleURL=new URL('../phase8/engine.mjs',import.meta.url);
async function engine(){assert.ok(existsSync(moduleURL),'exact offline engine runner must exist');return import(moduleURL);}
function packet({cup=false}={}){
 const rows=[];
 for(const lid of cup?[2,39]:[39]){
  for(let i=0;i<45;i++)rows.push({fxid:lid*1000+i,lid,lname:lid===2?'Champions League':'Premier League',lcountry:'England',season:2026,
   date:new Date(Date.UTC(2026,7,1+i)).toISOString().slice(0,10),time:'12:00',home:i%2?'Away':'Home',away:i%2?'Home':'Away',
   gh:i%2?i%3:3+i%3,ga:i%2?2:0,ht_h:1,ht_a:0,status:'FT',provider:'api-football',ft_h:null,ft_a:null});
 }
 const lid=cup?2:39;
 rows.push({fxid:900001,lid,lname:cup?'Champions League':'Premier League',lcountry:'England',season:2026,date:'2026-10-25',time:'12:00',home:'Home',away:'Away',gh:null,ga:null,status:'NS'});
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.fxid-b.fxid);
 return count({schema_version:1,scope_competition_ids:[...SCOPE],receipt_at_utc:'2026-10-24T11:59:00.000Z',source_read_at_utc:'2026-10-24T11:58:00.000Z',history_cutoff:'2021-10-24',history_complete:true,
  inventory:{row_count:rows.length,competition_count:cup?2:1,history_count:cup?90:45},rows,targets:[900001],
  measures:[{lid,gate:{ready:true,bar:0.70,edgeFloor:0,met:true},skill:null,build:355,computed_at:'2026-10-24T10:00:00Z'}],originals:[{fxid:900001,pick:'2',prob:0.8}]});
}
function count(p){p.inventory={row_count:p.rows.length,competition_count:new Set(p.rows.map(r=>r.lid)).size,history_count:p.rows.filter(r=>['FT','AET','PEN','FINISHED'].includes(r.status)&&r.gh!=null&&r.ga!=null).length,competition_rows:Object.fromEntries(SCOPE.map(id=>[id,p.rows.filter(r=>r.lid===id).length]))};return p;}

// Independent public-source oracle: construct hydrated inputs and call the actual
// application methods directly. No runner code or computed expected picks is reused.
async function direct(p){
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-background-networking']});
 try{
  const context=await browser.newContext({serviceWorkers:'block',timezoneId:'UTC'});
  await context.route('**/*',r=>r.request().url()==='http://phase8-direct.test/'?r.fulfill({status:200,contentType:'text/html',body:SOURCE}):r.abort());
  const page=await context.newPage();await page.clock.install({time:new Date(NOW)});await page.clock.pauseAt(new Date(NOW));
  await page.goto('http://phase8-direct.test/',{waitUntil:'load'});
  return await page.evaluate(packet=>{
   supa=null;authUser=null;Object.assign(afState,{leagues:{},leagueOrder:[],gate:{},skill:{},archive:{},record:[]});
   _boardRecord={state:'pending',payload:null};_measuresState='loaded';
   recordPick=()=>{};archivePrediction=()=>{};recordDrift=()=>{};markWithheld=()=>{};
   for(const r of packet.rows){
    const L=afState.leagues[r.lid]??={id:r.lid,name:r.lname,country:r.lcountry,sport:'football',matches:[],upcoming:[]};
    if(isFin(r.status)&&r.gh!=null&&r.ga!=null){const s=settledRow(r);L.matches.push(Object.assign({date:r.date,time:r.time,home:r.home,away:r.away,hg:s.gh,ag:s.ga,hth:r.ht_h,hta:r.ht_a,_x:providerExtras(r)},aetOf(s)));}
    if(packet.targets.includes(r.fxid))L.upcoming.push({fxid:r.fxid,date:r.date,time:r.time,home:r.home,away:r.away,season:r.season,_fin:false,_x:providerExtras(r)});
   }
   afState.leagueOrder=Object.keys(afState.leagues).map(Number).sort((a,b)=>a-b);
   for(const m of packet.measures){SHARED_MEASURES[String(m.lid)]=m;if(m.gate?.ready)afState.gate[m.lid]=m.gate;if(m.skill)afState.skill[m.lid]=m.skill;}
   for(const L of Object.values(afState.leagues))registerLeagueDampen(L);
   const out=[];for(const L of Object.values(afState.leagues)){applyGatePass(L,L.upcoming);for(const f of L.upcoming){const tmp=Object.create(footballEngine);tmp.matches=L.matches;out.push({prediction:fxPredict(L,f),decision:f.calc,shrink_k:tmp.shrinkK(),dampen:tmp.dampenFor()});}}
   return out;
  },p);
 }finally{await browser.close();}
}

test('source preservation pins the actual unchanged Build 355 bytes',async()=>{
 const mod=await engine();const baseline=execFileSync('git',['show','68c00ded:index.html'],{maxBuffer:4*1024*1024});
 assert.equal(SOURCE,baseline.toString());assert.equal(mod.ENGINE_SOURCE_SHA256,createHash('sha256').update(baseline).digest('hex'));
});
test('offline runner preserves full probabilities, markets and gates from the direct public source',async()=>{
 const {runEngine}=await engine(),p=packet(),untouched=structuredClone(p);const result=await runEngine(p,{nowUtc:NOW}),want=await direct(p);
 assert.equal(result.predictions.length,1);const got=result.predictions[0];
 assert.deepEqual(got.prediction,want[0].prediction);assert.deepEqual(got.decision,want[0].decision);
 assert.equal(got.shrink_k,8);assert.equal(got.dampen,0.7);assert.equal(got.eligible,true);
 assert.deepEqual(got.probabilities,[got.prediction.pW,got.prediction.pD,got.prediction.pL]);
 assert.deepEqual(p,untouched);assert.deepEqual(result.originals,p.originals);assert.notEqual(got.decision.pick,p.originals[0].pick);
 assert.equal(result.network.outbound_requests,0);assert.ok(result.network.blocked_requests.every(u=>!u.includes('api-football')));
 assert.equal(result.generated_at_utc,NOW);assert.equal(result.synthetic_clock,true);
});
test('cup shrink and concurrent league histories reach the same exact prediction path',async()=>{
 const {runEngine}=await engine(),p=packet({cup:true});const got=(await runEngine(p,{nowUtc:NOW})).predictions[0],want=(await direct(p))[0];
 assert.equal(got.shrink_k,32);assert.deepEqual(got.prediction,want.prediction);assert.deepEqual(got.decision,want.decision);
});
test('72 hours is eligible, one minute later is excluded, and missing measures withhold',async()=>{
 const {runEngine}=await engine(),p=packet();p.rows.at(-1).date='2026-10-27';
 p.rows.push({...p.rows.at(-1),fxid:900002,time:'12:01'});p.targets.push(900002);count(p);
 const got=await runEngine(p,{nowUtc:NOW});assert.equal(got.predictions[0].eligible,true);assert.equal(got.predictions[1].eligible,false);assert.equal(got.predictions[1].exclusion_reason,'outside_72_hour_window');
 const missing=packet();missing.measures=[];const noBar=(await runEngine(missing,{nowUtc:NOW})).predictions[0];assert.equal(noBar.decision.gated,'unmeasured');assert.equal(noBar.eligible,false);
});
test('same-count corrected histories cannot reuse stale engine caches',async()=>{
 const {runEngine}=await engine(),p=packet(),first=await runEngine(p,{nowUtc:NOW});
 for(const r of p.rows)if(r.status==='FT'){r.gh=0;r.ga=5;}
 const second=await runEngine(p,{nowUtc:NOW});assert.notDeepEqual(first.predictions[0].probabilities,second.predictions[0].probabilities);assert.notEqual(first.input_hash,second.input_hash);
});
test('A1 executes unchanged context and ladder functions while leaving E intact',async()=>{
 const {runEngine}=await engine(),p=packet();p.contexts={'900001':{hm:1.1,am:0.9}};
 const got=(await runEngine(p,{nowUtc:NOW})).predictions[0];assert.ok(got.a1);assert.equal(got.a1.hm,1.1);assert.notEqual(got.a1.prediction.lambdaH,got.prediction.lambdaH);assert.equal(got.a1.prediction.lambdaH,got.prediction.lambdaH*1.1);
});
test('reject incomplete, reordered, duplicate, late and future-played packets before execution',async()=>{
 const {runEngine}=await engine();
 for(const mutate of [p=>p.history_complete=false,p=>p.inventory.row_count++,p=>p.rows.reverse(),p=>{p.rows.push({...p.rows.at(-1)});count(p);},p=>p.receipt_at_utc='2026-10-26T00:00:00Z',p=>p.source_read_at_utc='2026-10-24T12:01:00Z',p=>{p.rows[0].date='2026-10-26';p.rows.sort((a,b)=>a.date.localeCompare(b.date)||a.fxid-b.fxid);}]){
  const p=packet();mutate(p);await assert.rejects(()=>runEngine(p,{nowUtc:NOW}));
 }
});
test('reject malformed identities, histories and context adjustments without approximating',async()=>{
 const {runEngine}=await engine();for(const mutate of [p=>p.rows[0].gh=-1,p=>p.rows[0].gh='2',p=>p.rows[0].home='',p=>p.targets=[999],p=>p.contexts={'900001':{hm:NaN,am:1}},p=>p.history_cutoff='2025-01-01']){const p=packet();mutate(p);await assert.rejects(()=>runEngine(p,{nowUtc:NOW}));}
});
test('default generation time is a real system time and synthetic clocks are never implicit',async()=>{
 const {runEngine}=await engine(),p=packet();
 const now=new Date(),kick=new Date(now.getTime()+86400000),cutoff=new Date(now);cutoff.setUTCMonth(cutoff.getUTCMonth()-60);p.history_cutoff=cutoff.toISOString().slice(0,10);for(let i=0;i<p.rows.length-1;i++)p.rows[i].date=new Date(now.getTime()-(100-i)*86400000).toISOString().slice(0,10);p.measures[0].computed_at=new Date(now.getTime()-3000).toISOString();p.source_read_at_utc=new Date(now.getTime()-2000).toISOString();p.receipt_at_utc=new Date(now.getTime()-1000).toISOString();p.rows.at(-1).date=kick.toISOString().slice(0,10);p.rows.at(-1).time=kick.toISOString().slice(11,16);
 const before=Date.now(),got=await runEngine(p),after=Date.now();assert.equal(got.synthetic_clock,false);assert.ok(Date.parse(got.generated_at_utc)>=before&&Date.parse(got.generated_at_utc)<=after);
});

test('Sunday uses the actual 60-month application cutoff rather than Saturday history settings',async()=>{
 const {runEngine}=await engine(),p=packet();p.history_cutoff='2021-10-25';p.rows.at(-1).date='2026-10-26';p.source_read_at_utc='2026-10-25T11:58:00Z';p.receipt_at_utc='2026-10-25T11:59:00Z';
 const got=await runEngine(p,{nowUtc:'2026-10-25T12:00:00Z'});assert.equal(got.settings.history_cutoff,'2021-10-25');
 p.history_cutoff='2021-10-24';await assert.rejects(()=>runEngine(p,{nowUtc:'2026-10-25T12:00:00Z'}),/cutoff/);
});
test('started fixtures remain explicit failures while every remaining roster fixture executes',async()=>{
 const {runEngine}=await engine(),p=packet();const target=p.rows.at(-1);target.date='2026-10-24';target.time='11:58';
 p.rows.push({...target,fxid:900002,time:'13:00'},{...target,fxid:900003,time:'14:00'},{...target,fxid:900004,time:'15:00'});p.targets=[900001,900002,900003,900004];count(p);
 const got=await runEngine(p,{nowUtc:NOW});assert.equal(got.predictions.length,4);assert.equal(got.predictions[0].status,'failed');assert.equal(got.predictions[0].exclusion_reason,'target_already_started');assert.equal(got.predictions[0].prediction,null);assert.ok(got.predictions.slice(1).every(x=>x.status==='forecast'));
});
test('same-day settled rows and AET 90-minute scores are consumed without feature-bridge truncation',async()=>{
 const {runEngine}=await engine(),p=packet();
 p.rows.push({fxid:800001,lid:39,lname:'Premier League',date:'2026-10-24',time:'09:00',home:'Home',away:'Away',gh:5,ga:2,ft_h:1,ft_a:1,status:'AET',ht_h:0,ht_a:1});p.rows.sort((a,b)=>a.date.localeCompare(b.date)||a.fxid-b.fxid);count(p);
 const got=(await runEngine(p,{nowUtc:NOW})).predictions[0],want=(await direct(p))[0];assert.deepEqual(got.prediction,want.prediction);
 const absent=structuredClone(p);absent.rows=absent.rows.filter(r=>r.fxid!==800001);count(absent);assert.notDeepEqual((await runEngine(absent,{nowUtc:NOW})).predictions[0].probabilities,got.probabilities);
});
test('cup newcomers consume resting source leagues through the exact cross-competition adjustment',async()=>{
 const {runEngine}=await engine(),p=packet({cup:true});for(const r of p.rows.filter(r=>r.lid===2&&r.status==='FT').slice(0,30)){r.home='Other Home';r.away='Other Away';}
 const got=(await runEngine(p,{nowUtc:NOW})).predictions[0],want=(await direct(p))[0];assert.ok(typeof got.prediction.xcShift==='number');assert.deepEqual(got.prediction,want.prediction);
});
test('insufficient histories and unknown teams are explicit refusals, never neutral forecasts for publication',async()=>{
 const {runEngine}=await engine(),p=packet();p.rows=p.rows.filter(r=>r.status!=='FT').concat(p.rows.filter(r=>r.status==='FT').slice(0,14)).sort((a,b)=>a.date.localeCompare(b.date)||a.fxid-b.fxid);count(p);
 const thin=(await runEngine(p,{nowUtc:NOW})).predictions[0];assert.equal(thin.eligible,false);assert.equal(thin.exclusion_reason,'insufficient_history');assert.equal(thin.prediction,null);
 const u=packet();u.rows.at(-1).home='Never Seen';const unknown=(await runEngine(u,{nowUtc:NOW})).predictions[0];assert.equal(unknown.decision.gated,'newteam');assert.equal(unknown.eligible,false);assert.equal(unknown.prediction.unknownTeams,1);
});

// A missing source scope could silently remove another club's concurrent league.
test('complete Build355 loader scope includes zero-row competitions and rejects unknown additions',async()=>{
 const {runEngine,ENGINE_COMP_IDS}=await engine();assert.deepEqual(ENGINE_COMP_IDS,SCOPE);assert.equal(ENGINE_COMP_IDS.length,55);
 for(const mutate of [p=>p.scope_competition_ids.pop(),p=>p.scope_competition_ids.push(999),p=>delete p.inventory.competition_rows['848'],p=>p.inventory.competition_rows['39']++,p=>{p.rows[0].lid=999;count(p);}]){const p=packet();mutate(p);await assert.rejects(()=>runEngine(p,{nowUtc:NOW}));}
});
