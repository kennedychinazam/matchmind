// Independent primary review: failed final write and account change during confirmation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
async function open(t){
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM,args:['--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block'}),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 await context.route('**/*',r=>r.request().url()==='http://localhost/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await context.addInitScript(()=>localStorage.setItem('mm_intro','1'));
 const p=await context.newPage();await p.goto('http://localhost/');
 await p.evaluate(()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};window.reviewWrites=[];
  window.reviewCloud={user_id:'A',fav_teams:['cloud original'],prefs:{theme:'light',settings:{tz:'Asia/Tokyo'}}};
  supa={from:()=>({select:()=>({eq:(_k,id)=>({maybeSingle:async()=>({data:id==='A'?reviewCloud:{user_id:id},error:null})})}),upsert:async row=>(reviewWrites.push(row),{error:null})})};
  localStorage.setItem(personalKey('A'),'{unreadable original');onAuth({id:'A'});
  afState.favT=['genuine unsaved edit'];saveState();
 });return p;
}
test('primary review: final personal write failure preserves backup, original and edits, then can retry',async t=>{
 const p=await open(t);const before=await p.evaluate(async()=>{
  const reviewed=await reviewPersonalRecovery(),set=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===personalKey('A'))throw new DOMException('synthetic final-write quota','QuotaExceededError');return set.call(this,k,v);};
  const used=await usePersonalRecovery();Storage.prototype.setItem=set;
  return {reviewed,used,ready:_personalReady,raw:localStorage.getItem(personalKey('A')),edits:[...afState.favT],backups:(await personalRecoveryRows()).map(r=>r.raw),writes:reviewWrites.length};
 });
 assert.deepEqual(before,{reviewed:true,used:false,ready:false,raw:'{unreadable original',edits:['genuine unsaved edit'],backups:['{unreadable original'],writes:0});
 const after=await p.evaluate(async()=>{await reviewPersonalRecovery();const used=await usePersonalRecovery();return{used,stored:JSON.parse(localStorage.getItem(personalKey('A')))};});
 assert.equal(after.used,true);assert.deepEqual(after.stored.favT,['cloud original','genuine unsaved edit']);assert.equal(after.stored.prefs.tz,'Asia/Tokyo');
});
test('primary review: account change during final cloud recheck cannot replace A or expose A edits to B',async t=>{
 const p=await open(t);const got=await p.evaluate(async()=>{
  await reviewPersonalRecovery();let finish;
  supa.from=()=>({select:()=>({eq:(_k,id)=>({maybeSingle:()=>id==='A'?new Promise(r=>finish=r):Promise.resolve({data:{user_id:id},error:null})})}),upsert:async row=>(reviewWrites.push(row),{error:null})});
  const pending=usePersonalRecovery();while(!finish)await new Promise(r=>setTimeout(r,0));
  onAuth({id:'B'});finish({data:reviewCloud,error:null});const used=await pending;
  return {used,owner:authUser.id,raw:localStorage.getItem(personalKey('A')),b:[...afState.favT],aWrites:reviewWrites.filter(r=>r.user_id==='A').length};
 });assert.deepEqual(got,{used:false,owner:'B',raw:'{unreadable original',b:[],aWrites:0});
});
test('primary review: damaged backup ordering metadata cannot select an older session for recovery',async t=>{
 const p=await open(t);const got=await p.evaluate(async()=>{
  afState.favT=['older session'];saveState();await reviewPersonalRecovery();
  afState.favT=['newer session'];saveState();await reviewPersonalRecovery();
  await personalRecoveryTransaction('readwrite',(store,done)=>{const q=store.getAll();q.onsuccess=()=>{const rows=q.result.sort((a,b)=>a.seq-b.seq);rows[0].seq=10000;store.put(rows[0]);done(true);};});
  // A fresh session must not treat the damaged ordering as authority to restore older edits.
  _personalReadBaselines.clear();_personalReadEdits.clear();personalSelect('A');
  const reviewed=await reviewPersonalRecovery();
  return {reviewed,ready:_personalReady,raw:localStorage.getItem(personalKey('A')),writes:reviewWrites.length};
 });assert.deepEqual(got,{reviewed:false,ready:false,raw:'{unreadable original',writes:0});
});
