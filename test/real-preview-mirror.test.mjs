// Synthetic regression inputs only. The real source is never contacted by this suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {readPages,project,publish,requestFor,digest,windowFor,verifyDestination} from '../staging/mirror/refresh.mjs';
import {CARD_SCHEMA} from '../backend/fixture-delivery/contract.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PWA_PLAYWRIGHT||'playwright-core');
const root=new URL('../',import.meta.url),R=f=>readFileSync(new URL(f,root),'utf8');
const dir=mkdtempSync(join(tmpdir(),'mm-real-test-'));
const logoFixtures=[{fxid:990888,lid:39,home:'Harbor Athletic',away:'Granite United',home_logo:'https://media.api-sports.io/football/teams/1.png',away_logo:'https://media.api-sports.io/football/teams/2.png',llogo:'https://media.api-sports.io/football/leagues/39.png'}];
writeFileSync(join(dir,'logos.json'),JSON.stringify({version:'matchmind-original-logos/1',fixtures:logoFixtures,content_sha256:digest(logoFixtures)}));
execFileSync(process.execPath,[new URL('../staging/build-real-preview.mjs',import.meta.url).pathname,dir,'--logos',join(dir,'logos.json')]);
const html=readFileSync(join(dir,'index.html'),'utf8');
const fixtureClock=Date.now();
function fixture(){
 const now=new Date(fixtureClock),asof=new Date(+now-60000).toISOString(),w=windowFor(now),date=new Date(Date.parse(w.day)+86400000).toISOString().slice(0,10);
 return{fxid:990888,lid:39,lname:'Example League',lcountry:'Example',date,time:'20:00',status:'NS',elapsed:null,home:'Harbor Athletic',away:'Granite United',gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:asof,provider:'af',prediction:{lid:39,lname:'Example League',home:'Harbor Athletic',away:'Granite United',pick:'1',pick_prob:.64,market:'Winner',p_home:.64,p_draw:.2,p_away:.16,xg_home:1.8,xg_away:.9,kickoff:date,ktime:'20:00',made_at:asof,withheld_at:null,final_pick:null,build:358}};
}
const payload=()=>({cards:[fixture()],board:null,records:{engine:null,clv:null},slips:[]});
function request(p=payload()){const w=windowFor(new Date());return requestFor({payload:p,from:w.from,to:w.to,window_cards:1,cards:1,predictions:1,latest_source_update:p.cards[0].updated_at});}

test('production reads use GET, explicit columns, fixed origin and complete bounded pagination',async()=>{
 const calls=[];const data=await readPages('fixtures','fxid',[['date','gte.2026-11-06']],'fxid.asc',async(u,o)=>{
  calls.push({u,o});const offset=Number(u.searchParams.get('offset'));return{ok:true,headers:new Headers({'content-range':`${offset}-${offset?249:199}/250`}),json:async()=>Array.from({length:offset?50:200},(_,i)=>({fxid:offset+i+1}))};
 });
 assert.equal(data.length,250);assert.equal(calls.length,2);
 for(const{u,o}of calls){assert.equal(u.origin,'https://toqfdrcjzwnlydqekude.supabase.co');assert.equal(o.method,'GET');assert.equal(u.searchParams.get('select'),'fxid');assert.ok(!o.headers.Authorization);assert.equal(o.redirect,'error');}
 await assert.rejects(readPages('auth.users','*',[],'id'),/Unapproved/);
 await assert.rejects(readPages('fixtures','fxid,provider_blob',[],'fxid'),/Unapproved/);
 await assert.rejects(readPages('fixtures','fxid,*',[],'fxid'),/Unapproved/);
 await assert.rejects(readPages('fixtures','fxid',[],'fxid',async()=>({ok:true,headers:new Headers({'content-range':'0-0/1001'}),json:async()=>[]})),/bound/);
});
test('mapping drops provider/private extras and preserves original probability and timestamps exactly',()=>{
 const input=fixture();input.provider_blob={private:'must not leave runner'};const original=JSON.stringify(input);
 const out=project(input,CARD_SCHEMA);assert.ok(!('provider_blob'in out));assert.equal(out.prediction.pick_prob,.64);assert.equal(out.prediction.made_at,input.prediction.made_at);assert.equal(JSON.stringify(input),original);
});
test('writer refuses a missing protected token before any request and only publishes to staging',async()=>{
 let calls=0;await assert.rejects(publish(request(),' ',async()=>{calls++;}),/binding/);assert.equal(calls,0);
 const req=request();await publish(req,'synthetic-test-token'.repeat(4),async(u,o)=>{
  assert.equal(u.origin,'https://rdcbnvfnxenrpnnwxszs.supabase.co');assert.equal(u.pathname,'/rest/v1/rpc/mm_preview_publish_v1');assert.equal(o.method,'POST');
  assert.ok(!o.headers.Authorization);return{ok:true,json:async()=>({cards:req.cards,predictions:req.predictions,payload_sha256:req.payload_sha256})};
 });
});

for(const corrupt of [false,true])test('destination readback '+(corrupt?'rejects a changed original probability':'verifies every original field and complete projection'),async()=>{
 const req=request(),p=JSON.parse(req.payload_text),receipt={edition_id:'test-edition'};
 const fetcher=async(u,o)=>{
  assert.equal(u.origin,'https://rdcbnvfnxenrpnnwxszs.supabase.co');assert.equal(o.redirect,'error');assert.ok(!o.headers['x-mm-preview-token']);
  if(u.pathname.endsWith('status_v1'))return{ok:true,json:async()=>({...receipt,payload_sha256:req.payload_sha256,cards:req.cards,predictions:req.predictions})};
  const {screen}=JSON.parse(o.body),cards=['scores','predictions','history'].includes(screen)?structuredClone(p.cards):[];
  if(screen==='scores')cards.forEach(c=>c.prediction=null);
  if(corrupt&&screen==='history')cards[0].prediction.pick_prob=.65;
  return{ok:true,json:async()=>({...receipt,screen,cards,board:screen==='predictions'?p.board:null,records:screen==='records'?p.records:null,slips:screen==='slips'?p.slips:[]})};
 };
 if(corrupt)await assert.rejects(verifyDestination(req,receipt,fetcher),/original value mismatch/);
 else assert.deepEqual(await verifyDestination(req,receipt,fetcher),{verified_cards:1,verified_predictions:1});
});

const db='mm-mirror-'+process.pid;
const docker=(a,input)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...a],{input,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']}).trim();
function sql(s,role,token){const prefix=(token?`set request.headers='${JSON.stringify({'x-mm-preview-token':token})}';`:'')+(role?`set role ${role};`:'');return docker(['exec','-i',db,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],prefix+s);}
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
let originalHashes;
test.before(async()=>{
 docker(['run','-d','--name',db,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16.6@sha256:557fea37a744d5f4c8faab304b0a90858b53ab119735a88c131fd19dab802f36']);
 let ready=false;for(let i=0;i<80;i++){try{if(docker(['logs',db]).includes('init process complete')){docker(['exec',db,'pg_isready','-U','postgres']);ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready);
 sql(R('backend/fixture-delivery/synthetic-bootstrap.sql'));
 sql('create schema mm_fixture_delivery;create table mm_fixture_delivery.editions(edition_id uuid primary key,edition_day date,as_of timestamptz,expires_at timestamptz,source_review text,expected_cards int,expected_predictions int,payload jsonb);');
 const baseline=R('backend/fixture-delivery/PROPOSAL-up.sql');
 sql(baseline.slice(baseline.indexOf('create function mm_fixture_delivery.schema_valid('),baseline.indexOf('alter table mm_fixture_delivery.editions add constraint closed_payload')));
 const predcount=baseline.match(/create function mm_fixture_delivery.prediction_count\([\s\S]*?\$\$;/)[0];sql(predcount);
 assert.throws(()=>sql(R('staging/mirror/INSTALL-staging-only.sql')),/configuration required/);
 // Model permissive project defaults; private backups must still have no anonymous grants.
 sql('alter default privileges for role postgres grant all on tables to anon,authenticated,service_role;');
 sql("set mm.preview_token_sha256='"+digest('synthetic-test-token-synthetic-test-token')+"';"+R('staging/mirror/INSTALL-staging-only.sql'));
 originalHashes=sql('select jsonb_object_agg(relation_name,fingerprint) from mm_preview_mirror.qa_backup');
});
test.after(()=>docker(['rm','-fv',db]));
test('backup is verified by typed restore; writer is narrow, token-gated and configuration stays private',()=>{
 assert.equal(sql('select count(*) from mm_preview_mirror.qa_backup where verified;'),'5');
 assert.throws(()=>sql(`select public.mm_preview_publish_v1(${literal(request())});`,'anon'),/writer required/);
 for(const table of ['qa_backup','configuration','editions'])assert.throws(()=>sql('select * from mm_preview_mirror.'+table,'anon'),/permission denied/);
 sql("update mm_preview_mirror.configuration set token_sha256=sha256(convert_to('synthetic-test-token-synthetic-test-token','UTF8'));");
 const r=JSON.parse(sql(`select public.mm_preview_publish_v1(${literal(request())});`,'anon','synthetic-test-token-synthetic-test-token'));
 assert.equal(r.cards,1);assert.equal(r.predictions,1);
 assert.equal(sql('select jsonb_object_agg(relation_name,fingerprint) from mm_preview_mirror.qa_backup'),originalHashes);
});
test('server rejects checksum, coverage, synthetic and unpublished changes without replacing the good edition',()=>{
 const good=JSON.parse(sql('select public.mm_preview_status_v1();','anon'));
 for(const change of [r=>r.source_project=null,r=>r.captured_at=null,r=>r.cards=null,r=>r.payload_sha256=null,r=>r.payload_sha256='0'.repeat(64),r=>r.cards=2,r=>{const p=JSON.parse(r.payload_text);p.cards[0].home='QA Fiction';r.payload_text=JSON.stringify(p);r.payload_sha256=digest(r.payload_text);},r=>{const p=JSON.parse(r.payload_text);p.cards[0].prediction.made_at=null;r.payload_text=JSON.stringify(p);r.payload_sha256=digest(r.payload_text);}]){
  const r=request();change(r);assert.throws(()=>sql(`select public.mm_preview_publish_v1(${literal(r)});`,'anon','synthetic-test-token-synthetic-test-token'));
  assert.equal(JSON.parse(sql('select public.mm_preview_status_v1();','anon')).edition_id,good.edition_id);
 }
 const h=JSON.parse(sql("select public.mm_preview_display_v1('history');",'anon'));
 assert.equal(h.cards[0].prediction.pick_prob,.64);assert.equal(h.cards[0].prediction.made_at,JSON.parse(request().payload_text).cards[0].prediction.made_at);
});

async function open(t,width){
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width,height:844},timezoneId:'Africa/Lagos'});
 await ctx.addInitScript(()=>{localStorage.setItem('mm_state','production-state-sentinel');localStorage.setItem('sb-production-auth-token','production-auth-sentinel');localStorage.setItem('mm-real-preview:mm_intro','1');});
 const page=await ctx.newPage(),network=[];page.on('request',r=>network.push({url:r.url(),method:r.method()}));
 const f=fixture(),stamp=new Date(Date.now()-60000).toISOString(),expires=new Date(Date.now()+3600000).toISOString();
 await ctx.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin==='http://preview.test')return route.fulfill({status:200,contentType:'text/html',body:html});
  if(u.hostname==='media.api-sports.io')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM0cAAAAASUVORK5CYII=','base64')});
  if(u.pathname==='/rest/v1/rpc/mm_preview_status_v1')return route.fulfill({json:{mode:'real-read-only',edition_id:'11111111-2222-4333-8444-555555555555',published_at:stamp,expires_at:expires,source_updated_at:stamp}});
  if(u.pathname==='/rest/v1/rpc/mm_preview_display_v2'){
   const screen=r.postDataJSON().screen;return route.fulfill({json:{version:'matchmind-display/1',edition_id:'11111111-2222-4333-8444-555555555555',as_of:stamp,expires_at:expires,screen,cards:screen==='scores'?[{...f,prediction:null},{...f,fxid:990889,home:'Cedar City',updated_at:new Date(Date.now()-72*3600000).toISOString(),prediction:null}]:['predictions','history'].includes(screen)?[f]:[],board:null,records:{engine:null,clv:null},slips:[]}});
  }
  return route.abort();
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://preview.test/');
 await page.waitForFunction(()=>Object.keys(afState.leagues||{}).length>0);
 t.after(()=>assert.deepEqual(errors,[]));return{page,network};
}
for(const width of [320,390])test('real mode is guest-only, staging-only, readable and isolated from production storage at '+width+'px',async t=>{
 const{page,network}=await open(t,width);
 const r=await page.evaluate(async()=>{
  await loadCloudLeagues(true);await afScoresFromCloud();const L=Object.values(afState.leagues)[0],f=L.upcoming[0];
  afState.scoresDate=localDateOf(afState.scores.list[0]);renderScores();const scores=$('scoresList').textContent;
  afState.filter='999';renderFixtures();const filtered=$('fixtureList').textContent;afState.filter='all';renderFixtures();
  showPublishedFixture(L,f);let blocked=0;for(const [u,m]of [[SUPA_URL+'/auth/v1/token','POST'],[SUPA_URL+'/rest/v1/fixtures','GET'],[SUPA_URL+'/rest/v1/rpc/mm_preview_publish_v1','POST'],['https://example.com/','GET']])try{await fetch(u,{method:m});}catch{blocked++;}
  return{scores,filtered,badge:$('heroPick').textContent,text:$('outcomeRows').textContent,visible:!$('acc-result').classList.contains('hidden'),prob:f.prob,blocked,user:authUser,bar:$('stagingBar').textContent,account:$('acctBox').textContent,storage:window.localStorage.getItem('mm_state'),auth:window.localStorage.getItem('sb-production-auth-token'),overflow:document.documentElement.scrollWidth>innerWidth+1,controls:['afKey','aiKeyInput'].some(id=>$(id)?.matches('input,button,select'))};
 });
 const branding=await page.evaluate(()=>{afState.selectedDate=Object.values(afState.leagues)[0].upcoming[0].date;navTo('predict');afState.filter='all';renderFixtures();const row=$('fixtureList').querySelector('.fxrow'),teams=row.querySelector('.fxteams').getBoundingClientRect(),pick=row.querySelector('.predchip').getBoundingClientRect();return{images:row.querySelectorAll('img.crest').length,right:pick.left>=teams.right-1,edge:skillBadge({id:39}),pick:row.querySelector('.predchip').textContent};});
 assert.equal(branding.images,2);assert.ok(branding.right);assert.equal(branding.edge,'');assert.match(branding.pick,/64%/);
 assert.match(r.scores,/Harbor Athletic/);assert.match(r.scores,/Cedar City/);assert.match(r.filtered,/No predictions/);assert.match(r.text,/64.0%/);assert.equal(r.prob,.64);assert.ok(r.visible);assert.equal(r.blocked,4);assert.equal(r.user,null);assert.equal(r.controls,false);assert.match(r.bar,/REAL DATA.*READ-ONLY/);assert.match(r.account,/guest/);assert.equal(r.storage,'production-state-sentinel');assert.equal(r.auth,'production-auth-sentinel');assert.equal(r.overflow,false);
 await page.evaluate(async()=>{await loadCloudLeagues(true);const f=Object.values(afState.leagues)[0].upcoming[0];afState.archiveDate=null;afState.selectedDate=forecastDate(f);afState.filter='all';navTo('predict');renderFixtures();});
 await page.locator('#fixtureList .fxrow .tline').nth(1).click();assert.equal(await page.evaluate(()=>curView),'detail');
 const presentation=await page.evaluate(()=>{
  const L=Object.values(afState.leagues)[0],f=L.upcoming[0],original=JSON.stringify(afState.archive),date=new Date(Date.now()-7*86400000).toISOString().slice(0,10),id=990890;
  const p={...f._displayCard.prediction,home:'Haras El Hodood',away:'El Dakhleya',pick:'1D',pick_prob:.807,kickoff:date,ktime:'12:30',made_at:new Date(Date.now()-10*86400000).toISOString(),p_home:.589,p_draw:.2728,p_away:.1382};
  const old={...f,fxid:id,home:p.home,away:p.away,pick:p.pick,prob:p.pick_prob,status:'NS',_displayCard:{...f._displayCard,fxid:id,home:p.home,away:p.away,prediction:p}};
  afState.archive[id]=archiveRow(p);L.upcoming.push(old);const archive=JSON.stringify(afState.archive),predicate=forecastDisplayExpired(old);showPublishedFixture(L,old);
  const retained={predicate,badge:$('heroPick').textContent,probability:$('heroPick').closest('.hero').dataset.originalProbability,status:$('heroStrong').textContent,note:$('analysisText').textContent,vector:$('outcomeRows').textContent,kickoff:$('heroPick').closest('.hero').dataset.originalKickoff,publishedAt:$('heroPick').closest('.hero').dataset.publishedAt,key:$('heroPick').closest('.hero').dataset.selectionKey};
  afState.selectedDate=f.date;afState.filter='all';navTo('predict');renderFixtures();const notReissued=!$('fixtureList').textContent.includes(p.home);
  afState.selectedDate=date;renderFixtures();const dated=$('fixtureList').textContent.includes(p.home)&&$('fixtureList').textContent.includes('1 DNB');
  const leg={fxid:id,d:f.date,t:f.time,h:p.home,a:p.away,code:'1X',p:.8618,market:'Double Chance'},shared=_sharedSlips;
  _sharedSlips={loaded:true,rows:[{day:f.date,tier:'banker',build:358,step:'issued',legs:[leg]}]};const opened=openIssuedForecast(leg),hero=$('heroPick').closest('.hero'),issued={opened,badge:$('heroPick').textContent,key:hero.dataset.selectionKey,kickoff:hero.dataset.originalKickoff,probability:hero.dataset.originalProbability};_sharedSlips=shared;
  const names=[$('fixtureList').textContent];const unchanged=archive===JSON.stringify(afState.archive);delete afState.archive[id];
  afState.selectedDate=date;navTo('predict');renderFixtures();
  return{retained,issued,notReissued,dated,unchanged,originalArchive:original===JSON.stringify(afState.archive),overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
 assert.ok(presentation.retained.predicate);assert.match(presentation.retained.badge,/1 DNB.*81%/);assert.equal(presentation.retained.probability,'0.807');assert.equal(presentation.retained.status,'');assert.equal(presentation.retained.note,'AI write-up not published.');assert.match(presentation.retained.vector,/58.9%/);assert.ok(presentation.notReissued&&presentation.dated&&presentation.unchanged&&presentation.originalArchive);assert.ok(presentation.issued.opened);assert.match(presentation.issued.badge,/1X.*86%/);assert.equal(presentation.issued.probability,'0.8618');assert.notEqual(presentation.issued.key,presentation.retained.key);assert.notEqual(presentation.issued.kickoff,presentation.retained.kickoff);assert.equal(presentation.overflow,false);
 const archiveView=await page.evaluate(async()=>{
  const original=fixtureTable,date=new Date(Date.now()-12*86400000).toISOString().slice(0,10),p={fxid:990888,lname:'Example League',kickoff:date,ktime:'20:00',home:'Harbor Athletic',away:'Granite United',pick:'1D',pick_prob:.807};
  fixtureTable=name=>{const q={select(){return q},eq(){return q},order(){return Promise.resolve({data:[p],error:null})},in(){return Promise.resolve({data:[{fxid:p.fxid,date:todayStrLocal(),time:'20:00',status:'PST'}],error:null})}};return q;};
  try{await showPredictDate(date);const row=$('fixtureList').querySelector('.fxrow');return{badge:row.querySelector('.predchip').textContent,time:row.querySelector('.fxtime').textContent,expected:localHM(date,'20:00'),status:row.querySelectorAll('[data-statuswhy]').length};}finally{fixtureTable=original;}
 });
 assert.match(archiveView.badge,/1 DNB.*81%/);assert.equal(archiveView.time,archiveView.expected);assert.equal(archiveView.status,0);
 const missing=await page.evaluate(()=>{const L=Object.values(afState.leagues)[0],f=L.upcoming[0],saved=f._displayCard;f._displayCard=null;showPublishedFixture(L,f);const text=$('heroPick').textContent;f._displayCard=saved;return text;});assert.equal(missing,'No qualifying pick');
 for(const n of network)if(n.url.includes('.supabase.co')){assert.ok(n.url.includes('rdcbnvfnxenrpnnwxszs'));assert.equal(n.method,'POST');assert.match(n.url,/mm_preview_(display_v2|status_v1)$/);}
});
test('real service worker preserves other applications caches and synthetic builder stays independent',()=>{
 const sw=readFileSync(join(dir,'sw.js'),'utf8');assert.match(sw,/startsWith\('mm-real-preview-'\)/);assert.doesNotMatch(sw,/filter\(k=>k!==CACHE\)/);assert.match(R('staging/build-preview.mjs'),/synthetic data/);
 assert.doesNotMatch(html,/toqfdrcjzwnlydqekude|sb_secret_|service_role/);
 const source=R('index.html');for(const [first,next]of [['pickVerdict','pickPhrase'],['pickPlayState','pickVerdict'],['forecastDisplayExpired','forecastStatusChip'],['boardForwardRows','boardGoalsSel'],['slipCandidatesFromBoard','slipCandidates']]){const start=source.indexOf('function '+first+'('),end=source.indexOf('function '+next+'(',start);assert.ok(start>=0&&end>start&&html.includes(source.slice(start,end)),first+' business rule unchanged');}
});
