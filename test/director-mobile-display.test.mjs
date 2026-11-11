// Focused public UI regressions. All non-document traffic is blocked; no live Auth or data writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PWA_PLAYWRIGHT||'playwright-core');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

async function open(t,width=390){
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking']});
 t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:844},timezoneId:'Africa/Lagos'});
 await context.addInitScript(()=>localStorage.setItem('mm_intro','1'));
 await context.route('**/*',r=>r.request().url()==='http://director-mobile.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 t.after(()=>assert.deepEqual(errors,[],'no runtime errors'));
 await page.goto('http://director-mobile.test/');
 return page;
}

// Exercise the real capability, envelope-validation and table-projection path, not a tally stub.
async function install(page,{record='loaded',delay=false}={}){
 await page.evaluate(({record,delay})=>{
  const now=Date.now(),asOf=new Date(now-35*60000).toISOString(),expires=new Date(now+23*3600000).toISOString();
  const date=new Date(now+86400000).toISOString().slice(0,10),day=todayStrLocal();
  const prediction={lid:39,lname:'Synthetic League',home:'Willow Vale',away:'Granite Rangers',pick:'1',pick_prob:.64,market:'Winner',p_home:.64,p_draw:.2,p_away:.16,xg_home:1.8,xg_away:.9,kickoff:date,ktime:'23:59',made_at:asOf,withheld_at:null,final_pick:null,build:358};
  const card={fxid:990399,lid:39,lname:'Synthetic League',lcountry:'Synthetic',date,time:'23:59',status:'NS',elapsed:null,home:prediction.home,away:prediction.away,gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:new Date(now-45*3600000).toISOString(),provider:'af',prediction};
  const aggregate={key:'engine',build:358,computed_at:asOf,payload:{v:1,days:{[day]:{'Winner':[7,3,1]}},total:11,graded:10,withheld:0,excluded:0,pending:0,orphan:0,off:0,ungradeable:0,voidLate:0}};
  window.mobileFixture={card,aggregate,asOf,expires};window.recordMode=record;window.recordCalls=0;
  const gate=delay?new Promise(r=>{window.releaseRecord=r;}):Promise.resolve();
  supa={rpc:async(name,args)=>{
   if(name==='matchmind_fixture_access_v1')return{data:{version:'matchmind-fixture-access/1',raw_allowed:false},error:null};
   const screen=args.screen;
   if(screen==='records'){
    recordCalls++;await gate;
    if(recordMode==='failed')return{data:null,error:{message:'synthetic unavailable'}};
   }
   return{error:null,data:{version:'matchmind-display/1',edition_id:'33333333-2222-4333-8444-555555555555',as_of:asOf,expires_at:expires,screen,
    cards:['predictions','history','scores'].includes(screen)?[card]:[],board:null,
    records:{engine:screen==='records'&&recordMode!=='empty'?aggregate:null,clv:null},slips:[]}};
  },from:()=>{throw Error('private table must not be read');}};
  fixtureDeliveryReset();_engineRecord={state:'pending',payload:null,computedAt:null,build:null,at:0};_engineRecordLoading=null;
 },{record,delay});
}

test('opening More starts a pending read, renders the real Records aggregate, and preserves its payload',async t=>{
 const p=await open(t);await install(p,{delay:true});
 await p.evaluate(()=>navTo('data'));
 assert.match(await p.locator('#moreRecordLine').textContent(),/Reading the shared record/);
 await p.evaluate(()=>{window.recordBefore=JSON.stringify(mobileFixture.aggregate);releaseRecord();});
 await p.waitForFunction(()=>_engineRecord.state==='loaded'&&$('moreRecordLine').textContent.includes('7/10'));
 const r=await p.evaluate(()=>({text:$('moreRecordLine').textContent,calls:recordCalls,preserved:recordBefore===JSON.stringify(mobileFixture.aggregate)}));
 assert.equal(r.calls,1);assert.match(r.text,/70\.0%/);assert.match(r.text,/1 void/);assert.equal(r.preserved,true);
});

test('public fixture boot also loads Records; an unrelated Tips render failure cannot leave Accuracy pending',async t=>{
 const p=await open(t);await install(p);
 await p.evaluate(async()=>{renderStrongPicks=()=>{throw Error('synthetic unrelated render failure');};await loadCloudLeagues(true);await loadSharedRecords();});
 assert.match(await p.locator('#moreRecordLine').textContent(),/7\/10/);
 assert.equal(await p.evaluate(()=>_engineRecord.state),'loaded');
});

for(const mode of ['empty','failed'])test('More settles '+mode+' Records reads honestly and retries failures on reopen',async t=>{
 const p=await open(t);await install(p,{record:mode});
 await p.evaluate(()=>navTo('data'));
 await p.waitForFunction(mode=>_engineRecord.state===mode,mode);
 const text=await p.locator('#moreRecordLine').textContent();
 assert.doesNotMatch(text,/Reading|spinner|70\.0%/);
 assert.match(text,mode==='empty'?/No graded picks/:/Could not read/);
 if(mode==='failed'){
  await p.evaluate(()=>{recordMode='loaded';navTo('scores');navTo('data');});
  await p.waitForFunction(()=>$('moreRecordLine').textContent.includes('7/10'));
  assert.equal(await p.evaluate(()=>recordCalls),2);
 }
});

test('an initially unavailable client does not prevent a later successful Records read',async t=>{
 const p=await open(t);await install(p);
 const first=await p.evaluate(async()=>{
  window.readyClient=supa;supa=null;navTo('data');await _engineRecordLoading;
  return $('moreRecordLine').textContent;
 });
 assert.match(first,/Could not read/);
 await p.evaluate(async()=>{supa=readyClient;navTo('data');await _engineRecordLoading;});
 assert.match(await p.locator('#moreRecordLine').textContent(),/7\/10/);
});

for(const width of [320,390])test('published Analysis is concise, aligned and unchanged at '+width+'px',async t=>{
 const p=await open(t,width);await install(p);
 const r=await p.evaluate(async()=>{
  await loadCloudLeagues(true);const L=afState.leagues[39],f=L.upcoming[0],before=JSON.stringify({f,archive:afState.archive});
  footballEngine.predict=()=>{throw Error('must not recompute');};showPublishedFixture(L,f);
  $('acc-analysis').classList.remove('collapsed');
  const el=$('analysisText'),style=getComputedStyle(el);
  return{text:el.textContent,align:style.textAlign,hyphens:style.hyphens,bars:$('outcomeRows').textContent,
   preserved:before===JSON.stringify({f,archive:afState.archive}),overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
 assert.ok(r.text.length<250);assert.match(r.text,/league table.*unavailable/);assert.match(r.text,/independent AI analysis.*unavailable/);
 assert.equal(r.align,'left');assert.equal(r.hyphens,'none');assert.match(r.bars,/64\.0%/);assert.equal(r.preserved,true);assert.equal(r.overflow,false);
 await p.evaluate(()=>{document.documentElement.dir='rtl';});
 assert.equal(await p.locator('#analysisText').evaluate(el=>getComputedStyle(el).textAlign),'right');
});

test('Scores distinguishes a 45-hour source update from a 35-minute edition and retains both ages after refresh failure',async t=>{
 const p=await open(t);await install(p);
 const r=await p.evaluate(async()=>{
  await afScoresFromCloud();afState.scoresDate=localDateOf(mobileFixture.card);afState.filter='all';afState.scoreFilter='all';renderScores();
  const initial=$('scoresMeta').textContent;scoresReadFailed('synthetic failure');
  return{initial,failed:$('scoresMeta').textContent,dataAt:afState.scores.dataAt,sourceAt:Date.parse(mobileFixture.card.updated_at),asOf:afState.scores.editionAsOf};
 });
 assert.match(r.initial,/Source updated 45 hours ago/);assert.match(r.initial,/Edition published 35 min ago/);
 assert.match(r.failed,/Refresh failed.*Source updated 45 hours ago.*Edition published 35 min ago/);
 assert.equal(r.dataAt,r.sourceAt);assert.ok(r.asOf);
});

test('a missing source timestamp is unknown, never made fresh by a successful read',async t=>{
 const p=await open(t);await install(p);
 const r=await p.evaluate(async()=>{
  mobileFixture.card.updated_at=null;await afScoresFromCloud();afState.scoresDate=localDateOf(mobileFixture.card);renderScores();
  return{text:$('scoresMeta').textContent,at:afState.scores.dataAt};
 });
 assert.match(r.text,/Source updated unknown/);assert.equal(r.at,null);
});

test('version labels identify app versus legal text, and time-zone copy cannot become a stale clock',async t=>{
 const p=await open(t);
 const r=await p.evaluate(()=>{
  prefs.tz='';renderTzSetting();const device=$('tzHint').textContent;
  prefs.tz='America/New_York';renderTzSetting();
  return{app:$('verLabel').textContent,legal:$('legalDraftNote').textContent,footer:legalFooter(),device,selected:$('tzHint').textContent};
 });
 assert.match(r.app,/App v0\.9 · build 358/);assert.match(r.legal,/Legal text v1\.0/);assert.match(r.footer,/Legal text v1\.0/);
 assert.match(r.device,/Africa\/Lagos.*device/);assert.match(r.selected,/America\/New_York/);
 assert.doesNotMatch(r.device+r.selected,/right now|\d\d:\d\d/);
});

test('missing predictions are explained without inventing a pick; a 64% listing is not promised as a slip leg',async t=>{
 const p=await open(t);await install(p);
 const r=await p.evaluate(async()=>{
  await loadCloudLeagues(true);const L=afState.leagues[39],f=L.upcoming[0],original=JSON.stringify({f,archive:afState.archive});
  // The displayed probability survives; date, league, market and board-passed membership still govern slips.
  _boardRecord={state:'loaded',payload:{v:1,rows:[]}};
  slipState.today=false;slipState.leagues=new Set([L.id]);slipState.markets=new Set(['1X2']);slipState.riskPct=75;
  renderSlipUI();genSlip();const empty=$('slipOut').textContent,risk=$('riskLabel').textContent;
  const before=Object.keys(slipPool(slipCandidatesFromBoard({todayOnly:false,leagues:slipState.leagues,markets:slipState.markets}),75)).length;
  _boardRecord.payload.rows=[{f:f.fxid,l:L.id,p:'1',q:.64,m:'Winner',g:null}];
  slipState.markets=new Set(['OU35']);
  const wrongMarket=Object.keys(slipPool(slipCandidatesFromBoard({todayOnly:false,leagues:slipState.leagues,markets:slipState.markets}),75)).length;
  slipState.markets=new Set(['1X2']);
  const after=Object.keys(slipPool(slipCandidatesFromBoard({todayOnly:false,leagues:slipState.leagues,markets:slipState.markets}),75)).length;
  const preserved=original===JSON.stringify({f,archive:afState.archive});
  const missing={...f,fxid:990400,pick:null,prob:null,_displayCard:true,_hasPrediction:false};
  showPublishedFixture(L,missing);
  return{empty,risk,before,wrongMarket,after,preserved,label:PICK_STATUS.norow.label,missing:$('analysisText').textContent};
 });
 assert.match(r.empty,/No eligible slip legs.*selected dates, leagues and markets/);assert.match(r.risk,/minimum published probability 25%/);
 assert.equal(r.before,0);assert.equal(r.wrongMarket,0);assert.equal(r.after,1);assert.equal(r.preserved,true);
 assert.equal(r.label,'No published prediction');assert.match(r.missing,/No published prediction/);assert.doesNotMatch(r.missing,/Original published prediction/);
});

test('public client cannot become publisher and exposes no active provider-key controls',async t=>{
 const p=await open(t);
 const r=await p.evaluate(()=>{
  authUser={id:'synthetic-publisher',email:'synthetic-publisher@example.invalid'};
  return{publisher:isPublisher(),controls:['afKey','aiKeyInput','afSaveKey','aiSaveBtn','afKeyUse','aiKeyUse'].filter(id=>$(id)?.matches('input,button,select,textarea')),personal:PERSONAL_PROVIDER_INPUTS_ENABLED};
 });
 assert.equal(r.publisher,false);assert.deepEqual(r.controls,[]);assert.equal(r.personal,false);
});
