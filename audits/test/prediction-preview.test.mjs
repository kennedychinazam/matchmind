import test from 'node:test';import assert from 'node:assert/strict';
import {getExample,comparisonView,validateRecord} from '../prediction-preview/model.mjs';
test('Santos keeps exact retained engine probabilities and no invented AI forecast',()=>{
 const r=getExample('santos');assert.equal(r.fixture.id,'1492438');assert.deepEqual(r.engine.probabilities,[0.23632970210877488,0.2832790536678142,0.48039124422341106]);
 const v=comparisonView(r);assert.equal(r.ai.status,'unavailable');assert.equal(v.aiProbabilities,null);assert.equal(v.final.status,'unavailable');assert.equal(v.aiRisk,null);assert.equal(r.engine.selection.code,'X2');assert.equal(r.synthetic,false);
 assert.throws(()=>getExample('santos','available'));assert.equal(getExample('santos').ai.status,'unavailable');
});
for(const status of ['available','pending','unavailable','failed','abstained'])test('synthetic '+status+' stays explicitly synthetic and semantically separate',()=>{
 const r=getExample('demo',status),v=comparisonView(r);assert.equal(r.synthetic,true);assert.equal(r.ai.status,status);
 assert.equal(v.aiProbabilities!==null,status==='available');assert.equal(v.final.status,status==='available'?'illustrative':status==='abstained'?'abstained':status);
 if(status==='available'){assert.deepEqual(v.deltaPoints,[4,-1,-3]);assert.ok(r.ai.analysis.every(a=>a.refs.length));}else assert.equal(r.ai.probabilities,null);
});
for(const change of [r=>r.engine.probabilities=[1,1,1],r=>r.ai.probabilities=[.5,-.1,.6],r=>r.ai.probabilities=[NaN,.3,.7],r=>r.ai.probabilities=[.4,.3],r=>r.ai.analysis[0].refs=['invented'],r=>r.ai.extra='private raw response',r=>r.ai.status='success',r=>r.ai.packet='unverified'])test('presentation rejects inconsistent or unrecognized data: '+String(change),()=>{
 const r=structuredClone(getExample('demo'));change(r);assert.throws(()=>validateRecord(r));
});
test('missing states never become zero probabilities, neutral risk or a recommendation',()=>{
 const r=structuredClone(getExample('demo','pending'));r.ai.probabilities=[0,0,0];assert.throws(()=>validateRecord(r));
 for(const status of ['pending','unavailable','failed'])assert.equal(comparisonView(getExample('demo',status)).aiRisk,null);
});
test('read-only examples cannot mutate original forecasts through state switching',()=>{
 const r=getExample('santos');assert.throws(()=>{r.engine.probabilities[0]=1;},TypeError);getExample('demo','available');assert.equal(getExample('santos'),r);
});
test('an engine generation timestamp is never relabeled as a source receipt',()=>{
 assert.equal(getExample('santos').evidence[0].receivedAt,null);
 assert.equal(getExample('santos').engine.generatedAt,'2026-10-28T05:19:00.304Z');
});
