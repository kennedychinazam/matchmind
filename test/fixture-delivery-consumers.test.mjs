// Public provider delivery regressions. Synthetic browser only; every external route is aborted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const chromium=createRequire(import.meta.url)('playwright-core').chromium;
const HTML=readFileSync(process.env.MM_FIXTURE_CONSUMER_HTML || new URL('../index.html',import.meta.url),'utf8');
async function pageFor(t,{query='',seed=null}={}){
 const executablePath=process.env.MM_TEST_CHROMIUM;assert.ok(executablePath&&existsSync(executablePath),'local offline Chromium required');
 const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
 if(seed)await context.addInitScript(s=>{for(const [key,value] of Object.entries(s))localStorage.setItem(key,value);},seed);
 await context.route('**/*',r=>r.request().url()==='http://fixture-consumer.test/'+query?r.fulfill({status:200,contentType:'text/html',body:HTML}):r.abort());
 const page=await context.newPage();await page.goto('http://fixture-consumer.test/'+query);return page;
}
async function installReadSpy(page){await page.evaluate(()=>{
 window.deliveryReads=[]; window.supabase={};
 const result={data:[],error:null};
 const query=()=>{const q={then:(ok,bad)=>Promise.resolve(result).then(ok,bad)};for(const name of ['select','eq','neq','in','gte','gt','lte','lt','order','range','limit','is','not','contains'])q[name]=()=>q;return q;};
 supa={from:table=>{deliveryReads.push(String(table));return query();},rpc:async()=>({data:null,error:{message:'synthetic bounded endpoint unavailable'}}),auth:{getSession:async()=>({data:{session:null},error:null})}};
 });}
const RAW=new Set(['fixtures','fixtures_lean','competitions','odds_snapshots','odds_latest','predictions','daily_slips','shared_records']);
test('a public blobs query cannot make the league helper read raw fixtures or lean history',async t=>{
 const page=await pageFor(t,{query:'?blobs=1'});await installReadSpy(page);
 const got=await page.evaluate(async()=>{try{await fetchLeagueFixtures(39);}catch{}return {reads:deliveryReads};});
 assert.deepEqual(got.reads.filter(x=>RAW.has(x)),[],'query-string research mode is not server authorization');
});
test('public competition fallback cannot query raw competition or fixture inventory',async t=>{
 const page=await pageFor(t);await installReadSpy(page);
 const got=await page.evaluate(async()=>{COMP_META={};try{await loadCompMeta();}catch{}return {reads:deliveryReads};});
 assert.deepEqual(got.reads.filter(x=>RAW.has(x)),[],'bounded public headings must not trigger inventory fallback');
});
test('a public research helper cannot page through odds captures or raw results',async t=>{
 const page=await pageFor(t);await installReadSpy(page);
 const got=await page.evaluate(async()=>{try{await m15Fetch();}catch{}return {reads:deliveryReads};});
 assert.deepEqual(got.reads.filter(x=>RAW.has(x)),[],'private CLV/research raw data must not become a public fallback');
});
test('legacy provider corpus bytes stay preserved without automatic public engine restoration',async t=>{
 const raw=JSON.stringify({fb:[{date:'2026-01-01',home:'Legacy Provider Marker',away:'Legacy Other',hg:5,ag:2}],af:{leagues:{39:{id:39,name:'Legacy Provider Competition',matches:[{date:'2026-01-01',home:'Legacy Provider Marker',away:'Legacy Other',hg:5,ag:2}],upcoming:[]}},leagueOrder:[39]}});
 const page=await pageFor(t,{seed:{mm_state:raw}});
 const got=await page.evaluate(()=>({raw:localStorage.getItem('mm_state'),engine:footballEngine.matches.map(x=>x.home),leagues:Object.values(afState.leagues||{}).flatMap(x=>(x.matches||[]).map(m=>m.home))}));
 assert.equal(got.raw,raw,'historical cache bytes must not be deleted or rewritten');
 assert.ok(!got.engine.includes('Legacy Provider Marker'),'old provider corpus is not public compute authorization');
 assert.ok(!got.leagues.includes('Legacy Provider Marker'),'old league cache cannot restore a raw-history backdoor');
});

test('public immutable-history and shared-card consumers never query the generic copied-data objects',async t=>{
 const page=await pageFor(t);await installReadSpy(page);
 const got=await page.evaluate(async()=>{
  for(const read of [()=>loadArchive(),()=>loadBoard(),()=>loadSharedRecords(),()=>dailySharedFetch('2026-11-03')]){try{await read();}catch{}}
  return {reads:deliveryReads};
 });
 assert.deepEqual(got.reads.filter(x=>RAW.has(x)),[],'published record/card rendering must use the finite screen contract, never generic raw/mixed payload REST');
});
test('a generic helper cannot turn caller-controlled columns and deep paging into a public fixture feed',async t=>{
 const page=await pageFor(t);await installReadSpy(page);
 const got=await page.evaluate(async()=>{
  try{await fetchAllRows('fixtures','*',q=>q.gte('date','1900-01-01').lte('date','2100-01-01').range(0,999999));}catch{}
  return {reads:deliveryReads};
 });
 assert.deepEqual(got.reads.filter(x=>RAW.has(x)),[],'client selectors are not server authorisation or an inventory capability');
});
test('published board probabilities remain exact even when a device holds a different local estimate',async t=>{
 const page=await pageFor(t);
 const got=await page.evaluate(()=>{
  const f={fxid:990355,home:'Synthetic Home',away:'Synthetic Away',date:'2099-11-03',time:'12:00',pick:'2',prob:.99,pW:.005,pD:.005,pL:.99};
  _boardRecord={state:'loaded',payload:{v:1,rows:[{f:990355,l:39,n:'Synthetic Competition',d:f.date,t:f.time,h:f.home,a:f.away,p:'1',q:.62,m:'Home win',g:null,z:true,pw:.62,pd:.23,pq:.15,xh:1.7,xa:.8}]}};
  boardTakeOver(f);return {pick:f.pick,prob:f.prob,pW:f.pW,pD:f.pD,pL:f.pL,frozen:f.frozen,fromBoard:f.fromBoard};
 });
 assert.deepEqual(got,{pick:'1',prob:.62,pW:.62,pD:.23,pL:.15,frozen:true,fromBoard:true},'public rendering must preserve the original issued vector instead of refitting/averaging');
});
test('bounded result display preserves explicit regulation-time missingness and confirmed corrections',async t=>{
 const page=await pageFor(t);
 const got=await page.evaluate(()=>{
  const unresolved=settledRow({fxid:990356,status:'AET',gh:3,ga:2,ft_h:null,ft_a:null,updated_at:'2026-11-03T10:00:00Z'});
  const confirmed=settledRow({fxid:990357,status:'AET',gh:3,ga:2,ft_h:1,ft_a:1,updated_at:'2026-11-03T10:00:00Z'});
  return {unresolved:{gh:unresolved.gh,ga:unresolved.ga},confirmed:{gh:confirmed.gh,ga:confirmed.ga},rawFinal:{gh:confirmed.fgh,ga:confirmed.fga}};
 });
 assert.deepEqual(got.unresolved,{gh:null,ga:null},'final AET totals cannot manufacture a 90-minute result');
 assert.deepEqual(got.confirmed,{gh:1,ga:1},'verified fulltime components remain the result for grading');
 assert.deepEqual(got.rawFinal,{gh:3,ga:2},'the original final-score observation is still preserved');
});
test('server-authorized private research retains every original history row and missing value',async t=>{
 const page=await pageFor(t,{query:'?blobs=1'});
 const got=await page.evaluate(async()=>{
  const rows=Array.from({length:37},(_,i)=>({fxid:991000+i,lid:39,season:2025,date:'2025-09-'+String(1+i%28).padStart(2,'0'),time:null,status:'FT',home:'Private Synthetic '+i,away:'Private Other',gh:i%4,ga:i%3,ft_h:null,ft_a:null,shots_h:i%2?null:7,original_payload:{missing:null,source_index:i}}));
  const reads=[];
  const makeQuery=()=>{const q={then:(ok,bad)=>Promise.resolve({data:rows,error:null}).then(ok,bad)};for(const k of ['select','eq','in','gte','gt','lte','lt','order','range','limit','is','not'])q[k]=()=>q;return q;};
  authUser={id:'00000000-0000-0000-0000-000000000001'};_cloudAccountEpoch=17;
  supa={from:table=>{reads.push(table);return makeQuery();},rpc:async name=>name==='matchmind_fixture_access_v1'?{data:{version:'matchmind-fixture-access/1',raw_allowed:true,expires_at:new Date(Date.now()+60000).toISOString()},error:null}:{data:null,error:{message:'unexpected synthetic RPC'}}};
  const result=await fetchLeagueFixtures(39);
  return {expected:rows,actual:result.data,error:result.error,reads};
 });
 assert.equal(got.error,null);
 assert.deepEqual(got.actual,got.expected,'an explicit private capability must preserve full input and nulls instead of substituting trimmed display cards');
 assert.ok(got.reads.includes('fixtures'),'authorized research uses the original complete source path');
});
test('an immutable issued forecast outranks a conflicting current board for the same fixture',async t=>{
 const page=await pageFor(t);
 const got=await page.evaluate(()=>{
  const r={fxid:990358,lid:39,lname:'Synthetic Competition',date:'2099-11-03',time:'12:00',status:'NS',elapsed:null,home:'Frozen Home',away:'Frozen Away',prediction:{lid:39,lname:'Original Synthetic Competition',home:'Frozen Home',away:'Frozen Away',pick:'1',pick_prob:.61,market:'Winner',p_home:.61,p_draw:.24,p_away:.15,kickoff:'2099-11-03',ktime:'12:00',made_at:'2026-11-03T10:00:00Z',withheld_at:null,final_pick:'1',build:355}};
  const f=fixturePresentationRow(r,{rows:[{f:r.fxid,p:'2',q:.5,m:'Winner',g:null,z:false,pw:.2,pd:.3,pq:.5}]});
  return {pick:f.pick,prob:f.prob,pW:f.pW,pD:f.pD,pL:f.pL,frozen:f.frozen,home:f.home,away:f.away,date:f.date,time:f.time};
 });
 assert.deepEqual(got,{pick:'1',prob:.61,pW:.61,pD:.24,pL:.15,frozen:true,home:'Frozen Home',away:'Frozen Away',date:'2099-11-03',time:'12:00'},'a newer board is not permission to rewrite or relabel an original issued prediction');
});
test('a previously issued pick remains visible when later marked as no longer backed',async t=>{
 const page=await pageFor(t);
 const got=await page.evaluate(()=>{
  const r={fxid:990359,lid:39,lname:'Synthetic Competition',date:'2099-11-03',time:'12:00',status:'NS',elapsed:null,home:'Frozen Home',away:'Frozen Away',prediction:{lid:39,lname:'Original Synthetic Competition',home:'Frozen Home',away:'Frozen Away',pick:'1',pick_prob:.61,market:'Winner',p_home:.61,p_draw:.24,p_away:.15,kickoff:'2099-11-03',ktime:'12:00',made_at:'2026-11-03T10:00:00Z',withheld_at:'2026-11-03T10:01:00Z',final_pick:'1',build:355}};
  const f=fixturePresentationRow(r,null);showPublishedFixture({id:39,name:r.lname,country:'Synthetic',matches:[],upcoming:[f],_presentation:true},f);
  return {pick:$('heroPick').textContent,note:$('analysisText').textContent};
 });
 assert.match(got.pick,/Frozen Home/,'marking an issued pick as no longer backed must not erase the original published claim');
 assert.match(got.note,/withdrawn|no longer|stopped backing|unbacked/i,'the changed backing must be represented honestly beside the preserved issued claim');
});
