// Synthetic offline Director 5 regressions. All non-document traffic is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const driver=require(process.env.PWA_PLAYWRIGHT||'playwright-core');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
async function open(t){
 const webkit=process.env.MM_DIRECTOR_BROWSER==='webkit';
 const browser=await driver[webkit?'webkit':'chromium'].launch(webkit?{}:{executablePath:process.env.PWA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
 await ctx.addInitScript(()=>{localStorage.setItem('mm_intro','1');});
 await ctx.route('**/*',r=>r.request().url()==='http://director5.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));await page.goto('http://director5.test/');return page;
}
const rig=`
 const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
 globalThis.card=(status='NS',old=-4,current=1)=>({fxid:987650,lid:2,lname:'Champions League',lcountry:'Europe',date:day(current),time:'12:00',status,elapsed:null,provider:'af',home:'Home',away:'Away',gh:null,ga:null,prediction:{lid:2,lname:'Champions League',home:'Home',away:'Away',kickoff:day(old),ktime:'12:00',pick:'2D',pick_prob:.77,p_home:.1,p_draw:.2,p_away:.7,build:358}});
 globalThis.installRow=r=>{const f=fixturePresentationRow(r,null);f.edge=.2;afState.archive={[r.fxid]:archiveRow(r.prediction)};afState.leagues={2:{id:2,name:r.lname,country:'Europe',_presentation:true,upcoming:[f],matches:[]}};afState.leagueOrder=[2];afState.cloudFix={};afState.filter='all';afState.selectedDate=r.date;afState.archiveDate=null;return {f,L:afState.leagues[2]};};
`;
for(const [status,label]of [['PST','Postponed'],['ABD','Abandoned'],['CANC','Cancelled'],['SUSP','Suspended'],['INT','Interrupted']])test(status+' displays immediately before kickoff on Analysis, Scores and details',async t=>{
 const page=await open(t);const x=await page.evaluate(({rig,status})=>{eval(rig);const r=card(status,1,1),before=JSON.stringify(r);const{L,f}=installRow(r);renderFixtures();const analysis=$('fixtureList').textContent;showPublishedFixture(L,f);const detail=$('heroMeta').textContent;afState.scoresDate=r.date;afState.scores={at:Date.now(),list:[r]};renderScores();return{analysis,detail,scores:$('scoresList').textContent,unchanged:before===JSON.stringify(r),chip:fxCells(L,f,{}).chip};},{rig,status});
 for(const v of [x.analysis,x.detail,x.scores])assert.ok(v.toLowerCase().includes(label.toLowerCase()),v);assert.ok(x.chip.includes(label));assert.ok(!x.chip.includes('77%'));assert.equal(x.unchanged,true);
});
test('current schedule is separate from frozen original prediction; missing delayed score never expires it',async t=>{
 const p=await open(t);const x=await p.evaluate(rig=>{eval(rig);const r=card('NS',-4,1);const{f,L}=installRow(r);const before=JSON.stringify(afState.archive);const chip=fxCells(L,f,{}).chip;r.date=r.prediction.kickoff;const same=fixturePresentationRow(r,null);const pending=fxCells(L,same,{}).chip;return{date:f.date,current:r.date,original:afState.archive[r.fxid].kickoff,chip,pending,unchanged:before===JSON.stringify(afState.archive)};},rig);
 assert.notEqual(x.date,x.original);assert.ok(x.chip.includes('Pick expired'),'confirmed moved schedule beyond 48 hours');assert.ok(x.pending.includes('77%'),'NS with no evidence of non-play retains original pick');assert.equal(x.unchanged,true);
});
test('postponement expiry requires original 48-hour window; interrupted states alone never expire',async t=>{
 const p=await open(t);const x=await p.evaluate(rig=>{eval(rig);return [['PST',1],['PST',-4],['CANC',-4],['ABD',-4],['SUSP',-4],['INT',-4]].map(([s,d])=>{const{f,L}=installRow(card(s,d,d));return{expired:forecastDisplayExpired(f),chip:fxCells(L,f,{}).chip,pick:afState.archive[f.fxid].pick,prob:afState.archive[f.fxid].prob};});},rig);
 assert.deepEqual(x.map(v=>v.expired),[false,true,true,false,false,false]);for(const v of x){assert.equal(v.pick,'2D');assert.equal(v.prob,.77);assert.match(v.chip,/(Postponed|Cancelled|Abandoned|Suspended|Interrupted)/);assert.ok(!v.chip.includes('77%'));}
});
test('Top Matches excludes exceptional fixtures and expired picks while normal badges survive',async t=>{
 const p=await open(t);const x=await p.evaluate(rig=>{eval(rig);const out=[];for(const s of ['NS','PST','ABD','CANC','SUSP','INT']){const{f,L}=installRow(card(s,1,1));renderFixtures();out.push({s,top:$('fixtureList').textContent.includes('Top Matches'),chip:fxCells(L,f,{}).chip});}installRow(card('NS',-4,1));renderFixtures();return {out,expiredTop:$('fixtureList').textContent.includes('Top Matches')};},rig);
 assert.equal(x.out[0].top,true);for(const r of x.out.slice(1))assert.equal(r.top,false,r.s);assert.equal(x.expiredTop,false);assert.ok(x.out[0].chip.includes('2 DNB · 77%'));
});
test('completed DNB draw is neutral Void and normal wins/losses keep ticks/crosses',async t=>{
 const p=await open(t);const x=await p.evaluate(rig=>{eval(rig);const r=card('FT',0,0),{L,f}=installRow(r);return [[0,0],[0,1],[1,0]].map(([gh,ga])=>fxCells(L,f,{[f.fxid]:{...r,gh,ga}}).chip);},rig);
 assert.match(x[0],/muted-chip.*2 DNB · Void/);assert.match(x[1],/hit.*✓/);assert.match(x[2],/miss.*✗/);
});
test('Scores cloud row names and status are text, never executable markup',async t=>{
 const p=await open(t);const x=await p.evaluate(()=>{const bad='<img src=x onerror="window.injected=1">';const date=ymdOffset(0);afState.scoresDate=date;afState.filter='all';afState.scores={at:Date.now(),list:[{fxid:990123,lid:2,lname:bad,lcountry:bad,home:bad,away:bad,date,time:'12:00',status:bad,gh:null,ga:null}]};renderScores();return{text:$('scoresList').textContent,images:$('scoresList').querySelectorAll('img[src="x"]').length,injected:window.injected||0};});assert.ok(x.text.includes('<img'));assert.equal(x.images,0);assert.equal(x.injected,0);
});
test('public guest and ordinary account no-SDK paths never ask for personal keys',async t=>{
 const p=await open(t);const x=await p.evaluate(async()=>{const texts=[];window.alert=m=>texts.push(m);for(const user of [null,{id:'synthetic-A'}]){authUser=user;supa=null;await afDiscover();await afScores();renderAccount();renderCompsDrop();texts.push($('scoresMeta').textContent,$('acctBox').textContent);}return{text:texts.join(' '),html:$('acctBox').textContent};});assert.doesNotMatch(x.text,/Add your|anon key|API-Football key|Claude key|Supabase URL/i);assert.doesNotMatch(x.html,/If you enter your own Claude key/);
});
test('same fixture settles two frozen shared cards independently without mutating issued rows',async t=>{
 const p=await open(t);const x=await p.evaluate(async()=>{const fxid=990124;const legs=[{fxid,d:'2026-11-01',h:'Shared Home',a:'Shared Away',code:'1',p:.7},{fxid,d:'2026-11-01',h:'Shared Home',a:'Shared Away',code:'O25',p:.6}];const rows=legs.map((l,i)=>({day:'2026-11-01',tier:i?'Bold':'Balanced',odds:i?2.2:1.5,legs:[l]}));const frozen=JSON.stringify(rows);cloudEnabled=()=>true;supa={};let reads=0;fixtureTable=()=>({select:()=>({in:async(_key,ids)=>{reads++;return{data:[{fxid,status:'FT',gh:1,ga:0,ft_h:1,ft_a:0,ht_h:0,ht_a:0,updated_at:new Date().toISOString()}],error:null};}})});await sharedResultsLoad(rows);const grades=dailyLogGrade(rows);return{grades,reads,unchanged:JSON.stringify(rows)===frozen};});assert.equal(x.unchanged,true);assert.equal(x.reads,1,'one authoritative result read for the shared fixture');assert.deepEqual(x.grades.map(g=>g.legGrades),[['hit'],['miss']]);assert.deepEqual(x.grades.map(g=>g.hit),[true,false]);assert.deepEqual(x.grades.map(g=>g.realisedOdds),[1.5,2.2]);
});

test('older-date Analysis shows exceptional status and never labels delayed NS as void',async t=>{
 const p=await open(t);const x=await p.evaluate(async rig=>{eval(rig);const r=card('PST',-10,1);const pred={fxid:r.fxid,...r.prediction,lname:r.lname};const original=fixtureTable,retired=retiredCount;supa={};retiredCount=async()=>0;let current=r;fixtureTable=table=>{const q={select:()=>q,eq:()=>q,order:()=>q,in:()=>q,then:ok=>Promise.resolve({data:table==='predictions'?[pred]:current.status==='MISSING'?[]:[current],error:null}).then(ok)};return q;};const out=[];try{for(const status of ['PST','ABD','CANC','SUSP','INT','NS','FT','MISSING']){current={...r,status,date:r.prediction.kickoff,gh:status==='FT'?0:null,ga:status==='FT'?0:null};await showPredictDate(pred.kickoff);out.push($('fixtureList').textContent);}}finally{fixtureTable=original;retiredCount=retired;}return out;},rig);
 for(const [i,label]of ['POSTPONED','ABANDONED','CANCELLED','SUSPENDED','INTERRUPTED'].entries())assert.ok(x[i].toUpperCase().includes(label),x[i]);assert.ok(x[5].includes('77%'));assert.ok(x[6].includes('2 DNB · Void'));assert.ok(!x[6].includes('0/1 correct'));assert.ok(x[7].includes('77%'));assert.ok(!x[7].includes("Couldn't load"));
});
test('current exceptional status outranks stale unresolved extra-time score',async t=>{
 const p=await open(t);const x=await p.evaluate(rig=>{eval(rig);const r={...card('INT',1,1),elapsed:78},{L,f}=installRow(r);const s=settledRow({...r,status:'AET',gh:3,ga:2,ft_h:null,ft_a:null});return fxCells(L,f,{[f.fxid]:s});},rig);assert.ok(x.timeCell.includes("78'"));assert.ok(!x.timeCell.includes('LIVE'));assert.ok(x.chip.includes('Interrupted'));assert.equal(x.finished,false);
});

test('admitted no-pick fixtures keep their competition and immediate status',async t=>{
 const p=await open(t);const x=await p.evaluate(rig=>{eval(rig);const r=card('ABD',1,1);const {f}=installRow(r);f.pick=null;renderFixtures();return $('fixtureList').textContent;},rig);assert.match(x,/Abandoned/i);assert.ok(x.includes('Champions League'));
});
test('expired and completed DNB badges explain themselves on tap and keyboard',async t=>{
 const p=await open(t);await p.evaluate(rig=>{eval(rig);navTo('predict');installRow(card('NS',-4,1));renderFixtures();window.explanations=[];toast=m=>explanations.push(m);},rig);
 const b=p.locator('#fixtureList .statuschip').first();await b.focus();await b.press('Enter');assert.match(await p.evaluate(()=>explanations.join(' ')),/48 hours/);await b.click();assert.equal(await p.evaluate(()=>explanations.length),2);
 await p.evaluate(rig=>{eval(rig);const r=card('FT',0,0);installRow(r);afState.scores={list:[{...r,gh:0,ga:0}]};renderFixtures();},rig);
 const drawn=p.locator('#fixtureList .statuschip').filter({hasText:'DNB · Void'}).first();await drawn.focus();await drawn.press('Enter');assert.match(await p.evaluate(()=>explanations.at(-1)),/completed match was a draw/);
});

test('48-hour presentation boundary and delayed on-time result retain original locked forecast',async t=>{
 const p=await open(t);const x=await p.evaluate(rig=>{eval(rig);const r=card('PST',-4,-4),{L,f}=installRow(r);const before=JSON.stringify(afState.archive),a=afState.archive[r.fxid],k=pickOriginalKick(a);const boundary=[k+47*3600000,k+48*3600000-1,k+48*3600000].map(t=>forecastDisplayExpired(f,t));f.status='NS';const delayed=forecastDisplayExpired(f,k+72*3600000);f.status='FT';const chip=fxCells(L,f,{[f.fxid]:{...r,status:'FT',gh:0,ga:2}}).chip;return{boundary,delayed,chip,unchanged:before===JSON.stringify(afState.archive)};},rig);assert.deepEqual(x.boundary,[false,false,true]);assert.equal(x.delayed,false);assert.match(x.chip,/hit.*✓/);assert.equal(x.unchanged,true);
});
test('cloud Scores reader executes malicious cloud-shaped names as literal text',async t=>{
 const p=await open(t);const x=await p.evaluate(async()=>{const date=ymdOffset(0),bad='<img src=x onerror="window.injected=1">';supa={};afState.scoresDate=date;afState.filter='all';fetchAllRows=async()=>({data:[{fxid:990125,lid:2,lname:bad,lcountry:bad,home:bad,away:bad,date,time:'12:00',status:'PST',provider:'af',updated_at:new Date().toISOString(),gh:null,ga:null}],error:null});await afScoresFromCloud();return{text:$('scoresList').textContent,images:$('scoresList').querySelectorAll('img[src="x"]').length,injected:window.injected||0};});assert.match(x.text,/Postponed/i);assert.ok(x.text.includes('<img'));assert.equal(x.images,0);assert.equal(x.injected,0);
});

test('approved right-side status badges fit fixture rows at 320, 375 and 390 pixels',async t=>{
 const p=await open(t);
 for(const width of [320,375,390]){
  await p.setViewportSize({width,height:844});
  const x=await p.evaluate(rig=>{eval(rig);navTo('predict');const out=[];for(const status of ['PST','ABD','CANC','SUSP','INT']){installRow(card(status,1,1));renderFixtures();const row=$('fixtureList').querySelector('.fxrow'),time=row.querySelector('.fxtime'),badge=row.querySelector('.exceptional-chip'),label=badge.querySelector('span'),teams=row.querySelector('.fxteams'),br=badge.getBoundingClientRect(),lr=label.getBoundingClientRect();out.push({status,time:time.textContent,badge:badge.textContent,aria:badge.getAttribute('aria-label'),icon:!!badge.querySelector('svg'),client:badge.clientWidth,labelInside:lr.left>=br.left&&lr.right<=br.right,right:br.right,rowRight:row.getBoundingClientRect().right,teamWidth:teams.clientWidth});}return out;},rig);
  assert.equal(x.length,5);for(const e of x){assert.ok(e.labelInside,JSON.stringify(e));assert.ok(e.right<=e.rowRight+1,e.badge+' outside row');assert.ok(e.client>=72&&e.client<=98,e.badge+' wrong proportions: '+e.client);assert.ok(e.teamWidth>=82,'team names squeezed');assert.ok(e.icon,'pause icon missing');assert.match(e.aria,/Fixture status:/);assert.equal(e.time,'12:00','missing elapsed uses verified kickoff, never a fabricated minute');assert.doesNotMatch(e.time,/POSTPONED|ABANDONED|CANCELLED|SUSPENDED|INTERRUPTED|LIVE/i);}
  const scores=await p.evaluate(rig=>{eval(rig);const r=card('INT',1,1);afState.scoresDate=r.date;afState.scores={at:Date.now(),list:[r]};renderScores();const row=$('scoresList').querySelector('.scrow'),badge=row.querySelector('.exceptional-chip'),br=badge.getBoundingClientRect();return{time:row.querySelector('.scstat').textContent,badge:badge.textContent,right:br.right,rowRight:row.getBoundingClientRect().right};},rig);assert.equal(scores.time,'12:00');assert.equal(scores.badge,'Interrupted');assert.ok(scores.right<=scores.rowRight+1);
  if(process.env.MM_DIRECTOR_SCREENSHOT_DIR)await p.screenshot({path:process.env.MM_DIRECTOR_SCREENSHOT_DIR+'/status-'+(process.env.MM_DIRECTOR_BROWSER||'chromium')+'-'+width+'.png'});
 }
});

test('failed refresh retains complete Scores count and competition disclosure',async t=>{
 const p=await open(t);const x=await p.evaluate(()=>{const date=ymdOffset(0);afState.scoresDate=date;afState.filter=2;afState.scores={at:Date.now(),list:[2,2,3,3,4,4].map((lid,i)=>({fxid:991300+i,lid,lname:'Competition '+lid,lcountry:'Synthetic',home:'Home '+i,away:'Away '+i,date,time:'12:00',status:'NS',gh:null,ga:null}))};scoresReadFailed('synthetic offline');return{text:$('scoresMeta').textContent,rows:$('scoresList').querySelectorAll('.scrow').length};});assert.equal(x.rows,2);assert.match(x.text,/Refresh failed/);assert.match(x.text,/2 matches/);assert.match(x.text,/of 6/);assert.match(x.text,/one competition/);
});
