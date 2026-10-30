// The real API-Football transport for the single-batch pilot.
//
// This is the implementation `EXECUTION-PREFLIGHT.md` section 8a step C says
// does not exist. It now exists, and it is still incapable of reaching the
// provider, for the same structural reason as `transport.mjs`: the only path
// that can build a socket reads `installedDirectorKey()`, which is `null`, so
// `executeAuthorizedPilot` refuses before a credential is bound, before an
// attempt is reserved and before a connection is opened. Installing the anchor
// is a separately reviewed act performed outside this repository.
//
// What is new here, and what is deliberately not:
//
// - New: the credential binding, the real `node:https` client, the bounded body
//   read, the target assertion, the preflight gate and the one pipeline that
//   orders authorization, reservation, dispatch, capture, persistence and
//   retention registration.
// - Not new: the request inventory, the authorization format and its verifier,
//   the attempt ceiling, the capture adapter and the retention lifecycle. Those
//   are reused unchanged from the reviewed modules, by import.
//
// One pipeline, two boundaries. `runPilot` is the only dispatch sequence. The
// real entry hands it the installed anchor and the real client; the rehearsal
// entry hands it an explicit test key and an injected client. Everything
// between those two boundaries is literally the same code, so the ordering
// guarantees the tests prove are the ordering guarantees a real run would have.
// The residual risk is named in REAL-TRANSPORT.md: the `node:https` call itself
// is reviewed by reading, never by executing.
//
// No environment variable is read here. No credential is embedded, stored,
// logged, hashed or returned. No database, scheduler, collector or financial
// state is touched.
import {request as httpsRequest} from 'node:https';
import {lstatSync,existsSync,realpathSync} from 'node:fs';
import {dirname,isAbsolute,resolve} from 'node:path';
import {LIMITS} from '../a4/bounds.mjs';
import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {createSyntheticSession,writeAdapterCapture} from './provider-adapter.mjs';
import {readLatch,reserveAttempt,recordOutcome} from './attempt-latch.mjs';
import {retentionPolicy,registerRetention,assertRetainable} from './retention.mjs';
import {buildRequest,authorizeExecution,verifyAuthorizationWith,installedDirectorKey,lifecycleState,TRANSPORT_VERSION} from './transport.mjs';

export const REAL_TRANSPORT_VERSION='pilot-real-transport-v1';

// The fixed target. Everything dispatched is rebuilt locally from the reviewed
// plan and then checked against these, so a caller cannot name a host, a path,
// a query or a second endpoint.
const HOST='v3.football.api-sports.io';
const PORT=443;
const CREDENTIAL_HEADER='x-apisports-key';
const PATH_KIND=Object.freeze({'/fixtures':'fixture','/status':'status'});
const KINDS=Object.freeze(['fixture','status']);
const LATCH_KIND=Object.freeze({fixture:'fixture',status:'metadata'});
// The one divergence from "a single header" on the wire, DECISION-1 in
// REAL-TRANSPORT.md. Node adds Host and Connection whatever we do, and without
// an explicit identity encoding a compressed body would be captured as bytes
// the adapter refuses, spending the unrefundable attempt for nothing.
const WIRE_HEADER_NAMES=Object.freeze([CREDENTIAL_HEADER,'accept-encoding','host','connection']);
// Shape only. A real API-SPORTS key is printable and bounded; nothing here
// knows or stores a specific value.
const CREDENTIAL_SHAPE=/^[\x21-\x7e]{16,256}$/;
// Catches a key pasted from the wrong provider. An OpenRouter key starts `sk-`,
// a JWT `eyJ`. Sending either to API-Football would spend the attempt and leak
// an unrelated secret to an unrelated host.
const FOREIGN_CREDENTIAL=/^(?:sk-|eyj|bearer[\s_-])/i;
const REQUEST_ID=/^[A-Za-z0-9_-]{1,80}$/;
const HEX=/^[a-f0-9]{64}$/;
const DEFAULT_TIMEOUT_MS=30000;
const MAX_TIMEOUT_MS=120000;

const LABEL=/^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,79}$/;
// Module-private. Only `executeAuthorizedPilot` can produce it, and it is never
// passed to a caller-supplied function, so the real client cannot be driven
// from outside the authorized pipeline. Independent review found that exporting
// the client without this made every gate in the module optional: an importer
// could call it directly with a key and a valid request and reach the provider.
const AUTHORIZED_DISPATCH=Symbol('authorized_dispatch');

const clockNow=()=>new Date().toISOString();
const absolutePath=(value,label)=>{
 if(typeof value!=='string'||!isAbsolute(value)||resolve(value)!==value)throw Error('absolute_'+label+'_required');
 return value;
};

// A single-use holder. The value lives in a closure, never on a property, so it
// cannot be read back, enumerated, serialized or inspected. `supply` is called
// exactly once, at bind time, so an unusable credential is refused before the
// attempt ceiling is spent.
export function bindCredential(input){
 if(input===null||typeof input!=='object'||Object.getPrototypeOf(input)!==Object.prototype)throw Error('credential_supply_function_required');
 if(Reflect.ownKeys(input).length!==1)throw Error('credential_supply_function_required');
 // Read through the descriptor, once. An accessor could otherwise return one
 // function to the type check and another to the call.
 const descriptor=Object.getOwnPropertyDescriptor(input,'supply');
 if(!descriptor||!('value' in descriptor)||typeof descriptor.value!=='function')throw Error('credential_supply_function_required');
 const supply=descriptor.value;
 let secret,state='bound',calls=0;
 try{secret=supply();calls=1;}
 catch{throw Error('credential_supply_failed');}
 if(typeof secret!=='string'||!CREDENTIAL_SHAPE.test(secret)||FOREIGN_CREDENTIAL.test(secret)){
  secret=null;
  throw Error('credential_shape_invalid');
 }
 const clear=()=>{secret=null;state='consumed';};
 // Everything that could display the holder shows the header name and the
 // state. There is no accessor that returns the value.
 const view=()=>({version:REAL_TRANSPORT_VERSION,header_name:CREDENTIAL_HEADER,state,supply_calls:calls,value:'[never-exposed]'});
 return Object.freeze({
  header_name:CREDENTIAL_HEADER,
  state(){return state;},
  supplyCalls(){return calls;},
  // The value reaches `consumer` and nothing else. The holder clears when the
  // consumer returns, and when its promise settles either way, so the secret is
  // live for exactly as long as the request it authenticates plus the leak scan
  // that has to see it.
  use(consumer){
   if(state!=='bound')throw Error('credential_'+state);
   if(typeof consumer!=='function')throw Error('credential_consumer_required');
   let out;
   try{out=consumer(secret);}
   catch(error){clear();throw error;}
   if(out!==null&&typeof out==='object'&&typeof out.then==='function')
    return out.then(value=>{clear();return value;},error=>{clear();throw error;});
   clear();
   return out;
  },
  discard(){secret=null;if(state==='bound')state='discarded';},
  toJSON:view,
  toString(){return 'CredentialBinding('+CREDENTIAL_HEADER+','+state+')';},
  [Symbol.for('nodejs.util.inspect.custom')]:view
 });
}

// True if the provider echoed the credential back into something about to be
// stored. Returns a boolean and never the value, so a refusal cannot print what
// it found. Both the literal bytes and their base64 form are searched.
export function responseEchoesCredential(response,secret){
 if(typeof secret!=='string'||!secret)throw Error('credential_shape_invalid');
 const raw=Buffer.from(secret,'utf8');
 const needles=[raw,Buffer.from(raw.toString('base64'),'utf8')];
 for(const value of Object.values(response?.headers??{})){
  const text=Array.isArray(value)?value.join(','):value;
  if(typeof text==='string'){
   const buf=Buffer.from(text,'utf8');
   if(needles.some(n=>buf.includes(n)))return true;
  }
 }
 const body=response?.body;
 const bytes=Buffer.isBuffer(body)?body:body==null?Buffer.alloc(0):Buffer.from(body);
 return needles.some(n=>bytes.includes(n));
}

// Rebuilt locally from the reviewed plan and then checked, so the permitted
// inventory is a property of this function rather than of the caller.
export function assertPermittedTarget(request){
 if(request===null||typeof request!=='object')throw Error('forbidden_request_target');
 let url;
 try{url=new URL(request.url);}catch{throw Error('forbidden_request_target');}
 const kind=PATH_KIND[url.pathname];
 if(!kind)throw Error('forbidden_request_target');
 if(url.protocol!=='https:'||url.hostname!==HOST||url.username||url.password||url.hash)throw Error('forbidden_request_target');
 if(url.port!==''&&url.port!==String(PORT))throw Error('forbidden_request_target');
 const expected=buildRequest(kind);
 if(request.url!==expected.url||request.method!=='GET'||canonicalHash(request)!==canonicalHash(expected))throw Error('forbidden_request_target');
 if(request.redirect!=='error'||request.automatic_retries!==0||request.additional_queries!==0||request.max_attempts!==1)throw Error('forbidden_request_shape');
 return Object.freeze({kind,hostname:HOST,port:PORT,path:url.pathname+url.search,max_body_bytes:expected.max_body_bytes});
}

// Reads at most `maxBytes` and stops. A body that overruns the cap, stops
// mid-flight or ends without the stream completing is kept as far as it got and
// marked incomplete: a truncated provider body is still evidence, and the
// attempt that bought it is spent either way.
export async function collectBoundedBody(stream,{maxBytes=LIMITS.rawBytes}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<=0||maxBytes>LIMITS.rawBytes)throw Error('invalid_body_limit');
 if(stream===null||typeof stream!=='object'||typeof stream[Symbol.asyncIterator]!=='function')throw Error('readable_body_required');
 const chunks=[];
 let total=0,complete=true,readError=null;
 try{
  for await(const chunk of stream){
   const part=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
   if(total+part.length>maxBytes){
    chunks.push(part.subarray(0,maxBytes-total));
    total=maxBytes;
    complete=false;
    readError='body_exceeded_limit';
    if(typeof stream.destroy==='function')stream.destroy();
    break;
   }
   chunks.push(part);
   total+=part.length;
  }
 }catch{
  complete=false;
  readError='body_stream_interrupted';
 }
 // `IncomingMessage.complete` is false when the connection closed before the
 // whole body arrived without raising an error.
 if(stream.complete===false){complete=false;readError??='body_not_fully_received';}
 return Object.freeze({bytes:Buffer.concat(chunks,total),length:total,complete,read_error:readError});
}

// The genuine client. Reached only from `executeAuthorizedPilot`, which refuses
// at the missing anchor, so this function has never run against a provider and
// is reviewed by reading. It receives the secret for exactly as long as it
// takes to set one header; the pipeline's binding owns its lifetime.
export function realHttpsClient({request,secret,timeoutMs=DEFAULT_TIMEOUT_MS,token}={}){
 // Two independent brakes, because this is the only function in the repository
 // that can open a socket to the provider. The token proves the call came from
 // the authorized pipeline rather than from an importer, and the anchor is the
 // same structural absence that stops `executeAuthorizedPilot`.
 if(token!==AUTHORIZED_DISPATCH)throw Error('client_requires_authorized_pipeline');
 if(installedDirectorKey()===null)throw Error('director_public_key_not_installed');
 const target=assertPermittedTarget(request);
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<=0||timeoutMs>MAX_TIMEOUT_MS)throw Error('invalid_timeout');
 if(typeof secret!=='string'||!CREDENTIAL_SHAPE.test(secret))throw Error('credential_shape_invalid');
 return new Promise((settle,refuse)=>{
  let finished=false;
  const done=fn=>{if(!finished){finished=true;fn();}};
  const req=httpsRequest({
   protocol:'https:',hostname:target.hostname,port:target.port,path:target.path,method:'GET',
   // Named explicitly so a reviewer sees every header this process sets.
   headers:{[CREDENTIAL_HEADER]:secret,'accept-encoding':'identity'},
   servername:target.hostname,rejectUnauthorized:true,minVersion:'TLSv1.2',
   // A fresh one-off agent: no pooling, no reuse, no second socket.
   agent:false,
   timeout:timeoutMs
  });
  // One attempt. `https.request` never follows a redirect and never retries, so
  // a 3xx arrives as a response and is captured as one.
  req.on('timeout',()=>{req.destroy(Error('socket_timeout'));});
  req.on('error',error=>done(()=>refuse(Error(error?.message==='socket_timeout'?'dispatch_timeout':'dispatch_transport_error'))));
  req.on('response',res=>{
   collectBoundedBody(res,{maxBytes:target.max_body_bytes}).then(read=>{
    const headers={};
    for(const [name,value]of Object.entries(res.headers??{}))headers[String(name).toLowerCase()]=value;
    const encoding=headers['content-encoding'];
    done(()=>settle(Object.freeze({
     status:res.statusCode,
     headers,
     body:read.bytes,
     body_complete:read.complete,
     // Nothing is decompressed, so the captured bytes are the bytes received.
     // A compressed body despite `accept-encoding: identity` is reported as
     // such and refused by the adapter rather than silently decoded.
     content_decoding:Object.freeze({mode:'none',encoding:encoding===undefined?'identity':String(encoding)}),
     read_error:read.read_error
    })));
   },()=>done(()=>refuse(Error('dispatch_response_unreadable'))));
  });
  req.end();
 });
}

// Everything that can refuse for free refuses here, before the ceiling is
// spent. A refused preflight costs nothing.
export function preflight({kind,latchDirectory,storageDirectory,nowUtc,metadata,storageId,reviewers,backups}={}){
 const refusals=[];
 const policy=retentionPolicy();
 const known=KINDS.includes(kind);
 let remaining=null;
 if(!known)refusals.push('unknown_request_kind');
 if(process.platform==='win32')refusals.push('posix_private_persistence_required');
 try{absolutePath(latchDirectory,'latch_directory');}catch(error){refusals.push(error.message);}
 try{absolutePath(storageDirectory,'storage_directory');}catch(error){refusals.push(error.message);}
 let now=null;
 try{now=epochMicros(nowUtc);}catch{refusals.push('invalid_clock');}
 if(now!==null){
  if(now>=epochMicros(policy.deletion_deadline_utc))refusals.push('retention_deadline_passed');
  if(now>=epochMicros(policy.subscription_expires_utc))refusals.push('subscription_expired');
 }
 // Duplicated from the capture adapter on purpose: metadata the adapter would
 // reject must not cost the attempt first.
 const m=metadata;
 if(m===null||typeof m!=='object'||!REQUEST_ID.test(m?.request_id??'')||!HEX.test(m?.collector_sha256??''))refusals.push('invalid_adapter_metadata');
 // Same reason, for the retention registration. An unusable storage label,
 // reviewer list or backup path is knowable for free, and knowing it after the
 // reservation leaves raw bytes on disk with nothing governing them. The checks
 // mirror `retention.mjs`; registration remains the authority.
 if(storageId!==undefined&&(typeof storageId!=='string'||!LABEL.test(storageId)))refusals.push('retention_registration_storage');
 if(reviewers!==undefined&&(!Array.isArray(reviewers)||!reviewers.length||reviewers.length>16||reviewers.some(r=>typeof r!=='string'||!LABEL.test(r))))refusals.push('retention_registration_reviewers');
 if(backups!==undefined){
  const list=backups;
  if(!Array.isArray(list)||list.length>8||list.some(b=>typeof b!=='string'||!isAbsolute(b)||resolve(b)!==b)||new Set(list).size!==list.length||list.includes(storageDirectory))refusals.push('retention_registration_backups');
  else for(const b of list){
   try{
    const s=lstatSync(b);
    if(s.isSymbolicLink()||!s.isDirectory())throw Error('backup_directory_must_be_real_directory');
   }catch(error){refusals.push('backup:'+error.message);}
  }
 }
 if(typeof latchDirectory==='string'&&isAbsolute(latchDirectory)){
  if(!existsSync(latchDirectory))refusals.push('latch_missing');
  else try{
   const state=readLatch(latchDirectory);
   remaining={...state.remaining};
   if(known&&state.remaining[LATCH_KIND[kind]]<=0)refusals.push(LATCH_KIND[kind]+'_attempt_exhausted');
   if(state.directory_mode&0o077)refusals.push('latch_directory_not_private');
  }catch(error){refusals.push('latch_unreadable:'+error.message);}
 }
 if(typeof storageDirectory==='string'&&isAbsolute(storageDirectory)&&process.platform!=='win32'){
  // The adapter creates the store exclusively at mode 0700, so anything already
  // there is either a second capture or someone else's directory.
  if(existsSync(storageDirectory))refusals.push('storage_directory_exists');
  else{
   const parent=dirname(storageDirectory);
   try{
    if(realpathSync(parent)!==parent)throw Error('absolute_real_private_parent_required');
    const s=lstatSync(parent);
    if(!s.isDirectory()||s.mode&0o077||s.uid!==process.getuid())throw Error('private_owned_parent_required');
   }catch(error){refusals.push('storage_parent:'+error.message);}
  }
 }
 return Object.freeze({
  version:REAL_TRANSPORT_VERSION,
  clear:refusals.length===0,
  refusals:Object.freeze(refusals),
  remaining:remaining===null?null:Object.freeze(remaining),
  deletion_deadline_utc:policy.deletion_deadline_utc,
  subscription_expires_utc:policy.subscription_expires_utc,
  grants_execution_authority:false
 });
}

const failure=(label,error,extra)=>Object.assign(Error(label),{cause:error,...extra});

// The one dispatch sequence. Order is the whole safety property:
//
//  1. verify the Director authorization              free
//  2. rebuild and assert the request                 free
//  3. preflight every refusable condition            free
//  4. reserve the durable attempt                    spent, never refunded
//  5. dispatch once, carrying the credential
//  6. clear the credential, and refuse a response that echoed it
//  7. copy and hash the bytes before any parsing
//  8. record the outcome whatever it was
//  9. persist privately, verified by readback
// 10. register retention immediately
async function runPilot({kind,latchDirectory,storageDirectory,nowUtc,metadata,credential,client,verify,authorization,simulated,timeoutMs,storageId,reviewers,backups,clock=clockNow}){
 // 1. No self-issued permission: the verifier is the reviewed one and the
 //    statement must be signed over exactly this scope.
 const view=verify(authorization,nowUtc,{kind,latchDirectory,storageDirectory});
 // 2. The request is ours, not the caller's.
 const request=buildRequest(kind);
 if(canonicalHash(request)!==view.request_hash)throw Error('authorization_request_mismatch');
 assertPermittedTarget(request);
 if(credential===null||typeof credential!=='object'||typeof credential.use!=='function'||typeof credential.state!=='function')throw Error('credential_binding_required');
 if(credential.state()!=='bound')throw Error('credential_'+credential.state());
 if(typeof clock!=='function')throw Error('clock_function_required');
 // 3. Everything that can refuse for free.
 const pre=preflight({kind,latchDirectory,storageDirectory,nowUtc,metadata,storageId,reviewers,backups:backups??[]});
 if(!pre.clear)throw Error('preflight_refused:'+pre.refusals.join(','));

 const startedAt=clock();
 // 4. From here the attempt is spent whatever happens next.
 const reservation=reserveAttempt(latchDirectory,LATCH_KIND[kind],nowUtc);
 let dispatched;
 try{
  // 5 and 6. The credential is used once. The echo scan runs inside the same
  //    `use`, while the value is still reachable, so it cannot be skipped by
  //    clearing early, and the binding clears as the dispatch settles.
  dispatched=await credential.use(async secret=>{
   const response=await client({request,secret,timeoutMs});
   return {response,echoed:responseEchoesCredential(response,secret)};
  });
 }catch(error){
  // A request that failed may still have reached the provider, so nothing is
  // refunded and the reason is a fixed label, never the error text.
  //
  // The error itself is dropped rather than attached as a cause. It comes from
  // the client, which is holding the credential at the moment it fails, so its
  // message is the one piece of text in this pipeline that could carry a
  // secret. Independent review found exactly that: a client whose error quoted
  // the key put the key into `error.cause`.
  recordOutcome(latchDirectory,reservation,{status:'failed',reason:'dispatch_failed_delivery_ambiguous'});
  throw failure('pilot_dispatch_failed',null,{delivery:'ambiguous',attempt_spent:true,
   transport_error:'withheld_may_contain_credential'});
 }finally{credential.discard();}
 const receivedAt=clock();
 if(credential.supplyCalls()!==1)throw Error('credential_supply_calls');

 if(dispatched.echoed){
  // The response never reaches a record, and the label never carries the value.
  recordOutcome(latchDirectory,reservation,{status:'unusable',reason:'credential_echoed_in_response'});
  throw failure('credential_echoed_by_provider',null,{attempt_spent:true});
 }
 const response=dispatched.response;

 // 7 and 8. Copy and hash before any parsing, and record the outcome either way.
 let capture;
 try{
  const session=createSyntheticSession();
  const bundle={status:response.status,headers:response.headers,body:response.body,body_complete:response.body_complete,content_decoding:response.content_decoding};
  const meta={request_id:metadata.request_id,request_started_at_utc:startedAt,response_received_at_utc:receivedAt,collector_sha256:metadata.collector_sha256};
  capture=kind==='fixture'?session.captureFixture(bundle,meta):session.captureStatus(bundle,meta);
 }catch(error){
  recordOutcome(latchDirectory,reservation,{status:'unusable',reason:'response_rejected_by_adapter'});
  throw failure('pilot_response_unusable',error,{attempt_spent:true});
 }
 recordOutcome(latchDirectory,reservation,{status:'response',reason:simulated?'rehearsal':'provider_response'});

 // 9. Private, exclusive, mode 0700/0600, verified by reading it back.
 let stored;
 try{stored=writeAdapterCapture(storageDirectory,capture);}
 catch(error){
  throw failure('pilot_evidence_not_persisted',error,{attempt_spent:true,
   lifecycle:lifecycleState({captureDirectory:storageDirectory,latchDirectory}),
   required_action:'An attempt was spent and the evidence is not on disk. Account for the spent attempt: the ceiling is not refundable.'});
 }
 // 10. Immediately: raw bytes are held under the provider's terms from the
 //     moment they land, and the window before registration is ungoverned.
 const declared=backups??[];
 let registration,retainable;
 try{
  registration=registerRetention(storageDirectory,{storage_id:storageId,reviewers,backups:declared,nowUtc});
  // A declared backup is the operator's copy to make. `retention.mjs` never
  // copies raw bytes and neither does this, so with one declared the pipeline
  // reports the declaration rather than a verification it cannot honestly
  // make: the copy is preflight step 18 and the check is step 20.
  retainable=declared.length===0?assertRetainable(storageDirectory,nowUtc):null;
 }catch(error){
  throw failure('pilot_retention_not_registered',error,{attempt_spent:true,
   lifecycle:lifecycleState({captureDirectory:storageDirectory,latchDirectory}),
   required_action:'Raw provider bytes are on disk with nothing governing them. Register them, then delete them. Do not delete directly: registering first is what produces an auditable receipt.'});
 }

 return Object.freeze({
  version:REAL_TRANSPORT_VERSION,
  transport_version:TRANSPORT_VERSION,
  simulated,
  kind,
  authorization:Object.freeze({nonce:view.nonce,plan_hash:view.plan_hash,request_hash:view.request_hash}),
  reservation_id:reservation,
  http_status:capture.manifest.response.status,
  body_complete:capture.manifest.response.body_complete,
  read_error:response.read_error??null,
  capture_hash:stored.manifest.capture_hash,
  raw_sha256:stored.manifest.raw_sha256,
  raw_length:stored.manifest.raw_length,
  wire_header_names:WIRE_HEADER_NAMES,
  credential_state:credential.state(),
  registration_sha256:registration.record_sha256,
  backups_declared:declared.length,
  backups_verified:retainable===null?null:retainable.backups_verified,
  deletion_deadline_utc:registration.deletion_deadline_utc,
  required_action:retainable===null
   ?'Copy the raw bytes to every declared backup, then run assertRetainable. A declared backup that does not exist refuses with backup_missing.'
   :'Under retention. Delete before the recorded deadline.',
  lifecycle:lifecycleState({captureDirectory:storageDirectory,latchDirectory}),
  source_review_admissible:false,
  grants_execution_authority:false
 });
}

// The real entry. It reads the installed anchor and nothing else. With no key
// installed it refuses synchronously, before a credential is used, an attempt
// is reserved or a socket exists.
export function executeAuthorizedPilot(options={}){
 if(installedDirectorKey()===null)throw Error('director_public_key_not_installed');
 if(['client','verify','simulated','clock'].some(k=>Object.hasOwn(options,k)))throw Error('real_execution_boundaries_are_not_caller_supplied');
 // The token is minted here and nowhere else, and it is bound into the wrapper
 // rather than passed through the client arguments, so no caller-supplied
 // function ever sees it.
 return runPilot({...options,simulated:false,verify:authorizeExecution,clock:clockNow,
  client:args=>realHttpsClient({...args,token:AUTHORIZED_DISPATCH})});
}

// The rehearsal entry. Same pipeline, with the two boundaries replaced by an
// explicit test key and an injected client, so the real client can never be
// reached from here and the installed anchor can never be reached from a test.
export function rehearsePilotExecution({publicKeyBase64,client,simulated,...rest}={}){
 if(simulated!==true)throw Error('simulated_rehearsal_required');
 if(typeof client!=='function')throw Error('injected_client_required');
 if(client===realHttpsClient)throw Error('real_client_forbidden_in_rehearsal');
 if(typeof publicKeyBase64!=='string'||!publicKeyBase64)throw Error('director_public_key_required');
 return runPilot({...rest,simulated:true,client,
  verify:(authorization,now,scope)=>verifyAuthorizationWith(publicKeyBase64,authorization,now,scope)});
}

export function grantsExecutionAuthority(){return false;}
export function realDispatchReachable(){return installedDirectorKey()!==null;}
