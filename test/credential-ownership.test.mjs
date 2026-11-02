// Synthetic browser. Every request except the local test page is aborted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const chromium=createRequire(import.meta.url)('playwright-core').chromium;
async function open(t,seed){
 const executablePath=process.env.MM_TEST_CHROMIUM;assert.ok(executablePath&&existsSync(executablePath));
 const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block'});
 if(seed)await context.addInitScript(s=>{for(const [k,v] of Object.entries(s))localStorage.setItem(k,v);},seed);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 await context.route('**/*',r=>r.request().url()==='http://credential.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const p=await context.newPage();await p.goto('http://credential.test/');return p;
}
test('legacy ownerless keys remain unassigned and raw bytes are retained',async t=>{
 const state=JSON.stringify({afKey:'synthetic-af',fb:[]}),ai=JSON.stringify({keys:{claude:'synthetic-ai'}});
 const p=await open(t,{mm_state:state,mm_ai:ai});const result=await p.evaluate(()=>{saveState();return {af:$('afKey').value,activeAF:afState.key,ai:aiKeys.claude,state:localStorage.getItem('mm_state'),savedAI:localStorage.getItem('mm_ai')};});
 assert.ok(!result.af);assert.ok(!result.activeAF);assert.ok(!result.ai);assert.ok(result.state===state);assert.ok(result.savedAI===ai);
});
test('identity changes detach a saved AI key',async t=>{
 const p=await open(t);const result=await p.evaluate(()=>{
  onAuth({id:'synthetic-a'});aiProvider='claude';$('aiKeyInput').value='synthetic-owner-a';aiSave();
  onAuth({id:'synthetic-b'});aiProvider='claude';syncAIKeyField();
  return {field:$('aiKeyInput').value,active:aiKeys.claude};
 });assert.ok(!result.field);assert.ok(!result.active);
});
test('a proxy session belonging to another identity is rejected before dispatch',async t=>{
 const p=await open(t);const result=await p.evaluate(async()=>{
  onAuth({id:'synthetic-a'});let requests=0;
  supa={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-b'},access_token:'synthetic-token'}}})}};
  const oldFetch=window.fetch;window.fetch=async()=>{requests++;return {ok:true,json:async()=>({ok:true})};};
  let rejected=false;try{await callProxy('synthetic prompt','claude');}catch{rejected=true;}finally{window.fetch=oldFetch;}
  return {requests,rejected};
 });assert.equal(result.requests,0);assert.equal(result.rejected,true);
});
test('account keys restore only for their owner without triggering requests',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{
  let calls=0;window.fetch=async()=>{calls++;throw Error('blocked');};onAuth({id:'A'});
  $('afKey').value='af-a';credentialSave('af',$('afKey').value);aiProvider='claude';$('aiKeyInput').value='ai-a';aiSave();
  const saved={af:!!afState.key,ai:!!aiKeys.claude,fields:!!$('afKey').value||!!$('aiKeyInput').value};
  onAuth({id:'B'});const b=!!afState.key||!!aiKeys.claude;onAuth({id:'A'});
  return {saved,b,restored:!!afState.key&&!!aiKeys.claude,calls,ordinary:JSON.stringify(localStorage.getItem('mm_state')).includes('af-a')};
 });assert.ok(r.saved.af&&r.saved.ai&&!r.saved.fields);assert.ok(!r.b&&r.restored&&!r.ordinary);assert.equal(r.calls,0);
});
test('guest credentials require action and never persist or transfer to an account',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{
  $('afKey').value='guest-af';const before=!!afState.key;credentialSave('af',$('afKey').value);
  const enabled=!!afState.key,persisted=Object.keys(localStorage).some(k=>String(localStorage.getItem(k)).includes('guest-af'));
  onAuth({id:'B'});const transferred=!!afState.key;onAuth(null);return {before,enabled,persisted,transferred,revived:!!afState.key};
 });assert.ok(!r.before&&r.enabled&&!r.persisted&&!r.transferred&&!r.revived);
});
test('credential storage failure pauses use and reports failure',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{
  onAuth({id:'A'});const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('mm_credentials_v1:'))throw Error('denied');return original.call(this,k,v);};
  $('aiKeyInput').value='new-secret';aiProvider='claude';aiSave();Storage.prototype.setItem=original;
  return {active:!!aiKeys.claude,ready:_credentialReady,status:$('keyStatus').textContent};
 });assert.ok(!r.active&&!r.ready);assert.match(r.status,/Could not save/);
});
test('replacement prevents a queued proxy dispatch',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  onAuth({id:'A'});let unblock,requests=0;_aiChain=new Promise(r=>unblock=r);
  supa={auth:{getSession:async()=>({data:{session:{user:{id:'A'},access_token:'token'}}})}};
  window.fetch=async()=>{requests++;return {ok:true,json:async()=>({ok:true})};};
  const work=callProxy('prompt','claude').then(()=>false,()=>true);await Promise.resolve();await Promise.resolve();
  credentialSave('ai:claude','replacement');unblock();return {rejected:await work,requests};
 });assert.ok(r.rejected);assert.equal(r.requests,0);
});
test('switch during throttle cannot dispatch either owner key',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  onAuth({id:'A'});credentialSave('af','a');$('afKeyUse').checked=true;let wake,requests=0;const original=window.setTimeout;
  window.setTimeout=(fn)=>{wake=fn;return 1;};window.fetch=async()=>{requests++;return {ok:true,json:async()=>({response:[]})};};
  for(let i=0;i<9;i++)afRate.push(Date.now());const work=afFetch('/fixtures').then(()=>false,()=>true);onAuth({id:'B'});credentialSave('af','b');$('afKeyUse').checked=true;
  afRate.length=0;wake();const rejected=await work;window.setTimeout=original;return {rejected,requests};
 });assert.ok(r.rejected);assert.equal(r.requests,0);
});
test('proxy failure after switch cannot launch personal fallback',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  onAuth({id:'A'});aiProvider='claude';credentialSave('ai:claude','a');$('aiKeyUse').checked=true;
  let respond,proxy=0,direct=0;supa={auth:{getSession:async()=>({data:{session:{user:{id:'A'},access_token:'token'}}})}};
  window.fetch=async url=>{if(String(url).endsWith('/ai-analyze')){proxy++;return new Promise(r=>respond=r);}direct++;return {ok:true,json:async()=>({content:[]})};};
  const work=runAIWriter('claude','payload').then(()=>false,()=>true);
  for(let i=0;i<100&&!respond;i++)await new Promise(r=>setTimeout(r,10));if(!respond)throw Error('synthetic proxy did not start');onAuth({id:'B'});credentialSave('ai:claude','b');
  respond({ok:false,status:503,json:async()=>({ok:false})});return {rejected:await work,proxy,direct};
 });assert.ok(r.rejected);assert.equal(r.proxy,1);assert.equal(r.direct,0);
});
test('malformed and externally changed owner stores fail closed',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{
  localStorage.setItem(credentialStorageKey('A'),'{bad');onAuth({id:'A'});const bad=!_credentialReady&&!afState.key&&!aiKeys.claude;
  onAuth({id:'B'});credentialSave('af','first');const k=credentialStorageKey('B'),outside=JSON.stringify({version:1,owner:'other',slots:{af:'external'}});localStorage.setItem(k,outside);
  const saved=credentialSave('af','second');return {bad,saved,ready:_credentialReady,unchanged:localStorage.getItem(k)===outside,active:!!afState.key};
 });assert.ok(r.bad&&!r.saved&&!r.ready&&r.unchanged&&!r.active);
});
test('changing provider cancels an already queued provider operation',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  onAuth({id:'A'});let unblock,requests=0;_aiChain=new Promise(r=>unblock=r);
  supa={auth:{getSession:async()=>({data:{session:{user:{id:'A'},access_token:'original-token'}}})}};
  window.fetch=async()=>{requests++;return {ok:true,json:async()=>({ok:true})};};
  const work=callProxy('prompt','claude').then(()=>false,()=>true);await Promise.resolve();await Promise.resolve();
  $('aiProviderChips').querySelector('[data-aip="deepseek"]').click();unblock();return {rejected:await work,requests};
 });assert.ok(r.rejected);assert.equal(r.requests,0);
});
test('queued proxy dispatch uses its captured validated token',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  onAuth({id:'A'});let unblock,usedOriginal=false,requests=0;_aiChain=new Promise(r=>unblock=r);
  const session={user:{id:'A'},access_token:'original-token'};supa={auth:{getSession:async()=>({data:{session}})}};
  window.fetch=async(_url,init)=>{requests++;usedOriginal=init.headers.authorization==='Bearer original-token';return {ok:true,json:async()=>({ok:true})};};
  const work=callProxy('prompt','claude');await Promise.resolve();await Promise.resolve();session.access_token='changed-token';unblock();await work;return {usedOriginal,requests};
 });assert.ok(r.usedOriginal);assert.equal(r.requests,1);
});
test('explicit personal AI use dispatches only the selected owner key',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  onAuth({id:'A'});aiProvider='claude';credentialSave('ai:claude','owner-key');
  let requests=0,matched=false;window.fetch=async(_url,init)=>{requests++;matched=init.headers['x-api-key']==='owner-key';return {ok:true,json:async()=>({content:[{text:'response'}]})};};
  let prompt='';try{await runAIWriter('claude','prompt');}catch(e){prompt=e.message;}const before=requests;$('aiKeyUse').checked=true;
  const result=await runAIWriter('claude','prompt');return {requests,matched,own:result.via==='own',before,prompt};
 });assert.match(r.prompt,/Enable personal AI key fallback/);assert.equal(r.before,0);assert.ok(r.matched&&r.own);assert.equal(r.requests,1);
});
test('guest key does not survive reload',async t=>{
 const p=await open(t);const enabled=await p.evaluate(()=>{credentialSave('af','guest-key');return !!afState.key;});assert.ok(enabled);
 await p.reload();const restored=await p.evaluate(()=>!!afState.key||!!$('afKey').value);assert.ok(!restored);
});
