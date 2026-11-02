// Synthetic browser; all network and service workers are blocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), chromium=require('playwright-core').chromium;
const executablePath=process.env.MM_TEST_CHROMIUM;
async function open(t, seed){
 assert.ok(executablePath&&existsSync(executablePath));
 const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const ctx=await browser.newContext({serviceWorkers:'block'});
 if(seed) await ctx.addInitScript(value=>localStorage.setItem('mm_state',value),seed);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 await ctx.route('**/*',r=>r.request().url()==='http://ownership.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const p=await ctx.newPage();await p.goto('http://ownership.test/');return p;
}
test('completed A data is detached on direct B switch and restored for A',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};let writes=[];
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async x=>(writes.push(x),{error:null})})};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));afState.favT=['A marker'];afState.record=[{fxid:1,pick:'A marker'}];saveState();
  onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));const b=JSON.stringify({fav:afState.favT,record:afState.record});
  await new Promise(r=>setTimeout(r,1300));onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));
  return {b,writes,returned:afState.favT};
 });assert.doesNotMatch(r.b,/A marker/);assert.ok(r.writes.every(x=>x.user_id!=='B'||!JSON.stringify(x).includes('A marker')));assert.deepEqual(r.returned,['A marker']);
});
test('legacy ownerless state is quarantined and not imported by next login',async t=>{
 const legacy=JSON.stringify({fb:[{x:1}],af:{favT:['legacy marker'],record:[{fxid:7,pick:'legacy marker'}]}});
 const p=await open(t,legacy);const r=await p.evaluate(async()=>{cloudEnabled=()=>true;aiShadowGate=async()=>{};supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>({error:null})})};onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));return {state:JSON.stringify({fav:afState.favT,record:afState.record}),storage:{...localStorage}};});
 assert.doesNotMatch(r.state,/legacy marker/);assert.ok(Object.values(r.storage).includes(legacy));
});
test('populated B merges only B data, and logout and reload preserve A separately',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};let writes=[];
  supa={auth:{signOut:async()=>({error:null})},from:()=>({select:()=>({eq:(_k,id)=>({maybeSingle:async()=>({error:null,data:id==='B'?{user_id:'B',fav_teams:['B cloud'],record:[{fxid:2,pick:'B cloud'}]}:null})})}),upsert:async x=>(writes.push(x),{error:null})})};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));afState.favT=['A private'];saveState();await authLogout();
  const guest=JSON.stringify(afState.favT);onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));const b=JSON.stringify({fav:afState.favT,record:afState.record});
  await new Promise(r=>setTimeout(r,1250));return {guest,b,writes};
 });assert.doesNotMatch(r.guest,/A private/);assert.match(r.b,/B cloud/);assert.doesNotMatch(r.b,/A private/);assert.ok(r.writes.every(x=>x.user_id!=='B'||!JSON.stringify(x).includes('A private')));
 await p.reload();const restored=await p.evaluate(async()=>{cloudEnabled=()=>true;aiShadowGate=async()=>{};supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({error:null,data:null})})})})};const guest=JSON.stringify(afState.favT);onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));return {guest,a:afState.favT};});assert.doesNotMatch(restored.guest,/A private/);assert.deepEqual(restored.a,['A private']);
});
test('guest and failed legacy preservation never enter an account or upload',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  afState.favT=['guest private'];saveState();const legacy=JSON.stringify({af:{favT:['old private']}});localStorage.setItem('mm_state',legacy);
  const proto=Storage.prototype, old=proto.setItem;proto.setItem=function(k,v){if(k==='mm_state_UNASSIGNED')throw Error('synthetic quota');return old.call(this,k,v);};
  let writes=0;cloudEnabled=()=>true;aiShadowGate=async()=>{};supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>{writes++;return{error:null};}})};
  onAuth({id:'B'});saveState();cloudPush();await new Promise(r=>setTimeout(r,1300));const result={legacy:localStorage.getItem('mm_state'),shown:JSON.stringify(afState.favT),writes,badge:$('acctSynced').textContent};proto.setItem=old;return result;
 });assert.equal(r.legacy,JSON.stringify({af:{favT:['old private']}}));assert.doesNotMatch(r.shown,/guest private|old private/);assert.equal(r.writes,0);assert.notEqual(r.badge,'synced');
});
test('failed cloud read cannot acknowledge or overwrite the owner partition',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};let writes=0;supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({error:{message:'synthetic read failure'},data:null})})}),upsert:async()=>{writes++;return{error:null};}})};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));afState.favT=['retained'];saveState();clearTimeout(_cloudPushT);const before=localStorage.getItem(personalKey('A'));await cloudPullMerge();return {before,after:localStorage.getItem(personalKey('A')),badge:$('acctSynced').textContent,writes};
 });assert.equal(r.before,r.after);assert.match(r.badge,/failed/);assert.equal(r.writes,0);
});
test('pending logout detaches immediately and late failure cannot replace B',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};let finish;supa={auth:{signOut:()=>new Promise(r=>finish=r)},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>({error:null})})};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));afState.favT=['A hidden'];saveState();const logout=authLogout();const detached=JSON.stringify(afState.favT);onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));afState.favT=['B only'];finish({error:{message:'synthetic'}});await logout;return {detached,user:authUser.id,b:afState.favT};
 });assert.doesNotMatch(r.detached,/A hidden/);assert.equal(r.user,'B');assert.deepEqual(r.b,['B only']);
});
test('pending and failed cloud reads prevent writes and never claim sync',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};let finish,writes=0;supa={from:()=>({select:()=>({eq:()=>({maybeSingle:()=>new Promise(r=>finish=r)})}),upsert:async()=>{writes++;return{error:null};}})};
  onAuth({id:'A'});afState.favT=['local'];saveState();cloudPush();finish({error:{message:'synthetic'},data:null});await new Promise(r=>setTimeout(r,0));cloudPush();await new Promise(r=>setTimeout(r,1250));return {writes,badge:$('acctSynced').textContent};
 });assert.equal(r.writes,0);assert.match(r.badge,/failed/);
});
test('account switch repaints visible favourites and restores owner preferences',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>({error:null})})};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));afState.favT=['Visible A'];afState.favTab='leagues';prefs.tz='Africa/Lagos';notif.digest=true;themeMode='light';aiProvider='openai';saveState();renderFavs();const before=$('favManage').textContent;
  onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));const b={hidden:$('favLeaguesWrap').classList.contains('hidden'),visible:$('favMatchesWrap').innerText,tz:prefs.tz,theme:themeMode,provider:aiProvider,digest:notif.digest};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));return {before,b,a:{text:$('favManage').textContent,tz:prefs.tz,theme:themeMode,provider:aiProvider,digest:notif.digest}};
 });assert.match(r.before,/Visible A/);assert.ok(r.b.hidden);assert.doesNotMatch(r.b.visible,/Visible A/);assert.deepEqual([r.b.tz,r.b.theme,r.b.provider,r.b.digest],['','dark','gemini',false]);assert.match(r.a.text,/Visible A/);assert.deepEqual([r.a.tz,r.a.theme,r.a.provider,r.a.digest],['Africa/Lagos','light','openai',true]);
});
test('wrong-owner and malformed cloud rows fail closed without upload',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};let response={user_id:'A',fav_teams:['wrong owner']},writes=0;
  supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:response,error:null})})}),upsert:async()=>{writes++;return{error:null};}})};
  onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));const first={fav:JSON.stringify(afState.favT),badge:$('acctSynced').textContent};response=[];await cloudPullMerge();cloudPush();await new Promise(r=>setTimeout(r,1250));return {first,second:$('acctSynced').textContent,writes};
 });assert.doesNotMatch(r.first.fav,/wrong owner/);assert.match(r.first.badge,/failed/);assert.match(r.second,/failed/);assert.equal(r.writes,0);
});
test('snapshot and persistence reject an identity changed outside the auth boundary',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>({error:null})})};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));afState.favT=['A bytes'];saveState();const before=localStorage.getItem(personalKey('A'));authUser={id:'B'};let rejected=false;try{personalSnapshot('A',_cloudAccountEpoch)}catch{rejected=true}saveState();return {rejected,same:before===localStorage.getItem(personalKey('A')),b:localStorage.getItem(personalKey('B'))};
 });assert.ok(r.rejected);assert.ok(r.same);assert.equal(r.b,null);
});
test('malformed owner partition is preserved and cannot be used for sync',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  const bad=JSON.stringify({record:'not-an-array',favT:['private']});localStorage.setItem(personalKey('A'),bad);cloudEnabled=()=>true;aiShadowGate=async()=>{};let writes=0;supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>{writes++;return{error:null};}})};
  onAuth({id:'A'});saveState();cloudPush();await new Promise(r=>setTimeout(r,1250));return{same:localStorage.getItem(personalKey('A'))===bad,badge:$('acctSynced').textContent,writes};
 });assert.ok(r.same);assert.match(r.badge,/storage unavailable/);assert.equal(r.writes,0);
});
test('new owner restores cloud preferences before uploading',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};const writes=[];supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:'B',prefs:{theme:'light',aiProvider:'claude',tz:'Africa/Lagos',notif:{digest:true}}},error:null})})}),upsert:async x=>(writes.push(x),{error:null})})};
  onAuth({id:'B'});await new Promise(r=>setTimeout(r,1300));return {theme:themeMode,provider:aiProvider,tz:prefs.tz,digest:notif.digest,writes};
 });assert.deepEqual([r.theme,r.provider,r.tz,r.digest],['light','claude','Africa/Lagos',true]);assert.equal(r.writes.at(-1).prefs.theme,'light');assert.equal(r.writes.at(-1).prefs.aiProvider,'claude');
});
test('delayed fixture operation cannot record or upload under a different owner',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};personalRefresh=()=>{};renderFixtures=()=>{};activateLeague=()=>{};predictsComp=()=>false;showNoAnalysis=()=>{};registerLeagueDampen=()=>{};afCloudOwnsFixtures=()=>false;
  const writes=[];supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async x=>(writes.push(x),{error:null})})};onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));
  let finish;afFetch=()=>new Promise(r=>finish=r);footballEngine.predict=()=>({pW:.8,pD:.1,pL:.1});const f={fxid:9992,date:todayStrLocal(),time:'22:00',home:'A-selected-home',away:'A-selected-away'};afState.leagues[999]={id:999,name:'Synthetic',matches:[],teamIds:{},upcoming:[f]};
  const pending=openFixture(999,f);onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));finish([{fixture:{date:'2026-10-01'},teams:{home:{name:'H',id:1},away:{name:'V',id:2}},goals:{home:1,away:0}}]);await pending;await new Promise(r=>setTimeout(r,1300));return {record:afState.record,writes};
 });assert.doesNotMatch(JSON.stringify(r.record),/A-selected/);assert.ok(r.writes.every(x=>x.user_id!=='B'||!JSON.stringify(x).includes('A-selected')));
});
test('v1 marker does not excuse ownerless personal fields from quarantine',async t=>{
 const legacy=JSON.stringify({personalPartitionVersion:1,fb:[{x:1}],af:{record:[{fxid:1,pick:'ambiguous'}]}});const p=await open(t,legacy);
 const r=await p.evaluate(()=>({backup:localStorage.getItem('mm_state_UNASSIGNED'),state:JSON.stringify(afState.record)}));assert.equal(r.backup,legacy);assert.doesNotMatch(r.state,/ambiguous/);
});
test('pending notification permission cannot write or change the next account',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};personalRefresh=()=>{};pushSupport=()=>({ok:true});let finish;window.Notification={permission:'default',requestPermission:()=>new Promise(r=>finish=r)};
  const sub={endpoint:'synthetic-endpoint',toJSON:()=>({endpoint:'synthetic-endpoint',keys:{}})};Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve({pushManager:{getSubscription:async()=>sub}})}});
  const writes=[];supa={from:table=>table==='app_state'?{select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>({error:null})}:{upsert:async x=>(writes.push(x),{error:null})}};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));const pending=enablePush();onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));finish('granted');await pending;return{writes,notif:{...notif},owner:authUser.id};
 });assert.equal(r.owner,'B');assert.equal(r.notif.kickoff,false);assert.equal(r.writes.length,0);
});
test('pending notification disable and refresh cannot affect a later account',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};personalRefresh=()=>{};window.Notification={permission:'granted'};window.PushManager=function(){};let finish,deleted=0,unsubscribed=0,writes=0;
  const sub={endpoint:'synthetic',toJSON:()=>({endpoint:'synthetic',keys:{}}),unsubscribe:async()=>{unsubscribed++;}};const registration={pushManager:{getSubscription:async()=>sub}};
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:new Promise(r=>finish=r)}});
  supa={from:table=>table==='app_state'?{select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>({error:null})}:{upsert:async()=>{writes++;return{error:null};},delete:()=>({eq:()=>({eq:async()=>{deleted++;return{error:null};}})})}};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));notif.kickoff=true;const disable=disablePush(),refresh=ensurePushFresh();onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));notif.digest=true;finish(registration);await Promise.all([disable,refresh]);return{deleted,unsubscribed,writes,notif:{...notif},owner:authUser.id};
 });assert.equal(r.owner,'B');assert.equal(r.deleted,0);assert.equal(r.unsubscribed,0);assert.equal(r.writes,0);assert.equal(r.notif.digest,true);
});
test('same-owner notification enable still saves the subscription',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};personalRefresh=()=>{};pushSupport=()=>({ok:true});window.Notification={permission:'granted',requestPermission:async()=>'granted'};
  const sub={endpoint:'synthetic',toJSON:()=>({endpoint:'synthetic',keys:{}})};Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve({pushManager:{getSubscription:async()=>sub}})}});const writes=[];
  supa={from:table=>table==='app_state'?{select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>({error:null})}:{upsert:async x=>(writes.push(x),{error:null})}};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));await enablePush();return{notif:{...notif},writes};
 });assert.equal(r.notif.kickoff,true);assert.equal(r.writes.length,1);assert.equal(r.writes[0].user_id,'A');
});
test('switch clears stale favourite stars and repaints account settings',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>({error:null})})};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));afState.favT=['FavouriteMarker'];prefs.tz='Africa/Lagos';setFavRow('FavouriteMarker','Other');renderTzSetting();const a=$('favRow').textContent;
  onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));return {a,b:$('favRow').textContent,active:$('favRow').querySelectorAll('.active').length,tz:$('tzSel').value};
 });assert.match(r.a,/★ FavouriteMarker/);assert.doesNotMatch(r.b,/★ FavouriteMarker/);assert.equal(r.active,0);assert.equal(r.tz,'');
});
test('pending notification type change cannot subscribe the next account',async t=>{
 const p=await open(t);const r=await p.evaluate(async()=>{
  cloudEnabled=()=>true;aiShadowGate=async()=>{};personalRefresh=()=>{};window.Notification={permission:'granted'};let finish,writes=0;const sub={endpoint:'synthetic',toJSON:()=>({endpoint:'synthetic',keys:{}})};
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:new Promise(r=>finish=r)}});supa={from:table=>table==='app_state'?{select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>({error:null})}:{upsert:async()=>{writes++;return{error:null};}}};
  onAuth({id:'A'});await new Promise(r=>setTimeout(r,0));notif.kickoff=true;document.querySelector('[data-nt="digest"]').click();onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));finish({pushManager:{getSubscription:async()=>sub}});await new Promise(r=>setTimeout(r,0));return {writes,owner:authUser.id,notif:{...notif}};
 });assert.equal(r.owner,'B');assert.equal(r.writes,0);assert.equal(r.notif.digest,false);
});
test('account notice explains that legacy personal data remains unassigned',async t=>{
 const legacy=JSON.stringify({fb:[{x:1}],af:{favT:['unassigned-private']}});const p=await open(t,legacy);
 const r=await p.evaluate(async()=>{cloudEnabled=()=>true;aiShadowGate=async()=>{};supa={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),upsert:async()=>({error:null})})};onAuth({id:'B'});await new Promise(r=>setTimeout(r,0));return{text:$('acctBox').textContent,backup:localStorage.getItem('mm_state_UNASSIGNED')};});
 assert.match(r.text,/existing local personal data retained unassigned/i);assert.match(r.text,/not imported into this account/i);assert.doesNotMatch(r.text,/unassigned-private/);assert.equal(r.backup,legacy);
});
