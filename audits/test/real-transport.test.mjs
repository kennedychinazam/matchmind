// Real-transport integration. Synthetic injected clients only: nothing in this
// file opens a socket, reads an environment variable or names a real credential.
// The real path is proven unreachable rather than mocked around.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {inspect} from 'node:util';
import {generateKeyPairSync,sign as signRaw} from 'node:crypto';
import {spawn} from 'node:child_process';

const moduleUrl=new URL('../source-provenance/real-transport.mjs',import.meta.url);
const api=await import('../source-provenance/real-transport.mjs');
const transport=await import('../source-provenance/transport.mjs');
const adapter=await import('../source-provenance/provider-adapter.mjs');
const latch=await import('../source-provenance/attempt-latch.mjs');
const retention=await import('../source-provenance/retention.mjs');
const {canonicalJSON}=await import('../lib/snapshot-contract.mjs');
const {LIMITS}=await import('../a4/bounds.mjs');

const posix=process.platform!=='win32';
const root=()=>mkdtempSync(join(tmpdir(),'mm-real-transport-'));
const PLAN=adapter.pilotPlan().plan_hash;
const WINDOW={authorized_from_utc:'2026-11-01T00:00:00Z',authorized_until_utc:'2026-11-12T00:00:00Z'};
const NOW='2026-11-01T12:00:00Z';
const CLOCK=()=>'2026-11-01T12:00:00Z';
const SECRET='synthetic-not-a-real-apisports-key-0001';
const ids=[788036,788048,788038];

const fixture=(id,i)=>({fixture:{id,date:'2021-10-26T18:45:00Z',status:{short:['FT','AET','PEN'][i],long:'Synthetic finished status',elapsed:120,extra:null}},league:{id:81,name:'Synthetic Cup',country:'Synthetic Country',season:2021},teams:{home:{id:10+i*2,name:'Home '+i},away:{id:11+i*2,name:'Away '+i}},goals:{home:i+1,away:i},score:{halftime:{home:0,away:0},fulltime:{home:i+1,away:i},extratime:{home:null,away:null},penalty:{home:null,away:null}}});
const body=()=>Buffer.from(JSON.stringify({get:'fixtures',parameters:{ids:'788036-788048-788038'},errors:[],results:3,paging:{current:1,total:1},response:ids.map(fixture)}));
const ok=(status=200,bytes=body(),extra={})=>({status,headers:{'content-type':'application/json; charset=utf-8'},body:bytes,body_complete:true,content_decoding:{mode:'none',encoding:'identity'},...extra});
const normalized=()=>ids.map((id,i)=>({fxid:id,lid:81,season:2021,date:'2021-10-26',time:'18:45',lname:'Synthetic Cup',lcountry:'Synthetic Country',home:'Home '+i,away:'Away '+i,status:'FINISHED',gh:i+1,ga:i,ht_h:0,ht_a:0,ft_h:i+1,ft_a:i,provider:'af'}));
const meta=()=>({request_id:'synthetic-real-rehearsal-001',collector_sha256:'a'.repeat(64)});
// The retention-registration inputs `registerRetention` requires. The preflight
// now requires them too, so a standalone check has to supply them.
const REG={storageId:'synthetic-private-volume',reviewers:['owner'],backups:[]};

const keys=()=>{const {publicKey,privateKey}=generateKeyPairSync('ed25519');return {pub:publicKey.export({type:'spki',format:'der'}).toString('base64'),priv:privateKey};};
const sign=(priv,statement)=>({statement,signature_base64:signRaw(null,Buffer.from(canonicalJSON(statement)),priv).toString('base64')});
const statement=(latchDir,storeDir,over={})=>transport.authorizationStatement({
 kind:'fixture',latch_directory:latchDir,storage_directory:storeDir,
 not_before_utc:'2026-11-01T11:00:00Z',not_after_utc:'2026-11-01T13:00:00Z',nonce:'a'.repeat(32),...over});
const openLatch=dir=>latch.createLatch(dir,{plan_hash:PLAN,...WINDOW});

// One place that builds a valid rehearsal, so each test varies exactly one thing.
function rig(over={}){
 const base=root(),latchDir=join(base,'latch'),store=join(base,'store');
 openLatch(latchDir);
 const {pub,priv}=keys();
 return {base,latchDir,store,pub,priv,
  run:(changes={})=>api.rehearsePilotExecution({
   publicKeyBase64:pub,simulated:true,kind:'fixture',
   latchDirectory:latchDir,storageDirectory:store,clock:CLOCK,
   metadata:meta(),credential:api.bindCredential({supply:()=>SECRET}),
   authorization:sign(priv,statement(latchDir,store)),
   storageId:'synthetic-private-volume',reviewers:['owner'],backups:[],
   client:async()=>ok(),
   ...over,...changes})};
}
// Every durable artefact a secret could reach.
function writtenEverything(latchDir,store){
 const files=[];
 for(const dir of [latchDir,store])if(existsSync(dir))for(const f of readdirSync(dir))files.push(readFileSync(join(dir,f)).toString('latin1'));
 return files.join('\n')+'\n'+JSON.stringify(latch.readLatch(latchDir).records);
}

test('the real path is unreachable, ships no authority and cannot be handed its own boundaries',()=>{
 for(const name of ['bindCredential','collectBoundedBody','assertPermittedTarget','responseEchoesCredential','realHttpsClient','preflight','executeAuthorizedPilot','rehearsePilotExecution','grantsExecutionAuthority','realDispatchReachable'])
  assert.equal(typeof api[name],'function',name);
 assert.equal(api.grantsExecutionAuthority(),false);
 assert.equal(api.realDispatchReachable(),false);
 assert.equal(transport.installedDirectorKey(),null);
 // Synchronous, at the missing anchor, before a credential or an attempt.
 assert.throws(()=>api.executeAuthorizedPilot({kind:'fixture'}),/director_public_key_not_installed/);
 // And it refuses to accept the boundaries that make the rehearsal safe, by
 // name, so a caller who tried is told which argument was rejected.
 for(const k of ['client','verify','simulated','clock'])
  assert.throws(()=>api.executeAuthorizedPilot({[k]:()=>assert.fail('no call')}),/real_execution_boundaries_are_not_caller_supplied/,k);
 // A rehearsal cannot borrow the real client, and will not run unsimulated.
 assert.throws(()=>api.rehearsePilotExecution({publicKeyBase64:'x',simulated:true,client:api.realHttpsClient}),/real_client_forbidden_in_rehearsal/);
 assert.throws(()=>api.rehearsePilotExecution({publicKeyBase64:'x',simulated:false,client:()=>{}}),/simulated_rehearsal_required/);
 assert.throws(()=>api.rehearsePilotExecution({publicKeyBase64:'x',simulated:true,client:'nope'}),/injected_client_required/);
 assert.throws(()=>api.rehearsePilotExecution({publicKeyBase64:'',simulated:true,client:()=>{}}),/director_public_key_required/);
 // No module in this tree reads a secret from the environment.
 const source=readFileSync(new URL(moduleUrl),'utf8');
 assert.equal(/process\.env/.test(source),false);
 assert.equal(/\bfetch\s*\(/.test(source),false);
 assert.equal(/supabase/i.test(source),false);
});

test('the credential binding never exposes, stores or re-reads the value',()=>{
 let calls=0;
 const held=api.bindCredential({supply:()=>{calls++;return SECRET;}});
 assert.equal(calls,1,'supply is called once, at bind time');
 assert.equal(held.header_name,'x-apisports-key');
 assert.equal(held.state(),'bound');
 // Nothing that could display the holder shows the value.
 for(const text of [JSON.stringify(held),String(held),inspect(held),inspect({held},{depth:6})])
  assert.equal(text.includes(SECRET),false,text);
 assert.equal(Object.values(held).includes(SECRET),false);
 // The value reaches the consumer and nothing else, exactly once.
 let seen=null;
 assert.equal(held.use(s=>{seen=s;return 'done';}),'done');
 assert.equal(seen,SECRET);
 assert.equal(held.state(),'consumed');
 assert.throws(()=>held.use(()=>'again'),/credential_consumed/);
 assert.equal(calls,1,'supply is never called a second time');
 assert.throws(()=>{held.header_name='x';},/read only|not extensible|Cannot assign/);
 // Discarding without using leaves nothing behind.
 const unused=api.bindCredential({supply:()=>SECRET});
 unused.discard();
 assert.equal(unused.state(),'discarded');
 assert.throws(()=>unused.use(()=>1),/credential_discarded/);
});

test('an unusable or foreign credential is refused at bind, before anything is spent',t=>{
 if(!posix)return t.skip('POSIX only');
 for(const bad of ['','short','with space in it','x'.repeat(257),'\u0000'.repeat(20),'tab\there-padding-value'])
  assert.throws(()=>api.bindCredential({supply:()=>bad}),/credential_shape_invalid/,JSON.stringify(bad));
 for(const bad of [null,undefined,42,{},Buffer.from('a'.repeat(32))])
  assert.throws(()=>api.bindCredential({supply:()=>bad}),/credential_shape_invalid/,String(bad));
 // A key from the wrong provider must never be sent to API-Football.
 for(const foreign of ['sk-or-v1-0123456789abcdefghij','sk-proj-0123456789abcdefghij','eyJhbGciOiJIUzI1NiJ9.payload.sig','Bearer-0123456789abcdefghij'])
  assert.throws(()=>api.bindCredential({supply:()=>foreign}),/credential_shape_invalid/,foreign);
 assert.throws(()=>api.bindCredential({supply:()=>{throw Error('vault offline');}}),/credential_supply_failed/);
 for(const bad of [null,undefined,{},{supply:'nope'},{supply:()=>SECRET,extra:1}])
  assert.throws(()=>api.bindCredential(bad),/credential_supply_function_required/);
 // A bind refusal costs no attempt.
 const r=rig();
 assert.throws(()=>api.bindCredential({supply:()=>'short'}),/credential_shape_invalid/);
 assert.equal(latch.readLatch(r.latchDir).remaining.fixture,1);
});

test('a correctly authorized rehearsal captures, persists and registers in one pass',async t=>{
 if(!posix)return t.skip('POSIX only');
 const r=rig();
 let calls=0,seenRequest=null,seenSecret=null;
 const result=await r.run({client:async({request,secret})=>{
  calls++;seenRequest=request;seenSecret=secret;
  // The attempt is already spent at this point: a crash here must not refund.
  assert.equal(latch.readLatch(r.latchDir).remaining.fixture,0);
  return ok();
 }});
 assert.equal(calls,1,'exactly one dispatch');
 assert.equal(seenRequest.url,'https://v3.football.api-sports.io/fixtures?ids=788036-788048-788038');
 assert.deepEqual(seenRequest.header_names,['x-apisports-key']);
 assert.equal(seenSecret,SECRET);
 assert.equal(result.simulated,true);
 assert.equal(result.http_status,200);
 assert.equal(result.body_complete,true);
 assert.equal(result.credential_state,'consumed');
 assert.equal(result.source_review_admissible,false);
 assert.equal(result.grants_execution_authority,false);
 assert.equal(result.backups_verified,0);
 assert.equal(result.deletion_deadline_utc,'2026-11-10T12:00:00Z');
 assert.equal(result.lifecycle.stage,'registered');
 assert.equal(result.lifecycle.governed,true);
 assert.deepEqual(result.wire_header_names,['x-apisports-key','accept-encoding','host','connection']);
 // The evidence on disk is the registered evidence, hash for hash.
 const stored=adapter.readAdapterCapture(r.store);
 assert.equal(stored.manifest.capture_hash,result.capture_hash);
 assert.equal(stored.manifest.raw_sha256,result.raw_sha256);
 assert.deepEqual(stored.bytes,body());
 const governed=retention.assertRetainable(r.store,NOW);
 assert.equal(governed.retainable,true);
 assert.equal(adapter.analyzeCapture(stored,normalized()).source_review_admissible,false);
 assert.equal(adapter.analyzeCapture(stored,normalized()).inventory_complete,true);
 assert.equal(latch.readLatch(r.latchDir).outcomes[0].outcome.status,'response');
});

test('the credential reaches no record, no file and no error message',async t=>{
 if(!posix)return t.skip('POSIX only');
 const r=rig();
 const result=await r.run();
 const everything=writtenEverything(r.latchDir,r.store)+JSON.stringify(result)+inspect(result,{depth:8});
 assert.equal(everything.includes(SECRET),false);
 assert.equal(everything.includes('x-apisports-key: '),false);
 // Captured bytes hold the body and nothing about the request headers.
 assert.equal(readFileSync(join(r.store,'manifest.json'),'utf8').includes(SECRET),false);
 // A failing dispatch is the same: a fixed label, never the value.
 const b=rig();
 // The client is holding the credential when it fails, so its error text is the
 // one piece of text here that could carry a secret. It is dropped, not chained.
 await assert.rejects(()=>b.run({client:async()=>{throw Error('TLS handshake failed carrying '+SECRET);}}),error=>{
  assert.equal(error.message,'pilot_dispatch_failed');
  assert.equal(error.cause,null);
  assert.equal(error.transport_error,'withheld_may_contain_credential');
  assert.equal(inspect(error,{depth:8}).includes(SECRET),false);
  assert.equal(JSON.stringify(Object.getOwnPropertyNames(error).map(k=>String(error[k]))).includes(SECRET),false);
  return true;
 });
 assert.equal(writtenEverything(b.latchDir,b.store).includes(SECRET),false);
});

test('a provider that echoes the credential is refused and nothing is stored',async t=>{
 if(!posix)return t.skip('POSIX only');
 // In the body, in a safe header and base64 encoded: all three are caught.
 const echoes=[
  ()=>ok(200,Buffer.from(JSON.stringify({errors:{token:'key '+SECRET+' is invalid'}}))),
  ()=>ok(200,Buffer.from(Buffer.from(SECRET,'utf8').toString('base64'))),
  ()=>({...ok(),headers:{'content-type':'application/json','x-ratelimit-limit':'450',date:SECRET}})
 ];
 for(const make of echoes){
  const r=rig();
  await assert.rejects(()=>r.run({client:async()=>make()}),/credential_echoed_by_provider/);
  // The attempt is still spent, the response reached no record and no store exists.
  const state=latch.readLatch(r.latchDir);
  assert.equal(state.remaining.fixture,0);
  assert.equal(state.outcomes[0].outcome.reason,'credential_echoed_in_response');
  assert.equal(existsSync(r.store),false);
  assert.equal(writtenEverything(r.latchDir,r.store).includes(SECRET),false);
 }
 // The scanner itself, directly.
 assert.equal(api.responseEchoesCredential(ok(),SECRET),false);
 assert.equal(api.responseEchoesCredential({headers:{'set-cookie':['a='+SECRET]},body:Buffer.alloc(0)},SECRET),true);
 assert.equal(api.responseEchoesCredential({headers:{},body:null},SECRET),false);
});

test('a missing, unsigned, misscoped or expired authorization refuses before the ceiling',async t=>{
 if(!posix)return t.skip('POSIX only');
 const r=rig();
 const good=sign(r.priv,statement(r.latchDir,r.store));
 const cases=[
  [{authorization:undefined},/malformed_authorization/],
  [{authorization:{statement:good.statement}},/malformed_authorization/],
  [{authorization:{...good,signature_base64:'aaaa'}},/authorization_signature_invalid/],
  // Signed by somebody else.
  [{authorization:sign(keys().priv,statement(r.latchDir,r.store))},/authorization_signature_invalid/],
  // Signed correctly, tampered after.
  [{authorization:{...good,statement:{...good.statement,storage_directory:'/elsewhere'}}},/authorization_signature_invalid/],
  // Signed correctly over the wrong scope.
  [{authorization:sign(r.priv,statement(r.latchDir,'/other/store'))},/authorization_scope_mismatch/],
  [{authorization:sign(r.priv,statement('/other/latch',r.store))},/authorization_scope_mismatch/],
  [{authorization:sign(r.priv,statement(r.latchDir,r.store,{kind:'status'}))},/authorization_scope_mismatch/],
  // A field the verifier does not check must not travel inside something signed.
  [{authorization:sign(r.priv,{...good.statement,override_attempt_ceiling:true})},/authorization_statement_shape/],
  // Outside the signed window on both sides, and off the reviewed plan.
  [{clock:()=>'2026-11-01T10:00:00Z'},/authorization_not_yet_valid/],
  [{clock:()=>'2026-11-01T13:00:00Z'},/authorization_expired/],
  [{authorization:sign(r.priv,{...good.statement,plan_hash:'b'.repeat(64)})},/authorization_plan_mismatch/],
  [{authorization:sign(r.priv,{...good.statement,request_hash:'c'.repeat(64)})},/authorization_request_mismatch/],
  [{authorization:sign(r.priv,{...good.statement,transport_version:'other'})},/authorization_version_mismatch/]
 ];
 for(const [change,pattern]of cases){
  await assert.rejects(()=>r.run({...change,client:async()=>assert.fail('no dispatch')}),pattern,JSON.stringify(change));
  assert.equal(latch.readLatch(r.latchDir).remaining.fixture,1,'a refused authorization costs nothing');
 }
 // A standing permission is not an exact scope, and is refused at construction.
 assert.throws(()=>statement(r.latchDir,r.store,{not_after_utc:'2026-11-09T11:00:00Z'}),/authorization_window_too_long/);
 assert.equal(existsSync(r.store),false);
});

test('a self-issued authorization cannot stand in for a signed one',async t=>{
 if(!posix)return t.skip('POSIX only');
 const r=rig();
 // Shaped exactly right, signed by nobody that matters.
 const forged={statement:statement(r.latchDir,r.store),signature_base64:Buffer.alloc(64).toString('base64')};
 await assert.rejects(()=>r.run({authorization:forged,client:async()=>assert.fail('no dispatch')}),/authorization_signature_invalid/);
 // And a statement that simply asserts its own approval is still unsigned.
 await assert.rejects(()=>r.run({authorization:{statement:{...statement(r.latchDir,r.store)},signature_base64:''},client:async()=>assert.fail('no dispatch')}),/authorization_signature_invalid/);
 assert.equal(latch.readLatch(r.latchDir).remaining.fixture,1);
});

test('the permitted request inventory cannot be widened',()=>{
 const fixtureRequest=transport.buildRequest('fixture');
 const target=api.assertPermittedTarget(fixtureRequest);
 assert.equal(target.kind,'fixture');
 assert.equal(target.hostname,'v3.football.api-sports.io');
 assert.equal(target.port,443);
 assert.equal(target.path,'/fixtures?ids=788036-788048-788038');
 assert.equal(api.assertPermittedTarget(transport.buildRequest('status')).path,'/status');
 const bad=[
  {...fixtureRequest,url:'https://v3.football.api-sports.io/odds?ids=1'},
  {...fixtureRequest,url:'https://api-football-v1.p.rapidapi.com/fixtures?ids=788036-788048-788038'},
  {...fixtureRequest,url:'http://v3.football.api-sports.io/fixtures?ids=788036-788048-788038'},
  {...fixtureRequest,url:'https://v3.football.api-sports.io:8443/fixtures?ids=788036-788048-788038'},
  {...fixtureRequest,url:'https://user:pw@v3.football.api-sports.io/fixtures?ids=788036-788048-788038'},
  {...fixtureRequest,url:'https://v3.football.api-sports.io/fixtures?ids=788036-788048-788038#frag'},
  {...fixtureRequest,url:'https://v3.football.api-sports.io/fixtures?ids=999999'},
  {...fixtureRequest,url:'https://v3.football.api-sports.io/fixtures?league=39&season=2021'},
  null,{},{url:'not-a-url'}
 ];
 for(const request of bad)assert.throws(()=>api.assertPermittedTarget(request),/forbidden_request_target/,JSON.stringify(request?.url??request));
 // Shape, not just address: nothing may retry, follow or add a query.
 for(const shape of [{redirect:'follow'},{automatic_retries:1},{additional_queries:1},{max_attempts:2},{method:'POST'}])
  assert.throws(()=>api.assertPermittedTarget({...fixtureRequest,...shape}),/forbidden_request_target|forbidden_request_shape/,JSON.stringify(shape));
 // A third endpoint cannot even be named in a statement.
 assert.throws(()=>transport.authorizationStatement({kind:'odds',latch_directory:'/a',storage_directory:'/b',
  not_before_utc:'2026-11-01T11:00:00Z',not_after_utc:'2026-11-01T12:00:00Z',nonce:'a'.repeat(32)}),/unknown_request_kind/);
});

test('the real client cannot be driven from outside the authorized pipeline',()=>{
 const fixtureRequest=transport.buildRequest('fixture');
 // The exported client is the only function here that can open a socket. Called
 // directly it would bypass the authorization, the ceiling and the retention
 // policy together, so it refuses on a module-private token first and on the
 // missing anchor second. Neither is a flag an importer can set.
 assert.throws(()=>api.realHttpsClient({request:fixtureRequest,secret:SECRET}),/client_requires_authorized_pipeline/);
 for(const token of [true,'authorized_dispatch',Symbol('authorized_dispatch'),Symbol.for('authorized_dispatch'),null,{}])
  assert.throws(()=>api.realHttpsClient({request:fixtureRequest,secret:SECRET,token}),/client_requires_authorized_pipeline/,String(token));
 // A rehearsal cannot smuggle it in by wrapping the client either.
 assert.throws(()=>api.rehearsePilotExecution({publicKeyBase64:'x',simulated:true,client:api.realHttpsClient}),/real_client_forbidden_in_rehearsal/);
 // Even wrapped, the wrapper has no token to pass, so the call still refuses.
 assert.throws(()=>api.realHttpsClient({request:fixtureRequest,secret:SECRET,...{}}),/client_requires_authorized_pipeline/);
 // Target and argument checks sit behind the token, not in front of it.
 assert.throws(()=>api.realHttpsClient({request:{...fixtureRequest,url:'https://evil.example/fixtures'},secret:SECRET}),/client_requires_authorized_pipeline/);
 assert.throws(()=>api.realHttpsClient({request:fixtureRequest,secret:SECRET,timeoutMs:600000}),/client_requires_authorized_pipeline/);
 assert.throws(()=>api.realHttpsClient(),/client_requires_authorized_pipeline/);
});

test('one attempt only: a second dispatch is refused and a separate process agrees',async t=>{
 if(!posix)return t.skip('POSIX only');
 const r=rig();
 await r.run();
 assert.equal(latch.readLatch(r.latchDir).remaining.fixture,0);
 // Same process, fresh store: the ceiling is the latch, not the store.
 const second=join(r.base,'store-2');
 await assert.rejects(()=>r.run({storageDirectory:second,
  authorization:sign(r.priv,statement(r.latchDir,second)),client:async()=>assert.fail('no second dispatch')}),/fixture_attempt_exhausted/);
 assert.equal(existsSync(second),false);
 // The optional metadata attempt is capped on its own and never shared.
 assert.equal(latch.readLatch(r.latchDir).remaining.metadata,1);
 // A genuinely separate process sees the spent attempt and refuses.
 const script=`const api=await import(${JSON.stringify(moduleUrl.href)});
const t=await import(${JSON.stringify(new URL('../source-provenance/transport.mjs',import.meta.url).href)});
const {canonicalJSON}=await import(${JSON.stringify(new URL('../lib/snapshot-contract.mjs',import.meta.url).href)});
const {generateKeyPairSync,sign}=await import('node:crypto');
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const st=t.authorizationStatement({kind:'fixture',latch_directory:${JSON.stringify(r.latchDir)},storage_directory:${JSON.stringify(join(r.base,'store-3'))},
 not_before_utc:'2026-11-01T11:00:00Z',not_after_utc:'2026-11-01T13:00:00Z',nonce:'a'.repeat(32)});
const pre=api.preflight({kind:'fixture',latchDirectory:${JSON.stringify(r.latchDir)},storageDirectory:${JSON.stringify(join(r.base,'store-3'))},
 nowUtc:${JSON.stringify(NOW)},metadata:{request_id:'restart',collector_sha256:'a'.repeat(64)},
 storageId:'synthetic-private-volume',reviewers:['owner'],backups:[]});
try{
 await api.rehearsePilotExecution({publicKeyBase64:publicKey.export({type:'spki',format:'der'}).toString('base64'),simulated:true,
  kind:'fixture',latchDirectory:${JSON.stringify(r.latchDir)},storageDirectory:${JSON.stringify(join(r.base,'store-3'))},
  clock:()=>${JSON.stringify(NOW)},metadata:{request_id:'restart',collector_sha256:'a'.repeat(64)},
  credential:api.bindCredential({supply:()=>${JSON.stringify(SECRET)}}),
  authorization:{statement:st,signature_base64:sign(null,Buffer.from(canonicalJSON(st)),privateKey).toString('base64')},
  storageId:'synthetic-private-volume',reviewers:['owner'],backups:[],client:async()=>{process.stdout.write('DISPATCHED');return null;}});
 process.stdout.write('WON');
}catch(e){process.stdout.write('REFUSED:'+e.message+'|PRE:'+pre.refusals.join(','));}`;
 const out=await new Promise(resolve=>{
  const child=spawn(process.execPath,['--input-type=module','-e',script]);
  let acc='';child.stdout.on('data',d=>{acc+=d;});child.on('close',()=>resolve(acc));
 });
 assert.equal(out.includes('DISPATCHED'),false,out);
 assert.match(out,/^REFUSED:/,out);
 assert.match(out,/fixture_attempt_exhausted/,out);
});

test('two processes racing the same latch produce exactly one dispatch',async t=>{
 if(!posix)return t.skip('POSIX only');
 const r=rig();
 const barrier=Date.now()+1200;
 const script=i=>`const api=await import(${JSON.stringify(moduleUrl.href)});
const t=await import(${JSON.stringify(new URL('../source-provenance/transport.mjs',import.meta.url).href)});
const {canonicalJSON}=await import(${JSON.stringify(new URL('../lib/snapshot-contract.mjs',import.meta.url).href)});
const {generateKeyPairSync,sign}=await import('node:crypto');
const store=${JSON.stringify(r.base)}+'/race-'+${i};
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const st=t.authorizationStatement({kind:'fixture',latch_directory:${JSON.stringify(r.latchDir)},storage_directory:store,
 not_before_utc:'2026-11-01T11:00:00Z',not_after_utc:'2026-11-01T13:00:00Z',nonce:'a'.repeat(32)});
const bytes=Buffer.from('{"get":"fixtures"}');
while(Date.now()<${barrier});
try{
 await api.rehearsePilotExecution({publicKeyBase64:publicKey.export({type:'spki',format:'der'}).toString('base64'),simulated:true,
  kind:'fixture',latchDirectory:${JSON.stringify(r.latchDir)},storageDirectory:store,
  clock:()=>${JSON.stringify(NOW)},metadata:{request_id:'race-'+${i},collector_sha256:'a'.repeat(64)},
  credential:api.bindCredential({supply:()=>${JSON.stringify(SECRET)}}),
  authorization:{statement:st,signature_base64:sign(null,Buffer.from(canonicalJSON(st)),privateKey).toString('base64')},
  storageId:'synthetic-private-volume',reviewers:['owner'],backups:[],
  client:async()=>({status:200,headers:{'content-type':'application/json'},body:bytes,body_complete:true,content_decoding:{mode:'none',encoding:'identity'}})});
 process.stdout.write('WON');
}catch(e){process.stdout.write('REFUSED:'+e.message);}`;
 const run=i=>new Promise(resolve=>{
  const child=spawn(process.execPath,['--input-type=module','-e',script(i)]);
  let acc='';child.stdout.on('data',d=>{acc+=d;});child.on('close',()=>resolve(acc));
 });
 const results=await Promise.all([run(1),run(2)]);
 assert.equal(results.filter(x=>x==='WON').length,1,JSON.stringify(results));
 const refused=results.filter(x=>x.startsWith('REFUSED'));
 assert.equal(refused.length,1,JSON.stringify(results));
 assert.match(refused[0],/fixture_attempt_exhausted|concurrent_latch_append|preflight_refused/,refused[0]);
 const state=latch.readLatch(r.latchDir);
 assert.equal(state.remaining.fixture,0);
 assert.equal(state.reservations.length,1);
});

test('a network error is an ambiguous delivery: spent, recorded, never retried',async t=>{
 if(!posix)return t.skip('POSIX only');
 for(const thrower of [()=>{throw Error('ECONNRESET');},()=>{throw Error('dispatch_timeout');},async()=>{throw Error('socket hang up');}]){
  const r=rig();
  let calls=0;
  await assert.rejects(()=>r.run({client:async(...args)=>{calls++;return thrower(...args);}}),error=>{
   assert.equal(error.message,'pilot_dispatch_failed');
   assert.equal(error.delivery,'ambiguous');
   assert.equal(error.attempt_spent,true);
   return true;
  });
  assert.equal(calls,1,'one attempt, no retry');
  const state=latch.readLatch(r.latchDir);
  assert.equal(state.remaining.fixture,0,'an uncertain request may have reached the provider');
  assert.equal(state.outcomes[0].outcome.status,'failed');
  assert.equal(state.outcomes[0].outcome.reason,'dispatch_failed_delivery_ambiguous');
  assert.equal(existsSync(r.store),false);
 }
});

test('a redirect, an error body and a truncated body are captured, not followed',async t=>{
 if(!posix)return t.skip('POSIX only');
 const responses=[
  ok(302),
  ok(429,Buffer.from('{"errors":{"rateLimit":"too many requests"}}')),
  ok(200,body(),{body_complete:false}),
  {status:403,headers:{'content-type':'text/plain'},body:Buffer.from('denied'),body_complete:true,content_decoding:{mode:'none',encoding:'identity'}}
 ];
 for(const response of responses){
  const r=rig();
  let calls=0;
  const result=await r.run({client:async()=>{calls++;return response;}});
  assert.equal(calls,1,'exactly one dispatch, no redirect follow and no retry');
  assert.equal(result.http_status,response.status);
  assert.equal(result.lifecycle.stage,'registered','an error body is still evidence worth keeping');
  const stored=adapter.readAdapterCapture(r.store);
  assert.deepEqual(stored.bytes,Buffer.from(response.body));
  assert.equal(adapter.analyzeCapture(stored,normalized()).inventory_complete,false);
  assert.equal(latch.readLatch(r.latchDir).remaining.fixture,0);
 }
});

test('an oversized or undecodable response is unusable, and never reaches a record',async t=>{
 if(!posix)return t.skip('POSIX only');
 const unusable=[
  // Larger than the reviewed body cap.
  ok(200,Buffer.alloc(LIMITS.rawBytes+1,0x20)),
  // Compressed despite an identity request: never silently decoded.
  {...ok(),headers:{'content-type':'application/json','content-encoding':'gzip'},content_decoding:{mode:'none',encoding:'gzip'}},
  // A credential-shaped header anywhere in the response.
  {...ok(),headers:{'content-type':'application/json',authorization:'Basic abc'}},
  // A status outside HTTP.
  ok(99)
 ];
 for(const response of unusable){
  const r=rig();
  await assert.rejects(()=>r.run({client:async()=>response}),/pilot_response_unusable/);
  const state=latch.readLatch(r.latchDir);
  assert.equal(state.remaining.fixture,0,'the attempt is spent either way');
  assert.equal(state.outcomes[0].outcome.reason,'response_rejected_by_adapter');
  assert.equal(existsSync(r.store),false,'the response never reaches a record');
 }
});

test('the bounded body read keeps what arrived and names why it stopped',async()=>{
 const whole=await api.collectBoundedBody(Readable.from([Buffer.from('{"a":'),Buffer.from('1}')]));
 assert.equal(whole.bytes.toString(),'{"a":1}');
 assert.equal(whole.length,7);
 assert.equal(whole.complete,true);
 assert.equal(whole.read_error,null);
 // Overrunning the cap truncates at exactly the cap and says so.
 const over=await api.collectBoundedBody(Readable.from([Buffer.alloc(10,0x61),Buffer.alloc(10,0x62)]),{maxBytes:12});
 assert.equal(over.length,12);
 assert.equal(over.complete,false);
 assert.equal(over.read_error,'body_exceeded_limit');
 assert.equal(over.bytes.toString(),'a'.repeat(10)+'bb');
 // A body that stops mid-flight is kept as far as it got.
 const broken=new Readable({read(){this.push(Buffer.from('partial'));this.destroy(Error('aborted'));}});
 const cut=await api.collectBoundedBody(broken);
 assert.equal(cut.complete,false);
 assert.equal(cut.read_error,'body_stream_interrupted');
 // A stream that ends without completing, as an aborted response does.
 const incomplete=Readable.from([Buffer.from('half')]);
 incomplete.complete=false;
 const short=await api.collectBoundedBody(incomplete);
 assert.equal(short.complete,false);
 assert.equal(short.read_error,'body_not_fully_received');
 for(const bad of [0,-1,1.5,LIMITS.rawBytes+1])
  await assert.rejects(()=>api.collectBoundedBody(Readable.from(['x']),{maxBytes:bad}),/invalid_body_limit/,String(bad));
 for(const bad of [null,'bytes',Buffer.from('x'),{}])
  await assert.rejects(()=>api.collectBoundedBody(bad),/readable_body_required/,String(bad));
});

test('a persistence or registration failure is loud, and names the ungoverned bytes',async t=>{
 if(!posix)return t.skip('POSIX only');
 // Persistence: the store appears between the preflight and the write, which is
 // exactly the collision the exclusive create exists to catch.
 const a=rig();
 await assert.rejects(()=>a.run({client:async()=>{mkdirSync(a.store,{mode:0o700});return ok();}}),error=>{
  assert.equal(error.message,'pilot_evidence_not_persisted');
  assert.equal(error.attempt_spent,true);
  assert.equal(error.lifecycle.governed,false);
  assert.match(error.required_action,/not refundable/);
  return true;
 });
 assert.equal(latch.readLatch(a.latchDir).remaining.fixture,0);
 assert.equal(latch.readLatch(a.latchDir).outcomes[0].outcome.status,'response');
 // Registration: bytes are on disk and nothing governs them. That has to be
 // the loudest failure in the module, because no code is wrong at that point.
 // An unusable label or reviewer list is refused for free by the preflight, so
 // the only way left to reach this is a store that changes under the pipeline:
 // here a declared backup that disappears after the preflight cleared it.
 for(const breakIt of [
  b=>{rmSync(b.backup,{recursive:true});},
  b=>{rmSync(b.backup,{recursive:true});writeFileSync(b.backup,'not a directory');}
 ]){
  const r=rig();
  const b={backup:join(r.base,'declared-backup')};
  mkdirSync(b.backup,{mode:0o700});
  await assert.rejects(()=>r.run({backups:[b.backup],client:async()=>{breakIt(b);return ok();}}),error=>{
   assert.equal(error.message,'pilot_retention_not_registered');
   assert.equal(error.attempt_spent,true);
   assert.equal(error.lifecycle.stage,'capture_unregistered');
   assert.equal(error.lifecycle.governed,false);
   assert.equal(error.lifecycle.raw_bytes_present,true);
   assert.match(error.required_action,/register them, then delete them/i);
   return true;
  });
  // The bytes really are there, and the lifecycle is the way to find them.
  assert.equal(existsSync(join(r.store,'response.bin')),true);
  assert.equal(transport.lifecycleState({captureDirectory:r.store,latchDirectory:r.latchDir}).stage,'capture_unregistered');
  // Resolution is register, then delete, never delete directly.
  retention.registerRetention(r.store,{storage_id:'synthetic-private-volume',reviewers:['owner'],backups:[],nowUtc:NOW});
  retention.beginDeletion(r.store,{nowUtc:NOW,reason:'rehearsal'});
  retention.executeDeletion(r.store,{nowUtc:NOW});
  assert.equal(retention.verifyDeletion(r.store).verified,true);
 }
 // The cheap refusals really are cheap: nothing is spent and nothing is written.
 for(const change of [{storageId:''},{storageId:'bad/label'},{reviewers:[]},{reviewers:['a'.repeat(81)]},{backups:['/nonexistent/backup']},{backups:['relative']}]){
  const c=rig();
  await assert.rejects(()=>c.run({...change,client:async()=>assert.fail('no dispatch')}),/preflight_refused/,JSON.stringify(change));
  assert.equal(latch.readLatch(c.latchDir).remaining.fixture,1);
  assert.equal(existsSync(c.store),false);
 }
});

test('the preflight refuses an expired subscription or a passed deletion deadline',async t=>{
 if(!posix)return t.skip('POSIX only');
 const policy=retention.retentionPolicy();
 assert.equal(policy.deletion_deadline_utc,'2026-11-10T12:00:00Z');
 assert.equal(policy.subscription_expires_utc,'2026-11-11T13:47:51Z');
 const r=rig();
 const clean=api.preflight({kind:'fixture',latchDirectory:r.latchDir,storageDirectory:r.store,nowUtc:NOW,metadata:meta(),...REG});
 assert.equal(clean.clear,true);
 assert.deepEqual(clean.remaining,{fixture:1,metadata:1});
 assert.equal(clean.grants_execution_authority,false);
 // At the deadline, and past the subscription.
 const atDeadline=api.preflight({kind:'fixture',latchDirectory:r.latchDir,storageDirectory:r.store,nowUtc:'2026-11-10T12:00:00Z',metadata:meta(),...REG});
 assert.equal(atDeadline.clear,false);
 assert.ok(atDeadline.refusals.includes('retention_deadline_passed'));
 const expired=api.preflight({kind:'fixture',latchDirectory:r.latchDir,storageDirectory:r.store,nowUtc:'2026-11-11T14:00:00Z',metadata:meta(),...REG});
 assert.ok(expired.refusals.includes('subscription_expired'));
 assert.ok(expired.refusals.includes('retention_deadline_passed'));
 // And the pipeline refuses with the attempt untouched, even fully authorized.
 const late=sign(r.priv,statement(r.latchDir,r.store,{not_before_utc:'2026-11-10T11:30:00Z',not_after_utc:'2026-11-10T12:30:00Z'}));
 await assert.rejects(()=>r.run({clock:()=>'2026-11-10T12:00:00Z',authorization:late,client:async()=>assert.fail('no dispatch')}),/preflight_refused:.*retention_deadline_passed/);
 assert.equal(latch.readLatch(r.latchDir).remaining.fixture,1);
});

test('the preflight names every other refusable condition before the ceiling',async t=>{
 if(!posix)return t.skip('POSIX only');
 const r=rig();
 const at=(over)=>api.preflight({kind:'fixture',latchDirectory:r.latchDir,storageDirectory:r.store,nowUtc:NOW,metadata:meta(),...REG,...over});
 assert.ok(at({kind:'odds'}).refusals.includes('unknown_request_kind'));
 assert.ok(at({latchDirectory:'relative/path'}).refusals.includes('absolute_latch_directory_required'));
 assert.ok(at({storageDirectory:'relative/path'}).refusals.includes('absolute_storage_directory_required'));
 assert.ok(at({nowUtc:'not-a-clock'}).refusals.includes('invalid_clock'));
 assert.ok(at({latchDirectory:join(r.base,'no-latch-here')}).refusals.includes('latch_missing'));
 for(const bad of [undefined,{},{request_id:'ok',collector_sha256:'nope'},{request_id:'has space',collector_sha256:'a'.repeat(64)}])
  assert.ok(at({metadata:bad}).refusals.includes('invalid_adapter_metadata'),JSON.stringify(bad));
 // A store that already holds something is never written into.
 mkdirSync(r.store,{mode:0o700});
 assert.ok(at().refusals.includes('storage_directory_exists'));
 // The pipeline stops on the same conditions, and nothing is spent.
 await assert.rejects(()=>r.run({client:async()=>assert.fail('no dispatch')}),/preflight_refused:.*storage_directory_exists/);
 assert.equal(latch.readLatch(r.latchDir).remaining.fixture,1);
 // A used credential cannot be replayed into a second run either.
 const spent=api.bindCredential({supply:()=>SECRET});
 spent.use(()=>null);
 const fresh=rig();
 await assert.rejects(()=>fresh.run({credential:spent,client:async()=>assert.fail('no dispatch')}),/credential_consumed/);
 assert.equal(latch.readLatch(fresh.latchDir).remaining.fixture,1);
 for(const bad of [null,{},{use:'nope'}]){
  const c=rig();
  await assert.rejects(()=>c.run({credential:bad,client:async()=>assert.fail('no dispatch')}),/credential_binding_required/);
 }
});

test('a registered backup is verified byte for byte and shares the deletion deadline',async t=>{
 if(!posix)return t.skip('POSIX only');
 const r=rig();
 const backup=join(r.base,'backup');
 mkdirSync(backup,{mode:0o700});
 const result=await r.run({backups:[backup]});
 // Declared, not copied: nothing here copies raw bytes for the operator, so the
 // pipeline reports the declaration instead of a verification it cannot make.
 assert.equal(result.backups_declared,1);
 assert.equal(result.backups_verified,null);
 assert.match(result.required_action,/Copy the raw bytes to every declared backup/);
 assert.equal(result.deletion_deadline_utc,'2026-11-10T12:00:00Z');
 assert.throws(()=>retention.assertRetainable(r.store,NOW),/backup_missing/);
 writeFileSync(join(backup,'response.bin'),readFileSync(join(r.store,'response.bin')));
 assert.equal(retention.assertRetainable(r.store,NOW).backups_verified,1);
 writeFileSync(join(backup,'response.bin'),Buffer.from('tampered'));
 assert.throws(()=>retention.assertRetainable(r.store,NOW),/backup_copy_mismatch/);
});

// Task 1 remediation. The real entrypoint forwarded a caller-supplied nowUtc
// into authorization verification, the retention preflight and the attempt
// reservation. Once the anchor is installed that would have let an expired but
// validly signed authorization be replayed against an earlier timestamp. There
// is now no caller-supplied timestamp anywhere in the pipeline.
test('no caller-supplied timestamp reaches the pipeline, on either entrypoint',()=>{
 // The real entry names the attempt rather than ignoring it, so a caller cannot
 // believe they set the time.
 for(const k of ['nowUtc','now','at','trustedNow','read','clock','client','verify','simulated'])
  assert.throws(()=>api.executeAuthorizedPilot({[k]:'2026-11-01T12:00:00Z'}),/real_execution_boundaries_are_not_caller_supplied/,k);
 // With none of them supplied it refuses at the anchor, which is the gate.
 assert.throws(()=>api.executeAuthorizedPilot({kind:'fixture'}),/director_public_key_not_installed/);
 // A rehearsal injects a clock function, never a timestamp.
 for(const k of ['nowUtc','now','at'])
  assert.throws(()=>api.rehearsePilotExecution({publicKeyBase64:'x',simulated:true,client:()=>{},[k]:'2026-11-01T12:00:00Z'}),/rehearsal_clock_is_injected_not_a_timestamp/,k);
 for(const bad of ['2026-11-01T12:00:00Z',42,null,{}])
  assert.throws(()=>api.rehearsePilotExecution({publicKeyBase64:'x',simulated:true,client:()=>{},clock:bad}),/clock_function_required/,String(bad));
});

test('a spoofed historical clock cannot revive an expired signed authorization',async t=>{
 if(!posix)return t.skip('POSIX only');
 // The same statement, signed once, valid 11:00 to 13:00. It verifies inside
 // its window, which is what makes the replay attempt worth refusing.
 const inside=rig();
 await inside.run({clock:()=>'2026-11-01T12:00:00Z'});
 assert.equal(latch.readLatch(inside.latchDir).remaining.fixture,0);
 // Past its window. Before the fix a caller passed nowUtc:'2026-11-01T12:00:00Z'
 // and this dispatched. Now the trusted clock decides and it fails closed.
 for(const [at,pattern]of [['2026-11-01T13:00:00Z',/authorization_expired/],['2026-11-01T18:00:00Z',/authorization_expired/],
  ['2026-11-01T10:00:00Z',/authorization_not_yet_valid/],['2026-11-01T00:00:00Z',/authorization_not_yet_valid/]]){
  const r=rig();
  await assert.rejects(()=>r.run({clock:()=>at,client:async()=>assert.fail('no dispatch')}),pattern,at);
  assert.equal(latch.readLatch(r.latchDir).remaining.fixture,1,'a refused clock costs no attempt');
  assert.equal(existsSync(r.store),false);
 }
});

test('the clock is re-read immediately before dispatch, and lapsing refuses there',async t=>{
 if(!posix)return t.skip('POSIX only');
 // A clock valid on the first read and lapsed on the second: a slow preflight
 // must not carry a validity that has since expired into a dispatch.
 const expiring=rig();
 const ticks=['2026-11-01T12:00:00Z','2026-11-01T13:00:00Z'];
 let i=0;
 await assert.rejects(()=>expiring.run({clock:()=>ticks[Math.min(i++,1)],client:async()=>assert.fail('no dispatch')}),/authorization_expired/);
 assert.equal(latch.readLatch(expiring.latchDir).remaining.fixture,1);
 assert.equal(existsSync(expiring.store),false);
 // Crossing the retention deadline between the two reads, inside a signed
 // window that still covers both.
 const crossing=rig();
 const late=sign(crossing.priv,statement(crossing.latchDir,crossing.store,{not_before_utc:'2026-11-10T11:00:00Z',not_after_utc:'2026-11-10T13:00:00Z'}));
 const deadlineTicks=['2026-11-10T11:30:00Z','2026-11-10T12:30:00Z'];
 let k=0;
 await assert.rejects(()=>crossing.run({authorization:late,clock:()=>deadlineTicks[Math.min(k++,1)],client:async()=>assert.fail('no dispatch')}),
  /preflight_refused_at_dispatch:.*retention_deadline_passed/);
 assert.equal(latch.readLatch(crossing.latchDir).remaining.fixture,1);
 // A clock that moves backwards is refused rather than preferred, even though
 // the earlier value is inside the signed window.
 const back=rig();
 const backTicks=['2026-11-01T12:00:00Z','2026-11-01T11:30:00Z'];
 let b=0;
 await assert.rejects(()=>back.run({clock:()=>backTicks[Math.min(b++,1)],client:async()=>assert.fail('no dispatch')}),/clock_moved_backwards/);
 assert.equal(latch.readLatch(back.latchDir).remaining.fixture,1);
 assert.equal(existsSync(back.store),false);
});

test('an unusable clock fails closed before anything is spent',async t=>{
 if(!posix)return t.skip('POSIX only');
 for(const bad of [42,null,undefined,'','not-a-time','2026-11-01T12:00:00','2026-11-01T12:00:00+01:00',new Date(),{}]){
  const r=rig();
  await assert.rejects(()=>r.run({clock:()=>bad,client:async()=>assert.fail('no dispatch')}),/untrusted_clock_value/,String(bad));
  assert.equal(latch.readLatch(r.latchDir).remaining.fixture,1);
  assert.equal(existsSync(r.store),false);
 }
 const thrower=rig();
 await assert.rejects(()=>thrower.run({clock:()=>{throw Error('no clock source');},client:async()=>assert.fail('no dispatch')}),/no clock source/);
 assert.equal(latch.readLatch(thrower.latchDir).remaining.fixture,1);
});

test('every timestamp the run acted on comes from the clock, and is reported',async t=>{
 if(!posix)return t.skip('POSIX only');
 const r=rig();
 const ticks=['2026-11-01T12:00:00Z','2026-11-01T12:00:01Z','2026-11-01T12:00:02Z','2026-11-01T12:00:03Z','2026-11-01T12:00:04Z'];
 let reads=0;
 const result=await r.run({clock:()=>ticks[Math.min(reads++,ticks.length-1)]});
 // Four reads: authorization, dispatch, response, registration.
 assert.equal(reads,4);
 assert.equal(result.clock_source,'injected_rehearsal_clock');
 assert.equal(result.authorization_checked_at_utc,ticks[0]);
 assert.equal(result.dispatched_at_utc,ticks[1]);
 assert.equal(result.response_received_at_utc,ticks[2]);
 assert.equal(result.registered_at_utc,ticks[3]);
 // The capture's own chronology is the dispatch and response reads, not a
 // caller's assertion about when the request happened.
 const stored=adapter.readAdapterCapture(r.store);
 assert.equal(stored.manifest.request_started_at_utc,ticks[1]);
 assert.equal(stored.manifest.response_received_at_utc,ticks[2]);
});

test('with no clock injected the rehearsal reads the real runtime clock',async t=>{
 if(!posix)return t.skip('POSIX only');
 // Proven on both sides of the signed window rather than by a positive run, so
 // the assertion does not decay as real time passes. A statement whose window
 // sat in the past can only be refused by a clock reading the present.
 const past=rig();
 const old=sign(past.priv,statement(past.latchDir,past.store,{not_before_utc:'2026-10-01T11:00:00Z',not_after_utc:'2026-10-01T13:00:00Z'}));
 await assert.rejects(()=>past.run({authorization:old,clock:undefined,client:async()=>assert.fail('no dispatch')}),/authorization_expired/);
 assert.equal(latch.readLatch(past.latchDir).remaining.fixture,1);
 const future=rig();
 const ahead=sign(future.priv,statement(future.latchDir,future.store,{not_before_utc:'2099-01-01T00:00:00Z',not_after_utc:'2099-01-01T12:00:00Z'}));
 await assert.rejects(()=>future.run({authorization:ahead,clock:undefined,client:async()=>assert.fail('no dispatch')}),/authorization_not_yet_valid/);
 assert.equal(latch.readLatch(future.latchDir).remaining.fixture,1);
});

// Task 2 remediation. The preflight treated storageId and reviewers as optional
// while registerRetention requires them, so a missing or malformed registration
// input surfaced only after the permanent attempt had been consumed, leaving
// raw provider bytes on disk with nothing governing them.
test('mandatory retention-registration inputs are required before the ceiling',async t=>{
 if(!posix)return t.skip('POSIX only');
 const r=rig();
 // Absent entirely, which is the case that used to cost the attempt.
 const bare=api.preflight({kind:'fixture',latchDirectory:r.latchDir,storageDirectory:r.store,nowUtc:NOW,metadata:meta()});
 assert.equal(bare.clear,false);
 assert.ok(bare.refusals.includes('retention_registration_storage'));
 assert.ok(bare.refusals.includes('retention_registration_reviewers'));
 // An omitted backup list is a declaration of none, which registration accepts.
 assert.equal(bare.refusals.includes('retention_registration_backups'),false);
 const named=api.preflight({kind:'fixture',latchDirectory:r.latchDir,storageDirectory:r.store,nowUtc:NOW,metadata:meta(),storageId:'synthetic-private-volume',reviewers:['owner']});
 assert.equal(named.clear,true);
 // Through the pipeline: no attempt spent, no store, no socket.
 const cases=[
  [{storageId:undefined},'retention_registration_storage'],
  [{storageId:''},'retention_registration_storage'],
  [{storageId:'bad/label'},'retention_registration_storage'],
  [{storageId:' leading'},'retention_registration_storage'],
  [{storageId:'x'.repeat(81)},'retention_registration_storage'],
  [{storageId:42},'retention_registration_storage'],
  [{reviewers:undefined},'retention_registration_reviewers'],
  [{reviewers:[]},'retention_registration_reviewers'],
  [{reviewers:'owner'},'retention_registration_reviewers'],
  [{reviewers:[null]},'retention_registration_reviewers'],
  [{reviewers:['bad/name']},'retention_registration_reviewers'],
  [{reviewers:Array(17).fill('owner')},'retention_registration_reviewers'],
  [{storageId:undefined,reviewers:undefined},'retention_registration_storage'],
  [{backups:'one'},'retention_registration_backups'],
  [{backups:['relative/path']},'retention_registration_backups'],
  [{backups:Array(9).fill(0).map((_,i)=>'/tmp/b'+i)},'retention_registration_backups']
 ];
 for(const [change,label]of cases){
  const c=rig();
  let dispatched=false;
  await assert.rejects(()=>c.run({...change,client:async()=>{dispatched=true;return ok();}}),
   error=>{assert.match(error.message,/^preflight_refused:/);assert.ok(error.message.includes(label),error.message);return true;},JSON.stringify(change));
  assert.equal(dispatched,false,'no socket, no dispatch');
  assert.equal(latch.readLatch(c.latchDir).remaining.fixture,1,'no attempt consumed');
  assert.equal(latch.readLatch(c.latchDir).records.length,1,'nothing appended to the latch');
  assert.equal(existsSync(c.store),false,'no raw bytes on disk');
 }
 // A duplicate or self-referential backup is still refused.
 const dupe=rig();
 await assert.rejects(()=>dupe.run({backups:['/tmp','/tmp'],client:async()=>assert.fail('no dispatch')}),/retention_registration_backups/);
 const self=rig();
 await assert.rejects(()=>self.run({backups:[self.store],client:async()=>assert.fail('no dispatch')}),/retention_registration_backups/);
});

test('a clock that fails after dispatch still records the spent attempt',async t=>{
 if(!posix)return t.skip('POSIX only');
 // The attempt is already gone by the third read, so a reservation must never
 // be left without a record of what became of it.
 const after=rig();
 let n=0;
 await assert.rejects(()=>after.run({clock:()=>{if(n++<2)return '2026-11-01T12:00:00Z';throw Error('clock source lost');}}),error=>{
  assert.equal(error.message,'pilot_clock_unreadable');
  assert.equal(error.attempt_spent,true);
  return true;
 });
 const state=latch.readLatch(after.latchDir);
 assert.equal(state.remaining.fixture,0);
 assert.equal(state.outcomes.length,1,'the spent attempt has an outcome');
 assert.equal(state.outcomes[0].outcome.reason,'clock_unreadable_after_dispatch');
 assert.equal(existsSync(after.store),false);
 // And a clock that fails at the registration read is the loud ungoverned case.
 const atReg=rig();
 let m=0;
 await assert.rejects(()=>atReg.run({clock:()=>{if(m++<3)return '2026-11-01T12:00:0'+m+'Z';throw Error('clock source lost');}}),error=>{
  assert.equal(error.message,'pilot_retention_not_registered');
  assert.equal(error.lifecycle.stage,'capture_unregistered');
  assert.equal(error.lifecycle.governed,false);
  assert.equal(error.lifecycle.raw_bytes_present,true);
  return true;
 });
 assert.equal(latch.readLatch(atReg.latchDir).outcomes[0].outcome.status,'response');
 assert.equal(existsSync(join(atReg.store,'response.bin')),true);
});
