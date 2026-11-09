// Rolling 24-hour display edition admission. Offline: no provider or production endpoint is contacted.
//
// The published edition is current from its `as_of` until `expires_at`, where `expires_at` is
// `as_of + 24h` and is NOT clipped to UTC midnight. An edition published at 23:17 UTC is therefore
// still the current edition at 00:30 and at 05:00 the following UTC day, and the reader must see it.
// These tests drive the page's clock rather than waiting on it.
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

/* The page's whole notion of "now" is replaced, Date.now() and `new Date()` alike, so the clock can
   be moved across a UTC midnight without any waiting. `setFakeNow` is idempotent and may be called
   again to move the clock. */
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

/* One synthetic edition, with the envelope's own timestamps given explicitly rather than derived
   from the clock, so an edition can be placed on a different UTC day from the reader. */
async function edition(page,{asOf,expires,day}){
 await page.evaluate(({asof,expires,date})=>{
  const card={fxid:990358,lid:39,lname:'Synthetic League',lcountry:'Synthetic',date,time:'23:59',status:'NS',elapsed:null,home:'Synthetic Home',away:'Synthetic Away',gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:asof,provider:'af',prediction:{lid:39,lname:'Synthetic League',home:'Synthetic Home',away:'Synthetic Away',pick:'1',pick_prob:.6,market:'Winner',p_home:.6,p_draw:.25,p_away:.15,xg_home:1.8,xg_away:.9,kickoff:date,ktime:'23:59',made_at:asof,withheld_at:null,final_pick:null,build:355}};
  const board={v:1,ahead:7,builtAt:asof,n:1,notPassed:0,noBars:0,rows:[{f:card.fxid,l:card.lid,n:card.lname,d:date,t:card.time,h:card.home,a:card.away,p:'1',q:.6,m:'Winner',g:null,z:true,pw:.6,pd:.25,pq:.15,xh:1.8,xa:.9}]};
  window.rawCalls=[];
  const q=()=>{const x={then:ok=>Promise.resolve({data:[],error:null}).then(ok)};for(const n of ['select','eq','in','gte','lte','order','range','limit'])x[n]=()=>x;return x;};
  supa={rpc:async(name,args)=>{
   if(name==='matchmind_fixture_access_v1')return{data:{version:'matchmind-fixture-access/1',raw_allowed:false},error:null};
   return{data:{version:'matchmind-display/1',edition_id:'22222222-2222-4222-8222-222222222222',as_of:asof,expires_at:expires,screen:args.screen,cards:['predictions','scores','history'].includes(args.screen)?[card]:[],board:args.screen==='predictions'?board:null,records:{engine:null,clv:null},slips:[]},error:null};},
   from:name=>{rawCalls.push(name);return q();},auth:{getSession:async()=>({data:{session:null},error:null})}};
 },{asof:asOf,expires,date:day});
}

async function load(page,day){
 return page.evaluate(async d=>{
  await loadCloudLeagues(true);
  afState.selectedDate=d;renderFixtures();
  const wrap=$('fixturesWrap');
  const status=($('fixturesMeta')||$('discoverStatus'));
  return{leagues:Object.keys(afState.leagues),
   hidden:wrap.classList.contains('hidden'),
   feed:wrap.textContent,
   chips:[...wrap.querySelectorAll('.predchip')].map(c=>c.textContent.trim()),
   until:_presentationUntil,
   status:status?status.textContent:'',
   /* The page carries its whole implementation in an inline <script> inside <body>, so
      body.textContent would read the source. Only what a reader can see is examined. */
   body:(()=>{const c=document.body.cloneNode(true);
    for(const n of c.querySelectorAll('script,style,template,noscript'))n.remove();
    return c.textContent;})(),
   raw:rawCalls};
 },day);
}

/* ─────────────────────────────── 1. THE CLOCK BOUNDARY ─────────────────────────────── */
/* An edition stamped 23:17 UTC is live until 23:17 the next UTC day. Both readings below sit on the
   CALENDAR DAY AFTER `as_of`, which is precisely what the removed term refused — so this test fails
   against an index.html that still carries it. */
for(const at of ['2026-11-09T00:30:00.000Z','2026-11-09T05:00:00.000Z']){
 test(`a 23:17 UTC edition is still current at ${at.slice(11,16)} the following UTC day`,async t=>{
  const page=await open(t);
  await setFakeNow(page,at);
  await edition(page,{asOf:'2026-11-08T23:17:00.000Z',expires:'2026-11-09T23:17:00.000Z',day:'2026-11-08'});
  const r=await load(page,'2026-11-08');
  assert.deepEqual(r.leagues,['39'],'the rolling edition must be admitted on the next UTC day');
  assert.equal(r.hidden,false,'the feed must be on screen, not hidden');
  assert.match(r.feed,/Synthetic Home/);
  assert.match(r.feed,/Synthetic Away/);
  assert.deepEqual(r.chips,['1 · 60%'],'the published pick renders from the rolling edition');
  assert.equal(r.until,Date.parse('2026-11-09T23:17:00.000Z'),'_presentationUntil follows expires_at, nothing else');
  assert.deepEqual(r.raw,[],'no private table is read');
  assert.doesNotMatch(r.status,/unavailable/i);
 });
}

test('the rolling window is admitted right up to expires_at and refused one millisecond later',async t=>{
 const page=await open(t);
 await edition(page,{asOf:'2026-11-08T23:17:00.000Z',expires:'2026-11-09T23:17:00.000Z',day:'2026-11-08'});
 await setFakeNow(page,'2026-11-09T23:16:59.999Z');
 const inside=await load(page,'2026-11-08');
 assert.deepEqual(inside.leagues,['39'],'live one millisecond before expiry');
 await setFakeNow(page,'2026-11-09T23:17:00.000Z');
 const outside=await load(page,'2026-11-08');
 assert.deepEqual(outside.leagues,[],'expired the instant expires_at is reached');
 assert.match(outside.status,/unavailable/i);
});

/* ─────────────────────────── 2. EXPIRY STILL FAILS CLOSED ─────────────────────────── */
test('an expired edition is refused and is never described as a missing pick',async t=>{
 const page=await open(t);
 await setFakeNow(page,'2026-11-09T05:00:00.000Z');
 await edition(page,{asOf:'2026-11-08T04:00:00.000Z',expires:'2026-11-09T04:00:00.000Z',day:'2026-11-08'});
 const r=await load(page,'2026-11-08');
 assert.deepEqual(r.leagues,[],'an edition past expires_at must not be adopted');
 assert.equal(r.hidden,true);
 assert.deepEqual(r.chips,[],'a refused edition renders no chip at all');
 assert.match(r.status,/unavailable/i,'the reader is told the edition is unavailable');
 assert.doesNotMatch(r.body,/no pick/i,'an unavailable edition must never read as "No pick"');
 assert.deepEqual(r.raw,[],'nothing falls back to a private table');
});

test('an edition claiming a life longer than 24 hours is refused and is never read as a missing pick',async t=>{
 const page=await open(t);
 await setFakeNow(page,'2026-11-09T05:00:00.000Z');
 await edition(page,{asOf:'2026-11-08T23:17:00.000Z',expires:'2026-11-10T00:00:00.000Z',day:'2026-11-08'});
 const r=await load(page,'2026-11-08');
 assert.deepEqual(r.leagues,[],'the 24-hour ceiling still holds');
 assert.deepEqual(r.chips,[]);
 assert.match(r.status,/unavailable/i);
 assert.doesNotMatch(r.body,/no pick/i);
 assert.deepEqual(r.raw,[]);
});

test('every remaining admission term still fails closed on the envelope itself',async t=>{
 const page=await open(t);
 await setFakeNow(page,'2026-11-09T05:00:00.000Z');
 await edition(page,{asOf:'2026-11-08T23:17:00.000Z',expires:'2026-11-09T23:17:00.000Z',day:'2026-11-08'});
 const r=await page.evaluate(async()=>{
  const {data}=await supa.rpc('matchmind_display_v1',{screen:'predictions'});
  const cases={
   accepted:          x=>x,
   expired:           x=>{x.expires_at='2026-11-09T04:59:59.000Z';},
   notYetPublished:   x=>{x.as_of='2026-11-09T05:01:00.000Z';x.expires_at='2026-11-10T05:01:00.000Z';},
   livesTooLong:      x=>{x.expires_at='2026-11-10T00:00:00.000Z';},
   expiresBeforeAsOf: x=>{x.expires_at='2026-11-08T23:16:00.000Z';},
   unparseableAsOf:   x=>{x.as_of='2026-13-45T99:99:99Z';},
   unparseableExpiry: x=>{x.expires_at='not a timestamp';},
   wrongVersion:      x=>{x.version='matchmind-display/2';},
   wrongScreen:       x=>{x.screen='scores';}
  };
  const out={};
  for(const [k,fn] of Object.entries(cases)){
   const c=JSON.parse(JSON.stringify(data));fn(c);
   try{fixtureEnvelope(c,'predictions');out[k]='accepted';}catch(e){out[k]=e.message;}
  }
  /* 30 seconds of clock skew is tolerated, deliberately, and is not an expiry relaxation. */
  const skew=JSON.parse(JSON.stringify(data));
  skew.as_of='2026-11-09T05:00:20.000Z';skew.expires_at='2026-11-10T05:00:20.000Z';
  try{fixtureEnvelope(skew,'predictions');out.withinSkew='accepted';}catch(e){out.withinSkew=e.message;}
  return out;
 });
 assert.equal(r.accepted,'accepted','the control edition is the rolling one and must be admitted');
 assert.equal(r.withinSkew,'accepted','the 30-second skew guard is unchanged');
 for(const k of ['expired','notYetPublished','livesTooLong','expiresBeforeAsOf','unparseableAsOf','unparseableExpiry','wrongVersion','wrongScreen'])
  assert.notEqual(r[k],'accepted',k+' must still be refused');
});

/* ───────────────────────── 3. THE HEADER CHIP STATES THE EDITION'S AGE ───────────────────────── */
/* Measured: an edition 22.7 hours old still read "Live". The chip describes score state; the
   published predictions are a rolling edition, so once it is old the chip says how old. */
async function chipAt(t,now,width=390){
 const page=await open(t);
 await page.setViewportSize({width,height:844});
 await setFakeNow(page,now);
 await edition(page,{asOf:'2026-11-08T05:00:00.000Z',expires:'2026-11-09T05:00:00.000Z',day:'2026-11-08'});
 await load(page,'2026-11-08');
 return page.evaluate(()=>{const e=document.getElementById('dataChip'),r=e.getBoundingClientRect(),
  lh=parseFloat(getComputedStyle(e).lineHeight)||r.height;
  return{text:e.textContent.trim(),title:e.title,w:r.width,h:r.height,lines:Math.round(r.height/lh),
   overflow:e.scrollWidth>e.clientWidth+1,right:r.right,vw:innerWidth};});
}
test('an edition 22.7 hours old does not read Live; the chip states its age',async t=>{
 const c=await chipAt(t,'2026-11-09T03:42:00.000Z');
 assert.equal(c.text,'● Updated 22h ago',`#dataChip read "${c.text}"`);
 assert.doesNotMatch(c.text,/live/i,'#dataChip must not say Live for a 22.7 hour old edition');
 assert.match(c.title,/2026-11-08 05:00 UTC/,'the title carries the publication time');
});
test('an edition under 7 hours old keeps the Live chip',async t=>{
 const c=await chipAt(t,'2026-11-08T11:59:00.000Z');
 assert.match(c.text,/^● Live · /,`#dataChip read "${c.text}"`);
});
test('the age chip is one line and stays on screen at 320 px and 390 px',async t=>{
 for(const w of [320,390]){
  const c=await chipAt(t,'2026-11-09T03:42:00.000Z',w);
  assert.equal(c.lines,1,`#dataChip wrapped to ${c.lines} lines at ${w}px (${c.w}x${c.h})`);
  assert.ok(!c.overflow,`#dataChip overflows its own box at ${w}px`);
  assert.ok(c.right<=c.vw,`#dataChip right edge ${c.right} is past the ${c.vw}px viewport`);
 }
});
test('the chip text follows the clock without a reload',async t=>{
 const page=await open(t);
 await setFakeNow(page,'2026-11-08T11:59:00.000Z');
 await edition(page,{asOf:'2026-11-08T05:00:00.000Z',expires:'2026-11-09T05:00:00.000Z',day:'2026-11-08'});
 await load(page,'2026-11-08');
 await setFakeNow(page,'2026-11-08T12:01:00.000Z');
 await page.evaluate(()=>setDataChip(_chipBase));
 assert.equal((await page.evaluate(()=>document.getElementById('dataChip').textContent.trim())),'● Updated 7h ago');
});
