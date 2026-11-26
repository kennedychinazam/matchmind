// Offline actual Tips navigation in source and generated preview; invented selections only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {realTransform} from '../staging/build-real-preview.mjs';
import {buildPresentationPayload} from '../backend/fixture-delivery/contract.mjs';
const {chromium}=createRequire(import.meta.url)('playwright-core');
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8'),manifest=readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8');
const documents=[['source',source],['real-preview',realTransform(source,manifest).html]];
async function open(t,html,width,scenario='winner-only'){
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width,height:844},timezoneId:'Africa/Lagos',serviceWorkers:'block'});
 await context.route('**/*',r=>r.request().url()==='http://tips-empty.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await context.addInitScript(()=>{localStorage.setItem('mm_intro','1');localStorage.setItem('mm-real-preview:mm_intro','1');});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));
 await page.clock.setFixedTime(new Date('2026-11-26T10:00:00Z'));await page.goto('http://tips-empty.test/');
 await page.evaluate(scenario=>{
  const today=todayStrLocal(),previous=dayStrLocal(-1),leg=(day,selection,p)=>({fxid:990760,lid:39,d:day,t:'20:00',h:'Harbor Athletic',a:'Granite United',code:'1',sel:selection,p,market:'Winner',tab:'winner',rank:0});
  const row=(day,selection='Harbor Athletic',p=.75)=>({day,tier:'tips',odds:0,build:368,step:'tips',legs:[leg(day,selection,p)]});
  const rows=scenario==='empty-bundle'?[{...row(today),legs:[]}]:['absent','failed-today','failed-previous'].includes(scenario)?[]:[row(today)];
  const prev=scenario==='two-issues'?[row(previous,'Previous original selection',.71)]:[];
  _sharedSlips={day:today,rows,loaded:true,error:scenario==='failed-today'?'synthetic read failure':null};
  _tipsPrev={forDay:today,day:previous,rows:prev,loaded:true,error:scenario==='failed-previous'?'synthetic read failure':null};
  _dailyOdds={day:today,byFx:{},loaded:true};authUser=null;
  sharedResultsTick=()=>{};liveResultsTick=()=>{};renderBanker=()=>{};renderStrongPicks=()=>{};
  window.dynamicTipCalls=0;tipRankedRows=()=>{dynamicTipCalls++;return[];};footballEngine.predict=()=>{throw Error('no model fitting');};
  window.issuedBefore=JSON.stringify({today:_sharedSlips.rows,previous:_tipsPrev.rows});
  tipState.days=0;tipState.tab='winner';delete tipState.issue;navTo('tips');renderTips();
 },scenario);
 return page;
}
const snapshot=page=>page.evaluate(()=>({day:todayStrLocal(),issue:$('tipIssueBar')?.dataset.issue||null,bar:!!$('tipIssueBar')&&!$('tipIssueBar').classList.contains('hidden'),label:$('tipIssueLabel')?.textContent||'',
 text:$('tipList').textContent.trim(),empty:$('tipMarketEmpty')?.textContent||'',counter:$('tipList').querySelector('.subnote')?.textContent||'',
 rows:[...document.querySelectorAll('#tipList .fxrow')].map(r=>({selection:r.querySelector('.lname b')?.textContent,probability:r.querySelector('.predchip')?.textContent})),
 dynamic:dynamicTipCalls,preserved:issuedBefore===JSON.stringify({today:_sharedSlips.rows,previous:_tipsPrev.rows}),
 overflow:document.documentElement.scrollWidth>innerWidth+1,switches:[...document.querySelectorAll('#tipIssueBar [data-issue]')].map(b=>({day:b.dataset.issue,active:b.classList.contains('active')}))}));
for(const [mode,html] of documents)for(const width of [320,390]){
 test(`${mode} ${width}px: winner-only issue keeps empty Goals/BTTS markets under its original issue`,async t=>{
  const page=await open(t,html,width),winner=await snapshot(page);assert.deepEqual(winner.rows,[{selection:'Harbor Athletic',probability:'75%'}]);
  for(const [market,label] of [['ou','Goals'],['btts','BTTS']]){
   await page.locator('#tipTabs [data-tt="'+market+'"]').click();const v=await snapshot(page);
   assert.equal(v.bar,true);assert.equal(v.issue,v.day);assert.match(v.label,/Issued for Thu 26 Nov/);assert.deepEqual(v.rows,[]);
   assert.equal(v.counter,mode==='source'?'0 of 0 settled':'0 of 0 results verified');assert.equal(v.empty,`No ${label} selections in this issue.`);
   assert.doesNotMatch(v.text,/No Tips have been issued/);assert.equal(v.dynamic,0);assert.equal(v.preserved,true);assert.equal(v.overflow,false);
  }
  if(process.env.MM_UI_SCREENSHOTS){mkdirSync(process.env.MM_UI_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.MM_UI_SCREENSHOTS+`/${mode}-${width}-empty-issued-tips.png`,fullPage:true});}
  await page.locator('#tipTabs [data-tt="winner"]').click();assert.deepEqual((await snapshot(page)).rows,winner.rows);
 });
 test(`${mode} ${width}px: issue switching preserves the selected empty market and original winner`,async t=>{
  const page=await open(t,html,width,'two-issues');await page.locator('#tipTabs [data-tt="ou"]').click();
  await page.locator('#tipIssueBar [data-issue="2026-11-25"]').click();let v=await snapshot(page);
  assert.equal(v.issue,'2026-11-25');assert.match(v.label,/previous issue/);assert.equal(v.empty,'No Goals selections in this issue.');assert.equal(v.dynamic,0);
  await page.locator('#tipTabs [data-tt="winner"]').click();v=await snapshot(page);assert.deepEqual(v.rows,[{selection:'Previous original selection',probability:'71%'}]);
  assert.equal(v.switches.filter(s=>s.active)[0].day,'2026-11-25');assert.equal(v.preserved,true);assert.equal(v.overflow,false);
 });
 for(const scenario of ['absent','failed-today','failed-previous'])test(`${mode} ${width}px: ${scenario} stays distinct from an empty issued market`,async t=>{
  const page=await open(t,html,width,scenario);for(const market of ['winner','ou','btts']){
   await page.locator('#tipTabs [data-tt="'+market+'"]').click();const v=await snapshot(page);assert.equal(v.bar,false);assert.equal(v.issue,null);assert.deepEqual(v.rows,[]);assert.equal(v.empty,'');
   assert.equal(v.text,scenario==='absent'?'No Tips have been issued for today or yesterday.':'Tips are temporarily unavailable. Please try again.');
   assert.equal(v.dynamic,0);assert.equal(v.preserved,true);assert.equal(v.overflow,false);
  }
 });
 test(`${mode} ${width}px: explicitly empty admitted bundle remains an issued date`,async t=>{
  const page=await open(t,html,width,'empty-bundle');const v=await snapshot(page);assert.equal(v.bar,true);assert.equal(v.issue,v.day);assert.equal(v.empty,'No Winner selections in this issue.');assert.equal(v.dynamic,0);assert.equal(v.preserved,true);
 });
}
test('existing closed contract admits an explicitly empty Tips bundle without changing issuance rules',()=>{
 const row={day:'2026-11-26',tier:'tips',odds:0,build:368,step:'tips',legs:[]};assert.deepEqual(buildPresentationPayload({fixtures:[],slips:[row]}).slips,[row]);
});
