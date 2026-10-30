// Durable, fail-closed attempt control for a FUTURE separately authorized pilot.
//
// It CONSTRAINS attempts. It never grants any. There is no HTTP, no provider
// client, no credential, no environment read, no database, no scheduler and no
// financial state here, and `executeRealTransportUnderLatch` throws
// unconditionally so this file cannot become an acquisition path.
//
// The adapter's latch was two local variables inside `createSyntheticSession`,
// so a restart or a second session started over with a fresh ceiling. A real
// request ceiling has to outlive the process, so the allowances live in an
// append-only hash-chained set of private files: one reserved fixture attempt,
// one separately reserved optional metadata attempt, consumed before dispatch
// and never refunded, with every refusal failing closed.
import {mkdirSync,openSync,writeFileSync,readFileSync,readdirSync,fsyncSync,closeSync,lstatSync,fstatSync,existsSync,constants} from 'node:fs';
import {isAbsolute,join} from 'node:path';
import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {pilotPlan} from './provider-adapter.mjs';

export const LATCH_VERSION='durable-attempt-latch-v1';
const ALLOWANCES=Object.freeze({fixture:1,metadata:1});
const KINDS=Object.freeze(Object.keys(ALLOWANCES));
const RECORD=/^record-\d{6}\.json$/;
const HEX=/^[a-f0-9]{64}$/;
const name=n=>'record-'+String(n).padStart(6,'0')+'.json';
// The canonical hasher rejects an explicit undefined, so the field is removed
// rather than blanked before hashing.
const hashOf=record=>{const {record_sha256,...rest}=record;return canonicalHash(rest);};

function privateDir(dir,{create}={}){
 if(typeof dir!=='string'||!isAbsolute(dir))throw Error('absolute_latch_directory_required');
 if(process.platform==='win32')throw Error('posix_private_persistence_required');
 if(create){mkdirSync(dir,{recursive:false,mode:0o700});return dir;}
 const s=lstatSync(dir);
 if(!s.isDirectory()||s.isSymbolicLink())throw Error('latch_directory_required');
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
  if(!fstatSync(fd).isFile())throw Error('latch_record_must_be_regular_file');
  const record=JSON.parse(readFileSync(fd,'utf8'));
  if(!HEX.test(record?.record_sha256??''))throw Error('malformed_latch_record');
  if(hashOf(record)!==record.record_sha256)throw Error('record_hash_mismatch');
  return record;
 }finally{closeSync(fd);}
}
function append(dir,records,record){
 const parent=records.length?records[records.length-1].record_sha256:null;
 const full={...record,sequence:records.length+1,parent_sha256:parent};
 full.record_sha256=hashOf(full);
 // Two processes that read the same state both target this name, and O_EXCL
 // makes the loser fail rather than overwrite a receipt or share an allowance.
 // Independent review found the loser surfaced a raw EEXIST, which is correct
 // but reads like a disk fault at exactly the moment an operator needs to know
 // the ceiling held, so it is named.
 try{durableWrite(dir,name(full.sequence),JSON.stringify(full));}
 catch(error){throw error?.code==='EEXIST'?Error('concurrent_latch_append'):error;}
 return full;
}

export function createLatch(dir,{plan_hash,authorized_from_utc,authorized_until_utc}={}){
 // Bound to the reviewed plan before anything is created, so a latch cannot be
 // opened for some other request shape and no directory is left behind.
 if(plan_hash!==pilotPlan().plan_hash)throw Error('plan_hash_mismatch');
 let from,until;
 try{from=epochMicros(authorized_from_utc);until=epochMicros(authorized_until_utc);}catch{throw Error('invalid_clock');}
 if(!(from<until))throw Error('invalid_authorization_window');
 if(typeof dir!=='string'||!isAbsolute(dir))throw Error('absolute_latch_directory_required');
 if(process.platform==='win32')throw Error('posix_private_persistence_required');
 // Independent review found that accepting a pre-existing directory wrote the
 // authorization receipt into whatever mode that directory already had, so a
 // directory created in advance left the receipts world-readable. The latch now
 // creates its own directory or refuses, which is the same exclusive-create
 // discipline the capture adapter uses.
 if(existsSync(dir))throw Error('latch_already_exists');
 privateDir(dir,{create:true});
 return append(dir,[],{version:LATCH_VERSION,type:'authorization',classification:'synthetic_only',
  plan_hash,allowances:{...ALLOWANCES},authorized_from_utc,authorized_until_utc,
  grants_execution_authority:false,
  note:'Constrains attempts only. Confers no provider access, credential or execution authority.'});
}

export function readLatch(dir){
 privateDir(dir);
 const files=readdirSync(dir).sort();
 for(const f of files)if(!RECORD.test(f))throw Error('unexpected_latch_file');
 if(!files.length)throw Error('missing_record');
 const expected=files.map((_,i)=>name(i+1));
 if(files.join(',')!==expected.join(','))throw Error('missing_record');
 const records=files.map(f=>readRecord(dir,f));
 records.forEach((r,i)=>{
  if(r.sequence!==i+1)throw Error('missing_record');
  if(r.parent_sha256!==(i?records[i-1].record_sha256:null))throw Error('broken_latch_chain');
 });
 const authorization=records[0];
 if(authorization.type!=='authorization'||authorization.version!==LATCH_VERSION)throw Error('malformed_latch_record');
 if(authorization.grants_execution_authority!==false)throw Error('latch_cannot_grant_authority');
 if(authorization.plan_hash!==pilotPlan().plan_hash)throw Error('plan_hash_mismatch');
 const reservations=records.filter(r=>r.type==='reservation');
 const outcomes=records.filter(r=>r.type==='outcome');
 const remaining={};
 for(const k of KINDS)remaining[k]=Math.max(0,authorization.allowances[k]-reservations.filter(r=>r.attempt===k).length);
 // The mode is reported rather than enforced on read: refusing here would make
 // the receipts unreadable for forensics after a privacy breach, so a breach is
 // made visible to the caller instead of hidden.
 return Object.freeze({authorization,records,reservations,outcomes,remaining:Object.freeze(remaining),
  directory_mode:lstatSync(dir).mode&0o777,grants_execution_authority:false});
}

export function reserveAttempt(dir,attempt,nowUtc){
 if(!KINDS.includes(attempt))throw Error('unknown_attempt_kind');
 const state=readLatch(dir);
 let now;
 try{now=epochMicros(nowUtc);}catch{throw Error('invalid_clock');}
 if(now<epochMicros(state.authorization.authorized_from_utc))throw Error('authorization_not_yet_valid');
 if(now>=epochMicros(state.authorization.authorized_until_utc))throw Error('authorization_expired');
 if(state.remaining[attempt]<=0)throw Error(attempt+'_attempt_exhausted');
 const reservation_id=attempt+'-'+String(state.records.length+1).padStart(6,'0');
 append(dir,state.records,{version:LATCH_VERSION,type:'reservation',attempt,reservation_id,reserved_at_utc:nowUtc});
 return reservation_id;
}

export function recordOutcome(dir,reservation_id,outcome){
 const state=readLatch(dir);
 if(!state.reservations.some(r=>r.reservation_id===reservation_id))throw Error('unknown_reservation');
 if(state.outcomes.some(o=>o.reservation_id===reservation_id))throw Error('duplicate_outcome');
 if(outcome===null||typeof outcome!=='object'||typeof outcome.status!=='string')throw Error('malformed_outcome');
 // An ambiguous or failed attempt is still spent. Nothing here restores an
 // allowance, which is why the outcome is a new record and never an edit.
 return append(dir,state.records,{version:LATCH_VERSION,type:'outcome',reservation_id,
  outcome:{status:outcome.status,reason:typeof outcome.reason==='string'?outcome.reason:null},
  recorded_at_utc:new Date().toISOString()});
}

export function dispatchSimulated(dir,{attempt,simulated,transport}={},nowUtc){
 // Refused before any attempt is consumed: a refused dispatch must cost nothing.
 if(simulated!==true||typeof transport!=='function')throw Error('simulated_transport_required');
 const reservation_id=reserveAttempt(dir,attempt,nowUtc);
 let response;
 try{response=transport();}
 catch(error){
  recordOutcome(dir,reservation_id,{status:'failed',reason:'simulated_transport_threw'});
  throw Error('simulated_dispatch_failed');
 }
 const record=recordOutcome(dir,reservation_id,{status:'response',reason:'simulated'});
 return Object.freeze({reservation_id,outcome:record.outcome,response});
}

export function grantsExecutionAuthority(){return false;}
export function executeRealTransportUnderLatch(){throw Error('real_provider_transport_disabled_requires_separate_implementation_and_director_approval');}
