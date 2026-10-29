// Transport boundary for the single-batch pilot. Inert by construction.
//
// Why this file is safe to have in the tree: it prepares everything a real
// request needs except the two things that would make one possible. It holds no
// credential and never reads one, and it holds no Director public key, so the
// authorization every dispatch must present cannot be verified and therefore
// cannot exist. Both absences are structural. Flipping a flag, creating a fresh
// latch, opening a synthetic session or writing a file in this repository does
// not supply either one.
//
// The credential is deliberately absent rather than configurable: the request
// this module builds names the header but never its value, so even a transport
// that wrapped the platform's own fetch would send an unauthenticated request.
// Binding a credential is part of the separately approved implementation.
import {existsSync,lstatSync} from 'node:fs';
import {isAbsolute,join,resolve} from 'node:path';
import {createPublicKey,verify as verifySignature} from 'node:crypto';
import {canonicalJSON,canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {pilotPlan,createSyntheticSession} from './provider-adapter.mjs';
import {readLatch,reserveAttempt,recordOutcome} from './attempt-latch.mjs';
import {readRetention} from './retention.mjs';

export const TRANSPORT_VERSION='pilot-transport-v1';

// The trust anchor for real execution. It is not installed, and this module
// cannot install it: the key belongs to the Director and is generated outside
// this repository. Until a reviewed process puts a real key here, every
// authorization fails to verify and every real dispatch refuses. That is the
// whole inertness mechanism, and it is not a flag.
export const DIRECTOR_AUTHORITY=Object.freeze({
 version:'director-execution-authority-v1',
 algorithm:'ed25519',
 public_key_spki_base64:null,
 installed:false,
 note:'Not installed. A real execution requires a distinct, exact-scope, Director-signed authorization verified against an installed key. No flag, latch, session or self-issued record substitutes for it.'
});
export function installedDirectorKey(){return DIRECTOR_AUTHORITY.public_key_spki_base64;}

// Reuses the production convention observed in Build 355 `index.html`: the fixed
// API-SPORTS host at line 2596 and the single `x-apisports-key` header at line
// 2640. It deliberately diverges from production in one way: production throws
// on a non-2xx and discards the body, while the pilot must preserve every body,
// error bodies most of all, because that is the evidence.
const BASE='https://v3.football.api-sports.io';
const CREDENTIAL_HEADER='x-apisports-key';
const KINDS=Object.freeze({fixture:'fixture_request',status:'status_metadata_request'});
const LATCH_KIND=Object.freeze({fixture:'fixture',status:'metadata'});
const NONCE=/^[a-f0-9]{32,64}$/;
const HEX=/^[a-f0-9]{64}$/;
const MAX_WINDOW_MICROS=24*60*60*1000000;
// F04: the statement is closed. A field this verifier does not check must not
// travel inside something that looks checked, even signed by the Director, and
// an accessor must not be able to report one value to the hasher and another to
// the checks.
const STATEMENT_KEYS=Object.freeze(['version','transport_version','plan_hash','request_hash','kind','latch_directory','storage_directory','not_before_utc','not_after_utc','nonce']);
function closedStatement(value){
 if(value===null||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw Error('authorization_statement_shape');
 if(Reflect.ownKeys(value).length!==STATEMENT_KEYS.length||STATEMENT_KEYS.some(k=>!Object.hasOwn(value,k)))throw Error('authorization_statement_shape');
 for(const d of Object.values(Object.getOwnPropertyDescriptors(value)))if(!('value' in d)||!d.enumerable)throw Error('authorization_statement_shape');
}
const clock=value=>{try{return epochMicros(value);}catch{throw Error('invalid_clock');}};
const absolutePath=(value,label)=>{
 if(typeof value!=='string'||!isAbsolute(value)||resolve(value)!==value)throw Error('absolute_'+label+'_required');
 return value;
};

export function buildRequest(kind){
 const key=KINDS[kind];
 if(!key)throw Error('unknown_request_kind');
 const plan=pilotPlan(),request=plan[key];
 const query=new URLSearchParams(request.query).toString();
 return Object.freeze({
  version:TRANSPORT_VERSION,
  method:request.method,
  url:BASE+request.endpoint+(query?'?'+query:''),
  // Named, never valued. A hashable object holding a key would be a leak.
  header_names:Object.freeze([CREDENTIAL_HEADER]),
  credential_supplied_by:'separately_approved_real_transport_implementation',
  redirect:request.redirect,
  automatic_retries:request.automatic_retries,
  additional_queries:request.additional_queries,
  max_attempts:request.max_attempts,
  max_body_bytes:plan.max_body_bytes,
  plan_hash:plan.plan_hash
 });
}

export function authorizationStatement({kind,latch_directory,storage_directory,not_before_utc,not_after_utc,nonce}={}){
 const request=buildRequest(kind);
 if(typeof nonce!=='string'||!NONCE.test(nonce))throw Error('authorization_nonce');
 absolutePath(latch_directory,'latch_directory');
 absolutePath(storage_directory,'storage_directory');
 const from=clock(not_before_utc),until=clock(not_after_utc);
 if(!(from<until))throw Error('invalid_authorization_window');
 if(until-from>MAX_WINDOW_MICROS)throw Error('authorization_window_too_long');
 return Object.freeze({
  version:'director-execution-authorization-v1',
  transport_version:TRANSPORT_VERSION,
  plan_hash:request.plan_hash,
  request_hash:canonicalHash(request),
  kind,latch_directory,storage_directory,not_before_utc,not_after_utc,nonce
 });
}

// Pure, and separate from the real path on purpose: the verification logic is
// exercised in tests with a throwaway key, while real execution can only use
// the installed anchor, which does not exist. A test cannot reach the real path
// by supplying its own key.
export function verifyAuthorizationWith(publicKeyBase64,{statement,signature_base64}={},nowUtc,{kind,latchDirectory,storageDirectory}={}){
 if(typeof publicKeyBase64!=='string'||!publicKeyBase64)throw Error('director_public_key_required');
 if(statement===null||typeof statement!=='object'||typeof signature_base64!=='string')throw Error('malformed_authorization');
 let key,verified=false;
 try{
  key=createPublicKey({key:Buffer.from(publicKeyBase64,'base64'),format:'der',type:'spki'});
  verified=verifySignature(null,Buffer.from(canonicalJSON(statement)),key,Buffer.from(signature_base64,'base64'));
 }catch{verified=false;}
 if(!verified)throw Error('authorization_signature_invalid');
 // Signed, so now check that what was signed is the scope in front of us. A
 // valid signature over the wrong scope authorizes nothing.
 closedStatement(statement);
 if(statement.version!=='director-execution-authorization-v1'||statement.transport_version!==TRANSPORT_VERSION)throw Error('authorization_version_mismatch');
 if(!HEX.test(statement.plan_hash??'')||statement.plan_hash!==pilotPlan().plan_hash)throw Error('authorization_plan_mismatch');
 if(!KINDS[statement.kind])throw Error('unknown_request_kind');
 if(!HEX.test(statement.request_hash??'')||statement.request_hash!==canonicalHash(buildRequest(statement.kind)))throw Error('authorization_request_mismatch');
 if(typeof statement.nonce!=='string'||!NONCE.test(statement.nonce))throw Error('authorization_nonce');
 if(statement.kind!==kind||statement.latch_directory!==latchDirectory||statement.storage_directory!==storageDirectory)throw Error('authorization_scope_mismatch');
 const from=clock(statement.not_before_utc),until=clock(statement.not_after_utc),now=clock(nowUtc);
 if(!(from<until))throw Error('invalid_authorization_window');
 // A window wide enough to be a standing permission is not an exact scope.
 if(until-from>MAX_WINDOW_MICROS)throw Error('authorization_window_too_long');
 if(now<from)throw Error('authorization_not_yet_valid');
 if(now>=until)throw Error('authorization_expired');
 return Object.freeze({authorized:true,kind:statement.kind,plan_hash:statement.plan_hash,
  request_hash:statement.request_hash,nonce:statement.nonce,
  latch_directory:statement.latch_directory,storage_directory:statement.storage_directory,
  // Replay is prevented by the latch, not by remembering nonces: the signed
  // statement names one latch directory, that directory's attempt is consumed
  // before dispatch and never refunded, and a pre-existing latch directory is
  // refused outright. A replay therefore finds the attempt spent.
  replay_control:'bound_to_named_latch_directory_single_consumed_attempt'});
}

export function authorizeExecution(input,nowUtc,context){
 const key=installedDirectorKey();
 if(key===null)throw Error('director_public_key_not_installed');
 return verifyAuthorizationWith(key,input,nowUtc,context);
}

// The only dispatch path that runs. It exercises the real sequence end to end,
// with an injected transport, so the ordering guarantees are genuinely tested:
// the durable attempt is consumed before the transport is called, the bytes are
// copied and hashed before anything is parsed, and the outcome is recorded
// either way.
export function rehearseDispatch({kind,latchDirectory,transport,simulated,nowUtc,metadata}={}){
 // Refused before anything is consumed: a refused dispatch must cost nothing.
 if(simulated!==true||typeof transport!=='function')throw Error('simulated_transport_required');
 if(!KINDS[kind])throw Error('unknown_request_kind');
 const request=buildRequest(kind);
 const reservation=reserveAttempt(latchDirectory,LATCH_KIND[kind],nowUtc);
 let response;
 try{response=transport(request);}
 catch{
  // Possibly reached the provider, so the attempt is spent regardless.
  recordOutcome(latchDirectory,reservation,{status:'failed',reason:'simulated_transport_threw'});
  throw Error('simulated_dispatch_failed');
 }
 let capture;
 try{
  const session=createSyntheticSession();
  capture=kind==='fixture'?session.captureFixture(response,metadata):session.captureStatus(response,metadata);
 }catch(error){
  // A response that cannot be captured safely, a credential header among them,
  // still spent the attempt. The reason is a fixed label, never the response.
  recordOutcome(latchDirectory,reservation,{status:'unusable',reason:'response_rejected_by_adapter'});
  throw error;
 }
 recordOutcome(latchDirectory,reservation,{status:'response',reason:'simulated'});
 return capture;
}

export function executeRealTransport(input,nowUtc,context){
 // Unreachable while no key is installed, and that is the point: the refusal
 // comes from the missing trust anchor, not from a branch anyone can edit.
 authorizeExecution(input,nowUtc,context);
 throw Error('real_provider_transport_disabled_requires_separate_implementation_and_director_approval');
}

const stage=(name,extra)=>Object.freeze({stage:name,...extra});
const complete=dir=>existsSync(join(dir,'response.bin'))&&existsSync(join(dir,'manifest.json'));

// Makes every stage of the capture lifecycle visible, above all the window
// between receiving bytes and bringing them under retention. Bytes on disk in
// that window are retained provider data with nothing governing them, which is
// a compliance gap even though no code is wrong.
export function lifecycleState({captureDirectory,latchDirectory}={}){
 absolutePath(captureDirectory,'capture_directory');
 absolutePath(latchDirectory,'latch_directory');
 if(!existsSync(latchDirectory))return stage('no_latch',{governed:false,raw_bytes_present:false,
  required_action:'Create the latch at the approved location before any dispatch.'});
 const latch=readLatch(latchDirectory);
 const spent=latch.remaining.fixture<=0;
 const raw=existsSync(join(captureDirectory,'response.bin'));
 if(!existsSync(captureDirectory))return stage(spent?'attempt_spent_no_capture':'ready',{governed:false,raw_bytes_present:false,
  required_action:spent?'An attempt was spent with no capture stored. Record the outcome and stop: the ceiling is not refundable.':'Nothing dispatched yet.'});
 if(lstatSync(captureDirectory).isSymbolicLink()||!lstatSync(captureDirectory).isDirectory())throw Error('capture_directory_required');
 let retention=null;
 try{retention=readRetention(captureDirectory);}
 catch(error){
  if(error.message==='unexpected_retention_file')return stage('store_unexpected_file',{governed:false,raw_bytes_present:raw,
   required_action:'The store holds a file the retention chain does not recognise. Treat it as an unauthorized copy, account for it and remove it.'});
  if(error.message!=='missing_record')throw error;
  return complete(captureDirectory)
   ?stage('capture_unregistered',{governed:false,raw_bytes_present:raw,
     required_action:'Register the capture for retention now, then delete it if it is not wanted. Raw bytes are held under the provider terms from the moment they land.'})
   :stage('capture_incomplete',{governed:false,raw_bytes_present:raw,
     required_action:'The capture is incomplete or orphaned and can never be registered. Remove it and account for the spent attempt.'});
 }
 if(retention.deleted)return stage('deleted',{governed:true,raw_bytes_present:raw,
  required_action:raw?'The receipt says deleted but raw bytes are present. Verify the deletion again and treat this as a breach.':'Nothing further. Keep the receipt.'});
 if(retention.deletion_in_progress)return stage('deletion_in_progress',{governed:true,raw_bytes_present:raw,
  required_action:'A deletion was interrupted. Resume it: nothing else may use these bytes.'});
 if(retention.subscription_ended)return stage('subscription_ended',{governed:true,raw_bytes_present:raw,
  required_action:'The subscription has ended. Delete the raw bytes now, with reason subscription_ended.'});
 return stage('registered',{governed:true,raw_bytes_present:raw,
  required_action:'Under retention. Delete before the recorded deadline.'});
}

export function grantsExecutionAuthority(){return false;}
