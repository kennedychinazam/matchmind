import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from '../test-support/local-db.mjs';
import {realisticHistory,seedHistory,evidenceRows} from '../test-support/history.mjs';
import {snapshotFromCapture} from '../lib/snapshot-contract.mjs';
import {buildAsOfInputs,existingMatchFeatures} from '../lib/asof-features.mjs';
const db=localDatabase('scaling');let raw;let firstGrowth;
before(async()=>{await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-hooks.sql'])db.apply(f);raw=realisticHistory();raw.push({fxid:'8000000',lid:888,home:'Unrelated home',away:'Unrelated away',date:'invalid',time:'18:00',status:'NS',season:'unverified'});seedHistory(db,raw);});after(()=>db.close());
function publish(id='999999') {return db.sql(`set role research_publisher;insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(${id},39,'${raw.find(x=>x.fxid==='999999').date}','18:00','Arsenal','Liverpool',.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance')`);}
test('realistic multi-season evidence captures successfully and matches every full-history M14 feature',()=>{
 const count=Number(db.sql('select count(*) from research.observations'));assert.ok(count>20000);
 const beforeBytes=Number(db.sql("select sum(pg_total_relation_size(oid)) from pg_class where relnamespace='research'::regnamespace and relkind='r'"));
 const start=performance.now();publish();const captureMs=performance.now()-start;
 firstGrowth=Number(db.sql("select sum(pg_total_relation_size(oid)) from pg_class where relnamespace='research'::regnamespace and relkind='r'"))-beforeBytes;
 assert.ok(captureMs<5000,'capture must remain below the local five-second regression ceiling');
 assert.equal(db.sql('select count(*) from research.prediction_snapshots'),'1');
 const envelope=JSON.parse(db.sql('select envelope from research.prediction_snapshots'));
 const snapshot=snapshotFromCapture(envelope);
 const full=buildAsOfInputs({snapshot,observations:evidenceRows(db)});
 const selected=evidenceRows(db,`select * from research.read_snapshot_evidence('${snapshot.snapshot_id}')`);
 const bounded=buildAsOfInputs({snapshot,observations:selected});
 const features=existingMatchFeatures(bounded);
 assert.deepEqual(features,existingMatchFeatures(full));
 for(const key of ['homeEdge','fhGD_H','xgDiffH','tblPosH','xiContH','refPenRate']) assert.notEqual(features[key],null,key+' must stay populated');
 assert.ok(selected.length>500);assert.ok(selected.length<count*.7);
 assert.equal(bounded.fixture.home,'Arsenal');assert.equal(existingMatchFeatures(bounded).distractH,1);
 assert.equal(db.sql('select max(member_count)<=500 from research.evidence_chunks'),'t');
 assert.equal(envelope.evidence_manifest.evidence_count,selected.length);
 console.log(JSON.stringify({history_observations:count,selected_observations:selected.length,chunks:envelope.evidence_manifest.chunk_count,capture_ms:Math.round(captureMs),first_manifest_growth_bytes:firstGrowth}));
});
test('manifest is reproducible, chunk storage is reused, and late writes cannot change replay',()=>{
 const before=db.sql('select payload_hash from research.prediction_snapshots');
 const sid=db.sql('select snapshot_id from research.prediction_snapshots');
 const chunks=db.sql('select count(*) from research.evidence_chunks');
 db.sql('set role research_publisher;select research.capture_prediction(999999)');
 assert.equal(db.sql('select count(*) from research.evidence_chunks'),chunks);
 assert.equal(db.sql('select payload_hash from research.prediction_snapshots'),before);
 assert.equal(db.sql(`select count(*) from research.read_snapshot_evidence('${sid}')`),db.sql('select evidence_count from research.evidence_manifests'));
});

test('a second prediction shares immutable chunks rather than copying full history',()=>{
 const first=raw.find(x=>x.fxid==='999999'),second={...first,fxid:'1000000'};
 seedHistory(db,[second]);
 const before=Number(db.sql("select sum(pg_total_relation_size(oid)) from pg_class where relnamespace='research'::regnamespace and relkind='r'"));
 const chunks=Number(db.sql('select count(*) from research.evidence_chunks'));
 publish(second.fxid);
 const after=Number(db.sql("select sum(pg_total_relation_size(oid)) from pg_class where relnamespace='research'::regnamespace and relkind='r'"));
 assert.ok(Number(db.sql('select count(*) from research.evidence_chunks'))<=chunks+3);
 assert.ok(after-before<firstGrowth/2);
 console.log(JSON.stringify({second_capture_growth_bytes:after-before,total_manifests:db.sql('select count(*) from research.evidence_manifests')}));
});
test('manifest ceiling fails explicitly and evidence remains private/immutable',()=>{
 assert.throws(()=>db.sql("select research.store_evidence_manifest(array_fill(gen_random_uuid(),ARRAY[100001]),'{}')"),/supported size/);
 for(const role of ['anon','authenticated']) for(const table of ['evidence_chunks','evidence_chunk_members','evidence_manifests','evidence_manifest_chunks']) assert.throws(()=>db.sql(`set role ${role};select * from research.${table}`),/permission/);
 assert.throws(()=>db.sql("update research.evidence_chunks set member_count=1"),/immutable/);
});
