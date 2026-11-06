/* Build 357 blocker closure: the PUBLIC Analysis screen, as rendered.
   The existing bounded-delivery tests assert what lands in afState and what openFixture shows.
   None of them looks at the rendered feed, so a correct payload that the feed then hides passes
   every one of them. These tests open the tab and read the DOM.
   Synthetic offline Chromium; every non-document request is intercepted. No backend, no provider,
   no credential, no production row. */
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
  await context.route('**/*',r=>r.request().url()==='http://public-analysis.test/'
    ?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://public-analysis.test/');
  return page;
}

/* A valid bounded edition carrying TWO competitions and three fixtures, built in the same shape
   as the delivery contract's own fixtures. An ordinary caller: raw access is DENIED, so every
   read must go through the fixed display screens. */
async function publish(page){await page.evaluate(()=>{
  const date=new Date().toISOString().slice(0,10);
  const asof=new Date(Date.now()-1000).toISOString(),expires=new Date(Date.now()+60000).toISOString();
  const mk=(fxid,lid,lname,home,away,time)=>({fxid,lid,lname,lcountry:'Synthetic',date,time,
    status:'NS',elapsed:null,home,away,gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,
    updated_at:asof,provider:'af',
    prediction:{lid,lname,home,away,pick:'1',pick_prob:.6,market:'Winner',p_home:.6,p_draw:.25,
      p_away:.15,xg_home:1.8,xg_away:.9,kickoff:date,ktime:time,made_at:asof,withheld_at:null,
      final_pick:null,build:355}});
  const cards=[mk(990401,39,'Synthetic Premier','Alpha FC','Beta FC','20:00'),
               mk(990402,39,'Synthetic Premier','Gamma FC','Delta FC','20:15'),
               mk(990403,78,'Synthetic Bundes','Epsilon FC','Zeta FC','20:30')];
  const board={v:1,ahead:7,builtAt:asof,n:cards.length,notPassed:0,noBars:0,
    rows:cards.map(c=>({f:c.fxid,l:c.lid,n:c.lname,d:c.date,t:c.time,h:c.home,a:c.away,p:'1',q:.6,
      m:'Winner',g:null,z:true,pw:.6,pd:.25,pq:.15,xh:1.8,xa:.9}))};
  window.rawCalls=[];
  const q=()=>{const x={then:ok=>Promise.resolve({data:[],error:null}).then(ok)};
    for(const n of ['select','eq','in','gte','lte','order','range','limit'])x[n]=()=>x;return x;};
  supa={rpc:async(name,args)=>name==='matchmind_fixture_access_v1'
      ?{data:{version:'matchmind-fixture-access/1',raw_allowed:false},error:null}
      :{data:{version:'matchmind-display/1',edition_id:'22222222-2222-4222-8222-222222222222',
          as_of:asof,expires_at:expires,screen:args.screen,
          cards:['predictions','scores','history'].includes(args.screen)?cards:[],
          board:args.screen==='predictions'?board:null,
          records:{engine:null,clv:null},slips:[]},error:null},
    from:name=>{rawCalls.push(name);return q();},
    auth:{getSession:async()=>({data:{session:null},error:null})}};
});}

test('an ordinary caller sees every published competition and fixture on the Analysis feed',async t=>{
  const page=await open(t);await publish(page);
  const seen=await page.evaluate(async()=>{
    await loadCloudLeagues(true);
    navTo('predict');
    renderFixtures();
    const wrap=$('fixturesWrap');
    return {leaguesInState:Object.keys(afState.leagues).length,
      fixturesInState:Object.values(afState.leagues).reduce((n,L)=>n+L.upcoming.length,0),
      wrapHidden:wrap?wrap.classList.contains('hidden'):null,
      visible:visibleLeagues().map(L=>L.name),
      feed:$('fixtureList')?$('fixtureList').textContent:'',
      raw:rawCalls};
  });
  /* The payload is correct: this is not a delivery failure. */
  assert.equal(seen.leaguesInState,2,'the bounded edition did not produce two competitions');
  assert.equal(seen.fixturesInState,3,'the bounded edition did not produce three fixtures');
  assert.deepEqual(seen.raw,[],'a raw table was read');
  /* And it must be on screen. */
  assert.equal(seen.wrapHidden,false,'the whole fixture feed is hidden from an ordinary caller');
  assert.deepEqual(seen.visible.sort(),['Synthetic Bundes','Synthetic Premier']);
  for(const name of ['Synthetic Premier','Synthetic Bundes'])
    assert.ok(seen.feed.includes(name),'competition missing from the feed: '+name);
  for(const team of ['Alpha FC','Beta FC','Gamma FC','Delta FC','Epsilon FC','Zeta FC'])
    assert.ok(seen.feed.includes(team),'fixture side missing from the feed: '+team);
});

test('opening a published fixture shows its original pick and stored probabilities, with no refit',async t=>{
  const page=await open(t);await publish(page);
  const seen=await page.evaluate(async()=>{
    await loadCloudLeagues(true);
    let fits=0; footballEngine.predict=()=>{fits++;throw Error('must not fit a model here');};
    const L=afState.leagues[39];
    await openFixture(39,L.upcoming.find(f=>f.fxid===990401));
    return {fits,pick:$('heroPick').textContent,conf:$('heroConf').textContent,
      bars:$('outcomeRows').textContent,raw:rawCalls};
  });
  assert.equal(seen.fits,0,'the device refitted a model for a published fixture');
  assert.deepEqual(seen.raw,[],'a raw table was read');
  assert.match(seen.pick,/Alpha FC/);
  assert.match(seen.conf,/60\.0%/);
  for(const p of ['60.0%','25.0%','15.0%']) assert.ok(seen.bars.includes(p),'missing stored bar '+p);
  assert.match(seen.bars,/not a device re-estimate/i);
});
