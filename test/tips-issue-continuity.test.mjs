/* TIPS ISSUE CONTINUITY ACROSS THE READER'S MIDNIGHT.
 *
 * The Tips tab read only the row issued for the reader's local today. In Lagos that day turns over
 * at 23:00 UTC, hours before the next Tips are issued, and the tab went empty: yesterday's issued
 * selections and their results could not be reached.
 *
 * PROOF CLASS: EMULATION. Offline Chromium, the generated preview document, Africa/Lagos time and a
 * fixed clock. The 2026-11-15 issue is genuine (test/real-results-sample.mjs). The 2026-11-16 issue
 * is TEST EVIDENCE ONLY: no authentic one existed when the sample was read. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {realTransform} from '../staging/build-real-preview.mjs';
import {envelope} from './real-results-sample.mjs';
import {collect} from '../staging/mirror/refresh.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PWA_PLAYWRIGHT||'playwright-core');
const html=realTransform(readFileSync(new URL('../index.html',import.meta.url),'utf8'),readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8')).html;
const ORIGIN='https://kennedychinazam.github.io/matchmind-preview/';
const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
async function open(t,now,options={},width=320){
 const exe=[process.env.MM_TEST_CHROMIUM,'/opt/pw-browsers/chromium','/usr/bin/chromium'].find(p=>p&&existsSync(p));
 const browser=await chromium.launch({executablePath:exe,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width,height:844},timezoneId:'Africa/Lagos',serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('mm-real-preview:mm_intro','1'));
 await context.route('**/*',r=>{const u=r.request().url();
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:CORS});
  if(u===ORIGIN)return r.fulfill({contentType:'text/html',body:html});
  if(u.endsWith('/rpc/mm_preview_status_v1'))return r.fulfill({headers:CORS,contentType:'application/json',body:JSON.stringify({mode:'real-read-only',expires_at:'2026-11-16T17:01:25Z',published_at:'2026-11-15T17:01:25Z'})});
  if(u.endsWith('/rpc/mm_preview_display_v2'))return r.fulfill({headers:CORS,contentType:'application/json',body:JSON.stringify(envelope(JSON.parse(r.request().postData()).screen,options))});
  if(u.startsWith('https://cdn.jsdelivr.net/npm/@supabase'))return r.fulfill({contentType:'text/javascript',body:'window.supabase={createClient(){return null}}'});
  return r.abort();});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));
 await page.clock.setFixedTime(new Date(now));
 await page.goto(ORIGIN);
 await page.evaluate(async()=>{for(let i=0;i<40;i++){await loadCloudLeagues(true);await afScoresFromCloud();if(Object.values(afState.leagues).flatMap(L=>L.upcoming).length)return;await new Promise(r=>setTimeout(r,250));}throw Error('preview inventory did not load');});
 await page.evaluate(async()=>{navTo('tips');for(let i=0;i<60&&!(_sharedSlips.loaded&&_sharedSlips.day===todayStrLocal()&&_tipsPrev.loaded&&_tipsPrev.forDay===todayStrLocal());i++)await new Promise(r=>setTimeout(r,250));});
 return page;
}
/* What the reader sees for one market of whichever issue is selected. */
const view=(page,market)=>page.evaluate(async market=>{tipState.tab=market;renderTips();
 for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,150));renderTips();}
 const bar=$('tipIssueBar');
 return{today:todayStrLocal(),issue:bar&&!bar.classList.contains('hidden')?bar.dataset.issue:null,label:$('tipIssueLabel')?.textContent||'',
  switches:[...document.querySelectorAll('#tipIssueBar [data-issue]')].map(b=>({day:b.dataset.issue,text:b.textContent,on:b.classList.contains('active')})),
  rows:[...$('tipList').querySelectorAll('.fxrow')].map(r=>r.querySelector('.lname').textContent.replace(/\s+/g,' ').trim()+' | '+r.querySelector('.predchip').textContent),
  foot:$('tipList').querySelector('.subnote')?.textContent||'',banker:$('bankerCard').innerText.replace(/\s+/g,' ').trim(),
  barOverflow:!!bar&&bar.scrollWidth>bar.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1};},market);
/* The genuine 2026-11-15 issue: selection, grade, score and issued probability, in issued order. */
const REAL={
 winner:['Eibar or Draw Pending | 82%','Guidonia Montecelio 1937 or Draw ✓ Won 2–2 | 81%','Pescara or Draw ✓ Won 3–1 | 81%','Ibiza or Draw ✗ Lost 0–1 | 81%'],
 ou:['Under 2.5 Pending | 64%','Under 2.5 ✓ Won 1–0 | 63%','Under 2.5 ✗ Lost 2–2 | 63%','Over 2.5 ✗ Lost 0–2 | 62%'],
 btts:['BTTS No ✓ Won 1–0 | 59%','BTTS No ✗ Lost 2–2 | 57%','BTTS No ✓ Won 0–1 | 57%','BTTS No Pending | 56%']};
const assertRealIssue=async(page,why)=>{for(const market of Object.keys(REAL)){const v=await view(page,market);
 assert.equal(v.issue,'2026-11-15',why+' '+market+' issue');assert.deepEqual(v.rows,REAL[market],why+' '+market);
 assert.equal(v.foot,'3 of 4 results verified',why+' '+market+' counter');assert.ok(!v.barOverflow&&!v.pageOverflow,why+' layout');}};

test('before midnight in Lagos: today\'s issue, labelled with its date, no switch',async t=>{
 const page=await open(t,'2026-11-15T17:05:00Z');          // 18:05 in Lagos on the 15th
 const v=await view(page,'winner');
 assert.equal(v.today,'2026-11-15');assert.equal(v.label,'Issued for Sun 15 Nov');assert.deepEqual(v.switches,[]);
 assert.match(v.banker,/Today — strongest read.*Atlético Madrid II.*86% @ 1\.11.*Won 1–0/);
 await assertRealIssue(page,'before midnight');
});

test('just after midnight in Lagos with no new issue: the latest issue stays, under its own date',async t=>{
 const page=await open(t,'2026-11-15T23:20:00Z');          // 00:20 in Lagos on the 16th
 const v=await view(page,'winner');
 assert.equal(v.today,'2026-11-16');
 assert.equal(v.label,'Issued for Sun 15 Nov · latest available. Today’s Tips are not issued yet.');
 assert.deepEqual(v.switches,[],'one issue, so nothing to switch to');
 // The strongest read keeps its issued price and result and is not called Today.
 assert.match(v.banker,/Sun 15 Nov — strongest read.*86% @ 1\.11.*Won 1–0/);assert.doesNotMatch(v.banker,/Today/);
 await assertRealIssue(page,'after midnight');
});

test('once the next issue exists it is the default, and the two issues switch without mixing',async t=>{
 const page=await open(t,'2026-11-16T06:00:00Z',{nextIssue:true});   // 07:00 in Lagos on the 16th
 let v=await view(page,'winner');
 assert.equal(v.issue,'2026-11-16');assert.equal(v.label,'Issued for Mon 16 Nov');
 assert.deepEqual(v.switches,[{day:'2026-11-16',text:'Today · 16 Nov',on:true},{day:'2026-11-15',text:'Yesterday · 15 Nov',on:false}]);
 assert.deepEqual(v.rows,['TEST ONLY Eibar or Draw Pending | 61%','TEST ONLY Draw or Mirandes Pending | 60%']);
 assert.equal(v.foot,'0 of 2 results verified','the new issue counts only its own selections');
 assert.equal((await view(page,'ou')).foot,'0 of 1 results verified');
 // Switch to the previous issue: its own selections, grades and counters, labelled as previous.
 await page.locator('#tipIssueBar [data-issue="2026-11-15"]').click();
 v=await view(page,'winner');
 assert.equal(v.label,'Issued for Sun 15 Nov · previous issue');assert.equal(v.switches.find(s=>s.on).day,'2026-11-15');
 assert.doesNotMatch(v.banker,/Today/);assert.ok(v.rows.every(r=>!/TEST ONLY/.test(r)),'a 16 Nov selection leaked into the 15 Nov issue');
 await assertRealIssue(page,'previous issue selected');
 // And back.
 await page.locator('#tipIssueBar [data-issue="2026-11-16"]').click();
 v=await view(page,'winner');assert.equal(v.issue,'2026-11-16');assert.equal(v.foot,'0 of 2 results verified');
 if(process.env.MM_SHOTS){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:process.env.MM_SHOTS+'/tips-issues-320.png'});}
});

test('browser Back from a match restores the selected issue and market',async t=>{
 const page=await open(t,'2026-11-16T06:00:00Z',{nextIssue:true});
 await page.locator('#tipIssueBar [data-issue="2026-11-15"]').click();
 await view(page,'btts');
 await page.locator('#tipList .fxrow').first().click();
 await page.waitForFunction(()=>curView==='detail');
 await page.goBack();await page.waitForFunction(()=>curView==='tips');
 const v=await page.evaluate(()=>({issue:$('tipIssueBar').dataset.issue,tab:tipState.tab,state:tipState.issue,first:$('tipList').querySelector('.lname').textContent.replace(/\s+/g,' ').trim(),foot:$('tipList').querySelector('.subnote').textContent}));
 assert.deepEqual(v,{issue:'2026-11-15',tab:'btts',state:'2026-11-15',first:'BTTS No ✓ Won 1–0',foot:'3 of 4 results verified'});
});

test('no issue for today or yesterday: a short accurate empty state',async t=>{
 const page=await open(t,'2026-11-15T23:20:00Z',{noSlips:true});
 const v=await view(page,'winner');
 assert.equal(v.issue,null);assert.deepEqual(v.rows,[]);
 assert.equal(await page.evaluate(()=>$('tipList').textContent.trim()),'No Tips have been issued for today or yesterday.');
});

test('the mirror reads the previous day\'s issue only when switched on, and never truncates it',async()=>{
 const now=new Date('2026-11-16T00:30:00Z'),asked=[];
 const source={day:'2026-11-15',tier:'tips',odds:0,build:355,step:'tips',legs:envelope('slips').slips[1].legs};
 const fixtures=envelope('scores').cards.map(({prediction,...c})=>c);
 const fetcher=async u=>{const table=u.pathname.split('/').pop(),day=u.searchParams.get('day');let rows=[];
  if(table==='daily_slips'){asked.push(day);rows=day==='in.(2026-11-15,2026-11-16)'?[source]:[];}
  else if(table==='fixtures'&&!u.searchParams.get('lid'))rows=fixtures.filter(f=>{const ids=u.searchParams.get('fxid');return !ids||ids.slice(4,-1).split(',').includes(String(f.fxid));});
  return{ok:true,headers:{get:()=>'0-0/'+rows.length},json:async()=>rows};};
 const off=await collect(now,fetcher,{previousIssue:false});
 assert.equal(asked[0],'eq.2026-11-16','the default read is still the current day only');assert.deepEqual(off.payload.slips,[]);
 const on=await collect(now,fetcher,{previousIssue:true});
 assert.equal(asked.at(-1),'in.(2026-11-15,2026-11-16)');
 assert.equal(on.payload.slips.length,1);assert.equal(on.payload.slips[0].day,'2026-11-15');
 assert.deepEqual(on.payload.slips[0].legs,source.legs,'the issued bundle was altered or shortened');
});
