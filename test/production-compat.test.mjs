// Production compatibility variant (release/production-compat/build.mjs). Synthetic browser only:
// every network route is aborted and the Supabase SDK is a local recording stub.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {compatTransform, MARKER} from '../release/production-compat/build.mjs';
const chromium=createRequire(import.meta.url)('playwright-core').chromium;
const DEV=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const COMPAT=compatTransform(DEV);
const RAW=['fixtures','fixtures_lean','competitions','predictions','daily_slips','odds_snapshots','odds_latest','shared_records','predictions_retired'];
async function boot(t,html){
 const executablePath=process.env.MM_TEST_CHROMIUM;assert.ok(executablePath&&existsSync(executablePath),'local offline Chromium required');
 const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
 await context.addInitScript(()=>{
  window.compatLog={from:[],rpc:[],writes:[]};
  const rows={fixtures:[{fxid:990001,lid:39,lname:'Synthetic League',lcountry:'Nowhere',date:'2099-01-01',time:'12:00',status:'NS',home:'Synthetic Home',away:'Synthetic Away',gh:null,ga:null,ft_h:null,ft_a:null,provider:'af'}]};
  const q=(table)=>{const r={data:rows[table]||[],error:null,count:0};const o={then:(ok,bad)=>Promise.resolve(r).then(ok,bad)};
   for(const n of ['select','eq','neq','in','gte','gt','lte','lt','order','range','limit','is','not','contains','single','maybeSingle'])o[n]=()=>o;
   for(const n of ['insert','upsert','update','delete'])o[n]=()=>{compatLog.writes.push(table+':'+n);return o;};return o;};
  const client={from:t=>{compatLog.from.push(String(t));return q(String(t));},rpc:async n=>{compatLog.rpc.push(n);return{data:null,error:{code:'PGRST202',message:'function not found'}};},
   auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),getUser:async()=>({data:{user:null},error:null})},
   channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){} ,functions:{invoke:async()=>({data:null,error:{message:'offline'}})}};
  Object.defineProperty(window,'supabase',{value:{createClient:()=>client},writable:false,configurable:false});
 });
 await context.route('**/*',r=>r.request().url()==='http://compat.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const page=await context.newPage();await page.goto('http://compat.test/');
 await page.waitForFunction(()=>typeof supa!=='undefined'&&!!supa,null,{timeout:15000});
 return page;
}
test('builder refuses non-production and staging inputs and changes only the delivery functions',()=>{
 assert.throws(()=>compatTransform(DEV.replace('toqfdrcjzwnlydqekude.supabase.co','rdcbnvfnxenrpnnwxszs.supabase.co')),/not the production project/);
 assert.throws(()=>compatTransform(DEV.replace('<head>','<head><script id="stagingGuard"></script>')),/staging/);
 assert.ok(COMPAT.includes(`const MM_FIXTURE_DELIVERY='${MARKER}';`));
 assert.ok(!COMPAT.includes('matchmind_fixture_access_v1'));
 assert.equal(DEV.includes('\r\n'),COMPAT.includes('\r\n'),'line endings preserved');
 const strip=s=>s.slice(0,s.indexOf('function fixtureRawCurrent(){'))+s.slice(s.indexOf('function fixtureText('));
 assert.equal(strip(COMPAT).replace("async function fixtureDisplayLoad(screen){throw Error('Bounded display is not installed on this backend');",'async function fixtureDisplayLoad(screen){'),strip(DEV),'nothing outside the delivery gate differs');
});
test('compat variant reads the Build 355 tables directly and never calls the bounded RPCs',async t=>{
 const page=await boot(t,COMPAT);
 const got=await page.evaluate(async()=>{
  const fx=await fetchAllRows('fixtures','fxid,date',q=>q.gte('date','2099-01-01'));
  const r=await fixtureTable('daily_slips').select('day,tier,odds,build,step,legs').eq('day','2099-01-01');
  return {delivery:MM_FIXTURE_DELIVERY,raw:fixtureRawCurrent(),fx:JSON.stringify(fx).includes('990001'),slipErr:r.error,log:compatLog};
 });
 assert.equal(got.delivery,'direct-355-compat');assert.equal(got.raw,true);
 assert.ok(got.fx,'direct fixtures rows reach the consumer');
 assert.equal(got.slipErr,null);
 assert.ok(got.log.from.includes('fixtures')&&got.log.from.includes('daily_slips'));
 assert.deepEqual(got.log.rpc.filter(n=>/^matchmind_/.test(n)),[],'no bounded RPC is attempted');
});
test('development index.html keeps its bounded boundary: absent RPC yields no raw table reads',async t=>{
 const page=await boot(t,DEV);
 const got=await page.evaluate(async()=>{compatLog.from.length=0;
  try{await fetchAllRows('fixtures','*',q=>q.range(0,999999));}catch{}
  try{await fixtureTable('fixtures').select('*');}catch{}
  return {raw:fixtureRawCurrent(),log:compatLog,hasMarker:typeof MM_FIXTURE_DELIVERY!=='undefined'};});
 assert.equal(got.raw,false);assert.equal(got.hasMarker,false);
 assert.deepEqual(got.log.from.filter(x=>RAW.includes(x)),[],'dev client must not fall back to direct reads');
 assert.ok(got.log.rpc.includes('matchmind_fixture_access_v1'));
});
