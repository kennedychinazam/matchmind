// Separate mode: preserve build-preview.mjs and its synthetic regression artifacts unchanged.
import {transform,STAGING_REF,STAGING_URL,STAGING_KEY} from './build-preview.mjs';
import {restore355Presentation} from './presentation-355.mjs';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Real preview anchor changed');return s.replace(a,()=>b);};
export const REAL_GUARD=`<script id="realPreviewGuard">(()=>{
 const nativeFetch=window.fetch.bind(window),stage='${STAGING_URL}',base=new URL('.',location.href);
 window.__MM_REAL_PREVIEW__=true;
 let storage;try{storage=window.localStorage;}catch{const mem={};storage={getItem:k=>mem[k]??null,setItem:(k,v)=>{mem[k]=String(v);},removeItem:k=>{delete mem[k];}};}const prefix='mm-real-preview:';
 const keys=()=>Object.keys(storage).filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length));
 window.__MM_REAL_STORAGE__=new Proxy(Object.create(null),{
 get:(_,k)=>k==='getItem'?n=>storage.getItem(prefix+n):k==='setItem'?(n,v)=>storage.setItem(prefix+n,v):k==='removeItem'?n=>storage.removeItem(prefix+n):k==='clear'?()=>keys().forEach(n=>storage.removeItem(prefix+n)):k==='key'?n=>keys()[n]??null:k==='length'?keys().length:storage.getItem(prefix+String(k)),
 ownKeys:keys,getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})});
 window.__MM_REAL_IDB__={open:(n,v)=>indexedDB.open(prefix+n,v),deleteDatabase:n=>indexedDB.deleteDatabase(prefix+n)};
 const allowed=(url,method)=>{
  let u;try{u=new URL(url,location.href);}catch{return false;}
  if(u.origin===location.origin&&u.pathname.startsWith(base.pathname))return ['GET','HEAD'].includes(method);
  return u.origin===stage&&method==='POST'&&['/rest/v1/rpc/mm_preview_display_v1','/rest/v1/rpc/mm_preview_status_v1'].includes(u.pathname)&&!u.search;
 };
 window.fetch=(input,options={})=>{
  const u=typeof input==='string'?input:input.url||String(input),m=String(options.method||input.method||'GET').toUpperCase();
  if(!allowed(u,m))return Promise.reject(new TypeError('Read-only preview request refused'));
  return nativeFetch(input,options);
 };
 const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u,...rest){if(!allowed(u,String(m).toUpperCase()))throw new TypeError('Read-only preview request refused');return open.call(this,m,u,...rest);};
 if(navigator.sendBeacon)navigator.sendBeacon=()=>false;
 window.WebSocket=function(){throw new TypeError('Realtime disabled in read-only preview');};
 document.addEventListener('DOMContentLoaded',async()=>{
  try{
   const r=await window.fetch(stage+'/rest/v1/rpc/mm_preview_status_v1',{method:'POST',headers:{apikey:'${STAGING_KEY}','Content-Type':'application/json'},body:'{}'}),s=await r.json();
   if(r.ok&&s?.mode==='real-read-only'&&Date.parse(s.expires_at)>Date.now()){
    window.__MM_REAL_STATUS__=s;const b=document.getElementById('stagingBar');if(b){b.textContent='REAL DATA · READ-ONLY PREVIEW · Build 358';b.title='Mirror published '+s.published_at+'; latest fixture source update '+(s.source_updated_at||'unknown');}
   }
  }catch{}
 });
})();</script>`;
const GUEST_INIT=`function initSupabase(){
 authUser=null;
 const deny=()=>Promise.resolve({data:null,error:{message:'Unavailable in read-only preview'}});
 const chain=()=>{const q={then:(ok,bad)=>deny().then(ok,bad)};for(const n of ['select','eq','in','gte','lte','order','range','limit','insert','upsert','update','delete'])q[n]=()=>q;return q;};
 supa={from:chain,auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args={})=>{
  if(name==='matchmind_fixture_access_v1')return{data:{version:'matchmind-fixture-access/1',raw_allowed:false,expires_at:null},error:null};
  if(name!=='matchmind_display_v1')return deny();
  try{const r=await fetch(SUPA_URL+'/rest/v1/rpc/mm_preview_display_v1',{method:'POST',headers:{apikey:SUPA_KEY,'Content-Type':'application/json'},body:JSON.stringify(args)});return r.ok?{data:await r.json(),error:null}:deny();}catch{return deny();}
 }};
 renderAccount();
}`;
export function realTransform(index,manifest){
 let {html}=transform(index,manifest);
 html=html.replaceAll('window.localStorage','window.__MM_REAL_STORAGE__').replace(/\blocalStorage\b/g,'window.__MM_REAL_STORAGE__').replace(/\bindexedDB\b/g,'window.__MM_REAL_IDB__');
 html=once(html,'<head>',"<head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://rdcbnvfnxenrpnnwxszs.supabase.co; form-action 'none'; object-src 'none'; base-uri 'self'\">"+REAL_GUARD);
 const banner=html.match(/b\.textContent='STAGING [^']*';/g);if(banner?.length!==1)throw Error('Staging banner changed');html=once(html,banner[0],"b.textContent='READ-ONLY PREVIEW · awaiting verified real data';");
 const start=html.indexOf('function initSupabase(){'),end=html.indexOf('// Only a verified deletion completion',start);if(start<0||end<start)throw Error('Guest init boundary changed');
 html=html.slice(0,start)+GUEST_INIT+'\n'+html.slice(end);
 html=once(html,'function renderAccount(){',"function renderAccount(){ $('acctBox').textContent='Read-only development preview · guest mode'; return; ");
 html=once(html,"computedAt:p.as_of,build:null,at:Date.now()};_boardIx=null;","computedAt:p.board?.builtAt||null,build:null,at:Date.now()};_boardIx=null;");
 // The verified mirror already bounds and approves fixture membership. Preserve old-source
 // NS/postponed rows too; their original timestamps remain unchanged and are not labelled live.
 html=once(html,'const rows = dedupeProviders(freshRows(data||[])).map(settledRow);','const rows = dedupeProviders(data||[]).map(settledRow);');
 html=once(html,' setHeroDnb(available?f.pick:null,v);'," setHeroDnb(available?f.pick:null,v); $('acc-result').classList.toggle('hidden',!(available&&v));");
 // Issued slip projection covers today, not a complete financial/history tracker.
 html=once(html,'</head>','<style>#dailyTracker,#valueLadder{display:none!important}</style></head>');
 html=restore355Presentation(html);
 const man=JSON.parse(manifest);man.name='MatchMind Read-only Preview';man.short_name='MM Preview';
 return{html,manifest:JSON.stringify(man,null,2)+'\n'};
}
export const REAL_SW=`const CACHE='mm-real-preview-v358-p355';
const ROOT=new URL('./',self.registration.scope);const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('mm-real-preview-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==ROOT.origin||!u.pathname.startsWith(ROOT.pathname)||e.request.method!=='GET')return;
 if(u.pathname.endsWith('/sw.js')){e.respondWith(fetch(e.request));return;}
 e.respondWith(fetch(e.request).then(r=>{if(r.ok&&SHELL.some(p=>new URL(p,ROOT).pathname===u.pathname))caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r;}).catch(()=>caches.match(e.request)));
});`;
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const out=resolve(process.argv[2]||join(root,'staging/real-dist'));mkdirSync(out,{recursive:true});
 const t=realTransform(readFileSync(join(root,'index.html'),'utf8'),readFileSync(join(root,'manifest.webmanifest'),'utf8'));
 for(const bad of ['toqfdrcjzwnlydqekude','sb_secret_','service_role'])if(t.html.includes(bad))throw Error('Unsafe real preview binding');
 writeFileSync(join(out,'index.html'),t.html);writeFileSync(join(out,'manifest.webmanifest'),t.manifest);writeFileSync(join(out,'sw.js'),REAL_SW);
 for(const f of ['icon-192.png','icon-512.png'])copyFileSync(join(root,f),join(out,f));
 const hashes=Object.fromEntries(['index.html','manifest.webmanifest','sw.js','icon-192.png','icon-512.png'].map(f=>[f,createHash('sha256').update(readFileSync(join(out,f))).digest('hex')]));
 writeFileSync(join(out,'BUILD-INFO.json'),JSON.stringify({build:358,mode:'real-read-only',staging_project:STAGING_REF,output_sha256:hashes},null,2)+'\n');
 console.log(JSON.stringify({mode:'real-read-only',files:6,index_sha256:hashes['index.html']}));
}
