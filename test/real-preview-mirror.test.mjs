// Synthetic regression inputs only. The real source is never contacted by this suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {readPages,project,publish,requestFor,digest,windowFor,verifyDestination} from '../staging/mirror/refresh.mjs';
import {CARD_SCHEMA} from '../backend/fixture-delivery/contract.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PWA_PLAYWRIGHT||'playwright-core');
const root=new URL('../',import.meta.url),R=f=>readFileSync(new URL(f,root),'utf8');
const dir=mkdtempSync(join(tmpdir(),'mm-real-test-'));
execFileSync(process.execPath,[new URL('../staging/build-real-preview.mjs',import.meta.url).pathname,dir]);
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
 await ctx.addInitScript(()=>{localStorage.setItem('mm_state','production-state-sentinel');localStorage.setItem('sb-production-auth-token','production-auth-sentinel');});
 const page=await ctx.newPage(),network=[];page.on('request',r=>network.push({url:r.url(),method:r.method()}));
 const f=fixture(),stamp=new Date(Date.now()-60000).toISOString(),expires=new Date(Date.now()+3600000).toISOString();
 await ctx.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin==='http://preview.test')return route.fulfill({status:200,contentType:'text/html',body:html});
  if(u.pathname==='/rest/v1/rpc/mm_preview_status_v1')return route.fulfill({json:{mode:'real-read-only',edition_id:'11111111-2222-4333-8444-555555555555',published_at:stamp,expires_at:expires,source_updated_at:stamp}});
  if(u.pathname==='/rest/v1/rpc/mm_preview_display_v1'){
   const screen=r.postDataJSON().screen;return route.fulfill({json:{version:'matchmind-display/1',edition_id:'11111111-2222-4333-8444-555555555555',as_of:stamp,expires_at:expires,screen,cards:['scores','predictions','history'].includes(screen)?[screen==='scores'?{...f,prediction:null}:f]:[],board:null,records:{engine:null,clv:null},slips:[]}});
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
  return{scores,filtered,text:$('outcomeRows').textContent,visible:!$('acc-result').classList.contains('hidden'),prob:f.prob,blocked,user:authUser,bar:$('stagingBar').textContent,account:$('acctBox').textContent,storage:window.localStorage.getItem('mm_state'),auth:window.localStorage.getItem('sb-production-auth-token'),overflow:document.documentElement.scrollWidth>innerWidth+1,controls:['afKey','aiKeyInput'].some(id=>$(id)?.matches('input,button,select'))};
 });
 assert.match(r.scores,/Harbor Athletic/);assert.match(r.filtered,/No predictions/);assert.match(r.text,/64.0%/);assert.equal(r.prob,.64);assert.ok(r.visible);assert.equal(r.blocked,4);assert.equal(r.user,null);assert.equal(r.controls,false);assert.match(r.bar,/REAL DATA.*READ-ONLY/);assert.match(r.account,/guest/);assert.equal(r.storage,'production-state-sentinel');assert.equal(r.auth,'production-auth-sentinel');assert.equal(r.overflow,false);
 for(const n of network)if(n.url.includes('.supabase.co')){assert.ok(n.url.includes('rdcbnvfnxenrpnnwxszs'));assert.equal(n.method,'POST');assert.match(n.url,/mm_preview_(display|status)_v1$/);}
});
test('real service worker preserves other applications caches and synthetic builder stays independent',()=>{
 const sw=readFileSync(join(dir,'sw.js'),'utf8');assert.match(sw,/startsWith\('mm-real-preview-'\)/);assert.doesNotMatch(sw,/filter\(k=>k!==CACHE\)/);assert.match(R('staging/build-preview.mjs'),/synthetic data/);
 assert.doesNotMatch(html,/toqfdrcjzwnlydqekude|sb_secret_|service_role/);
});
