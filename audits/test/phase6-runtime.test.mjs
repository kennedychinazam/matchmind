import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot}from '../test-support/synthetic.mjs';
import {freezeCandidate}from '../phase6/core.mjs';
const api=await import('../phase6/runtime.mjs').catch(()=>({}));
const candidate=freezeCandidate({version:'runtime-v1',adapter_id:'identity-v1',configuration:{},frozen_at_utc:'2026-10-19T00:00:00Z',study_kind:'synthetic_verification'});
const loaded=()=>({snapshot:snapshot(),capture:{payload_hash:'a'.repeat(64),capture_kind:'at_issue',manifest_hash:'b'.repeat(64)},observations:[]});
test('declared execution records successful persistence and never publishes',()=>{
 assert.equal(typeof api.runJob,'function');const events=[],saved=[];
 const repo={load:loaded,save:r=>saved.push(r),recordAttempt:e=>events.push(e)};
 const out=api.runJob(repo,candidate,{job_id:'j',snapshot_id:snapshot().snapshot_id});
 assert.equal(out.persisted,true);assert.equal(events[0].state,'completed');assert.equal(saved.length,1);
 assert.ok(['load_ms','adapter_ms','persist_ms','monitor_ms'].every(k=>Number.isFinite(out.timings[k])&&out.timings[k]>=0));
});
test('missing snapshots and failed writes remain explicit repair work even when monitoring fails',()=>{
 for(const failMonitor of [false,true]){
  const events=[],repo={load:loaded,save(){throw Error('permission denied PRIVATE INPUT');},recordAttempt:e=>{if(failMonitor)throw Error('quota');events.push(e);}};
  const out=api.runJob(repo,candidate,{job_id:'j',snapshot_id:snapshot().snapshot_id});
  assert.equal(out.persisted,false);assert.equal(out.requires_repair,true);assert.equal(out.attempt_recorded,!failMonitor);
  assert.ok(!JSON.stringify(out).includes('PRIVATE'));
  const missing=api.runJob(repo,candidate,{job_id:'missing',snapshot_id:null});
  assert.equal(missing.code,'capture_missing');assert.equal(missing.persisted,false);
 }
});
