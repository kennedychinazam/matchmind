// Local Chrome, synthetic owners only. Every external request is aborted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright-core';
async function open(t){
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM,args:['--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}}),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 await context.route('**/*',r=>r.request().url()==='http://localhost/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await context.addInitScript(()=>localStorage.setItem('mm_intro','1'));
 const p=await context.newPage();await p.goto('http://localhost/');
 await p.evaluate(()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};window.cloudWrites=[];window.recoveryCloud={user_id:'A',fav_teams:['cloud favourite','removed team'],record:[{fxid:1,pick:'old original'}],prefs:{theme:'light',settings:{tz:'Asia/Tokyo',lang:'',edgeOnly:false}}};
  window.installRecoveryCloud=()=>{supa={from:()=>({select:()=>({eq:(_k,id)=>({maybeSingle:async()=>({data:id==='A'?recoveryCloud:{user_id:id},error:null})})}),upsert:async row=>(cloudWrites.push(row),{error:null})})};};installRecoveryCloud();
  window.corruptRaw='{original unreadable owner data';localStorage.setItem(personalKey('A'),corruptRaw);onAuth({id:'A'});
 });return p;
}

test('actual review/confirm buttons preserve original backup and merge known session edits with cloud settings',async t=>{
 const p=await open(t);await p.evaluate(()=>{afState.favT=['new session favourite'];afState.favDel.T['removed team']=Date.now();afState.record=[{fxid:2,pick:'new session record'}];saveState();navTo('data');});
 await p.locator('#personalRecoveryReview').click();await p.locator('#personalRecoveryUse').waitFor();
 const before=await p.evaluate(()=>({same:localStorage.getItem(personalKey('A'))===corruptRaw,writes:cloudWrites.length,ready:_personalReady,text:$('acctBox').textContent}));
 assert.equal(before.same,true);assert.equal(before.writes,0);assert.equal(before.ready,false);assert.match(before.text,/Tokyo/);assert.match(before.text,/Close other MatchMind tabs/);
 mkdirSync('../reconciliation-evidence',{recursive:true});await p.locator('#acctBox').screenshot({path:'../reconciliation-evidence/review-mobile.png'});
 await p.locator('#personalRecoveryUse').click();
 await p.waitForFunction(()=>_personalReady);
 const after=await p.evaluate(async()=>({stored:JSON.parse(localStorage.getItem(personalKey('A'))),backup:await personalRecoveryRows(),ready:_personalReady}));
 assert.equal(after.ready,true);assert.equal(after.stored.theme,'light');assert.equal(after.stored.prefs.tz,'Asia/Tokyo');
 assert.deepEqual(after.stored.favT,['cloud favourite','new session favourite']);assert.deepEqual(after.stored.record.map(x=>x.fxid),[1,2]);assert.ok(after.stored.favDel.T['removed team']);
 assert.equal(after.backup.length,1);assert.equal(after.backup[0].raw,'{original unreadable owner data');assert.match(after.backup[0].sessionRaw,/new session favourite/);
 await p.waitForFunction(()=>_cloudSync.status==='confirmed');assert.deepEqual(await p.evaluate(()=>cloudWrites.at(-1).fav_teams),['cloud favourite','new session favourite']);
 await p.reload();const reloaded=await p.evaluate(()=>{onAuth({id:'A'});return afState.favT;});assert.deepEqual(reloaded,['cloud favourite','new session favourite']);
});

test('equal-clock repeated backups use durable sequence order, including a return to earlier preference values',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const now=Date.now;const fixed=now();Date.now=()=>fixed;
  try{themeMode='auto';saveState();await reviewPersonalRecovery();themeMode='light';saveState();await reviewPersonalRecovery();themeMode='auto';saveState();await reviewPersonalRecovery();
   return (await personalRecoveryRows()).map(x=>({at:x.at,seq:x.seq,theme:JSON.parse(x.sessionRaw).theme}));
  }finally{Date.now=now;}
 });assert.deepEqual(r.map(x=>x.seq).sort((a,b)=>a-b),[1,2,3]);assert.equal(new Set(r.map(x=>x.at)).size,1);
 await p.reload();const after=await p.evaluate(async()=>{cloudEnabled=()=>true;aiShadowGate=async()=>{};supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:'A',prefs:{theme:'light'}},error:null})})}),upsert:async()=>({error:null})})};onAuth({id:'A'});await reviewPersonalRecovery();await usePersonalRecovery();return{theme:themeMode,ready:_personalReady};});
 assert.deepEqual(after,{theme:'auto',ready:true});
});

test('cloud upload failure after confirmed local recovery leaves durable edits, readiness and a truthful failed sync state',async t=>{
 const p=await open(t);await p.evaluate(async()=>{afState.favT=['durable recovered edit'];saveState();await reviewPersonalRecovery();
  supa.from=()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:recoveryCloud,error:null})})}),upsert:async()=>({error:{message:'offline after local recovery'}})});await usePersonalRecovery();});
 await p.waitForFunction(()=>_cloudSync.status==='failed');const r=await p.evaluate(()=>({ready:_personalReady,stored:JSON.parse(localStorage.getItem(personalKey('A'))).favT,status:_cloudSync.status}));
 assert.equal(r.ready,true);assert.ok(r.stored.includes('durable recovered edit'));assert.equal(r.status,'failed');
});

test('Retry and account switches retain genuine post-corrupt-read session edits without activating defaults or uploading',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{afState.favT=['A session edit'];themeMode='auto';saveState();await retryPersonalStorage();
  const retry=[...afState.favT];onAuth({id:'B'});onAuth({id:'A'});return{retry,returned:[...afState.favT],theme:themeMode,ready:_personalReady,same:localStorage.getItem(personalKey('A'))===corruptRaw,writes:cloudWrites.length};});
 assert.deepEqual(r,{retry:['A session edit'],returned:['A session edit'],theme:'auto',ready:false,same:true,writes:0});
});

for(const transition of ['Retry','account away and back'])test(`external valid same-owner repair preserves session edits through ${transition}`,async t=>{
 const p=await open(t);const r=await p.evaluate(async transition=>{
  afState.favT=['known session edit'];afState.favDel.T['removed externally']=Date.now();afState.record=[{fxid:2,pick:'session record'}];themeMode='auto';saveState();
  const external={favT:['external favourite','removed externally'],favL:[39],favM:[],record:[{fxid:1,pick:'external original'}],theme:'light',prefs:{tz:'Asia/Tokyo'}};
  localStorage.setItem(personalKey('A'),JSON.stringify(external));
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:{message:'cloud offline'}})})}),upsert:async row=>(cloudWrites.push(row),{error:null})})};
  if(transition==='Retry')await retryPersonalStorage();else{onAuth({id:'B'});onAuth({id:'A'});}
  return{ready:_personalReady,theme:themeMode,tz:prefs.tz,fav:[...afState.favT],record:afState.record.map(x=>x.fxid),stored:JSON.parse(localStorage.getItem(personalKey('A'))),b:localStorage.getItem(personalKey('B'))};
 },transition);assert.equal(r.ready,true);assert.equal(r.theme,'auto');assert.equal(r.tz,'Asia/Tokyo');assert.deepEqual(r.fav,['external favourite','known session edit']);assert.deepEqual(r.record,[1,2]);assert.deepEqual(r.stored.favT,r.fav);assert.doesNotMatch(r.b||'',/known session edit/);
 await p.reload();const reloaded=await p.evaluate(()=>{onAuth({id:'A'});return{fav:[...afState.favT],theme:themeMode,tz:prefs.tz};});assert.deepEqual(reloaded,{fav:r.fav,theme:'auto',tz:'Asia/Tokyo'});
});

test('a quota failure while merging an externally valid repair retains a retryable combined owner snapshot',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  afState.favT=['session edit'];saveState();localStorage.setItem(personalKey('A'),JSON.stringify({favT:['external edit'],theme:'light'}));
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===personalKey('A'))throw new DOMException('synthetic quota','QuotaExceededError');return set.call(this,k,v);};
  const first=await retryPersonalStorage(),paused={ready:_personalReady,stage:_personalStorageError.stage,fav:[...afState.favT]};
  Storage.prototype.setItem=set;supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:{message:'offline'}})})})})};
  const second=await retryPersonalStorage();return{first,paused,second,stored:JSON.parse(localStorage.getItem(personalKey('A'))).favT};
 });assert.equal(r.first,false);assert.equal(r.paused.ready,false);assert.equal(r.paused.stage,'personal-write');assert.deepEqual(r.paused.fav,['external edit','session edit']);assert.equal(r.second,true);assert.deepEqual(r.stored,r.paused.fav);
});

test('offline review durably preserves session edits and later recovery after reload hydrates untouched cloud preferences',async t=>{
 const p=await open(t);const first=await p.evaluate(async()=>{afState.favT=['offline session edit'];themeMode='auto';saveState();
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:{message:'offline'}})})})})};const reviewed=await reviewPersonalRecovery();
  return{reviewed,rows:await personalRecoveryRows(),same:localStorage.getItem(personalKey('A'))===corruptRaw,ready:_personalReady};});
 assert.equal(first.reviewed,false);assert.equal(first.rows.length,1);assert.match(first.rows[0].sessionRaw,/offline session edit/);assert.equal(first.same,true);assert.equal(first.ready,false);
 await p.reload();const after=await p.evaluate(async()=>{cloudEnabled=()=>true;aiShadowGate=async()=>{};supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:'A',prefs:{theme:'light',settings:{tz:'Asia/Tokyo'}}},error:null})})}),upsert:async()=>({error:null})})};
  onAuth({id:'A'});await reviewPersonalRecovery();await usePersonalRecovery();return{ready:_personalReady,fav:[...afState.favT],theme:themeMode,tz:prefs.tz};});
 assert.deepEqual(after,{ready:true,fav:['offline session edit'],theme:'auto',tz:'Asia/Tokyo'});
});

for(const failure of ['quota','blocked','tampered-readback'])test(`backup ${failure} prevents any replacement or upload`,async t=>{
 const p=await open(t);const r=await p.evaluate(async failure=>{
  const add=IDBObjectStore.prototype.add,open=indexedDB.open.bind(indexedDB),rows=personalRecoveryRows;
  if(failure==='quota')IDBObjectStore.prototype.add=function(){throw new DOMException('synthetic quota','QuotaExceededError');};
  if(failure==='blocked')indexedDB.open=()=>{throw new DOMException('synthetic blocked','SecurityError');};
  if(failure==='tampered-readback'){let n=0;personalRecoveryRows=async()=>{const result=await rows();if(++n>1&&result[0])result[0].sessionRaw+='bad';return result;};}
  const reviewed=await reviewPersonalRecovery(),used=await usePersonalRecovery();IDBObjectStore.prototype.add=add;indexedDB.open=open;personalRecoveryRows=rows;
  return{reviewed,used,same:localStorage.getItem(personalKey('A'))===corruptRaw,writes:cloudWrites.length,ready:_personalReady};
 },failure);assert.deepEqual(r,{reviewed:false,used:false,same:true,writes:0,ready:false});
});

test('edits made after review invalidate confirmation and a fresh review includes them',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{await reviewPersonalRecovery();afState.favT=['late edit'];saveState();const used=await usePersonalRecovery();
  const untouched=localStorage.getItem(personalKey('A'))===corruptRaw;const reviewed=await reviewPersonalRecovery();return{used,untouched,reviewed,fav:_personalRecoveryReview.candidate.favT};});
 assert.equal(r.used,false);assert.equal(r.untouched,true);assert.equal(r.reviewed,true);assert.ok(r.fav.includes('late edit'));
});

test('an account switch during cloud review cannot activate or write the former owner candidate',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  let finish;supa={from:()=>({select:()=>({eq:(_k,id)=>({maybeSingle:()=>id==='A'?new Promise(r=>finish=r):Promise.resolve({data:{user_id:id},error:null})})}),upsert:async()=>({error:null})})};
  const pending=reviewPersonalRecovery();while(!finish)await new Promise(r=>setTimeout(r,0));onAuth({id:'B'});finish({data:{user_id:'A',fav_teams:['A private']},error:null});const reviewed=await pending;
  return{reviewed,owner:authUser.id,review:_personalRecoveryReview,fav:[...afState.favT],same:localStorage.getItem(personalKey('A'))===corruptRaw};
 });assert.equal(r.reviewed,false);assert.equal(r.owner,'B');assert.equal(r.review,null);assert.doesNotMatch(JSON.stringify(r.fav),/A private/);assert.equal(r.same,true);
});

for(const change of ['wrong owner','malformed preferences','changed cloud','changed original'])test(`${change} blocks recovery confirmation`,async t=>{
 const p=await open(t);const r=await p.evaluate(async change=>{
  if(change==='wrong owner')recoveryCloud.user_id='B';if(change==='malformed preferences')recoveryCloud.prefs.settings.tz=42;
  const reviewed=await reviewPersonalRecovery();if(change==='changed cloud')recoveryCloud.fav_teams=['cloud changed after review'];if(change==='changed original')localStorage.setItem(personalKey('A'),'different unreadable original');
  const used=await usePersonalRecovery();return{reviewed,used,raw:localStorage.getItem(personalKey('A')),writes:cloudWrites.length,ready:_personalReady};
 },change);assert.equal(r.used,false);assert.equal(r.writes,0);assert.equal(r.ready,false);assert.equal(r.raw,change==='changed original'?'different unreadable original':'{original unreadable owner data');
});

test('ordinary cache clear/reset preserves immutable backups and ownerless legacy bytes',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{localStorage.setItem('mm_state','legacy ownerless');localStorage.setItem('mm_state_UNASSIGNED','conflicting legacy backup');await reviewPersonalRecovery();
  const before=JSON.stringify(await personalRecoveryRows());await clearRecentCache();await resetRecentCache();return{same:JSON.stringify(await personalRecoveryRows())===before,legacy:localStorage.getItem('mm_state'),backup:localStorage.getItem('mm_state_UNASSIGNED')};});
 assert.deepEqual(r,{same:true,legacy:'legacy ownerless',backup:'conflicting legacy backup'});
});
