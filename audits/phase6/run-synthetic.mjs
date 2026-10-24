// Complete LOCAL feasibility exercise. It never imports/executes the live publisher.
import {mkdirSync,writeFileSync,readFileSync,realpathSync,chmodSync}from 'node:fs';
import {isAbsolute,resolve,relative}from 'node:path';
import {fileURLToPath}from 'node:url';
import {performance}from 'node:perf_hooks';
import {randomUUID,createHash}from 'node:crypto';
import assert from 'node:assert/strict';
import {localDatabase,docker,IMAGE,literal}from '../test-support/local-db.mjs';
import {realisticHistory,seedHistory}from '../test-support/history.mjs';
import {canonicalHash}from '../lib/snapshot-contract.mjs';
import {freezeCandidate}from './core.mjs';
import {repository}from './repository.mjs';
import {runJob}from './runtime.mjs';
import {buildReport}from './report.mjs';
import {projectStorage}from './resources.mjs';

const output=process.argv[2],n=Number(process.argv[3]??30);
if(!output||!isAbsolute(output)||!Number.isInteger(n)||n<10||n>60)throw Error('usage: node audits/phase6/run-synthetic.mjs /private/absolute/directory [10..60 predictions]');
for(const k of ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ACCESS_TOKEN','API_FOOTBALL_KEY'])if(process.env[k])throw Error('provider/hosted credential present; use a clean offline environment');
mkdirSync(output,{recursive:true,mode:0o700});
const root=realpathSync(fileURLToPath(new URL('../../',import.meta.url))),directory=realpathSync(output);
if(!relative(root,directory).startsWith('..'))throw Error('raw exports must stay outside public repository');
chmodSync(directory,0o700);
docker(['image','inspect',IMAGE]); // Cached-image prerequisite, never download.
const db=localDatabase('phase6-feasibility');
const storage=()=>JSON.parse(db.sql(`select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'total_bytes',pg_total_relation_size(c.oid),'index_bytes',pg_indexes_size(c.oid)+case when c.reltoastrelid<>0 then pg_indexes_size(c.reltoastrelid)else 0 end)order by n.nspname,c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('research','shadow_eval')and c.relkind='r'`));
const shadowSize=t=>t.filter(x=>x.schema==='shadow_eval').reduce((s,x)=>({data:s.data+x.total_bytes-x.index_bytes,index:s.index+x.index_bytes}),{data:0,index:0});
const summary=values=>{const s=[...values].sort((a,b)=>a-b);return {n:s.length,median_ms:s[Math.floor((s.length-1)*.5)],p95_ms:s[Math.ceil((s.length-1)*.95)],maximum_ms:s.at(-1)};};
const privateWrite=(name,value)=>writeFileSync(resolve(directory,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
const timings={capture:[],load_and_execute_and_persist:[],load_ms:[],adapter_ms:[],persist_ms:[],monitor_ms:[],report:[]},phases=[];
await db.start();
try{
 for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 const repo=repository(db);repo.install();
 const frozen_at_utc=new Date().toISOString();
 const candidates=[freezeCandidate({version:'identity-feasibility-v1',adapter_id:'identity-v1',configuration:{},frozen_at_utc,study_kind:'synthetic_verification'}),
  freezeCandidate({version:'xgedge-synthetic-feasibility-v1',adapter_id:'m14-xgedge-v1',configuration:{artifact_kind:'synthetic',beta:.1},frozen_at_utc,study_kind:'synthetic_verification'})];
 candidates.forEach(c=>repo.register(c));phases.push({phase:'schema_and_registry',tables:storage()});
 const archive=realisticHistory().filter(r=>Number(r.fxid)<999998),teams=[...new Set(archive.map(r=>r.home))];
 const date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 const targets=Array.from({length:n},(_,i)=>({fxid:String(800000+i),lid:i<10?39:i%2?39:40,home:i<10?teams[0]:teams[i%teams.length],away:i<10?teams[1]:teams[(i+3)%teams.length],date,time:'18:00',status:'NS',season:2026}));
 const seedStart=performance.now();seedHistory(db,[...archive,...targets]);const seed_ms=performance.now()-seedStart;
 const odds=targets.map((r,i)=>({observation_id:randomUUID(),fixture_id:r.fxid,source_kind:'odds',source_ref:'synthetic-book',collector_run_id:randomUUID(),field_name:'odds_1x2',
  value:{fxid:r.fxid,id:i+1,captured_at:new Date().toISOString(),mins_to_kick:60,h:1.9,d:3.2,a:4.8},availability:'observed',feature_schema_version:1,source_hash:'a'.repeat(64),effective_at_utc:null,played_at_utc:null}));
 db.sql(`set role research_collector;select research.append_observations(${literal(odds)})`);phases.push({phase:'archive',tables:storage()});
 for(const [i,r]of targets.entries()){
  const start=performance.now();
  db.sql(`set role research_publisher;insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)
   select fxid::bigint,lid,date::date,time,home,away,.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance'from jsonb_to_record(${literal(r)})as x(fxid text,lid int,date text,time text,home text,away text)`);
  timings.capture.push(performance.now()-start);
  const sid=db.sql(`select snapshot_id from research.prediction_snapshots where fixture_id=${r.fxid}`);assert.ok(sid,'synthetic capture must succeed');
  for(const c of candidates){
   const job_id=repo.declareJob(c.candidate_id,r.fxid,sid),job={job_id,snapshot_id:sid};
   const at=performance.now(),out=runJob(repo,c,job);timings.load_and_execute_and_persist.push(performance.now()-at);
   assert.equal(out.persisted,true);assert.equal(out.attempt_recorded,true);
   for(const [key,value]of Object.entries(out.timings))timings[key].push(value);
   repo.settle(job_id,{fixture_id:r.fxid,kind:'synthetic_verification',fixture:{date,time:'18:00',status:'FINISHED',provider:'af',gh:i%3,ga:1,ft_h:i%3,ft_a:1}});
  }
  if(i===9||i===n-1)phases.push({phase:`predictions_${i+1}`,tables:storage()});
 }
 const asOfUtc=db.sql(`select to_char(clock_timestamp()at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`),reports=[];
 for(const c of candidates){const input={...repo.exportStudy(c.candidate_id),asOfUtc};privateWrite(c.version+'-private.json',input);
  const at=performance.now(),report=buildReport(input);timings.report.push(performance.now()-at);assert.deepEqual(report,buildReport(structuredClone(input)));reports.push(report);
 }
 const initial=shadowSize(phases[0].tables),ten=shadowSize(phases.find(p=>p.phase==='predictions_10').tables),last=shadowSize(phases.at(-1).tables);
 const jobs=n*candidates.length,firstJobs=10*candidates.length;
 const dataPerJob=Math.max((ten.data-initial.data)/firstJobs,(last.data-initial.data)/jobs,n>10?(last.data-ten.data)/(jobs-firstJobs):0);
 const indexPerJob=Math.max((ten.index-initial.index)/firstJobs,(last.index-initial.index)/jobs,n>10?(last.index-ten.index)/(jobs-firstJobs):0);
 const phase4=JSON.parse(readFileSync(new URL('../phase4/results/2026-10-24-storage-forecast.json',import.meta.url)));
 const projections=projectStorage({phase4,dataPerJob,indexPerJob,initialShadowBytes:initial.data+initial.index,candidates:candidates.length});
 const final={kind:'synthetic_verification',accuracy_claim:false,confirmatory_eligible:false,seed:{historical_fixtures:archive.length,target_predictions:n,seed_ms},
  database:{image:IMAGE,network:'none',host_ports:[],budget_bytes:262144000,observations:Number(db.sql('select count(*)from research.observations')),
   snapshots:Number(db.sql('select count(*)from research.prediction_snapshots')),manifest_min_max:db.sql('select min(evidence_count)||\',\'||max(evidence_count)from research.evidence_manifests'),
   manifest_distinct:Number(db.sql('select count(*)from research.evidence_manifests'))},
  timings:Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,summary(v)])),resource_usage:process.resourceUsage(),phases,projections,reports};
 privateWrite('feasibility-aggregates.json',final);
 const dump=db.dump();writeFileSync(resolve(directory,'private-research-backup.sql'),dump,{mode:0o600});
 privateWrite('database-dump-metadata.json',{dump_sha256:createHash('sha256').update(dump).digest('hex'),tables:storage()});
 process.stdout.write(JSON.stringify(final,null,2)+'\n');
}finally{db.close();}
