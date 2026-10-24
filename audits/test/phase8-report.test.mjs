import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../phase8/report.mjs').catch(()=>({}));
const issue='2026-10-24T10:00:00Z',kick='2026-10-24T15:00:00Z';
function sample(){return{study:{started_at_utc:'2026-10-24T09:00:00Z'},reserved_micros:100000,actual_paid_micros:0,records:[{job_id:'1',fixture_id:'1',window:'2026-10-24',kickoff_at_utc:kick,original:{made_at:'2026-10-23T00:00:00Z',p_home:.6,p_draw:.2,p_away:.2},forecasts:[{arm:'E-Refreshed',status:'forecast',generated_at_utc:issue,received_at_utc:issue,input_hash:'a'.repeat(64),probabilities:[.5,.3,.2]},{arm:'A1',status:'failed',reason:'provider_unverified'},{arm:'A2',status:'forecast',veto:true,generated_at_utc:issue,received_at_utc:issue,input_hash:'a'.repeat(64)}],odds:[{id:1,fxid:1,mins_to_kick:300,h:2,d:3.3,a:4,captured_at:'2026-10-24T08:00:00Z',received_at_utc:'2026-10-24T09:30:00Z'}],labels:[{revision:1,received_at_utc:'2026-10-24T17:10:00Z',fixture:{provider:'af',date:'2026-10-24',time:'15:00',status:'FT',gh:1,ga:0}}]}]};}
test('report separates prior originals, missing arms, vetoes and identical paired score cohorts',()=>{
 assert.equal(typeof api.evaluateWeekend,'function');const r=api.evaluateWeekend(sample(),'2026-10-26T12:00:00Z');
 assert.equal(r.coverage.roster,1);assert.equal(r.arms['E-Refreshed'].n,1);assert.equal(r.arms.A1.failed,1);assert.equal(r.arms.A3.missing,1);
 assert.equal(r.coverage.originals_before_collection,1);assert.equal(r.arms.E.n,0);assert.equal(r.original_context.n,1);
 assert.equal(r.comparisons.original_context_vs_E_Refreshed.n,1);assert.equal(r.comparisons.original_context_vs_E_Refreshed.prospective_eligible,false);
 assert.equal(r.arms.A2.vetoed,1);assert.equal(r.arms.A2.n,0);assert.equal(r.comparisons['E-Refreshed_vs_market'].n,1);
 assert.equal(r.actual_ai_spend_usd,0);assert.equal(r.ai_cost_per_success_usd,null);assert.equal(r.accuracy_claim,false);
});
test('future labels and odds, late forecasts, negative scores and ambiguous extra time never enter scores',()=>{
 const p=sample();p.records[0].labels[0].received_at_utc='2026-10-27T00:00:00Z';assert.equal(api.evaluateWeekend(p,'2026-10-26T12:00:00Z').arms['E-Refreshed'].n,0);
 const q=sample();q.records[0].odds[0].received_at_utc='2026-10-24T11:00:00Z';assert.equal(api.evaluateWeekend(q,'2026-10-26T12:00:00Z').comparisons['E-Refreshed_vs_market'].n,0);
 for(const bad of [{status:'FT',gh:-1,ga:0},{status:'AET',gh:2,ga:1}]){const x=sample();Object.assign(x.records[0].labels[0].fixture,bad);assert.equal(api.evaluateWeekend(x,'2026-10-26T12:00:00Z').arms['E-Refreshed'].n,0);}
 const late=sample();late.records[0].forecasts[0].received_at_utc=kick;assert.equal(api.evaluateWeekend(late,'2026-10-26T12:00:00Z').arms['E-Refreshed'].n,0);
});
test('48-hour moved-match void, corrections, pair reproducibility and empty cohorts remain explicit',()=>{
 const x=sample();x.records[0].labels[0].fixture.date='2026-10-26';x.records[0].labels[0].received_at_utc='2026-10-26T17:00:00Z';
 assert.equal(api.evaluateWeekend(x,'2026-10-26T18:00:00Z').coverage.void,1);
 const p=sample();assert.deepEqual(api.evaluateWeekend(p,'2026-10-26T12:00:00Z'),api.evaluateWeekend(p,'2026-10-26T12:00:00Z'));
 const e=api.evaluateWeekend({...p,records:[]},'2026-10-26T12:00:00Z');assert.equal(e.coverage.roster,0);assert.equal(e.arms.A1.brier,null);
});
test('AI comparisons require the same frozen input; unknown usage is not zero spending',()=>{
 const p=sample(),r=p.records[0];r.forecasts[0].input_hash='a'.repeat(64);
 r.forecasts.push({arm:'A3',status:'forecast',generated_at_utc:issue,received_at_utc:issue,input_hash:'b'.repeat(64),probabilities:[.5,.3,.2]});
 const out=api.evaluateWeekend({...p,actual_paid_micros:1000000},'2026-10-26T12:00:00Z');
 assert.equal(out.comparisons['A3_vs_E-Refreshed'].n,0);assert.equal(out.arms.A3.unverified_input,1);assert.equal(out.arms.A3.coverage,0);assert.equal(out.ai_cost_per_success_usd,null);
 assert.equal(api.evaluateWeekend({...p,actual_paid_micros:null},'2026-10-26T12:00:00Z').actual_ai_spend_usd,null);
});
test('an unconfirmed database forecast is a visible failure, never an eligible issued probability',()=>{
 const p=sample(),r=p.records[0],events=[{event_id:'s',kind:'study',received_at:p.study.started_at_utc,body:{}},{event_id:'1',kind:'job',body:r},{event_id:'f',kind:'forecast',parent_id:'1',received_at:issue,body:{...r.forecasts[0],requires_confirmation:true}}];
 assert.equal(api.eventsToStudy(events,[]).records[0].forecasts[0].status,'failed');
 events.push({kind:'confirmation',parent_id:'f',received_at:'2026-10-24T10:00:01Z',body:{status:'accepted'}});
 assert.equal(api.eventsToStudy(events,[]).records[0].forecasts[0].status,'forecast');
});
test('bookmaker quotes require positive recorded minutes to kickoff as well as a genuine pre-issue receipt',()=>{
 const p=sample();p.records[0].odds[0].mins_to_kick=0;
 assert.equal(api.evaluateWeekend(p,'2026-10-26T12:00:00Z').comparisons['E-Refreshed_vs_market'].n,0);
});
test('original contextual predictions retain their own 48-hour kickoff anchor',()=>{
 const p=sample();p.records[0].original.kickoff='2026-10-22';p.records[0].original.ktime='15:00';
 const out=api.evaluateWeekend(p,'2026-10-26T12:00:00Z');assert.equal(out.arms['E-Refreshed'].n,1);assert.equal(out.original_context.n,0);
});
test('legacy minute-precision UTC kickoff is normalized only for comparison without rewriting frozen data',()=>{
 const p=sample();p.records[0].kickoff_at_utc='2026-10-24T15:00Z';const original=JSON.stringify(p);
 const out=api.evaluateWeekend(p,'2026-10-26T12:00:00Z');assert.equal(out.arms['E-Refreshed'].n,1);assert.equal(out.arms['E-Refreshed'].late,0);assert.equal(JSON.stringify(p),original);
 p.records[0].forecasts[0].received_at_utc='2026-10-24T10:00Z';assert.equal(api.evaluateWeekend(p,'2026-10-26T12:00:00Z').arms['E-Refreshed'].n,0);
});
test('private event export retains append-only labels and all job failures without packet duplication',()=>{
 assert.equal(typeof api.eventsToStudy,'function');const x=sample(),r=x.records[0];
 const events=[{event_id:'s',kind:'study',received_at:x.study.started_at_utc,body:{version:'weekend-v1'}},{event_id:'1',kind:'job',body:r},{kind:'forecast',parent_id:'1',received_at:issue,body:r.forecasts[0]},{kind:'label',parent_id:'1',received_at:r.labels[0].received_at_utc,body:{fixture:r.labels[0].fixture}}];
 const out=api.eventsToStudy(events,[]);assert.equal(out.records.length,1);assert.equal(out.records[0].labels.length,1);assert.equal(out.actual_paid_micros,0);
 assert.equal(api.evaluateWeekend(out,'2026-10-26T12:00:00Z').arms['E-Refreshed'].n,1);
});
