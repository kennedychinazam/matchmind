import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot}from '../test-support/synthetic.mjs';
import {freezeCandidate,evaluateJob}from '../phase6/core.mjs';
const api=await import('../phase6/report.mjs').catch(()=>({}));
const asOfUtc='2026-10-24T12:00:00Z';
const candidate=freezeCandidate({version:'report-v1',adapter_id:'identity-v1',configuration:{},frozen_at_utc:'2026-10-19T00:00:00Z',study_kind:'synthetic_verification'});
function record(id='456'){
 const s={...snapshot(),fixture_id:id,snapshot_id:id==='456'?snapshot().snapshot_id:'44444444-4444-4444-8444-444444444444'};
 const capture={payload_hash:'a'.repeat(64),capture_kind:'at_issue',manifest_hash:'b'.repeat(64)};
 const odds={observation_id:'odds-'+id,fixture_id:id,field_name:'odds_1x2',source_kind:'odds',availability:'observed',feature_schema_version:1,
  received_at_utc:'2026-10-20T11:00:00Z',observed_at_utc:'2026-10-20T11:00:00Z',value:{fxid:id,id:1,captured_at:'2026-10-20T10:00:00Z',mins_to_kick:100,h:2,d:3.3333333333333335,a:5}};
 return {job_id:'job-'+id,fixture_id:id,snapshot:s,capture,source_prediction:{fxid:id,lid:39,build:355,made_at:s.issue_time_utc,kickoff:'2026-10-21',ktime:'18:00',pick:'1X',p_home:.5,p_draw:.3,p_away:.2},
  result:evaluateJob({candidate,snapshot:s,capture,observations:[]}),observations:[odds],
  settlements:[{fixture_id:id,kind:'synthetic_verification',received_at_utc:'2026-10-22T00:00:00Z',revision:1,fixture:{date:'2026-10-21',time:'18:00',provider:'af',status:'AET',gh:2,ga:1,ft_h:1,ft_a:1}}]};
}
const input=records=>({candidate,records,attempts:[],asOfUtc});
test('report scores the same 90-minute fixture for both models and market',()=>{
 assert.equal(typeof api.buildReport,'function');const out=api.buildReport(input([record()]));
 assert.equal(out.coverage.roster,1);assert.equal(out.coverage.scored,1);assert.equal(out.coverage.market_pairs,1);
 assert.equal(out.comparisons.original_vs_candidate.n,1);
 assert.ok(Math.abs(out.metrics.original.brier-.78)<1e-12);
 assert.ok(Math.abs(out.metrics.original.log_loss+Math.log(.3))<1e-12);
 assert.equal(out.metrics.original.top1_accuracy,0);assert.equal(out.metrics.candidate.calibration.length,3);
 assert.equal(out.comparisons.original_vs_candidate.brier_difference,0);
 assert.equal(out.confirmatory_eligible,false);
});
test('missing snapshots, abstentions, missing outputs and retry attempts remain in coverage',()=>{
 const a=record();a.result={...a.result,status:'fallback',reason:'missing_evidence'};
 const b={...record('457'),snapshot:null,result:null};
 const out=api.buildReport({...input([a,b]),attempts:[{job_id:b.job_id,state:'failed',code:'capture_missing'},{job_id:b.job_id,state:'failed',code:'capture_missing'}]});
 assert.equal(out.coverage.roster,2);assert.equal(out.coverage.missing_snapshots,1);assert.equal(out.coverage.abstentions,1);
 assert.equal(out.coverage.attempt_events,2);assert.equal(out.coverage.abstention_rate,.5);assert.equal(out.coverage.market_pair_rate,.5);
});
test('post-issue, equal-time, stale, wrong-fixture or unverifiable odds never enter pairs',()=>{
 for(const patch of [{received_at_utc:'2026-10-20T12:00:00.000001Z'}, {received_at_utc:'2026-10-20T12:00:00Z',observed_at_utc:'2026-10-20T12:00:00Z'},
  {received_at_utc:'2026-10-18T10:00:00Z',observed_at_utc:'2026-10-18T10:00:00Z'}, {fixture_id:'99'}, {received_at_utc:null},
  {value:{fxid:'456',id:1,captured_at:'2026-10-20T13:00:00Z',mins_to_kick:1,h:2,d:3.3,a:5}}]) {
  const r=record();r.observations=[{...r.observations[0],...patch}];assert.equal(api.buildReport(input([r])).coverage.market_pairs,0);
 }
 const late=record();late.capture.capture_kind='late_import';assert.equal(api.buildReport(input([late])).coverage.market_pairs,0);
});
test('48-hour void boundary and settlement cutoff are preserved without future labels',()=>{
 const late=record();late.settlements[0].fixture.date='2026-10-23';
 assert.equal(api.buildReport(input([late])).coverage.voids,1);
 late.settlements[0].fixture.time='17:59';assert.equal(api.buildReport(input([late])).coverage.scored,1);
 const future=record();future.settlements[0].received_at_utc='2026-10-25T00:00:00Z';assert.equal(api.buildReport(input([future])).coverage.pending,1);
 const invalid=record();invalid.settlements[0].fixture.gh=-1;assert.equal(api.buildReport(input([invalid])).coverage.invalid_outcomes,1);
});
test('reproducibility, fixture uniqueness and source/result binding fail closed',()=>{
 const r=record();assert.equal(JSON.stringify(api.buildReport(input([r]))),JSON.stringify(api.buildReport(input([structuredClone(r)]))));
 assert.throws(()=>api.buildReport(input([r,r])),/duplicate/);
 assert.throws(()=>api.buildReport(input([{...r,fixture_id:'999'}])),/fixture/);
 assert.throws(()=>api.buildReport(input([{...r,result:{...r.result,configuration_hash:'0'.repeat(64)}}])),/lineage/);
 assert.throws(()=>api.buildReport(input([{...r,settlements:[{...r.settlements[0],fixture_id:'999'}]}])),/fixture/);
});
