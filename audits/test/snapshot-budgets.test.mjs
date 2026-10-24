import test from 'node:test';
import assert from 'node:assert/strict';
import {appendObservedFields} from '../staging/collector-adapter.mjs';
import {publishWithSnapshot} from '../staging/publisher-harness.mjs';
import {randomUUID} from 'node:crypto';
test('oversized ingestion is refused before calling a writer or provider',async()=>{
 let calls=0;
 await assert.rejects(()=>appendObservedFields({runId:randomUUID(),fixtureId:'123',sourceKind:'collector',sourceRef:'synthetic',fields:{lineup_h:'x'.repeat(16384)}},async()=>{calls++;}),/size/);
 assert.equal(calls,0);
});
test('capture timeout is bounded and never republishes source prediction',async()=>{
 let publications=0,aborted=false;
 const start=performance.now();
 const r=await publishWithSnapshot({publish:async()=>{publications++;return {fixtureId:'123'};},capture:async(_,{signal})=>new Promise(()=>{signal.addEventListener('abort',()=>{aborted=true;});}),timeoutMs:25});
 assert.equal(r.published,true);assert.equal(r.capture.ok,false);assert.equal(publications,1);assert.equal(aborted,true);
 assert.ok(performance.now()-start<1000);
});
test('capture cannot request an unbounded or invalid deadline',async()=>{
 for(const timeoutMs of [Infinity,0,-1,10001]) await assert.rejects(()=>publishWithSnapshot({publish:async()=>({fixtureId:'1'}),capture:async()=>({snapshot_id:'x'}),timeoutMs}),/timeout/);
});
