// Offline browser acceptance of the actual source AND generated real-preview renderer.
// Synthetic approved fields exercise presentation only; all external traffic is aborted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {realTransform} from '../staging/build-real-preview.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PWA_PLAYWRIGHT||'playwright-core');
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const manifest=readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8');
const generated=realTransform(source,manifest).html;
const expected=['acc-result','acc-goals','acc-combo','acc-htft','acc-score','acc-scorers','acc-form','acc-standings','acc-analysis'];
async function open(t,html,width){
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});await context.route('**/*',r=>r.request().url()==='http://detail-restore.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await context.addInitScript(()=>{localStorage.setItem('mm_intro','1');localStorage.setItem('mm-real-preview:mm_intro','1');});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));await page.goto('http://detail-restore.test/');return page;
}
async function show(page,{issued=true,full=true,finished=false,dnb=false,selectionKind='prediction',originalInputs=true}={}){return page.evaluate(({issued,full,finished,dnb,selectionKind,originalInputs})=>{
 const source_at='2026-11-13T12:00:00Z';
 const analysis={source:'published-football-analysis',source_at,xg_home:1.8,xg_away:.9,result:{p_home:.51,p_draw:.29,p_away:.2},
  goals:[{label:'Over 2.5',prob:.56}],combos:[{label:'1 & Over 2.5',prob:.34}],htft:[{label:'1/1',prob:.32}],correct_scores:[{label:'2–0',prob:.12}],scorers:[{label:'Verified player',prob:.38}],
  form:{home:['W','D','W','L','W'],away:['D','L','W','D','L']},h2h:[{date:'2026-08-10',home:'Leganes',away:'Burgos',gh:2,ga:1}],
  standings:{season:2026,rows:[{rank:1,team:'Leganes',played:10,won:6,drawn:2,lost:2,gf:17,ga:9,points:20},{rank:8,team:'Burgos',played:10,won:3,drawn:3,lost:4,gf:11,ga:14,points:12}]},
  writeup:{text:'Approved cached AI write-up. Leganes have three wins in their last five matches; Burgos have one. This text is deliberately longer than two lines to verify that only the Professional AI Write-up is exempt.',source:'server-cache/openrouter/anthropic/claude-sonnet-4.5:thinking-20261101',source_at}};
 const p=issued?{lid:140,lname:'La Liga 2',home:'Leganes',away:'Burgos',pick:dnb?'1D':'1',pick_prob:dnb?.75:.6,market:dnb?'DNB':'Winner',p_home:.6,p_draw:.2,p_away:.2,xg_home:1.7,xg_away:.8,kickoff:'2026-11-14',ktime:'20:00',made_at:source_at,withheld_at:null,final_pick:null,build:355}:null;
 if(p&&!originalInputs){p.p_home=null;p.p_draw=null;p.p_away=null;p.xg_home=null;p.xg_away=null;}
 const card={fxid:990999,lid:140,lname:'La Liga 2',lcountry:'Spain',date:'2026-11-14',time:'20:00',status:finished?'FT':'NS',home:'Leganes',away:'Burgos',gh:finished?2:null,ga:finished?1:null,ft_h:finished?2:null,ft_a:finished?1:null,prediction:p,analysis:full?analysis:null};
 const f=fixturePresentationRow(card,null),L={id:140,name:'La Liga 2',country:'Spain',matches:[],upcoming:[f],_presentation:true};afState.leagues={140:L};
 const before=JSON.stringify({card,f,archive:afState.archive});footballEngine.predict=()=>{throw Error('no refit');};footballEngine.marketsFor=()=>{throw Error('no new market calculation');};
 if(selectionKind==='prediction')showPublishedFixture(L,f);
 else if(typeof openIssuedForecast==='function'){const leg={fxid:f.fxid,d:card.date,t:card.time,h:card.home,a:card.away,code:'1X',p:.88,market:'Double Chance'};_sharedSlips={loaded:true,rows:[{day:card.date,tier:'banker',build:358,step:'issued',legs:[leg]}]};openIssuedForecast(leg);}
 else {showPublishedFixture(L,f);renderPublishedAnalysis(L,f,{...p,pick:'1X',pick_prob:.88},selectionKind);}
 document.querySelectorAll('#view-detail .acc').forEach(x=>x.classList.add('open'));scrollTo(0,0);
 const lineViolations=[...document.querySelectorAll('#view-detail .subnote,#view-detail .plabel,#view-detail .hm-comp,#view-detail .hm-dt,#view-detail .tname>div:not(.venue),#view-detail #heroDnb,#view-detail #verdictBox')].filter(el=>el.getClientRects().length&&el.textContent.trim()).map(el=>{const s=getComputedStyle(el);return{id:el.id||el.className,text:el.textContent,lines:(el.getBoundingClientRect().height-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom)-parseFloat(s.borderTopWidth)-parseFloat(s.borderBottomWidth))/(parseFloat(s.lineHeight)||parseFloat(s.fontSize)*1.2)}}).filter(x=>x.lines>2.1);
 return{sections:[...document.querySelectorAll('#view-detail .acc:not(.hidden)')].map(x=>x.id),bars:$('outcomeRows').textContent,goals:$('goalsRows').textContent,form:$('formBox').textContent,h2h:$('h2hBox').textContent,table:$('standingsBox').textContent,ai:$('analysisText').textContent,heading:$('analysisHeading').textContent,pick:$('heroPick').textContent,dnb:$('heroDnb').textContent,xg:$('xgInfo').textContent,preserved:before===JSON.stringify({card,f,archive:afState.archive}),overflow:document.documentElement.scrollWidth>innerWidth+1,lineViolations};
 },{issued,full,finished,dnb,selectionKind,originalInputs});}
for(const [mode,html] of [['source',source],['real-preview',generated]])for(const width of [320,390]){
 for(const issued of [true,false])test(`${mode} ${width}px: ${issued?'issued pick':'no qualifying pick'} shows every supported panel`,async t=>{
  const page=await open(t,html,width),r=await show(page,{issued});assert.deepEqual(r.sections,expected);assert.match(r.bars,issued?/60.0%/:/51.0%/);assert.match(r.goals,/56.0%/);assert.match(r.form,/WDWLW/);assert.match(r.h2h,/2–1/);assert.match(r.table,/20/);assert.match(r.ai,/Approved cached/);assert.equal(r.heading,'Professional AI Write-up');assert.equal(r.preserved,true);assert.equal(r.overflow,false);assert.deepEqual(r.lineViolations,[]);
  assert.match(await page.locator('#heroMeta').textContent(),/La Liga 2.*Spain/s);
  if(process.env.MM_UI_SCREENSHOTS){mkdirSync(process.env.MM_UI_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.MM_UI_SCREENSHOTS+`/${mode}-${width}-${issued?'issued':'no-pick'}.png`,fullPage:true});}
 });
 test(`${mode} ${width}px: issued-slip keeps available fixture analysis separate from selection`,async t=>{const page=await open(t,html,width),r=await show(page,{selectionKind:'issued-slip'});assert.deepEqual(r.sections,expected);assert.match(r.goals,/56.0%/);assert.match(r.bars,/60.0%/);assert.doesNotMatch(r.bars,/88.0%/);assert.match(r.bars,/separate from this pick/);assert.equal(r.preserved,true);assert.deepEqual(r.lineViolations,[]);});
 test(`${mode} ${width}px: issued pick without original inputs keeps separately published analysis`,async t=>{const page=await open(t,html,width),r=await show(page,{originalInputs:false});assert.match(r.bars,/51.0%/);assert.match(r.bars,/published separately/);assert.match(r.xg,/1.80.*0.90/);assert.equal(r.preserved,true);assert.deepEqual(r.lineViolations,[]);});
 test(`${mode} ${width}px: missing inputs are honest, concise and clear previous fixture`,async t=>{const page=await open(t,html,width);await show(page);const r=await show(page,{issued:false,full:false});assert.deepEqual(r.sections,expected);assert.match(r.goals,/not published/);assert.doesNotMatch(r.form,/WDWLW/);assert.doesNotMatch(r.ai,/Approved cached/);assert.deepEqual(r.lineViolations,[]);assert.equal(r.overflow,false);});
 test(`${mode} ${width}px: completed DNB preserves original unconditional 1X2`,async t=>{const page=await open(t,html,width),r=await show(page,{finished:true,dnb:true});assert.match(r.bars,/60.0%/);assert.doesNotMatch(r.bars,/75.0%|51.0%/);assert.match(r.dnb,/excludes draws/);assert.equal(r.preserved,true);assert.deepEqual(r.lineViolations,[]);});
}

for(const [mode,html] of [['source',source],['real-preview',generated]])for(const width of [320,390])for(const status of ['FT','2H'])test(`${mode} ${width}px: actual ${status} Scores click keeps bounded football analysis before leagues load`,async t=>{
 const page=await open(t,html,width);
 await installScores(page,status);
 await page.evaluate(async()=>{await afScoresFromCloud();navTo('scores');renderScores();});
 await page.locator('#scoresList .scrow .tline').first().click();
 await page.waitForFunction(()=>$('view-detail').getClientRects().length&&$('outcomeRows').textContent.includes('60.0%'));
 const r=await page.evaluate(()=>({sections:[...document.querySelectorAll('#view-detail .acc:not(.hidden)')].map(el=>el.id),raw:rawScoreCalls,bars:$('outcomeRows').textContent,goals:$('goalsRows').textContent,form:$('formBox').textContent,meta:$('heroMeta').textContent,pick:$('heroPick').textContent,card:afState.leagues[141].upcoming[0]._displayCard,overflow:document.documentElement.scrollWidth>innerWidth+1}));
 assert.deepEqual(r.sections,expected);assert.deepEqual(r.raw,[]);assert.match(r.bars,/60.0%/);assert.match(r.goals,/56.0%/);assert.match(r.form,/WD/);assert.match(r.pick,/DNB|draw no bet/i);assert.equal(r.card.prediction.pick_prob,.75);assert.equal(r.card.analysis.xg_home,1.8);assert.equal(r.overflow,false);if(status==='FT')assert.match(r.meta,/90-minute score 2–1/);
});

async function installScores(page,status,{delay=false,historyEdition=false}={}){
 await page.evaluate(({status,delay,historyEdition})=>{
  const date=todayStrLocal(),asof=new Date(Date.now()-1000).toISOString(),expires=new Date(Date.now()+3600000).toISOString();
  const prediction={lid:141,lname:'Segunda Division',home:'Leganes',away:'Burgos',pick:'1D',pick_prob:.75,market:'DNB',p_home:.6,p_draw:.2,p_away:.2,xg_home:1.7,xg_away:.8,kickoff:date,ktime:'20:00',made_at:asof,withheld_at:null,final_pick:null,build:355};
  const card={fxid:990998,lid:141,lname:'Segunda Division',lcountry:'Spain',date,time:'20:00',status,elapsed:status==='2H'?60:null,home:'Leganes',away:'Burgos',gh:2,ga:1,ft_h:status==='FT'?2:null,ft_a:status==='FT'?1:null,ht_h:1,ht_a:0,updated_at:asof,provider:'af',prediction,analysis:{source:'published-board',source_at:asof,result:{p_home:.51,p_draw:.29,p_away:.2},xg_home:1.8,xg_away:.9,goals:[{label:'Over 2.5',prob:.56}],form:{home:['W','D'],away:['L','W']},h2h:[{date:'2026-08-10',home:'Leganes',away:'Burgos',gh:2,ga:1}]}};
  window.expectedCard=card;window.rawScoreCalls=[];const historyGate=delay?new Promise(resolve=>window.releaseHistory=resolve):Promise.resolve();supa={auth:{getSession:async()=>({data:{session:null},error:null})},from:name=>{rawScoreCalls.push(name);throw Error('no raw reader');},rpc:async(name,args)=>{
   if(name==='matchmind_fixture_access_v1')return{data:{version:'matchmind-fixture-access/1',raw_allowed:false},error:null};
   const screen=args.screen;if(screen==='history')await historyGate;return{data:{version:'matchmind-display/1',edition_id:screen==='history'&&historyEdition?'66666666-1111-4666-8666-666666666666':'55555555-1111-4555-8555-555555555555',as_of:asof,expires_at:expires,screen,cards:['scores','predictions','history'].includes(screen)?[{...card,prediction:screen==='scores'?null:prediction}]:[],board:null,records:{engine:null,clv:null},slips:[]},error:null};
  }};fixtureDeliveryReset();afState.leagues={};afState.leagueOrder=[];afState.filter='all';afState.scoreFilter='all';afState.scoresDate=date;footballEngine.predict=()=>{throw Error('no refit');};footballEngine.marketsFor=()=>{throw Error('no generation');};
 },{status,delay,historyEdition});
}

for(const [mode,html]of [['source',source],['real-preview',generated]]){
 test(`${mode}: delayed Scores history cannot reopen detail after tab navigation`,async t=>{const page=await open(t,html,320);await installScores(page,'FT',{delay:true});await page.evaluate(async()=>{await afScoresFromCloud();navTo('scores');renderScores();const original=matchDetail;matchDetail=s=>window.pendingDetail=original(s);});await page.locator('#scoresList .scrow .tline').first().click();await page.evaluate(async()=>{navTo('data');releaseHistory();await pendingDetail;});assert.equal(await page.evaluate(()=>curView),'data');});
 test(`${mode}: Scores refuses cross-edition issued identity while retaining source analysis`,async t=>{const page=await open(t,html,320);await installScores(page,'FT',{historyEdition:true});await page.evaluate(async()=>{await afScoresFromCloud();navTo('scores');renderScores();const original=matchDetail;matchDetail=s=>window.pendingDetail=original(s);});await page.locator('#scoresList .scrow .tline').first().click();await page.evaluate(()=>pendingDetail);const r=await page.evaluate(()=>({pick:$('heroPick').textContent,bars:$('outcomeRows').textContent}));assert.match(r.pick,/Published pick unavailable/);assert.match(r.bars,/51.0%/);assert.doesNotMatch(r.bars,/60.0%/);});
}

for(const [mode,html]of [['source',source],['real-preview',generated]]){
 test(`${mode}: delayed Scores history cannot reopen detail after account change`,async t=>{const page=await open(t,html,320);await installScores(page,'FT',{delay:true});await page.evaluate(async()=>{await afScoresFromCloud();navTo('scores');renderScores();const original=matchDetail;matchDetail=s=>window.pendingDetail=original(s);});await page.locator('#scoresList .scrow .tline').first().click();await page.evaluate(async()=>{authUser={id:'different-account'};++_cloudAccountEpoch;releaseHistory();await pendingDetail;});assert.equal(await page.evaluate(()=>curView),'scores');});
 test(`${mode}: repeated Scores clicks only render the latest detail request`,async t=>{const page=await open(t,html,320);await installScores(page,'FT',{delay:true});await page.evaluate(async()=>{await afScoresFromCloud();navTo('scores');renderScores();window.detailCalls=[];window.detailRenders=0;const original=matchDetail,render=showPublishedFixture;matchDetail=s=>{const p=original(s);detailCalls.push(p);return p;};showPublishedFixture=(...args)=>{detailRenders++;return render(...args);};});await page.locator('#scoresList .scrow .tline').first().click();await page.locator('#scoresList .scrow .tline').first().click();await page.evaluate(async()=>{releaseHistory();await Promise.all(detailCalls);});assert.equal(await page.evaluate(()=>detailRenders),1);assert.equal(await page.evaluate(()=>curView),'detail');});
}

for(const [mode,html]of [['source',source],['real-preview',generated]])for(const width of [320,390])test(`${mode} ${width}px: long genuine team identities fit without clipping names or probabilities`,async t=>{
 const page=await open(t,html,width);
 const violations=await page.evaluate(()=>{const out=[];for(const home of ['Brighton & Hove Albion','Chongqing Tongliang Long','SG Sonnenhof Grossaspach','Western Sydney Wanderers','Guidonia Montecelio 1937','Strasbourg Koenigshoffen','Borussia Mönchengladbach','Hemel Hempstead Town']){
  const card={fxid:990997,lid:39,lname:'Example League',lcountry:'Example',home,away:'Away Club',date:todayStrLocal(),time:'20:00',status:'NS',prediction:{home,away:'Away Club',lname:'Example League',pick:'1',pick_prob:.6,p_home:.6,p_draw:.2,p_away:.2,xg_home:1.7,xg_away:.8,kickoff:todayStrLocal(),ktime:'20:00',made_at:new Date().toISOString(),withheld_at:null}};
  const f=fixturePresentationRow(card,null),L={id:39,name:card.lname,country:card.lcountry,_presentation:true,matches:[],upcoming:[f]};showPublishedFixture(L,f);
  if(!$('heroHome').textContent.includes(home)||!$('outcomeRows').textContent.includes(home)||!$('outcomeRows').textContent.includes('60.0%'))out.push({home,missing:true});
  for(const el of document.querySelectorAll('#view-detail .plabel,#view-detail .tname>div:not(.venue)')){if(!el.getClientRects().length)continue;const r=document.createRange();r.selectNodeContents(el);const lines=new Set([...r.getClientRects()].filter(x=>x.width&&x.height).map(x=>Math.round(x.top))).size;if(lines>2)out.push({home,text:el.textContent,lines});if(getComputedStyle(el).webkitLineClamp!=='none'&&getComputedStyle(el).webkitLineClamp!=='')out.push({home,clamped:true});}
 }return out;});assert.deepEqual(violations,[]);
});
