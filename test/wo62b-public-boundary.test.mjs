// Public release boundary. Real DOM; every request except the synthetic document is aborted.
// No real key, hosted account, provider transmission, or production write.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const req=createRequire(import.meta.url);
let chromium;for(const id of [process.env.PWA_PLAYWRIGHT,'playwright-core','playwright'])if(id){try{chromium=req(id).chromium;break;}catch{}}
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const stored={mm_state:JSON.stringify({afKey:'synthetic-unassigned-football',fb:[]}),mm_ai:JSON.stringify({keys:{claude:'synthetic-unassigned-ai'}}),'mm_credentials_v1:A':JSON.stringify({version:1,owner:'A',slots:{af:'synthetic-assigned-football','ai:claude':'synthetic-assigned-ai'}})};
async function open(t,seed=stored){
 const executablePath=[process.env.MM_TEST_CHROMIUM,process.env.PWA_CHROMIUM,'/usr/bin/chromium'].find(p=>p&&existsSync(p));assert.ok(chromium&&executablePath,'Chromium required; no silent skip');
 const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block'});await context.addInitScript(seed=>{for(const[k,v]of Object.entries(seed))localStorage.setItem(k,v);},seed);
 await context.route('**/*',r=>r.request().url()==='http://public-boundary.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const page=await context.newPage();await page.goto('http://public-boundary.test/');return page;
}
test('public settings do not offer personal provider credential entry or consent',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{navTo('data');const panel=document.getElementById('view-data');const ids=['afKey','aiKeyInput','afSaveKey','aiSaveBtn','afKeyUse','aiKeyUse'];return{visible:!!panel&&getComputedStyle(panel).display!=='none'&&panel.getBoundingClientRect().height>0,text:panel.innerText,notice:document.getElementById('publicProviderNotice'),controls:ids.map(id=>{const e=document.getElementById(id);return{id,activeControl:!!e&&e.matches('input,button,select,textarea')};})};});
 assert.equal(r.visible,true,'the actual More/Data view must be visible before examining settings');assert.ok(r.controls.every(x=>!x.activeControl),'public credential IDs may be inert compatibility stubs, never active controls anywhere including hidden markup');
 assert.equal(r.notice,null);assert.doesNotMatch(r.text,/personal provider|API-Football key|provider key/i);
});
test('public analysis hides disabled discovery CTA and uses a human presentation error',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{supa={rpc:async()=>({data:null,error:{message:'synthetic private diagnostic'}}),auth:{getSession:async()=>({data:{session:null}})}};navTo('predict');await loadCloudLeagues(true);const panel=document.getElementById('view-predict');const card=document.getElementById('discoverCard');return{text:panel.innerText,status:(document.getElementById('fixturesMeta')||document.getElementById('discoverStatus')).textContent,hidden:card.hidden||getComputedStyle(card).display==='none',button:document.getElementById('discoverBtn').matches('button')};});
 assert.equal(r.hidden,true);assert.equal(r.button,false);assert.doesNotMatch(r.text,/Discover competitions|Find what's playing/i);assert.equal(r.status,'Matches temporarily unavailable. Please try again.');
});
test('public guest cannot save a key even by directly invoking handlers',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{onAuth(null);const before=Object.fromEntries(Object.keys(localStorage).filter(k=>k==='mm_state'||k==='mm_ai'||k.startsWith('mm_credentials_v1:')).map(k=>[k,localStorage.getItem(k)]));const af=credentialSave('af','synthetic-new-football'),ai=credentialSave('ai:claude','synthetic-new-ai');return{af,ai,active:!!afState.key||Object.values(aiKeys).some(Boolean),before,after:Object.fromEntries(Object.keys(before).map(k=>[k,localStorage.getItem(k)]))};});
 assert.equal(r.af,false);assert.equal(r.ai,false);assert.equal(r.active,false);assert.deepEqual(r.after,r.before);
});
test('public accounts do not activate owner stores or attribute unassigned keys through switching or reload',async t=>{
 const p=await open(t);async function inspect(){return p.evaluate(()=>{const out=[];for(const owner of ['A','B',null,'A']){onAuth(owner?{id:owner}:null);out.push({owner,active:!!afState.key||Object.values(aiKeys).some(Boolean)});}return{out,raw:Object.fromEntries(['mm_state','mm_ai','mm_credentials_v1:A'].map(k=>[k,localStorage.getItem(k)])),b:localStorage.getItem('mm_credentials_v1:B')};});}
 for(let n=0;n<2;n++){const r=await inspect();assert.ok(r.out.every(x=>!x.active));assert.deepEqual(r.raw,stored);assert.equal(r.b,null);if(!n)await p.reload();}
});
test('public authenticated save attempts neither replace nor assign preserved credentials',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{const results=[];for(const owner of ['A','B']){onAuth({id:owner});results.push(credentialSave('af','synthetic-replacement'),credentialSave('ai:claude','synthetic-replacement'));}return{results,a:localStorage.getItem('mm_credentials_v1:A'),b:localStorage.getItem('mm_credentials_v1:B'),active:!!afState.key||Object.values(aiKeys).some(Boolean)};});
 assert.ok(r.results.every(x=>x===false));assert.equal(r.a,stored['mm_credentials_v1:A']);assert.equal(r.b,null);assert.equal(r.active,false);
});
test('public personal-provider dispatch rejects before transport or session lookup despite manipulated DOM and memory',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const results=[];let transports=0,sessions=0;const oldFetch=window.fetch;
  window.fetch=async()=>{transports++;return{ok:true,status:200,json:async()=>({ok:true,text:'synthetic',content:[{text:'synthetic'}],choices:[{message:{content:'synthetic'}}],response:[]})};};
  try{for(const owner of [null,'A']){
   onAuth(owner?{id:owner}:null);aiProvider='claude';afState.key='synthetic-forced-football';aiKeys.claude='synthetic-forced-ai';for(const id of ['afKeyUse','aiKeyUse'])if($(id))$(id).checked=true;
   supa={auth:{getSession:async()=>{sessions++;return{data:{session:owner?{user:{id:owner},access_token:'synthetic-token'}:null}};}}};
   const context=credentialContext();const operations=[['football',()=>afFetch('/fixtures',undefined,context)],['football-auto',()=>afAuto('/fixtures',undefined,context)],['claude',()=>callClaude('synthetic','synthetic-key',context)],['compat',()=>openAICompat('https://api.deepseek.com/chat/completions','synthetic-model')('synthetic','synthetic-key',context)]];
   for(const[name,run]of operations){_aiLast=0;let rejected=false;try{await run();}catch{rejected=true;}results.push({owner,name,rejected});}
  }}finally{window.fetch=oldFetch;}
  return{results,transports,sessions};
 });assert.ok(r.results.every(x=>x.rejected),'every public provider and fallback route must reject');assert.equal(r.transports,0);assert.equal(r.sessions,0);
});
test('public AI server failure cannot fall back to a forced personal key',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{onAuth({id:'A'});supa={};aiProvider='claude';aiKeys.claude='synthetic-forced';if($('aiKeyUse'))$('aiKeyUse').checked=true;let proxies=0,direct=0;const oldProxy=callProxy,oldFetch=window.fetch;callProxy=async()=>{proxies++;throw Error('synthetic server unavailable');};window.fetch=async()=>{direct++;return{ok:true,json:async()=>({content:[{text:'synthetic'}]})};};let rejected=false;try{await runAIWriter('claude','synthetic',credentialContext());}catch{rejected=true;}finally{callProxy=oldProxy;window.fetch=oldFetch;}return{proxies,direct,rejected};});assert.equal(r.proxies,1,'server-managed route remains independently available');assert.equal(r.direct,0);assert.equal(r.rejected,true);
});
test('public local storage failure does not activate or overwrite any credential',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{onAuth({id:'A'});const get=Storage.prototype.getItem,set=Storage.prototype.setItem;let attempts=0;Storage.prototype.getItem=function(k){if(k.startsWith('mm_credentials_v1:'))throw Error('synthetic denied');return get.call(this,k);};Storage.prototype.setItem=function(k,v){if(k.startsWith('mm_credentials_v1:')){attempts++;throw Error('synthetic denied');}return set.call(this,k,v);};let saved;try{credentialSelect('A');saved=credentialSave('af','synthetic-failed');}finally{Storage.prototype.getItem=get;Storage.prototype.setItem=set;}return{saved,attempts,active:!!afState.key||Object.values(aiKeys).some(Boolean),raw:localStorage.getItem('mm_credentials_v1:A')};});assert.equal(r.saved,false);assert.equal(r.attempts,0);assert.equal(r.active,false);assert.equal(r.raw,stored['mm_credentials_v1:A']);
});
