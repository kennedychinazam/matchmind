import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const current=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const baseline=execFileSync('git',['show','68c00ded8043b7ee1a15937db1a32c01d932f4e7:index.html'],{encoding:'utf8',maxBuffer:4*1024*1024});
test('offline browser boot preserves engine and Smart Bet UI with zero added research bytes or requests',async()=>{
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-background-networking']});
 try {
  const outputs=[];
  for(const html of [baseline,current]) {
   const context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();
   const requests=[];
   await context.route('**/*',async route=>{
    const url=route.request().url();requests.push(url);
    if(url==='http://matchmind.test/') return route.fulfill({status:200,contentType:'text/html',body:html});
    return route.abort(); // No CDN, Supabase, provider or AI request leaves the browser.
   });
   await page.goto('http://matchmind.test/',{waitUntil:'load'});
   await page.waitForFunction(()=>typeof footballEngine==='object'&&typeof matchFeatures==='function');
   const result=await page.evaluate(()=>{
    navTo('tips');
    return {build:APP_BUILD,engine:typeof footballEngine.predict,feature:typeof matchFeatures,tab:lastTab,body:document.body.innerText.includes('Smart Bet'),signedIn:!!authUser,researchGlobals:typeof shadowForecast};
   });
   outputs.push({result,htmlBytes:Buffer.byteLength(html),researchRequests:requests.filter(u=>/research|snapshot|shadow_forecast/.test(u)).length});
   await context.close();
  }
  assert.deepEqual(outputs[1],outputs[0]);assert.equal(outputs[1].researchRequests,0);
  assert.equal(outputs[1].result.build,355);assert.equal(outputs[1].result.engine,'function');assert.equal(outputs[1].result.tab,'tips');assert.equal(outputs[1].result.signedIn,false);
 }finally{await browser.close();}
});
