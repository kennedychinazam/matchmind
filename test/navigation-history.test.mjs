// Browser-history acceptance uses an isolated local preview and synthetic RPC responses.
// Chromium mobile emulation is not physical Android Chrome or Samsung Internet acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {realTransform} from '../staging/build-real-preview.mjs';
const require=createRequire(import.meta.url),driver=require('playwright-core');
const browserName=process.env.MM_NAV_BROWSER||'chromium';
assert.ok(['chromium','firefox'].includes(browserName),'MM_NAV_BROWSER must name Chromium or Firefox');
const html=realTransform(readFileSync(new URL('../index.html',import.meta.url),'utf8'),readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8')).html;
const now=Date.now(),stamp=new Date(now-60000).toISOString(),expires=new Date(now+3600000).toISOString();
const day=new Date(now+86400000).toISOString().slice(0,10);
const cards=Array.from({length:48},(_,i)=>({fxid:910000+i,lid:39,lname:'Navigation QA League',lcountry:'England',date:day,time:'20:00',status:'NS',elapsed:null,home:'Home '+i,away:'Away '+i,gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:stamp,provider:'af',prediction:{lid:39,lname:'Navigation QA League',home:'Home '+i,away:'Away '+i,pick:'1',pick_prob:.64,market:'Winner',p_home:.64,p_draw:.2,p_away:.16,xg_home:1.8,xg_away:.9,kickoff:day,ktime:'20:00',made_at:stamp,withheld_at:null,final_pick:null,build:358}}));
async function open(t,width=390){
 const options=browserName==='chromium'?{executablePath:process.env.MM_TEST_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking']}:{headless:true,...(process.env.MM_TEST_FIREFOX?{executablePath:process.env.MM_TEST_FIREFOX}:{})};
 const browser=await driver[browserName].launch(options);t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:844},timezoneId:'UTC'});
 await context.addInitScript(()=>localStorage.setItem('mm-real-preview:mm_intro','1'));
 await context.route('**/*',r=>{const u=new URL(r.request().url());
  if(u.origin==='http://navigation.test')return r.fulfill({contentType:'text/html',body:u.pathname==='/outside'?'<title>Outside MatchMind</title><p>Previous website</p>':html});
  if(u.pathname.endsWith('mm_preview_status_v1'))return r.fulfill({json:{mode:'real-read-only',edition_id:'11111111-2222-4333-8444-555555555555',published_at:stamp,expires_at:expires,source_updated_at:stamp}});
  if(u.pathname.endsWith('mm_preview_display_v2')){const {screen}=r.request().postDataJSON();return r.fulfill({json:{version:'matchmind-display/1',edition_id:'11111111-2222-4333-8444-555555555555',as_of:stamp,expires_at:expires,screen,cards:['scores','predictions','history'].includes(screen)?cards.map(c=>screen==='scores'?{...c,prediction:null}:c):[],board:null,records:{engine:null,clv:null},slips:[]}});}
  return r.abort();
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://navigation.test/outside');const outsideLength=await page.evaluate(()=>history.length);
 await page.goto('http://navigation.test/');await page.waitForFunction(()=>Object.values(afState.leagues||{}).length);
 await page.evaluate(async()=>{await loadCloudLeagues(true);await afScoresFromCloud();});
 t.after(()=>assert.deepEqual(errors,[]));return{page,outsideLength};
}
const waitView=(page,v)=>page.waitForFunction(v=>curView===v,v);
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
test('cold start adds no sentinel entry; Back leaves MatchMind normally',async t=>{
 const{page,outsideLength}=await open(t);assert.equal(await page.evaluate(()=>history.length),outsideLength+1);
 await page.goBack();assert.equal(await page.title(),'Outside MatchMind');
});
test('detail-to-detail Back and Forward preserve identities and accordion state',async t=>{
 const{page}=await open(t);
 await page.evaluate(day=>{afState.selectedDate=day;afState.filter='all';navTo('predict');const L=Object.values(afState.leagues)[0];openFixture(L.id,L.upcoming[3]);},day);await waitView(page,'detail');
 await page.locator('#acc-result .acc-head').click();const expanded=await page.locator('#acc-result').getAttribute('class');
 await page.evaluate(()=>{const L=Object.values(afState.leagues)[0];openFixture(L.id,L.upcoming[7]);});assert.match(await page.locator('#heroHome').textContent(),/Home 7/);
 const length=await page.evaluate(()=>history.length);
 await page.goBack();await frames(page);assert.match(await page.locator('#heroHome').textContent(),/Home 3/);assert.equal(await page.locator('#acc-result').getAttribute('class'),expanded);
 await page.goForward();await frames(page);assert.match(await page.locator('#heroHome').textContent(),/Home 7/);assert.equal(await page.evaluate(()=>history.length),length);
 await page.goBack();await frames(page);await page.goBack();await waitView(page,'predict');await frames(page);
 await page.locator('#fixtureList .fxrow').nth(9).click();await waitView(page,'detail');assert.match(await page.locator('#heroHome').textContent(),/Home 9/);
 await page.goBack();await waitView(page,'predict');await page.goForward();await waitView(page,'detail');await frames(page);assert.match(await page.locator('#heroHome').textContent(),/Home 9/);
});
test('hidden feed refresh cannot mutate the saved list or its row listeners',async t=>{
 const{page}=await open(t);
 await page.evaluate(day=>{afState.selectedDate=day;navTo('predict');afState.filter='all';renderFixtures();},day);
 await page.locator('#fixtureList .fxrow').nth(23).scrollIntoViewIfNeeded();await frames(page);
 const before=await page.evaluate(()=>({y:scrollY,text:$('fixtureList').textContent}));
 await page.locator('#fixtureList .fxrow').nth(23).click();await waitView(page,'detail');
 await page.evaluate(()=>{const L=Object.values(afState.leagues)[0];L.upcoming.reverse();renderFixtures();});
 await page.goBack();await waitView(page,'predict');await frames(page);assert.equal(await page.locator('#fixtureList').textContent(),before.text);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before.y)<=1);
 await page.evaluate(()=>renderFixtures());assert.equal(await page.locator('#fixtureList').textContent(),before.text);
 await page.locator('#fixtureList .fxrow').nth(23).click();await waitView(page,'detail');assert.match(await page.locator('#heroHome').textContent(),/Home 23/);
});
test('a late archive date response cannot overwrite the restored Analysis list',async t=>{
 const{page}=await open(t);
 await page.evaluate(day=>{afState.selectedDate=day;navTo('predict');afState.filter='all';renderFixtures();},day);
 const text=await page.locator('#fixtureList').textContent();
 await page.locator('#fixtureList .fxrow').nth(6).click();await waitView(page,'detail');
 await page.evaluate(()=>{window.qaOriginalTable=fixtureTable;window.qaResolve=null;fixtureTable=()=>{const q={select(){return q},eq(){return q},order(){return new Promise(resolve=>window.qaResolve=resolve)}};return q};window.qaPending=showPredictDate('2020-01-01');});
 await page.goBack();await waitView(page,'predict');await frames(page);
 await page.evaluate(async()=>{qaResolve({data:[],error:null});await qaPending;fixtureTable=qaOriginalTable;});
 assert.equal(await page.locator('#fixtureList').textContent(),text);assert.equal(await page.evaluate(()=>afState.selectedDate),day);
});
test('history does not restore an expired edition snapshot or suppress source revalidation',async t=>{
 const{page}=await open(t);
 await page.evaluate(day=>{afState.selectedDate=day;navTo('predict');const L=Object.values(afState.leagues)[0];openFixture(L.id,L.upcoming[1]);},day);
 await page.clock.setFixedTime(new Date(Date.parse(expires)+1000));
 await page.goBack();await waitView(page,'predict');await page.waitForFunction(()=>Object.keys(afState.leagues).length===0);assert.equal(await page.evaluate(()=>_navRestored),null);assert.equal(await page.locator('#fixtureList .fxrow:visible').count(),0);
});
test('history does not restore a previous account view',async t=>{
 const{page}=await open(t);
 await page.evaluate(day=>{afState.selectedDate=day;navTo('predict');},day);
 await page.evaluate(()=>{const L=Object.values(afState.leagues)[0];openFixture(L.id,L.upcoming[2]);authUser={id:'different-account'};});
 await page.goBack();await waitView(page,'predict');await frames(page);assert.equal(await page.evaluate(()=>_navRestored),null);
});
test('reloading a detail rebases the current tab without a trapped Back loop',async t=>{
 const{page}=await open(t);
 await page.evaluate(day=>{afState.selectedDate=day;navTo('predict');const L=Object.values(afState.leagues)[0];openFixture(L.id,L.upcoming[1]);},day);
 const length=await page.evaluate(()=>history.length);await page.reload();await page.waitForFunction(()=>curView==='predict');assert.equal(await page.evaluate(()=>history.length),length);
 await page.goBack();await page.goBack();await page.goBack();assert.equal(await page.title(),'Outside MatchMind');
});
for(const width of [320,390,1280])for(const tab of ['scores','predict','tips','favs'])test(tab+' restores date/filter/order/scroll and forward detail at '+width+'px',async t=>{
 const{page}=await open(t,width);
 await page.evaluate(({tab,day})=>{
  afState.selectedDate=day;afState.archiveDate=null;afState.scoresDate=day;afState.filter='39';afState.scoreFilter='ns';
  const L=Object.values(afState.leagues)[0];afState.favM=L.upcoming.map(f=>({...f,lid:L.id,lname:L.name}));afState.favTab='matches';
  _sharedSlips={loaded:true,day:todayStrLocal(),rows:[{day:todayStrLocal(),tier:'tips',step:'issued',build:358,odds:1,legs:L.upcoming.slice(0,30).map(f=>({fxid:f.fxid,d:f.date,t:f.time,h:f.home,a:f.away,lid:L.id,code:f.pick,p:f.prob,tab:'winner',market:'Winner',sel:f.home}))}]};_dailyOdds={loaded:true,day:todayStrLocal(),byFx:{}};
  navTo(tab);if(tab==='scores')renderScores();
 },{tab,day});
 const selector=tab==='scores'?'#scoresList .scrow':tab==='predict'?'#fixtureList .fxrow':tab==='favs'?'#favFeed .favrow':'#tipList .fxrow';
 const rows=page.locator(selector);assert.ok(await rows.count()>20);
 await rows.nth(24).scrollIntoViewIfNeeded();await frames(page);
 const before=await page.evaluate(selector=>({y:scrollY,date:afState.selectedDate,scoresDate:afState.scoresDate,filter:afState.filter,scoreFilter:afState.scoreFilter,order:[...document.querySelectorAll(selector)].map(e=>e.textContent),length:history.length}),selector);
 await rows.nth(24).click();await waitView(page,'detail');await frames(page);
 assert.match(await page.locator('#heroHome').textContent(),/Home 24/);
 const detail=await page.locator('#heroPick').textContent();const detailLength=await page.evaluate(()=>history.length);
 await page.goBack();await waitView(page,tab);await frames(page);
 const after=await page.evaluate(selector=>({y:scrollY,date:afState.selectedDate,scoresDate:afState.scoresDate,filter:afState.filter,scoreFilter:afState.scoreFilter,order:[...document.querySelectorAll(selector)].map(e=>e.textContent),length:history.length}),selector);
 assert.equal(after.date,before.date);assert.equal(after.scoresDate,before.scoresDate);assert.equal(after.filter,before.filter);assert.equal(after.scoreFilter,before.scoreFilter);assert.deepEqual(after.order,before.order);assert.ok(Math.abs(after.y-before.y)<=1,`scroll ${before.y} -> ${after.y}`);assert.equal(after.length,detailLength);
 if(process.env.MM_NAV_SCREENSHOT_DIR)await page.screenshot({path:process.env.MM_NAV_SCREENSHOT_DIR+'/'+browserName+'-'+tab+'-back-'+width+'.png'});
 await page.goForward();await waitView(page,'detail');await frames(page);assert.equal(await page.locator('#heroPick').textContent(),detail);
 await page.locator('#backToFeed').click();await waitView(page,tab);await frames(page);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before.y)<=1);assert.equal(await page.evaluate(()=>history.length),detailLength);
 // Original rows retain their listeners after backward/forward restoration.
 await page.locator(selector).nth(25).click();await waitView(page,'detail');assert.match(await page.locator('#heroHome').textContent(),/Home 25/);
});
