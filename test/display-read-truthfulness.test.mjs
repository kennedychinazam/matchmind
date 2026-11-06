/* Build 357 release acceptance. A bounded-source read that FAILS must never be rendered as
   emptiness or as an unsettled result. `fixtureTable` converts every failure into one uniform
   `{data:null,error:{code:'MM_DISPLAY_UNAVAILABLE'}}` envelope, which is correct for a boundary,
   but four call sites destructured only `data` and discarded `error`. The surfaces then stated a
   fact about the archive that was not true: "No predictions stored for <date>" when the truth was
   that the source could not be read, and picks shown as not-yet-settled when the truth was that
   results could not be read.

   Synthetic offline Chromium only; every non-document request is intercepted. No backend, no
   provider, no credential, no production row. Nothing here grades or regrades anything. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;
for(const id of ['playwright','playwright-core']){try{chromium=require(id).chromium;break;}catch{}}
const executablePath=[process.env.MM_TEST_CHROMIUM,'/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
async function open(t){
  assert.ok(chromium&&executablePath,'local Chromium required');
  const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});
  const errors=[];
  t.after(async()=>{await browser.close();assert.deepEqual(errors,[],'no page runtime errors');});
  const ctx=await browser.newContext({serviceWorkers:'block'});
  await ctx.route('**/*',r=>r.request().url()==='http://display-truth.test/'?r.fulfill({status:200,contentType:'text/html',body:source}):r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://display-truth.test/',{waitUntil:'load'});
  return page;
}

/* A client whose `rpc` denies raw access AND denies the bounded display, which is exactly what an
   ordinary signed-out visitor sees when the display edition is unavailable. `from` is present so a
   missing method cannot be what produces the failure. */
const DENIED=`
  cloudEnabled=()=>true;
  supa={rpc:async()=>({error:{message:'synthetic denied'},data:null}),
        from:()=>{throw Error('raw table reached while raw access was denied');}};
`;

test('a failed prediction read is reported as a failure, never as "no predictions stored"',async t=>{
  const p=await open(t);
  const r=await p.evaluate(async d=>{
    eval(d.denied); retiredCount=async()=>0;
    await showPredictDate('2025-01-01');
    return $('fixtureList').textContent;
  },{denied:DENIED});
  assert.doesNotMatch(r,/No predictions stored/,'claimed the archive was empty');
  assert.match(r,/Couldn't load that day/);
  assert.match(r,/unavailable/i);
});

/* GUARD, NOT A PROOF OF THIS CHANGE. `renderArchiveDay`'s PREDICTION read already threw
   before this branch (index.html:16783), so this test passes against the pre-change file too.
   Independent QA confirmed that. It is kept as a regression guard on behaviour that already
   shipped, and labelled so nobody counts it as evidence for the fix. The four tests that do
   prove the fix each pin exactly one of the four changed call sites. */
test('[guard, pre-existing] a failed archive read is reported as a failure, never as an empty day',async t=>{
  const p=await open(t);
  const r=await p.evaluate(async d=>{
    eval(d.denied); retiredCount=async()=>0;
    $('archDate').value='2025-01-01';
    await renderArchiveDay();
    return $('archOut').textContent;
  },{denied:DENIED});
  assert.doesNotMatch(r,/Nothing stored for/,'claimed the day was empty');
  assert.match(r,/Couldn't read the archive/);
});

/* RAW ACCESS GRANTED, so `fixtureTable` uses `supa.from` directly and a failing result read can be
   isolated from a working prediction read. Without this the prediction read fails first and the
   assertion passes for the wrong reason. */
const RAW_GRANT=`
  cloudEnabled=()=>true;
  const chain=rows=>{const q={then:ok=>ok(rows)};
    for(const m of ['select','eq','neq','in','gte','gt','lte','lt','order','range','limit','is','not'])q[m]=()=>q;
    return q;};
  globalThis.mmChain=chain;
`;
function grantRaw(predRows){
  return `
   ${RAW_GRANT}
   supa={rpc:async name=>name==='matchmind_fixture_access_v1'
     ?{error:null,data:{version:'matchmind-fixture-access/1',raw_allowed:true,expires_at:new Date(Date.now()+60000).toISOString()}}
     :{error:{message:'synthetic denied'},data:null},
    from:table=>table==='fixtures'
      ? mmChain({data:null,error:{message:'synthetic result read denied'},count:null})
      : mmChain({data:${JSON.stringify(predRows)},error:null,count:${predRows.length}})};
   onAuth({id:'collector'});
   await fixtureAccess();
  `;
}
const PRED={fxid:971001,lid:39,lname:'Synthetic',lcountry:'Synthetic',kickoff:'2025-01-01',ktime:'12:00',
  home:'H',away:'A',pick:'1',pick_prob:0.6,p_home:0.6,p_draw:0.2,p_away:0.2,build:355,
  made_at:'2024-12-31T12:00:00Z',final_pick:null,withheld_at:null,market:'1X2'};

test('the archive reports an unreadable result read instead of showing picks as unsettled',async t=>{
  const p=await open(t);
  const r=await p.evaluate(async d=>{
    retiredCount=async()=>0;
    await (new Function('return (async()=>{'+d.setup+'})()'))();
    const original=JSON.stringify(d.pred);
    $('archDate').value='2025-01-01';
    await renderArchiveDay();
    return {text:$('archOut').textContent,unchanged:original===JSON.stringify(d.pred)};
  },{setup:grantRaw([PRED]),pred:PRED});
  assert.equal(r.unchanged,true,'the stored prediction row was mutated');
  assert.match(r.text,/Couldn't read the archive/,'results unreadable but the day rendered anyway');
  assert.doesNotMatch(r.text,/Nothing stored for/);
});

test('the day view reports an unreadable result read instead of showing picks as unsettled',async t=>{
  const p=await open(t);
  const r=await p.evaluate(async d=>{
    retiredCount=async()=>0;
    await (new Function('return (async()=>{'+d.setup+'})()'))();
    await showPredictDate('2025-01-01');
    return $('fixtureList').textContent;
  },{setup:grantRaw([PRED])});
  assert.match(r,/Couldn't load that day/,'results unreadable but the day rendered anyway');
  assert.doesNotMatch(r,/No predictions stored/);
});

test('the ledger reports an unreadable result read instead of showing picks as unsettled',async t=>{
  const p=await open(t);
  const r=await p.evaluate(async d=>{
    await (new Function('return (async()=>{'+d.setup+'})()'))();
    await renderLedger();
    return $('ledgerOut').textContent;
  },{setup:grantRaw([{...PRED,kickoff:new Date(Date.now()-86400000).toISOString().slice(0,10)}])});
  assert.match(r,/Could not read the ledger/,'results unreadable but the ledger rendered anyway');
  assert.doesNotMatch(r,/Nothing published in the last/);
});
