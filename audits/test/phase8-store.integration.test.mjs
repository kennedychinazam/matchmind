import test,{before,after}from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase,docker,IMAGE}from '../test-support/local-db.mjs';
import {repository}from '../phase6/repository.mjs';
import {canonicalHash}from '../lib/snapshot-contract.mjs';
const api=await import('../phase8/store.mjs').catch(()=>({}));
const db=localDatabase('phase8-store');let store,study,packet,job;
before(async()=>{docker(['image','inspect',IMAGE]);await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);repository(db).install();});
after(()=>db.close());
test('private weekend storage retains originals, roster and failed arms under the unchanged budget',()=>{
 assert.equal(typeof api.weekendStore,'function');store=api.weekendStore(db);store.install();
 study=store.append('study','weekend-2026-10-24',null,{version:'weekend-v1',windows:['2026-10-24','2026-10-25'],kind:'synthetic_verification'});
 packet=store.append('packet','packet-1',study,{synthetic:true,rows:[{fxid:1}]});
 const original={p_home:.4,p_draw:.3,p_away:.3,made_at:'2026-10-23T00:00:00Z'};
 job=store.append('job','job-1',packet,{fixture_id:'1',kickoff_at_utc:new Date(Date.now()+3600000).toISOString(),original});
 assert.equal(store.append('job','job-1',packet,{fixture_id:'1',kickoff_at_utc:store.read(job).body.kickoff_at_utc,original}),job);
 assert.throws(()=>store.append('job','job-1',packet,{fixture_id:'1',kickoff_at_utc:store.read(job).body.kickoff_at_utc,original:{...original,p_home:.9}}),/conflict/);
 store.append('forecast','job-1:A1',job,{arm:'A1',status:'failed',reason:'provider_unverified'});
 assert.deepEqual(store.read(job).body.original,original);assert.equal(store.events().filter(e=>e.kind==='job').length,1);
 assert.equal(db.sql('select max_bytes from research.control'),'262144000');assert.equal(db.sql('select count(*)from public.predictions'),'0');
});
test('global durable reservations serialize concurrent workers and never refund failed or uncertain calls',async()=>{
 const attempts=Array.from({length:10},(_,i)=>store.reserveAsync('request-'+i,job,1000000,canonicalHash({i})));
 const done=await Promise.allSettled(attempts);assert.equal(done.filter(x=>x.status==='fulfilled').length,5);
 assert.equal(store.reservedMicros(),5000000);
 const first=done.findIndex(x=>x.status==='fulfilled');store.append('usage','response-'+first,'request-'+first,{status:'failed',actual_micros:null});
 store.append('usage','dispatch-'+first,'request-'+first,{status:'dispatched'});
 assert.throws(()=>store.append('usage','dispatch-'+first,'request-'+first,{status:'dispatched'}),/conflict/);
 assert.equal(store.reservedMicros(),5000000);assert.throws(()=>store.reserve('new-request',job,1,canonicalHash({new:1})),/budget/);
 assert.throws(()=>store.reserve('request-'+first,job,999999,canonicalHash({i:first})),/conflict/);
});
test('ordinary roles cannot see private forecasts or spend; snapshots are immutable and late forecasts fail closed',()=>{
 for(const role of ['anon','authenticated','shadow_runner','research_collector'])assert.throws(()=>db.sql(`set role ${role};select *from shadow_eval.weekend_events`),/permission/);
 assert.throws(()=>db.sql('delete from shadow_eval.weekend_events'),/immutable/);
 const late=store.append('job','late-job',packet,{fixture_id:'2',kickoff_at_utc:'2026-01-01T00:00:00Z',original:null});
 assert.throws(()=>store.append('forecast','late-job:E-Refreshed',late,{arm:'E-Refreshed',status:'forecast',generated_at_utc:'2025-12-31T00:00:00Z',probabilities:[.4,.3,.3]}),/kickoff|late/);
 assert.throws(()=>store.append('forecast','job-1:A3',job,{arm:'A3',status:'forecast',generated_at_utc:new Date().toISOString(),probabilities:[.8,.8,.1]}),/probab/);
});
test('populated backup restore retains reservation liability, lineage and permissions; storage failure leaves originals intact',()=>{
 const before=store.events().length,dump=db.dump();db.restore(dump);
 assert.equal(db.sql("select count(*)from shadow_eval.weekend_events",'matchmind_restore'),String(before));
 assert.equal(db.sql("select sum((body->>'reserved_micros')::bigint)from shadow_eval.weekend_events where kind='reservation'",'matchmind_restore'),'5000000');
 assert.throws(()=>db.sql('set role anon;select *from shadow_eval.weekend_events','matchmind_restore'),/permission/);
 db.sql('update research.control set max_bytes=1');assert.throws(()=>store.append('forecast','job-1:A2',job,{arm:'A2',status:'failed',reason:'test'}),/storage/);db.sql('update research.control set max_bytes=262144000');
 assert.equal(store.events().length,before);
});
