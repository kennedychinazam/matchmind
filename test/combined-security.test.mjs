// Real page in isolated Chromium; all external routes and service workers blocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), chromium=require('playwright-core').chromium;
const executablePath=process.env.MM_TEST_CHROMIUM;
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
async function open(t,legacy){
 assert.ok(executablePath&&existsSync(executablePath));
 const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking','--disable-component-update']});const errors=[];t.after(async()=>{await browser.close();assert.deepEqual(errors,[],'no page runtime errors');});
 const context=await browser.newContext({serviceWorkers:'block'});
 if(legacy)await context.addInitScript(value=>localStorage.setItem('mm_state',value),legacy);
 await context.route('**/*',r=>r.request().url()==='http://combined.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 // This existing scenario starts as a returning visitor; first-run behavior has its own WO62B suite.
 await context.addInitScript(()=>{
  localStorage.setItem('mm_intro','1');
  // The real 800ms boot refresh must finish before this test installs its account-only
  // client stub. Otherwise that unrelated refresh consumes the stub and clears the seeded
  // public corpus mid-Search. Observe completion instead of relying on browser speed.
  const schedule=window.setTimeout;
  window.setTimeout=(fn,ms,...args)=>schedule(()=>{try{fn(...args);}finally{if(ms===800)window.__mmBootRefreshComplete=true;}},ms);
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://combined.test/');await page.waitForFunction(()=>window.__mmBootRefreshComplete===true);return page;
}
async function seed(page){await page.evaluate(async()=>{
 cloudEnabled=()=>true;aiShadowGate=async()=>{};window.writes=[];
 supa={auth:{signOut:async()=>({error:null})},from:()=>({select:()=>({eq:(_k,id)=>({maybeSingle:async()=>({error:null,data:id==='B'?{user_id:'B',fav_teams:['B owned'],record:[{fxid:22,pick:'B owned'}]}:null})})}),upsert:async x=>(window.writes.push(x),{error:null})})};
 afState.leagueOrder=[990001];afState.leagues={990001:{id:990001,name:'Public League',country:'Public',_presentation:true,teamIds:{'Public Shared':1,'Public Other':2},upcoming:[{fxid:990011,date:'2026-11-03',time:'12:00',home:'Public Shared',away:'Public Other'}],matches:[]}};afState.scores={list:[]};
 onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));afState.favT=['Private Favourite Only','Public Shared'];afState.record=[{fxid:11,pick:'Private History Only'}];saveState();
 });}
test('switch while Search is open clears previous query and restores input focus',async t=>{
 const p=await open(t);await seed(p);await p.locator('#searchOpen').click();await p.locator('#searchInput').fill('Private Favourite Only');
 const before=await p.locator('#searchResults').textContent();assert.match(before,/Private Favourite Only/);
 await p.evaluate(()=>onAuth({id:'B'}));assert.equal(await p.locator('#searchInput').inputValue(),'');assert.doesNotMatch(await p.locator('#searchResults').textContent(),/Private Favourite Only/);assert.equal(await p.evaluate(()=>document.activeElement.id),'searchInput');
 await p.locator('#searchInput').fill('Public Shared');assert.ok(await p.locator('#searchResults .sres').count()>0,'public corpus produced no result row');assert.match(await p.locator('#searchResults').textContent(),/Public Shared/);
 await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'searchOpen');await p.locator('#searchOpen').click();assert.equal(await p.locator('#searchInput').inputValue(),'');
});
test('Search indexes public corpus, never private-only favourites or history',async t=>{
 const p=await open(t);await seed(p);await p.locator('#searchOpen').click();
 for(const q of ['Private Favourite Only','Private History Only']){await p.locator('#searchInput').fill(q);assert.equal(await p.locator('#searchResults .sres').count(),0);}
 await p.locator('#searchInput').fill('Public Shared');assert.ok(await p.locator('#searchResults .sres').count()>0);
 await p.evaluate(()=>onAuth({id:'B'}));await p.locator('#searchInput').fill('Public Shared');assert.ok(await p.locator('#searchResults .sres').count()>0);
});
test('signout while Search is open restores focus after disconnected account opener',async t=>{
 const p=await open(t);await seed(p);
 await p.evaluate(()=>navTo('data'));assert.equal(await p.locator('#view-data').isVisible(),true);assert.equal(await p.locator('#acctLogout').isVisible(),true);await p.locator('#acctLogout').focus();assert.equal(await p.evaluate(()=>document.activeElement.id),'acctLogout');await p.evaluate(()=>openSearch());await p.waitForFunction(()=>document.activeElement.id==='searchInput');await p.evaluate(()=>authLogout());await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'searchOpen');
});
test('legacy is preserved byte-for-byte and never enters Search or B',async t=>{
 const legacy=JSON.stringify({fb:[{x:1}],af:{record:[{fxid:7,pick:'Legacy Private'}],favT:['Legacy Private']}});const p=await open(t,legacy);await seed(p);
 await p.evaluate(()=>onAuth({id:'B'}));await p.locator('#searchOpen').click();await p.locator('#searchInput').fill('Legacy Private');assert.equal(await p.locator('#searchResults .sres').count(),0);
 assert.deepEqual(await p.evaluate(()=>({backup:localStorage.getItem('mm_state_UNASSIGNED'),b:JSON.stringify({fav:afState.favT,record:afState.record})})),{backup:legacy,b:JSON.stringify({fav:['B owned'],record:[{fxid:22,pick:'B owned'}]})});
});
test('delayed A pull and write cannot merge or upload into B while Search changes',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};let resolveA;const writes=[];
  supa={from:()=>({select:()=>({eq:(_k,id)=>({maybeSingle:()=>id==='A'?new Promise(r=>resolveA=r):Promise.resolve({data:null,error:null})})}),upsert:async x=>(writes.push(x),{error:null})})};
  onAuth({id:'A'});afState.favT=['A private'];saveState();openSearch();$('searchInput').value='A private';renderSearch('A private');onAuth({id:'B'});$('searchInput').value='public';renderSearch('public');
  resolveA({data:{user_id:'A',fav_teams:['A cloud private'],record:[{fxid:1,pick:'A cloud private'}]},error:null});await new Promise(r=>setTimeout(r,1350));return {b:JSON.stringify({fav:afState.favT,record:afState.record}),writes,query:$('searchInput').value};
 });assert.doesNotMatch(r.b,/A private|A cloud private/);assert.ok(r.writes.every(x=>x.user_id!=='B'||!/A (?:cloud )?private/.test(JSON.stringify(x))));assert.equal(r.query,'public');
});
test('account switch replaces focused Search result and preserves A partition',async t=>{
 const p=await open(t);await seed(p);const before=await p.evaluate(()=>localStorage.getItem(personalKey('A')));
 await p.locator('#searchOpen').click();await p.locator('#searchInput').fill('Public Shared');await p.locator('#searchResults [data-m="0"]').focus();
 await p.evaluate(()=>onAuth({id:'B'}));assert.equal(await p.evaluate(()=>document.activeElement.id),'searchInput');assert.equal(await p.locator('#searchInput').inputValue(),'');
 assert.equal(await p.evaluate(()=>localStorage.getItem(personalKey('A'))),before);await p.evaluate(()=>onAuth({id:'A'}));await p.waitForTimeout(0);
 assert.deepEqual(await p.evaluate(()=>afState.favT),['Private Favourite Only','Public Shared']);
});
test('in-flight A write remains A-owned while B searches and writes',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};let scheduled,resolveA;const writes=[],original=setTimeout;
  setTimeout=(fn,ms)=>ms===1200?(scheduled=fn,777):original(fn,ms);clearTimeout=()=>{};
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:x=>{writes.push(x);return x.user_id==='A'?new Promise(r=>resolveA=r):Promise.resolve({error:null});}})};
  onAuth({id:'A'});await new Promise(r=>original(r,0));afState.favT=['A owned'];saveState();const first=scheduled();await Promise.resolve();
  openSearch();$('searchInput').value='A owned';renderSearch('A owned');onAuth({id:'B'});await new Promise(r=>original(r,0));$('searchInput').value='B query';renderSearch('B query');afState.favT=['B owned'];saveState();const second=scheduled();await Promise.resolve();resolveA({error:null});await Promise.all([first,second]);
  return {writes,query:$('searchInput').value,b:afState.favT};
 });assert.equal(r.query,'B query');assert.deepEqual(r.b,['B owned']);assert.equal(r.writes.length,2);assert.equal(r.writes[0].user_id,'A');assert.deepEqual(r.writes[0].fav_teams,['A owned']);assert.equal(r.writes[1].user_id,'B');assert.deepEqual(r.writes[1].fav_teams,['B owned']);
});
