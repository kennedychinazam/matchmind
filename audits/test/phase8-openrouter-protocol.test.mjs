import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../phase8-continuation/protocol.mjs').catch(()=>({}));
test('AI evidence is a lossless frozen competition view, identical across models without engine or odds leakage',()=>{
 assert.equal(typeof api.evidenceView,'function');const source={rows:[{fxid:1,lid:39,date:'2026-10-25',home:'A',away:'B',status:'NS',xg_h:null},{fxid:2,lid:39,date:'2026-01-01',home:'B',away:'C',status:'FT',xg_h:1.2},{fxid:3,lid:40,date:'2026-01-01',home:'D',away:'E',status:'FT'}],odds:[{fxid:1,h:2}],originals:[{fxid:1,p_home:.8}]};
 const v=api.evidenceView(source,1,'2026-10-25T08:00:00Z');assert.equal(v.facts.length,1);assert.equal(v.facts[0].data.rows.length,2);
 assert.equal(v.facts[0].data.columns.includes('xg_h'),true);assert.equal(JSON.stringify(v).includes('p_home'),false);assert.equal(v.facts[0].data.rows[1][v.facts[0].data.columns.indexOf('xg_h')],1.2);
 assert.throws(()=>api.evidenceView(source,99,'2026-10-25T08:00:00Z'),/fixture/);
});
test('Sunday admission cannot use Saturday clocks, missing recovery or replace the real engine',()=>{
 assert.equal(typeof api.admitSunday,'function');const guard={recoveryVerified:true,externalCopyVerified:true,supervised:true,kind:'football'};
 assert.doesNotThrow(()=>api.admitSunday(guard,'2026-10-25T08:00:00Z'));
 assert.throws(()=>api.admitSunday(guard,'2026-10-24T23:59:59Z'),/Sunday/);
 assert.throws(()=>api.admitSunday({...guard,recoveryVerified:false},'2026-10-25T08:00:00Z'),/recovery/);
 assert.throws(()=>api.admitSunday({...guard,engine:()=>{}},'2026-10-25T08:00:00Z'),/engine/);
});
test('reports retain original, Saturday, Sunday and model-specific denominators with unknown billing explicit',()=>{
 assert.equal(typeof api.evaluateContinuation,'function');
 const study={study:{started_at_utc:'2026-10-24T09:00:00Z'},reserved_micros:500000,actual_paid_micros:null,records:[]};
 for(const[cohort,model]of [['saturday',null],['sunday-engine',null],['sunday-ai','openai/gpt-6-luna'],['sunday-ai','moonshotai/kimi-k2.5']])study.records.push({job_id:cohort+model,fixture_id:'1',cohort,provider_model:model,window:cohort==='saturday'?'2026-10-24':'2026-10-25',kickoff_at_utc:'2026-10-25T15:00:00Z',forecasts:[{arm:'E-Refreshed',status:'forecast',generated_at_utc:cohort==='saturday'?'2026-10-24T10:00:00Z':'2026-10-25T10:00:00Z',received_at_utc:cohort==='saturday'?'2026-10-24T10:00:01Z':'2026-10-25T10:00:01Z',probabilities:[.5,.3,.2]}],labels:[{revision:1,received_at_utc:'2026-10-25T17:00:00Z',fixture:{date:'2026-10-25',time:'15:00',status:'FT',gh:1,ga:0}}]});
 const report=api.evaluateContinuation(study,'2026-10-26T08:00:00Z');assert.equal(report.saturday.coverage.roster,1);assert.equal(report.sunday.coverage.roster,1);assert.equal(report.models['openai/gpt-6-luna'].arms.A3.missing,1);assert.equal(report.saturday_vs_sunday.n,1);assert.equal(report.actual_ai_spend_usd,null);assert.equal(report.accuracy_claim,false);
});
test('interrupted enrollment remains in every model denominator without inventing forecasts or receipt times',()=>{
 assert.equal(typeof api.continuationStudy,'function');const roster=[1,2].map(id=>({fixture_id:String(id),league:39,kickoff_at_utc:'2026-10-25T15:00:00Z',original:null}));
 const events=[{kind:'study',event_id:'sunday:test',received_at:'2026-10-25T08:00:00Z',body:{version:'weekend-v1',experiment:'openrouter-private-v1',roster}},{kind:'job',event_id:'sunday:test:1:engine',parent_id:'p',body:{...roster[0],cohort:'sunday-engine',window:'2026-10-25'}}];
 const study=api.continuationStudy(events,new Map());assert.equal(study.records.length,6);assert.equal(study.records.filter(r=>r.missing_enrollment).length,5);
 const report=api.evaluateContinuation(study,'2026-10-26T08:00:00Z');assert.equal(report.models['openai/gpt-6-luna'].coverage.roster,2);assert.equal(report.models['openai/gpt-6-luna'].arms.A3.failed,2);assert.equal(report.sunday.coverage.roster,2);
 assert.equal(study.records.filter(r=>r.missing_enrollment).some(r=>r.forecasts.some(f=>f.generated_at_utc)),false);
});
test('outcome collection takes the continuation view so a continuation journal keeps its declared roster denominator',async()=>{
 assert.equal(typeof api.resultsView,'function');assert.equal(typeof api.resultsReport,'function');
 const roster=[1,2].map(id=>({fixture_id:String(id),league:39,kickoff_at_utc:'2026-10-25T15:00:00Z',original:null}));
 const events=[{kind:'study',event_id:'sunday:test',received_at:'2026-10-25T08:00:00Z',body:{version:'weekend-v1',experiment:'openrouter-private-v1',roster}},{kind:'job',event_id:'sunday:test:1:engine',parent_id:'p',body:{...roster[0],cohort:'sunday-engine',window:'2026-10-25'}}];
 const view=api.resultsView({events:()=>events,read:()=>null});
 assert.equal(view.mode,'continuation');assert.equal(view.study.records.length,6);
 // The older single-cohort view sees only the one enrolled job.
 const {eventsToStudy}=await import('../phase8/report.mjs');
 assert.equal(eventsToStudy(events).records.length,1);
 const report=api.resultsReport(view,'2026-10-26T08:00:00Z');
 assert.equal(report.version,'openrouter-weekend-report-v1');assert.equal(report.sunday.coverage.roster,2);assert.equal(report.accuracy_claim,false);
 const weekend=[{kind:'study',event_id:'weekend-2026-10-24',received_at:'2026-10-24T09:00:00Z',body:{version:'weekend-v1'}},{kind:'job',event_id:'job-1',parent_id:'p',body:{fixture_id:'1',kickoff_at_utc:'2026-10-24T15:00:00Z',original:null}}];
 const plain=api.resultsView({events:()=>weekend,read:()=>null});
 assert.equal(plain.mode,'weekend');assert.equal(plain.study.records.length,1);
 assert.equal(api.resultsReport(plain,'2026-10-26T08:00:00Z').scorer_version,'weekend-report-v2');
 assert.throws(()=>api.resultsReport({mode:'guessed',study:plain.study},'2026-10-26T08:00:00Z'),/view mode/);
});
