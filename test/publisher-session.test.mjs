import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {openPublisherBrowser} from '../robot/session.mjs';
import {chromium} from 'playwright-core';
test('synthetic localStorage, cookies and IndexedDB survive reload but cannot reach a later browser run',async()=>{
 // Use the same configured Chromium executable as the rest of the acceptance suite.
 const driver={launch:options=>chromium.launch({...options,channel:undefined,executablePath:process.env.MM_TEST_CHROMIUM})};
 const {browser,context}=await openPublisherBrowser(driver,undefined,'Africa/Lagos');
 try{
  const route=r=>r.request().url()==='http://publisher-session.test/'?r.fulfill({contentType:'text/html',body:'<title>Synthetic session fixture</title>'}):r.abort();
  await context.route('**/*',route);const page=await context.newPage();await page.goto('http://publisher-session.test/');
  await page.evaluate(async()=>{
   localStorage.setItem('synthetic-auth','dummy-session-only');
   document.cookie='synthetic-auth=dummy-session-only; Path=/';
   await new Promise((resolve,reject)=>{
    const request=indexedDB.open('synthetic-auth',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('session');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
     const db=request.result,tx=db.transaction('session','readwrite');
     tx.objectStore('session').put('dummy-session-only','token');
     tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
    };
   });
  });
  await page.reload();assert.equal(await page.evaluate(()=>localStorage.getItem('synthetic-auth')),'dummy-session-only');
  assert.match(await page.evaluate(()=>document.cookie),/synthetic-auth=dummy-session-only/);
  assert.deepEqual(await page.evaluate(async()=> (await indexedDB.databases()).map(db=>db.name)),['synthetic-auth']);
  assert.equal(await page.evaluate(()=>new Promise((resolve,reject)=>{
   const request=indexedDB.open('synthetic-auth');
   request.onerror=()=>reject(request.error);request.onsuccess=()=>{
    const db=request.result,read=db.transaction('session').objectStore('session').get('token');
    read.onsuccess=()=>{db.close();resolve(read.result);};read.onerror=()=>reject(read.error);
   };
  })),'dummy-session-only');
  await browser.close();
  const later=await openPublisherBrowser(driver,undefined,'Africa/Lagos');
  try{
   await later.context.route('**/*',route);
   const fresh=await later.context.newPage();await fresh.goto('http://publisher-session.test/');
   assert.equal(await fresh.evaluate(()=>localStorage.getItem('synthetic-auth')),null);
   assert.equal(await fresh.evaluate(()=>document.cookie),'');
   assert.deepEqual(await fresh.evaluate(()=>indexedDB.databases()),[]);
  }finally{await later.browser.close();}
 }finally{await browser.close();}
});

// Execute the real main body with synthetic browser/app boundaries. Never import the executable
// module: its top-level invocation would navigate to the hosted publisher and exit this process.
const robotSource=readFileSync(new URL('../robot/publish.mjs',import.meta.url),'utf8');
function publisherRig({dryRun=true,email='',password='',fail=false}={}){
 const calls={opened:0,closed:0,signedIn:[],logs:[]};
 const page={on:()=>{},evaluate:async(fn,args)=>vm.runInContext(`(${fn.toString()})(syntheticArgs)`,Object.assign(sandbox,{syntheticArgs:args}))};
 const sandbox=vm.createContext({
  process:{env:{MM_DRY_RUN:dryRun?'1':'0',MM_PUBLISHER_EMAIL:email,MM_PUBLISHER_PASSWORD:password}},
  console:{log:message=>calls.logs.push(message)},setTimeout,chromium:{},
  openPublisherBrowser:async()=>{calls.opened++;return{browser:{close:async()=>{calls.closed++;}},context:{pages:()=>[page]}};},
  supa:{auth:{getSession:async()=>({data:{session:null}}),signInWithPassword:async credentials=>{calls.signedIn.push(credentials);return{error:null};}}},
 });
 const withoutImports=robotSource.replace(/^import .*;\r?\n/gm,'');
 const entryPoint=withoutImports.lastIndexOf('main().then(');assert.ok(entryPoint>0,'locate executable entry point');
 const executable=withoutImports.slice(0,entryPoint);
 vm.runInContext(executable,sandbox);
 sandbox.openApp=async()=>{};sandbox.ensureSignedIn=async()=>{};sandbox.publisherCounts=async()=>({});
 sandbox.waitSettled=async()=>{if(fail)throw Error('synthetic app failure');return{};};
 return{calls,run:()=>sandbox.main()};
}
test('real publisher main closes the browser after a signed-out success without signing in',async()=>{
 const rig=publisherRig();assert.equal(await rig.run(),0);
 assert.equal(rig.calls.opened,1);assert.equal(rig.calls.closed,1);assert.deepEqual(rig.calls.signedIn,[]);
});
test('real publisher main closes the browser after an app failure',async()=>{
 const rig=publisherRig({fail:true});await assert.rejects(rig.run(),/synthetic app failure/);
 assert.equal(rig.calls.opened,1);assert.equal(rig.calls.closed,1);
});
test('publisher requires both environment credentials before launching an authenticated run',async()=>{
 for(const credentials of [{},{email:'synthetic@example.invalid'},{password:'synthetic-password'}]){
  const rig=publisherRig({dryRun:false,...credentials});await assert.rejects(rig.run(),/MM_PUBLISHER_EMAIL and MM_PUBLISHER_PASSWORD must be set/);
  assert.equal(rig.calls.opened,0);assert.deepEqual(rig.calls.signedIn,[]);
 }
});
test('fresh authenticated run signs in from environment and closes on a subsequent failure without logging credentials',async()=>{
 const email='synthetic-publisher@example.invalid',password='synthetic-password-only';
 const rig=publisherRig({dryRun:false,email,password,fail:true});await assert.rejects(rig.run(),/synthetic app failure/);
 assert.deepEqual(JSON.parse(JSON.stringify(rig.calls.signedIn)),[{email,password}]);
 assert.equal(rig.calls.closed,1);
 for(const message of rig.calls.logs){assert.equal(message.includes(email),false);assert.equal(message.includes(password),false);}
});
test('publisher creates a fresh context with no profile or exported authentication state',async()=>{
 const calls=[];const context={};const browser={newContext:async opts=>(calls.push(opts),context),close:async()=>{}};
 const result=await openPublisherBrowser({launch:async opts=>(calls.push(opts),browser)},'chrome','Africa/Lagos');
 assert.equal(result.browser,browser);assert.equal(result.context,context);
 assert.deepEqual(calls,[{channel:'chrome',headless:true},{timezoneId:'Africa/Lagos',viewport:{width:412,height:915}}]);
});
test('browser closes if context creation fails',async()=>{
 let closed=false;await assert.rejects(openPublisherBrowser({launch:async()=>({newContext:async()=>{throw Error('synthetic');},close:async()=>{closed=true;}})},'chrome','Africa/Lagos'),/synthetic/);assert.equal(closed,true);
});
test('scheduled workflow neither restores nor saves the old authenticated profile',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/publish-picks.yml',import.meta.url),'utf8');
 const robot=readFileSync(new URL('../robot/publish.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(workflow,/actions\/cache|mm-profile|MM_PROFILE_DIR/);
 assert.doesNotMatch(workflow,/upload-artifact/,'the publisher job must not export browser files');
 assert.doesNotMatch(robot,/launchPersistentContext|storageState\(/);
 assert.match(robot,/await browser\.close\(\)/);
 assert.match(workflow,/MM_PUBLISHER_PASSWORD: \$\{\{ secrets\.MM_PUBLISHER_PASSWORD \}\}/);
 assert.match(workflow,/MM_PUBLISHER_EMAIL: \$\{\{ secrets\.MM_PUBLISHER_EMAIL \}\}/);
});
