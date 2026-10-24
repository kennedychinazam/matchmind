import test from 'node:test';
import assert from 'node:assert/strict';
import {fixturePayload,testPrivateKey,testPolicy}from '../test-support/phase7.mjs';
const api=await import('../phase7/attestation.mjs').catch(()=>({}));
const samples=await import('../phase7/samples.mjs').catch(()=>({}));
const payload=()=>fixturePayload(api.sourceVersions());
const seal=p=>api.sealDataset(p,testPrivateKey,testPolicy.key_id);
test('external synthetic trust root binds content, source versions and dataset kind',()=>{
 assert.equal(typeof api.sealDataset,'function');const p=payload(),signed=seal(p);
 assert.equal(api.verifyDataset(signed,testPolicy).dataset_hash,signed.dataset_hash);
 assert.throws(()=>api.verifyDataset({...signed,payload:{...p,dataset_kind:'receipt_verified_football'}},testPolicy),/signature|hash|kind/);
 assert.throws(()=>api.verifyDataset(signed,{...testPolicy,key_id:'other'}),/trust|key/);
 assert.throws(()=>api.verifyDataset(seal({...p,dataset_kind:'receipt_verified_football'}),{...testPolicy,allowed_kind:'receipt_verified_football'}),/authority|synthetic/);
 assert.throws(()=>api.verifyDataset({...signed,signature:{...signed.signature,value:'bad'}},testPolicy),/signature/);
});
test('complete manifest and observation content are checked even for a signed export',()=>{
 const p=payload(),out=samples.prepareSamples(seal(p),testPolicy,'2026-10-03T00:00:00Z');
 assert.equal(out.eligible.length,30);assert.equal(out.eligible[0].xgEdge,1);
 const bad=payload();delete bad.observations[Object.keys(bad.observations)[0]];
 assert.throws(()=>samples.prepareSamples(seal(bad),testPolicy,'2026-10-03T00:00:00Z'),/manifest|observation/);
 const shortened=payload();shortened.examples[0].manifest.chunks[0].members.pop();
 assert.throws(()=>samples.prepareSamples(seal(shortened),testPolicy,'2026-10-03T00:00:00Z'),/manifest|chunk/);
 const dup=payload();dup.examples.push(dup.examples[0]);assert.throws(()=>samples.prepareSamples(seal(dup),testPolicy,'2026-10-03T00:00:00Z'),/duplicate/);
});
test('invalid, missing, equal or post-issue evidence receipts cannot enter training',()=>{
 for(const patch of [{received_at_utc:null},{received_at_utc:'2026-10-01T12:00:00.000001Z'},
  {observed_at_utc:'2026-10-01T12:00:00Z',received_at_utc:'2026-10-01T12:00:00Z'},
  {observed_at_utc:'2026-02-30T00:00:00Z'}, {played_at_utc:'2026-10-01T13:00:00Z'}]){
  const p=payload();const o=Object.values(p.observations).find(x=>x.field_name==='xg_h');Object.assign(o,patch);
  const out=samples.prepareSamples(seal(p),testPolicy,'2026-10-03T00:00:00Z');assert.equal(out.eligible.length,0);assert.equal(out.rejected.length,30);
 }
});
test('future corrections cannot replace a label visible at an earlier cutoff',()=>{
 const p=payload(),original=p.examples[0].settlements[0];
 const correction=JSON.parse(original.envelope_text);correction.fixture.gh=0;correction.fixture.ga=1;correction.fixture.ft_h=0;correction.fixture.ft_a=1;
 const c=awaitCorrection(correction,original);p.examples[0].settlements.push(c);
 p.exported_at_utc='2026-10-05T01:00:00Z';
 const before=samples.prepareSamples(seal(p),testPolicy,'2026-10-03T00:00:00Z');assert.equal(before.eligible[0].actual,'1');
 const after=samples.prepareSamples(seal(p),testPolicy,'2026-10-05T00:00:00Z');assert.equal(after.eligible[0].actual,'2');
 p.examples[0].settlements.push(c);assert.throws(()=>samples.prepareSamples(seal(p),testPolicy,'2026-10-05T00:00:00Z'),/revision/);
});
function awaitCorrection(c,prior){const text=JSON.stringify(c);return{revision:2,received_at_utc:'2026-10-04T00:00:00Z',envelope_text:text,payload_hash:api.rawHash(text)};}
test('missing capture/history stays explicit and never becomes a zero-valued feature',()=>{
 const p=payload();p.examples[0].snapshot=null;
 const out=samples.prepareSamples(seal(p),testPolicy,'2026-10-03T00:00:00Z');assert.equal(out.roster,30);assert.equal(out.rejected[0].reason,'capture_missing');
 const late=payload();late.examples[0].capture.capture_kind='late_import';assert.equal(samples.prepareSamples(seal(late),testPolicy,'2026-10-03T00:00:00Z').rejected[0].reason,'unverified_capture');
});
