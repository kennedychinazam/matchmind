// Offline retention and deletion control for captured provider responses.
//
// Why this file exists: the provider's written permission to retain exact
// response bodies is conditional on an active subscription. A permission with a
// condition attached is only honoured if something enforces the condition, so
// the boundary lives in code rather than in a calendar reminder. Past the
// boundary every path refuses, and refusing is the only behaviour that needs no
// operator present.
//
// It CONSTRAINS retention and never grants any. No HTTP, no provider client, no
// credential, no environment read, no database and no financial state appear
// here, and `executeRealTransportUnderRetention` throws unconditionally so this
// file cannot become an acquisition path. It deletes only raw response bytes it
// was given to look after: it has no reach into production records or the
// historical research archive, and nothing here walks a tree or takes a glob.
import {openSync,writeFileSync,readFileSync,readdirSync,unlinkSync,fsyncSync,closeSync,lstatSync,fstatSync,constants} from 'node:fs';
import {dirname,isAbsolute,join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {readAdapterCapture} from './provider-adapter.mjs';

export const RETENTION_VERSION='capture-retention-v1';
// Dates are the Director's, recorded as given. The deadline sits ahead of
// expiry so a deletion has room to go wrong and still land in time; an
// enforcement that finishes exactly at expiry has no margin at all. The
// deadline is therefore the operative control, and expiry is the backstop it
// keeps away from.
const POLICY=Object.freeze({
 version:RETENTION_VERSION,
 subscription_expires_utc:'2026-11-11T13:47:51Z',
 deletion_deadline_utc:'2026-11-10T12:00:00Z',
 condition:'subscription_active',
 basis:'provider_support_response_2026-10-29',
 scope:'original_response_bodies_error_bodies_temporary_copies_and_registered_backups',
 grants_execution_authority:false
});
if(!(epochMicros(POLICY.deletion_deadline_utc)<epochMicros(POLICY.subscription_expires_utc)))throw Error('retention_policy_invalid');

// Distinguishes a deletion completed by the process that began it from one
// another process picked up after an interruption. Not a pid: nothing here
// needs to identify the machine or the operator.
const PROCESS_ID=randomUUID();
const RECORD=/^retention-\d{6}\.json$/;
const COMPANION=Object.freeze(['response.bin','manifest.json']);
const RAW='response.bin';
const HEX=/^[a-f0-9]{64}$/;
const REASONS=Object.freeze(['rehearsal','retention_deadline','subscription_ended','director_instruction']);
const LABEL=/^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,79}$/;
const name=n=>'retention-'+String(n).padStart(6,'0')+'.json';
// The canonical hasher rejects an explicit undefined, so the field is removed
// rather than blanked before hashing.
const hashOf=record=>{const {record_sha256,...rest}=record;return canonicalHash(rest);};
const absolute=p=>typeof p==='string'&&isAbsolute(p)&&resolve(p)===p;
const clock=value=>{try{return epochMicros(value);}catch{throw Error('invalid_clock');}};
const absent=error=>error?.code==='ENOENT';
// A backup directory that is a symlink would have its target followed, so an
// unlink could land outside the approved storage. Deletion is destructive, so
// the directory is required to be real at registration and again at every use.
function realDir(dir){
 const s=lstatSync(dir);
 if(s.isSymbolicLink()||!s.isDirectory())throw Error('backup_directory_must_be_real_directory');
 return dir;
}

export function retentionPolicy(){return POLICY;}

function retentionDir(dir){
 if(typeof dir!=='string'||!isAbsolute(dir))throw Error('absolute_retention_directory_required');
 if(process.platform==='win32')throw Error('posix_private_persistence_required');
 const s=lstatSync(dir);
 if(!s.isDirectory()||s.isSymbolicLink())throw Error('retention_directory_required');
 return dir;
}
// Exclusive create, fsync the file and then the directory, so a crash leaves
// either no record or a complete one. A partial record fails its own hash.
function durableWrite(dir,file,text){
 const fd=openSync(join(dir,file),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{writeFileSync(fd,text);fsyncSync(fd);}finally{closeSync(fd);}
 const dfd=openSync(dir,'r');try{fsyncSync(dfd);}finally{closeSync(dfd);}
}
function readRecord(dir,file){
 const fd=openSync(join(dir,file),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  if(!fstatSync(fd).isFile())throw Error('retention_record_must_be_regular_file');
  const record=JSON.parse(readFileSync(fd,'utf8'));
  if(!HEX.test(record?.record_sha256??''))throw Error('malformed_retention_record');
  if(hashOf(record)!==record.record_sha256)throw Error('record_hash_mismatch');
  return record;
 }finally{closeSync(fd);}
}
function append(dir,records,record){
 const parent=records.length?records[records.length-1].record_sha256:null;
 const full={...record,sequence:records.length+1,parent_sha256:parent};
 full.record_sha256=hashOf(full);
 durableWrite(dir,name(full.sequence),JSON.stringify(full));
 return full;
}
function recordFiles(dir){
 const files=readdirSync(dir).filter(f=>!COMPANION.includes(f)).sort();
 for(const f of files)if(!RECORD.test(f))throw Error('unexpected_retention_file');
 return files;
}

export function registerRetention(dir,{storage_id,reviewers,backups=[],nowUtc}={}){
 retentionDir(dir);
 if(recordFiles(dir).length)throw Error('retention_already_registered');
 // Validated before anything is written, so a refused registration leaves no
 // record claiming a store is governed when it is not.
 if(typeof storage_id!=='string'||!LABEL.test(storage_id))throw Error('retention_registration_storage');
 if(!Array.isArray(reviewers)||!reviewers.length||reviewers.length>16||reviewers.some(r=>typeof r!=='string'||!LABEL.test(r)))throw Error('retention_registration_reviewers');
 if(!Array.isArray(backups)||backups.length>8||backups.some(b=>!absolute(b))||new Set(backups).size!==backups.length||backups.includes(dir))throw Error('retention_registration_backups');
 for(const b of backups)realDir(b);
 const now=clock(nowUtc);
 if(now>=epochMicros(POLICY.deletion_deadline_utc))throw Error('retention_deadline_passed');
 // A capture that is incomplete or does not match its own manifest is never
 // taken under retention: there would be nothing honest to attest to.
 const capture=readAdapterCapture(dir);
 return append(dir,[],{version:RETENTION_VERSION,type:'registration',classification:'synthetic_only',
  subscription_expires_utc:POLICY.subscription_expires_utc,deletion_deadline_utc:POLICY.deletion_deadline_utc,
  condition:POLICY.condition,basis:POLICY.basis,scope:POLICY.scope,
  storage_id,reviewers:[...reviewers],backups:[...backups],
  capture_hash:capture.manifest.capture_hash,raw_sha256:capture.manifest.raw_sha256,raw_length:capture.manifest.raw_length,
  registered_at_utc:nowUtc,grants_execution_authority:false,
  note:'Constrains retention only. Confers no provider access, credential or execution authority.'});
}

export function readRetention(dir){
 retentionDir(dir);
 const files=recordFiles(dir);
 if(!files.length)throw Error('missing_record');
 const expected=files.map((_,i)=>name(i+1));
 if(files.join(',')!==expected.join(','))throw Error('missing_record');
 const all=files.map(f=>readRecord(dir,f));
 all.forEach((r,i)=>{
  if(r.sequence!==i+1)throw Error('missing_record');
  if(r.parent_sha256!==(i?all[i-1].record_sha256:null))throw Error('broken_retention_chain');
 });
 const registration=all[0];
 if(registration.type!=='registration'||registration.version!==RETENTION_VERSION)throw Error('malformed_retention_record');
 if(registration.grants_execution_authority!==false)throw Error('retention_cannot_grant_authority');
 const intent=all.find(r=>r.type==='deletion-intent')??null;
 const receipt=all.find(r=>r.type==='deletion-receipt')??null;
 const ended=all.find(r=>r.type==='subscription-end')??null;
 return Object.freeze({registration,records:all,intent,receipt,subscription_end:ended,
  deleted:receipt!==null,deletion_in_progress:intent!==null&&receipt===null,
  subscription_ended:ended!==null,directory_mode:lstatSync(dir).mode&0o777});
}

// The subscription can lapse before the deadline: cancellation, a failed
// payment, a provider decision. Permission ends with it, so this is recorded
// durably and retention stops at once rather than running to the deadline.
export function recordSubscriptionEnd(dir,{ended_at_utc,source}={}){
 const state=readRetention(dir);
 if(state.subscription_ended)throw Error('subscription_end_already_recorded');
 if(typeof source!=='string'||!LABEL.test(source))throw Error('subscription_end_source');
 clock(ended_at_utc);
 return append(dir,state.records,{version:RETENTION_VERSION,type:'subscription-end',
  ended_at_utc,source,recorded_at_utc:new Date().toISOString(),
  note:'Retention permission ended with the subscription. Raw bytes must be deleted.'});
}

function targets(dir,registration){
 return Object.freeze([{role:'primary',path:join(dir,RAW)},
  ...registration.backups.map(b=>({role:'backup',path:join(b,RAW)}))].map(Object.freeze));
}
export function planDeletion(dir){
 const state=readRetention(dir);
 return Object.freeze({version:RETENTION_VERSION,capture_hash:state.registration.capture_hash,
  deletion_deadline_utc:state.registration.deletion_deadline_utc,
  subscription_ended:state.subscription_ended,
  targets:targets(dir,state.registration)});
}

// Reads one file's bytes only to hash and size it. Nothing returns the bytes.
function digest(path){
 const before=lstatSync(path);
 if(before.isSymbolicLink()||!before.isFile())throw Error('nonregular_file_forbidden');
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const s=fstatSync(fd);
  if(!s.isFile())throw Error('nonregular_file_forbidden');
  const bytes=readFileSync(fd);
  return {sha256:createHash('sha256').update(bytes).digest('hex'),length:bytes.length};
 }finally{closeSync(fd);}
}

export function assertRetainable(dir,nowUtc){
 const state=readRetention(dir);
 if(state.deleted)throw Error('raw_data_deleted');
 if(state.deletion_in_progress)throw Error('deletion_in_progress');
 if(state.subscription_ended)throw Error('subscription_ended');
 const r=state.registration;
 // A stored snapshot that no longer matches the policy is not a licence to keep
 // the old boundary: the two have to agree or retention stops.
 if(r.subscription_expires_utc!==POLICY.subscription_expires_utc||r.deletion_deadline_utc!==POLICY.deletion_deadline_utc||r.condition!==POLICY.condition||r.scope!==POLICY.scope)throw Error('retention_policy_mismatch');
 const now=clock(nowUtc);
 if(now>=epochMicros(r.deletion_deadline_utc))throw Error('retention_deadline_passed');
 const capture=readAdapterCapture(dir);
 if(capture.manifest.capture_hash!==r.capture_hash||capture.manifest.raw_sha256!==r.raw_sha256)throw Error('capture_not_the_registered_one');
 // Every registered backup holds the same bytes or none. A backup that drifted
 // is a tamper signal, because nothing in this module ever rewrites one.
 let backups_verified=0;
 for(const t of targets(dir,r).filter(x=>x.role==='backup')){
  let d;
  realDir(dirname(t.path));
  try{d=digest(t.path);}catch(error){if(absent(error))continue;throw error;}
  if(d.sha256!==r.raw_sha256||d.length!==r.raw_length)throw Error('backup_copy_mismatch');
  backups_verified++;
 }
 return Object.freeze({retainable:true,raw_present:true,backups_verified,
  capture_hash:r.capture_hash,deletion_deadline_utc:r.deletion_deadline_utc,
  subscription_expires_utc:r.subscription_expires_utc,grants_execution_authority:false});
}

// Deliberately not gated on the deadline or on retainability: deletion is most
// needed exactly when retention has stopped being valid.
export function beginDeletion(dir,{nowUtc,reason}={}){
 const state=readRetention(dir);
 if(state.deleted)throw Error('deletion_already_complete');
 if(state.deletion_in_progress)throw Error('deletion_already_initiated');
 if(!REASONS.includes(reason))throw Error('unknown_deletion_reason');
 clock(nowUtc);
 // The intent is durable before anything is removed, so an interruption is
 // visible as an interruption rather than as an intact store.
 return append(dir,state.records,{version:RETENTION_VERSION,type:'deletion-intent',reason,
  requested_at_utc:nowUtc,initiated_in_process:PROCESS_ID,
  targets:targets(dir,state.registration).map(t=>({role:t.role,path:t.path}))});
}

export function executeDeletion(dir,{nowUtc}={}){
 const state=readRetention(dir);
 if(state.deleted)throw Error('deletion_already_complete');
 if(!state.deletion_in_progress)throw Error('deletion_not_initiated');
 clock(nowUtc);
 const r=state.registration;
 const results=[];
 for(const t of state.intent.targets){
  let d=null;
  try{if(t.role==='backup')realDir(dirname(t.path));d=digest(t.path);}
  catch(error){
   if(absent(error)){results.push({...t,status:'absent',sha256:null,length:null,matched_registration:null,reason:'already_absent'});continue;}
   results.push({...t,status:'unverified',sha256:null,length:null,matched_registration:null,reason:'unreadable'});continue;
  }
  const matched=d.sha256===r.raw_sha256&&d.length===r.raw_length;
  try{unlinkSync(t.path);}
  catch(error){results.push({...t,status:'unverified',sha256:d.sha256,length:d.length,matched_registration:matched,reason:absent(error)?'vanished_during_deletion':'unlink_failed'});continue;}
  results.push({...t,status:'deleted',sha256:d.sha256,length:d.length,matched_registration:matched,reason:null});
 }
 // Only hashes, lengths and counts survive. They attest to what was destroyed
 // and cannot rebuild a single field of it.
 return append(dir,state.records,{version:RETENTION_VERSION,type:'deletion-receipt',
  reason:state.intent.reason,requested_at_utc:state.intent.requested_at_utc,completed_at_utc:nowUtc,
  resumed:state.intent.initiated_in_process!==PROCESS_ID,
  capture_hash:r.capture_hash,registered_raw_sha256:r.raw_sha256,registered_raw_length:r.raw_length,
  results,deleted:results.filter(x=>x.status==='deleted').length,
  unverified:results.filter(x=>x.status==='unverified').length,
  retained_audit_metadata:'hashes_lengths_and_counts_only'});
}

export function verifyDeletion(dir){
 const state=readRetention(dir);
 if(!state.deleted)throw Error(state.deletion_in_progress?'deletion_incomplete':'deletion_not_initiated');
 // The world is re-read here. A receipt is a claim, and a claim is not a check.
 const unverified=[];
 let remaining=0;
 for(const t of state.receipt.results){
  let present=true;
  try{digest(t.path);}catch(error){if(absent(error))present=false;else{unverified.push({role:t.role,path:t.path,reason:'unreadable'});continue;}}
  if(present){remaining++;unverified.push({role:t.role,path:t.path,reason:'raw_data_still_present'});}
  if(t.status==='unverified')unverified.push({role:t.role,path:t.path,reason:'receipt_recorded_unverified'});
 }
 // Removal and attestation are different claims. A target that was already
 // gone by the time deletion ran leaves no hash to attest to, which is honest
 // but weaker evidence, so it is counted rather than folded into `verified`.
 const attested=state.receipt.results.filter(t=>HEX.test(t.sha256??'')).length;
 return Object.freeze({verified:unverified.length===0,raw_bytes_remaining:remaining,
  attested,fully_attested:attested===state.receipt.results.length,
  targets:state.receipt.results.length,capture_hash:state.receipt.capture_hash,
  completed_at_utc:state.receipt.completed_at_utc,unverified:Object.freeze(unverified)});
}

export function grantsExecutionAuthority(){return false;}
export function executeRealTransportUnderRetention(){throw Error('real_provider_transport_disabled_requires_separate_implementation_and_director_approval');}
