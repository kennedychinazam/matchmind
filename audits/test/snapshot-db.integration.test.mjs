import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase,literal} from '../test-support/local-db.mjs';
import {observation} from '../test-support/synthetic.mjs';
const db=localDatabase('schema');
before(async()=>{await db.start();db.apply('bootstrap.sql');});after(()=>db.close());
test('private append-only schema exists and migration is transactional',()=>{
 db.apply('snapshot-schema.sql');db.apply('evidence-manifests.sql');db.apply('permissions.sql');db.apply('capture-monitoring.sql');
 assert.equal(db.sql("select count(*) from information_schema.tables where table_schema='research' and table_type='BASE TABLE'"),'10');
 assert.equal(db.sql("select count(*) from pg_class where relnamespace='research'::regnamespace and relkind='r' and relrowsecurity"),'10');
});
test('collector receives server timestamps and payload is immutable under every granted role',()=>{
 const row=literal([observation()]);
 db.sql(`set role research_collector; select research.append_observations(${row});`);
 const x=JSON.parse(db.sql("select row_to_json(o) from research.observations o limit 1"));
 assert.equal(x.observed_at_utc,x.received_at_utc);assert.ok(Date.parse(x.received_at_utc)>Date.parse('2026-10-23T00:00:00Z'));
 for(const role of ['anon','authenticated','research_reader','research_collector','research_publisher']) {
  for(const stmt of ["update research.observations set value='2'::jsonb","delete from research.observations","truncate research.observations"]) assert.throws(()=>db.sql(`set role ${role}; ${stmt}`),/permission|immutable/);
 }
 assert.throws(()=>db.sql("update research.observations set value='2'::jsonb"),/immutable/);
});
test('public and unrelated roles cannot read or execute private writers',()=>{
 for(const role of ['anon','authenticated']) for(const stmt of ['select * from research.observations',`select research.append_observations(${literal([observation()])})`]) assert.throws(()=>db.sql(`set role ${role}; ${stmt}`),/permission/);
 assert.equal(db.sql("set role research_reader;select count(*) from research.observations"),'SET\n1');
});
test('SQL rejects backdated receipt, unknown fields, invalid timing and oversized field values',()=>{
 for(const patch of [{observed_at_utc:'2020-01-01T00:00:00Z'},{received_at_utc:'2020-01-01T00:00:00Z'},{field_name:null},{field_name:'unexpected_field'},{value:'x'.repeat(16384)},{played_at_utc:'2099-01-01T00:00:00Z'},{effective_at_utc:'2026-02-30T00:00:00Z'},{feature_schema_version:2},{availability:'unknown'}]) assert.throws(()=>db.sql(`set role research_collector;select research.append_observations(${literal([{...observation(),...patch}])})`));
});
test('retries preserve observation IDs and changed duplicate payloads abort atomically',()=>{
 db.sql(`set role research_collector;select research.append_observations(${literal([observation()])})`);
 assert.equal(db.sql('select count(*) from research.observations'),'1');
 assert.throws(()=>db.sql(`set role research_collector;select research.append_observations(${literal([{...observation(),value:9}])})`),/conflicting/);
 const next={...observation(),observation_id:'44444444-4444-4444-8444-444444444444'};
 assert.throws(()=>db.sql(`set role research_collector;select research.append_observations(${literal([next,{...observation(),value:8}])})`),/conflicting/);
 assert.equal(db.sql('select count(*) from research.observations'),'1');
});
test('storage limit is enforced before appending, and no public function EXECUTE remains',()=>{
 db.sql('update research.control set max_bytes=1');
 assert.throws(()=>db.sql(`set role research_collector;select research.append_observations(${literal([{...observation(),observation_id:'55555555-5555-4555-8555-555555555555'}])})`),/storage limit/);
 db.sql('update research.control set max_bytes=262144000');
 assert.equal(db.sql("select count(*) from pg_proc p where pronamespace='research'::regnamespace and has_function_privilege('anon',p.oid,'EXECUTE')"),'0');
});
test('backup restores equal records; rollback disables writers without deleting data',()=>{
 const dump=db.dump();db.restore(dump);
 assert.equal(db.sql('select count(*) from research.observations','matchmind_restore'),'1');
 assert.equal(db.sql('set role research_reader;select count(*) from research.observations','matchmind_restore'),'SET\n1');
 assert.equal(db.sql("select has_function_privilege('anon','research.append_observations(jsonb)','EXECUTE')",'matchmind_restore'),'f');
 assert.equal(db.sql("select payload_hash from research.observations"),db.sql("select payload_hash from research.observations",'matchmind_restore'));
 db.apply('rollback.sql');
 assert.throws(()=>db.sql(`set role research_collector;select research.append_observations(${literal([observation()])})`),/permission|disabled/);
 assert.equal(db.sql('select count(*) from research.observations'),'1');
 db.apply('permissions.sql');
});

test('SQL timestamp validation preserves microseconds accepted by the wire contract',()=>{
 assert.equal(db.sql("select to_char(research.utc_instant('2026-10-20T13:00:00.123456+01:00')at time zone 'UTC','YYYY-MM-DD HH24:MI:SS.US')"),'2026-10-20 12:00:00.123456');
});
