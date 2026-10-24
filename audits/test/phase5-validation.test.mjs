import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../phase5/validation.mjs').catch(()=>({}));
test('recalibration identity and zero market weight preserve frozen rounded outputs',()=>{assert.equal(typeof api.transform,'function');const p=[.3333,.3333,.3333],copy=[...p];assert.deepEqual(api.transform(p),p);assert.deepEqual(api.blend(p,[.5,.3,.2],0),p);assert.deepEqual(p,copy);assert.ok(Math.abs(api.transform([.6,.3,.1],{alpha:.5}).reduce((a,b)=>a+b)-1)<1e-12);});
test('invalid probabilities and future model/label rows fail closed',()=>{assert.throws(()=>api.transform([null,.5,.5]),/probability/);assert.throws(()=>api.blend([.5,.3,.2],[.4,.3,.3],1.1),/weight/);const r={issued_at:'2026-09-01T00:00:00Z',current_kickoff_at:'2026-09-02T00:00:00Z',label_updated_at:'2026-10-02T00:00:00Z'};assert.equal(api.legacyTrainingProxy([r],'2026-10-01T00:00:00Z').length,0);assert.equal(api.legacyTrainingProxy([{...r,label_updated_at:'2026-09-03T00:00:00Z'}],'2026-10-01T00:00:00Z').length,1);});
test('timing prerequisite rejects missing receipt, post-issue microsecond and late freeze',()=>{const x={issuedAt:'2026-11-02T12:00:00.000000Z',frozenAt:'2026-10-30T00:00:00Z',startAt:'2026-11-01T00:00:00Z',receivedAt:'2026-11-02T11:59:59.999999Z'};assert.equal(api.shadowTimingEligible(x),true);assert.equal(api.shadowTimingEligible({...x,receivedAt:null}),false);assert.equal(api.shadowTimingEligible({...x,receivedAt:'2026-11-02T12:00:00.000001Z'}),false);assert.equal(api.shadowTimingEligible({...x,frozenAt:'2026-11-03T00:00:00Z'}),false);assert.equal(api.shadowTimingEligible({...x,receivedAt:'2026-02-30T00:00:00Z'}),false);});
test('paired scoring uses sum-Brier and keeps clustered resamples paired',()=>{
  const rows=[
    {id:'a',issued_at:'2026-09-01T00:00:00Z',league:1,actual:'1',model:[.6,.3,.1],candidate:[.7,.2,.1]},
    {id:'b',issued_at:'2026-09-09T00:00:00Z',league:2,actual:'X',model:[.2,.5,.3],candidate:[.2,.6,.2]}
  ];
  const out=api.paired(rows,r=>r.model,r=>r.model,{draws:100});
  assert.equal(out.n,2);
  assert.equal(out.brier_difference,0);
  assert.deepEqual(out.week_bootstrap.brier,[0,0]);
  assert.equal(out.reference_brier,.32);
  const improved=api.paired(rows,r=>r.model,r=>r.candidate,{draws:100});
  assert.ok(Math.abs(improved.brier_difference+.13)<1e-12);
  assert.ok(Math.abs(improved.log_loss_difference-Math.log(.3/.42)/2)<1e-12);
  assert.ok(improved.week_bootstrap.brier.every(v=>v>=-.14000000001&&v<=-.11999999999));
  assert.deepEqual(improved,api.paired(rows,r=>r.model,r=>r.candidate,{draws:100}));
  assert.throws(()=>api.paired([rows[0],rows[0]],r=>r.model,r=>r.model),/duplicate/);
  assert.equal(api.paired(rows.slice(0,1),r=>r.model,r=>r.model).week_bootstrap.brier,null);
});
test('class bins show sample sizes and Wilson intervals without treating missing as zero',()=>{const rows=[{actual:'1',model:[.6,.3,.1]},{actual:'X',model:[.2,.5,.3]}];const out=api.calibration(rows,r=>r.model);assert.equal(out.length,3);assert.equal(out[0].n,2);assert.equal(out[0].observed,.5);assert.ok(out[0].bins.every(b=>b.n>0&&b.event_ci.length===2));});
test('training-only selection cannot use later labels or evaluation fixtures',()=>{
  assert.equal(typeof api.fitCandidates,'function');
  const rows=Array.from({length:110},(_,i)=>({id:String(i),actual:i%2?'1':'X',model:[.6,.3,.1],market:[.5,.4,.1],issued_at:'2026-09-01T00:00:00Z',current_kickoff_at:'2026-09-02T00:00:00Z',label_updated_at:'2026-09-04T00:00:00Z'}));
  const future={...rows[0],id:'future',actual:'2',label_updated_at:'2026-11-01T00:00:00Z'};
  assert.deepEqual(api.fitCandidates(rows,'2026-10-01T00:00:00Z'),api.fitCandidates([...rows,future],'2026-10-01T00:00:00Z'));
  assert.equal(api.fitCandidates(rows.slice(0,10),'2026-10-01T00:00:00Z').calibration,null);
});
test('calibration ranking handles probability ties and empty cohorts explicitly',()=>{
  const rows=[{actual:'1',model:[.5,.25,.25]},{actual:'X',model:[.5,.25,.25]}];
  assert.equal(api.calibration(rows,r=>r.model)[0].auc,.5);
  assert.equal(api.calibration([],r=>r.model)[0].observed,null);
  assert.equal(api.paired([],r=>r.model,r=>r.model).candidate_brier,null);
});
