// Synthetic browser only. All external requests are aborted; no real users, credentials or data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
async function open(t){
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM,args:['--disable-background-networking']});t.after(()=>browser.close());
 const ctx=await browser.newContext({serviceWorkers:'block'});
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 await ctx.route('**/*',r=>r.request().url()==='http://localhost/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await ctx.addInitScript(()=>localStorage.setItem('mm_intro','1'));
 const page=await ctx.newPage();await page.goto('http://localhost/');
 await page.evaluate(()=>{cloudEnabled=()=>true;aiShadowGate=async()=>{};window.syntheticWrites=[];
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async row=>(syntheticWrites.push(row),{error:null})})};
 });return page;
}
test('large legacy data and a conflicting backup stay unchanged without a second copy or owner import',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const raw=JSON.stringify({af:{favT:['legacy favourite']},cache:'x'.repeat(1400000)}),backup='different retained copy';
  localStorage.setItem('mm_state',raw);localStorage.setItem('mm_state_UNASSIGNED',backup);
  const old=Storage.prototype.setItem;let legacyWrites=0;
  Storage.prototype.setItem=function(k,v){if(k==='mm_state'||k==='mm_state_UNASSIGNED'){legacyWrites++;throw new DOMException('synthetic quota','QuotaExceededError');}return old.call(this,k,v);};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));afState.favT=['A favourite'];saveState();
  const result={ready:_personalReady,legacyWrites,same:localStorage.getItem('mm_state')===raw,backupSame:localStorage.getItem('mm_state_UNASSIGNED')===backup,favs:[...afState.favT]};Storage.prototype.setItem=old;return result;
 });assert.deepEqual(r,{ready:true,legacyWrites:0,same:true,backupSame:true,favs:['A favourite']});
});
test('optional cache quota failure still persists personal changes and completes cloud sync',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));await _recentCacheFlight;const old=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){if(this.name==='slots')throw new DOMException('synthetic quota','QuotaExceededError');return old.apply(this,args);};
  afState.favT=['saved favourite'];saveState();await _recentCacheFlight;await new Promise(r=>setTimeout(r,1300));
  const result={ready:_personalReady,cacheError:_cacheStorageError?.kind,stored:JSON.parse(localStorage.getItem(personalKey('A'))).favT,synced:syntheticWrites.at(-1)?.fav_teams,badge:$('acctSynced').textContent};IDBObjectStore.prototype.put=old;return result;
 });assert.equal(r.ready,true);assert.equal(r.cacheError,'quota');assert.deepEqual(r.stored,['saved favourite']);assert.deepEqual(r.synced,r.stored);assert.equal(r.badge,'synced');
});
test('a failed personal write retains the latest changes and explicit retry restores sync',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));const old=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===personalKey('A'))throw new DOMException('synthetic quota','QuotaExceededError');return old.call(this,k,v);};
  afState.favT=['first unsynced'];saveState();afState.favT=['unsynced newest'];saveState();const paused={ready:_personalReady,kind:_personalStorageError.kind,copy:JSON.parse(_personalMemory.get(personalKey('A'))).favT};
  Storage.prototype.setItem=old;const retried=await retryPersonalStorage();await new Promise(r=>setTimeout(r,1300));
  return {paused,retried,ready:_personalReady,stored:JSON.parse(localStorage.getItem(personalKey('A'))).favT,synced:syntheticWrites.at(-1)?.fav_teams};
 });assert.equal(r.paused.ready,false);assert.equal(r.paused.kind,'quota');assert.deepEqual(r.paused.copy,['unsynced newest']);assert.equal(r.retried,true);assert.equal(r.ready,true);assert.deepEqual(r.stored,r.paused.copy);assert.deepEqual(r.synced,r.paused.copy);
});
test('existing-owner recovery persists unsaved edits before an offline cloud read and survives reload',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));const old=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===personalKey('A'))throw new DOMException('synthetic quota','QuotaExceededError');return old.call(this,k,v);};
  afState.favT=['new unsaved favourite'];saveState();Storage.prototype.setItem=old;let diskAtCloudRead;
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{diskAtCloudRead=JSON.parse(localStorage.getItem(personalKey('A'))).favT;return{data:null,error:{message:'synthetic offline'}};}})}),upsert:async row=>(syntheticWrites.push(row),{error:null})})};
  const retried=await retryPersonalStorage();return {retried,diskAtCloudRead,stored:JSON.parse(localStorage.getItem(personalKey('A'))).favT,inMemory:[...afState.favT],ready:_personalReady,retryVisible:!!$('personalRetry'),status:_cloudSync.status};
 });assert.equal(r.retried,true);assert.deepEqual(r.diskAtCloudRead,['new unsaved favourite']);assert.deepEqual(r.stored,r.inMemory);assert.equal(r.ready,true);assert.equal(r.status,'failed');
 await p.reload();const reloaded=await p.evaluate(()=>{onAuth({id:'A'});return [...afState.favT];});assert.deepEqual(reloaded,['new unsaved favourite']);
});
test('a recovery write that still fails retains Retry storage without consulting the cloud',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));const old=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===personalKey('A'))throw new DOMException('synthetic quota','QuotaExceededError');return old.call(this,k,v);};
  afState.favT=['still unsaved'];saveState();let reads=0;supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{reads++;return{data:null,error:{message:'synthetic offline'}};}})})})};
  const retried=await retryPersonalStorage();const result={retried,ready:_personalReady,retryVisible:!!$('personalRetry'),reads,fav:[...afState.favT]};Storage.prototype.setItem=old;return result;
 });assert.deepEqual(r,{retried:false,ready:false,retryVisible:true,reads:0,fav:['still unsaved']});
});
test('an account switch during offline recovery keeps the durable edit in its original owner',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));const old=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===personalKey('A'))throw new DOMException('synthetic quota','QuotaExceededError');return old.call(this,k,v);};
  afState.favT=['A recovery edit'];saveState();Storage.prototype.setItem=old;let finish;
  supa={from:()=>({select:()=>({eq:(_k,id)=>({maybeSingle:()=>id==='A'?new Promise(r=>finish=r):Promise.resolve({data:{user_id:'B',fav_teams:['B only']},error:null})})}),upsert:async row=>(syntheticWrites.push(row),{error:null})})};
  const pending=retryPersonalStorage();const savedBeforeSwitch=JSON.parse(localStorage.getItem(personalKey('A'))).favT;
  onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));finish({data:null,error:{message:'synthetic offline'}});const returned=await pending;
  await new Promise(r=>setTimeout(r,1300));return {savedBeforeSwitch,returned,owner:authUser.id,b:[...afState.favT],a:JSON.parse(localStorage.getItem(personalKey('A'))).favT,bWrites:syntheticWrites.filter(x=>x.user_id==='B')};
 });assert.deepEqual(r.savedBeforeSwitch,['A recovery edit']);assert.equal(r.returned,false);assert.equal(r.owner,'B');assert.deepEqual(r.b,['B only']);assert.deepEqual(r.a,['A recovery edit']);assert.doesNotMatch(JSON.stringify(r.bWrites),/A recovery edit/);
});
test('first-device offline recovery durably preserves edits and hydration provenance across reload',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  let finish;supa={from:()=>({select:()=>({eq:()=>({maybeSingle:()=>new Promise(r=>finish=r)})}),upsert:async row=>(syntheticWrites.push(row),{error:null})})};
  onAuth({id:'A'});const old=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===personalKey('A'))throw new DOMException('synthetic quota','QuotaExceededError');return old.call(this,k,v);};
  themeMode='auto';afState.favT=['first-device edit'];saveState();Storage.prototype.setItem=old;finish({data:null,error:{message:'synthetic offline'}});await new Promise(r=>setTimeout(r,0));
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:{message:'synthetic offline'}})})})})};
  const retried=await retryPersonalStorage();return {retried,stored:localStorage.getItem(personalKey('A'))};
 });assert.equal(r.retried,true);assert.deepEqual(JSON.parse(r.stored).favT,['first-device edit']);assert.equal(JSON.parse(r.stored).preferenceOrigin.v,1);
 await p.reload();const after=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};const writes=[];
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:'A',prefs:{theme:'light',settings:{tz:'Asia/Tokyo'}}},error:null})})}),upsert:async row=>(writes.push(row),{error:null})})};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,1300));return {fav:[...afState.favT],theme:themeMode,tz:prefs.tz,stored:JSON.parse(localStorage.getItem(personalKey('A'))),uploaded:writes.at(-1)};
 });assert.deepEqual(after.fav,['first-device edit']);assert.equal(after.theme,'auto');assert.equal(after.tz,'Asia/Tokyo');assert.equal(after.stored.preferenceOrigin,undefined);assert.deepEqual(after.uploaded.fav_teams,['first-device edit']);assert.equal(after.uploaded.prefs.settings.tz,'Asia/Tokyo');
});
test('invalid durable hydration provenance fails closed and preserves the original partition',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const raw=JSON.stringify({favT:['retained original'],preferenceOrigin:{v:99,preferences:{}}});localStorage.setItem(personalKey('A'),raw);
  onAuth({id:'A'});const retried=await retryPersonalStorage();await new Promise(r=>setTimeout(r,1300));
  return {retried,ready:_personalReady,kind:_personalStorageError.kind,same:localStorage.getItem(personalKey('A'))===raw,writes:syntheticWrites.length};
 });assert.deepEqual(r,{retried:false,ready:false,kind:'corrupt',same:true,writes:0});
});
test('blocked reads have distinct feedback and recover after storage becomes available',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const old=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===personalKey('A'))throw new DOMException('synthetic block','SecurityError');return old.call(this,k);};
  onAuth({id:'A'});const first={ready:_personalReady,kind:_personalStorageError.kind,text:$('acctBox').textContent};
  Storage.prototype.getItem=old;const retried=await retryPersonalStorage();return {first,retried,ready:_personalReady};
 });assert.equal(r.first.ready,false);assert.equal(r.first.kind,'unavailable');assert.match(r.first.text,/blocking personal storage/);assert.match(r.first.text,/Retry storage/);assert.equal(r.retried,true);assert.equal(r.ready,true);
});
test('first login storage retry restores cloud preferences before creating and uploading a partition',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const old=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===personalKey('A'))throw new DOMException('synthetic block','SecurityError');return old.call(this,k);};
  let partitionAtRead;
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{partitionAtRead=localStorage.getItem(personalKey('A'));return{data:{user_id:'A',prefs:{theme:'light',settings:{tz:'Asia/Tokyo'}}},error:null};}})}),upsert:async row=>(syntheticWrites.push(row),{error:null})})};
  onAuth({id:'A'});const paused=!_personalReady;Storage.prototype.getItem=old;
  const retried=await retryPersonalStorage();await new Promise(r=>setTimeout(r,1300));
  return {paused,retried,partitionAtRead,theme:themeMode,tz:prefs.tz,stored:JSON.parse(localStorage.getItem(personalKey('A'))),uploaded:syntheticWrites.at(-1)};
 });assert.equal(r.paused,true);assert.equal(r.retried,true);assert.equal(r.partitionAtRead,null);
 assert.equal(r.theme,'light');assert.equal(r.tz,'Asia/Tokyo');assert.equal(r.stored.theme,'light');assert.equal(r.stored.prefs.tz,'Asia/Tokyo');
 assert.equal(r.uploaded.prefs.theme,'light');assert.equal(r.uploaded.prefs.settings.tz,'Asia/Tokyo');
});
test('storage retry retains genuine unsaved preferences and favourites from an existing partition',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));const old=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===personalKey('A'))throw new DOMException('synthetic quota','QuotaExceededError');return old.call(this,k,v);};
  themeMode='auto';prefs.tz='Europe/London';afState.favT=['unsynced favourite'];saveState();Storage.prototype.setItem=old;
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:'A',fav_teams:['cloud favourite'],prefs:{theme:'light',settings:{tz:'Asia/Tokyo'}}},error:null})})}),upsert:async row=>(syntheticWrites.push(row),{error:null})})};
  const retried=await retryPersonalStorage();await new Promise(r=>setTimeout(r,1300));return {retried,theme:themeMode,tz:prefs.tz,uploaded:syntheticWrites.at(-1)};
 });assert.equal(r.retried,true);assert.equal(r.theme,'auto');assert.equal(r.tz,'Europe/London');
 assert.equal(r.uploaded.prefs.theme,'auto');assert.equal(r.uploaded.prefs.settings.tz,'Europe/London');assert.deepEqual(r.uploaded.fav_teams,['unsynced favourite','cloud favourite']);
});
test('recovery merge keeps a preference edited during the read and restores untouched cloud settings',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const old=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===personalKey('A'))throw new DOMException('synthetic block','SecurityError');return old.call(this,k);};
  onAuth({id:'A'});Storage.prototype.getItem=old;let finish;
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:()=>new Promise(r=>finish=r)})}),upsert:async row=>(syntheticWrites.push(row),{error:null})})};
  const recovery=retryPersonalStorage();themeMode='auto';saveState();
  finish({data:{user_id:'A',prefs:{theme:'light',settings:{tz:'Asia/Tokyo'}}},error:null});const retried=await recovery;
  await new Promise(r=>setTimeout(r,1300));return {retried,theme:themeMode,tz:prefs.tz,uploaded:syntheticWrites.at(-1)};
 });assert.equal(r.retried,true);assert.equal(r.theme,'auto');assert.equal(r.tz,'Asia/Tokyo');
 assert.equal(r.uploaded.prefs.theme,'auto');assert.equal(r.uploaded.prefs.settings.tz,'Asia/Tokyo');
});
test('cloud read failure during recovery leaves no provisional partition to suppress the next restore',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const old=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===personalKey('A'))throw new DOMException('synthetic block','SecurityError');return old.call(this,k);};
  onAuth({id:'A'});Storage.prototype.getItem=old;let failed=true;
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>failed?{data:null,error:{message:'synthetic cloud failure'}}:{data:{user_id:'A',prefs:{theme:'light',settings:{tz:'Asia/Tokyo'}}},error:null}})}),upsert:async row=>(syntheticWrites.push(row),{error:null})})};
  const first=await retryPersonalStorage(),afterFailure=localStorage.getItem(personalKey('A'));failed=false;const second=await retryPersonalStorage();
  await new Promise(r=>setTimeout(r,1300));return {first,afterFailure,second,uploaded:syntheticWrites.at(-1)};
 });assert.equal(r.first,false);assert.equal(r.afterFailure,null);assert.equal(r.second,true);
 assert.equal(r.uploaded.prefs.theme,'light');assert.equal(r.uploaded.prefs.settings.tz,'Asia/Tokyo');
});
test('first-device partition provenance survives a failed write during initial cloud hydration',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  let finish;
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:()=>new Promise(r=>finish=r)})}),upsert:async row=>(syntheticWrites.push(row),{error:null})})};
  onAuth({id:'A'});const old=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(k===personalKey('A'))throw new DOMException('synthetic quota','QuotaExceededError');return old.call(this,k,v);};
  afState.favT=['unsaved during first read'];saveState();Storage.prototype.setItem=old;
  finish({data:{user_id:'A',prefs:{theme:'light',settings:{tz:'Asia/Tokyo'}}},error:null});await new Promise(r=>setTimeout(r,0));
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:'A',prefs:{theme:'light',settings:{tz:'Asia/Tokyo'}}},error:null})})}),upsert:async row=>(syntheticWrites.push(row),{error:null})})};
  const retried=await retryPersonalStorage();await new Promise(r=>setTimeout(r,1300));return {retried,uploaded:syntheticWrites.at(-1)};
 });assert.equal(r.retried,true);assert.deepEqual(r.uploaded.fav_teams,['unsaved during first read']);
 assert.equal(r.uploaded.prefs.theme,'light');assert.equal(r.uploaded.prefs.settings.tz,'Asia/Tokyo');
});
test('a failed first cloud read retains preference provenance alongside genuinely saved edits',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  let finish;supa={from:()=>({select:()=>({eq:()=>({maybeSingle:()=>new Promise(r=>finish=r)})}),upsert:async row=>(syntheticWrites.push(row),{error:null})})};
  onAuth({id:'A'});themeMode='auto';afState.favT=['saved while waiting'];saveState();
  finish({data:null,error:{message:'synthetic cloud failure'}});await new Promise(r=>setTimeout(r,0));
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:'A',prefs:{theme:'light',settings:{tz:'Asia/Tokyo'}}},error:null})})}),upsert:async row=>(syntheticWrites.push(row),{error:null})})};
  const retried=await retryPersonalStorage();await new Promise(r=>setTimeout(r,1300));return {retried,uploaded:syntheticWrites.at(-1)};
 });assert.equal(r.retried,true);assert.deepEqual(r.uploaded.fav_teams,['saved while waiting']);
 assert.equal(r.uploaded.prefs.theme,'auto');assert.equal(r.uploaded.prefs.settings.tz,'Asia/Tokyo');
});
test('corrupt owner JSON survives retry, clear and save without being uploaded or overwritten',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const raw='{broken owner data';localStorage.setItem(personalKey('A'),raw);onAuth({id:'A'});
  const kind=_personalStorageError.kind;await retryPersonalStorage();await clearRecentCache();saveState();await new Promise(r=>setTimeout(r,1300));
  return {kind,ready:_personalReady,same:localStorage.getItem(personalKey('A'))===raw,writes:syntheticWrites.length};
 });assert.deepEqual(r,{kind:'corrupt',ready:false,same:true,writes:0});
});
test('clear only removes confirmed regenerable formats and preserves owner, legacy and custom input',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const cache=JSON.stringify({personalPartitionVersion:1,footballSource:'provider',fb:[],bb:[],scorerText:'',chip:'Published',af:{leagues:{}}});
  const keep={'mm_state':'legacy','mm_state_UNASSIGNED':'backup',[personalKey('A')]:'owner copy',mm_public_state_v1:JSON.stringify({personalPartitionVersion:1,footballSource:'custom-csv',fb:[{home:'custom'}]})};
  for(const [k,v]of Object.entries(keep))localStorage.setItem(k,v);localStorage.setItem('mm_state_cache_v2',cache);
  const result=await clearRecentCache();return {result,removed:localStorage.getItem('mm_state_cache_v2')===null,kept:Object.entries(keep).every(([k,v])=>localStorage.getItem(k)===v)};
 });assert.deepEqual(r,{result:{removed:1,retained:1},removed:true,kept:true});
});
test('a failed cache deletion cannot claim success or schedule a reload',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  localStorage.setItem('mm_public_state_v1',JSON.stringify({personalPartitionVersion:1,footballSource:'provider',fb:[],bb:[],scorerText:'',chip:'Published',af:{}}));
  const old=Storage.prototype.removeItem;Storage.prototype.removeItem=function(){throw new DOMException('synthetic block','SecurityError');};
  const messages=[];let notified;const done=new Promise(r=>notified=r);toast=x=>{messages.push(x);notified();};window.confirm=()=>true;let reloadTimers=0;const timer=window.setTimeout;window.setTimeout=(fn,ms,...args)=>{if(ms===700)reloadTimers++;return timer(fn,ms,...args);};
  $('clearCacheBtn').click();await done;Storage.prototype.removeItem=old;window.setTimeout=timer;
  return {messages,reloadTimers,retained:localStorage.getItem('mm_public_state_v1')!==null};
 });assert.match(r.messages[0],/could not be completed/);assert.equal(r.reloadTimers,0);assert.equal(r.retained,true);
});
test('diagnostics expose byte counts and error types without personal content or identifiers',async t=>{
 const p=await open(t);const r=await p.evaluate(()=>{
  localStorage.setItem(personalKey('private-owner-id'),JSON.stringify({favT:['private favourite']}));
  return personalStorageDiagnostics();
 });assert.ok(r.bytes.personal>0);assert.doesNotMatch(JSON.stringify(r),/private-owner-id|private favourite/);
});
