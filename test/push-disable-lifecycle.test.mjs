// Actual push controls with inert SDK/browser doubles. No network or real subscription.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const span=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return source.slice(i,j);};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function harness(){
 const classes=()=>{const values=new Set();return{add:x=>values.add(x),remove:x=>values.delete(x),contains:x=>values.has(x),toggle:(x,on)=>on===undefined?(values.has(x)?values.delete(x):values.add(x)):on?values.add(x):values.delete(x)};};
 const nodes=new Map(),buttons=['kickoff','result','digest'].map(k=>({dataset:{nt:k},classList:classes(),listeners:{},addEventListener(e,f){this.listeners[e]=f;}}));
 const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',classList:classes(),listeners:{},addEventListener(e,f){this.listeners[e]=f;}});return nodes.get(id);};
 const writes=[],toasts=[],saves=[];let unsubscribes=0,enables=0;
 const options={deleteReply:async()=>({error:null,count:1}),unsubscribe:async()=>true};
 const sub={endpoint:'https://synthetic.invalid/endpoint-A',unsubscribe:async()=>{unsubscribes++;return options.unsubscribe();}};
 options.subscription=async()=>sub;
 const reg={pushManager:{getSubscription:()=>options.subscription()}};
 const client={from:table=>({delete:()=>{const filters=[];return{eq(k,v){filters.push([k,v]);return this;},then(ok,bad){writes.push({table,filters});return Promise.resolve().then(()=>options.deleteReply()).then(ok,bad);}};}})};
 const ctx=vm.createContext({$,document:{querySelectorAll:()=>buttons},supa:client,authUser:{id:'A'},_personalOwner:'A',_cloudAccountEpoch:1,
  personalToken:(owner,epoch)=>ctx.authUser?.id===owner&&ctx._personalOwner===owner&&ctx._cloudAccountEpoch===epoch,
  APP_NAME:'MatchMind',navigator:{serviceWorker:{ready:Promise.resolve(reg)}},Notification:{permission:'granted'},notif:{kickoff:true,result:false,digest:false},
  savePrefs:()=>saves.push(structuredClone(ctx.notif)),toast:s=>toasts.push(s),saveSubscription:async()=>true,enablePush:()=>{enables++;}});
 const start=source.includes('var _pushDisableProgress = null;')?'// Memory-only retry evidence;':'async function disablePush(){';
 vm.runInContext(span(start,'/* A subscription can be revoked'),ctx);
 vm.runInContext(span('function renderNotif(){','function renderLangSetting(){'),ctx);
 vm.runInContext(span("$('notifMainBtn').addEventListener('click', ()=>{","/* The service worker asks the app"),ctx);
 return{ctx,options,reg,sub,writes,toasts,saves,$,buttons,disable:()=>ctx.disablePush(),clickType:k=>buttons.find(b=>b.dataset.nt===k).listeners.click(),clickMain:()=>$('notifMainBtn').listeners.click(),
  snapshot:()=>({notif:structuredClone(ctx.notif),note:$('notifNote').textContent,state:$('notifState').textContent,toasts:[...toasts],saves:saves.length}),counts:()=>({unsubscribes,enables}),switchTo:id=>{ctx.authUser={id};ctx._personalOwner=id;ctx._cloudAccountEpoch++;ctx.notif={kickoff:false,result:true,digest:false};$('notifNote').textContent='New owner notice';$('notifState').textContent='New owner state';}};
}
for(const kind of ['error','throw','missing','malformed'])test('SDK removal '+kind+' preserves endpoint/preferences and reports incomplete',async()=>{
 const h=harness();h.options.deleteReply=async()=>{if(kind==='throw')throw Error('RAW SDK secret');if(kind==='missing')return undefined;if(kind==='malformed')return{};return{error:{message:'RAW SDK secret'}};};
 await h.disable();assert.equal(h.counts().unsubscribes,0);assert.equal(h.ctx.notif.kickoff,true);assert.equal(h.saves.length,0);assert.equal(h.toasts.length,0);assert.match(h.$('notifState').textContent,/could not finish turning off/i);assert.equal(h.$('notifTypes').classList.contains('hidden'),false);assert.doesNotMatch(h.$('notifNote').textContent,/RAW|secret/);
});
for(const stage of ['ready','lookup'])test(stage+' rejection cannot claim off',async()=>{
 const h=harness();if(stage==='ready')h.ctx.navigator.serviceWorker.ready=Promise.reject(Error('RAW ready'));else h.options.subscription=async()=>{throw Error('RAW lookup');};
 await h.disable();assert.equal(h.ctx.notif.kickoff,true);assert.equal(h.writes.length,0);assert.equal(h.counts().unsubscribes,0);assert.equal(h.toasts.length,0);assert.match(h.$('notifState').textContent,/could not finish turning off/i);assert.doesNotMatch(h.$('notifNote').textContent,/RAW/);
});
for(const outcome of ['false','throw'])test('browser unsubscribe '+outcome+' retains retry after server acknowledgement',async()=>{
 const h=harness();h.options.unsubscribe=async()=>{if(outcome==='throw')throw Error('RAW browser');return false;};
 await h.disable();assert.equal(h.ctx.notif.kickoff,true);assert.equal(h.saves.length,0);assert.equal(h.toasts.length,0);assert.match(h.$('notifNote').textContent,/requested/i);assert.match(h.$('notifState').textContent,/could not finish turning off/i);assert.doesNotMatch(h.$('notifNote').textContent,/RAW/);
 h.options.subscription=async()=>null;assert.equal(await h.disable(),true);assert.equal(h.ctx.notif.kickoff,false);assert.equal(h.writes.length,1);assert.equal(h.saves.length,1);assert.match(h.toasts[0],/requested/i);
});
test('zero-row acknowledgement is not described as confirmed server erasure',async()=>{
 const h=harness();h.options.deleteReply=async()=>({error:null,count:0});assert.equal(await h.disable(),true);assert.deepEqual(h.writes[0].filters,[['endpoint',h.sub.endpoint],['user_id','A']]);assert.equal(h.ctx.notif.kickoff,false);assert.match(h.toasts[0],/requested/i);assert.doesNotMatch(h.toasts[0],/server.*(?:erased|deleted|absent|confirmed)/i);
});
test('absence without matching removal acknowledgement retains settings and an honest retry notice',async()=>{
 const h=harness();h.options.subscription=async()=>null;await h.disable();assert.equal(h.ctx.notif.kickoff,true);assert.equal(h.writes.length,0);assert.equal(h.saves.length,0);assert.equal(h.toasts.length,0);assert.match(h.$('notifNote').textContent,/unconfirmed/i);
});
test('last notification type failure does not discard its pending toggle',async()=>{
 const h=harness();h.options.deleteReply=async()=>({error:{message:'RAW'}});await h.clickType('kickoff');assert.equal(h.ctx.notif.kickoff,true);assert.equal(h.saves.length,0);assert.equal(h.counts().unsubscribes,0);
});
test('last notification type success commits preferences only after acknowledged removal and unsubscribe',async()=>{
 const h=harness(),pending=deferred();h.options.deleteReply=()=>pending.promise;const work=h.clickType('kickoff');await flush();assert.equal(h.ctx.notif.kickoff,true);assert.equal(h.saves.length,0);pending.resolve({error:null});await work;assert.equal(h.ctx.notif.kickoff,false);assert.equal(h.saves.length,1);
});
for(const stage of ['ready','lookup','delete','unsubscribe'])for(const change of ['owner','epoch','client'])test(change+' switch during '+stage+' cannot update current UI/preferences',async()=>{
 const h=harness(),pending=deferred();if(stage==='ready')h.ctx.navigator.serviceWorker.ready=pending.promise;if(stage==='lookup')h.options.subscription=()=>pending.promise;if(stage==='delete')h.options.deleteReply=()=>pending.promise;if(stage==='unsubscribe')h.options.unsubscribe=()=>pending.promise;
 const work=h.disable();await flush();if(change==='owner')h.switchTo('B');if(change==='epoch'){h.ctx._cloudAccountEpoch++;h.$('notifNote').textContent='New epoch';}if(change==='client'){h.ctx.supa={};h.$('notifNote').textContent='New client';}const before=h.snapshot();
 pending.resolve(stage==='ready'?h.reg:stage==='lookup'?h.sub:stage==='delete'?{error:null}:true);await work;assert.deepEqual(h.snapshot(),before);if(stage==='ready'||stage==='lookup')assert.equal(h.writes.length,0);if(stage==='delete')assert.equal(h.counts().unsubscribes,0);
});
test('acknowledgement cannot transfer to a new owner or same-owner epoch',async()=>{
 for(const change of ['owner','epoch']){const h=harness();h.options.unsubscribe=async()=>false;await h.disable();if(change==='owner')h.switchTo('B');else h.ctx._cloudAccountEpoch++;h.options.subscription=async()=>null;await h.disable();assert.ok(h.ctx.notif.kickoff||h.ctx.notif.result);assert.equal(h.saves.length,0);assert.equal(h.toasts.length,0);}
});
test('newer disable operation owns UI and acknowledgement even when older response arrives last',async()=>{
 const h=harness(),old=deferred();let call=0;h.options.deleteReply=()=>++call===1?old.promise:Promise.resolve({error:{message:'new failure'}});const first=h.disable();await flush();await h.disable();const before=h.snapshot();old.resolve({error:null});await first;assert.deepEqual(h.snapshot(),before);assert.equal(h.counts().unsubscribes,0);
});
test('retry does not reuse a prior endpoint acknowledgement for a different endpoint',async()=>{
 const h=harness();h.options.unsubscribe=async()=>false;await h.disable();h.options.subscription=async()=>({...h.sub,endpoint:'https://synthetic.invalid/new-endpoint'});h.options.deleteReply=async()=>({error:{message:'new failure'}});await h.disable();assert.equal(h.ctx.notif.kickoff,true);assert.equal(h.toasts.length,0);assert.equal(h.counts().unsubscribes,1);
});
test('retry control still retries removal when permission changed after a failed attempt',async()=>{
 const h=harness();h.options.deleteReply=async()=>({error:{message:'fail'}});await h.disable();h.ctx.Notification.permission='denied';h.options.deleteReply=async()=>({error:null});h.options.unsubscribe=async()=>true;await h.clickMain();await flush();assert.equal(h.counts().enables,0);assert.equal(h.ctx.notif.kickoff,false);
});


test('new registration refresh cannot consume a previous pending acknowledgement',async()=>{
 const h=harness();h.options.unsubscribe=async()=>false;await h.disable();let upserts=0;
 h.ctx.supa.from=()=>({upsert:async()=>{upserts++;return{error:null};}});h.ctx.prefs={tz:'UTC'};h.sub.toJSON=()=>({endpoint:h.sub.endpoint,keys:{p256dh:'synthetic',auth:'synthetic'}});
 vm.runInContext(span('async function saveSubscription(','async function enablePush(){'),h.ctx);assert.equal(await h.ctx.saveSubscription(h.sub,'A',1,h.ctx.supa),true);assert.equal(upserts,1);
 h.options.subscription=async()=>null;assert.equal(await h.disable(),false);assert.equal(h.ctx.notif.kickoff,true);assert.equal(h.toasts.length,0);
});
test('new enable intent invalidates previous pending acknowledgement',async()=>{
 const h=harness();h.options.unsubscribe=async()=>false;await h.disable();h.ctx.pushSupport=()=>({ok:true});h.ctx.Notification.requestPermission=async()=> 'denied';
 vm.runInContext(span('async function enablePush(){','// Memory-only retry evidence;'),h.ctx);await h.ctx.enablePush();h.options.subscription=async()=>null;
 assert.equal(await h.disable(),false);assert.equal(h.ctx.notif.kickoff,true);assert.equal(h.toasts.length,0);
});
test('a later type change invalidates the previous disable acknowledgement',async()=>{
 const h=harness();h.options.unsubscribe=async()=>false;await h.disable();await h.clickType('result');assert.equal(h.ctx.notif.result,true);h.options.subscription=async()=>null;
 assert.equal(await h.disable(),false);assert.equal(h.ctx.notif.kickoff,true);assert.equal(h.toasts.length,0);
});


test('remembered endpoint can retry failed server removal after browser disappears',async()=>{
 const h=harness();h.options.deleteReply=async()=>({error:{message:'first failure'}});await h.disable();
 h.options.subscription=async()=>null;h.options.deleteReply=async()=>({error:null});
 assert.equal(await h.disable(),true);assert.equal(h.writes.length,2);assert.deepEqual(h.writes[1].filters,[['endpoint',h.sub.endpoint],['user_id','A']]);assert.equal(h.ctx.notif.kickoff,false);
});
test('remembered endpoint failed retry keeps preferences and visible retry',async()=>{
 const h=harness();h.options.deleteReply=async()=>({error:{message:'failure'}});await h.disable();h.options.subscription=async()=>null;
 assert.equal(await h.disable(),false);assert.equal(h.writes.length,2);assert.equal(h.ctx.notif.kickoff,true);assert.equal(h.toasts.length,0);
});
test('remembered endpoint retry rechecks browser absence after server await',async()=>{
 const h=harness();h.options.deleteReply=async()=>({error:{message:'first failure'}});await h.disable();h.options.subscription=async()=>null;
 const pending=deferred();h.options.deleteReply=()=>pending.promise;const work=h.disable();await flush();assert.equal(h.writes.length,2);
 h.options.subscription=async()=>({...h.sub,endpoint:'https://synthetic.invalid/replacement'});pending.resolve({error:null});
 assert.equal(await work,false);assert.equal(h.ctx.notif.kickoff,true);assert.equal(h.toasts.length,0);assert.equal(h.counts().unsubscribes,0);
});
test('remembered endpoint retry cannot complete after owner switch',async()=>{
 const h=harness();h.options.deleteReply=async()=>({error:{message:'first failure'}});await h.disable();h.options.subscription=async()=>null;
 const pending=deferred();h.options.deleteReply=()=>pending.promise;const work=h.disable();await flush();assert.equal(h.writes.length,2);
 h.switchTo('B');const before=h.snapshot();pending.resolve({error:null});await work;assert.deepEqual(h.snapshot(),before);
});
