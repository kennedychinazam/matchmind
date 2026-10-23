import test from 'node:test';
import assert from 'node:assert/strict';
import {fairMarket,selectPreIssueSnapshot,probabilityScore,comparePair} from '../lib/bookmaker-metrics.mjs';
const at='2026-10-20T12:00:00Z';
const snap=(id,h=2,d=3,a=4,date='2026-10-20T10:00:00Z',other={})=>
  ({id,fxid:123,mins_to_kick:120,h,d,a,captured_at:date,...other});
test('de-vigged probabilities sum to one',()=>{
  const v=fairMarket({h:2,d:3,a:4});
  assert.ok(v);
  assert.ok(Math.abs(v.probabilities.reduce((a,b)=>a+b,0)-1)<1e-12);
  assert.ok(Math.abs(v.overround-(1/2+1/3+1/4))<1e-12);
});
test('invalid odds and implausible aggregate margin are rejected',()=>{
  for(const p of [{h:1,d:3,a:4},{h:null,d:3,a:4},{h:0,d:3,a:4},{h:1.01,d:1.01,a:1.01},
      {h:4,d:4,a:4}]) assert.equal(fairMarket(p),null);
});
test('newest pre-issue observation wins, never a future close',()=>{
  const x=selectPreIssueSnapshot([
    snap(1,2.3,3.2,3.5,'2026-10-20T09:00:00Z'),
    snap(3,2.1,3.1,3.8,'2026-10-20T13:00:00Z'),
    snap(2,2.0,3.0,4.0,'2026-10-20T11:59:59Z')
  ],123,at);
  assert.equal(x.snapshot.id,2);
});
test('negative lead time and different fixture ID cannot enter benchmark',()=>{
  assert.equal(selectPreIssueSnapshot([snap(1,2,3,4,at,{mins_to_kick:0})],123,at),null);
  assert.equal(selectPreIssueSnapshot([snap(1,2,3,4,at,{fxid:456})],123,at),null);
});
test('24-hour freshness boundary is inclusive; older is excluded',()=>{
  const old=snap(1,2,3,4,'2026-10-19T11:59:59Z');
  assert.equal(selectPreIssueSnapshot([old],123,at),null);
  const edge=snap(2,2,3,4,'2026-10-19T12:00:00Z');
  assert.equal(selectPreIssueSnapshot([edge],123,at)?.snapshot.id,2);
});
test('same-time odds observations break ties by latest snapshot id',()=>{
  const x=selectPreIssueSnapshot([snap(3),snap(9),snap(1)],123,at);
  assert.equal(x.snapshot.id,9);
});
test('full 1X2 Brier uses sum-of-three components',()=>{
  const s=probabilityScore([1/3,1/3,1/3],'X');
  assert.ok(Math.abs(s.brier-2/3)<1e-12);
  assert.ok(Math.abs(s.logLoss-Math.log(3))<1e-12);
});
test('scoring rejects missing and inconsistent probabilities',()=>{
  assert.equal(probabilityScore([.7,.3,.2],'1'),null);
  assert.equal(probabilityScore([.5,.5],'1'),null);
  assert.equal(probabilityScore([.5,.25,.25],'invalid'),null);
});
test('paired improvement sign is negative when engine is better',()=>{
  const v=comparePair([.7,.2,.1],[.4,.3,.3],'1');
  assert.ok(v.brierDifference<0);
  assert.ok(v.logLossDifference<0);
  const r=comparePair([.4,.3,.3],[.7,.2,.1],'1');
  assert.ok(r.brierDifference>0);
});
test('not enough information is excluded rather than imputed',()=>{
  assert.equal(comparePair([.3,.3,.4],null,'1'),null);
  assert.equal(selectPreIssueSnapshot(null,123,at),null);
});
