import test from 'node:test';
import assert from 'node:assert/strict';
import {fixturePayload,testPrivateKey,testPolicy}from '../test-support/phase7.mjs';
import {sealDataset,sealFreeze,sourceVersions,rawHash}from '../phase7/attestation.mjs';
import {canonicalHash}from '../lib/snapshot-contract.mjs';
const api=await import('../phase7/train.mjs').catch(()=>({}));
const evaluation=await import('../phase7/evaluate.mjs').catch(()=>({}));
const fitConfig={version:'synthetic-beta-v1',train_start_utc:'2026-10-01T00:00:00Z',fit_cutoff_utc:'2026-10-03T00:00:00Z',minimum_examples:20};
const validationConfig={start_utc:'2026-10-04T00:00:00Z',end_utc:'2026-10-05T00:00:00Z',label_cutoff_utc:'2026-10-05T22:00:00Z'};
const packet=opts=>sealDataset(fixturePayload(sourceVersions(),opts),testPrivateKey,testPolicy.key_id);
function freeze(artifact,at='2026-10-03T00:00:01Z',config=validationConfig){return sealFreeze({dataset_kind:'synthetic_verification',source:{source_id:testPolicy.source_id,clock_domain:testPolicy.clock_domain},artifact_hash:artifact.artifact_hash,training_dataset_hash:artifact.training_dataset_hash,protocol_hash:canonicalHash(config),registered_at_utc:at},testPrivateKey,testPolicy.key_id);}
test('bounded one-parameter fit matches independently known conditional MLE and is reproducible',()=>{
 assert.equal(typeof api.fitCoefficient,'function');const p=packet(),a=api.fitCoefficient(p,testPolicy,fitConfig);
 assert.equal(a.status,'fitted');assert.ok(Math.abs(a.beta-Math.log(2))<1e-9);
 assert.equal(a.production_ready,false);assert.equal(a.artifact_kind,'synthetic_training');assert.equal(a.training.n,30);
 assert.deepEqual(a,api.fitCoefficient(p,testPolicy,fitConfig));assert.equal(a.trainer_source_hash.length,64);
 const reverse=fixturePayload(sourceVersions());for(const r of reverse.examples){const l=r.settlements[0],b=JSON.parse(l.envelope_text);[b.fixture.gh,b.fixture.ga]=[b.fixture.ga,b.fixture.gh];[b.fixture.ft_h,b.fixture.ft_a]=[b.fixture.ft_a,b.fixture.ft_h];l.envelope_text=JSON.stringify(b);l.payload_hash=rawHash(l.envelope_text);}
 assert.ok(Math.abs(api.fitCoefficient(sealDataset(reverse,testPrivateKey,testPolicy.key_id),testPolicy,fitConfig).beta+Math.log(2))<1e-9);
});
test('insufficient or unidentifiable data explicitly abstains rather than forcing a coefficient',()=>{
 assert.equal(api.fitCoefficient(packet({n:10}),testPolicy,fitConfig).reason,'insufficient_examples');
 assert.equal(api.fitCoefficient(packet({homeXg:1}),testPolicy,fitConfig).reason,'unidentifiable_feature');
});
test('training cannot use an export created after its cutoff or invalid overlapping periods',()=>{
 assert.throws(()=>api.fitCoefficient(packet({exported:'2026-10-04T00:00:00Z'}),testPolicy,fitConfig),/export|cutoff/);
 assert.throws(()=>api.fitCoefficient(packet(),testPolicy,{...fitConfig,train_start_utc:fitConfig.fit_cutoff_utc}),/chronolog|period/);
});
test('validation uses frozen coefficient and signed server registration before every issue',()=>{
 const a=api.fitCoefficient(packet(),testPolicy,fitConfig),v=packet({start:'2026-10-04',exported:'2026-10-05T23:00:00Z',prefix:20000});
 const before=JSON.stringify(a),out=evaluation.validateCoefficient(a,freeze(a),v,testPolicy,validationConfig);
 assert.equal(out.coverage.roster,30);assert.equal(out.coverage.scored,30);assert.equal(out.confirmatory_eligible,false);
 assert.equal(JSON.stringify(a),before);assert.ok(out.comparisons.original_vs_candidate.n===30);
 assert.throws(()=>evaluation.validateCoefficient(a,freeze(a,'2026-10-04T13:00:00Z'),v,testPolicy,validationConfig),/freeze|registration/);
 assert.throws(()=>evaluation.validateCoefficient(a,freeze(a),v,testPolicy,{...validationConfig,end_utc:'2026-10-06T00:00:00Z'}),/protocol/);
 assert.throws(()=>evaluation.validateCoefficient(a,freeze(a),packet({start:'2026-10-04',exported:'2026-10-05T23:00:00Z'}),testPolicy,validationConfig),/overlap/);
});
test('validation feature failures retain original baseline scoring and all denominators',()=>{
 const a=api.fitCoefficient(packet(),testPolicy,fitConfig);
 const out=evaluation.validateCoefficient(a,freeze(a),packet({start:'2026-10-04',exported:'2026-10-05T23:00:00Z',prefix:20000,historyCount:4}),testPolicy,validationConfig);
 assert.equal(out.coverage.scored,30);assert.equal(out.coverage.fallbacks,30);assert.equal(out.coverage.feature_eligible,0);
 assert.equal(out.comparisons.original_vs_candidate.brier_difference,0);
});
