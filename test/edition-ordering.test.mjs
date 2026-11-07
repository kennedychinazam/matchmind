/* Build 357 blocker closure, Observation A: the Analysis screen showed a reduced slate and then a
   larger one for the same date. Two behaviours the release requires are asserted here against the
   bounded public path: a partly loaded slate is never put on screen, and a stale edition never
   replaces a newer accepted one.
   Synthetic offline Chromium; every non-document request intercepted. No backend, no provider. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;
for(const id of [process.env.PWA_PLAYWRIGHT,'playwright','playwright-core'])
  if(id){try{chromium=require(id).chromium;break;}catch{}}
const executablePath=[process.env.MM_TEST_CHROMIUM,process.env.PWA_CHROMIUM,
  '/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

async function open(t){
  assert.ok(chromium&&executablePath,'local offline Chromium required');
  const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking','--disable-sync']});
  const errors=[];
  t.after(async()=>{await browser.close();assert.deepEqual(errors,[],'no page runtime errors');});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url()==='http://edition-order.test/'
    ?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://edition-order.test/');
  return page;
}

/* Builds an edition factory the test drives: `hold` makes the predictions screen wait until
   released, so the moment between the two screens arriving is observable. */
const RIG=`
 globalThis.makeEdition=(editionId,ageMs,names)=>{
  const date=new Date().toISOString().slice(0,10);
  const asof=new Date(Date.now()-ageMs).toISOString();
  const expires=new Date(Date.now()+60000).toISOString();
  const cards=names.map((n,i)=>({fxid:980000+i,lid:100+i,lname:n,lcountry:'Synthetic',date,
   time:'20:0'+i,status:'NS',elapsed:null,home:n+' Home',away:n+' Away',gh:null,ga:null,
   ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:asof,provider:'af',
   prediction:{lid:100+i,lname:n,home:n+' Home',away:n+' Away',pick:'1',pick_prob:.6,
    market:'Winner',p_home:.6,p_draw:.25,p_away:.15,xg_home:1.8,xg_away:.9,kickoff:date,
    ktime:'20:0'+i,made_at:asof,withheld_at:null,final_pick:null,build:355}}));
  return {editionId,asof,expires,cards};
 };
 /* ONE client for the whole test. Swapping the supa object is an account/client change, which resets
    the delivery state legitimately and would make a stale edition look acceptable because
    there is nothing left to compare it against. Production keeps one client, so the stale
    case has to be exercised with one too: the same object serves a different edition. */
 globalThis.installStable=()=>{
  window.currentEdition=null;
  const body=screen=>{const ed=window.currentEdition;
   return {version:'matchmind-display/1',edition_id:ed.editionId,as_of:ed.asof,
    expires_at:ed.expires,screen,
    cards:['predictions','scores','history'].includes(screen)?ed.cards:[],
    board:null,records:{engine:null,clv:null},slips:[]};};
  supa={rpc:async(name,args)=>name==='matchmind_fixture_access_v1'
    ?{data:{version:'matchmind-fixture-access/1',raw_allowed:false},error:null}
    :{data:body(args.screen),error:null},
   from:()=>{throw Error('raw table reached');},
   auth:{getSession:async()=>({data:{session:null},error:null})}};
 };
 globalThis.install=(ed,{hold=false}={})=>{
  window.release=null;
  const body=screen=>({version:'matchmind-display/1',edition_id:ed.editionId,as_of:ed.asof,
   expires_at:ed.expires,screen,
   cards:['predictions','scores','history'].includes(screen)?ed.cards:[],
   board:null,records:{engine:null,clv:null},slips:[]});
  supa={rpc:async(name,args)=>{
    if(name==='matchmind_fixture_access_v1')
      return {data:{version:'matchmind-fixture-access/1',raw_allowed:false},error:null};
    if(hold&&args.screen==='predictions')
      await new Promise(r=>{window.release=r;});
    return {data:body(args.screen),error:null};},
   from:()=>{throw Error('raw table reached');},
   auth:{getSession:async()=>({data:{session:null},error:null})}};
 };
`;

test('a partly loaded edition is never put on screen',async t=>{
  const page=await open(t);
  const seen=await page.evaluate(async rig=>{
    eval(rig);
    install(makeEdition('33333333-3333-4333-8333-333333333333',1000,['Alpha Cup','Beta League']));
    await loadFixturePresentation();
    const settled=visibleLeagues().map(L=>L.name).sort();

    /* A second, larger edition whose predictions screen is held open. While it is in flight the
       screen must still show the first edition in full - never a half-built slate. */
    install(makeEdition('44444444-4444-4444-8444-444444444444',500,
      ['Alpha Cup','Beta League','Gamma Series']),{hold:true});
    const inflight=loadFixturePresentation();
    await new Promise(r=>setTimeout(r,150));
    const during=visibleLeagues().map(L=>L.name).sort();
    window.release();
    await inflight;
    const after=visibleLeagues().map(L=>L.name).sort();
    return {settled,during,after};
  },RIG);
  assert.deepEqual(seen.settled,['Alpha Cup','Beta League']);
  assert.deepEqual(seen.during,['Alpha Cup','Beta League'],
    'a partly loaded slate was on screen while the edition was still arriving');
  assert.deepEqual(seen.after,['Alpha Cup','Beta League','Gamma Series']);
});

test('a stale edition cannot replace a newer accepted one',async t=>{
  const page=await open(t);
  const seen=await page.evaluate(async rig=>{
    eval(rig);
    installStable();
    window.currentEdition=makeEdition('55555555-5555-4555-8555-555555555555',1000,
      ['Alpha Cup','Beta League','Gamma Series']);
    await loadFixturePresentation();
    const fresh=visibleLeagues().map(L=>L.name).sort();
    /* The same client now serves an OLDER edition with fewer competitions: the shape of a slow
       response landing late, or a lagging replica. */
    window.currentEdition=makeEdition('66666666-6666-4666-8666-666666666666',60000,['Alpha Cup']);
    await loadFixturePresentation();
    const afterStale=visibleLeagues().map(L=>L.name).sort();
    return {fresh,afterStale};
  },RIG);
  assert.deepEqual(seen.fresh,['Alpha Cup','Beta League','Gamma Series']);
  assert.notDeepEqual(seen.afterStale,['Alpha Cup'],
    'a stale edition replaced a newer accepted one');
});
