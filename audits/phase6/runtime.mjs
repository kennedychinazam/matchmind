import {evaluateJob}from './core.mjs';
import {performance}from 'node:perf_hooks';
// Operates only on an already declared private job. Never publishes or collects.
export function runJob(repo,candidate,job){
 let result=null,code='capture_missing',persisted=false,at;const timings={};
 try{
  if(job.snapshot_id){
   let input;
   at=performance.now();try{input=repo.load(job.snapshot_id);}catch{code='capture_unavailable';}timings.load_ms=performance.now()-at;
   if(input){
    at=performance.now();code='candidate_execution_failed';result=evaluateJob({candidate,...input});timings.adapter_ms=performance.now()-at;
    at=performance.now();code='persistence_failed';repo.save(result);timings.persist_ms=performance.now()-at;persisted=true;code=result.reason??'completed';
   }
  }
 }catch{/* Only safe fixed reason codes leave this boundary. */}
 let attempt_recorded=true;
 at=performance.now();try{repo.recordAttempt({job_id:job.job_id,state:persisted?'completed':'failed',code});}catch{attempt_recorded=false;}timings.monitor_ms=performance.now()-at;
 return {job_id:job.job_id,persisted,attempt_recorded,requires_repair:!persisted||!attempt_recorded,code,timings};
}
