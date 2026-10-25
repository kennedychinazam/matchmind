import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalHash} from '../lib/snapshot-contract.mjs';
import {verifyAccount} from '../phase8-continuation/contracts.mjs';
import {providerPreflight} from '../phase8-continuation/preflight.mjs';
import {key,credits,catalog} from '../test-support/openrouter-fixtures.mjs';
const now='2026-10-25T08:00:00Z';
const creditKey=()=>{const k=key();Object.assign(k.data,{include_byok_in_limit:false,workspace_id:'workspace-matchmind'});return k;};
const evidence=k=>({version:'credit-only-operator-v1',workspace_id:k.data.workspace_id,key_identity_hash:canonicalHash({label:k.data.label,limit:k.data.limit,reset:k.data.limit_reset}),confirmed_absent_providers:['OpenAI','Moonshot','Novita'],recorded_at_utc:now,credential_count:0});
test('credit-only requires fresh operator evidence bound to the exact workspace and dedicated key',()=>{
 const k=creditKey(),e=evidence(k);
 assert.equal(verifyAccount(k,credits(),now,e).remaining_micros,5000000);
 for(const bad of [undefined,{...e,workspace_id:'other'},{...e,key_identity_hash:'f'.repeat(64)},{...e,confirmed_absent_providers:['OpenAI']},{...e,credential_count:1},{...e,recorded_at_utc:'2026-10-25T07:49:59Z'},{...e,recorded_at_utc:'2026-10-25T08:00:01Z'}])assert.throws(()=>verifyAccount(k,credits(),now,bad),/credit-only|BYOK|evidence/);
});
test('BYOK-inclusive path stays strict; BYOK usage and unsafe limits cannot enter credit-only path',()=>{
 assert.equal(verifyAccount(key(),credits(),now).remaining_micros,5000000);
 const k=creditKey(),e=evidence(k);
 for(const change of [{byok_usage:.01},{limit:6},{limit_reset:'daily'},{usage:1,limit_remaining:5},{workspace_id:null}])assert.throws(()=>verifyAccount({data:{...k.data,...change}},credits(),now,e),/key|budget|credit-only|BYOK/);
 assert.throws(()=>verifyAccount(k,{error:{code:403}},now,e),/balance/);
});
test('metadata-only preflight carries operator evidence into account validation',async()=>{
 const k=creditKey(),e=evidence(k),routes={key:k,credits:credits(),'models/openai/gpt-6-luna/endpoints':catalog('openai/gpt-6-luna'),'models/moonshotai/kimi-k2.5/endpoints':catalog('moonshotai/kimi-k2.5')};
 const client={get:async route=>{assert.ok(Object.hasOwn(routes,route));return routes[route];}};
 await assert.rejects(()=>providerPreflight(client,()=>now),/credit-only/);
 const result=await providerPreflight(client,()=>now,e);
 assert.equal(result.paid_inference_executed,false);assert.equal(result.profiles.length,2);assert.equal(result.account.remaining_micros,5000000);
});
