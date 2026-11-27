// Actual exact-capture patched handler; durable RPC and Auth SDK doubles. No host network.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';import {createHash} from 'node:crypto';
import {applyPatch} from '../backend/ai-generation/build-candidate.mjs';import {buildCandidate,V2_SHA256,normalizeCapture} from '../backend/account-deletion/build-candidate.mjs';import {deleteAccountRequest} from '../backend/account-deletion/deletion-service.mjs';import {createPasswordVerifier} from '../backend/account-deletion/password-verification.mjs';
const input=new URL('../../mm07-evidence/delete-account-v2-index.ts',import.meta.url),raw=readFileSync(input);assert.equal(createHash('sha256').update(raw).digest('hex'),V2_SHA256);
const code=stripTypeScriptTypes(applyPatch(normalizeCapture(raw.toString()),readFileSync(new URL('../backend/account-deletion/delete-account-v2-checked-cleanup.patch',import.meta.url),'utf8').replaceAll('\r\n','\n')).replace(/^import .*;\r?\n/gm,''));
const PASSWORD='synthetic-only-password';
const A='11111111-2222-4333-8444-555555555555',B='21111111-2222-4333-8444-555555555555',JOB='31111111-2222-4333-8444-555555555555',TOKEN='41111111-2222-4333-8444-555555555555';
function fixture(journal={state:'none',alive:true}){
 const calls=[],passwordCalls=[],passwordSignouts=[],passwordClients=[],clientConfigs=[],options={fail:null,mode:'error',prepare:null,authFail:null,finishBlocked:false,passwordMode:null,noAnon:false,signOutFailure:false};let handler;
 const admin={auth:{getUser:async()=>({error:null,data:{user:{id:A,email:'verified@example.invalid'}}}),admin:{deleteUser:async uid=>{calls.push({kind:'auth_delete',uid});if(options.authFail==='throw')throw Error('RAW PRIVATE');if(options.authFail==='wrong')return{error:null,data:{user:{id:B}}};if(options.authFail)return{error:{message:'RAW PRIVATE'}};journal.alive=false;return{error:null,data:{user:{id:uid}}};}}},rpc:async(name,args)=>{
  calls.push({kind:'rpc',name,args});const stage=name.split('_')[2];if(options.fail===stage){if(options.mode==='throw')throw Error('RAW PRIVATE');if(options.mode==='missing')return undefined;if(options.mode==='malformed')return{error:null,data:{}};return{error:{message:'RAW PRIVATE'}};}
  let data;
  if(stage==='prepare'){
   if(options.prepare)data=options.prepare;
   else if(journal.state==='none'){journal.state='requested';data={status:'reserved',job_id:JOB,lease_token:TOKEN};}
   else data={status:journal.state==='requested'||journal.state==='cleaned'?'busy':'auth_unconfirmed',job_id:JOB};
  }else if(stage==='cleanup'){journal.state='cleaned';data={ok:true,status:'cleaned'};}
  else if(stage==='mark'){journal.state='auth_dispatched';data={ok:true,status:'auth_dispatched'};}
  else if(stage==='finish'){
   if(args.outcome==='complete'&&!journal.alive&&!options.finishBlocked){journal.state='completed';data={ok:true,status:'completed'};}
   else{journal.state='auth_unconfirmed';data={ok:false,reason:'verification_required'};}
  }else throw Error('Unexpected synthetic RPC');return{error:null,data};
 },from(){throw Error('Nontransactional table cleanup is forbidden in durable handler');}};
 const createClient=(url,key,config)=>{
  if(!config)return admin;
  clientConfigs.push({url,key,config});const client={auth:{signInWithPassword:async credentials=>{
   passwordCalls.push({credentials,mutationsBeforeVerification:calls.length});
   if(options.passwordMode==='throw')throw Error('RAW PRIVATE '+PASSWORD);
   if(options.passwordMode==='invalid')return{error:{code:'invalid_credentials',message:'RAW '+PASSWORD},data:{user:null}};
   if(options.passwordMode==='other')return{error:{code:'over_request_rate_limit',message:'RAW '+PASSWORD}};
   if(options.passwordMode==='missing')return undefined;
   if(options.passwordMode==='malformed')return{data:{user:{id:A}}};
   return{error:null,data:{user:{id:options.passwordMode==='wrong_uid'?B:A},session:{access_token:'isolated-only'}}};
  },signOut:async value=>{passwordSignouts.push({client,value});if(options.signOutFailure)throw Error('RAW cleanup');return{error:null};}}};passwordClients.push(client);return client;
 };
 vm.runInNewContext(code,{createClient,deleteAccountRequest,createPasswordVerifier,Deno:{env:{get:key=>key==='SUPABASE_ANON_KEY'&&options.noAnon?'':key==='SUPABASE_URL'?'https://synthetic.invalid':'synthetic-only'},serve:f=>handler=f},Response,console:{log(){},error(){}},fetch(){throw Error('NETWORK FORBIDDEN');}});
 return{calls,passwordCalls,passwordSignouts,passwordClients,clientConfigs,options,journal,admin,async request({method='POST',body={confirmation:'DELETE',password:PASSWORD},authorization='Bearer synthetic',rawBody}={}){const req=new Request('https://synthetic.invalid/delete-account',{method,headers:{authorization},...(['GET','HEAD','OPTIONS'].includes(method)?{}:{body:rawBody??JSON.stringify(body)})});const r=await handler(req);return{status:r.status,allowMethods:r.headers.get('access-control-allow-methods'),body:r.headers.get('content-type')?.includes('json')?await r.json():await r.text()};}};
}
for(const stage of ['prepare','cleanup','mark'])for(const mode of ['error','throw','missing','malformed'])test(stage+' '+mode+' never dispatches Auth deletion',async()=>{const h=fixture();h.options.fail=stage;h.options.mode=mode;const r=await h.request();assert.equal(r.body.ok,false);assert.ok(r.status>=400);assert.equal(h.calls.filter(c=>c.kind==='auth_delete').length,0);assert.doesNotMatch(JSON.stringify(r.body),/RAW|PRIVATE|Nothing else was lost|account was not deleted/);});
for(const authFail of ['error','throw','wrong'])test('Auth '+authFail+' retains recovery state, never reports success',async()=>{const h=fixture();h.options.authFail=authFail;const r=await h.request();assert.equal(r.body.state,'auth_unconfirmed');assert.equal(r.body.auth_delete,'unconfirmed');assert.equal(h.journal.state,'auth_unconfirmed');assert.equal(h.calls.at(-1).args.outcome,'auth_unconfirmed');assert.doesNotMatch(JSON.stringify(r.body),/RAW|PRIVATE/);});
test('self-only deletion commits admission/cleanup/dispatch before Auth and verifies afterwards',async()=>{const h=fixture(),r=await h.request({body:{confirmation:'DELETE',password:PASSWORD,user_id:B,email:'attacker@example.invalid'}});assert.equal(r.body.ok,true);assert.equal(r.body.state,'completed');assert.equal(r.body.version,3);assert.deepEqual(h.calls.map(c=>c.kind==='rpc'?c.name:c.kind),['mm_deletion_prepare_v1','mm_deletion_cleanup_v1','mm_deletion_mark_auth_v1','auth_delete','mm_deletion_finish_v1']);assert.equal(h.calls[0].args.user_id,A);assert.equal(h.calls[3].uid,A);assert.equal(r.body.retained.local_device_copies,true);assert.equal(r.body.retained.private_recovery_record,true);assert.doesNotMatch(JSON.stringify(r.body),new RegExp(TOKEN));});
for(const status of ['busy','auth_unconfirmed','completed','unknown'])test(status+' admission cannot automatically repeat Auth deletion',async()=>{const h=fixture();h.options.prepare={status,job_id:JOB};const r=await h.request();assert.equal(r.body.ok,false);assert.equal(h.calls.filter(c=>c.kind==='auth_delete').length,0);});
test('malformed reservation token fails closed',async()=>{const h=fixture();h.options.prepare={status:'reserved',job_id:JOB,lease_token:'wrong'};assert.equal((await h.request()).body.ok,false);assert.equal(h.calls.length,1);});
test('database verification failure after Auth acknowledgement does not claim completion',async()=>{const h=fixture();h.options.finishBlocked=true;const r=await h.request();assert.equal(r.body.ok,false);assert.equal(r.body.auth_delete,'acknowledged');assert.equal(r.body.stage,'verification');});
test('unconfirmed external outcome survives process replacement without automatic repeat',async()=>{const h=fixture();h.options.authFail='throw';await h.request();const restarted=fixture(h.journal);await restarted.request();assert.equal(restarted.calls.filter(c=>c.kind==='auth_delete').length,0);});
test('concurrent requests have one reservation owner and one external deletion',async()=>{const h=fixture();const responses=await Promise.all([h.request(),h.request()]);assert.equal(responses.filter(r=>r.body.ok).length,1);assert.equal(h.calls.filter(c=>c.kind==='auth_delete').length,1);});
for(const method of ['PUT','DELETE','PATCH'])test(method+' rejected before identity or persistence',async()=>{const h=fixture();assert.equal((await h.request({method})).status,405);assert.equal(h.calls.length,0);});
test('OPTIONS remains free and permits the cross-origin GET capability probe',async()=>{const h=fixture();const r=await h.request({method:'OPTIONS'});assert.equal(r.status,200);assert.match(r.allowMethods,/(?:^|, )GET(?:,|$)/);assert.equal(h.calls.length,0);assert.equal(h.passwordClients.length,0);});

test('GET capability probe is static, password-free and does not verify identity or mutate state',async()=>{
 const h=fixture();h.admin.auth.getUser=async()=>{throw Error('Identity must not be read');};const r=await h.request({method:'GET',authorization:''});
 assert.equal(r.status,200);assert.equal(r.body.version,3);assert.equal(r.body.ok,true);assert.equal(r.body.protocol,'matchmind-account-deletion/1');assert.deepEqual(r.body.capabilities,{password_required:true,confirmation:'DELETE',mode:'immediate'});assert.equal(h.calls.length,0);assert.equal(h.passwordClients.length,0);
});
test('legacy confirm field cannot substitute for the versioned confirmation field',async()=>{
 const h=fixture(),r=await h.request({body:{confirm:'DELETE',password:PASSWORD}});assert.equal(r.status,400);assert.equal(r.body.state,'rejected');assert.equal(r.body.stage,'confirmation');assert.equal(h.passwordCalls.length,0);assert.equal(h.calls.length,0);
});
for(const password of [undefined,'',null,4,'x'.repeat(1025)])test('missing/invalid password is rejected before password SDK or journal activity',async()=>{
 const h=fixture(),r=await h.request({body:{confirmation:'DELETE',password}});assert.equal(r.status,400);assert.equal(r.body.state,'rejected');assert.equal(r.body.stage,'confirmation');assert.equal(r.body.auth_delete,'not_attempted');assert.equal(h.passwordCalls.length,0);assert.equal(h.calls.length,0);
});
test('wrong password has a known safe verification failure and no journal mutation',async()=>{
 const h=fixture();h.options.passwordMode='invalid';const r=await h.request();assert.equal(r.status,403);assert.equal(r.body.state,'verification_failed');assert.equal(r.body.stage,'password');assert.equal(r.body.auth_delete,'not_attempted');assert.equal(h.calls.length,0);assert.equal(h.passwordCalls.length,1);assert.equal(h.passwordCalls[0].mutationsBeforeVerification,0);assert.doesNotMatch(JSON.stringify(r.body),/RAW|synthetic-only-password/);
});
for(const mode of ['wrong_uid','other','throw','missing','malformed'])test(mode+' password verification is unavailable, never a safe wrong-password claim',async()=>{
 const h=fixture();h.options.passwordMode=mode;const r=await h.request();assert.equal(r.status,503);assert.equal(r.body.state,'verification_unavailable');assert.equal(r.body.stage,'password');assert.equal(r.body.auth_delete,'not_attempted');assert.equal(h.calls.length,0);assert.doesNotMatch(JSON.stringify(r.body),/RAW|synthetic-only-password/);
});
test('missing anon configuration cannot skip password verification',async()=>{
 const h=fixture();h.options.noAnon=true;const r=await h.request();assert.equal(r.status,503);assert.equal(r.body.state,'verification_unavailable');assert.equal(r.body.stage,'password');assert.equal(h.passwordClients.length,0);assert.equal(h.calls.length,0);
});
test('missing verification callback fails closed before lifecycle admission',async()=>{
 const h=fixture();const req=new Request('https://synthetic.invalid/delete-account',{method:'POST',headers:{authorization:'Bearer synthetic'},body:JSON.stringify({confirmation:'DELETE',password:PASSWORD})});const r=await deleteAccountRequest({admin:h.admin,req});assert.equal(r.status,503);assert.equal(r.body.state,'verification_unavailable');assert.equal(r.body.stage,'password');assert.equal(h.calls.length,0);
});
test('a verified caller without server email cannot substitute a body email for password authentication',async()=>{
 const h=fixture();h.admin.auth.getUser=async()=>({error:null,data:{user:{id:A}}});const r=await h.request({body:{confirmation:'DELETE',password:PASSWORD,email:'attacker@example.invalid'}});assert.equal(r.status,503);assert.equal(r.body.state,'verification_unavailable');assert.equal(h.passwordClients.length,0);assert.equal(h.calls.length,0);
});
test('verification callback cannot authorize a different user even if it reports verified',async()=>{
 const h=fixture(),req=new Request('https://synthetic.invalid/delete-account',{method:'POST',headers:{authorization:'Bearer synthetic'},body:JSON.stringify({confirmation:'DELETE',password:PASSWORD})});const r=await deleteAccountRequest({admin:h.admin,req,verifyPassword:async()=>({verified:true,user_id:B})});assert.equal(r.status,503);assert.equal(r.body.state,'verification_unavailable');assert.equal(h.calls.length,0);
});
test('fresh isolated verification uses only verified email and preserves exact password bytes',async()=>{
 const h=fixture(),password=' synthetic password with spaces ';const r=await h.request({body:{confirmation:'DELETE',password,email:'attacker@example.invalid',user_id:B}});assert.equal(r.body.ok,true);assert.equal(h.passwordCalls[0].credentials.email,'verified@example.invalid');assert.equal(h.passwordCalls[0].credentials.password,password);assert.equal(h.passwordCalls[0].mutationsBeforeVerification,0);
 assert.deepEqual(h.clientConfigs[0].config,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});assert.equal(h.passwordSignouts.length,1);assert.deepEqual(h.passwordSignouts[0].value,{scope:'local'});assert.equal(h.passwordSignouts[0].client,h.passwordClients[0]);assert.notEqual(h.passwordClients[0],h.admin);assert.doesNotMatch(JSON.stringify(r.body),/synthetic password|isolated-only/);assert.equal(JSON.stringify(h.calls).includes(password),false);
});
test('each verification attempt gets its own client and only its local session is cleaned',async()=>{
 const h=fixture();h.options.passwordMode='invalid';assert.equal((await h.request()).status,403);h.options.passwordMode=null;assert.equal((await h.request()).body.ok,true);assert.equal(h.passwordClients.length,2);assert.notEqual(h.passwordClients[0],h.passwordClients[1]);assert.equal(h.passwordSignouts.length,2);assert.ok(h.passwordSignouts.every(x=>x.value.scope==='local'));assert.ok(h.passwordClients.every(x=>x!==h.admin));
});
test('temporary verification cleanup failure does not mutate another session or disclose credentials',async()=>{
 const h=fixture();h.options.signOutFailure=true;const r=await h.request();assert.equal(r.body.ok,true);assert.equal(h.passwordSignouts.length,1);assert.equal(h.passwordSignouts[0].value.scope,'local');assert.doesNotMatch(JSON.stringify(r.body),/RAW|synthetic-only-password|isolated-only/);
});
for(const opts of [{authorization:''},{body:{}},{rawBody:'not JSON'},{rawBody:JSON.stringify({confirmation:'DELETE',password:PASSWORD,padding:'x'.repeat(5000)})}])test('invalid confirmation/auth sends no mutation',async()=>{const h=fixture();assert.equal((await h.request(opts)).body.ok,false);assert.equal(h.calls.length,0);});
test('exact-source builder supports URLs and rejects changed baseline bytes',async()=>{const output=new URL('../../mm07-evidence/root-durable-build/index.ts',import.meta.url);const result=await buildCandidate(input,output);assert.equal(result.baseline_sha256,V2_SHA256);const bad=new URL('../../mm07-evidence/root-durable-build/tampered.ts',import.meta.url);writeFileSync(bad,Buffer.concat([raw,Buffer.from('//tampered')]));await assert.rejects(buildCandidate(bad,output),/hash mismatch/);await assert.rejects(buildCandidate(input,input),/overwrite/);});
