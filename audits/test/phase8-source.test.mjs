import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../phase8/source.mjs').catch(()=>({}));
test('source transport admits only fixed read-only MatchMind database projections',()=>{
 assert.equal(typeof api.sourceURL,'function');
 assert.equal(new URL(api.sourceURL('fixtures',{select:'fxid',limit:1})).hostname,'toqfdrcjzwnlydqekude.supabase.co');
 for(const table of ['ai_shadow','rpc/publish','https://other.invalid','auth/users'])assert.throws(()=>api.sourceURL(table,{}),/source|table/);
});
test('source pagination rejects missing pages, duplicate rows and changing counts rather than truncating',async()=>{
 assert.equal(typeof api.collectPages,'function');
 let i=0;const rows=[{fxid:1},{fxid:2},{fxid:3}];
 const result=await api.collectPages(async last=>({rows:rows.filter(r=>r.fxid>last).slice(0,2),total:3,server_date:'2026-10-24T10:00:00Z'}),{pageSize:2});
 assert.equal(result.rows.length,3);assert.equal(result.pages.length,3);
 await assert.rejects(()=>api.collectPages(async()=>({rows:[{fxid:1},{fxid:1}],total:2}),{pageSize:2}),/duplicate|order/);
 await assert.rejects(()=>api.collectPages(async()=>({rows:[],total:3}),{pageSize:2}),/incomplete/);
 await assert.rejects(()=>api.collectPages(async last=>({rows:rows.filter(r=>r.fxid>last).slice(0,2),total:++i===1?3:4}),{pageSize:2}),/count|inventory/);
});
