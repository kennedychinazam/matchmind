import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshot } from '../test-support/synthetic.mjs';
import { canonicalHash } from '../lib/snapshot-contract.mjs';
const api = await import('../phase6/core.mjs').catch(()=>({}));
const spec = (adapter_id='identity-v1',configuration={})=>({version:'test-v1',adapter_id,configuration,frozen_at_utc:'2026-10-19T12:00:00Z',study_kind:'synthetic_verification'});
function evidence() {
 let seq=0;const rows=[];
 const add=(fixture_id,fields,played_at_utc=null)=>{for(const [field_name,value]of Object.entries(fields))rows.push({observation_id:String(++seq),fixture_id:String(fixture_id),field_name,value,availability:'observed',feature_schema_version:1,source_hash:'a'.repeat(64),payload_hash:canonicalHash(value),received_at_utc:'2026-10-20T10:00:00Z',observed_at_utc:'2026-10-20T10:00:00Z',effective_at_utc:null,played_at_utc});};
 add(456,{home:'Alpha',away:'Beta',lid:39,date:'2026-10-21',time:'18:00',status:'NS',season:2026});
 for(let i=1;i<=5;i++)add(i,{home:'Alpha',away:'Beta',lid:39,date:`2026-10-0${i}`,time:'18:00',status:'FINISHED',gh:2,ga:1,xg_h:1.4,xg_a:1,season:2026},`2026-10-0${i}T18:00:00Z`);
 return rows;
}
const job=(candidate)=>({candidate,snapshot:snapshot(),capture:{payload_hash:'a'.repeat(64),capture_kind:'at_issue',manifest_hash:'b'.repeat(64),source_prediction:{home:'Alpha',away:'Beta',lid:39}},observations:evidence()});
test('candidate registration freezes configuration/source and detects later edits',()=>{
 assert.equal(typeof api.freezeCandidate,'function');
 const s=spec(), c=api.freezeCandidate(s);s.configuration.changed=true;
 assert.deepEqual(c.configuration,{});assert.equal(c.candidate_id.length,64);
 assert.equal(c.executor_sha256.length,64);
 assert.throws(()=>{c.configuration.x=1;},TypeError);
 assert.throws(()=>api.evaluateJob({...job({...c,version:'changed'})}),/candidate/);
 assert.throws(()=>api.evaluateJob({...job({...c,executor_sha256:'0'.repeat(64)})}),/candidate/);
 assert.throws(()=>api.freezeCandidate(spec('unknown')),/adapter/);
});
test('identity adapter preserves frozen rounded probabilities and never mutates originals',()=>{
 const j=job(api.freezeCandidate(spec()));j.snapshot.probabilities=[.3333,.3333,.3333];
 const before=structuredClone(j), r=api.evaluateJob(j);
 assert.deepEqual(j,before);assert.deepEqual(r.probabilities,j.snapshot.probabilities);
 assert.equal(r.visibility,'shadow');assert.equal(r.confirmatory_eligible,false);
 assert.deepEqual(r,api.evaluateJob(j));assert.equal(r.baseline_payload_hash,j.capture.payload_hash);
});
test('xgEdge uses existing M14 features and synthetic coefficient cannot become a real candidate',()=>{
 const c=api.freezeCandidate(spec('m14-xgedge-v1',{artifact_kind:'synthetic',beta:.1}));
 const r=api.evaluateJob(job(c));
 assert.ok(Math.abs(r.diagnostics.xgEdge-.8)<1e-10);
 assert.equal(r.probabilities[1],.3);assert.ok(r.probabilities[0]>.5);
 const historical=api.freezeCandidate({...spec('m14-xgedge-v1',{artifact_kind:'synthetic',beta:.1}),study_kind:'historical_exploratory'});
 const abstain=api.evaluateJob(job(historical));
 assert.equal(abstain.reason,'unverified_model_artifact');assert.deepEqual(abstain.probabilities,[.5,.3,.2]);
});
test('missing or late historical evidence abstains with exact baseline, not zero xG',()=>{
 const c=api.freezeCandidate(spec('m14-xgedge-v1',{artifact_kind:'synthetic',beta:.1}));
 for(const patch of [{received_at_utc:'2026-10-20T12:00:00.000001Z',observed_at_utc:'2026-10-20T12:00:00.000001Z'},
  {received_at_utc:'2026-10-20T12:00:00.000000Z',observed_at_utc:'2026-10-20T12:00:00.000000Z'},
  {received_at_utc:'2026-10-20T13:00:00Z'}, {observed_at_utc:null}, {observed_at_utc:'2026-02-30T00:00:00Z'}]) {
  const j=job(c);j.observations=j.observations.map(o=>o.field_name.startsWith('xg_')?{...o,...patch}:o);
  const r=api.evaluateJob(j);assert.equal(r.status,'fallback');assert.deepEqual(r.probabilities,j.snapshot.probabilities);
 }
 const j=job(c);j.capture.capture_kind='late_import';
 assert.equal(api.evaluateJob(j).reason,'unverified_capture');
 const wrong=job(c);wrong.capture.source_prediction.home='Different team';
 assert.equal(api.evaluateJob(wrong).reason,'target_identity_mismatch');
});
test('candidate failures and invalid probabilities produce deterministic explicit fallback',()=>{
 for(const execute of [()=>{throw Error('PRIVATE SECRET must not be persisted');},()=>[.9,.9,.9]]) {
  const registry={'failure-v1':{sha256:'c'.repeat(64),execute,validate:()=>{}}};
  const c=api.freezeCandidate(spec('failure-v1'),registry),j=job(c);
  const r=api.evaluateJob(j,registry);
  assert.equal(r.reason,'candidate_execution_failed');assert.deepEqual(r.probabilities,j.snapshot.probabilities);
  assert.ok(!JSON.stringify(r).includes('SECRET'));
 }
});
