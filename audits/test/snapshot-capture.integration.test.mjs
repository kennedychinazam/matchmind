import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localDatabase,literal} from '../test-support/local-db.mjs';
const db=localDatabase('capture');
const api=await import('../staging/publisher-harness.mjs').catch(()=>({}));
const collector=await import('../staging/collector-adapter.mjs').catch(()=>({}));
before(async()=>{await db.start();db.apply('bootstrap.sql');db.apply('snapshot-schema.sql');db.apply('permissions.sql');});after(()=>db.close());
const prediction=(id)=>`insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market) values(${id},39,(now() at time zone 'UTC')::date+1,'18:00','Alpha','Beta',.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance') on conflict do nothing`;
function sourceWriter(id){return async()=>{db.sql(`set role research_publisher;${prediction(id)}`);return {fixtureId:String(id)};};}
function capture(id){return async()=>{try{return {snapshot_id:db.sql(`set role research_publisher;select research.capture_prediction(${id})`).split('\n').at(-1)};}catch(e){const msg=e.stderr?.toString()||e.message;throw Object.assign(Error(msg),{code:/permission/.test(msg)?'42501':/storage limit/.test(msg)?'54000':'XX000'});}};}
test('capture hooks copy only the winning publisher insert and keep originals immutable',async()=>{
 db.apply('capture-hooks.sql');
 const r=await api.publishWithSnapshot({publish:sourceWriter(456),capture:capture(456)});
 assert.equal(r.published,true);assert.equal(r.capture.ok,true);
 const original=db.sql('select row_to_json(p) from public.predictions p where fxid=456');
 await api.publishWithSnapshot({publish:async()=>{db.sql("set role research_publisher;insert into public.predictions(fxid,p_home)values(456,.99)on conflict do nothing");return {fixtureId:'456'};},capture:capture(456)});
 assert.equal(db.sql('select count(*) from research.prediction_snapshots'),'1');
 assert.equal(db.sql('select row_to_json(p) from public.predictions p where fxid=456'),original);
 const envelope=JSON.parse(db.sql('select envelope from research.prediction_snapshots'));
 assert.deepEqual(envelope.probabilities,[.5,.3,.2]);assert.equal(envelope.pick,'1X');assert.equal(envelope.model_version,'build355');
 assert.equal(envelope.settlement_policy_version,'build355-90m-48h-v1');
 assert.equal(db.sql('select replay_eligible from research.prediction_snapshots'),'f');
});
test('permission failures preserve the published prediction and are reported without republishing',async()=>{
 db.sql('revoke execute on function research.capture_prediction(bigint) from research_publisher');
 const r=await api.publishWithSnapshot({publish:sourceWriter(457),capture:capture(457)});
 assert.equal(r.published,true);assert.equal(r.capture.ok,false);assert.equal(r.capture.code,'42501');assert.equal(r.capture.attempts,1);
 assert.equal(db.sql('select count(*) from public.predictions where fxid=457'),'1');
 db.sql('grant execute on function research.capture_prediction(bigint) to research_publisher');
});
test('storage exhaustion does not abort or duplicate source predictions',async()=>{
 db.sql('update research.control set max_bytes=1');
 const r=await api.publishWithSnapshot({publish:sourceWriter(458),capture:capture(458)});
 assert.equal(r.published,true);assert.equal(r.capture.ok,false);assert.equal(r.capture.code,'54000');
 assert.equal(db.sql('select count(*) from public.predictions where fxid=458'),'1');
 assert.equal(db.sql('select count(*) from research.prediction_snapshots where fixture_id=458'),'0');
 db.sql('update research.control set max_bytes=262144000');
 const repaired=await capture(458)();assert.ok(repaired.snapshot_id);
 assert.equal(db.sql('select count(*) from public.predictions where fxid=458'),'1');
});
test('late imports retain original issue time and cannot claim historical replay',()=>{
 db.sql("update research.control set enabled=false");
 db.sql("insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(459,39,'2026-10-21','18:00','Alpha','Beta',.5,.3,.2,1.5,1,'1X',.8,355,'2026-10-20T12:00:00Z','Double Chance')");
 db.sql('update research.control set enabled=true;set role research_publisher;select research.capture_prediction(459)');
 assert.equal(db.sql("select capture_kind from research.prediction_snapshots where fixture_id=459"),'late_import');
 assert.equal(db.sql("select envelope->>'issue_time_utc' from research.prediction_snapshots where fixture_id=459"),'2026-10-20T12:00:00.000000Z');
});
test('collector deduplicates unchanged fields, stamps receipt and preserves correction versions',async()=>{
 const runId=randomUUID();
 const writer=async(batch)=>({ids:db.sql(`set role research_collector;select research.append_observations(${literal(batch)})`).split('\n').at(-1).slice(1,-1).split(',')});
 const record={runId,fixtureId:'123',sourceKind:'collector',fields:{xg_h:1.2,gh:2,ga:1},sourceRef:'synthetic',playedAt:'2026-10-18T18:00:00Z'};
 const first=await collector.appendObservedFields(record,writer);
 const again=await collector.appendObservedFields(record,writer);
 assert.deepEqual(first.observation_ids,again.observation_ids);
 assert.equal(db.sql('select count(*) from research.observations'),'3');
 await collector.appendObservedFields({...record,runId:randomUUID(),fields:{xg_h:1.4}},writer);
 assert.equal(db.sql("select count(*) from research.observations where field_name='xg_h'"),'2');
 assert.equal(db.sql('select count(*) from research.observations where observed_at_utc<>received_at_utc'),'0');
 await assert.rejects(()=>collector.appendObservedFields({...record,observedAt:'2020-01-01T00:00:00Z'},writer),/unexpected/);
});
test('shadow forecast storage is private and baseline lineage is checked',()=>{
 const sid=db.sql('select snapshot_id from research.prediction_snapshots where fixture_id=456');
 const shadow={shadow_id:randomUUID(),snapshot_id:sid,candidate_version:'identity-v1',configuration_hash:'a'.repeat(64),visibility:'shadow',probabilities:[.5,.3,.2],pick:'1X',feature_manifest_hash:'b'.repeat(64),fallback_reason:'missing_evidence',cohort:'exploratory',confirmatory_eligible:false,issued_pick_is_baseline:true};
 db.sql(`set role research_collector;select research.append_shadow(${literal(shadow)})`);
 assert.equal(db.sql('select count(*) from research.shadow_forecasts'),'1');
 for(const patch of [{visibility:'public'},{probabilities:[.8,.8,.2]},{pick:'2'}]) assert.throws(()=>db.sql(`set role research_collector;select research.append_shadow(${literal({...shadow,shadow_id:randomUUID(),configuration_hash:randomUUID(),...patch})})`));
 assert.throws(()=>db.sql('set role authenticated;select * from research.shadow_forecasts'),/permission/);
});
test('unchanged polls across runs do not grow storage, but returning to an old value creates a new version',async()=>{
 const writer=async batch=>({ids:db.sql(`set role research_collector;select research.append_observations(${literal(batch)})`).split('\n').at(-1).slice(1,-1).split(',')});
 const input={runId:randomUUID(),fixtureId:'900',sourceKind:'collector',sourceRef:'synthetic-poll',fields:{xg_h:1},playedAt:'2026-10-18T18:00:00Z'};
 await collector.appendObservedFields(input,writer);
 await collector.appendObservedFields({...input,runId:randomUUID()},writer);
 assert.equal(db.sql('select count(*) from research.observations where fixture_id=900'),'1');
 await collector.appendObservedFields({...input,runId:randomUUID(),fields:{xg_h:2}},writer);
 await collector.appendObservedFields({...input,runId:randomUUID()},writer);
 assert.equal(db.sql('select count(*) from research.observations where fixture_id=900'),'3');
});
test('transient capture failures retry capture only, and returned backend errors remain visible',async()=>{
 let publications=0,attempts=0;
 const r=await api.publishWithSnapshot({publish:async()=>{publications++;return {fixtureId:'456'};},capture:async()=>{if(++attempts<3)throw Object.assign(Error('serialization'),{code:'40001'});return capture(456)();}});
 assert.equal(r.capture.ok,true);assert.equal(r.capture.attempts,3);assert.equal(publications,1);
 const bad=await api.publishWithSnapshot({publish:async()=>({fixtureId:'456'}),capture:async()=>({error:{code:'42501'}})});
 assert.equal(bad.capture.ok,false);assert.equal(bad.capture.code,'42501');
});
test('pre-issue odds are preserved from server-observed evidence, never from later bookmaker data',async()=>{
 const writer=async batch=>({ids:db.sql(`set role research_collector;select research.append_observations(${literal(batch)})`).split('\n').at(-1).slice(1,-1).split(',')});
 const at=new Date(Date.now()-1000).toISOString();
 for(const [id,h] of [[101,2.1],[100,2]]) await collector.appendObservedFields({runId:randomUUID(),fixtureId:'460',sourceKind:'odds',sourceRef:'synthetic-odds',fields:{odds_1x2:{id,fxid:'460',captured_at:at,mins_to_kick:120,h,d:3,a:4}}},writer);
 await api.publishWithSnapshot({publish:sourceWriter(460),capture:capture(460)});
 let odds=JSON.parse(db.sql("select envelope->'preissue_odds' from research.prediction_snapshots where fixture_id=460"));
 assert.equal(odds.id,101);
 await collector.appendObservedFields({runId:randomUUID(),fixtureId:'460',sourceKind:'odds',sourceRef:'synthetic-odds',fields:{odds_1x2:{id:102,fxid:'460',captured_at:new Date().toISOString(),mins_to_kick:120,h:2.2,d:3,a:4}}},writer);
 await capture(460)();
 odds=JSON.parse(db.sql("select envelope->'preissue_odds' from research.prediction_snapshots where fixture_id=460"));assert.equal(odds.id,101);
});
test('SQL-deduplicated receipts return actual stored IDs to the collector',async()=>{
 const writer=async batch=>({ids:db.sql(`set role research_collector;select research.append_observations(${literal(batch)})`).split('\n').at(-1).slice(1,-1).split(',')});
 const input={runId:randomUUID(),fixtureId:'901',sourceKind:'collector',sourceRef:'synthetic-poll',fields:{xg_h:1},playedAt:'2026-10-18T18:00:00Z'};
 const first=await collector.appendObservedFields(input,writer);
 const second=await collector.appendObservedFields({...input,runId:randomUUID()},writer);
 assert.deepEqual(first.observation_ids,second.observation_ids);
 assert.equal(second.observation_ids[0],db.sql('select observation_id from research.observations where fixture_id=901'));
});
test('invalid odds evidence cannot enter the archive or break later capture',async()=>{
 const writer=async batch=>({ids:db.sql(`set role research_collector;select research.append_observations(${literal(batch)})`).split('\n').at(-1).slice(1,-1).split(',')});
 for(const patch of [{captured_at:'2099-01-01T00:00:00Z'},{captured_at:'invalid'},{fxid:'other'},{h:'invalid'}]) {
  await assert.rejects(()=>collector.appendObservedFields({runId:randomUUID(),fixtureId:'999',sourceKind:'odds',sourceRef:'synthetic-odds',fields:{odds_1x2:{id:1,fxid:'999',captured_at:new Date().toISOString(),mins_to_kick:120,h:2,d:3,a:4,...patch}}},writer));
 }
});
test('evidence above 500 links refuses capture visibly without truncating or losing publication',async()=>{
 for(let start=10000;start<10501;start+=100) db.sql(`set role research_collector;select research.append_observations((select jsonb_agg(jsonb_build_object('observation_id',gen_random_uuid(),'fixture_id',x::text,'source_kind','collector','source_ref','synthetic','collector_run_id',gen_random_uuid(),'field_name','lid','value',39,'availability','observed','feature_schema_version',1,'source_hash',repeat('a',64),'effective_at_utc',null,'played_at_utc',null))from generate_series(${start},${Math.min(start+99,10500)})x))`);
 const r=await api.publishWithSnapshot({publish:sourceWriter(461),capture:capture(461)});
 assert.equal(r.published,true);assert.equal(r.capture.ok,false);
 assert.equal(db.sql('select count(*) from public.predictions where fxid=461'),'1');
 assert.equal(db.sql('select count(*) from research.prediction_snapshots where fixture_id=461'),'0');
});
