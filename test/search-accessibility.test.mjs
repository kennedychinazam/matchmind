/* Actual HTML in offline Chromium: only the exact in-memory document is allowed.
   Browser plugin not available. No account, provider, backend or inference operation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;
for(const id of ['playwright','playwright-core','/opt/node-tools/node_modules/playwright/index.js']){
  try{chromium=require(id).chromium;break;}catch{}
}
const executablePath=[process.env.MM_TEST_CHROMIUM,'/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
async function open(t,viewport={width:1280,height:900}){
  assert.ok(chromium&&executablePath,'local Chromium required');
  const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});
  const errors=[];
  t.after(async()=>{await browser.close();assert.deepEqual(errors,[],'no page runtime errors');});
  const context=await browser.newContext({viewport,serviceWorkers:'block'});
  await context.route('**/*',r=>r.request().url()==='http://search-accessibility.test/'
    ?r.fulfill({status:200,contentType:'text/html',body:source}):r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://search-accessibility.test/',{waitUntil:'load'});
  assert.match(await page.title(),/MatchMind/);
  assert.ok(await page.locator('#searchOpen').isVisible());
  return page;
}
async function showSearch(page){
  await page.locator('#searchOpen').click();
  await page.waitForFunction(()=>document.activeElement.id==='searchInput');
}
async function focused(page){return page.evaluate(()=>document.activeElement.id);}
async function seedResults(page){
  await page.evaluate(()=>{
    const fixture={fxid:990011,date:'2026-11-03',time:'12:00',home:'Synthetic Search A',away:'Synthetic Search B'};
    afState.leagueOrder=[990001];
    afState.leagues={990001:{id:990001,name:'Synthetic Search League',country:'Synthetic',teamIds:{'Synthetic Search A':990101,'Synthetic Search B':990102},upcoming:[fixture],matches:[]}};
    afState.scores={list:[]};
    // openFixture can fetch history and run analysis; substitute only that boundary.
    // Keep searchData/renderSearch, original click handlers and real navTo('detail').
    openFixture=(leagueId,f)=>{window.searchNavigation={leagueId,fxid:f.fxid,home:f.home};navTo('detail');$('heroHome').textContent=f.home;};
  });
  await page.locator('#searchInput').fill('Synthetic Search');
}
test('Search exposes a named modal and a named search input',async t=>{
  const page=await open(t);await showSearch(page);
  assert.equal(await page.locator('#searchOverlay').getAttribute('role'),'dialog');
  assert.equal(await page.locator('#searchOverlay').getAttribute('aria-modal'),'true');
  assert.equal(await page.getByRole('dialog',{name:'Search',exact:true}).count(),1);
  assert.equal(await page.getByRole('searchbox',{name:'Search loaded content',exact:true}).count(),1);
});
test('Escape closes Search and restores its opener',async t=>{
  const page=await open(t);await showSearch(page);await page.keyboard.press('Escape');
  assert.equal(await page.locator('#searchOverlay').isVisible(),false);
  assert.equal(await focused(page),'searchOpen');
});
test('empty Search contains forward and backward Tab without a keyboard dead end',async t=>{
  const page=await open(t);await showSearch(page);
  await page.keyboard.press('Shift+Tab');assert.equal(await focused(page),'searchClose');
  await page.keyboard.press('Tab');assert.equal(await focused(page),'searchInput');
  await page.keyboard.press('Tab');assert.equal(await focused(page),'searchClose');
  await page.keyboard.press('Tab');assert.equal(await focused(page),'searchInput');
});
test('dynamic results join Tab order and Enter activates the existing match navigation',async t=>{
  const page=await open(t);await showSearch(page);await seedResults(page);
  await page.keyboard.press('Tab');assert.equal(await focused(page),'searchClose');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#searchResults [data-m="0"]').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Shift+Tab');assert.equal(await focused(page),'searchClose');
  await page.locator('#searchInput').focus();await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('#searchResults [data-t="1"]').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Tab');assert.equal(await focused(page),'searchInput');
  await page.locator('#searchResults [data-m="0"]').focus();await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(()=>window.searchNavigation),{leagueId:990001,fxid:990011,home:'Synthetic Search A'});
  assert.equal(await page.locator('#searchOverlay').isVisible(),false);
  assert.equal(await page.locator('#view-detail').isVisible(),true);
  assert.equal(await focused(page),'searchOpen');
});
test('Space activates a dynamically rendered team result through existing navigation',async t=>{
  const page=await open(t);await showSearch(page);await seedResults(page);
  const team=page.locator('#searchResults [data-t="1"]');await team.focus();await page.keyboard.press('Space');
  assert.deepEqual(await page.evaluate(()=>window.searchNavigation),{leagueId:990001,fxid:990011,home:'Synthetic Search A'});
  assert.equal(await page.locator('#searchOverlay').isVisible(),false);
  assert.equal(await page.locator('#view-detail').isVisible(),true);
});
test('result replacement recalculates containment and existing match clicks still navigate',async t=>{
  const page=await open(t);await showSearch(page);await seedResults(page);
  await page.locator('#searchInput').fill('nothing-matches-this-synthetic-query');
  await page.keyboard.press('Shift+Tab');assert.equal(await focused(page),'searchClose');
  await page.keyboard.press('Tab');assert.equal(await focused(page),'searchInput');
  await page.locator('#searchInput').fill('Synthetic Search');
  await page.locator('#searchResults [data-m="0"]').click();
  assert.deepEqual(await page.evaluate(()=>window.searchNavigation),{leagueId:990001,fxid:990011,home:'Synthetic Search A'});
  assert.equal(await page.locator('#view-detail').isVisible(),true);
  assert.equal(await page.locator('#searchOverlay').isVisible(),false);
});
test('background controls cannot receive focus and prior inert states survive Close',async t=>{
  const page=await open(t);
  await page.evaluate(()=>{
    $('toast').inert=true;
    const outside=document.createElement('button');outside.id='outsideApp';outside.textContent='Outside app';document.body.append(outside);
  });
  await showSearch(page);
  for(const id of ['segCompsS','outsideApp','searchOpen']){
    await page.locator('#'+id).evaluate(e=>e.focus());assert.equal(await focused(page),'searchInput');
  }
  await page.locator('#searchClose').click();
  assert.equal(await focused(page),'searchOpen');
  assert.equal(await page.locator('#toast').evaluate(e=>e.inert),true);
  await page.locator('#outsideApp').focus();assert.equal(await focused(page),'outsideApp');
  await page.locator('#segCompsS').focus();assert.equal(await focused(page),'segCompsS');
});
test('Close and browser Back restore the legitimate opener, including repeated open',async t=>{
  const page=await open(t,{width:390,height:844});
  await page.evaluate(()=>{
    const opener=document.createElement('button');opener.id='alternateSearchOpen';opener.textContent='Alternate Search';
    opener.onclick=openSearch;document.querySelector('.topright').append(opener);
  });
  await page.locator('#alternateSearchOpen').click();await page.waitForFunction(()=>document.activeElement.id==='searchInput');
  await page.evaluate(()=>openSearch());await page.locator('#searchClose').click();
  assert.equal(await focused(page),'alternateSearchOpen');
  await showSearch(page);await page.goBack();
  assert.equal(await page.locator('#searchOverlay').isVisible(),false);assert.equal(await focused(page),'searchOpen');
});
test('a removed opener falls back to the visible Search button',async t=>{
  const page=await open(t);
  await page.evaluate(()=>{
    const opener=document.createElement('button');opener.id='temporarySearchOpen';document.querySelector('.topright').append(opener);
    opener.focus();openSearch();opener.remove();
  });
  await page.waitForFunction(()=>document.activeElement.id==='searchInput');await page.locator('#searchClose').click();
  assert.equal(await focused(page),'searchOpen');
});
test('rapid open/close cancels deferred autofocus before reopening',async t=>{
  const page=await open(t);
  await page.evaluate(()=>{
    window.searchFocusCalls=0;const input=$('searchInput'),focus=input.focus.bind(input);
    input.focus=(...args)=>{window.searchFocusCalls++;return focus(...args);};
    $('searchOpen').focus();openSearch();closeSearch();
  });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.searchFocusCalls),0,'closed Search must not attempt deferred focus');
  assert.equal(await focused(page),'searchOpen');
  await showSearch(page);assert.equal(await page.evaluate(()=>window.searchFocusCalls),1);
  await page.keyboard.press('Escape');assert.equal(await focused(page),'searchOpen');
});
