import test from 'node:test';
import assert from 'node:assert/strict';
const {evaluateSelector}=await import('../phase4/evaluation-decision.mjs').catch(()=>({}));
function matrix(){return ['repeat','diverse'].flatMap(workload=>['fresh','reused'].flatMap(mode=>[1,2,5,10].map(workers=>({workload,mode,workers,parity:true,success:true,pairs:Array.from({length:4},()=>({current:{server_ms:Array(workers).fill(100),client_ms:Array(workers).fill(120)},narrow:{server_ms:Array(workers).fill(80),client_ms:Array(workers).fill(100)}}))}))));}
test('selector decision accepts broad paired median/p95 improvements with complete parity',()=>{assert.equal(typeof evaluateSelector,'function');assert.equal(evaluateSelector(matrix()).adopt,true);});
test('favourable maxima cannot hide a meaningful median regression',()=>{const x=matrix();for(const p of x.at(-1).pairs){p.current.server_ms=[...Array(9).fill(100),500];p.narrow.server_ms=[...Array(9).fill(112),400];}assert.equal(evaluateSelector(x).adopt,false);});
test('faster medians cannot hide a meaningful p95 regression',()=>{const x=matrix();for(const p of x.at(-1).pairs){p.current.server_ms=[...Array(9).fill(100),200];p.narrow.server_ms=[...Array(9).fill(80),250];}assert.equal(evaluateSelector(x).adopt,false);});
test('missing workload cells or failed integrity checks cannot approve a selector',()=>{const x=matrix();assert.throws(()=>evaluateSelector(x.slice(1)),/complete/);x[0].parity=false;assert.equal(evaluateSelector(x).adopt,false);});
