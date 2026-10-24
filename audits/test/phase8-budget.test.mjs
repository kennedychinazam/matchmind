import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../phase8/budget.mjs').catch(()=>({}));
const ai=await import('../phase8/ai.mjs').catch(()=>({}));
test('weekend budget reserves whole model context and output with no free-tier assumption',()=>{
 assert.equal(typeof api.worstCaseMicros,'function');
 assert.equal(api.worstCaseMicros({model:'gemini-2.5-flash',maxOutputTokens:1024,grounding:false}),317133);
 assert.equal(api.WEEKEND_CEILING_MICROS,5000000);
 assert.throws(()=>api.worstCaseMicros({model:'unknown',maxOutputTokens:1024,grounding:false}),/model/);
 assert.throws(()=>api.worstCaseMicros({model:'gemini-2.5-flash',maxOutputTokens:1024,grounding:true}),/grounding/);
 assert.throws(()=>api.worstCaseMicros({model:'gemini-2.5-flash',maxOutputTokens:65537,grounding:false}),/output/);
});
test('live provider transport remains closed when account billing and permissions are unverifiable',async()=>{
 assert.equal(typeof api.executeSyntheticRequest,'function');let called=0;
 await assert.rejects(()=>api.executeSyntheticRequest({}, {}, {kind:'football',transport:async()=>{called++;}}),/synthetic|unverified/);
 assert.equal(called,0);
});
test('independent AI request omits engine predictions and freezes input/configuration',()=>{
 assert.equal(typeof ai.buildRequest,'function');
 const evidence={fixture_id:'1',home:'A',away:'B',source_refs:['fixture:1'],features:{xg:1},engine:{probabilities:[.8,.1,.1]}};
 const r=ai.buildRequest('A3',evidence);
 assert.equal(JSON.stringify(r).includes('0.8'),false);assert.equal(r.prompt_version,'weekend-v1');assert.equal(r.body.tools,undefined);
 assert.equal(r.request_hash,ai.buildRequest('A3',evidence).request_hash);
});
test('AI decisions reject fabricated sources and invalid probabilities and preserve veto abstentions',()=>{
 assert.equal(typeof ai.parseDecision,'function');const refs=['fixture:1'];
 assert.throws(()=>ai.parseDecision('scout',{hm:1,am:1,veto:false,evidence_refs:['future:2']},refs),/source/);
 assert.throws(()=>ai.parseDecision('scout',{hm:2,am:1,veto:false,evidence_refs:refs},refs),/multiplier/);
 assert.throws(()=>ai.parseDecision('A3',{probabilities:[.8,.8,.1],evidence_refs:refs},refs),/probab/);
 assert.equal(ai.parseDecision('scout',{hm:1,am:1,veto:true,evidence_refs:refs},refs).veto,true);
 assert.equal(ai.parseDecision('A3',{abstain:true,reason:'missing evidence'},refs).abstain,true);
});
test('a repeated request ID cannot dispatch twice against one reservation',async()=>{
 let calls=0;const used=new Set(),store={reserve(){},append(kind,id){if(used.has(id))throw Error('dispatch conflict');used.add(id);}};
 const request={request_id:'same',job_id:'one',model:'gemini-2.5-flash',maxOutputTokens:1024,grounding:false};
 const opts={kind:'synthetic_verification',transport:async()=>{calls++;return{usage:null};}};
 await api.executeSyntheticRequest(store,request,opts);
 await assert.rejects(()=>api.executeSyntheticRequest(store,request,opts),/dispatch conflict/);
 assert.equal(calls,1);
});
