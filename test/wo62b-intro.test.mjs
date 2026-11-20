// WO-62B selective first-run/name integration. Offline synthetic browser only: every
// non-document request is intercepted, with no accounts, credentials or hosted mutations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);let driver;
for(const id of [process.env.PWA_PLAYWRIGHT,'playwright-core','playwright'])if(id){try{driver=require(id);break;}catch{}}
const engine=process.env.MM_INTRO_BROWSER||'chromium';
assert.ok(['chromium','webkit'].includes(engine),'explicit supported offline browser engine');
const executablePath=[process.env.MM_TEST_CHROMIUM,'/usr/bin/chromium'].find(p=>p&&existsSync(p));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
async function open(t,{seen=false,storage='normal',viewport={width:375,height:667},renamed=false}={}){
 assert.ok(driver?.[engine],'offline browser driver required, never skip');
 if(engine==='chromium')assert.ok(executablePath,'offline Chromium executable required');
 const browser=await driver[engine].launch(engine==='chromium'?{executablePath,args:['--no-sandbox','--disable-background-networking','--disable-sync']}:{headless:true});t.after(()=>browser.close());
 const context=await browser.newContext({viewport,serviceWorkers:'block'});
 await context.addInitScript(({seen,storage})=>{
  if(seen)localStorage.setItem('mm_intro','1');
  if(storage==='all')for(const name of ['getItem','setItem'])Storage.prototype[name]=()=>{throw new DOMException('Synthetic storage blocked','SecurityError');};
  if(storage==='set-only')Storage.prototype.setItem=()=>{throw new DOMException('Synthetic quota full','QuotaExceededError');};
 },{seen,storage});
 await context.route('**/*',r=>r.request().url()==='http://wo62b-intro.test/'?r.fulfill({status:200,contentType:'text/html',body:renamed?html.replace("const APP_NAME = 'MatchMind';","const APP_NAME = 'Synthetic Identity';"):html}):r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[],'no uncaught app errors in first-run flow'));await page.goto('http://wo62b-intro.test/',{waitUntil:'domcontentloaded'});return page;
}
async function visibleIntro(page){assert.equal(await page.locator('#introScreen').count(),1,'approved first-run screen exists');assert.equal(await page.locator('#introScreen').isVisible(),true);}

test('WO62B static title and runtime name identify statistical forecasts without an AI claim',async t=>{
 const title=html.match(/<title>([^<]+)<\/title>/)?.[1];assert.equal(title,'MatchMind PRO: Statistical Football Forecasts');
 const page=await open(t);assert.equal(await page.title(),title);
 assert.equal(await page.locator('#brandName').textContent(),'MatchMind');assert.equal(await page.locator('#aboutName').textContent(),'MatchMind PRO');assert.equal(await page.locator('#introName').textContent(),'MatchMind');
});
test('WO62B first visit is skippable, honest and keyboard-contained, dismissal restores app focus',async t=>{
 const page=await open(t);await visibleIntro(page);
 assert.equal(await page.locator('#introScreen').getAttribute('role'),'dialog');assert.equal(await page.locator('#introScreen').getAttribute('aria-modal'),'true');
 assert.equal(await page.evaluate(()=>document.querySelector('.app').inert),true);
 assert.match(await page.locator('#introScreen').innerText(),/Not a bookmaker/);assert.match(await page.locator('#introScreen').innerText(),/Nothing here is advice to bet/);
 assert.match(await page.locator('#introRecord').innerText(),/not loaded|published picks/i);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'introScreen','initial dialog focus must preserve the beginning of the introduction');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'introTerms');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'introGo');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#introScreen').isVisible(),false);assert.equal(await page.evaluate(()=>document.querySelector('.app').inert),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'searchOpen');
 assert.equal(await page.evaluate(()=>localStorage.getItem('mm_intro')),'1');
 await page.locator('#searchOpen').click();assert.equal(await page.locator('#searchOverlay').isVisible(),true);
});
for(const [id,title] of [['introTerms','Terms of Use'],['introPrivacy','Privacy notice'],['introPlay','Responsible play']])test(`WO62B ${id} dismisses once and opens the actual legal page accessibly`,async t=>{
 const page=await open(t);await visibleIntro(page);await page.locator('#'+id).click();
 assert.equal(await page.locator('#introScreen').isVisible(),false);assert.equal(await page.locator('#view-legal').isVisible(),true);assert.equal(await page.locator('#legalTitle').innerText(),title);assert.equal(await page.evaluate(()=>document.activeElement.id),'legalBack');assert.equal(await page.evaluate(()=>localStorage.getItem('mm_intro')),'1');
 await page.locator('#legalBack').click();assert.equal(await page.locator('#introScreen').isVisible(),false);
});
for(const storage of ['all','set-only'])test(`WO62B ${storage} storage failure does not break dismissal or reopen within session`,async t=>{
 const page=await open(t,{storage});await visibleIntro(page);await page.locator('#introGo').click();
 assert.equal(await page.locator('#introScreen').isVisible(),false);await page.evaluate(()=>{introBoot();introBoot();});assert.equal(await page.locator('#introScreen').isVisible(),false);assert.equal(await page.evaluate(()=>document.querySelector('.app').inert),false);
 await page.locator('.nav-btn[data-view="predict"]').click();assert.equal(await page.locator('#view-predict').isVisible(),true);
});
test('WO62B returning visitor does not encounter an overlay and can reach Analysis',async t=>{
 const page=await open(t,{seen:true});assert.equal(await page.locator('#introScreen').count(),1);assert.equal(await page.locator('#introScreen').isVisible(),false);await page.locator('.nav-btn[data-view="predict"]').click();assert.equal(await page.locator('#view-predict').isVisible(),true);await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.locator('#introScreen').isVisible(),false);
});
test('WO62B short narrow mobile intro scrolls without horizontal overflow and Open app remains reachable',async t=>{
 const page=await open(t,{viewport:{width:320,height:568}});await visibleIntro(page);
 if(process.env.MM_INTRO_SCREENSHOT_DIR)await page.screenshot({path:process.env.MM_INTRO_SCREENSHOT_DIR+'/intro-mobile-first.png',fullPage:false});
 await page.locator('#introGo').scrollIntoViewIfNeeded();
 if(process.env.MM_INTRO_SCREENSHOT_DIR)await page.screenshot({path:process.env.MM_INTRO_SCREENSHOT_DIR+'/intro-mobile-button.png',fullPage:false});
 const box=await page.locator('#introGo').boundingBox();assert.ok(box&&box.width>=44&&box.height>=44&&box.x>=0&&box.x+box.width<=320+1&&box.y>=0&&box.y+box.height<=568+1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await page.locator('#introGo').click();await page.locator('.nav-btn[data-view="predict"]').click();assert.equal(await page.locator('#view-predict').isVisible(),true);
});
test('WO62B dismissing intro preserves explicit Scores-filter recovery and published Analysis',async t=>{
 const page=await open(t);await visibleIntro(page);await page.locator('#introGo').click();
 await page.evaluate(()=>{
  supa=null;const day=ymdOffset(0);
  const prediction={lid:39,lname:'Synthetic Published A',home:'Synthetic Alpha',away:'Synthetic Beta',pick:'1',pick_prob:.6,market:'Winner',p_home:.6,p_draw:.25,p_away:.15,xg_home:1.8,xg_away:.9,kickoff:day,ktime:'23:00',made_at:new Date().toISOString(),build:355};
  const card={fxid:990401,lid:39,lname:prediction.lname,lcountry:'Synthetic',date:day,time:'23:00',status:'NS',home:prediction.home,away:prediction.away,prediction};
  afState.leagues={39:{id:39,name:prediction.lname,country:'Synthetic',sport:'football',_presentation:true,matches:[],upcoming:[fixturePresentationRow(card,null)]}};afState.leagueOrder=[39];afState.archive={990401:archiveRow(prediction)};afState.archiveDate=null;afState.selectedDate=day;afState.filter=78;
  window.introPreserved=JSON.stringify({leagues:afState.leagues,archive:afState.archive});navTo('predict');
 });
 assert.equal(await page.locator('#predictClearFilter').isVisible(),true);await page.locator('#predictClearFilter').click();assert.match(await page.locator('#fixtureList').innerText(),/Synthetic Alpha/);assert.equal(await page.evaluate(()=>JSON.stringify({leagues:afState.leagues,archive:afState.archive})===introPreserved),true);assert.equal(await page.locator('#introScreen').isVisible(),false);
});

test('WO62B changing the single display-name setting reaches visible names and legal pages',async t=>{
 const page=await open(t,{renamed:true});await visibleIntro(page);assert.equal(await page.title(),'Synthetic Identity PRO: Statistical Football Forecasts');assert.equal(await page.locator('#introName').textContent(),'Synthetic Identity');await page.locator('#introGo').click();
 assert.equal(await page.locator('#brandName').textContent(),'Synthetic Identity');assert.equal(await page.locator('#aboutName').textContent(),'Synthetic Identity PRO');
 for(const key of ['terms','privacy','play','contact']){await page.evaluate(key=>openLegal(key),key);const text=await page.locator('#legalBody').innerText();assert.match(text,/Synthetic Identity/);assert.doesNotMatch(text,/\bMatchMind\b/,'legal display name must not be hardcoded');}
});

test('WO62B initial mobile dialog focus preserves the introduction at scroll position zero',async t=>{
 const page=await open(t,{viewport:{width:320,height:568}});await visibleIntro(page);
 const view=await page.evaluate(()=>{const modal=document.getElementById('introScreen'),heading=document.getElementById('introName'),lead=modal.querySelector('.introlead');return{scrollTop:modal.scrollTop,focus:document.activeElement.id,heading:heading.getBoundingClientRect().top,leadBottom:lead.getBoundingClientRect().bottom,height:innerHeight};});
 assert.equal(view.scrollTop,0,'first-run autofocus must not scroll past the heading and introductory lead');assert.equal(view.focus,'introScreen');assert.ok(view.heading>=0&&view.leadBottom<=view.height,'intro heading and lead must be initially visible');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'introTerms');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'introGo');
});
