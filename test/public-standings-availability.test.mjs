// Offline reproduction of the genuine deployed Build 358 public-detail omission.
// All non-document HTTP is blocked; bounded display rows must never become a fake league table.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;for(const id of ['playwright','playwright-core']){try{chromium=require(id).chromium;break;}catch{}}
const executablePath=[process.env.MM_TEST_CHROMIUM,'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('bounded public match detail states standings unavailable without inventing a table or changing the published forecast',async t=>{
 assert.ok(chromium&&executablePath,'offline Chromium required');
 const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking','--disable-sync']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:375,height:667}});
 await context.route('**/*',r=>r.request().url()==='http://public-standings.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const page=await context.newPage();await page.goto('http://public-standings.test/',{waitUntil:'domcontentloaded',timeout:60000});
 const observed=await page.evaluate(()=>{
  const L={id:78,name:'Bundesliga',country:'Germany',_presentation:true,matches:[],upcoming:[],sport:'football'};
  const f={fxid:9900358,home:'Synthetic Home',away:'Synthetic Away',date:'2026-11-09',time:'20:00',status:'NS',pick:'H',prob:0.5,pW:0.5,pD:0.3,pL:0.2};
  const before=JSON.stringify({L,f});
  // A previously viewed private table must not leak into this bounded public fixture.
  $('acc-standings').classList.remove('hidden');$('standingsBox').textContent='Previous private table';
  showPublishedFixture(L,f);
  return{copy:$('view-detail').innerText,analysis:$('analysisText').textContent,
   tableHidden:$('acc-standings').classList.contains('hidden'),
   preserved:before===JSON.stringify({L,f}),probabilities:$('outcomeRows').textContent};
 });
 assert.match(observed.analysis,/\b(?:league table|standings)\b[^.\n]*(?:unavailable|not supplied|not published)/i,
  'Public detail hides standings without explaining that this edition does not supply them');
 assert.match(observed.analysis,/published edition|published view|public edition|public view/i);
 assert.doesNotMatch(observed.analysis,/reload.*(?:table|standings)|(?:table|standings).*reload/i,'reload cannot recover undistributed source history');
 assert.equal(observed.tableHidden,true,'do not derive a partial table from bounded publication rows');
 assert.doesNotMatch(observed.copy,/Previous private table/);
 assert.equal(observed.preserved,true,'published prediction and source objects remain unchanged');
 assert.match(observed.probabilities,/50/);assert.match(observed.probabilities,/30/);assert.match(observed.probabilities,/20/);
 if(process.env.MM_STANDINGS_SCREENSHOT){
  await page.locator('#analysisText p').filter({hasText:'league table'}).evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.screenshot({path:process.env.MM_STANDINGS_SCREENSHOT,fullPage:false});
 }
});
