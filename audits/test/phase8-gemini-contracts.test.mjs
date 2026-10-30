import test from 'node:test';import assert from 'node:assert/strict';
import * as api from '../phase8-continuation/contracts.mjs';
import {catalog,key,credits} from '../test-support/openrouter-fixtures.mjs';
import {GEMINI,LITE,geminiCatalog} from '../test-support/gemini-fixtures.mjs';
import {evidenceView} from '../phase8-continuation/protocol.mjs';
import {canonicalHash} from '../lib/snapshot-contract.mjs';
import {executeRequest} from '../phase8-continuation/execute.mjs';
const NOW='2026-10-25T20:00:00Z';
const source={rows:[{fxid:1,lid:94,home:'H',away:'A',status:'NS',gh:null,ga:null},{fxid:2,lid:94,home:'X',away:'Y',status:'FT',gh:2,ga:1}],odds:[{fxid:1,h:2,d:3,a:4}],engine:[.9,.05,.05]};
test('Gemini reserves physical input, output and separate reasoning maxima without spending the retained hold',()=>{
 const p=api.freezeProfile(geminiCatalog(),NOW),lite=api.freezeProfile(geminiCatalog(LITE),NOW),openai=api.freezeProfile(catalog(),NOW);
 assert.equal(p.reserved_micros,917504);assert.equal(lite.reserved_micros,458752);
 assert.equal(2*openai.reserved_micros+2*p.reserved_micros,2447008);
 assert.equal(5000000-306000-2447008,2246992);
 assert.equal(2*openai.reserved_micros+2*lite.reserved_micros,1529504);
 assert.deepEqual(api.MODELS,['openai/gpt-6-luna','moonshotai/kimi-k2.5']);
});
test('Gemini rejects unbounded reasoning, unknown charges, unhealthy or unpinned endpoints',()=>{
 for(const change of [e=>{e.pricing.internal_reasoning='0.000004';},e=>{delete e.pricing.internal_reasoning;},e=>{e.pricing.additional_charge='1';},e=>{e.pricing.request='0.01';},e=>{e.status=-5;},e=>{e.tag='google-ai-studio/flex';e.service_tier='flex';},e=>{e.supported_parameters=['response_format'];}]){
  const c=geminiCatalog();change(c.data.endpoints[0]);assert.throws(()=>api.freezeProfile(c,NOW),/reasoning|pricing|endpoint/);
 }
});
test('Gemini A3 and OpenAI use the same complete evidence without engine probabilities or odds',()=>{
 const evidence=evidenceView(source,1,NOW),before=JSON.stringify(source);
 const g=api.buildRequest('A3',api.freezeProfile(geminiCatalog(),NOW),evidence,NOW),o=api.buildRequest('A3',api.freezeProfile(catalog(),NOW),evidence,NOW);
 assert.equal(g.input_hash,o.input_hash);assert.equal(g.body.messages[1].content,o.body.messages[1].content);
 const data=JSON.parse(g.body.messages[1].content);assert.equal(data.facts[0].data.rows.length,2);
 assert(!JSON.stringify(data).includes('"odds"'));assert(!JSON.stringify(data).includes('"engine"'));assert.equal(JSON.stringify(source),before);
 assert.deepEqual(g.body.provider.only,['google-ai-studio']);assert.deepEqual(g.body.provider.order,['google-ai-studio']);assert.equal(g.body.provider.allow_fallbacks,false);
 assert.deepEqual(g.body.tools,[]);assert.equal(g.body.tool_choice,'none');assert.deepEqual(g.body.plugins,[]);api.validateRequest(g,api.freezeProfile(geminiCatalog(),NOW),NOW);
});
test('Gemini response contract refuses backend/model substitutions, truncation, tools, invalid decisions and excess billing',()=>{
 const p=api.freezeProfile(geminiCatalog(),NOW),decision={abstain:false,reason:'supported',evidence_refs:['r'],probabilities:[.4,.3,.3]};
 const response={id:'synthetic-gemini',model:GEMINI,provider:'Google AI Studio',usage:{prompt_tokens:100,completion_tokens:10,cost:.001},choices:[{finish_reason:'stop',message:{content:JSON.stringify(decision)}}]};
 assert.deepEqual(api.parseResponse('A3',response,p,['r']).decision,decision);
 for(const delta of [{provider:'Google'},{model:LITE},{usage:{...response.usage,cost:1}},{choices:[{finish_reason:'length',message:response.choices[0].message}]},{choices:[{finish_reason:'stop',message:{...response.choices[0].message,tool_calls:[{}]}}]},{choices:[{finish_reason:'stop',message:{content:JSON.stringify({...decision,evidence_refs:['fabricated']})}}]}])assert.throws(()=>api.parseResponse('A3',{...response,...delta},p,['r']),/response|cost|source|decision/);
});
test('Gemini credit-only admission additionally requires fresh Google workspace absence evidence',()=>{
 const k=key();k.data.include_byok_in_limit=false;k.data.workspace_id='synthetic-workspace';
 const e={version:'credit-only-operator-v1',workspace_id:k.data.workspace_id,key_identity_hash:canonicalHash({label:k.data.label,limit:5,reset:null}),credential_count:0,confirmed_absent_providers:['OpenAI','Moonshot','Novita'],recorded_at_utc:NOW};
 assert.throws(()=>api.verifyAccount(k,credits(),NOW,e,['openai/gpt-6-luna',GEMINI]),/operator|BYOK/);
 const full={...e,confirmed_absent_providers:['OpenAI','Moonshot','Novita','Google','Google AI Studio']};
 assert.equal(api.verifyAccount(k,credits(),NOW,full,['openai/gpt-6-luna',GEMINI]).remaining_micros,5000000);
 assert.throws(()=>api.verifyAccount(k,credits(),'2026-10-25T20:11:00Z',full,['openai/gpt-6-luna',GEMINI]),/operator/);
});
test('a legacy OpenAI/Kimi account proof cannot authorize a Gemini request',async()=>{
 const profile=api.freezeProfile(geminiCatalog(),NOW),request=api.buildRequest('A3',profile,evidenceView(source,1,NOW),NOW);
 let writes=0;const store={clock:()=>NOW,read:()=>({body:{cohort:'prospective-ai',provider_model:GEMINI}}),append:()=>{writes++;}};
 await assert.rejects(()=>executeRequest(store,{id:'new',job:'job',request,profile},{kind:'synthetic_verification',account:api.verifyAccount(key(),credits(),NOW)}),/model-bound/);
 assert.equal(writes,0);
});
