// Disposable PostgreSQL-only experiments. No capture SQL or production settings changed.
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {localDatabase,docker,IMAGE} from '../test-support/local-db.mjs';
import {realisticHistory,seedHistory,evidenceRows} from '../test-support/history.mjs';
import {snapshotFromCapture} from '../lib/snapshot-contract.mjs';
import {buildAsOfInputs,existingMatchFeatures} from '../lib/asof-features.mjs';
const run=promisify(execFile),db=localDatabase('profile');
const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
const output=process.argv[2]||'/tmp/mm-capture-profile.json';
const reverse=process.argv[3]==='reverse';
const diverse=process.argv.includes('diverse'),targets=new Map();
const expected=diverse?18:54;
const variants=[{name:'current',settings:''},{name:'jit_off',settings:'set jit=off;'},{name:'jit_off_64mb',settings:"set jit=off;set work_mem='64MB';"},{name:'narrow_latest',settings:'',narrow:true}];
if(process.argv.includes('focused'))variants.splice(1,2);
if(reverse)variants.reverse();
const result={schema:1,kind:'synthetic-local-experiment',external_requests:0,variants:[]};
let next=8000000;
function statement(id){const t=targets.get(id);const quote=x=>"'"+String(x).replaceAll("'","''")+"'";return `set role research_publisher;insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(${id},${t.lid},${quote(t.date)},'18:00',${quote(t.home)},${quote(t.away)},.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance')on conflict do nothing;`;}
async function asyncSql(sql,database){return (await run('docker',['--host=unix:///var/run/docker.sock','exec',db.name,'psql','-X','-v','ON_ERROR_STOP=1','-At','-U','postgres','-d',database,'-c',sql],{env,timeout:60000,maxBuffer:8*1024*1024})).stdout.trim();}
function quantiles(a){a=[...a].sort((a,b)=>a-b);return {n:a.length,p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)};}
try {
 docker(['image','inspect',IMAGE]); // Fail if the existing pinned image is absent; no installation workflow here.
 await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 // Pin the reviewed wide baseline so comparisons remain reproducible after adoption.
 const baselineSource=execFileSync('git',['show','d4cb3379a3f1d6d0b7252ab134969b33397a5820:audits/staging/evidence-manifests.sql'],{encoding:'utf8'});
 const baselineDDL=baselineSource.slice(baselineSource.indexOf('CREATE FUNCTION research.select_m14_evidence('),baselineSource.indexOf('CREATE FUNCTION research.read_snapshot_evidence('));
 db.sql(baselineDDL.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));

 const history=realisticHistory();const target=history.find(x=>x.fxid==='999999');
 const teams=['Arsenal','Liverpool',...Array.from({length:14},(_,i)=>`Team ${i+2}`)];
 for(let i=0;i<64;i++)targets.set(8000000+i,{...target,fxid:String(8000000+i),...(diverse?{lid:i%2?40:39,home:teams[Math.floor(i/2)%16],away:teams[(Math.floor(i/2)+1+Math.floor(i/32))%16]}:{})});
 seedHistory(db,[...history,...Array.from({length:2000},(_,i)=>({fxid:String(2000000+i),lid:999,home:`Far home ${i%16}`,away:`Far away ${i%16}`,date:`${2022+i%4}-05-01`,time:'18:00',status:'FINISHED',gh:1,ga:0,season:2022+i%4,round:'Regular Season - 1',xg_h:1.1,xg_a:.9})),...targets.values()]);
 db.sql('analyze research.observations;');
 result.observations=Number(db.sql('select count(*)from research.observations'));
 result.server=db.sql('select version()');result.image=JSON.parse(docker(['inspect',db.name]))[0].Image;
 for(const variant of variants){
  const database='profile_'+variant.name;db.sql(`create database ${database} template matchmind_test`);
  const sql=q=>db.sql(q,database);
  if(variant.narrow){
   const original=sql("select pg_get_functiondef('research.select_m14_evidence(bigint)'::regprocedure)");
   assert.equal(original.split('o.*').length,2);
   sql(original.replace('o.*','o.fixture_id,o.field_name,o.value,o.observation_id'));
  }
  // Instrument only this disposable clone. Profile tables are outside research admission.
  sql(`create table public.mm_profile(stage text,app text,ms double precision);alter table public.mm_profile owner to research_owner;`);
  for(const [name,args,call,ret,stage,extra] of [
   ['check_budget','extra_bytes bigint','extra_bytes','void','budget',''],
   ['select_m14_evidence','fid bigint','fid','uuid[]','selection',''],
   ['store_evidence_manifest','ids uuid[],spec jsonb','ids,spec','uuid','manifest',''],
   ['capture_prediction','fid bigint','fid','uuid','capture','SECURITY DEFINER']]) {
   sql(`alter function research.${name}(${args})rename to ${name}_profile_original;create function research.${name}(${args})returns ${ret} language plpgsql ${extra} set search_path=pg_catalog as $p$declare t timestamptz;v ${ret==='void'?'text':ret};begin t:=clock_timestamp();${ret==='void'?'perform':'select'} research.${name}_profile_original(${call})${ret==='void'?'':' into v'};insert into public.mm_profile values('${stage}',current_setting('application_name'),extract(epoch from clock_timestamp()-t)*1000);${ret==='void'?'return;':'return v;'}end$p$;alter function research.${name}(${args})owner to research_owner;revoke all on function research.${name}(${args})from public;`);
  }
  next=8000000;const rows=[];const locks=[];
  for(const concurrency of [1,2,5,10])for(let repeat=0;repeat<(diverse?1:3);repeat++) {
   let done=false;
   const sampler=(async()=>{while(!done){const x=await asyncSql("select coalesce(json_agg(json_build_object('wait',wait_event_type,'event',wait_event,'blocked_by',pg_blocking_pids(pid))),'[]')from pg_stat_activity where application_name like 'mmprof-%' and state='active'",database);locks.push(...JSON.parse(x));await new Promise(r=>setTimeout(r,75));}})();
   const tasks=Array.from({length:concurrency},async()=>{const id=next++;const t=performance.now();const times=(await asyncSql(`set application_name='mmprof-${id}';set statement_timeout='45s';${variant.settings}select clock_timestamp();${statement(id)}select clock_timestamp();`,database)).split('\n');const dates=times.filter(x=>/^\d{4}-/.test(x));assert.equal(dates.length,2);return {id,concurrency,repeat,client_ms:performance.now()-t,server_ms:Date.parse(dates[1])-Date.parse(dates[0])};});
   try{rows.push(...await Promise.all(tasks));}finally{done=true;await sampler;}
  }
  const stages=JSON.parse(sql("select json_agg(t)from(select stage,app,sum(ms)ms from public.mm_profile group by stage,app)t"));
  const firstId=8000000;
  const envelope=JSON.parse(sql(`select envelope from research.prediction_snapshots where fixture_id=${firstId}`));
  const snap=snapshotFromCapture(envelope);const proxy={sql};
  const full=buildAsOfInputs({snapshot:snap,observations:evidenceRows(proxy)});
  const selected=buildAsOfInputs({snapshot:snap,observations:evidenceRows(proxy,`select *from research.read_snapshot_evidence('${snap.snapshot_id}')`)});
  assert.deepEqual(existingMatchFeatures(selected),existingMatchFeatures(full));
  const ids=sql(`select research.select_m14_evidence(${firstId})`);
  const counts=JSON.parse(sql("select json_build_object('source',(select count(*)from public.predictions),'snapshots',(select count(*)from research.prediction_snapshots),'backlog',(select count(*)from research.capture_backlog(100,0)),'manifest_roots_hash',(select encode(public.digest(string_agg(p.fixture_id::text||':'||m.payload_hash,','order by p.fixture_id),'sha256'),'hex')from research.prediction_snapshots p join research.evidence_manifests m on m.manifest_id=p.evidence_manifest_id),'evidence',(select envelope->'evidence_manifest'->'evidence_count'from research.prediction_snapshots where fixture_id=8000000),'bytes',(select sum(pg_total_relation_size(oid))from pg_class where relnamespace='research'::regnamespace and relkind='r'))"));
  assert.equal(counts.source,expected);assert.equal(counts.snapshots,expected);assert.equal(counts.backlog,0);
  // Capture an expanded selector plan rather than only the SQL-function wrapper.
  const def=sql("select pg_get_functiondef('research.select_m14_evidence_profile_original(bigint)'::regprocedure)");
  const body=def.slice(def.indexOf('$function$')+10,def.lastIndexOf('$function$')).replaceAll('fid','8000000');
  const plan=JSON.parse(sql(`${variant.settings}explain(analyze,buffers,format json)${body}`).split('\n').filter(x=>!x.startsWith('SET')).join('\n'));
  result.variants.push({name:variant.name,settings:variant.settings,rows,stages,locks,counts,ids,feature_parity:true,plan});
  writeFileSync(output,JSON.stringify(result,null,2));
  console.log(JSON.stringify({variant:variant.name,counts,client:quantiles(rows.map(x=>x.client_ms)),server:quantiles(rows.map(x=>x.server_ms))}));
 }
 for(const variant of result.variants){assert.equal(result.variants[0].ids,variant.ids);assert.equal(result.variants[0].counts.manifest_roots_hash,variant.counts.manifest_roots_hash);}
 result.evidence_ids_equal=true;result.workload=diverse?'diverse-teams-two-leagues':'repeated-pair-manifest-reuse';result.order=variants.map(x=>x.name);writeFileSync(output,JSON.stringify(result,null,2));
} finally {db.close();}
