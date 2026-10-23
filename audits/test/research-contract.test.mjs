import test from 'node:test';
import assert from 'node:assert/strict';
import {observationAvailableAtIssue,selectAsOfObservation,
  fixedResearchCohort,evaluateMatchedForecasts} from '../lib/research-contract.mjs';
const issue='2026-10-20T12:00:00Z',kickoff='2026-10-21T12:00:00Z';
const obs=(id,at,playedAt=null)=>({id,observedAt:at,playedAt});
const row=(fixtureId,baseline=[.5,.3,.2],candidate=[.6,.25,.15],actual='1',
 extra={})=>({fixtureId,issuedAt:issue,kickoffAt:kickoff,baseline,candidate,actual,...extra});
test('as-of feature requires explicit first-observed timestamp',()=>{
 assert.equal(observationAvailableAtIssue({observedAt:null,issueAt:issue}),false);
 assert.equal(observationAvailableAtIssue({observedAt:'2026-10-20T11:00:00Z',issueAt:issue}),true);
 assert.equal(observationAvailableAtIssue({observedAt:'2026-10-20T13:00:00Z',issueAt:issue}),false);
});
test('completed historical fixture must precede its observation and issuance',()=>{
 assert.equal(observationAvailableAtIssue({observedAt:'2026-10-20T11:00:00Z',issueAt:issue,
  playedAt:'2026-10-18T16:00:00Z'}),true);
 assert.equal(observationAvailableAtIssue({observedAt:'2026-10-20T11:00:00Z',issueAt:issue,
  playedAt:'2026-10-20T11:30:00Z'}),false);
 assert.equal(observationAvailableAtIssue({observedAt:'2026-10-20T11:00:00Z',issueAt:issue,
  playedAt:'2026-10-21T00:00:00Z'}),false);
});
test('as-of selection excludes overwritten future historical data',()=>{
 const input=[obs(3,'2026-10-20T13:00:00Z'),obs(1,'2026-10-18T10:00:00Z'),
   obs(2,'2026-10-20T10:00:00Z')];
 assert.equal(selectAsOfObservation(input,issue).id,2);
 assert.equal(selectAsOfObservation([input[0]],issue),null);
});
test('timestamps require explicit UTC offset for trustworthy cross-timezone tests',()=>{
 assert.equal(observationAvailableAtIssue({observedAt:'2026-10-20T11:00:00',issueAt:issue}),false);
 assert.equal(fixedResearchCohort('2026-11-01T00:00:00'),null);
});
test('predeclared split uses ISSUANCE date, not match or settlement date',()=>{
 assert.equal(fixedResearchCohort('2026-09-30T23:59:59Z'),'development');
 assert.equal(fixedResearchCohort('2026-10-01T00:00:00Z'),'exploratory');
 assert.equal(fixedResearchCohort('2026-11-01T00:00:00Z'),'prospective');
});
test('perfectly unchanged candidate has exactly zero paired differences',()=>{
 const out=evaluateMatchedForecasts([row(1,[.6,.25,.15],[.6,.25,.15])]);
 assert.equal(out.diffBrier,0);assert.equal(out.diffLogLoss,0);assert.equal(out.brierSe,null);
});
test('candidate beating reference is negative loss difference',()=>{
 const out=evaluateMatchedForecasts([row(1),row(2,[.5,.3,.2],[.6,.25,.15])]);
 assert.ok(out.diffBrier<0);
 assert.ok(out.diffLogLoss<0);
 assert.ok(out.brierCI95.length===2);
});
test('no cross-fixture or timing leakage can be silently ignored',()=>{
 assert.throws(()=>evaluateMatchedForecasts([row(1),row(1)]),/duplicate/);
 assert.throws(()=>evaluateMatchedForecasts([row(1,undefined,undefined,'1',{issuedAt:kickoff})]),/pre-kickoff/);
});
test('candidate never gets post-publication features in the evaluator',()=>{
 assert.throws(()=>evaluateMatchedForecasts([
  row(1,undefined,undefined,'1',{featureEvidence:[obs(1,'2026-10-20T13:00:00Z')]})
 ]),/feature observation/);
});
test('invalid probability vectors cannot be included in score calculations',()=>{
 assert.throws(()=>evaluateMatchedForecasts([row(1,[.6,.6,.6])]),/invalid probability/);
});
test('unseen future cohort can be counted but not blended into development',()=>{
 const out=evaluateMatchedForecasts([row(1),row(2,undefined,undefined,'1',
  {issuedAt:'2026-11-02T12:00:00Z',kickoffAt:'2026-11-03T12:00:00Z'})]);
 assert.equal(out.cohortCounts.prospective,1);
 assert.equal(out.cohortCounts.exploratory,1);
 assert.equal(out.cohortCounts.development,0);
});
