// Pre-staged operating wrapper: no collector, authorization writer or automatic CLI.
import {readFileSync,readdirSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {privateDirectory} from '../phase8/files.mjs';
import {readPacketSource} from '../a3-workflow/contract.mjs';
import {dispatchOne} from './controller.mjs';
import {PRE_HTTP_POLICY} from './window.mjs';
const staged=new WeakMap();
const files=['execution.mjs','controller.mjs','transport.mjs','diagnostics.mjs','window.mjs','../phase8-continuation/checkpoint.mjs'];
const artifacts=()=>Object.fromEntries(files.map(name=>[name,canonicalHash(readFileSync(new URL(name,import.meta.url),'utf8'))]));
function durable(path,body,flags){const fd=openSync(path,flags,0o600);try{writeFileSync(fd,body);fsyncSync(fd);}finally{closeSync(fd);}}
export function assertStagedExecution(token,plan,authorization,options){
 const s=staged.get(token);if(!s)throw Error('execution_wrapper_not_staged_before_source_and_authorization');
 if(canonicalHash(JSON.parse(readFileSync(s.receipt_path,'utf8')))!==s.hash||canonicalHash(artifacts())!==canonicalHash(s.receipt.artifacts))throw Error('execution_wrapper_artifact_changed');
 const source=readPacketSource(plan.packet);
 // Packet source boundary and earliest collection observation are both checked.
 const earliest=source?.collection?.earliest_receipt_at_utc??source.source_read_at_utc??plan.packet.source.received_at_utc;
 if(epochMicros(s.receipt.prepared_at_utc)>=epochMicros(earliest)||epochMicros(s.receipt.prepared_at_utc)>=epochMicros(authorization.received_at))throw Error('execution_wrapper_not_staged_before_source_and_authorization');
 for(const name of ['checkpoint','verifyCheckpoint','refresh','transport','recordDiagnostic'])if(options[name]!==s.dependencies[name])throw Error('staged_dependencies_cannot_be_overridden');
}
export function stageExecution({directory,clock=()=>new Date().toISOString(),checkpoint,verifyCheckpoint,refresh,transport}){
 for(const fn of [clock,checkpoint,verifyCheckpoint,refresh,transport])if(typeof fn!=='function')throw Error('supervised_dependencies_required');
 const dir=privateDirectory(directory);if(readdirSync(dir).length)throw Error('empty_staging_directory_required');
 const prepared=clock();epochMicros(prepared);
 const receipt=Object.freeze({version:'a3-offline-wrapper-v1',prepared_at_utc:prepared,artifacts:Object.freeze(artifacts()),timing_policy:PRE_HTTP_POLICY,dispatch_authorized:false});
 const hash=canonicalHash(receipt),receipt_path=join(dir,'wrapper-stage.json');durable(receipt_path,JSON.stringify(receipt)+'\n','wx');durable(join(dir,'diagnostics.jsonl'),'','wx');
 const fd=openSync(dir,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
 const recordDiagnostic=row=>durable(join(dir,'diagnostics.jsonl'),JSON.stringify({...row,wrapper_stage_sha256:hash})+'\n','a');
 const dependencies={checkpoint,verifyCheckpoint,refresh,transport,recordDiagnostic},token=Object.freeze({version:'a3-offline-wrapper-v1'});
 staged.set(token,{receipt,receipt_path,hash,dependencies});let used=false;
 return Object.freeze({receipt,receipt_hash:hash,async run(plan,options){
  if(used)throw Error('execution_wrapper_already_used');used=true;
  for(const name of [...Object.keys(dependencies),'executionStage'])if(Object.hasOwn(options,name))throw Error('staged_dependencies_cannot_be_overridden');
  return dispatchOne(plan,{...options,...dependencies,executionStage:token});
 }});
}
