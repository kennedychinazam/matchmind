import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {CEILING,parseResponse,MODELS,validateRequest,dollarsToMicros} from './contracts.mjs';
import {assertRuntime} from './runtime.mjs';
// The existing weekend_events reservation authority is the SINGLE shared ledger.
// Model-specific jobs retain separate immutable A1/A2/A3 slots in the same private table.
export async function executeRequest(store,{id,job,request,profile},options){
 const now=store.clock(),{kind,account,checkpoint,transport,runtime}=options;
 if(kind!=='synthetic_verification'){
  if(kind!=='football'||now.slice(0,10)!=='2026-10-25'||options.supervised!==true||options.recoveryVerified!==true||options.externalCopyVerified!==true)throw Error('supervised Sunday/recovery admission absent');
  assertRuntime(runtime,now);
 }
 validateRequest(request,profile,now);
 const request_hash=request.request_hash;
 if(!account||!Number.isSafeInteger(account.usage_micros)||account.usage_micros<0||!Number.isSafeInteger(account.remaining_micros)||!Number.isSafeInteger(account.limit_micros)||account.limit_micros>CEILING||!account.observed_at_utc||epochMicros(now)<epochMicros(account.observed_at_utc)||epochMicros(now)-epochMicros(account.observed_at_utc)>120000000n)throw Error('stale or unverifiable account budget');
 if(store.read(id))throw Error('duplicate request reservation; never redispatch');
 const events=store.events(),existing=events.filter(e=>e.kind==='reservation');
 if(existing.some(e=>e.body.integration==='openrouter-private-v1'&&e.body.key_identity_hash!==account.key_identity_hash))throw Error('key identity changed; no ledger reset');
 if(events.some(e=>e.kind==='usage'&&e.body.halt===true))throw Error('study halted after provider contract failure');
 const retained=store.reservedMicros();
 const knownIds=new Set(existing.filter(e=>e.body.integration==='openrouter-private-v1').map(e=>e.event_id));
 const knownReported=events.filter(e=>e.kind==='usage'&&e.body.status==='provider_response'&&knownIds.has(e.parent_id)).reduce((total,e)=>total+dollarsToMicros(e.body.response.usage.cost),0);
 if(account.usage_micros>knownReported||account.usage_micros>retained)throw Error('unrecorded key usage; reconcile lost or pending billing before any request');
 // Completed charges remain covered by their original full reservations, which are
 // NEVER released. Unknown external/timeout charges block rather than infer overlap.
 const amount=profile.reserved_micros;
 if(amount+retained>CEILING||profile.reserved_micros>account.remaining_micros||amount+retained>account.limit_micros)throw Error('shared budget exhausted');
 if(typeof checkpoint!=='function'||typeof transport!=='function')throw Error('supervised checkpoint and transport required');
 store.append('reservation',id,job,{reserved_micros:amount,request_hash,integration:'openrouter-private-v1',key_identity_hash:account.key_identity_hash,account,profile,request});
 store.append('usage',id+':dispatch',id,{status:'dispatched'});
 // A persisted dispatch marker before HTTP makes a lost/uncertain call non-repeatable.
 try{await checkpoint();}catch{store.append('usage',id+':halt',id,{status:'checkpoint_failed',halt:true});throw Error('private checkpoint failed before dispatch; retain liability, stop');}
 let result;
 validateRequest(request,profile,store.clock());
 if(store.events().some(e=>e.kind==='usage'&&e.body.halt===true))throw Error('study halted before HTTP');
 const dispatchAt=store.clock(),deadline=store.read(job)?.body?.kickoff_at_utc;
 if(!deadline||epochMicros(dispatchAt)>=epochMicros(deadline)||epochMicros(dispatchAt)-epochMicros(account.observed_at_utc)>120000000n)throw Error('late or stale dispatch after checkpoint; retain liability');
 if(kind!=='synthetic_verification')assertRuntime(runtime,dispatchAt);
 let receivedResponse=false;
 try{
  const raw=await transport(request.body,request);receivedResponse=true;
  store.append('usage',id+':raw',id,{status:'provider_response',response:raw});
  result={status:'response',...parseResponse(request.arm,raw,profile,request.evidence_refs)};
 }catch(error){
  result={status:'failed',reason:'provider_or_response_failure',actual_micros:null,...(Number.isInteger(error.status_code)?{http_status:error.status_code}:{}),...(receivedResponse?{halt:true}:{})};
 }
 store.append('usage',id+':result',id,result);
 // Failure of the post-request checkpoint must stop all subsequent requests.
 try{await checkpoint();}catch{store.append('usage',id+':halt',id,{status:'checkpoint_failed',halt:true});throw Error('private checkpoint failed after dispatch; retain liability, stop');}
 return result;
}
