/* RESULTS AND OUTCOMES ON THE PUBLIC READ-ONLY PREVIEW, AGAINST GENUINE FIXTURES.
 *
 * Two defects, both on the consumer side. The source rows and the projection were correct.
 *   1. Analysis rows: the preview's published-forecast view replaced the feed's own time and chip
 *      cells with a kick-off time and the issued badge, so a finished match never showed its score
 *      or what its pick did. The detail view read the result and the row did not.
 *   2. Tips: `sharedResultsLoad` asks for results by fixture id using strings. The public display
 *      filter compared them to numeric ids with `includes`, matched nothing, and every issued leg
 *      stayed ungraded: "0 of 30 settled".
 *
 * PROOF CLASS: EMULATION. Offline Chromium, the generated preview document, a fixed clock at the
 * moment the sample edition was read. The sample is real: see test/real-results-sample.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {realTransform} from '../staging/build-real-preview.mjs';
import {envelope,EXPECTED,ISSUED,RESCHEDULED,SAMPLE_NOW} from './real-results-sample.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PWA_PLAYWRIGHT||'playwright-core');
const html=realTransform(readFileSync(new URL('../index.html',import.meta.url),'utf8'),readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8')).html;
const ORIGIN='https://kennedychinazam.github.io/matchmind-preview/';
const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
async function open(t,width,options={}){
 const exe=[process.env.MM_TEST_CHROMIUM,'/opt/pw-browsers/chromium','/usr/bin/chromium'].find(p=>p&&existsSync(p));
 const browser=await chromium.launch({executablePath:exe,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width,height:844},timezoneId:'UTC',serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('mm-real-preview:mm_intro','1'));
 await context.route('**/*',r=>{const u=r.request().url();
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:CORS});
  if(u===ORIGIN)return r.fulfill({contentType:'text/html',body:html});
  if(u.endsWith('/rpc/mm_preview_status_v1'))return r.fulfill({headers:CORS,contentType:'application/json',body:JSON.stringify({mode:'real-read-only',expires_at:'2026-11-16T17:01:25Z',published_at:'2026-11-15T17:01:25Z'})});
  if(u.endsWith('/rpc/mm_preview_display_v2'))return r.fulfill({headers:CORS,contentType:'application/json',body:JSON.stringify(envelope(JSON.parse(r.request().postData()).screen,options))});
  // The preview only tests that the client library object exists. Its own read-only client is used.
  if(u.startsWith('https://cdn.jsdelivr.net/npm/@supabase'))return r.fulfill({contentType:'text/javascript',body:'window.supabase={createClient(){return null}}'});
  return r.abort();});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));
 await page.clock.setFixedTime(new Date(SAMPLE_NOW));
 await page.goto(ORIGIN);
 await page.evaluate(async()=>{for(let i=0;i<40;i++){await loadCloudLeagues(true);await afScoresFromCloud();if(Object.values(afState.leagues).flatMap(L=>L.upcoming).length)return;await new Promise(r=>setTimeout(r,250));}throw Error('preview inventory did not load');});
 return page;
}
const analysis=(page,day)=>page.evaluate(day=>{afState.filter='all';afState.archiveDate=null;navTo('predict');afState.selectedDate=day;renderFixtures();
 return [...$('fixtureList').querySelectorAll('.fxrow')].map(r=>({teams:r.querySelector('.fxteams').textContent,time:r.querySelector('.fxtime').innerText.replace(/\s+/g,' ').trim(),badge:r.querySelector('.predchip')?.textContent||'',outcome:r.querySelector('.predchip')?.dataset.outcome||'',prob:r.querySelector('.predchip')?.dataset.originalProbability||'',
  overflow:r.scrollWidth>r.clientWidth+1,badgeRight:!r.querySelector('.predchip')||r.querySelector('.predchip').getBoundingClientRect().left>=r.querySelector('.fxteams').getBoundingClientRect().right-1}));},day);
const rowFor=(rows,c)=>rows.find(r=>r.teams.includes(c.home)&&r.teams.includes(c.away));
const MARK={Won:' ✓',Lost:' ✗',Void:' · Void'};
const codeOf=p=>({'1D':'1 DNB','2D':'2 DNB'}[p.pick]||p.pick);
const badgeOf=p=>({'1D':'1 DNB','2D':'2 DNB'}[p.pick]||p.pick)+' · '+Math.round(p.pick_prob*100)+'%';

for(const width of [320,390])test('Analysis rows carry the verified result and the Build 355 graded chip at '+width+'px',async t=>{
 const page=await open(t,width);
 const rows=[...await analysis(page,'2026-11-15'),...await analysis(page,'2026-11-14')];
 for(const c of ISSUED){
  const r=rowFor(rows,c);assert.ok(r,c.home+' row missing');
  // Build 355 chip: pick with a tick or cross once verified, pick with probability until then.
  assert.equal(r.badge,MARK[EXPECTED[c.fxid]]?codeOf(c.prediction)+MARK[EXPECTED[c.fxid]]:badgeOf(c.prediction),c.home+' chip');
  if(MARK[EXPECTED[c.fxid]])assert.equal(r.prob,String(c.prediction.pick_prob),c.home+' issued probability lost from the graded chip');
  assert.equal(r.outcome,EXPECTED[c.fxid],c.home+' outcome');
  assert.ok(!r.overflow&&r.badgeRight,c.home+' row layout at '+width+'px');
  if(c.status==='FINISHED')assert.equal(r.time,c.ft_h+'–'+c.ft_a+' FT',c.home+' full-time score');
  else assert.ok(!/FT/.test(r.time),c.home+' is not finished and must not read FT: '+r.time);
 }
 // The Director's example: Atlas Paillade 0-2 Cannes, 2 DNB issued at 84%.
 assert.deepEqual((({time,badge,outcome})=>({time,badge,outcome}))(rowFor(rows,ISSUED[0])),{time:'0–2 FT',badge:'2 DNB ✓',outcome:'Won'});
 // In play: provider minute and score, never a final score. Row refreshed 4m34s before the clock.
 assert.match(rowFor(rows,ISSUED[5]).time,/^15:30.*62' 0-3$/);
 // Postponed: says so, keeps the pick, no result.
 assert.equal(rowFor(rows,ISSUED[6]).time,'15:00 Postponed');
 // Not started: the kick-off time and nothing else.
 assert.equal(rowFor(rows,ISSUED[7]).time,'17:30');
 assert.equal(await page.evaluate(()=>/EDGE\s*\+\d/.test($('fixtureList').textContent)),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 if(process.env.MM_SHOTS){await analysis(page,'2026-11-15');await page.screenshot({path:process.env.MM_SHOTS+'/analysis-'+width+'.png'});}
});

test('the detail view states the same score and outcome as the Analysis row',async t=>{
 const page=await open(t,320);
 for(const c of ISSUED){
  const d=await page.evaluate(id=>{openFixtureById(id);const line=[...$('heroMeta').querySelectorAll('.hm-dt')].find(e=>/90-minute score/.test(e.textContent));
   return{line:line?line.textContent:null,outcome:line?line.dataset.outcome:null,pick:$('heroPick').textContent,prob:$('heroPick').closest('.hero').dataset.originalProbability};},c.fxid);
  assert.equal(d.pick,badgeOf(c.prediction));assert.equal(d.prob,String(c.prediction.pick_prob));
  if(c.status==='FINISHED'){assert.equal(d.line,'90-minute score '+c.ft_h+'–'+c.ft_a+' · '+EXPECTED[c.fxid]);assert.equal(d.outcome,EXPECTED[c.fxid]);}
  else assert.equal(d.line,null,c.home+' has no final score to state');
 }
});

test('a finished fixture with no score is Pending, never Lost, and a stale live row prints no minute',async t=>{
 const page=await open(t,320,{withhold:[1570828,1551879]});
 const rows=[...await analysis(page,'2026-11-15'),...await analysis(page,'2026-11-14')];
 for(const id of [1570828,1551879]){const r=rowFor(rows,ISSUED.find(c=>c.fxid===id));assert.equal(r.outcome,'Pending');assert.ok(!/FT|\d–\d/.test(r.time),r.time);}
 assert.equal(rowFor(rows,ISSUED[0]).outcome,'Won');
 await page.clock.setFixedTime(new Date('2026-11-15T17:20:00Z'));
 const later=await analysis(page,'2026-11-15');
 assert.match(rowFor(later,ISSUED[5]).time,/^15:30.*LIVE 0-3$/);
});

test('a late-played forecast states no outcome, and a drawn Draw No Bet on time is still Void',async t=>{
 /* The legacy record decides a pick played 48 hours or more after its issued kick-off, and the
    public edition carries no settlement record. A score-based grade must not stand in for it. */
 const page=await open(t,320);
 const read=id=>page.evaluate(id=>{let x;for(const L of Object.values(afState.leagues)){const f=L.upcoming.find(f=>f.fxid===id);if(f)x={L,f};}
  const p=publishedPrediction(x.f),box=document.createElement('div');box.innerHTML=publishedRowChip(x.L,x.f,p,scoreMap());const chip=box.firstChild;
  openFixtureById(id);const line=[...$('heroMeta').querySelectorAll('.hm-dt')].find(e=>/90-minute score/.test(e.textContent));
  return{chip:chip.textContent,cls:chip.className,outcome:chip.dataset.outcome,cell:(d=>{d.innerHTML=publishedResultCell(x.L,x.f,scoreMap()).replace(/<br>/g,' ');return d.textContent.replace(/\s+/g,' ').trim();})(document.createElement('div')),detail:line?.textContent,hero:$('heroPick').textContent,prob:$('heroPick').closest('.hero').dataset.originalProbability};},id);
 const [laspalmas,haras]=RESCHEDULED;
 // Seven days late: the issued pick, its probability and the verified score. No outcome of any kind.
 assert.deepEqual(await read(haras.fxid),{chip:'1 DNB · 81%',cls:'predchip',outcome:'Unsettled',cell:'1–0 FT',detail:'90-minute score 1–0',hero:'1 DNB · 81%',prob:'0.807'});
 // Twenty-six hours late is inside the window and is graded on its result as usual.
 assert.deepEqual(await read(laspalmas.fxid),{chip:'1 DNB ✓',cls:'predchip hit',outcome:'Won',cell:'2–0 FT',detail:'90-minute score 2–0 · Won',hero:'1 DNB · 77%',prob:'0.771'});
 // A completed draw on its issued date keeps the Draw No Bet void.
 const reggiana=await read(1608748);
 assert.equal(reggiana.chip,'1 DNB · Void');assert.equal(reggiana.outcome,'Void');assert.equal(reggiana.detail,'90-minute score 0–0 · Void');
 // The listing for the issued date shows the on-time-window fixture with its score and chip.
 const row=rowFor(await analysis(page,'2026-11-08'),{home:'Las Palmas',away:'Eldense'});
 assert.deepEqual([row.time,row.badge],['2–0 FT','1 DNB ✓']);
});

test('Tips grades every issued leg from its own fixture and market and counts them',async t=>{
 const page=await open(t,320);
 const tab=async market=>page.evaluate(async market=>{navTo('tips');tipState.market=market;renderTipList(market);
  for(let i=0;i<40&&!/[1-9]\d* of/.test($('tipList').textContent);i++){await new Promise(r=>setTimeout(r,250));renderTipList(market);}
  return{rows:[...$('tipList').querySelectorAll('.fxrow')].map(r=>({teams:r.querySelector('.tline').textContent,line:r.querySelector('.lname').textContent.replace(/\s+/g,' ').trim(),prob:r.querySelector('.predchip').textContent,odds:/@/.test(r.querySelector('.favright').textContent),overflow:r.scrollWidth>r.clientWidth+1,outcomeSeen:(e=>{const o=e.querySelector('.tip-outcome').getBoundingClientRect(),b=e.getBoundingClientRect(),n=e.querySelector('.lname');return o.width>0&&o.left>=b.left&&o.right<=b.right+1&&n.scrollWidth<=n.clientWidth+1;})(r)})),foot:$('tipList').querySelector('.subnote').textContent};},market);
 const want={
  winner:['Eibar or Draw Pending','Guidonia Montecelio 1937 or Draw ✓ Won 2–2','Pescara or Draw ✓ Won 3–1','Ibiza or Draw ✗ Lost 0–1'],
  ou:['Under 2.5 Pending','Under 2.5 ✓ Won 1–0','Under 2.5 ✗ Lost 2–2','Over 2.5 ✗ Lost 0–2'],
  btts:['BTTS No ✓ Won 1–0','BTTS No ✗ Lost 2–2','BTTS No ✓ Won 0–1','BTTS No Pending']};
 const probs={winner:['82%','81%','81%','81%'],ou:['64%','63%','63%','62%'],btts:['59%','57%','57%','56%']};
 for(const market of Object.keys(want)){
  const got=await tab(market);
  assert.deepEqual(got.rows.map(r=>r.line),want[market],market);
  assert.deepEqual(got.rows.map(r=>r.prob),probs[market],market+' issued probabilities changed');
  assert.equal(got.foot,'3 of 4 results verified',market);
  assert.ok(got.rows.every(r=>!r.odds),'a Tips leg was issued without a price and must not show one');
  assert.ok(got.rows.every(r=>!r.overflow),market+' row overflow at 320px');
  assert.ok(got.rows.every(r=>r.outcomeSeen),market+' outcome is clipped or hidden at 320px');
 }
 // Atlas Paillade carries two different issued selections. Each keeps its own grade.
 assert.equal(rowFor(await analysis(page,'2026-11-15'),ISSUED[0]).outcome,'Won');
 if(process.env.MM_SHOTS){await tab('winner');await page.evaluate(()=>$('tipList').scrollIntoView());await page.screenshot({path:process.env.MM_SHOTS+'/tips-ou-320.png'});}
});

test('the Accuracy note always reads "Voids excluded, updated <time>." and the small-sample line is gone',async t=>{
 /* TEST EVIDENCE: the tallies are stand-in numbers, because the sample edition carries no engine
    record. They exercise the rendering only. The update time is read from the record itself. */
 const page=await open(t,320);
 const render=(voids,computedAt)=>page.evaluate(({voids,computedAt})=>{
  sharedTally=(from,to,market)=>market?{n:3,hits:2,voids:0,pct:'66.7'}:from?{n:39,hits:31,voids:0,pct:'79.5'}:{n:2436,hits:1831,voids,pct:'75.2'};
  sharedRecordMarkets=()=>['Double Chance','Draw No Bet','BTTS'];
  _engineRecord={state:'loaded',payload:{days:{}},computedAt,build:355,at:Date.now()};
  renderMoreRecord();
  return{note:$('recordNote')?.textContent,notes:[...$('moreRecordLine').querySelectorAll('.subnote')].map(e=>e.textContent),head:$('moreRecordLine').textContent,table:$('moreRecordBreak').textContent,tableNotes:$('moreRecordBreak').querySelectorAll('.subnote').length,rows:$('moreRecordBreak').querySelectorAll('.frow').length};},{voids,computedAt});
 for(const voids of [182,1,0]){
  const r=await render(voids,'2026-11-15T22:54:00Z');
  assert.equal(r.note,'Voids excluded, updated Nov 15 10:54 PM.','with '+voids+' voids');
  assert.deepEqual(r.notes,[r.note],'exactly one note under the figures');
  assert.match(r.head,/1831\/2436/);assert.equal(r.rows,4,'the market table is still drawn: a header and three markets');
  for(const gone of [/From /,/had the stake returned/,/same record on every device/,/182 void/,/\d+ voids? excluded/])assert.doesNotMatch(r.head,gone);
  assert.equal(r.tableNotes,0,'no caution line under the market table');
  assert.doesNotMatch(r.table,/handful of picks|read the count before the percentage/);
 }
 // The time is the record's own, not a constant.
 assert.equal((await render(182,'2026-11-16T07:05:00Z')).note,'Voids excluded, updated Nov 16 07:05 AM.');
});

test('the public result lookup matches a fixture id given as a string or a number',async t=>{
 const page=await open(t,320);
 const got=await page.evaluate(async()=>{const q=v=>fixtureTable('fixtures').select('fxid,status,gh,ga').in('fxid',v).then(r=>r.data);
  return{strings:await q(['1647925','1570016']),numbers:await q([1647925,1570016]),none:await q(['999']),lid:await fixtureTable('fixtures').select('fxid').in('lid',['66']).then(r=>r.data.length)};});
 assert.deepEqual(got.strings,got.numbers);assert.equal(got.strings.length,2);assert.deepEqual(got.none,[]);
 assert.equal(got.lid,0,'only the fixture id is compared by value. Other columns stay strict.');
});
