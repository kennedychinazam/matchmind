import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from '../test-support/local-db.mjs';
const db=localDatabase('monitor');
before(async()=>{await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);});after(()=>db.close());
function publish(id){db.sql(`set role research_publisher;insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(${id},39,(now()at time zone 'UTC')::date+1,'18:00','Alpha','Beta',.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance')`);}
function receipt(id){return JSON.parse(db.sql(`set role research_operator;select research.try_capture_prediction(${id})`).split('\n').at(-1));}
test('storage failure survives publication as private durable state and can be repaired',()=>{
 db.sql('update research.control set max_bytes=1');publish(501);
 assert.equal(db.sql('select count(*) from public.predictions where fxid=501'),'1');
 let state=JSON.parse(db.sql('select row_to_json(q) from research.capture_health q where fixture_id=501'));
 assert.equal(state.state,'pending');assert.equal(state.last_sqlstate,'54000');assert.equal(state.attempts,1);
 assert.equal(receipt(501).error.code,'54000');
 state=JSON.parse(db.sql('select row_to_json(q) from research.capture_health q where fixture_id=501'));assert.equal(state.attempts,2);
 const original=db.sql('select row_to_json(p) from public.predictions p where fxid=501');
 db.sql('update research.control set max_bytes=262144000');
 assert.ok(receipt(501).snapshot_id);
 assert.equal(db.sql("select state from research.capture_health where fixture_id=501"),'repaired');
 assert.equal(db.sql('select row_to_json(p) from public.predictions p where fxid=501'),original);
 assert.equal(db.sql('select count(*) from research.prediction_snapshots where fixture_id=501'),'1');
 assert.ok(receipt(501).snapshot_id);assert.equal(db.sql('select count(*) from research.prediction_snapshots where fixture_id=501'),'1');
});
test('permission failures and paused capture are durable without leaking payloads',()=>{
 db.sql('revoke select on public.predictions from research_owner');
 try{publish(502);}finally{db.sql('grant select on public.predictions to research_owner');}
 assert.equal(db.sql('select last_sqlstate from research.capture_health where fixture_id=502'),'42501');
 db.sql('update research.control set enabled=false');publish(503);
 assert.equal(db.sql('select state from research.capture_health where fixture_id=503'),'disabled');
 db.sql('update research.control set enabled=true');
 assert.ok(receipt(502).snapshot_id);assert.ok(receipt(503).snapshot_id);
 const cols=db.sql("select column_name from information_schema.columns where table_schema='research' and table_name='capture_health'");
 for(const privateField of ['probabilities','pick','payload','password','error_message'])assert.ok(!cols.split('\n').includes(privateField));
});
test('ordinary application users and model readers cannot inspect or mutate capture monitoring',()=>{
 for(const role of ['anon','authenticated','research_reader','research_collector','research_publisher']) assert.throws(()=>db.sql(`set role ${role};select * from research.capture_health`),/permission/);
 for(const statement of ['update research.capture_health set state=\'repaired\'','delete from research.capture_health','truncate research.capture_health']) assert.throws(()=>db.sql('set role research_operator;'+statement),/permission/);
 assert.ok(db.sql('set role research_operator;select count(*) from research.capture_health').endsWith('3'));
 assert.throws(()=>db.sql('set role research_publisher;select research.capture_prediction(501)'),/permission/);
});
test('backlog reconciliation finds missing snapshots even if durable logging itself fails',()=>{
 db.sql("create function research.break_health_test()returns trigger language plpgsql as $$begin raise exception 'synthetic monitoring failure';end$$;create trigger break_health before insert or update on research.capture_health for each row execute function research.break_health_test();update research.control set max_bytes=1");
 try{publish(504);}finally{db.sql('drop trigger break_health on research.capture_health;drop function research.break_health_test();update research.control set max_bytes=262144000');}
 assert.equal(db.sql('select count(*) from public.predictions where fxid=504'),'1');
 const backlog=JSON.parse(db.sql('set role research_operator;select json_agg(b)from research.capture_backlog(100,0)b').split('\n').at(-1));
 assert.ok(backlog.some(r=>String(r.fixture_id)==='504'&&r.state==='unrecorded'));
 assert.ok(receipt(504).snapshot_id);
 assert.equal(db.sql('set role research_operator;select count(*) from research.capture_backlog(100,0)'),'SET\n0');
});
test('backup/restore includes durable repair state and restricted operator grants',()=>{
 db.restore(db.dump());
 assert.equal(db.sql('select state from research.capture_health where fixture_id=501','matchmind_restore'),'repaired');
 assert.throws(()=>db.sql('set role authenticated;select * from research.capture_health','matchmind_restore'),/permission/);
 assert.ok(db.sql('set role research_operator;select count(*) from research.capture_health','matchmind_restore').endsWith('4'));
});
