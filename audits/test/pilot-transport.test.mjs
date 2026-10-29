import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,unlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,sign as signRaw} from 'node:crypto';
const url=new URL('../source-provenance/transport.mjs',import.meta.url);
const api=existsSync(url)?await import('../source-provenance/transport.mjs'):{};
const adapter=await import('../source-provenance/provider-adapter.mjs');
const latch=await import('../source-provenance/attempt-latch.mjs');
const retention=await import('../source-provenance/retention.mjs');
const {canonicalJSON,canonicalHash}=await import('../lib/snapshot-contract.mjs');

const posix=process.platform!=='win32';
const root=()=>mkdtempSync(join(tmpdir(),'mm-transport-'));
const PLAN=adapter.pilotPlan().plan_hash;
const WINDOW={authorized_from_utc:'2026-11-01T00:00:00Z',authorized_until_utc:'2026-11-02T00:00:00Z'};
const NOW='2026-11-01T12:00:00Z';
const ids=[788036,788048,788038];
const fixture=(id,i)=>({fixture:{id,date:'2021-10-26T18:45:00Z',status:{short:['FT','AET','PEN'][i],long:'Synthetic finished status',elapsed:120,extra:null}},league:{id:81,name:'Synthetic Cup',country:'Synthetic Country',season:2021},teams:{home:{id:10+i*2,name:'Home '+i},away:{id:11+i*2,name:'Away '+i}},goals:{home:i+1,away:i},score:{halftime:{home:0,away:0},fulltime:{home:i+1,away:i},extratime:{home:null,away:null},penalty:{home:null,away:null}}});
const body=()=>Buffer.from(JSON.stringify({get:'fixtures',parameters:{ids:'788036-788048-788038'},errors:[],results:3,paging:{current:1,total:1},response:ids.map(fixture)}));
const ok=(status=200,bytes=body())=>({status,headers:{'content-type':'application/json; charset=utf-8'},body:bytes,body_complete:true,content_decoding:{mode:'none',encoding:'identity'}});
const normalized=()=>ids.map((id,i)=>({fxid:id,lid:81,season:2021,date:'2021-10-26',time:'18:45',lname:'Synthetic Cup',lcountry:'Synthetic Country',home:'Home '+i,away:'Away '+i,status:'FINISHED',gh:i+1,ga:i,ht_h:0,ht_a:0,ft_h:i+1,ft_a:i,provider:'af'}));
const meta=()=>({request_id:'synthetic-rehearsal-001',request_started_at_utc:'2026-11-01T12:00:00Z',response_received_at_utc:'2026-11-01T12:00:01Z',collector_sha256:'a'.repeat(64)});
const openLatch=dir=>latch.createLatch(dir,{plan_hash:PLAN,...WINDOW});

// A throwaway Director keypair. The module ships no installed key, so this only
// ever exercises the pure verifier, never the real execution path.
const keys=()=>{const {publicKey,privateKey}=generateKeyPairSync('ed25519');return {pub:publicKey.export({type:'spki',format:'der'}).toString('base64'),priv:privateKey};};
const signed=(priv,statement)=>({statement,signature_base64:signRaw(null,Buffer.from(canonicalJSON(statement)),priv).toString('base64')});
const stmt=(over={})=>api.authorizationStatement({kind:'fixture',latch_directory:'/approved/latch',storage_directory:'/approved/store',
 not_before_utc:'2026-11-01T11:00:00Z',not_after_utc:'2026-11-01T13:00:00Z',nonce:'a'.repeat(32),...over});
const ctx=(over={})=>({kind:'fixture',latchDirectory:'/approved/latch',storageDirectory:'/approved/store',...over});

test('transport API exists, ships no installed authority and refuses real dispatch',()=>{
 for(const name of ['buildRequest','authorizationStatement','verifyAuthorizationWith','authorizeExecution','installedDirectorKey','rehearseDispatch','executeRealTransport','lifecycleState'])assert.equal(typeof api[name],'function');
 assert.equal(api.installedDirectorKey(),null);
 assert.equal(api.DIRECTOR_AUTHORITY.installed,false);
 // No flag, no fresh latch and no synthetic session can stand in for the key.
 assert.throws(()=>api.authorizeExecution(signed(keys().priv,stmt()),NOW,ctx()),/director_public_key_not_installed/);
 assert.throws(()=>api.executeRealTransport({director_approved:true,fetch:()=>assert.fail('no call')},NOW,ctx()),/director_public_key_not_installed|disabled/);
 assert.throws(()=>{api.DIRECTOR_AUTHORITY.installed=true;if(api.DIRECTOR_AUTHORITY.installed!==false)throw Error('frozen');});
});

test('the built request is exactly the plan, and carries no credential value',()=>{
 const r=api.buildRequest('fixture');
 assert.equal(r.method,'GET');
 assert.equal(r.url,'https://v3.football.api-sports.io/fixtures?ids=788036-788048-788038');
 assert.equal(r.redirect,'error');
 assert.equal(r.automatic_retries,0);
 assert.deepEqual(r.header_names,['x-apisports-key']);
 assert.equal(r.credential_supplied_by,'separately_approved_real_transport_implementation');
 // Header names only. A value would be a credential sitting in a hashable object.
 assert.equal(Object.hasOwn(r,'headers'),false);
 assert.equal(JSON.stringify(r).toLowerCase().includes('bearer'),false);
 const s=api.buildRequest('status');
 assert.equal(s.url,'https://v3.football.api-sports.io/status');
 assert.notEqual(canonicalHash(r),canonicalHash(s));
 assert.throws(()=>api.buildRequest('odds'),/unknown_request_kind/);
 assert.throws(()=>{r.url='https://evil.example/';},/read only|object is not extensible|Cannot assign/);
});

test('a correctly signed exact-scope authorization verifies, and every drift is refused',()=>{
 const {pub,priv}=keys();
 const good=signed(priv,stmt());
 const view=api.verifyAuthorizationWith(pub,good,NOW,ctx());
 assert.equal(view.authorized,true);
 assert.equal(view.kind,'fixture');
 assert.equal(view.plan_hash,PLAN);
 // Wrong key, tampered statement, tampered signature.
 assert.throws(()=>api.verifyAuthorizationWith(keys().pub,good,NOW,ctx()),/authorization_signature_invalid/);
 const forged={...good,statement:{...good.statement,storage_directory:'/somewhere/else'}};
 assert.throws(()=>api.verifyAuthorizationWith(pub,forged,NOW,ctx()),/authorization_signature_invalid/);
 assert.throws(()=>api.verifyAuthorizationWith(pub,{...good,signature_base64:'aaaa'},NOW,ctx()),/authorization_signature_invalid/);
 // Right signature, wrong scope: the context must match what was signed.
 assert.throws(()=>api.verifyAuthorizationWith(pub,good,NOW,ctx({latchDirectory:'/other/latch'})),/authorization_scope_mismatch/);
 assert.throws(()=>api.verifyAuthorizationWith(pub,good,NOW,ctx({storageDirectory:'/other/store'})),/authorization_scope_mismatch/);
 assert.throws(()=>api.verifyAuthorizationWith(pub,good,NOW,ctx({kind:'status'})),/authorization_scope_mismatch/);
 // Outside the signed window, on both sides.
 assert.throws(()=>api.verifyAuthorizationWith(pub,good,'2026-11-01T10:59:59Z',ctx()),/authorization_not_yet_valid/);
 assert.throws(()=>api.verifyAuthorizationWith(pub,good,'2026-11-01T13:00:00Z',ctx()),/authorization_expired/);
 assert.throws(()=>api.verifyAuthorizationWith(pub,good,'not-a-clock',ctx()),/invalid_clock/);
});

test('an open-ended or off-plan authorization is refused however well signed',()=>{
 const {pub,priv}=keys();
 // A window wide enough to be a standing permission is not an exact scope.
 const wide=signed(priv,stmt({not_after_utc:'2026-11-09T11:00:00Z'}));
 assert.throws(()=>api.verifyAuthorizationWith(pub,wide,NOW,ctx()),/authorization_window_too_long/);
 assert.throws(()=>api.authorizationStatement({...stmt(),not_before_utc:'2026-11-01T13:00:00Z',not_after_utc:'2026-11-01T11:00:00Z'}),/invalid_authorization_window/);
 assert.throws(()=>api.authorizationStatement({...stmt(),nonce:'short'}),/authorization_nonce/);
 assert.throws(()=>api.authorizationStatement({...stmt(),latch_directory:'relative/path'}),/absolute/);
 // A statement that claims a different plan or request cannot be rebuilt.
 const offPlan=signed(priv,{...stmt(),plan_hash:'b'.repeat(64)});
 assert.throws(()=>api.verifyAuthorizationWith(pub,offPlan,NOW,ctx()),/authorization_plan_mismatch/);
 const offRequest=signed(priv,{...stmt(),request_hash:'c'.repeat(64)});
 assert.throws(()=>api.verifyAuthorizationWith(pub,offRequest,NOW,ctx()),/authorization_request_mismatch/);
});

test('a rehearsal consumes the durable attempt before dispatch and never twice',t=>{
 if(!posix)return t.skip('POSIX only');
 const dir=join(root(),'latch');openLatch(dir);
 let seen=null,calls=0;
 const capture=api.rehearseDispatch({kind:'fixture',latchDirectory:dir,simulated:true,nowUtc:NOW,metadata:meta(),
  transport:request=>{calls++;seen=request;
   // The attempt is already spent at this point: a crash here must not refund.
   assert.equal(latch.readLatch(dir).remaining.fixture,0);
   return ok();}});
 assert.equal(calls,1);
 assert.equal(seen.url,'https://v3.football.api-sports.io/fixtures?ids=788036-788048-788038');
 assert.equal(capture.manifest.response.status,200);
 assert.equal(capture.manifest.classification,'synthetic_only');
 assert.equal(adapter.analyzeCapture(capture,normalized()).source_review_admissible,false);
 assert.equal(latch.readLatch(dir).remaining.fixture,0);
 assert.throws(()=>api.rehearseDispatch({kind:'fixture',latchDirectory:dir,simulated:true,nowUtc:NOW,metadata:meta(),transport:()=>assert.fail('no second dispatch')}),/fixture_attempt_exhausted/);
 // The optional metadata attempt is capped on its own and does not share it.
 assert.equal(latch.readLatch(dir).remaining.metadata,1);
 api.rehearseDispatch({kind:'status',latchDirectory:dir,simulated:true,nowUtc:NOW,metadata:meta(),transport:()=>ok(200,Buffer.from('{"get":"status"}'))});
 assert.equal(latch.readLatch(dir).remaining.metadata,0);
});

test('a failing or non-simulated dispatch fails closed, and only one spends an attempt',t=>{
 if(!posix)return t.skip('POSIX only');
 const a=join(root(),'latch');openLatch(a);
 // Refused before anything is consumed: a refused dispatch must cost nothing.
 for(const bad of [{simulated:false},{simulated:true,transport:'not-a-function'},{simulated:'yes'}])
  assert.throws(()=>api.rehearseDispatch({kind:'fixture',latchDirectory:a,nowUtc:NOW,metadata:meta(),transport:()=>ok(),...bad}),/simulated_transport_required/);
 assert.equal(latch.readLatch(a).remaining.fixture,1);
 assert.throws(()=>api.rehearseDispatch({kind:'odds',latchDirectory:a,simulated:true,nowUtc:NOW,metadata:meta(),transport:()=>ok()}),/unknown_request_kind/);
 assert.equal(latch.readLatch(a).remaining.fixture,1);
 // A transport that throws has still possibly reached the provider, so it pays.
 const b=join(root(),'latch');openLatch(b);
 assert.throws(()=>api.rehearseDispatch({kind:'fixture',latchDirectory:b,simulated:true,nowUtc:NOW,metadata:meta(),transport:()=>{throw Error('socket reset');}}),/simulated_dispatch_failed/);
 assert.equal(latch.readLatch(b).remaining.fixture,0);
 assert.equal(latch.readLatch(b).outcomes[0].outcome.status,'failed');
});

test('a redirect, an error body and a truncated body are captured, not followed or retried',t=>{
 if(!posix)return t.skip('POSIX only');
 for(const response of [ok(302),Object.assign(ok(429),{body:Buffer.from('{"errors":{"rateLimit":"too many"}}')}),Object.assign(ok(200),{body_complete:false}),
  {status:403,headers:{'content-type':'text/plain'},body:Buffer.from('denied'),body_complete:true,content_decoding:{mode:'none',encoding:'identity'}}]){
  const dir=join(root(),'latch');openLatch(dir);
  let calls=0;
  const capture=api.rehearseDispatch({kind:'fixture',latchDirectory:dir,simulated:true,nowUtc:NOW,metadata:meta(),transport:()=>{calls++;return response;}});
  assert.equal(calls,1,'exactly one dispatch, no retry and no redirect follow');
  assert.equal(capture.manifest.response.status,response.status);
  assert.deepEqual(capture.bytes,Buffer.from(response.body));
  assert.equal(adapter.analyzeCapture(capture,normalized()).inventory_complete,false);
  assert.equal(latch.readLatch(dir).remaining.fixture,0);
 }
});

test('a credential anywhere in the response is refused before it can be stored',t=>{
 if(!posix)return t.skip('POSIX only');
 for(const header of ['authorization','x-apisports-key','set-cookie','x-api-token']){
  const dir=join(root(),'latch');openLatch(dir);
  const response=ok();response.headers[header]='synthetic-secret';
  assert.throws(()=>api.rehearseDispatch({kind:'fixture',latchDirectory:dir,simulated:true,nowUtc:NOW,metadata:meta(),transport:()=>response}));
  // The attempt is still spent, and the secret reached no record.
  const state=latch.readLatch(dir);
  assert.equal(state.remaining.fixture,0);
  assert.equal(JSON.stringify(state.records).includes('synthetic-secret'),false);
 }
});

test('the lifecycle reports every stage, including the crash window before registration',t=>{
 if(!posix)return t.skip('POSIX only');
 const base=root(),latchDir=join(base,'latch'),store=join(base,'store');
 assert.equal(api.lifecycleState({captureDirectory:store,latchDirectory:latchDir}).stage,'no_latch');
 openLatch(latchDir);
 assert.equal(api.lifecycleState({captureDirectory:store,latchDirectory:latchDir}).stage,'ready');
 const capture=api.rehearseDispatch({kind:'fixture',latchDirectory:latchDir,simulated:true,nowUtc:NOW,metadata:meta(),transport:()=>ok()});
 assert.equal(api.lifecycleState({captureDirectory:store,latchDirectory:latchDir}).stage,'attempt_spent_no_capture');
 adapter.writeAdapterCapture(store,capture);
 // This is the crash window the Director asked about: bytes on disk, retained
 // under the provider's terms, with nothing yet governing them.
 const crash=api.lifecycleState({captureDirectory:store,latchDirectory:latchDir});
 assert.equal(crash.stage,'capture_unregistered');
 assert.equal(crash.raw_bytes_present,true);
 assert.equal(crash.governed,false);
 assert.match(crash.required_action,/register/i);
 retention.registerRetention(store,{storage_id:'synthetic-private-volume',reviewers:['owner'],backups:[],nowUtc:NOW});
 const governed=api.lifecycleState({captureDirectory:store,latchDirectory:latchDir});
 assert.equal(governed.stage,'registered');
 assert.equal(governed.governed,true);
 retention.beginDeletion(store,{nowUtc:NOW,reason:'rehearsal'});
 assert.equal(api.lifecycleState({captureDirectory:store,latchDirectory:latchDir}).stage,'deletion_in_progress');
 retention.executeDeletion(store,{nowUtc:NOW});
 const done=api.lifecycleState({captureDirectory:store,latchDirectory:latchDir});
 assert.equal(done.stage,'deleted');
 assert.equal(done.raw_bytes_present,false);
});

test('an incomplete or orphaned capture directory is named as such, not registered',t=>{
 if(!posix)return t.skip('POSIX only');
 const base=root(),latchDir=join(base,'latch'),store=join(base,'store');
 openLatch(latchDir);
 const capture=api.rehearseDispatch({kind:'fixture',latchDirectory:latchDir,simulated:true,nowUtc:NOW,metadata:meta(),transport:()=>ok()});
 adapter.writeAdapterCapture(store,capture);
 unlinkSync(join(store,'response.bin'));
 const view=api.lifecycleState({captureDirectory:store,latchDirectory:latchDir});
 assert.equal(view.stage,'capture_incomplete');
 assert.equal(view.raw_bytes_present,false);
 assert.match(view.required_action,/remove/i);
 assert.throws(()=>retention.registerRetention(store,{storage_id:'v',reviewers:['owner'],backups:[],nowUtc:NOW}));
 // A stray file in the store is refused outright rather than silently kept.
 const other=join(base,'store2');
 adapter.writeAdapterCapture(other,capture);
 writeFileSync(join(other,'response.bin.bak'),body());
 assert.throws(()=>retention.registerRetention(other,{storage_id:'v',reviewers:['owner'],backups:[],nowUtc:NOW}),/unexpected_retention_file/);
});
