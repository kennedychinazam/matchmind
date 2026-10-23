import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../test-support/synthetic.mjs';
const api=await import('../lib/shadow-forecast.mjs').catch(()=>({}));
const base=snapshot();
test('disabled and missing-input shadow forecasts equal baseline exactly',()=>{
 for(const enabled of [false,true]) {
  const r=api.shadowForecast({snapshot:base,inputs:{missing:['history'],manifest:{implementation_hash:'a'.repeat(64),selected:[]}},enabled,adjust:()=>{throw Error('must not call missing model');}});
  assert.deepEqual(r.probabilities,[.5,.3,.2]);assert.equal(r.pick,'1X');assert.equal(r.visibility,'shadow');assert.ok(r.fallback_reason);
 }
});
test('shadow output cannot mutate original baseline or become publicly visible',()=>{
 const b=structuredClone(base);
 const r=api.shadowForecast({snapshot:b,inputs:{missing:[],features:{restH:3},manifest:{selected:[]}},enabled:true,adjust:(p)=>{p[0]=.6;return [.6,.25,.15];}});
 assert.deepEqual(b,base);assert.deepEqual(r.probabilities,[.6,.25,.15]);assert.equal(r.visibility,'shadow');assert.equal(r.pick,'1X');
});
test('malformed candidate output fails and UTC cohort follows issue instant',()=>{
 assert.throws(()=>api.shadowForecast({snapshot:base,inputs:{missing:[],features:{},manifest:{}},enabled:true,adjust:()=>[.9,.8,.2]}),/probabil/);
 const r=api.shadowForecast({snapshot:{...base,issue_time_utc:'2026-11-01T01:00:00+01:00',kickoff_at_utc:'2026-11-02T18:00:00Z'},inputs:{missing:[],manifest:{}},enabled:false});
 assert.equal(r.cohort,'prospective');assert.equal(r.confirmatory_eligible,false);
});
