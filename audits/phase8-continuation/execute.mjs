import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {CEILING,parseResponse,MODELS} from './contracts.mjs';
import {assertRuntime} from './transport.mjs';
// The existing weekend_events reservation authority is the SINGLE shared ledger.
// Model-specific jobs retain separate immutable A1/A2/A3 slots in the same private table.
export async function executeRequest(store,{id,job,request,profile},options){
 const now=store.clock(),{kind,account,checkpoint,transport,runtime}=options;
 if(kind!=='synthetic_verification'){
  if(kind!=='football'||now.slice(0,10)!=='2026-10-25'||options.supervised!==true||options.recoveryVerified!==true||options.externalCopyVerified!==true)throw Error('supervised Sunday/recovery admission absent');
  assertRuntime(runtime,now);
 }
 const{request_hash,...r}=request;
 const{profile_hash,...p}=profile;
 if(canonicalHash(r)!==request_hash||canonicalHash(p)!==profile_hash||profile_hash!==request.profile_hash||!MODELS.includes(profile.model)||request.body.model!==profile.model||request.body.provider?.only?.join()!==profile.tag||request.body.provider?.order?.join()!==profile.tag||request.body.provider?.allow_fallbacks!==false||request.body.tools?.length!==0||request.body.plugins?.length!==0||request.body.tool_choice!=='none'||request.body.max_tokens!==1024||request.body.response_format?.json_schema?.strict!==true)throw Error('request/profile hash or bounds invalid');
 if(epochMicros(now)-epochMicros(profile.observed_at_utc)>900000000n||epochMicros(profile.observed_at_utc)>epochMicros(now))throw Error('expired request profile');
 if(!account||!Number.isSafeInteger(account.usage_micros)||account.usage_micros<0||!Number.isSafeInteger(account.remaining_micros)||!Number.isSafeInteger(account.limit_micros)||account.limit_micros>CEILING||!account.observed_at_utc||epochMicros(now)<epochMicros(account.observed_at_utc)||epochMicros(now)-epochMicros(account.observed_at_utc)>120000000n)throw Error('stale or unverifiable account budget');
 if(store.read(id))throw Error('duplicate request reservation; never redispatch');
 const events=store.events(),existing=events.filter(e=>e.kind==='reservation');
 if(existing.some(e=>e.body.integration==='openrouter-private-v1'&&e.body.key_identity_hash!==account.key_identity_hash))throw Error('key identity changed; no ledger reset');
 const retained=store.reservedMicros();
 if(account.usage_micros>retained)throw Error('key usage absent from recovered ledger; reconcile lost history first');
 // Count provider usage AGAIN, conservatively, rather than infer overlap or refund failures.
 const amount=profile.reserved_micros+account.usage_micros;
 if(amount+retained>CEILING||profile.reserved_micros>account.remaining_micros||amount+retained>account.limit_micros)throw Error('shared budget exhausted');
 if(typeof checkpoint!=='function'||typeof transport!=='function')throw Error('supervised checkpoint and transport required');
 store.append('reservation',id,job,{reserved_micros:amount,request_hash,integration:'openrouter-private-v1',key_identity_hash:account.key_identity_hash,account,profile,request});
 store.append('usage',id+':dispatch',id,{status:'dispatched'});
 // A persisted dispatch marker before HTTP makes a lost/uncertain call non-repeatable.
 try{await checkpoint();}catch{throw Error('private checkpoint failed before dispatch; retain liability, stop');}
 let result;
 try{
  const raw=await transport(request.body,request);
  store.append('usage',id+':raw',id,{status:'provider_response',response:raw});
  result={status:'response',...parseResponse(request.arm,raw,profile,request.evidence_refs)};
 }catch{
  result={status:'failed',reason:'provider_or_response_failure',actual_micros:null};
 }
 store.append('usage',id+':result',id,result);
 // Failure of the post-request checkpoint must stop all subsequent requests.
 try{await checkpoint();}catch{throw Error('private checkpoint failed after dispatch; retain liability, stop');}
 return result;
}
