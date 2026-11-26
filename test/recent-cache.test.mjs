// Disposable localhost Chromium only; all network is fulfilled locally or aborted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
async function open(t){
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM,args:['--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block'}),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 await context.route('**/*',r=>new URL(r.request().url()).origin==='http://localhost'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await context.addInitScript(()=>localStorage.setItem('mm_intro','1'));
 const p=await context.newPage();await p.goto('http://localhost/matchmind/');
 await p.evaluate(async()=>{
  await recentCacheReadSlot('guest');
  window.cacheFixture=(label,custom=false)=>({footballSource:custom?'custom-csv':'presentation',personalPartitionVersion:1,
   fb:custom?[{date:'2026-01-01',home:label,away:'Away',gh:1,ga:0}]:[],bb:[],scorerText:'',chip:label,af:{}});
 });return p;
}
test('committed generations have exact readback and retain one previous version',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const c=recentCacheContext(),a=JSON.stringify(cacheFixture('first',true)),b=JSON.stringify(cacheFixture('second',true));
  await recentCacheWrite(a,c);const receipt=await recentCacheWrite(b,c),row=await recentCacheReadSlot(receipt.slot);
  return {active:row.active.raw,previous:row.previous.raw,prepared:row.prepared,verified:(await recentCacheVerify(row.active,receipt.slot)).chip,receipt:receipt.sha,expected:await recentCacheDigest(b)};
 });assert.equal(JSON.parse(r.active).chip,'second');assert.equal(JSON.parse(r.previous).chip,'first');assert.equal(r.prepared,undefined);assert.equal(r.verified,'second');assert.equal(r.receipt,r.expected);
});
test('cache creation and expiry share one timestamp even when the clock advances between calls',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const original=Date.now;let now=original();Date.now=()=>now+=5;
  try{const receipt=await recentCacheWrite(JSON.stringify(cacheFixture('clock boundary')),recentCacheContext()),row=await recentCacheReadSlot(receipt.slot);
   return {lifetime:row.active.expires-row.active.at,chip:(await recentCacheVerify(row.active,receipt.slot)).chip};
  }finally{Date.now=original;}
 });assert.deepEqual(r,{lifetime:86400000,chip:'clock boundary'});
});

test('migration verifies a large legacy cache without duplicating localStorage or deleting old-tab data',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const state=cacheFixture('legacy');state.af.scores={padding:'x'.repeat(1800000)};const raw=JSON.stringify(state);
  localStorage.setItem('mm_public_state_v1',raw);localStorage.setItem('mm_state','original ownerless data');
  const old=Storage.prototype.setItem;let bulkWrites=0;Storage.prototype.setItem=function(k,v){if(String(v).length>1024){bulkWrites++;throw new DOMException('synthetic local quota','QuotaExceededError');}return old.call(this,k,v);};
  await migrateRecentCache();const row=await recentCacheReadSlot('guest'),id=row.active.id;await migrateRecentCache();
  const result={retained:localStorage.getItem('mm_public_state_v1')===raw,original:localStorage.getItem('mm_state'),same:row.active.raw===raw,bulkWrites,stable:(await recentCacheReadSlot('guest')).active.id===id};Storage.prototype.setItem=old;return result;
 });assert.deepEqual(r,{retained:true,original:'original ownerless data',same:true,bulkWrites:0,stable:true});
});
test('a failed promotion leaves the old active generation intact',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const c=recentCacheContext();await recentCacheWrite(JSON.stringify(cacheFixture('old')),c);const old=IDBObjectStore.prototype.put;let puts=0;
  IDBObjectStore.prototype.put=function(...args){if(this.name==='slots'&&++puts===2)throw new DOMException('synthetic commit quota','QuotaExceededError');return old.apply(this,args);};
  let error;try{await recentCacheWrite(JSON.stringify(cacheFixture('new')),c);}catch(e){error=e.name;}IDBObjectStore.prototype.put=old;
  const row=await recentCacheReadSlot('guest');return {error,active:JSON.parse(row.active.raw).chip,prepared:JSON.parse(row.prepared.raw).chip};
 });assert.deepEqual(r,{error:'QuotaExceededError',active:'old',prepared:'new'});
});
test('migration failure cannot remove its original localStorage bytes',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const raw=JSON.stringify(cacheFixture('legacy')),old=IDBObjectStore.prototype.put;localStorage.setItem('mm_public_state_v1',raw);
  IDBObjectStore.prototype.put=function(){throw new DOMException('synthetic quota','QuotaExceededError');};
  await migrateRecentCache();IDBObjectStore.prototype.put=old;return {same:localStorage.getItem('mm_public_state_v1')===raw,ready:_personalReady,error:_cacheStorageError.kind};
 });assert.deepEqual(r,{same:true,ready:true,error:'quota'});
});
test('custom imports, basketball, scorers, personal fields and credentials are not auto-migrated',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const forms=[cacheFixture('CSV',true),{...cacheFixture('basketball'),bb:[{home:'custom basketball'}]},
   {...cacheFixture('scorers'),scorerText:'custom scorer input'},{...cacheFixture('personal'),prefs:{tz:'private'}},
   {...cacheFixture('credential'),afKey:'synthetic-secret-marker'}];let retained=0;
  for(const s of forms){const raw=JSON.stringify(s);localStorage.setItem('mm_public_state_v1',raw);await migrateRecentCache();if(localStorage.getItem('mm_public_state_v1')===raw)retained++;}
  return {retained,row:await recentCacheReadSlot('guest')};
 });assert.equal(r.retained,5);assert.equal(r.row,null);
});
test('corrupt active data restores the verified previous generation',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const c=recentCacheContext();await recentCacheWrite(JSON.stringify(cacheFixture('verified old',true)),c);await recentCacheWrite(JSON.stringify(cacheFixture('new',true)),c);
  await recentCacheTransaction('readwrite',(store,done)=>{const q=store.get('guest');q.onsuccess=()=>{q.result.active.raw+='bad';store.put(q.result);done(true);};});
  const restored=await restoreRecentCache();return {restored,home:footballEngine.matches[0].home};
 });assert.deepEqual(r,{restored:true,home:'verified old'});
});
test('expired regenerable data is rejected without deleting the previous generation',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const c=recentCacheContext();await recentCacheWrite(JSON.stringify(cacheFixture('old',true)),c);await recentCacheWrite(JSON.stringify(cacheFixture('expired')),c);
  await recentCacheTransaction('readwrite',(store,done)=>{const q=store.get('guest');q.onsuccess=()=>{q.result.active.at=Date.now()-5000;q.result.active.expires=Date.now()-1000;store.put(q.result);done(true);};});
  const restored=await restoreRecentCache();return {restored,home:footballEngine.matches[0].home,previous:!!(await recentCacheReadSlot('guest')).previous};
 });assert.deepEqual(r,{restored:true,home:'old',previous:true});
});
test('oversized writes and slot-cap pressure retain all existing data',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const c=recentCacheContext(),raw=JSON.stringify(cacheFixture('retained',true));await recentCacheWrite(raw,c);
  let largeError,slotError;try{const x=cacheFixture('large');x.chip='x'.repeat(RECENT_CACHE_MAX_BYTES);await recentCacheWrite(JSON.stringify(x),c);}catch(e){largeError=e.name;}
  for(let i=0;i<3;i++)await recentCacheWrite(raw,{...c,owner:'synthetic-'+i},()=>true);
  try{await recentCacheWrite(raw,{...c,owner:'fifth-owner'},()=>true);}catch(e){slotError=e.name;}
  const count=await recentCacheTransaction('readonly',(store,done)=>{const q=store.count();q.onsuccess=()=>done(q.result);});
  return {largeError,slotError,count,same:(await recentCacheReadSlot('guest')).active.raw===raw};
 });assert.deepEqual(r,{largeError:'QuotaExceededError',slotError:'QuotaExceededError',count:4,same:true});
});
test('a concurrent tab cannot publish a candidate replaced before readback',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const c=recentCacheContext(),read=recentCacheReadSlot;let release,calls=0;
  recentCacheReadSlot=async slot=>{if(++calls===2)await new Promise(r=>release=r);return read(slot);};
  const first=recentCacheWrite(JSON.stringify(cacheFixture('superseded')),c).then(()=>null,e=>e.name);
  for(let n=0;!release&&n<200;n++)await new Promise(r=>setTimeout(r,5));if(!release)throw Error('Readback was not reached');
  await recentCacheWrite(JSON.stringify(cacheFixture('winning tab')),c);release();const firstError=await first;recentCacheReadSlot=read;
  const row=await read('guest');return {firstError,active:(await recentCacheVerify(row.active,'guest')).chip};
 });assert.deepEqual(r,{firstError:'AbortError',active:'winning tab'});
});
for(const change of ['account','newer source','manual source'])test('a late restore cannot override '+change,async t=>{
 const p=await open(t);const r=await p.evaluate(async change=>{
  const c=recentCacheContext();await recentCacheWrite(JSON.stringify(cacheFixture('old corpus',true)),c);const read=recentCacheReadSlot;let release;
  recentCacheReadSlot=async slot=>{await new Promise(r=>release=r);return read(slot);};
  const pending=restoreRecentCache();if(change==='account'){authUser={id:'different-owner'};++_cloudAccountEpoch;}else if(change==='newer source')_leaguesLoadedAt++;else{_fixtureInputSource='custom-csv';_dataSourceExplicit=true;}
  footballEngine.matches=[{home:'new visible corpus'}];release();const restored=await pending;recentCacheReadSlot=read;return {restored,home:footballEngine.matches[0].home};
 },change);assert.deepEqual(r,{restored:false,home:'new visible corpus'});
});
test('provider cache cannot restore after authorization is lost',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const actual=fixtureRawCurrent;fixtureRawCurrent=()=>true;const state=cacheFixture('provider',true);state.footballSource='provider';
  await recentCacheWrite(JSON.stringify(state),recentCacheContext());fixtureRawCurrent=()=>false;
  footballEngine.matches=[{home:'public corpus'}];const restored=await restoreRecentCache();fixtureRawCurrent=actual;
  return {restored,home:footballEngine.matches[0].home};
 });assert.deepEqual(r,{restored:false,home:'public corpus'});
});
test('cache clear preserves any generation containing custom input and all personal/legacy keys',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const c=recentCacheContext();await recentCacheWrite(JSON.stringify(cacheFixture('custom',true)),c);await recentCacheWrite(JSON.stringify(cacheFixture('regenerable')),c);
  localStorage.setItem('mm_state','legacy bytes');localStorage.setItem(personalKey(null),'personal bytes');const result=await clearRecentCache();
  return {result,previous:JSON.parse((await recentCacheReadSlot('guest')).previous.raw).chip,legacy:localStorage.getItem('mm_state'),personal:localStorage.getItem(personalKey(null))};
 });assert.equal(r.result.retained,1);assert.equal(r.result.removed,0);assert.equal(r.previous,'custom');assert.equal(r.legacy,'legacy bytes');assert.equal(r.personal,'personal bytes');
});
test('explicit sample reset cannot restore a previous custom IDB import on reload',async t=>{
 const p=await open(t);await p.evaluate(async()=>{await recentCacheWrite(JSON.stringify(cacheFixture('custom before reset',true)),recentCacheContext());$('resetBtn').click();await _recentCacheFlight;});
 await p.reload();const r=await p.evaluate(async()=>{await recentCacheReadSlot('guest');return {row:await recentCacheReadSlot('guest'),custom:footballEngine.matches.some(x=>x.home==='custom before reset')};});assert.equal(r.row,null);assert.equal(r.custom,false);
});
test('production and preview paths use distinct IndexedDB names',async t=>{
 const p=await open(t),a=await p.evaluate(()=>RECENT_CACHE_DB);await p.goto('http://localhost/matchmind-preview/');const b=await p.evaluate(()=>RECENT_CACHE_DB);assert.notEqual(a,b);
});
test('denied IndexedDB never pauses a successful personal save or cloud synchronization',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};const writes=[];supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async x=>(writes.push(x),{error:null})})};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));await _recentCacheFlight;const old=IDBFactory.prototype.open;
  IDBFactory.prototype.open=function(){throw new DOMException('synthetic denial','SecurityError');};afState.favT=['personal survives'];saveState();await _recentCacheFlight;await new Promise(r=>setTimeout(r,1300));
  const result={ready:_personalReady,fav:JSON.parse(localStorage.getItem(personalKey('A'))).favT,uploaded:writes.at(-1).fav_teams,error:_cacheStorageError.kind};IDBFactory.prototype.open=old;return result;
 });assert.deepEqual(r,{ready:true,fav:['personal survives'],uploaded:['personal survives'],error:'unavailable'});
});
for(const kind of ['blocked','version'])test(kind+' IndexedDB opening fails without changing personal readiness',async t=>{
 const p=await open(t);const r=await p.evaluate(async kind=>{
  const old=IDBFactory.prototype.open;IDBFactory.prototype.open=function(){const request={error:new DOMException('synthetic version','VersionError')};setTimeout(()=>kind==='blocked'?request.onblocked():request.onerror(),0);return request;};
  let error;try{await recentCacheOpen();}catch(e){error=e.name;}IDBFactory.prototype.open=old;return {error,ready:_personalReady};
 },kind);assert.equal(r.error,kind==='blocked'?'InvalidStateError':'VersionError');assert.equal(r.ready,true);
});
test('personal and credential fields cannot enter the new cache writer',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  let refused=0;for(const extra of [{prefs:{tz:'personal'}},{afKey:'synthetic credential'},{af:{record:['personal history']}}])try{await recentCacheWrite(JSON.stringify({...cacheFixture('invalid'),...extra}),recentCacheContext());}catch{refused++;}
  return {refused,row:await recentCacheReadSlot('guest')};
 });assert.deepEqual(r,{refused:3,row:null});
});
test('a corrupt generation is retained rather than overwritten by the next optional cache save',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const c=recentCacheContext();await recentCacheWrite(JSON.stringify(cacheFixture('corrupt original',true)),c);
  await recentCacheTransaction('readwrite',(store,done)=>{const q=store.get('guest');q.onsuccess=()=>{q.result.active.raw+='damaged';store.put(q.result);done(true);};});
  const before=(await recentCacheReadSlot('guest')).active.raw;let rejected=false;try{await recentCacheWrite(JSON.stringify(cacheFixture('replacement')),c);}catch{rejected=true;}
  const cleared=await clearRecentCache();return {rejected,same:(await recentCacheReadSlot('guest')).active.raw===before,retained:cleared.retained};
 });assert.deepEqual(r,{rejected:true,same:true,retained:1});
});
test('the total byte bound refuses growth without evicting another owner or custom generation',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const c=recentCacheContext(),state=cacheFixture('large custom',true);state.fb[0].padding='x'.repeat(6*1024*1024);const raw=JSON.stringify(state);
  for(const owner of ['A','B'])for(let i=0;i<2;i++)await recentCacheWrite(raw,{...c,owner},()=>true);
  await recentCacheWrite(raw,{...c,owner:'C'},()=>true);const before=await recentCacheReadSlot(recentCacheSlot('C'));let error;
  try{await recentCacheWrite(raw,{...c,owner:'C'},()=>true);}catch(e){error=e.name;}
  const after=await recentCacheReadSlot(recentCacheSlot('C'));return {error,same:after.active.id===before.active.id,previous:after.previous};
 });assert.deepEqual(r,{error:'QuotaExceededError',same:true,previous:null});
});
test('legacy migration cannot replace a generation committed by another tab',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const c=recentCacheContext();await recentCacheWrite(JSON.stringify(cacheFixture('new committed data')),c);let error;
  try{await recentCacheWrite(JSON.stringify(cacheFixture('old legacy data')),c,()=>true,{onlyIfEmpty:true});}catch(e){error=e.name;}
  return {error,active:JSON.parse((await recentCacheReadSlot('guest')).active.raw).chip};
 });assert.deepEqual(r,{error:'AbortError',active:'new committed data'});
});
test('new custom basketball and scorer input survives an IDB-only reload',async t=>{
 const p=await open(t);await p.evaluate(async()=>{
  basketballEngine.matches=[{date:'2026-01-01',home:'Owned basketball',away:'Other',hp:99,ap:90}];
  const rows=SAMPLE_SCORERS.split('\n');rows[1]=rows[1].replace(/^[^,]+/,'Synthetic Player');$('scorerData').value=rows.join('\n');
  saveState();await _recentCacheFlight;
  if(localStorage.getItem('mm_public_state_v1')!==null||localStorage.getItem('mm_state_cache_v2')!==null)throw Error('Bulk localStorage write returned');
 });await p.reload();await p.waitForFunction(()=>basketballEngine.matches[0]?.home==='Owned basketball');
 const r=await p.evaluate(()=>({home:basketballEngine.matches[0].home,scorers:$('scorerData').value.includes('Synthetic Player')}));
 assert.deepEqual(r,{home:'Owned basketball',scorers:true});
});
test('owned custom input can restore without reactivating cached provider football',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const actual=fixtureRawCurrent;fixtureRawCurrent=()=>true;const state=cacheFixture('private provider football',true);state.footballSource='provider';state.bb=[{date:'2026-01-01',home:'Owned basketball',away:'Other',hp:99,ap:90}];
  await recentCacheWrite(JSON.stringify(state),recentCacheContext());fixtureRawCurrent=()=>false;footballEngine.matches=[{home:'public corpus'}];
  const restored=await restoreRecentCache();fixtureRawCurrent=actual;return {restored,football:footballEngine.matches[0].home,basketball:basketballEngine.matches[0].home,source:_fixtureInputSource};
 });assert.deepEqual(r,{restored:true,football:'public corpus',basketball:'Owned basketball',source:'sample'});
});
test('scorer saving waits for the cache commit before claiming success',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const alerts=[];window.alert=x=>alerts.push(x);const write=recentCacheWrite;let release;
  recentCacheWrite=async(...args)=>{await new Promise(r=>release=r);return write(...args);};
  $('scorerData').value=SAMPLE_SCORERS+'\n';$('saveScorersBtn').click();
  for(let i=0;!release&&i<200;i++)await new Promise(r=>setTimeout(r,5));if(!release)throw Error('Cache save was not reached');
  const before=[...alerts];release();await _recentCacheFlight;await Promise.resolve();recentCacheWrite=write;return {before,after:alerts};
 });assert.deepEqual(r.before,[]);assert.match(r.after[0],/Saved.*on this device/);
});
test('a failed scorer cache write cannot claim the input was saved',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const alerts=[];window.alert=x=>alerts.push(x);const old=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(){throw new DOMException('synthetic quota','QuotaExceededError');};
  $('scorerData').value=SAMPLE_SCORERS+'\n';$('saveScorersBtn').click();await _recentCacheFlight;await Promise.resolve();IDBObjectStore.prototype.put=old;
  return alerts;
 });assert.match(r[0],/could not be saved/i);assert.doesNotMatch(r[0],/^Saved/);
});
