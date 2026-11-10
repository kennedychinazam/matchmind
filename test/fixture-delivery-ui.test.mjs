// Offline public presentation UI regressions: no provider or production endpoint is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
async function open(t){
 const exe=process.env.MM_TEST_CHROMIUM;assert.ok(exe&&existsSync(exe),'local offline Chromium required');
 const browser=await chromium.launch({executablePath:exe,args:['--no-sandbox','--disable-background-networking','--disable-sync']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
 await context.route('**/*',r=>r.request().url()==='http://public-display.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const page=await context.newPage();await page.goto('http://public-display.test/');return page;
}
async function synthetic(page,opts={}){await page.evaluate(({raw=false,expired=false}={})=>{
 const date=new Date().toISOString().slice(0,10),asof=new Date(Date.now()-1000).toISOString(),expires=new Date(Date.now()+(expired?-1000:60000)).toISOString();
 const card={fxid:990357,lid:39,lname:'Synthetic League',lcountry:'Synthetic',date,time:'23:59',status:'NS',elapsed:null,home:'Synthetic Home',away:'Synthetic Away',gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:asof,provider:'af',prediction:{lid:39,lname:'Synthetic League',home:'Synthetic Home',away:'Synthetic Away',pick:'1',pick_prob:.6,market:'Winner',p_home:.6,p_draw:.25,p_away:.15,xg_home:1.8,xg_away:.9,kickoff:date,ktime:'23:59',made_at:asof,withheld_at:null,final_pick:null,build:355}};
 const board={v:1,ahead:7,builtAt:asof,n:1,notPassed:0,noBars:0,rows:[{f:card.fxid,l:card.lid,n:card.lname,d:date,t:card.time,h:card.home,a:card.away,p:'1',q:.6,m:'Winner',g:null,z:true,pw:.6,pd:.25,pq:.15,xh:1.8,xa:.9}]};
 window.displayCalls=[];window.rawCalls=[];
 const q=()=>{const x={then:ok=>Promise.resolve({data:[{fxid:1}],error:null}).then(ok)};for(const n of ['select','eq','in','gte','lte','order','range','limit'])x[n]=()=>x;return x;};
 supa={rpc:async(name,args)=>{displayCalls.push({name,args});if(name==='matchmind_fixture_access_v1')return{data:{version:'matchmind-fixture-access/1',raw_allowed:raw},error:null};return{data:{version:'matchmind-display/1',edition_id:'11111111-1111-4111-8111-111111111111',as_of:asof,expires_at:expires,screen:args.screen,cards:['predictions','scores','history'].includes(args.screen)?[card]:[],board:args.screen==='predictions'?board:null,records:{engine:null,clv:null},slips:[]},error:null};},from:name=>{rawCalls.push(name);return q();},auth:{getSession:async()=>({data:{session:null},error:null})}};
},opts);}
test('public fixture screens use fixed edition RPCs and retain original probability vector',async t=>{
 const page=await open(t);await synthetic(page);
 const result=await page.evaluate(async()=>{await loadCloudLeagues(true);const L=afState.leagues[39],f=L.upcoming[0];return{presentation:L._presentation,matches:L.matches.length,vector:[f.pW,f.pD,f.pL],pick:f.pick,raw:rawCalls,requests:displayCalls};});
 assert.equal(result.presentation,true);assert.equal(result.matches,0);assert.deepEqual(result.vector,[.6,.25,.15]);assert.equal(result.pick,'1');assert.deepEqual(result.raw,[]);
 assert.ok(result.requests.every(x=>x.name==='matchmind_fixture_access_v1'||Object.keys(x.args).join()==='screen'));
});
test('published detail shows stored bars without fitting a partial corpus or using AI',async t=>{
 const page=await open(t);await synthetic(page);
 const result=await page.evaluate(async()=>{await loadCloudLeagues(true);let fits=0;footballEngine.predict=()=>{fits++;throw Error('must not fit');};const L=afState.leagues[39];await openFixture(39,L.upcoming[0]);return{fits,pick:$('heroPick').textContent,bars:$('outcomeRows').textContent,note:$('analysisText').textContent};});
 assert.equal(result.fits,0);assert.match(result.pick,/Synthetic Home/);assert.match(result.bars,/60\.0%/);assert.match(result.bars,/25\.0%/);assert.match(result.bars,/15\.0%/);assert.match(result.note,/published/i);
});
test('bounded scores retain status and regulation components without direct table requests',async t=>{
 const page=await open(t);await synthetic(page);
 const result=await page.evaluate(async()=>{await afScoresFromCloud();return{names:afState.scores.list.map(x=>x.home),raw:rawCalls,content:$('scoresList').textContent};});
 assert.deepEqual(result.names,['Synthetic Home']);assert.deepEqual(result.raw,[]);assert.match(result.content,/Synthetic Home/);
});
test('expired presentation fails closed without using a cached provider corpus',async t=>{
 const page=await open(t);await synthetic(page,{expired:true});
 const result=await page.evaluate(async()=>{await loadCloudLeagues(true);return{leagues:Object.keys(afState.leagues),raw:rawCalls,issues:document.body.textContent};});
 assert.deepEqual(result.leagues,[]);assert.deepEqual(result.raw,[]);assert.match(result.issues,/unavailable|could not|expired/i);
});
test('nested unapproved response fields are rejected instead of cached or spread',async t=>{
 const page=await open(t);await synthetic(page);
 const result=await page.evaluate(async()=>{const {data}=await supa.rpc('matchmind_display_v1',{screen:'predictions'});data.cards[0].prediction.raw_provider_payload={secret:'synthetic'};try{fixtureEnvelope(data,'predictions');return false;}catch{return true;}});
 assert.equal(result,true,'a closed card does not make its nested response contract closed');
});
test('a partial published vector is rejected rather than completed from another forecast',async t=>{
 const page=await open(t);await synthetic(page);
 const result=await page.evaluate(async()=>{const {data}=await supa.rpc('matchmind_display_v1',{screen:'predictions'});data.cards[0].prediction.p_home=null;try{fixtureEnvelope(data,'predictions');return false;}catch{return true;}});
 assert.equal(result,true,'unknown and incomplete probabilities must not become an accepted issued vector');
});
test('multibyte display payloads obey the same UTF8 byte bound as the server',async t=>{
 const page=await open(t);await synthetic(page);
 const result=await page.evaluate(async()=>{const {data}=await supa.rpc('matchmind_display_v1',{screen:'predictions'}),base=data.cards[0];data.board=null;data.cards=Array.from({length:300},(_,i)=>({...base,fxid:i+1,home:'界'.repeat(160),away:'外'.repeat(160),lname:'競'.repeat(160),lcountry:'国'.repeat(100),prediction:null}));const chars=JSON.stringify(data).length,bytes=new TextEncoder().encode(JSON.stringify(data)).length;try{fixtureEnvelope(data,'predictions');return{chars,bytes,rejected:false};}catch{return{chars,bytes,rejected:true};}});
 assert.ok(result.chars<524288&&result.bytes>524288,'control must distinguish characters from bytes');assert.equal(result.rejected,true);
});
test('calendar, board authority and record identity follow the same semantic contract as the server',async t=>{
 const page=await open(t);await synthetic(page);
 const result=await page.evaluate(async()=>{const {data}=await supa.rpc('matchmind_display_v1',{screen:'predictions'});const mutate=[x=>{x.cards[0].date='2026-99-99';},x=>{x.board.rows[0].pw=.8;x.board.rows[0].pd=.8;x.board.rows[0].pq=.8;},x=>{x.board.rows[0].h='Other team';},x=>{x.board.rows[0].f=123;},x=>{x.records.clv={key:'engine',payload:{v:1,raw:null,devig:null,beat:0,tie:0,lost:0,from:null,to:null},build:355,computed_at:x.as_of};}];return mutate.map(fn=>{const c=JSON.parse(JSON.stringify(data));fn(c);try{fixtureEnvelope(c,'predictions');return false;}catch{return true;}});});
 assert.deepEqual(result,[true,true,true,true,true]);
});
test('long private publisher computation renews server authority before the original hard expiry',async t=>{
 const page=await open(t);await synthetic(page);
 const r=await page.evaluate(async()=>{
  const originalSet=setTimeout,originalClear=clearTimeout,originalNow=Date.now,callbacks=new Map();let next=900000,now=originalNow(),raw=true,calls=0;
  try{
   window.setTimeout=(fn,ms)=>{const id=next++;callbacks.set(id,{fn,ms});return id;};window.clearTimeout=id=>callbacks.delete(id);Date.now=()=>now;
   authUser={id:'00000000-0000-0000-0000-000000000001'};_cloudAccountEpoch=70;
   supa.rpc=async()=>{calls++;return{data:{version:'matchmind-fixture-access/1',raw_allowed:raw,expires_at:raw?new Date(now+60000).toISOString():null},error:null};};
   await fixtureAccess();_fixtureInputSource='provider';footballEngine.matches=[{home:'Private',away:'Other'}];afState.leagues={39:{id:39,name:'Private',matches:footballEngine.matches,upcoming:[]}};
   const renew=callbacks.get(_fixtureDelivery.renewTimer);if(!renew)return{renewed:false,calls};
   now+=45000;await renew.fn();const retained=footballEngine.matches.length===1&&fixtureRawCurrent();
   raw=false;now+=45000;await callbacks.get(_fixtureDelivery.renewTimer).fn();
   return{renewed:retained,calls,revoked:!fixtureRawCurrent(),detached:footballEngine.matches.length===0};
  }finally{window.setTimeout=originalSet;window.clearTimeout=originalClear;Date.now=originalNow;}
 });
 assert.equal(r.renewed,true,'private full-history processing cannot lose authority solely because it takes over60seconds');assert.ok(r.calls>=3);assert.equal(r.revoked,true);assert.equal(r.detached,true);
});
test('a hanging renewal cannot extend raw authority or restore detached history after hard expiry',async t=>{
 const page=await open(t);await synthetic(page);
 const r=await page.evaluate(async()=>{
  const originalSet=setTimeout,originalClear=clearTimeout,originalNow=Date.now,callbacks=new Map();let next=910000,now=originalNow(),resolve;
  try{
   window.setTimeout=(fn,ms)=>{const id=next++;callbacks.set(id,{fn,ms});return id;};window.clearTimeout=id=>callbacks.delete(id);Date.now=()=>now;
   authUser={id:'00000000-0000-0000-0000-000000000001'};_cloudAccountEpoch=71;
   supa.rpc=async()=>({data:{version:'matchmind-fixture-access/1',raw_allowed:true,expires_at:new Date(now+60000).toISOString()},error:null});
   await fixtureAccess();_fixtureInputSource='provider';footballEngine.matches=[{home:'Private',away:'Other'}];afState.leagues={39:{id:39,name:'Private',matches:footballEngine.matches,upcoming:[]}};
   const renew=callbacks.get(_fixtureDelivery.renewTimer),hard=callbacks.get(_fixtureDelivery.timer);if(!renew||!hard)return{hardFence:false};
   supa.rpc=()=>new Promise(r=>{resolve=r;});now+=45000;const pending=renew.fn();now+=16000;hard.fn();const hardFence=!fixtureRawCurrent()&&footballEngine.matches.length===0;
   resolve({data:{version:'matchmind-fixture-access/1',raw_allowed:true,expires_at:new Date(now+60000).toISOString()},error:null});await pending;
   return{hardFence,notRestored:footballEngine.matches.length===0};
  }finally{window.setTimeout=originalSet;window.clearTimeout=originalClear;Date.now=originalNow;}
 });
 assert.equal(r.hardFence,true);assert.equal(r.notRestored,true);
});
test('old-day and excessive-lived editions cannot be accepted as current display evidence',async t=>{
 const page=await open(t);await synthetic(page);
 const result=await page.evaluate(async()=>{const{data}=await supa.rpc('matchmind_display_v1',{screen:'predictions'});return[x=>{x.as_of='2020-01-01T00:00:00.000Z';},x=>{x.expires_at='2099-01-01T00:00:00.000Z';}].map(fn=>{const c=JSON.parse(JSON.stringify(data));fn(c);try{fixtureEnvelope(c,'predictions');return false;}catch{return true;}});});
 assert.deepEqual(result,[true,true]);
});
test('published rows use current fixture schedule while history retains original issued identity and kickoff',async t=>{
 const page=await open(t);await synthetic(page);
 const result=await page.evaluate(async()=>{const{data}=await supa.rpc('matchmind_display_v1',{screen:'predictions'});const c=data.cards[0];c.home='Current Home';c.away='Current Away';c.date='2099-11-03';c.prediction.home='Original Home';c.prediction.away='Original Away';c.prediction.lname='Original League';c.prediction.kickoff='2026-01-01';c.prediction.ktime='12:00';const row=fixturePresentationRow(c,null),history=fixturePublicRows('predictions',data)[0];return{row:{home:row.home,away:row.away,date:row.date,time:row.time},history:{home:history.home,away:history.away,lname:history.lname,kickoff:history.kickoff,ktime:history.ktime},card:{home:c.home,date:c.date}};});
 assert.deepEqual(result,{row:{home:'Original Home',away:'Original Away',date:'2099-11-03',time:'23:59'},history:{home:'Original Home',away:'Original Away',lname:'Original League',kickoff:'2026-01-01',ktime:'12:00'},card:{home:'Current Home',date:'2099-11-03'}});
});
test('obsolete same-account capability responses cannot detach a newer valid delivery state',async t=>{
 const page=await open(t);await synthetic(page);
 const r=await page.evaluate(async()=>{
  const originalSet=setTimeout,originalClear=clearTimeout;const callbacks=new Map();let next=920000,resolve;
  try{
   window.setTimeout=(fn,ms)=>{const id=next++;callbacks.set(id,{fn,ms});return id;};window.clearTimeout=id=>callbacks.delete(id);
   authUser={id:'00000000-0000-0000-0000-000000000001'};_cloudAccountEpoch=72;
   const response=()=>({data:{version:'matchmind-fixture-access/1',raw_allowed:true,expires_at:new Date(Date.now()+60000).toISOString()},error:null});
   supa.rpc=()=>new Promise(r=>{resolve=r;});const pending=fixtureAccess(),old=_fixtureDelivery;fixtureDeliveryReset();supa.rpc=async()=>response();await fixtureAccess();
   _fixtureInputSource='provider';footballEngine.matches=[{home:'Current private',away:'Other'}];afState.leagues={39:{id:39,name:'Private',matches:footballEngine.matches,upcoming:[]}};
   resolve(response());await pending;const stale=callbacks.get(old.timer);if(stale)stale.fn();
   return{preserved:footballEngine.matches.length===1,current:fixtureRawCurrent()};
  }finally{window.setTimeout=originalSet;window.clearTimeout=originalClear;}
 });
 assert.deepEqual(r,{preserved:true,current:true});
});
test('historical result lookups combine only fixed score and issued-history editions locally',async t=>{
 const page=await open(t);await synthetic(page);
 const r=await page.evaluate(async()=>{
  const rpc=supa.rpc.bind(supa),{data}=await rpc('matchmind_display_v1',{screen:'scores'}),old=JSON.parse(JSON.stringify(data.cards[0]));old.fxid++;old.date='2026-01-01';old.status='FT';old.gh=old.ft_h=2;old.ga=old.ft_a=1;old.prediction.kickoff=old.date;
  supa.rpc=async(name,args)=>{const r=await rpc(name,args);if(name==='matchmind_display_v1')r.data.cards=args.screen==='history'?[old]:r.data.cards;return r;};
  const result=await fixtureTable('fixtures').select('fxid,gh,ga,ft_h,ft_a,status').in('fxid',[old.fxid]);return{data:result.data,error:result.error,requests:displayCalls.filter(x=>x.name==='matchmind_display_v1'),raw:rawCalls};
 });
 assert.equal(r.error,null);assert.equal(r.data.length,1);assert.deepEqual(r.data[0],{fxid:990358,gh:2,ga:1,ft_h:2,ft_a:1,status:'FT'});assert.deepEqual(r.raw,[]);assert.ok(r.requests.every(x=>Object.keys(x.args).join()==='screen'));
});
test('private history fetch rejects a mid-read revocation instead of accepting public display rows as training history',async t=>{
 const page=await open(t);await synthetic(page);
 const r=await page.evaluate(async()=>{
  const rpc=supa.rpc.bind(supa);let checks=0;authUser={id:'00000000-0000-0000-0000-000000000001'};_cloudAccountEpoch=73;leanHasFt=async()=>false;
  supa.rpc=async(name,args)=>name==='matchmind_fixture_access_v1'?{data:{version:'matchmind-fixture-access/1',raw_allowed:++checks===1,expires_at:new Date(Date.now()+60000).toISOString()},error:null}:rpc(name,args);
  const result=await fetchLeagueFixtures(39);return{data:result.data,error:result.error,raw:rawCalls,checks};
 });
 assert.equal(r.data,null);assert.ok(r.error);assert.deepEqual(r.raw,[]);assert.ok(r.checks>=2);
});
test('each screen operation observes a newly published edition and invalidates older sibling screens',async t=>{
 const page=await open(t);await synthetic(page);
 const r=await page.evaluate(async()=>{
  const rpc=supa.rpc.bind(supa);let edition='A',calls=0;
  supa.rpc=async(name,args)=>{const response=await rpc(name,args);if(name!=='matchmind_display_v1')return response;calls++;const data=JSON.parse(JSON.stringify(response.data));data.edition_id=edition==='A'?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222';if(edition==='B')data.cards.forEach(c=>{c.status='2H';c.elapsed=72;});return{data,error:null};};
  const first=await fixtureDisplayLoad('scores'),firstStatus=first.cards[0].status;
  await fixtureDisplayLoad('history');edition='B';const second=await fixtureDisplayLoad('scores');
  return{first:first.edition_id,firstStatus,second:second.edition_id,secondStatus:second.cards[0].status,calls,oldHistoryRetained:_fixtureDelivery.screens.has('history')};
 });
 assert.equal(r.firstStatus,'NS');assert.equal(r.secondStatus,'2H');assert.notEqual(r.first,r.second);assert.equal(r.calls,3);assert.equal(r.oldHistoryRetained,false);
});
test('actual Postgres RFC3339 offset and microsecond timestamps preserve their original text',async t=>{
 const page=await open(t);await synthetic(page);
 const r=await page.evaluate(async()=>{
  const{data}=await supa.rpc('matchmind_display_v1',{screen:'predictions'}),offset=s=>s.replace(/\.(\d{3})Z$/,(_,ms)=>'.'+ms+'789+00:00');
  data.as_of=offset(data.as_of);data.expires_at=offset(data.expires_at);data.cards[0].updated_at=offset(data.cards[0].updated_at);data.cards[0].prediction.made_at=offset(data.cards[0].prediction.made_at);data.board.builtAt=offset(data.board.builtAt);
  data.records.clv={key:'clv',payload:{v:1,raw:null,devig:null,beat:0,tie:0,lost:0,from:null,to:null},build:355,computed_at:data.as_of};
  try{const out=fixtureEnvelope(data,'predictions');return{admitted:true,originalAsOf:data.as_of,asOf:out.as_of,card:out.cards[0].updated_at,prediction:out.cards[0].prediction.made_at,board:out.board.builtAt,record:out.records.clv.computed_at};}catch(e){return{admitted:false,error:e.message};}
 });
 assert.equal(r.admitted,true,'database serializes timestamptz with an explicit offset, not necessarily Z');assert.equal(r.asOf,r.originalAsOf);for(const k of ['asOf','card','prediction','board','record'])assert.match(r[k],/\.\d{6}\+00:00$/);
});
test('timestamp admission rejects calendar rollover, unsupported offsets and non-RFC3339 forms',async t=>{
 const page=await open(t);await synthetic(page);
 const r=await page.evaluate(async()=>{
  const{data}=await supa.rpc('matchmind_display_v1',{screen:'predictions'});
  return['2026-02-30T12:00:00+00:00','2026-11-03T12:00:00+16:00','2026-11-03T24:00:00+00:00','2026-11-03T12:00:60+00:00','2026-11-03T12:00:00','0000-01-01T12:00:00Z','2026-11-03T12:00:00Z\n'].map(stamp=>{const c=JSON.parse(JSON.stringify(data));c.cards[0].updated_at=stamp;try{fixtureEnvelope(c,'predictions');return false;}catch{return true;}});
 });
 assert.deepEqual(r,[true,true,true,true,true,true,true]);
});
test('public pending and unresolved fixtures cannot become completed results or null-score draws',async t=>{
 const page=await open(t);await synthetic(page);
 const rows=await page.evaluate(async()=>{
  const rpc=supa.rpc.bind(supa),base=(await rpc('matchmind_display_v1',{screen:'history'})).data.cards[0];
  const cases=[['NS',null,null,null,null],['2H',1,0,null,null],['AET',3,2,null,null],['PEN',3,2,1,null],['FT',2,null,2,null],['FT',1,0,1,0],['AET',3,2,1,1],['FT',2,1,2,null]];
  const out=[];
  for(let i=0;i<cases.length;i++){
   fixtureDeliveryReset();afState.scores=null;
   const [status,gh,ga,ft_h,ft_a]=cases[i],card=JSON.parse(JSON.stringify(base));card.fxid=995000+i;card.status=status;card.gh=gh;card.ga=ga;card.ft_h=ft_h;card.ft_a=ft_a;
   card.date=new Date(Date.now()+(i<2?1:-1)*86400000).toISOString().slice(0,10);card.prediction.kickoff=card.date;card.prediction.made_at=new Date(Date.now()-3*86400000).toISOString();
   supa.rpc=async(name,args)=>{const r=await rpc(name,args);if(name==='matchmind_display_v1'){r.data={...r.data,board:null,cards:[card]};}return r;};
   await loadFixturePresentation();const L=afState.leagues[39],f=L.upcoming[0],result=fixtureResult(L,f,scoreMap());showPublishedFixture(L,f);
   out.push({status,result,cloudFinished:!!afState.cloudFix[card.fxid]&&isFinishedScore(afState.cloudFix[card.fxid]),grade:result?gradePick('1',actualCode(result.gh,result.ga),result.gh,result.ga,null,null):null,meta:$('heroMeta').textContent,pick:$('heroPick').textContent});
  }
  return out;
 });
 for(let i=0;i<5;i++){assert.equal(rows[i].result,null,rows[i].status+' is not an authoritative completed90-minute result');assert.equal(rows[i].grade,null);assert.equal(rows[i].cloudFinished,false);assert.doesNotMatch(rows[i].meta,/null|undefined|90-minute score/);assert.match(rows[i].meta,/pending|unavailable/i);}
 assert.match(rows[0].meta,/pending/i);assert.equal(rows[5].result.gh,1);assert.equal(rows[5].result.ga,0);assert.equal(rows[5].grade,'hit');assert.match(rows[5].meta,/90-minute score 1–0/);assert.equal(rows[6].result.gh,1);assert.equal(rows[6].result.ga,1);assert.match(rows[6].meta,/90-minute score 1–1/);assert.equal(rows[7].result.gh,2);assert.equal(rows[7].result.ga,1);assert.match(rows[7].meta,/90-minute score 2–1/,'ordinary FT retains the accepted final-score fallback');
 for(const row of rows)assert.match(row.pick,/Synthetic Home/,'score availability cannot rewrite the issued forecast');
});
