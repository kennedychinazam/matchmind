// Independent, anonymous READ-ONLY checks against the actual Cloudflare staging deployment.
// No generation, account operation, source refresh, denied write probe, or privileged credential.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createHarness} from './common.mjs';

const TARGET=process.env.STAGING_URL||'https://matchmind-staging-358.pages.dev/';
const origin=new URL(TARGET).origin,dist=resolve(process.env.APPROVED_DIST||process.env.STAGING_DIST||'staging/dist');
const sha=b=>createHash('sha256').update(b).digest('hex');
// Independent expectation for the reviewed Scores collection policy: index.html
// afScoresFromCloud UTC query [-7,+8] days, freshRows 24h-relative-to-newest,
// then dedupeProviders only when its API-Football twin is in that admitted batch.
// Deliberately do not invoke the application's own filter to determine expectations.
function expectedScoresInventory(cards,now){
 const dayMs=86400000,minDay=new Date(now-7*dayMs).toISOString().slice(0,10),maxDay=new Date(now+8*dayMs).toISOString().slice(0,10);
 const exclusions=[],windowRows=cards.filter(c=>{const keep=c.date>=minDay&&c.date<=maxDay;if(!keep)exclusions.push({fxid:c.fxid,reason:'outside-documented-UTC-query-window',date:c.date});return keep;});
 const newest=Math.max(0,...windowRows.map(c=>Date.parse(c.updated_at||'')).filter(Number.isFinite)),cutoff=newest?newest-dayMs:null;
 const fresh=windowRows.filter(c=>{const t=Date.parse(c.updated_at||'');const keep=cutoff===null||t>=cutoff;if(!keep)exclusions.push({fxid:c.fxid,reason:Number.isFinite(t)?'older-than-24h-relative-to-newest':'timestamp-unusable-in-timestamped-batch',updated_at:c.updated_at,cutoff:new Date(cutoff).toISOString()});return keep;});
 const twin={2021:39,2014:140,2002:78,2019:135,2015:61,2001:2,2003:88,2017:94,2016:40,2013:71,2152:13};
 const pro=new Set(fresh.filter(c=>c.provider==='af').map(c=>String(c.lid)));
 const admitted=fresh.filter(c=>{const keep=c.provider==='af'||twin[c.lid]==null||!pro.has(String(twin[c.lid]));if(!keep)exclusions.push({fxid:c.fxid,reason:'free-provider-twin-of-present-api-football-competition',lid:c.lid,twin:twin[c.lid]});return keep;});
 return{ids:admitted.map(c=>c.fxid).sort((a,b)=>a-b),exclusions,policy:{utcQueryWindow:{minDay,maxDay},freshnessHours:24,newest: newest?new Date(newest).toISOString():null,cutoff:cutoff===null?null:new Date(cutoff).toISOString(),source:'Reviewed immutable index.html afScoresFromCloud/freshRows/dedupeProviders'}};
}

const h=await createHarness({role:'independent',browserType:'chromium',contextOptions:{viewport:{width:1280,height:900},timezoneId:'UTC'},serviceWorkers:'allow'});
const {page,context,browser}=h;
h.report.proofClass='Actual Cloudflare URL, desktop Chromium; no physical device or deployed-version rollout proof';
h.report.baseline='b1d3d75c2db61801dd3b2033108035aeb77fc424';
h.report.physicalNotVerified=['Android installation and OS lifecycle','iOS Safari/home-screen storage and update policy','Push delivery and notifications','New deployed worker rollout and rollback','Successful real account sign-in'];
const assets={};let reachable=false;
async function poll(fn,label,ms=30000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await page.waitForTimeout(250);}throw Error(label);}
async function dataCheck(name,fn,deadline){
 if(Date.now()>=deadline){h.record(name,'BLOCKED','The observed synthetic edition expired before this check.');return;}
 try{const details=await fn();if(Date.now()>=deadline)h.record(name,'BLOCKED','The observed edition expired during comparison; no product-failure claim is made.');else h.record(name,'PASS',details||{});}
 catch(e){if(Date.now()>=deadline)h.record(name,'BLOCKED',{reason:'Edition expired during check',error:e.message});else{let screenshot=null;try{screenshot=await h.screenshot('failure-data-'+h.report.checks.length);}catch{}h.record(name,'FAIL',{error:e.stack||String(e),screenshot});}}
}
// Cloudflare canonicalizes /index.html to /. Follow only bounded HTTPS static-asset
// redirects on the exact approved origin. Never send an asset request to another service.
async function fetchStaticAsset(start,fetcher=fetch){
 const allowed=new Set(['/','/index.html','/sw.js','/manifest.webmanifest','/icon-192.png','/icon-512.png','/BUILD-INFO.json']);
 const chain=[],seen=new Set();let current=new URL(start,origin);current.hash='';
 const refuse=message=>{const e=new Error(message);e.code='QA_REDIRECT_REJECTED';e.redirectChain=chain;return e;};
 for(let hops=0;hops<=3;hops++){
  if(current.protocol!=='https:'||current.origin!==origin||current.username||current.password||!allowed.has(current.pathname))throw refuse('Static asset redirect leaves the approved HTTPS origin/path set');
  if(seen.has(current.href))throw refuse('Static asset redirect cycle');seen.add(current.href);
  const r=await fetcher(current.href,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(30000)});
  const step={url:current.href,status:r.status};chain.push(step);
  if([301,302,303,307,308].includes(r.status)){
   const location=r.headers.get('location');if(!location)throw refuse('Static asset redirect lacks Location');
   const next=new URL(location,current);next.hash='';step.location=next.origin+next.pathname;
   if(hops===3)throw refuse('Static asset redirect limit exceeded');current=next;continue;
  }
  return{response:r,bytes:Buffer.from(await r.arrayBuffer()),chain,finalURL:current.href};
 }
 throw refuse('Static asset redirect limit exceeded');
}
async function archiveSnapshot(){return page.evaluate(()=>Object.fromEntries(Object.entries(afState.archive||{}).sort(([a],[b])=>a.localeCompare(b)).map(([id,r])=>[id,{kickoff:r.kickoff,ktime:r.ktime,pick:r.pick,prob:r.prob,market:r.market,pW:r.pW,pD:r.pD,pL:r.pL,xgH:r.xgH,xgA:r.xgA,at:r.at}])));}
try{
 const info=JSON.parse(readFileSync(join(dist,'BUILD-INFO.json'),'utf8'));
 h.report.expectedArtifact=info;
 assert.equal(info.build,358);assert.equal(info.staging_project,'rdcbnvfnxenrpnnwxszs');
 for(const name of ['index.html','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','BUILD-INFO.json']){
  let r,b,chain,finalURL;try{const asset=await fetchStaticAsset('/'+name);r=asset.response;b=asset.bytes;chain=asset.chain;finalURL=asset.finalURL;}
  catch(e){h.record('actual '+name+' reachability',e.code==='QA_REDIRECT_REJECTED'?'FAIL':'BLOCKED',{error:e.message,redirectChain:e.redirectChain||[],classification:e.code==='QA_REDIRECT_REJECTED'?'rejected redirect; no external or nonstatic request followed':'transport, not an observed application defect'});continue;}
  const want=name==='BUILD-INFO.json'?sha(readFileSync(join(dist,name))):info.output_sha256[name];
  assets[name]={status:r.status,redirectChain:chain,finalURL,sha256:sha(b),expected_sha256:want,contentType:r.headers.get('content-type'),cacheControl:r.headers.get('cache-control'),bytes:b.length};
  await h.check('Cloudflare '+name+' equals reviewed generated artifact',async()=>{assert.equal(r.status,200);assert.equal(sha(b),want);});
  if(name==='index.html'&&r.status===200){reachable=true;await h.check('deployed HTML has only staging binding and Build358 guard',async()=>{const html=b.toString('utf8');assert.match(html,/const APP_BUILD = 358;/);assert.match(html,/const SUPA_URL = 'https:\/\/rdcbnvfnxenrpnnwxszs\.supabase\.co';/);assert.match(html,/id="stagingGuard"/);assert.doesNotMatch(html,/toqfdrcjzwnlydqekude|sb_secret_|SUPABASE_SERVICE_ROLE_KEY/);});}
  if(name==='sw.js')await h.check('worker identity is Build358 and contains no backend/provider route',async()=>{const text=b.toString('utf8');assert.match(text,/const CACHE = 'matchmind-v358';/);assert.doesNotMatch(text,/toqfdrcjzwnlydqekude|openrouter\.ai|api-sports\.io|\/functions\/v1\//);});
  if(name==='manifest.webmanifest')await h.check('manifest identifies staging root standalone with usable icons',async()=>{const m=JSON.parse(b.toString('utf8'));assert.equal(m.name,'MatchMind STAGING');assert.equal(m.display,'standalone');assert.equal(m.scope,'./');assert.equal(m.start_url,'./');assert.deepEqual(m.icons.map(x=>x.sizes).sort(),['192x192','512x512']);});
 }
 h.report.servedAssets=assets;
 if(!reachable){h.record('dependent browser/data/PWA acceptance','BLOCKED','Actual Cloudflare HTML was not reachable; no local replay is substituted.');}
 else{
  await h.check('actual deployed page navigates and exposes Build358 staging identity',async()=>{await h.goto();assert.equal(await page.evaluate(()=>APP_BUILD),358);assert.equal(await page.evaluate(()=>SUPA_URL),'https://rdcbnvfnxenrpnnwxszs.supabase.co');assert.match(await page.title(),/^STAGING /);assert.equal(await page.locator('#stagingBar').isVisible(),true);});
  const editions={};for(const screen of ['predictions','history','scores'])editions[screen]=await h.edition(screen);
  h.report.editionSummary=Object.fromEntries(Object.entries(editions).map(([k,e])=>[k,{valid:e.valid,reason:e.reason,observedAt:e.observedAt,editionId:e.data?.edition_id,asOf:e.data?.as_of,expiresAt:e.data?.expires_at,cards:e.data?.cards?.length}]));
  const current=Object.values(editions).every(e=>e.valid);
  if(current){
   const dataDeadline=Math.min(...Object.values(editions).map(e=>Date.parse(e.data.expires_at)));
   const checkData=(name,fn)=>dataCheck(name,fn,dataDeadline);
   await checkData('valid live edition is adopted before interpreting data availability',async()=>{await page.evaluate(()=>loadCloudLeagues(true));await poll(()=>page.evaluate(()=>Object.keys(afState.leagues||{}).length>0&&_presentationUntil>Date.now()),'Current published edition did not reach the page');assert.ok(await page.evaluate(()=>Object.keys(afState.archive||{}).length>=145),'145 original frozen forecasts were not present');});
   await checkData('freshness chip reports the accepted edition age honestly',async()=>{const s=await page.evaluate(()=>({asOf:_presentationAsOf,until:_presentationUntil,chip:$('dataChip').textContent,title:$('dataChip').title,now:Date.now()}));h.report.freshness=s;assert.ok(s.until>s.now);assert.equal(s.asOf,Date.parse(editions.predictions.data.as_of));const hours=Math.floor((s.now-s.asOf)/3600000);if(hours>=7)assert.match(s.chip,new RegExp('Updated '+hours+'h ago'));else assert.doesNotMatch(s.chip,/Sample data/i);});
   await checkData('published pick/probability/vector identities survive refresh and reload unchanged',async()=>{
    const before=await archiveSnapshot();assert.ok(Object.keys(before).length>=145);await page.evaluate(()=>loadCloudLeagues(true));const afterRefresh=await archiveSnapshot();await page.reload({waitUntil:'load'});await poll(()=>page.evaluate(()=>Object.keys(afState.archive||{}).length>=145),'Published archive did not restore after reload');const afterReload=await archiveSnapshot();
    if(Date.now()>=Date.parse(editions.history.data.expires_at))throw Error('Edition expired during comparison; retained snapshots must be reviewed as freshness-blocked');
    for(const id of Object.keys(before)){assert.deepEqual(afterRefresh[id],before[id],id+' changed during refresh');assert.deepEqual(afterReload[id],before[id],id+' changed after reload');}
    h.report.immutability={compared:Object.keys(before).length,before_sha256:sha(JSON.stringify(before)),after_refresh_sha256:sha(JSON.stringify(afterRefresh)),after_reload_sha256:sha(JSON.stringify(afterReload)),excludesMutableWithdrawalStatus:true};
   });
   await checkData('Scores renders every admitted day row and matching count without hidden competition/status filters',async()=>{
    const rows=await page.evaluate(async()=>{await afScoresFromCloud();navTo('scores');afState.filter='all';afState.scoreFilter='all';const days=[...new Set((afState.scores?.list||[]).map(s=>s.ldate||localDateOf(s)))];const out=[];for(const day of days){afState.scoresDate=day;renderScores();const expected=afState.scores.list.filter(s=>(s.ldate||localDateOf(s))===day).map(s=>[s.home,s.away].join('|')).sort();const actual=[...document.querySelectorAll('#scoresList .scrow')].map(r=>[...r.querySelectorAll('.tline')].map(n=>[...n.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').trim()).join('|')).sort();out.push({day,expected,actual,meta:$('scoresMeta').textContent});}return{days:out,ids:(afState.scores?.list||[]).map(s=>s.fxid).sort((a,b)=>a-b)};});
    const observedAt=Date.now(),expected=expectedScoresInventory(editions.scores.data.cards,observedAt);
    h.report.scoresInventoryDiagnostic={clientIds:rows.ids,serverCards:editions.scores.data.cards.map(c=>({fxid:c.fxid,lid:c.lid,date:c.date,time:c.time,updated_at:c.updated_at,provider:c.provider,status:c.status})),expectedPolicy:expected.policy,declaredExclusions:expected.exclusions,expectedIds:expected.ids,renderedDays:rows.days,verifiedAt:new Date(observedAt).toISOString()};
    assert.deepEqual(rows.ids,expected.ids,'Client Scores inventory differs from independently admitted source inventory');for(const day of rows.days){assert.deepEqual(day.actual,day.expected,day.day+' lost/duplicated a match');assert.match(day.meta,new RegExp('·\\s*'+day.expected.length+' matches'));}h.report.scoresCompleteness={ids:rows.ids,declaredExclusions:expected.exclusions,days:rows.days.map(x=>({day:x.day,count:x.actual.length,meta:x.meta}))};
   });
   const tables=await page.evaluate(()=>{const ids=[...document.querySelectorAll('#acc-standings')];return ids.map(e=>({visible:e.getBoundingClientRect().height>0&&getComputedStyle(e).display!=='none',text:e.textContent}));});
   h.report.availableLeagueTableSurfaces=tables;
   if(!tables.some(t=>t.visible))h.record('competition-specific league-table explanations on a reachable table','BLOCKED','No league-table panel is available in the current anonymous bounded-public state; no synthetic raw history was injected to manufacture it. Android/iPhone UI journeys supply their own visible-surface observations.');
   else await h.check('visible league-table explanation does not import a different league finding',async()=>{const state=await page.evaluate(()=>({league:afState.leagues[afState.activeLeagueId]?.name||'',table:$('standingsBox')?.textContent||''}));if(!/Championship/i.test(state.league))assert.doesNotMatch(state.table,/Sheffield Wednesday|West Brom|Leicester.*minus|Leicester.*−/);});
   await h.screenshot('published-scores-desktop');
  }else{
   for(const name of ['forecast immutability on current data','freshness chip/current data adoption','scores completeness and current competition explanations'])h.record(name,'BLOCKED',{reason:'Synthetic edition is expired, unavailable or invalid; this is not classified as a missing-match/product defect.',editions:h.report.editionSummary});
   await h.screenshot('edition-unavailable-desktop');
  }
  await h.check('service worker registers, activates and controls the actual staging root',async()=>{
   await poll(()=>page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return !!(r?.active&&r.active.state==='activated');}),'Service worker did not activate');await page.reload({waitUntil:'load'});await poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller),'Service worker did not control the page');const s=await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return{scope:r.scope,active:r.active.scriptURL,controller:navigator.serviceWorker.controller.scriptURL,state:r.active.state,updateViaCache:r.updateViaCache};});assert.equal(s.scope,origin+'/');assert.equal(new URL(s.active).pathname,'/sw.js');assert.equal(s.active,s.controller);h.report.worker=s;
  });
  await h.check('all five reviewed shell entries are cached under Build358 without observer mutation',async()=>{
   await poll(()=>page.evaluate(async()=>{if(!(await caches.keys()).includes('matchmind-v358'))return false;for(const p of['/','/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png'])if(!await caches.match(new URL(p,location.origin).href,{cacheName:'matchmind-v358'}))return false;return true;}),'Offline shell was not completely cached');
   const c=await page.evaluate(async()=>{const names=await caches.keys(),digests={};for(const p of['/','/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png']){const r=await caches.match(new URL(p,location.origin).href,{cacheName:'matchmind-v358'});digests[p]=r?[...new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join(''):null;}return{names,digests};});for(const [path,digest]of Object.entries(c.digests)){const file=path==='/'?'index.html':path.slice(1);assert.equal(digest,assets[file].sha256,path+' cached bytes differ from reviewed served content');}h.report.shellCache=c;
  });
  await h.check('actual unchanged-worker update check reaches server and version probes never enter CacheStorage',async()=>{
   const probe='/sw.js?qa_probe='+Date.now();const out=await page.evaluate(async p=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();const r=await fetch(p,{cache:'no-store'});const bytes=await r.arrayBuffer(),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');return{status:r.status,digest,probeCached:!!(await caches.match(new URL(p,location.origin).href)),workerCached:!!(await caches.match(new URL('/sw.js',location.origin).href)),active:registration.active?.scriptURL,controller:navigator.serviceWorker.controller?.scriptURL,waiting:!!registration.waiting};},probe);assert.equal(out.status,200);assert.equal(out.digest,assets['sw.js'].sha256);assert.equal(out.probeCached,false);assert.equal(out.workerCached,false);assert.equal(out.active,out.controller);h.report.sameVersionUpdate=out;
  });
  h.record('different deployed worker rollout and forward-version rollback','BLOCKED','No staging deployment or worker substitution is authorized. Same-version update and cache exclusion are tested; a real new-version activation/rollback and physical installed-PWA acceptance are not claimed.');
  await h.check('offline actual-origin reload retains staging shell identity and navigation',async()=>{
   try{await context.setOffline(true);await page.reload({waitUntil:'load'});const s=await page.evaluate(()=>({build:APP_BUILD,title:document.title,bar:!!document.getElementById('stagingBar'),navs:document.querySelectorAll('.nav-btn[data-view]').length,body:document.body.textContent.slice(0,800)}));assert.equal(s.build,358);assert.match(s.title,/^STAGING /);assert.equal(s.bar,true);assert.equal(s.navs,5);h.report.offlineShell=s;await h.screenshot('actual-origin-offline-shell');}finally{await context.setOffline(false);}
  });
  await h.check('actual browser requests never target production, providers or restricted Edge Functions',async()=>{const requests=h.report.requests||[];h.report.requestObservationNote='Context request observation includes service-worker requests where the browser exposes them; route interception does not by itself intercept service-worker traffic. Actual reviewed worker is same-origin shell-only.';for(const r of requests){const u=typeof r==='string'?r:(r.url||('https://'+r.host+r.path));if(u)assert.doesNotMatch(u,/toqfdrcjzwnlydqekude|openrouter\.ai|api-sports\.io|anthropic\.com|moonshot|deepseek|\/functions\/v1\//i);}});
  await h.check('no JavaScript runtime error during online/PWA/offline checks',async()=>assert.deepEqual(h.report.pageErrors,[]));
 }
}catch(e){h.record('independent runner completed','FAIL',{error:e.stack||String(e),classification:'harness or infrastructure unless independently reproduced as application defect'});}
finally{h.report.completedAt=new Date().toISOString();const final=await h.finish();process.exitCode=(final?.counts?.FAIL||0)>0?1:0;}
