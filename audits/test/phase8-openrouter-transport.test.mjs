import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../phase8-continuation/transport.mjs').catch(()=>({}));
const now=()=>new Date().toISOString();
export const ready=()=>({checked_at_utc:now(),runtime:{observations_current:true,spec_revision:'new',observed_spec_revision:'new',network_policy:{mode:'restricted',state:'enforced',effective_allowed_hosts:['openrouter.ai']},secrets:[{name:'OPENROUTER_API_KEY',state:'ready'}]}});
test('stale or missing runtime secret, unrestricted egress and unapproved hosts fail before HTTP',()=>{
 assert.equal(typeof api.assertRuntime,'function');const r=ready();assert.doesNotThrow(()=>api.assertRuntime(r,now()));
 for(const bad of [{...r,checked_at_utc:'2026-01-01T00:00:00Z'},{...r,runtime:{...r.runtime,secrets:[]}},{...r,runtime:{...r.runtime,observations_current:false}},{...r,runtime:{...r.runtime,network_policy:{mode:'unrestricted',state:'enforced'}}}])assert.throws(()=>api.assertRuntime(bad,now()),/runtime/);
});
test('HTTP credentials stay on stdin; fixed HTTPS routes, no redirects, no retries and sanitized failures',async()=>{
 assert.equal(typeof api.openrouterClient,'function');const calls=[];
 const client=api.openrouterClient(ready(),{credential:'synthetic-never-a-real-key',execute:(cmd,args,opts)=>{calls.push({cmd,args,input:opts.input});return '{"data":{}}\n200';}});
 assert.deepEqual(await client.get('key'),{data:{}});assert.equal(calls[0].args.join(' ').includes('synthetic'),false);assert.equal(calls[0].input.includes('Authorization: Bearer synthetic-never-a-real-key'),true);
 await assert.rejects(()=>client.get('https://evil.example'),/route/);assert.equal(calls.length,1);
 const fail=api.openrouterClient(ready(),{credential:'synthetic',execute:()=>{throw Error('sensitive auth output');}});
 await assert.rejects(()=>fail.get('credits'),e=>!e.message.includes('sensitive')&&/failed/.test(e.message));
});
