// Actual full app in local Chrome. All identities/data are invented; external network is blocked.
import test from'node:test';import assert from'node:assert/strict';import{readFileSync,existsSync}from'node:fs';import{createRequire}from'node:module';
const{chromium}=createRequire(import.meta.url)('playwright-core');
async function open(t,width=390){
 const executablePath=process.env.MM_TEST_CHROMIUM;assert.ok(executablePath&&existsSync(executablePath));const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:844},timezoneId:'UTC'});await context.addInitScript(()=>{localStorage.setItem('mm_intro','1');const original=setTimeout;window.__bootReadDone=false;window.__originalSetTimeout=original;window.setTimeout=(fn,ms,...args)=>ms===800&&typeof fn==='function'?original((...rest)=>{try{return fn(...rest);}finally{window.__bootReadDone=true;}},ms,...args):original(fn,ms,...args);});
 context.setDefaultTimeout(5000);const html=readFileSync(process.env.MM_PUBLIC_RECOVERY_HTML||new URL('../index.html',import.meta.url),'utf8');await context.route('**/*',r=>r.request().url()==='http://public-recovery.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());const p=await context.newPage();await p.goto('http://public-recovery.test/');
 // Fence the actual cold-start callback; elapsed wall time alone is unsafe under load.
 await p.waitForFunction(()=>window.__bootReadDone===true);await p.evaluate(()=>{window.setTimeout=window.__originalSetTimeout;});
 await p.evaluate(()=>{
  const date=new Date().toISOString().slice(0,10),asof=new Date(Date.now()-1000).toISOString(),expires=new Date(Date.now()+60000).toISOString();
  const card={fxid:990369,lid:39,lname:'Synthetic League',lcountry:'Synthetic',date,time:'23:59',status:'NS',elapsed:null,home:'Recovery Home',away:'Recovery Away',gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:asof,provider:'af',prediction:null};
  window.__publicMode={scores:'ok',predictions:'fail',history:'fail',records:'fail'};window.__publicCalls=[];window.__rawCalls=[];
  supa={auth:{getSession:async()=>({data:{session:null},error:null})},from:table=>{__rawCalls.push(table);throw Error('RAW TABLE FORBIDDEN');},rpc:async(name,args)=>{
   __publicCalls.push({name,args,trace:new Error().stack});if(name==='matchmind_fixture_access_v1')return{data:{version:'matchmind-fixture-access/1',raw_allowed:false},error:null};
   if(name!=='matchmind_display_v1')throw Error('UNEXPECTED RPC');const mode=__publicMode[args.screen];if(mode==='fail')return{data:null,error:{message:'invented failure'}};if(mode==='stall')return new Promise(()=>{});
   return{data:{version:'matchmind-display/1',edition_id:'11111111-1111-4111-8111-111111111111',as_of:asof,expires_at:expires,screen:args.screen,cards:args.screen==='scores'&&mode!=='empty'?[card]:[],board:null,records:{engine:null,clv:null},slips:[]},error:null};
  }};fixtureDeliveryReset();
 });return p;
}
const shot=(p,name)=>p.screenshot({path:new URL('../../mm09-evidence/'+name,import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')});
test('accepted cloud Scores keep an honest badge when independent Analysis fails',async t=>{
 const p=await open(t);await p.evaluate(async()=>{await afScoresFromCloud();await loadCloudLeagues(true);refreshDataChip();});assert.match(await p.locator('#scoresList').innerText(),/Recovery Home/);assert.doesNotMatch(await p.locator('#dataChip').innerText(),/sample|unavailable/i);assert.deepEqual(await p.evaluate(()=>__rawCalls),[]);
});
test('failed empty-cache Scores remain unavailable after repaint and date selection',async t=>{
 const p=await open(t);await p.evaluate(async()=>{__publicMode.scores='fail';afState.scores={source:'cloud',list:[],at:Date.now()};await afScoresFromCloud();renderScores();});assert.match(await p.locator('#scoresMeta').innerText(),/unavailable|could not|refresh failed/i);assert.doesNotMatch(await p.locator('#scoresMeta').innerText(),/^No matches/i);await p.evaluate(async()=>{buildCompsDrop('compsDropS');await loadFixturePresentation();buildCompsDrop('compsDrop');});for(const id of['compsDropS','compsDrop']){assert.match(await p.locator('#'+id).innerText(),/temporarily unavailable/i);assert.equal(await p.locator('#'+id+' .lgitem[data-f=all] > .muted').innerText(),'—');}assert.deepEqual(await p.evaluate(()=>__rawCalls),[]);
});
for(const width of[320,390])test(width+'px public Scores Retry recovers without clearing data or raw fallback',async t=>{
 const p=await open(t,width);await p.evaluate(async()=>{__publicMode.scores='fail';afState.scores={source:'cloud',list:[],at:Date.now()};await afScoresFromCloud();renderScores();localStorage.setItem('mm_personal_v1:owner:sentinel','invented retained bytes');});
 const retry=p.locator('#view-scores').getByRole('button',{name:/retry/i});assert.equal(await retry.isVisible(),true);await shot(p,'scores-unavailable-'+width+'.png');if(width===320){await p.locator('#segCompsS').click();assert.match(await p.locator('#compsDropS').innerText(),/temporarily unavailable/);await shot(p,'scores-menu-unavailable-320.png');await p.locator('#segCompsS').click();}await p.evaluate(()=>{__publicMode.scores='ok';});await retry.click();await p.waitForFunction(()=>document.getElementById('scoresList').textContent.includes('Recovery Home'));
 assert.doesNotMatch(await p.locator('#scoresMeta').innerText(),/unavailable|refresh failed/i);assert.equal(await p.evaluate(()=>localStorage.getItem('mm_personal_v1:owner:sentinel')),'invented retained bytes');assert.deepEqual(await p.evaluate(()=>__rawCalls),[]);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await shot(p,'scores-recovered-'+width+'.png');
});
test('More shared-record failure recovers in place after one online event',async t=>{
 const p=await open(t);await p.evaluate(async()=>{navTo('data');await loadSharedRecords();renderMoreRecord();});assert.match(await p.locator('#moreRecordLine').innerText(),/could not|unavailable/i);await p.waitForFunction(()=>_engineRecord.state==='failed'&&!_engineRecordLoading);const before=await p.evaluate(()=>__publicCalls.filter(x=>x.args?.screen==='records').length);
 await p.evaluate(()=>{__publicMode.records='empty';});await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>_engineRecord.state),'failed');assert.equal(await p.evaluate(()=>__publicCalls.filter(x=>x.args?.screen==='records').length),before,JSON.stringify(await p.evaluate(()=>__publicCalls.filter(x=>x.args?.screen==='records'))));await p.evaluate(()=>window.dispatchEvent(new Event('online')));await p.waitForFunction(()=>!document.getElementById('moreRecordLine').textContent.match(/could not|unavailable|reading/i));assert.ok(await p.evaluate(()=>__publicCalls.filter(x=>x.args?.screen==='records').length)>before);assert.deepEqual(await p.evaluate(()=>__rawCalls),[]);await shot(p,'more-record-recovered-390.png');
});
