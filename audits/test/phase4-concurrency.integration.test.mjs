import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {localDatabase,docker} from '../test-support/local-db.mjs';
import {realisticHistory,seedHistory} from '../test-support/history.mjs';
const db=localDatabase('phase4-concurrency');
const run=promisify(execFile);
const env={...process.env};
for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[k];
before(async()=>{await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql']) db.apply(f);seedHistory(db,realisticHistory());});
after(()=>db.close());
const bytes=()=>Number(db.sql("select sum(pg_total_relation_size(oid)) from pg_class where relnamespace='research'::regnamespace and relkind='r'"));
function insert(id){return `set statement_timeout='25s';set lock_timeout='20s';set role research_publisher;insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(${id},39,current_date+1,'18:00','Arsenal','Liverpool',.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance')on conflict do nothing`;}
async function publish(id){const start=performance.now();await run('docker',['--host=unix:///var/run/docker.sock','exec',db.name,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','matchmind_test','-c',insert(id)],{env,timeout:30000,maxBuffer:1024*1024});return performance.now()-start;}
test('concurrent historical captures preserve distinct predictions and converge on one snapshot for duplicate inserts',async()=>{
 const info=JSON.parse(docker(['inspect',db.name]))[0];
 assert.equal(info.HostConfig.NetworkMode,'none');
 assert.deepEqual(info.HostConfig.PortBindings,{});
 const initial=bytes();const samples=[];let id=8000000;
 for(const concurrency of [1,2,5,10]){
  const latencies=await Promise.all(Array.from({length:concurrency},()=>publish(id++)));
  samples.push({concurrency,max_ms:Math.round(Math.max(...latencies)),mean_ms:Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length)});
 }
 await Promise.all(Array.from({length:5},()=>publish(9000000)));
 assert.equal(db.sql('select count(*) from public.predictions'),'19');
 assert.equal(db.sql('select count(*) from research.prediction_snapshots'),'19');
 assert.equal(db.sql("select count(*) from research.capture_backlog(100,0)"),'0');
 assert.equal(db.sql('select count(*) from research.prediction_snapshots where fixture_id=9000000'),'1');
 assert.equal(db.sql('select bool_and(p_home=.5::real and p_draw=.3::real and p_away=.2::real and build=355)from public.predictions'),'t');
 const saved=db.sql('select payload_hash from research.prediction_snapshots where fixture_id=9000000');
 db.sql('set role research_operator;select research.try_capture_prediction(9000000)');
 assert.equal(db.sql('select payload_hash from research.prediction_snapshots where fixture_id=9000000'),saved);
 console.log(JSON.stringify({phase4_local_concurrency:samples,observations:Number(db.sql('select count(*)from research.observations')),capture_growth_bytes:bytes()-initial,predictions:19,external_requests:0}));
});
