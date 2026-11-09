// Read-only deployed-staging QA. Does not contain privileged credentials or send provider requests.
import {chromium,webkit} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export const STAGING_URL='https://matchmind-staging-358.pages.dev/';
export const STAGING_BACKEND='https://rdcbnvfnxenrpnnwxszs.supabase.co';
const site=new URL(STAGING_URL),api=new URL(STAGING_BACKEND);
const clean=v=>String(v).replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[REDACTED-KEY]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED-JWT]').slice(0,3000);
export function requestDecision(url,method,body){
 let u;try{u=new URL(url);}catch{return false;}
 if(u.origin===site.origin)return ['GET','HEAD'].includes(method)&&['/','/index.html','/sw.js','/manifest.webmanifest','/icon-192.png','/icon-512.png','/BUILD-INFO.json'].includes(u.pathname);
 if(['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))return method==='GET';
 if(u.hostname==='cdn.jsdelivr.net'&&method==='GET')return /^\/npm\/@supabase\/supabase-js@2(?:\.[0-9]+){0,2}(?:\/dist\/umd\/supabase\.js)?$/.test(u.pathname);
 if(u.origin!==api.origin)return false;
 // Existing UI reads only this non-reconstructive derived competition summary.
 if(u.pathname==='/rest/v1/competition_measures'&&method==='GET'){const fields=(u.searchParams.get('select')||'').split(',').sort().join(',');return [...u.searchParams.keys()].every(k=>k==='select')&&fields==='build,computed_at,data_size,gate,lid,skill';}
 const rpc=u.pathname.match(/^\/rest\/v1\/rpc\/(matchmind_display_v1|matchmind_fixture_access_v1)$/);if(!rpc)return false;
 if(method==='OPTIONS')return true;if(method!=='POST')return false;
 let args;try{args=JSON.parse(body||'{}');}catch{return false;}
 if(!args||typeof args!=='object'||Array.isArray(args))return false;
 return rpc[1]==='matchmind_fixture_access_v1'?Object.keys(args).length===0:Object.keys(args).length===1&&Object.hasOwn(args,'screen')&&['scores','predictions','history','records','slips'].includes(args.screen);
}
export async function createHarness({role,browserType='chromium',contextOptions={},serviceWorkers='block'}={}){
 if(!/^[a-z0-9-]+$/i.test(role||''))throw Error('A safe unique QA role is required');
 if(process.env.STAGING_URL&&process.env.STAGING_URL!==STAGING_URL)throw Error('Only the approved Cloudflare staging URL is permitted');
 const dir=process.env.EVIDENCE_DIR||'qa-evidence';await mkdir(dir,{recursive:true});
 const report={role,browserType,startedAt:new Date().toISOString(),url:STAGING_URL,emulationOnly:true,checks:[],consoleErrors:[],pageErrors:[],requests:[],responses:[],blocked:[],contextOptions,serviceWorkers};
 const engine=browserType==='webkit'?webkit:chromium;
 const browser=await engine.launch(browserType==='chromium'?{headless:true,...(process.env.MM_TEST_CHROMIUM?{executablePath:process.env.MM_TEST_CHROMIUM}:{}),args:['--no-sandbox','--disable-background-networking','--disable-sync']}:{headless:true});
 report.browserVersion=browser.version();const context=await browser.newContext({...contextOptions,serviceWorkers});
 context.on('request',r=>{const u=new URL(r.url());report.requests.push({method:r.method(),host:u.hostname,path:u.pathname,worker:typeof r.serviceWorker==='function'&&!!r.serviceWorker()});});
 context.on('response',r=>{const u=new URL(r.url());report.responses.push({status:r.status(),host:u.hostname,path:u.pathname});if(u.hostname!==site.hostname&&u.hostname!==api.hostname&&!['cdn.jsdelivr.net','fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))report.checks.push({name:'forbidden host returned an HTTP response',status:'FAIL',details:{host:u.hostname,path:u.pathname}});});
 await context.route('**/*',async route=>{const r=route.request();if(requestDecision(r.url(),r.method(),r.postData()))return route.continue();const u=new URL(r.url());report.blocked.push({method:r.method(),host:u.hostname,path:u.pathname});return route.abort('blockedbyclient');});
 const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(clean(e.message)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(clean(m.text()));});
 const h={browser,context,page,report};
 h.record=(name,status,details={})=>{if(!['PASS','FAIL','BLOCKED'].includes(status))throw Error('Invalid evidence status');report.checks.push({name,status,details});};
 h.screenshot=async name=>{const path=join(dir,role+'-'+String(name).replace(/[^a-z0-9-]/gi,'-')+'.png');await page.screenshot({path,fullPage:true,timeout:15000});return path;};
 h.check=async(name,fn)=>{try{const detail=await fn();h.record(name,'PASS',detail&&typeof detail==='object'?detail:{});return true;}catch(e){let screenshot=null;try{screenshot=await h.screenshot('failure-'+report.checks.length);}catch{}h.record(name,'FAIL',{error:clean(e.stack||e.message),screenshot});return false;}};
 h.goto=async()=>{const response=await page.goto(STAGING_URL,{waitUntil:'domcontentloaded',timeout:60000});report.httpStatus=response?.status();if(!response||!response.ok())throw Error('Staging document HTTP '+response?.status());report.documentSha256=createHash('sha256').update(await response.body()).digest('hex');await page.waitForFunction(()=>typeof APP_BUILD!=='undefined',null,{timeout:15000});report.binding=await page.evaluate(()=>({build:APP_BUILD,backend:SUPA_URL,title:document.title}));if(report.binding.backend!==STAGING_BACKEND||report.binding.build!==358)throw Error('Deployed build/backend identity does not match approved staging');await page.waitForTimeout(1200);return report.binding;};
 h.edition=async(screen='scores')=>{
  if(!['scores','predictions','history','records','slips'].includes(screen))throw Error('Unsupported read-only screen');
  const observedAt=new Date().toISOString();let value;
  try{value=await page.evaluate(async({backend,screen})=>{if(SUPA_URL!==backend)throw Error('Wrong backend');const r=await fetch(backend+'/rest/v1/rpc/matchmind_display_v1',{method:'POST',headers:{apikey:SUPA_KEY,authorization:'Bearer '+SUPA_KEY,'content-type':'application/json'},body:JSON.stringify({screen})});return{http:r.status,data:await r.json()};},{backend:STAGING_BACKEND,screen});}catch(e){return{valid:false,reason:'UNAVAILABLE',data:null,observedAt,error:clean(e.message)};}
  const data=value.data,from=Date.parse(data?.as_of),until=Date.parse(data?.expires_at),now=Date.now();
  const result={valid:false,reason:'UNAVAILABLE',data:data?.version==='matchmind-display/1'?data:null,asOf:data?.as_of||null,expiresAt:data?.expires_at||null,observedAt,http:value.http};
  if(value.http<200||value.http>=300){result.reason='UNAVAILABLE';result.serverMessage=clean(data?.message||data?.error||'HTTP '+value.http);}
  else if(data?.version!=='matchmind-display/1'||!Number.isFinite(from)||!Number.isFinite(until)||until<=from||until-from>86400000||from>now+30000)result.reason='INVALID';
  else if(until<=now)result.reason='EXPIRED';else{result.valid=true;result.reason=null;}
  report.editions??=[];report.editions.push({screen,valid:result.valid,reason:result.reason,asOf:result.asOf,expiresAt:result.expiresAt,observedAt,http:value.http,editionId:data?.edition_id||null,cards:Array.isArray(data?.cards)?data.cards.length:null});return result;
 };
 h.finish=async()=>{report.finishedAt=new Date().toISOString();report.counts=Object.fromEntries(['PASS','FAIL','BLOCKED'].map(s=>[s,report.checks.filter(c=>c.status===s).length]));await writeFile(join(dir,role+'-report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();return report;};
 return h;
}
