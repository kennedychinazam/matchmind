// Synthetic intercepted browser only: no real accounts, provider requests or hosted writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;for(const name of ['playwright','playwright-core']){try{chromium=require(name).chromium;break;}catch{}}
const executablePath=[process.env.MM_TEST_CHROMIUM,'/usr/bin/chromium','/usr/bin/google-chrome'].find(x=>x&&existsSync(x));
async function open(t){
 assert.ok(chromium&&executablePath,'Chromium is required');
 const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const ctx=await browser.newContext({serviceWorkers:'block'});const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 await ctx.route('**/*',r=>r.request().url()==='http://remediation.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const page=await ctx.newPage();await page.goto('http://remediation.test/');return page;
}
for(const action of ['authLogin','authSignup'])test(action+' recovers rejection, ordinary error and retry without credentials in error text',async t=>{
 const p=await open(t);const r=await p.evaluate(async action=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};authMode=action==='authSignup'?'signup':'login';authUser=null;
  let mode='reject';const call=async()=>{if(mode==='reject')throw Error('synthetic-secret-do-not-display');if(mode==='error')return{error:{message:'Denied'},data:null};return{error:null,data:{session:null}};};
  supa={auth:{signUp:call,signInWithPassword:call}};renderAccount();
  if($('acctName'))$('acctName').value='Synthetic User';$('acctEmail').value='synthetic@example.invalid';$('acctPass').value='synthetic-only';
  let rejection=null;try{await window[action]();}catch(e){rejection=e.message;}const first=$('acctStatus').textContent;
  mode='error';await window[action]();const second=$('acctStatus').textContent;
  mode='success';await window[action]();return{rejection,first,second,third:$('acctStatus').textContent,enabled:!$('acctPrimary').disabled};
 },action);
 assert.equal(r.rejection,null);assert.doesNotMatch(r.first,/Signing in|Creating account|synthetic-secret/);assert.match(r.first,/try again|could not/i);assert.match(r.second,/Denied/);assert.equal(r.enabled,true);
 assert.match(r.third,action==='authSignup'?/not.*signed in|confirmation/i:/Signed in/);
});
test('auth completion tolerates account DOM replacement and failed logout preserves visible session',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};authUser=null;authMode='login';
  supa={auth:{signInWithPassword:async()=>{authUser={id:'user-a'};renderAccount();return{error:null};},signOut:async()=>({error:{message:'synthetic denied'}})}};
  renderAccount();$('acctEmail').value='test@example.invalid';$('acctPass').value='synthetic-only';let rejected=false;
  try{await authLogin();}catch{rejected=true;}await authLogout();return{rejected,user:authUser&&authUser.id};
 });assert.equal(r.rejected,false);assert.equal(r.user,'user-a');
});
test('sync badge requires confirmed write, handles returned/rejected errors and retains local data',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};onAuth({id:'user-a'});_personalCloudReady=true;let mode='error',callback;
  const old=setTimeout;setTimeout=(fn,ms)=>ms===1200?(callback=fn,123):old(fn,ms);clearTimeout=()=>{};
  supa={from:()=>({upsert:async()=>{if(mode==='reject')throw Error('synthetic failure');return{error:mode==='error'?{message:'denied'}:null};}})};
  const local=JSON.stringify(afState.record);renderAccount();const idle=$('acctSynced').textContent;
  cloudPush();const pending=$('acctSynced').textContent;await callback();const error=$('acctSynced').textContent;
  mode='reject';cloudPush();await callback();const rejection=$('acctSynced').textContent;
  mode='success';cloudPush();await callback();return{idle,pending,error,rejection,success:$('acctSynced').textContent,local:local===JSON.stringify(afState.record)};
 });assert.doesNotMatch(r.idle,/^synced$/);assert.match(r.pending,/pending/i);assert.match(r.error,/failed/i);assert.match(r.rejection,/failed/i);assert.equal(r.success,'synced');assert.equal(r.local,true);
});
test('delayed account pull/push cannot merge or acknowledge across account ownership',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};refreshSkills=async()=>{};let resolveRead,writes=0,callback;
  const old=setTimeout;setTimeout=(fn,ms)=>ms===1200?(callback=fn,321):old(fn,ms);clearTimeout=()=>{};
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:()=>new Promise(resolve=>resolveRead=resolve)})}),upsert:async()=>{writes++;return{error:null};}})};
  onAuth({id:'user-a'});afState.record=[];const pull=cloudPullMerge();const resolveOld=resolveRead;_personalCloudReady=true;cloudPush();onAuth(null);
  onAuth({id:'user-b'});resolveOld({error:null,data:{record:[{fxid:123,pick:'1'}],fav_leagues:[135]}});await pull;await callback();
  return{writes,records:afState.record.length,badge:$('acctSynced').textContent};
 });assert.equal(r.writes,0);assert.equal(r.records,0);assert.notEqual(r.badge,'synced');
});
test('missing and invalid historical probabilities stay unavailable; real zeros remain zero',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>({missing:pct(null),invalid:pct(NaN),zero:pct(0),one:pct(1)}));
 assert.match(r.missing,/unavailable/i);assert.match(r.invalid,/unavailable/i);assert.equal(r.zero,'0.0%');assert.equal(r.one,'100.0%');
});
test('board vector comes only from the same complete board row, never local estimates',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{
  const id=993001;_boardRecord={state:'loaded',at:1,payload:{v:1,rows:[{f:id,p:'2D',q:.9}]}};
  const missing=heroBoardVerdict(id,'Home','Away',true);let view=heroProbabilityView(missing,false,null,{pW:.125,pD:.175,pL:.7});
  const first={vector:view.vector,label:view.label};_boardRecord={state:'loaded',at:2,payload:{v:1,rows:[{f:id,p:'2D',q:.8,pw:.1,pd:.5,pq:.4}]}};
  const complete=heroBoardVerdict(id,'Home','Away',true);view=heroProbabilityView(complete,false,null,{pW:.125,pD:.175,pL:.7});
  return{first,second:view.vector};
 });assert.equal(r.first.vector,null);assert.match(r.first.label,/unavailable|not available/i);assert.deepEqual(r.second,{pW:.1,pD:.5,pL:.4});
});
test('invalid provider vector cannot become a forecast and valid provider view never writes engine history',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  let saves=0;saveState=()=>saves++;renderFixtures=()=>{};afState.record=[];
  setShareCard(true,{home:'Old',away:'Other',pick:'Old WIN',conf:'65.0%'});$('heroConf').textContent='84.8% confidence';setHeroDnb('2D',{pW:.125,pD:.175,pL:.7});
  afAuto=async()=>[{predictions:{percent:{home:'60%',draw:null,away:null}}}];const f={fxid:991,home:'New',away:'Other',date:'2026-11-03'};const L={name:'Synthetic',matches:[]};
  await apiAnalyze(f,L);const invalid={conf:$('heroConf').textContent,share:shareCtx,noteHidden:$('heroDnb').classList.contains('hidden'),records:afState.record.length,saves};
  afAuto=async()=>[{predictions:{percent:{home:'60%',draw:'0%',away:'40%'}}}];await apiAnalyze(f,L);
  return{invalid,valid:{conf:$('heroConf').textContent,records:afState.record.length,saves,copy:$('analysisText').textContent,pick:f.pick||null}};
 });assert.doesNotMatch(r.invalid.conf,/100/);assert.equal(r.invalid.share,null);assert.equal(r.invalid.noteHidden,true);assert.equal(r.invalid.records,0);assert.equal(r.invalid.saves,0);
 assert.match(r.valid.conf,/60.0%/);assert.equal(r.valid.records,0);assert.equal(r.valid.saves,0);assert.equal(r.valid.pick,null);assert.match(r.valid.copy,/not.*recorded|view.only/i);
});
test('late provider responses cannot repaint a newer fixture',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  let resolveOld;saveState=()=>{};renderFixtures=()=>{};
  afAuto=async path=>path.includes('fixture=1')?new Promise(resolve=>resolveOld=resolve):[{predictions:{percent:{home:'20%',draw:'30%',away:'50%'}}}];
  const L={name:'Synthetic',matches:[]};const old=apiAnalyze({fxid:1,home:'Old Home',away:'Old Away'},L);await apiAnalyze({fxid:2,home:'New Home',away:'New Away'},L);
  resolveOld([{predictions:{percent:{home:'90%',draw:'5%',away:'5%'}}}]);await old;return{pick:$('heroPick').textContent,conf:$('heroConf').textContent};
 });assert.match(r.pick,/New Away/);assert.match(r.conf,/50.0%/);
});
test('shared results revalidate finals, apply explicit withdrawals and retain issued legs',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;let now=0,calls=0;Date.now=()=>now;const id=993100;
  const rows=[{day:'2026-10-27',tier:'safe',odds:1.7,legs:[{fxid:id,d:'2026-10-27',h:'H',a:'A',code:'1D',p:.7,o:1.7}]}],original=JSON.stringify(rows);
  let response={fxid:id,status:'AET',gh:3,ga:2,ft_h:2,ft_a:2,updated_at:'2026-10-27T22:00:00Z'};
  supa={from:()=>({select:fields=>({in:async()=>{calls++;return{error:null,data:[Object.fromEntries(fields.split(',').map(k=>[k,response[k]]))]};}})})};
  await sharedResultsLoad(rows);const first=dailyLogGrade(rows)[0].legScores[0];await sharedResultsLoad(rows);const immediate=calls;
  now=SHARED_RES_TTL_MS+1;response={...response,gh:null,ga:null,ft_h:null,ft_a:null,updated_at:'2026-10-27T22:05:00Z'};const changed=await sharedResultsLoad(rows);const after=dailyLogGrade(rows)[0];
  return{first,immediate,calls,changed,score:after.legScores[0],refused:unresolved90Fixture(id),final:_sharedResFinal.has(String(id)),unchanged:original===JSON.stringify(rows)};
 });assert.equal(r.first,'2–2');assert.equal(r.immediate,1);assert.equal(r.calls,2);assert.ok(r.changed>0);assert.equal(r.score,null);assert.equal(r.refused,true);assert.equal(r.final,false);assert.equal(r.unchanged,true);
});
test('registry changes and expired/error cache cannot silently grade last-good shared scores',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;let now=1,fail=false;Date.now=()=>now;const id=993110;
  const row={fxid:id,status:'AET',gh:3,ga:2,ft_h:2,ft_a:2,updated_at:'2026-10-27T22:00:00Z'};
  const rows=[{day:'2026-10-27',tier:'safe',odds:1.7,legs:[{fxid:id,d:'2026-10-27',h:'H',a:'A',code:'1D',p:.7,o:1.7}]}];
  supa={from:()=>({select:()=>({in:async()=>fail?{error:{message:'synthetic denied'}}:{error:null,data:[row]}})})};
  await sharedResultsLoad(rows);settledRow({...row,ft_h:1,updated_at:'2026-10-27T22:05:00Z'});const corrected=dailyLogGrade(rows)[0].legScores[0];
  settledRow({...row,ft_h:null,ft_a:null,updated_at:'2026-10-27T22:06:00Z'});const withdrawn=dailyLogGrade(rows)[0].legScores[0];
  now=SHARED_RES_TTL_MS+2;fail=true;try{await sharedResultsLoad(rows);}catch{}const stale=dailyLogGrade(rows)[0];
  return{corrected,withdrawn,staleScore:stale.legScores[0],rawCacheKept:!!_sharedResByKey['2026-10-27|H|A']};
 });assert.equal(r.corrected,'1–2');assert.equal(r.withdrawn,null);assert.equal(r.staleScore,null);assert.equal(r.rawCacheKept,true);
});
test('stored history shows missing probability as unavailable without changing stored pick',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const old={fxid:999,lname:'Synthetic',kickoff:'2025-01-01',home:'H',away:'A',ktime:'12:00',pick:'1',pick_prob:null};const snapshot=JSON.stringify(old);retiredCount=async()=>0;
  supa={from:table=>({select:()=>table==='predictions'?{eq:()=>({order:async()=>({data:[old]})})}:{in:async()=>({data:[]})}})};
  await showPredictDate('2025-01-01');return{text:$('fixtureList').textContent,same:snapshot===JSON.stringify(old)};
 });assert.match(r.text,/probability unavailable/);assert.doesNotMatch(r.text,/1 · 0%/);assert.equal(r.same,true);
});
test('provider probability contract preserves zeros and rejects malformed/missing/implausible totals',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{
  const cases=[{home:'60%',draw:null,away:'40%'},{home:'60%bad',draw:'20%',away:'20%'},{home:'110%',draw:'0%',away:'0%'},{home:'0%',draw:'0%',away:'0%'},{home:'20%',draw:'20%',away:'20%'}];
  return {rejected:cases.map(x=>{try{providerPercentVector(x);return false;}catch{return true;}}),zero:providerPercentVector({home:'0%',draw:'50%',away:'50%'}),rounded:providerPercentVector({home:'33.3%',draw:'33.3%',away:'33.3%'})};
 });assert.ok(r.rejected.every(Boolean));assert.equal(r.zero.pW,0);assert.ok(Math.abs(r.rounded.pW-1/3)<1e-9);
});
test('new writes wait for old write completion; malformed acknowledgement never says synced',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};onAuth({id:'user-a'});_personalCloudReady=true;let callback,resolveOld;const requests=[];
  const old=setTimeout;setTimeout=(fn,ms)=>ms===1200?(callback=fn,777):old(fn,ms);clearTimeout=()=>{};
  supa={from:()=>({upsert:payload=>{requests.push(payload);if(requests.length===1)return new Promise(resolve=>resolveOld=resolve);return Promise.resolve({error:null});}})};
  afState.favL=[1];cloudPush();const first=callback();await Promise.resolve();
  afState.favL=[2];cloudPush();const second=callback();await Promise.resolve();const before=requests.length;
  resolveOld({error:null});await first;await second;const after=requests.map(x=>x.fav_leagues);
  supa={from:()=>({upsert:async()=>undefined})};cloudPush();await callback();return{before,after,badge:$('acctSynced').textContent};
 });assert.equal(r.before,1);assert.deepEqual(r.after,[[1],[2]]);assert.match(r.badge,/failed/);
});
test('same-row board overlay cannot retain a different local vector and DNB note cannot explain mismatched headline',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{
  kickoffPassed=()=>false;_boardRecord={state:'loaded',at:7,payload:{v:1,rows:[{f:997001,p:'2D',q:.9}]}};
  const f={fxid:997001,pW:.125,pD:.175,pL:.7,pick:'2',prob:.7};boardTakeOver(f);
  $('heroConf').textContent='90.0% confidence';setHeroDnb('2D',{pW:.125,pD:.175,pL:.7});
  return{shown:[f.pW,f.pD,f.pL],calc:[f.calc.pW,f.calc.pD,f.calc.pL],note:$('heroDnb').textContent};
 });assert.deepEqual(r.shown,[null,null,null]);assert.deepEqual(r.calc,[.125,.175,.7]);assert.doesNotMatch(r.note,/figure above|70.0%/);assert.match(r.note,/unavailable/);
});
test('cross-consumer cloud withdrawal reaches registry before result filtering and leaves issued rows unchanged',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const now=Date.now(),row={fxid:997100,status:'AET',gh:3,ga:2,ft_h:2,ft_a:2,updated_at:new Date(now-60000).toISOString()};settledRow(row);
  const withdrawn={...row,gh:null,ga:null,ft_h:null,ft_a:null,updated_at:new Date(now).toISOString()},before=JSON.stringify(withdrawn);let usedNot=false;
  fetchAllRows=async(_table,_fields,query)=>{const q={gte(){return this;},lte(){return this;},not(){usedNot=true;return this;}};query(q);return{error:null,data:[withdrawn]};};
  gradeFromHistory=()=>{};settleRecord=async()=>{};supa={};afState.cloudFix={[row.fxid]:{gh:2,ga:2}};
  await loadCloudResults();return{usedNot,refused:unresolved90Fixture(row.fxid),cached:afState.cloudFix[row.fxid]||null,same:before===JSON.stringify(withdrawn)};
 });assert.equal(r.usedNot,false);assert.equal(r.refused,true);assert.equal(r.cached,null);assert.equal(r.same,true);
});
test('frozen banker exposes withdrawal/staleness rather than a settled or silently pending result',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{
  const l={fxid:993301,d:'2026-11-01',t:'12:00',h:'Synthetic Home',a:'Synthetic Away',code:'1',p:null};
  tipsResolveFixture=()=>null;realOddsChip=()=>'';liveChip=()=>'';const box=document.createElement('div');
  dailyLogGrade=()=>[{legGrades:[null],legScores:[null],legAvailability:['unavailable']}];renderBankerFrozen({legs:[l],build:357},'Synthetic',box);const withdrawn=box.textContent;
  dailyLogGrade=()=>[{legGrades:[null],legScores:[null],legAvailability:['stale']}];renderBankerFrozen({legs:[l],build:357},'Synthetic',box);return{withdrawn,stale:box.textContent};
 });assert.match(r.withdrawn,/90-minute result unavailable/);assert.match(r.stale,/refresh pending/);assert.doesNotMatch(r.withdrawn,/0%/);
});
test('played analysis with incomplete stored vector withholds bars and does not claim recalculation',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  footballEngine.load(Array.from({length:48},(_,i)=>({Date:`2026-08-${String(i%24+1).padStart(2,'0')}`,HomeTeam:i%2?'Synthetic B':'Synthetic A',AwayTeam:i%2?'Synthetic A':'Synthetic B',FTHG:i%2?0:3,FTAG:i%2?2:1})));
  currentSport='football';refreshTeams();$('homeTeam').value='Synthetic A';$('awayTeam').value='Synthetic B';pendingMeta={score:'3–1',pick:'1',prob:null,pW:.6,pD:null,pL:.2};await analyze();
  return{rows:$('outcomeRows').textContent,share:shareCtx};
 });assert.doesNotMatch(r.rows,/were recalculated|These are the probabilities the app published/);assert.match(r.rows,/unavailable|missing/i);assert.equal(r.share,null);
});
test('signed percentage differences and returns retain generic formatting',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>({negative:pct(-.12),positive:pct(1.2),invalid:pct(null),probability:probabilityPercent(1.2)}));
 assert.equal(r.negative,'-12.0%');assert.equal(r.positive,'120.0%');assert.match(r.invalid,/unavailable/);assert.match(r.probability,/unavailable/);
});
test('ordinary FT withdrawal fences cached history, orders revisions and preserves unrelated FT fallback',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const id=998101,f={fxid:id,date:'2026-11-01',home:'Synthetic H',away:'Synthetic A'},L={matches:[{date:f.date,home:f.home,away:f.away,hg:2,ag:1}]},before=JSON.stringify(L);
  const base={fxid:id,status:'FT',gh:2,ga:1,ft_h:null,ft_a:null,updated_at:'2026-11-01T10:00:00Z'};
  observeResultRow(base);let rows=[{...base,gh:null,ga:null,updated_at:'2026-11-01T10:01:00Z'}];
  fetchAllRows=async()=>({error:null,data:rows});gradeFromHistory=()=>{};settleRecord=async()=>{};supa={};await loadCloudResults();
  const withdrawn=fixtureResult(L,f,{}),refused=unresolved90Fixture(id);
  const older=observeResultRow({...base,gh:9,updated_at:'2026-11-01T09:59:00Z'});
  observeResultRow({...base,gh:1,ga:2,updated_at:'2026-11-01T10:02:00Z'});const recovered=fixtureResult(L,f,{});
  const unrelated=settledRow({...base,fxid:id+1});return{withdrawn,refused,older,recovered,preserved:before===JSON.stringify(L),unrelated:[unrelated.gh,unrelated.ga],unrelatedTracked:_settlement90Observed.has(String(id+1))};
 });assert.equal(r.withdrawn,null);assert.equal(r.refused,true);assert.equal(r.older,null);assert.deepEqual(r.recovered,{gh:1,ga:2});assert.equal(r.preserved,true);assert.deepEqual(r.unrelated,[2,1]);assert.equal(r.unrelatedTracked,false);
});
