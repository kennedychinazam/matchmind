// Final bounded evaluation. Existing image only; disposable synthetic DBs; no remote services.
import assert from 'node:assert/strict';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {localDatabase,docker,IMAGE} from '../test-support/local-db.mjs';
import {realisticHistory,seedHistory,evidenceRows} from '../test-support/history.mjs';
import {snapshotFromCapture} from '../lib/snapshot-contract.mjs';
import {buildAsOfInputs,existingMatchFeatures} from '../lib/asof-features.mjs';
import {distribution,evaluateSelector} from './evaluation-decision.mjs';
import {storageSQL} from './storage-metrics.mjs';
const db=localDatabase('final-eval'),run=promisify(execFile),env={...process.env};
for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
const path=process.argv[2]||'/tmp/mm-final-evaluation.json',results={policy_fixed_before_measurement:true,rounds:4,rows:[],full_feature_checks:0,evidence_checks:0,storage:[],external_requests:0};
const save=()=>writeFileSync(path,JSON.stringify(results,null,2));
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const targets={},archives={},featureCache=new Map(),cells=[];
const insert=(id,t)=>`insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(${id},${t.lid},${q(t.date)},'18:00',${q(t.home)},${q(t.away)},.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance');`;
async function asyncSQL(text,database){return(await run('docker',['--host=unix:///var/run/docker.sock','exec',db.name,'psql','-X','-At','-v','ON_ERROR_STOP=1','-U','postgres','-d',database,'-c',text],{env,timeout:60000,maxBuffer:8*1024*1024})).stdout.trim();}
function instrument(sql){
 let text='create table public.mm_profile(stage text,app text,ms double precision);alter table public.mm_profile owner to research_owner;';
 for(const [name,args,call,ret,stage,extra]of[['check_budget','extra_bytes bigint','extra_bytes','void','budget',''],['select_m14_evidence','fid bigint','fid','uuid[]','selection',''],['store_evidence_manifest','ids uuid[],spec jsonb','ids,spec','uuid','manifest',''],['capture_prediction','fid bigint','fid','uuid','capture','security definer']]){
  text+=`alter function research.${name}(${args})rename to ${name}_original;create function research.${name}(${args})returns ${ret} language plpgsql ${extra} set search_path=pg_catalog as $f$declare t timestamptz;v ${ret==='void'?'text':ret};begin t:=clock_timestamp();${ret==='void'?'perform ':'select '}research.${name}_original(${call})${ret==='void'?'':'into v'};insert into public.mm_profile values('${stage}',current_setting('application_name'),extract(epoch from clock_timestamp()-t)*1000);${ret==='void'?'return;':'return v;'}end$f$;alter function research.${name}(${args})owner to research_owner;revoke all on function research.${name}(${args})from public;`;
 }
 sql(text);
}
try{
 docker(['image','inspect',IMAGE]);await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 // Pin the reviewed wide baseline so comparisons remain reproducible after adoption.
 const baselineSource=execFileSync('git',['show','d4cb3379a3f1d6d0b7252ab134969b33397a5820:audits/staging/evidence-manifests.sql'],{encoding:'utf8'});
 const baselineDDL=baselineSource.slice(baselineSource.indexOf('CREATE FUNCTION research.select_m14_evidence('),baselineSource.indexOf('CREATE FUNCTION research.read_snapshot_evidence('));
 db.sql(baselineDDL.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));

 const history=realisticHistory(),target=history.find(x=>x.fxid==='999999'),teams=['Arsenal','Liverpool',...Array.from({length:14},(_,i)=>`Team ${i+2}`)];
 const unrelated=Array.from({length:2000},(_,i)=>({fxid:String(2000000+i),lid:999,home:`Far home ${i%16}`,away:`Far away ${i%16}`,date:`${2022+i%4}-05-01`,time:'18:00',status:'FINISHED',gh:1,ga:0,season:2022+i%4,round:'Regular Season - 1',xg_h:1.1,xg_a:.9}));
 for(const w of ['repeat','diverse']){
  const name='base_'+w;db.sql(`create database ${name} template matchmind_test`);const sql=x=>db.sql(x,name);targets[w]=Array.from({length:64},(_,i)=>({...target,fxid:String(8000000+i),...(w==='diverse'?{lid:i%2?40:39,home:teams[Math.floor(i/2)%16],away:teams[(Math.floor(i/2)+1+Math.floor(i/32))%16]}:{})}));
  seedHistory({sql},[...history,...unrelated,...targets[w]]);sql('analyze research.observations;');archives[w]=evidenceRows({sql});
  results.storage.push({workload:w,phase:'archive',rows:archives[w].length,tables:JSON.parse(sql(storageSQL))});
 }
 // Every cell has four independent paired rounds; AB, BA, AB, BA order is fixed.
 for(let round=0;round<4;round++)for(const workload of ['repeat','diverse'])for(const mode of ['fresh','reused'])for(const workers of [1,2,5,10]){
  const pair={};let roots;
  for(const variant of round%2?['narrow','current']:['current','narrow']){
   const name='trial';db.sql(`create database ${name} template base_${workload}`);const sql=x=>db.sql(x,name);
   if(variant==='narrow'){const def=sql("select pg_get_functiondef('research.select_m14_evidence(bigint)'::regprocedure)");assert.equal(def.split('o.*').length,2);sql(def.replace('o.*','o.fixture_id,o.field_name,o.value,o.observation_id'));}
   if(mode==='reused'){
    sql('alter table public.predictions disable trigger research_capture;'+targets[workload].slice(0,workers).map(t=>insert(t.fxid,t)).join('')+"select research.store_evidence_manifest(research.select_m14_evidence(p.fxid),jsonb_build_object('version','m14-dependencies-v1','build',p.build,'league_id',p.lid,'home',p.home,'away',p.away))from public.predictions p;delete from public.predictions;alter table public.predictions enable trigger research_capture;");
   }
   const before=JSON.parse(sql(storageSQL));instrument(sql);const samples=[];let done=false;
   const sampler=(async()=>{while(!done){samples.push(...JSON.parse(await asyncSQL("select coalesce(json_agg(json_build_object('wait',wait_event_type,'event',wait_event,'blockers',cardinality(pg_blocking_pids(pid)))),'[]')from pg_stat_activity where application_name like 'final-%'and state='active'",name)));await new Promise(r=>setTimeout(r,100));}})();
   const requests=[];
   try{requests.push(...await Promise.all(targets[workload].slice(0,workers).map(async t=>{const start=performance.now();const out=await asyncSQL(`set application_name='final-${t.fxid}';set statement_timeout='45s';set role research_publisher;select clock_timestamp();${insert(t.fxid,t)}select clock_timestamp();`,name);const a=out.split('\n').filter(x=>/^\d{4}-/.test(x));assert.equal(a.length,2);return {server_ms:Date.parse(a[1])-Date.parse(a[0]),client_ms:performance.now()-start};})));}finally{done=true;await sampler;}
   const after=JSON.parse(sql(storageSQL));
   const snapshots=JSON.parse(sql("select json_agg(json_build_object('envelope',s.envelope,'hash',m.payload_hash,'count',(select count(*)from research.read_snapshot_evidence(s.snapshot_id)),'hash_ok',s.payload_hash=encode(public.digest(s.envelope::text,'sha256'),'hex'))order by s.fixture_id)from research.prediction_snapshots s join research.evidence_manifests m on s.evidence_manifest_id=m.manifest_id"));
   assert.equal(snapshots.length,workers);assert.equal(sql('select count(*)from research.capture_backlog(100,0)'),'0');assert.equal(sql('select count(*)from public.predictions'),String(workers));
   const keys=snapshots.map(s=>s.hash);if(roots)assert.deepEqual(keys,roots);else roots=keys;
   for(const s of snapshots){assert.ok(s.hash_ok);assert.equal(s.count,s.envelope.evidence_manifest.evidence_count);results.evidence_checks++;
    const snap=snapshotFromCapture(s.envelope),key=workload+'/'+snap.fixture_id+'/'+s.hash;
    assert.deepEqual(s.envelope.probabilities,[.5,.3,.2]);assert.equal(s.envelope.source_prediction.build,355);
    if(!featureCache.has(key)){
     const ids=JSON.parse(sql(`select json_agg(observation_id)from research.read_snapshot_evidence('${snap.snapshot_id}')`));const wanted=new Set(ids),selected=archives[workload].filter(o=>wanted.has(o.observation_id));assert.equal(selected.length,ids.length);
     const full=existingMatchFeatures(buildAsOfInputs({snapshot:snap,observations:archives[workload]}));const bounded=existingMatchFeatures(buildAsOfInputs({snapshot:snap,observations:selected}));assert.deepEqual(bounded,full);featureCache.set(key,createHash('sha256').update(JSON.stringify(full)).digest('hex'));results.full_feature_checks++;
    }
   }
   const stages=JSON.parse(sql("select json_agg(t)from(select stage,app,sum(ms)ms from public.mm_profile group by stage,app)t"));
   const resources=JSON.parse(sql("select json_build_object('temp_bytes',temp_bytes,'blks_read',blks_read,'blks_hit',blks_hit,'database_bytes',pg_database_size(current_database()))from pg_stat_database where datname=current_database()"));
   pair[variant]={server_ms:requests.map(r=>r.server_ms),client_ms:requests.map(r=>r.client_ms)};
   results.rows.push({round,workload,mode,workers,variant,latency:pair[variant],stages,samples,before,after,resources,observer_rss_bytes:process.memoryUsage().rss,success:true,parity:true});
   db.sql('drop database trial');save();
  }
  let cell=cells.find(c=>c.workload===workload&&c.mode===mode&&c.workers===workers);if(!cell){cell={workload,mode,workers,pairs:[],parity:true,success:true};cells.push(cell);}cell.pairs.push(pair);
  console.log(JSON.stringify({round,workload,mode,workers,current:distribution(pair.current.server_ms),narrow:distribution(pair.narrow.server_ms)}));
 }
 results.decision=evaluateSelector(cells);save();console.log(JSON.stringify({decision:results.decision.adopt,regressions:results.decision.regressions,full_feature_checks:results.full_feature_checks,evidence_checks:results.evidence_checks}));
 // Uninstrumented current implementation: actual per-category growth and reuse slopes.
 for(const workload of ['repeat','diverse']){
  db.sql(`create database storage_trial template base_${workload}`);const sql=x=>db.sql(x,'storage_trial');
  for(let i=0;i<30;i++){sql(insert(targets[workload][i].fxid,targets[workload][i]));if([0,9,29].includes(i))results.storage.push({workload,phase:`predictions_${i+1}`,tables:JSON.parse(sql(storageSQL)),predictions:Number(sql('select count(*)from research.prediction_snapshots')),backlog:Number(sql('select count(*)from research.capture_backlog(100,0)'))});}
  assert.equal(sql('select count(*)from research.prediction_snapshots'),'30');assert.equal(sql('select count(*)from research.capture_backlog(100,0)'),'0');db.sql('drop database storage_trial');save();
 }
}finally{db.close();}
