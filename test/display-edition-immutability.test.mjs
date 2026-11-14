// A published pick does not move when the clock does. Offline: no provider or production endpoint
// is contacted.
//
// Accepting a rolling 24-hour edition means a reader now holds the SAME edition across a UTC
// midnight. Nothing published may change as that boundary passes: a played fixture keeps its pick,
// its probability and its grade byte-identical across a reload and across the crossing, and a
// fixture that was issued no pick must not acquire one.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

async function open(t){
 const exe=process.env.MM_TEST_CHROMIUM;assert.ok(exe&&existsSync(exe),'local offline Chromium required');
 const browser=await chromium.launch({executablePath:exe,args:['--no-sandbox','--disable-background-networking','--disable-sync']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},timezoneId:'UTC'});
 await context.route('**/*',r=>r.request().url()==='http://public-display.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const page=await context.newPage();await page.goto('http://public-display.test/');return page;
}
async function setFakeNow(page,iso){
 await page.evaluate(ms=>{
  window.__fake=ms;
  if(!window.__dateShimmed){
   const Real=window.Date;window.__Real=Real;
   window.Date=new Proxy(Real,{
    construct:(T,a)=>a.length?new Real(...a):new Real(window.__fake),
    get:(T,k)=>k==='now'?()=>window.__fake:Reflect.get(T,k)});
   window.__dateShimmed=true;
  }
 },Date.parse(iso));
}

/* One edition, three fixtures, all on 2026-11-08, published at 23:17 UTC that day:
     1  PLAYED with a pre-match pick  -> carries a grade
     2  UPCOMING with a pre-match pick -> carries its probability
     3  PLAYED with no published pick  -> must never acquire one                                  */
const DAY='2026-11-08',AS_OF='2026-11-08T23:17:00.000Z',EXPIRES='2026-11-09T23:17:00.000Z';
async function edition(page){
 await page.evaluate(({asof,expires,date})=>{
  const base={lcountry:'Synthetic',date,status:'NS',elapsed:null,gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:asof,provider:'af'};
  const pred=(home,away,pick,prob,v)=>({lid:39,lname:'Synthetic League',home,away,pick,pick_prob:prob,market:'Winner',p_home:v[0],p_draw:v[1],p_away:v[2],xg_home:1.8,xg_away:.9,kickoff:date,ktime:'23:59',made_at:asof,withheld_at:null,final_pick:null,build:355});
  const played={...base,fxid:701,lid:39,lname:'Synthetic League',time:'18:00',status:'FT',elapsed:90,home:'Graded Home',away:'Graded Away',gh:2,ga:1,ft_h:2,ft_a:1,ht_h:1,ht_a:0,
   prediction:pred('Graded Home','Graded Away','1',.6,[.6,.25,.15])};
  const ahead={...base,fxid:702,lid:39,lname:'Synthetic League',time:'23:59',home:'Ahead Home',away:'Ahead Away',
   prediction:pred('Ahead Home','Ahead Away','X',.34,[.33,.34,.33])};
  const nopick={...base,fxid:703,lid:39,lname:'Synthetic League',time:'16:00',status:'FT',elapsed:90,home:'Silent Home',away:'Silent Away',gh:0,ga:0,ft_h:0,ft_a:0,ht_h:0,ht_a:0,prediction:null};
  const cards=[played,ahead,nopick];
  const row=(c,p,q,pw,pd,pq)=>({f:c.fxid,l:c.lid,n:c.lname,d:date,t:c.time,h:c.home,a:c.away,p,q,m:'Winner',g:null,z:true,pw,pd,pq,xh:1.8,xa:.9});
  const rows=[row(played,'1',.6,.6,.25,.15),row(ahead,'X',.34,.33,.34,.33)];
  const board={v:1,ahead:7,builtAt:asof,n:rows.length,notPassed:0,noBars:0,rows};
  window.rawCalls=[];
  const q=()=>{const x={then:ok=>Promise.resolve({data:[],error:null}).then(ok)};for(const n of ['select','eq','in','gte','lte','order','range','limit'])x[n]=()=>x;return x;};
  supa={rpc:async(name,args)=>{
   if(name==='matchmind_fixture_access_v1')return{data:{version:'matchmind-fixture-access/1',raw_allowed:false},error:null};
   return{data:{version:'matchmind-display/1',edition_id:'33333333-3333-4333-8333-333333333333',as_of:asof,expires_at:expires,screen:args.screen,cards:['predictions','scores','history'].includes(args.screen)?cards:[],board:args.screen==='predictions'?board:null,records:{engine:null,clv:null},slips:[]},error:null};},
   from:name=>{rawCalls.push(name);return q();},auth:{getSession:async()=>({data:{session:null},error:null})}};
 },{asof:AS_OF,expires:EXPIRES,date:DAY});
}

/* Read the rendered chips, keyed by the fixture they belong to, as raw HTML so a comparison is
   byte-for-byte rather than a loose textual match. */
async function snapshot(page){
 return page.evaluate(async d=>{
  await loadCloudLeagues(true);
  afState.selectedDate=d;renderFixtures();
  const out={};
  for(const row of $('fixturesWrap').querySelectorAll('.fxrow')){
   const teams=row.querySelector('.fxteams');if(!teams)continue;
   /* `crest()` prefixes each side with its initials, so the row is keyed by the distinctive word
      in its own team names rather than by the first token of the rendered line. */
   const name=['Graded','Ahead','Silent'].find(n=>teams.textContent.includes(n));
   if(!name)continue;
   const chip=row.querySelector('.predchip');
   out[name]={chip:chip?chip.outerHTML:null,text:chip?chip.textContent.trim():null,time:row.querySelector('.fxtime').textContent.trim()};
  }
  const status=($('fixturesMeta')||$('discoverStatus'));
  return{rows:out,until:_presentationUntil,status:status?status.textContent:''};
 },DAY);
}

test('a published pick, its probability and its grade survive a reload and a UTC midnight unchanged',async t=>{
 const page=await open(t);
 await setFakeNow(page,'2026-11-08T23:50:00.000Z');
 await edition(page);

 const first=await snapshot(page);
 const names=Object.keys(first.rows).sort();
 assert.deepEqual(names,['Ahead','Graded','Silent'],'all three published fixtures are on the matchday');

 /* What each chip asserts, before anything is reloaded or the clock moved. */
 assert.equal(first.rows.Graded.text,'1 ✓','the played pick carries its grade');
 assert.match(first.rows.Graded.chip,/class="predchip hit"/);
 assert.equal(first.rows.Ahead.text,'X · 34%','the upcoming pick carries its probability');
 assert.match(first.rows.Silent.chip,/statuschip/,'a fixture with no published pick gets a status, not a pick');
 assert.equal(first.rows.Silent.text,'No published prediction');
 assert.doesNotMatch(first.rows.Silent.text,/No pick/i,'and is never described as "No pick"');
 assert.equal(first.until,Date.parse('2026-11-09T23:17:00.000Z'));

 /* A reload of the same edition, same clock. */
 const reload=await snapshot(page);
 assert.deepEqual(reload,first,'a reload of the same edition changes nothing it renders');

 /* The clock crosses into the next UTC day. The edition is the same one; so is everything on it. */
 await setFakeNow(page,'2026-11-09T00:20:00.000Z');
 const after=await snapshot(page);
 assert.deepEqual(after,first,'crossing UTC midnight changes nothing the published edition says');
 /* And it is really READ across the boundary, not merely retained by the failed-refresh fallback:
    that fallback keeps the chips but tells the reader the newer edition could not be read. */
 assert.doesNotMatch(after.status,/could not be read/i,'the rolling edition is re-read, not kept by a failed refresh');
 assert.doesNotMatch(after.status,/unavailable/i);

 /* And again, five hours in - the hour at which the old calendar-day rule had already blacked the
    whole feed out. */
 await setFakeNow(page,'2026-11-09T05:00:00.000Z');
 const later=await snapshot(page);
 assert.deepEqual(later,first,'the same edition still renders identically five hours into the next day');
 assert.doesNotMatch(later.status,/could not be read/i);
 assert.doesNotMatch(later.status,/unavailable/i);

 /* No fixture acquired a pick it was not issued, at any of those clocks. */
 for(const s of [first,reload,after,later]){
  assert.equal(s.rows.Silent.text,'No published prediction');
  assert.doesNotMatch(s.rows.Silent.chip,/·/,'no probability may appear on an unissued fixture');
  assert.doesNotMatch(s.rows.Silent.chip,/[✓✗]/,'no grade may appear on an unissued fixture');
 }
});

test('the stored pick, probability and grade inputs are themselves untouched by the crossing',async t=>{
 const page=await open(t);
 await setFakeNow(page,'2026-11-08T23:50:00.000Z');
 await edition(page);
 const read=()=>page.evaluate(async()=>{
  await loadCloudLeagues(true);
  const L=afState.leagues[39],by={};
  for(const f of L.upcoming)by[f.fxid]={pick:f.pick,prob:f.prob,vector:[f.pW,f.pD,f.pL],date:f.date,time:f.time,market:f.market,gated:f.gated};
  return{by,archive:afState.archive,status:Object.fromEntries(L.upcoming.map(f=>[f.fxid,pickStatusCode(L,f)]))};
 });
 const before=await read();
 await setFakeNow(page,'2026-11-09T05:00:00.000Z');
 const after=await read();
 assert.deepEqual(after,before,'nothing the edition published is re-derived by the clock');
 assert.deepEqual(before.by[701],{pick:'1',prob:.6,vector:[.6,.25,.15],date:'2026-11-08',time:'18:00',market:'Winner',gated:null});
 assert.equal(before.archive[701].ktime,'23:59','original prediction time remains archived independently of current 18:00 fixture time');
 assert.deepEqual(before.by[703].pick,null);
 assert.equal(before.status[703],'norow');
 assert.equal(after.status[703],'norow','an unissued fixture stays unissued, and never reads "nopick" by expiry');
});
