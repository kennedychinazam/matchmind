import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../phase8-continuation/contracts.mjs').catch(()=>({}));
const NOW='2026-10-25T08:00:00Z';
import {catalog,key,credits} from '../test-support/openrouter-fixtures.mjs';
test('endpoint reservations include all price tiers and physical completion maximum, ignoring cache discounts',()=>{
 assert.equal(typeof api.freezeProfile,'function');
 const p=api.freezeProfile(catalog(),NOW);assert.equal(p.reserved_micros,306000);
 const k=api.freezeProfile(catalog('moonshotai/kimi-k2.5'),NOW);assert.equal(k.reserved_micros,821820);
 const bad=catalog();bad.data.endpoints[0].supported_parameters=['response_format'];assert.throws(()=>api.freezeProfile(bad,NOW),/endpoint/);
 const pricey=catalog();pricey.data.endpoints[0].pricing.audio='1';assert.throws(()=>api.freezeProfile(pricey,NOW),/pricing/);
 assert.throws(()=>api.freezeProfile(catalog('other/model'),NOW),/model/);
});
test('account preflight blocks resetting/unlimited/privileged keys, missing balance and nonconservative usage',()=>{
 assert.equal(typeof api.verifyAccount,'function');
 assert.equal(api.verifyAccount(key(),credits(),NOW).remaining_micros,5000000);
 for(const change of [{limit:null},{limit:6},{limit_reset:'daily'},{is_management_key:true},{expires_at:'2026-10-24T00:00:00Z'},{usage:1,limit_remaining:5}])assert.throws(()=>api.verifyAccount({data:{...key().data,...change}},credits(),NOW),/key|budget/);
 assert.throws(()=>api.verifyAccount(key(),{error:{code:403}},NOW),/balance/);
});
test('strict OpenRouter requests pin backend, disable search/fallback and omit independent engine and odds',()=>{
 assert.equal(typeof api.buildRequest,'function');const p=api.freezeProfile(catalog(),NOW);
 const evidence={fixture_id:'1',home:'A',away:'B',receipt_at_utc:'2026-10-25T07:00:00Z',facts:[{ref:'packet:abc:fixture:1',data:{status:'NS'}}],engine:[.8,.1,.1],odds:[2,3,4]};
 const r=api.buildRequest('A3',p,evidence,NOW);
 assert.equal(r.body.provider.allow_fallbacks,false);assert.deepEqual(r.body.provider.only,['openai']);assert.deepEqual(r.body.tools,[]);assert.equal(r.body.tool_choice,'none');assert.deepEqual(r.body.plugins,[]);
 assert.equal(r.body.response_format.json_schema.strict,true);assert.equal(r.body.response_format.json_schema.schema.additionalProperties,false);
 assert.equal(r.body.messages[0].content.includes('"engine"'),false);assert.equal(r.body.messages[0].content.includes('"odds"'),false);
 assert.throws(()=>api.buildRequest('A3',p,{...evidence,receipt_at_utc:'2026-10-25T09:00:00Z'},NOW),/receipt/);
 assert.throws(()=>api.buildRequest('A3',p,evidence,'2026-10-25T08:16:00Z'),/expired/);
});
test('provider answers reject truncation, fabricated sources, extra fields, invalid probability mass and incorrect abstentions',()=>{
 assert.equal(typeof api.parseResponse,'function');const p=api.freezeProfile(catalog(),NOW);
 const answer={abstain:false,reason:'supported',evidence_refs:['r'],probabilities:[.4,.3,.3]};
 const response={id:'gen-synthetic',model:p.model,provider:'OpenAI',usage:{prompt_tokens:30,completion_tokens:40,cost:0.001},choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer)}}]};
 assert.deepEqual(api.parseResponse('A3',response,p,['r']).decision.probabilities,[.4,.3,.3]);
 for(const change of [{choices:[{...response.choices[0],finish_reason:'length'}]},{model:'other/model'},{usage:{...response.usage,cost:6}},{choices:[{finish_reason:'stop',message:{content:JSON.stringify({...answer,secret:'x'})}}]},{choices:[{finish_reason:'stop',message:{content:JSON.stringify({...answer,evidence_refs:['fake']})}}]},{choices:[{finish_reason:'stop',message:{content:JSON.stringify({...answer,probabilities:[.8,.8,.1]})}}]}])assert.throws(()=>api.parseResponse('A3',{...response,...change},p,['r']),/response|decision|cost|source|probab/);
});
test('key protection must cover BYOK too; a credit-only cap is insufficient',()=>{
 const k=key();k.data.include_byok_in_limit=false;
 assert.throws(()=>api.verifyAccount(k,credits(),NOW),/key|BYOK/);
});
