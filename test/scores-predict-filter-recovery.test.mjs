// Director review 5833466012: offline synthetic published A plus Scores-only B.
// Every non-document request is blocked. No source, provider, account or hosted writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let driver;
for(const id of [process.env.PWA_PLAYWRIGHT,'playwright-core','playwright'])if(id){try{driver=require(id);break;}catch{}}
const engine=process.env.MM_CROSS_TAB_BROWSER||'chromium';
assert.ok(['chromium','webkit'].includes(engine),'explicit supported offline test engine');
const executablePath=[process.env.MM_TEST_CHROMIUM,process.env.PWA_CHROMIUM,'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
 test(`Scores-only filter explains empty Analysis and restores immutable published predictions (${engine}, ${viewport.width}px)`,{timeout:60000},async t=>{
  assert.ok(driver?.[engine],'browser driver required; no silent skip');
  if(engine==='chromium')assert.ok(executablePath,'Chromium executable required');
  const browser=await driver[engine].launch(engine==='chromium'?{executablePath,args:['--no-sandbox','--disable-background-networking','--disable-sync']}:{headless:true});
  t.after(()=>browser.close());
  t.diagnostic(`${engine} ${browser.version()}; synthetic offline ${viewport.width}x${viewport.height}`);
  const context=await browser.newContext({serviceWorkers:'block',viewport,hasTouch:true});
  const requests=[],errors=[];
  await context.route('**/*',r=>{if(r.request().url()==='http://filter-recovery.test/')return r.fulfill({status:200,contentType:'text/html',body:html});requests.push(r.request().url());return r.abort();});
  // This existing scenario starts as a returning visitor; first-run behavior has its own WO62B suite.
  await context.addInitScript(()=>localStorage.setItem('mm_intro','1'));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://filter-recovery.test/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
   supa=null;
   const date=ymdOffset(0),stamp=new Date().toISOString();
   const prediction={lid:39,lname:'Published League A',home:'Synthetic Alpha',away:'Synthetic Beta',pick:'1',pick_prob:.6,market:'Winner',p_home:.6,p_draw:.25,p_away:.15,xg_home:1.8,xg_away:.9,kickoff:date,ktime:'23:00',made_at:stamp,withheld_at:null,final_pick:null,build:355};
   const card={fxid:990401,lid:39,lname:prediction.lname,lcountry:'Synthetic',date,time:'23:00',status:'NS',home:prediction.home,away:prediction.away,gh:null,ga:null,prediction};
   const L={id:39,name:prediction.lname,country:'Synthetic',sport:'football',_presentation:true,matches:[],upcoming:[fixturePresentationRow(card,null)]};
   afState.leagues={39:L};afState.leagueOrder=[39];afState.archive={990401:archiveRow(prediction)};
   afState.filter='all';afState.archiveDate=null;afState.selectedDate=date;afState.scoresDate=date;afState.scoreFilter='all';
   afState.scores={at:Date.now(),dataAt:Date.now(),v:SCORES_CACHE_V,source:'cloud',list:[{fxid:990402,lid:78,lname:'Scores-only League B',lcountry:'Synthetic',date,ldate:date,time:'20:00',status:'NS',home:'Synthetic Gamma',away:'Synthetic Delta',gh:null,ga:null}]};
   window.filterBefore=JSON.stringify({leagues:afState.leagues,archive:afState.archive,scores:afState.scores});
   window.filterFits=0;footballEngine.predict=()=>{filterFits++;throw Error('Published predictions must not be re-estimated');};
   navTo('predict');
  });
  assert.match(await page.locator('#fixtureList').innerText(),/Synthetic Alpha/,'published A must be visible before filtering');
  await page.locator('.nav-btn[data-view="scores"]').tap();
  await page.evaluate(()=>renderScores());
  await page.locator('#segCompsS').tap();
  await page.locator('#compsDropS [data-f="78"]').tap();
  assert.equal(await page.evaluate(()=>afState.filter),78);
  await page.locator('.nav-btn[data-view="predict"]').tap();
  if(process.env.MM_FILTER_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.MM_FILTER_SCREENSHOT_DIR}/filter-selected-${engine}-${viewport.width}.png`,fullPage:false});
  assert.equal(await page.locator('#fixturesWrap').isVisible(),true,'shared Scores-only filter hides Analysis and its recovery controls');
  assert.match(await page.locator('#fixtureList').innerText(),/no predictions.*selected competition.*loaded data/i,'explain the filter limitation, not a fabricated source or provider failure');
  assert.equal(await page.evaluate(()=>afState.filter),78,'do not silently discard the Scores filter');
  const restore=page.getByRole('button',{name:'Show All competitions',exact:true});
  assert.equal(await restore.isVisible(),true);
  assert.equal(await restore.isEnabled(),true);
  await restore.focus();await page.keyboard.press(viewport.width<500?'Enter':'Space');
  assert.equal(await page.evaluate(()=>afState.filter),'all');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'segComps','focus must not disappear with the recovery button');
  assert.match(await page.locator('#fixtureList').innerText(),/Synthetic Alpha/);
  if(process.env.MM_FILTER_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.MM_FILTER_SCREENSHOT_DIR}/filter-restored-${engine}-${viewport.width}.png`,fullPage:false});
  assert.equal(await page.evaluate(()=>JSON.stringify({leagues:afState.leagues,archive:afState.archive,scores:afState.scores})===filterBefore),true,'recovery preserves source inventory and immutable published forecasts');
  await page.locator('#fixtureList .fxrow.favrow').filter({hasText:'Synthetic Alpha'}).first().tap();
  assert.match(await page.locator('#heroConf').innerText(),/60(?:\.0)?%.*published probability/);
  assert.match(await page.locator('#outcomeRows').innerText(),/25(?:\.0)?%/);
  assert.match(await page.locator('#outcomeRows').innerText(),/15(?:\.0)?%/);
  assert.equal(await page.evaluate(()=>filterFits),0);
  assert.deepEqual(errors,[]);
  assert.equal(requests.some(u=>{const url=new URL(u);return /(?:^|\.)(?:supabase\.co|api-sports\.io|openrouter\.ai)$/i.test(url.hostname)||url.pathname.startsWith('/functions/');}),false,'no backend/provider request attempted');
 });
}
