import test from 'node:test';
import assert from 'node:assert/strict';
const api = await import('../lib/snapshot-contract.mjs').catch(() => ({}));
const receipt='2026-10-20T12:00:00Z';
import {observation,snapshot} from '../test-support/synthetic.mjs';
test('snapshot contract exports validation functions',()=>assert.equal(typeof api.validateObservation,'function'));
test('new evidence uses authoritative receipt, rejects caller observation timestamps',()=>{
 const x=api.validateObservation(observation(),{receiptAt:receipt});
 assert.equal(x.observed_at_utc,'2026-10-20T12:00:00.000Z');
 assert.equal(x.received_at_utc,x.observed_at_utc);
 for(const k of ['observed_at_utc','received_at_utc']) assert.throws(()=>api.validateObservation({...observation(),[k]:'2020-01-01T00:00:00Z'},{receiptAt:receipt}),/unexpected/);
 assert.throws(()=>api.validateObservation(observation()),/receipt/);
});
test('unknown evidence remains null and cannot invent a value',()=>{
 const x=api.validateObservation({...observation(),availability:'unknown',value:null},{receiptAt:receipt});
 assert.equal(x.observed_at_utc,null);
 assert.throws(()=>api.validateObservation({...observation(),availability:'unknown'},{receiptAt:receipt}),/unknown/);
});
test('timestamp validation rejects ambiguous dates and normalizes valid offsets',()=>{
 assert.equal(api.utcInstant('2026-10-20T13:00:00+01:00'), '2026-10-20T12:00:00.000Z');
 for(const bad of ['2026-02-30T12:00:00Z','2026-10-20T12:00:00','2026-10-20T12:00:00+25:00','2026-10-20T24:00:00Z','junk']) assert.throws(()=>api.utcInstant(bad),/timestamp/);
});
test('completed evidence must follow play, future effective times fail closed',()=>{
 assert.throws(()=>api.validateObservation({...observation(),played_at_utc:receipt},{receiptAt:receipt}),/played/);
 assert.throws(()=>api.validateObservation({...observation(),effective_at_utc:'2026-10-21T00:00:00Z'},{receiptAt:receipt}),/effective/);
});
test('snapshot validation preserves rounded probabilities and original lineage',()=>{
 const x=api.validatePredictionSnapshot({...snapshot(),probabilities:[.3333,.3333,.3333]});
 assert.deepEqual(x.probabilities,[.3333,.3333,.3333]); assert.equal(x.prediction_build,355);
 assert.equal(x.pick,'1X'); assert.equal(x.issue_time_utc,'2026-10-20T12:00:00.000Z');
});
test('malformed probabilities and post-kickoff issuance are rejected',()=>{
 for(const p of [[.8,.8,.2],[.5,.5],['.5',.3,.2],[NaN,.3,.2],[-.1,.5,.6]]) assert.throws(()=>api.validatePredictionSnapshot({...snapshot(),probabilities:p}),/probabil|JSON/);
 assert.throws(()=>api.validatePredictionSnapshot({...snapshot(),kickoff_at_utc:receipt}),/kickoff/);
});
test('required fields, schema versions, extra fields and noncanonical identifiers are rejected',()=>{
 for(const patch of [{model_version:null},{feature_schema_version:2},{api_key:'forbidden'},{fixture_id:'1;drop'},{snapshot_id:'wrong'}]) assert.throws(()=>api.validatePredictionSnapshot({...snapshot(),...patch}));
});
test('canonical hashes are key-order independent but value/version sensitive',()=>{
 assert.equal(api.canonicalHash({a:1,b:[2,null]}),api.canonicalHash({b:[2,null],a:1}));
 assert.notEqual(api.canonicalHash({a:1}),api.canonicalHash({a:2}));
 for(const bad of [{a:undefined},{a:Infinity},new Date(),Array(2)]) assert.throws(()=>api.canonicalHash(bad),/JSON/);
});
test('field and envelope byte limits reject growth without truncation',()=>{
 assert.throws(()=>api.validateObservation({...observation(),value:'x'.repeat(16384)},{receiptAt:receipt}),/size/);
 assert.throws(()=>api.validatePredictionSnapshot({...snapshot(),model_version:'x'.repeat(65536)}),/size/);
});
