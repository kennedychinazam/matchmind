import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../phase8/providers.mjs').catch(()=>({}));
const ai=await import('../phase8/ai.mjs');
test('AI provider selection is configurable and unselected by default with all paid transport disabled',()=>{
 assert.equal(typeof api.providerConfiguration,'function');assert.equal(api.providerConfiguration().provider,null);
 for(const provider of ['openai','kimi','openrouter','gemini']){
  const p=api.providerConfiguration({provider,model:'owner-to-select'});assert.equal(p.provider,provider);assert.equal(p.paid_transport_enabled,false);assert.equal(p.verified_price,null);
 }
 assert.throws(()=>api.providerConfiguration({provider:'arbitrary-host'}),/provider/);
 for(const provider of ['openai','kimi','openrouter'])assert.equal(ai.buildRequest('A3',{fixture_id:'1',home:'A',away:'B',source_refs:['fixture:1'],features:{}},{provider,model:'selected-model'}).provider,provider);
});
