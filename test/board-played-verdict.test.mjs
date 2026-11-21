/* BUILD 360 - A PLAYED MATCH KEEPS THE BOARD'S LAST PRE-KICK-OFF VERDICT.

   Measured 2026-11-21 with robot/diagnose.mjs (the app's own engine on the live history): every MLS
   and K League 1 fixture in the 21-day window was priced from full history and withheld by its
   competition's measured bar, and once it kicked off the Analysis tab called it "No published
   prediction ... the data does not say why". The board knew why and dropped it at kick-off.

   What is asserted here, on synthetic data only (invented teams, no backend, no production row):
     B1  boardBuild carries a withheld row from the previous board for BOARD_KEEP_PLAYED_DAYS after
         kick-off, with no pick, no probability and no bars: only the reason survives.
     B2  it never carries a passed row, a published fixture, an out-of-scope row, an upcoming row or
         one older than the window, and never duplicates a live row.
     B3  carried rows give way first at the display schema's 1,000-row bound, oldest first.
     B4  on the rendered feed a carried row reads "Board: no pick" with its reason, is never graded,
         and a competition MatchMind does not predict reads "Not predicted here". */
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
  await context.route('**/*',r=>r.request().url()==='http://board-played.test/'
    ?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  await context.addInitScript(()=>localStorage.setItem('mm_intro','1'));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://board-played.test/');
  return page;
}

test('B1-B3: the board keeps a withheld played row stripped to its reason, and nothing else',async t=>{
  const page=await open(t);
  const r=await page.evaluate(()=>{
    const iso=ms=>new Date(ms).toISOString();
    const at=ms=>({d:iso(ms).slice(0,10),t:iso(ms).slice(11,16)});
    const now=Date.now(),H=3600000;
    const row=(f,ms,over)=>Object.assign({f,l:39,n:'Synthetic',...at(ms),h:'H'+f,a:'A'+f,p:'1X',q:.74,m:'Winner',
      g:'low',z:false,pw:.45,pd:.29,pq:.26,xh:1.4,xa:1.1},over||{});
    const live={fxid:7,date:at(now+30*H).d,time:at(now+30*H).t,home:'H7',away:'A7',
      calc:{pick:'1',prob:.81,market:'Winner',gated:null,frozen:false,pW:.81,pD:.12,pL:.07}};
    afState.leagues={39:{id:39,name:'Synthetic',sport:'football',matches:[],upcoming:[live]}};
    afState.archive={3:{pick:'1',prob:.8}};
    _boardRecord={state:'loaded',at:Date.now(),payload:{v:1,ahead:7,builtAt:iso(now-2*H),n:8,notPassed:0,noBars:0,rows:[
      row(1,now-1*H),                          // withheld, played an hour ago: carried
      row(2,now-1*H,{g:null,p:'1'}),           // passed, never published (cannot happen, must not be carried)
      row(3,now-2*H),                          // published: the record speaks
      row(4,now-7*24*H,{g:'nobase'}),          // older than the window
      row(5,now-3*H,{g:'outofscope',p:null,q:null}),
      row(6,now+5*H),                          // upcoming on the old board, gone from the new one
      row(7,now+30*H),                         // the live fixture: rebuilt, never duplicated
      row(8,now-5*24*H,{g:'newteam'})          // inside the window: carried
    ]}};
    const b=boardBuild();
    const kept=_boardKept;
    /* B3: 1,200 played rows and no live rows - the newest 1,000 survive */
    afState.leagues={39:{id:39,name:'Synthetic',sport:'football',matches:[],upcoming:[]}};afState.archive={};
    const many=[];for(let i=0;i<1200;i++)many.push(row(100+i,now-(i+1)*60000));
    _boardRecord={state:'loaded',at:Date.now(),payload:{v:1,ahead:7,builtAt:iso(now),n:1200,notPassed:0,noBars:0,rows:many}};
    const c=boardBuild();
    return {ids:b.rows.map(x=>x.f),rows:b.rows,kept,n:b.n,ahead:b.ahead,keys:Object.keys(b).sort(),
      capN:c.rows.length,capKept:_boardKept,capOldest:Math.max(...c.rows.map(x=>x.f)),capNewest:Math.min(...c.rows.map(x=>x.f)),
      days:BOARD_KEEP_PLAYED_DAYS,max:BOARD_MAX_ROWS};
  });
  assert.equal(r.days,6);assert.equal(r.max,1000);
  assert.deepEqual(r.ids.slice().sort((a,b)=>a-b),[1,7,8],'only the withheld played rows inside the window join the live row');
  assert.equal(r.kept,2);assert.equal(r.n,3);assert.equal(r.ahead,7);
  assert.deepEqual(r.keys,['ahead','builtAt','n','noBars','notPassed','rows','v'],'the board payload keeps its closed shape');
  for(const id of [1,8]){
    const x=r.rows.find(y=>y.f===id);
    for(const k of ['p','q','m','pw','pd','pq','xh','xa']) assert.equal(x[k],null,`carried row ${id} still carries ${k}`);
    assert.equal(x.z,false);
    assert.deepEqual(Object.keys(x).sort(),['a','d','f','g','h','l','m','n','p','pd','pq','pw','q','t','xa','xh','z']);
  }
  assert.equal(r.rows.find(y=>y.f===1).g,'low');assert.equal(r.rows.find(y=>y.f===8).g,'newteam');
  const live=r.rows.find(y=>y.f===7);assert.equal(live.p,'1');assert.equal(live.q,.81);
  assert.equal(r.capN,1000);assert.equal(r.capKept,1000);
  assert.equal(r.capNewest,100,'the newest carried row was dropped');assert.equal(r.capOldest,1099,'older rows outlived newer ones');
});

const SLATE=`
 globalThis.mmSlate=()=>{
  const date=new Date().toISOString().slice(0,10);
  const asof=new Date(Date.now()-1000).toISOString(),expires=new Date(Date.now()+60000).toISOString();
  const card=(fxid,lid,lname,home,away,time,score)=>({fxid,lid,lname,lcountry:'Synthetic',date,time,status:'FT',elapsed:null,home,away,
    gh:score[0],ga:score[1],ft_h:score[0],ft_a:score[1],ht_h:null,ht_a:null,updated_at:asof,provider:'af',prediction:null});
  const kept=card(993001,39,'Synthetic Premier','Kept Home','Kept Away','12:00',[2,0]);
  const silent=card(993002,39,'Synthetic Premier','Silent Home','Silent Away','12:30',[1,1]);
  const outside=card(993003,42,'Synthetic Fourth','Outside Home','Outside Away','13:00',[0,1]);
  const cards=[kept,silent,outside];
  const board={v:1,ahead:7,builtAt:'2026-11-21T07:43:00.000Z',n:1,notPassed:0,noBars:0,
    rows:[{f:kept.fxid,l:39,n:'Synthetic Premier',d:date,t:kept.time,h:kept.home,a:kept.away,p:null,q:null,m:null,g:'low',z:false,
      pw:null,pd:null,pq:null,xh:null,xa:null}]};
  const q=()=>{const x={then:ok=>Promise.resolve({data:[],error:null}).then(ok)};
    for(const n of ['select','eq','in','gte','lte','order','range','limit'])x[n]=()=>x;return x;};
  supa={rpc:async(name,args)=>name==='matchmind_fixture_access_v1'
      ?{data:{version:'matchmind-fixture-access/1',raw_allowed:false},error:null}
      :{data:{version:'matchmind-display/1',edition_id:'44444444-4444-4444-8444-444444444444',as_of:asof,expires_at:expires,
          screen:args.screen,cards:['predictions','scores','history'].includes(args.screen)?cards:[],
          board:args.screen==='predictions'?board:null,records:{engine:null,clv:null},slips:[]},error:null},
    from:()=>q(),auth:{getSession:async()=>({data:{session:null},error:null})}};
 };
`;

test('B4: a carried row names its reason and is never graded; an unpredicted competition says so',async t=>{
  const page=await open(t);
  const seen=await page.evaluate(async([slate])=>{
    eval(slate);mmSlate();
    await loadCloudLeagues(true);
    navTo('predict');
    afState.selectedDate=new Date().toISOString().slice(0,10);
    renderFixtures();
    const list=$('fixtureList');
    const rows=[...list.querySelectorAll('.fxrow')].map(r=>{const c=r.querySelector('.predchip');
      return {text:r.textContent,chip:c?c.textContent.trim():null,title:c?(c.getAttribute('title')||''):''};});
    /* The Analysis feed lists only competitions MatchMind predicts (build 327), so the out-of-scope
       status is read where every other surface reads it: the chip builder itself. */
    const L42=afState.leagues[42],f42=L42&&(L42.upcoming||[]).find(f=>f.fxid===993003);
    if(L42&&f42){const box=document.createElement('div');box.innerHTML=pickStatusChip(L42,f42);const c=box.firstElementChild;
      rows.push({text:'Outside Home',chip:c.textContent.trim(),title:c.getAttribute('title')||'',inFeed:false});}
    return rows;
  },[SLATE]);
  const row=p=>seen.find(r=>r.text.includes(p));
  const k=row('Kept Home');assert.ok(k,'the carried row did not render');
  assert.match(k.chip,/^Board: no pick$/i,k.chip);
  assert.doesNotMatch(k.chip,/[✓✗]|·/,'a never-published pick was graded or priced');
  assert.match(k.title,/No strong read/,'the recorded reason is not named: '+k.title);
  assert.match(k.title,/No pick was published, so nothing is graded/);
  assert.match(k.title,/2026-11-21 07:43/);assert.ok(k.title.length<=300,k.title);
  const s=row('Silent Home');assert.ok(s);assert.match(s.chip,/^No published prediction$/i,s.chip);
  const o=row('Outside Home');assert.ok(o,'the unpredicted competition has no presentation row');
  assert.match(o.chip,/^Not predicted here$/i,o.chip);
  assert.doesNotMatch(o.chip,/[✓✗]/);
  assert.match(o.title,/does not predict this competition/);
});
