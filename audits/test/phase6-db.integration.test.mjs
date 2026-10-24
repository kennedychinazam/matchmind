import test,{before,after}from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from 'node:fs';
import {spawn}from 'node:child_process';
import {randomUUID}from 'node:crypto';
import {localDatabase,docker,IMAGE,literal}from '../test-support/local-db.mjs';
import {freezeCandidate,evaluateJob}from '../phase6/core.mjs';
const api=await import('../phase6/repository.mjs').catch(()=>({}));
const db=localDatabase('phase6-db');let repo,candidate,job,result;
before(async()=>{docker(['image','inspect',IMAGE]);await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);});
after(()=>db.close());
test('private schema installs only in isolated local container and registers frozen candidates',()=>{
 assert.equal(typeof api.repository,'function');
 repo=api.repository(db);repo.install();
 candidate=freezeCandidate({version:'control-v1',adapter_id:'identity-v1',configuration:{},frozen_at_utc:'2026-10-20T00:00:00Z',study_kind:'synthetic_verification'});
 repo.register(candidate);repo.register(candidate);
 assert.equal(db.sql('select count(*)from shadow_eval.candidates'),'1');
 assert.throws(()=>repo.register({...candidate,version:'changed'}),/candidate/);
 assert.throws(()=>api.repository({name:'remote',sql(){throw Error('must not call');}}),/local/);
});
test('frozen roster captures missing snapshots and concurrent retries never duplicate jobs',async()=>{
 const batch=Object.entries({home:'Alpha',away:'Beta',lid:39,date:'2099-10-21',time:'18:00',status:'NS',season:2026,
  odds_1x2:{fxid:'6001',id:1,captured_at:new Date().toISOString(),mins_to_kick:60,h:1.9,d:3.2,a:4.8}}).map(([field_name,value])=>({observation_id:randomUUID(),fixture_id:'6001',source_kind:field_name==='odds_1x2'?'odds':'collector',source_ref:'synthetic',collector_run_id:randomUUID(),field_name,value,availability:'observed',feature_schema_version:1,source_hash:'a'.repeat(64),effective_at_utc:null,played_at_utc:null}));
 db.sql(`set role research_collector;select research.append_observations(${literal(batch)})`);
 db.sql("insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(6001,39,'2099-10-21','18:00','Alpha','Beta',.3333,.3333,.3333,1.5,1,'1X',.6666,355,clock_timestamp(),'Double Chance')");
 const sid=db.sql('select snapshot_id from research.prediction_snapshots where fixture_id=6001');
 job=repo.declareJob(candidate.candidate_id,'6001',sid);assert.equal(repo.declareJob(candidate.candidate_id,'6001',sid),job);
 const loaded=repo.load(sid);result=evaluateJob({candidate,...loaded});
 await Promise.all(Array.from({length:4},()=>asyncSql(`set role shadow_runner;select shadow_eval.save_result('${JSON.stringify(result).replaceAll("'","''")}'::jsonb)`)));
 repo.save(result);
 assert.equal(db.sql('select count(*)from shadow_eval.results'),'1');
 assert.throws(()=>repo.save({...result,probabilities:[.7,.2,.1]}),/conflict/);
 db.sql("update research.control set enabled=false;insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(6002,39,'2099-10-21','18:00','Alpha','Beta',.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance');update research.control set enabled=true");
 const missing=repo.declareJob(candidate.candidate_id,'6002',null);
 repo.recordAttempt({job_id:missing,state:'failed',code:'capture_missing'});
 repo.recordAttempt({job_id:missing,state:'failed',code:'capture_missing'});
 const exported=repo.exportStudy(candidate.candidate_id);
 assert.equal(exported.records.length,2);assert.equal(exported.attempts.length,2);
 assert.deepEqual(exported.records.find(r=>r.snapshot).observations.map(o=>o.field_name),['odds_1x2']);
 assert.equal(exported.records.filter(r=>!r.snapshot).length,1);
});
function asyncSql(sql){return new Promise((resolve,reject)=>{
 const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
 const p=spawn('docker',['--host=unix:///var/run/docker.sock','exec','-i',db.name,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','matchmind_test','-At'],{env});
 let error='';p.stderr.on('data',b=>error+=b);p.stdout.resume();p.on('error',reject);p.on('close',code=>code?reject(Error(error)):resolve());p.stdin.end(sql);
});}
test('all private tables deny ordinary users and runner cannot publish or change originals',()=>{
 for(const role of ['anon','authenticated','research_publisher','research_collector'])for(const t of ['candidates','jobs','results','attempts','settlements'])assert.throws(()=>db.sql(`set role ${role};select * from shadow_eval.${t}`),/permission/);
 for(const table of ['research.prediction_snapshots','public.predictions','shadow_eval.candidates','shadow_eval.results'])for(const action of ['delete from','truncate'])assert.throws(()=>db.sql(`set role shadow_runner;${action} ${table}`),/permission|immutable/);
 assert.throws(()=>db.sql('set role shadow_runner;insert into public.predictions(fxid)values(9999)'),/permission/);
 assert.throws(()=>db.sql('update shadow_eval.results set envelope=envelope'),/immutable/);
 assert.equal(db.sql("select count(*)from pg_proc where pronamespace='shadow_eval'::regnamespace and has_function_privilege('anon',oid,'EXECUTE')"),'0');
});
test('SQL enforces frozen config, snapshot identity and exact fallback on direct entrypoint calls',()=>{
 const call=r=>db.sql(`set role shadow_runner;select shadow_eval.save_result('${JSON.stringify(r).replaceAll("'","''")}'::jsonb)`);
 for(const patch of [{configuration_hash:'c'.repeat(64)},{baseline_payload_hash:'d'.repeat(64)},{evidence_manifest_hash:'e'.repeat(64)},
  {visibility:'public'},{confirmatory_eligible:true},{status:'fallback',reason:'missing_evidence',probabilities:[.5,.3,.2]}])assert.throws(()=>call({...result,...patch}));
 const c=freezeCandidate({version:'unverified-artifact-v1',adapter_id:'m14-xgedge-v1',configuration:{artifact_kind:'synthetic',beta:.1},frozen_at_utc:'2026-10-19T00:00:00Z',study_kind:'historical_exploratory'});
 repo.register(c);repo.declareJob(c.candidate_id,'6001',result.snapshot_id);
 const denied=evaluateJob({candidate:c,...repo.load(result.snapshot_id)});
 assert.throws(()=>call({...denied,status:'forecast',reason:null,probabilities:[.5,.3,.2]}),/artifact|forecast/);
});
test('settlement revisions are immutable, server-received and exported separately from adapters',()=>{
 repo.settle(job,{fixture_id:'6001',kind:'synthetic_verification',fixture:{date:'2099-10-21',time:'18:00',status:'AET',provider:'af',gh:2,ga:1,ft_h:1,ft_a:1}});
 const e=repo.exportStudy(candidate.candidate_id);assert.equal(e.records.find(r=>r.snapshot).settlements.length,1);
 assert.throws(()=>db.sql('delete from shadow_eval.settlements'),/immutable/);
 assert.throws(()=>repo.settle(job,{fixture_id:'wrong',kind:'synthetic_verification',fixture:{}}),/fixture/);
});
test('shared quota counts private result indexes and bounded attempts cannot silently exceed caps',()=>{
 assert.equal(db.sql("select max_bytes from research.control"),'262144000');
 const used=Number(db.sql("select sum(pg_total_relation_size(oid))from pg_class where relnamespace in('research'::regnamespace,'shadow_eval'::regnamespace)and relkind='r'"));
 db.sql(`update research.control set max_bytes=${used+1}`);
 assert.throws(()=>repo.register(freezeCandidate({...candidateSpec(),version:'over-budget'})),/storage/);
 assert.throws(()=>repo.recordAttempt({job_id:job,state:'failed',code:'persistence_failed'}),/storage/);
 assert.throws(()=>db.sql("set role research_collector;select research.check_budget(100)"),/permission/);
 db.sql('update research.control set max_bytes=262144000');
 for(let i=0;i<8;i++)repo.recordAttempt({job_id:job,state:'failed',code:'candidate_execution_failed'});
 assert.throws(()=>repo.recordAttempt({job_id:job,state:'failed',code:'candidate_execution_failed'}),/attempt limit/);
});
test('full private backup restores hashes and rollback preserves originals while disabling shadow writes',()=>{
 const dump=db.dump();db.restore(dump);
 assert.equal(db.sql('select count(*)from shadow_eval.results'),db.sql('select count(*)from shadow_eval.results','matchmind_restore'));
 assert.equal(db.sql('select envelope from shadow_eval.results'),db.sql('select envelope from shadow_eval.results','matchmind_restore'));
 const before=db.sql('select envelope from research.prediction_snapshots order by snapshot_id');
 db.sql(readFileSync(new URL('../phase6/rollback.sql',import.meta.url),'utf8'));
 assert.throws(()=>repo.save(result),/permission|disabled/);
 assert.equal(db.sql('select envelope from research.prediction_snapshots order by snapshot_id'),before);
});
test('near-ceiling health retries and concurrent first inserts cannot bypass bounded operational admission',async()=>{
 // Re-enable after the preceding rollback while retaining all immutable test data.
 db.sql('grant usage on schema shadow_eval to shadow_runner;grant execute on function shadow_eval.record_attempt(text,text,text)to shadow_runner');
 const used=()=>Number(db.sql("select sum(pg_total_relation_size(oid))from pg_class where relnamespace in('research'::regnamespace,'shadow_eval'::regnamespace)and relkind in('r','S')"));
 const before=used(),health=db.sql('select attempts from research.capture_health where fixture_id=6001');
 db.sql(`update research.control set max_bytes=${before+32768},enabled=false`);
 const r=JSON.parse(db.sql('select research.try_capture_prediction(6001)'));
 assert.equal(r.monitor_recorded,false);assert.equal(db.sql('select attempts from research.capture_health where fixture_id=6001'),health);
 db.sql("insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(6003,39,'2099-10-21','18:00','Alpha','Beta',.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance')");
 assert.equal(db.sql('select count(*)from research.capture_health where fixture_id=6003'),'0');
 assert.ok(db.sql('set role research_operator;select fixture_id from research.capture_backlog()').includes('6003'));
 const id=db.sql('select job_id from shadow_eval.jobs where fixture_id=6002');
 assert.throws(()=>repo.recordAttempt({job_id:id,state:'failed',code:'capture_missing'}),/storage/);
 const concurrent=await Promise.allSettled([
  asyncSql("insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(6004,39,'2099-10-21','18:00','Alpha','Beta',.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance')"),
  asyncSql(`set role shadow_runner;select shadow_eval.record_attempt('${id}','failed','capture_missing')`)
 ]);
 assert.equal(concurrent[0].status,'fulfilled');assert.equal(concurrent[1].status,'rejected');
 assert.equal(db.sql('select count(*)from research.capture_health where fixture_id=6004'),'0');
 assert.ok(used()<=before+32768);
 db.sql('update research.control set max_bytes=262144000,enabled=true');
});
function candidateSpec(){return {version:'new-v1',adapter_id:'identity-v1',configuration:{},frozen_at_utc:'2026-10-20T00:00:00Z',study_kind:'synthetic_verification'};}
