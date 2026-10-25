import test,{before,after}from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,copyFileSync,rmSync}from 'node:fs';
import {join}from 'node:path';
import {tmpdir}from 'node:os';
import {createHash}from 'node:crypto';
import {localDatabase,docker,IMAGE}from '../test-support/local-db.mjs';
import {repository}from '../phase6/repository.mjs';
import {weekendStore}from '../phase8/store.mjs';
import {runSunday}from '../phase8-continuation/supervised.mjs';
import {checkpointWriter,verifyCheckpointFiles}from '../phase8-continuation/checkpoint.mjs';
import {resultsView,resultsReport}from '../phase8-continuation/protocol.mjs';
import {collectResults}from '../phase8/collect-results.mjs';
import {MODELS}from '../phase8-continuation/contracts.mjs';
import {canonicalHash}from '../lib/snapshot-contract.mjs';

const STAGING=['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'];
const MINUTE=60000,sha=x=>createHash('sha256').update(x).digest('hex'),round6=x=>Math.round(x*1e6)/1e6;
// Whole-minute anchors only. Fixture times are minute-precision, so utcKickoff
// drops the seconds: any anchor carrying seconds can round back across its own
// issue time and make the run nondeterministic.
const BASE=Math.floor(Date.now()/MINUTE)*MINUTE;
const AHEAD=BASE+3*MINUTE,PLAYED=BASE-MINUTE,VOIDED=BASE-3600*MINUTE,ABANDONED=BASE-1800*MINUTE;
const iso=ms=>new Date(ms).toISOString();
const at=ms=>({date:iso(ms).slice(0,10),time:iso(ms).slice(11,19)});
const row=(fxid,ms)=>({fxid,lid:39,home:'H'+fxid,away:'A'+fxid,status:'NS',...at(ms)});
const SOURCE=()=>({synthetic:true,source_read_at_utc:iso(Date.now()),targets:[101,102,103,104],originals:[],odds:[],
 rows:[row(101,AHEAD),row(102,AHEAD),row(103,VOIDED),row(104,ABANDONED)]});
const engineFor=store=>async packet=>{
 const generated_at_utc=store.clock();
 return{synthetic_clock:true,source_sha256:'synthetic',input_hash:canonicalHash(packet),predictions:[
  {fixture_id:'101',status:'forecast',generated_at_utc,probabilities:[.5,.3,.2],prediction:{pW:.5,pD:.3,pL:.2},decision:{pick:'1'},eligible:true,exclusion_reason:null},
  {fixture_id:'102',status:'forecast',generated_at_utc,probabilities:[.6,.25,.15],prediction:{pW:.6,pD:.25,pL:.15},decision:{pick:'1'},eligible:false,exclusion_reason:'low'},
  {fixture_id:'103',status:'failed',exclusion_reason:'insufficient_history'}
  // 104 is absent on purpose: the engine returned nothing for it at all.
 ]};
};
// Deterministic synthetic outcomes. 101 is won in extra time but drawn at 90.
const LABELS=new Map([
 ['101',{fxid:101,...at(PLAYED),status:'AET',gh:2,ga:1,ft_h:1,ft_a:1,provider:'af',updated_at:iso(BASE)}],
 ['102',{fxid:102,...at(PLAYED),status:'FT',gh:2,ga:0,ft_h:null,ft_a:null,provider:'af',updated_at:iso(BASE)}],
 ['103',{fxid:103,...at(VOIDED),status:'PST',gh:null,ga:null,ft_h:null,ft_a:null,provider:'af',updated_at:iso(BASE)}],
 ['104',{fxid:104,...at(ABANDONED),status:'ABD',gh:null,ga:null,ft_h:null,ft_a:null,provider:'af',updated_at:iso(BASE)}]
]);
const reads=[];
const read=(table,parameters)=>{reads.push({table,parameters});return{rows:[...LABELS.values()],total:LABELS.size,received_at_utc:iso(Date.now())};};

const db=localDatabase('phase8-full-cycle');
let home,ckptDir,mondayDir,mondayCkptDir,store,parentSha,ran,metas,finalMeta,coldEvents,summary,study,report;
let clientCalls=0,preflightCalls=0;
before(async()=>{
 docker(['image','inspect',IMAGE]);await db.start();
 for(const f of STAGING)db.apply(f);
 repository(db).install();store=weekendStore(db);store.install();
 home=mkdtempSync(join(tmpdir(),'mm-phase8-cycle-'));
 ckptDir=join(home,'checkpoints');mondayDir=join(home,'monday');
 // The verified state before the run is this chain's parent, as an operator's
 // retained archive hash would be.
 parentSha=sha(db.dump());

 const source=SOURCE(),checkpoint=checkpointWriter(db,store,ckptDir,parentSha);
 const client={execute:async()=>{clientCalls++;throw Error('no provider may be reached in a dry run')}};
 const preflight=async()=>{preflightCalls++;throw Error('no account may be reached in a dry run')};
 ran=await runSunday({store,source,engine:engineFor(store),kind:'synthetic_verification',synthetic:true,
  supervised:true,recoveryVerified:true,externalCopyVerified:true,paid:false,client,preflight,checkpoint});

 metas=verifyCheckpointFiles(ckptDir,parentSha);finalMeta=metas.at(-1);
 // File proof alone does not authorise a resume, so restore the actual SQL cold
 // and compare every event hash and receipt against the verified head.
 db.sql('create database matchmind_cold');db.sql(readFileSync(join(ckptDir,finalMeta.backup),'utf8'),'matchmind_cold');
 coldEvents=weekendStore({name:db.name,sql:s=>db.sql(s,'matchmind_cold')}).events();

 mkdirSync(mondayDir,{recursive:true,mode:0o700});
 for(const name of [finalMeta.backup,finalMeta.checksum])copyFileSync(join(ckptDir,name),join(mondayDir,name));
 writeFileSync(join(mondayDir,'study.json'),JSON.stringify({records:[{odds:source.odds}]}));
 mondayCkptDir=join(home,'monday-checkpoints');
 summary=await collectResults({dir:mondayDir,backup:finalMeta.backup,checksum:finalMeta.checksum},
  {read,label:'phase8-cycle-monday',checkpointDir:mondayCkptDir,parentSha256:finalMeta.backup_sha256});
 study=JSON.parse(readFileSync(join(mondayDir,'study-'+summary.cycle+'.json'),'utf8'));
 report=JSON.parse(readFileSync(join(mondayDir,'report-'+summary.cycle+'.json'),'utf8'));
});
after(()=>{db.close();if(home)rmSync(home,{recursive:true,force:true});});

test('the real Sunday runner writes its own journal and reaches no provider',()=>{
 assert.equal(ran.fixtures,4);assert.equal(ran.jobs,12);
 assert.equal(ran.paid_mode_requested,false);assert.equal(ran.synthetic_verification,true);
 assert.equal(ran.provider_blocked,false);assert.equal(ran.retained_liability_micros,0);
 assert.equal(clientCalls,0);assert.equal(preflightCalls,0);

 const events=store.events(),count=kind=>events.filter(e=>e.kind===kind).length;
 assert.equal(count('study'),1);assert.equal(count('packet'),1);assert.equal(count('job'),12);
 // Every job carries E and E-Refreshed; the eight model jobs also carry A1, A2 and A3.
 assert.equal(count('forecast'),48);
 // Only the two issued baselines need a commit, once per job that carries one.
 assert.equal(count('confirmation'),6);
 assert.equal(events.filter(e=>e.kind==='confirmation').every(e=>e.body.status==='accepted'),true);
 assert.equal(count('reservation'),0);assert.equal(count('usage'),0);
 assert.equal(store.reservedMicros(),0);
});

test('the real checkpoint writer chains its generations and the cold restore matches the head',()=>{
 assert.equal(metas.length,2);
 assert.equal(metas[0].parent_sha256,parentSha);
 assert.equal(metas[1].parent_sha256,metas[0].backup_sha256);
 assert.equal(metas.every(m=>m.version==='private-checkpoint-v1'&&m.reserved_micros===0),true);
 // The first generation is taken before the AI arms are recorded, so the chain
 // grows and never rewrites what it already held.
 assert.ok(metas[0].events.length<metas[1].events.length);
 for(const m of metas){
  const dump=readFileSync(join(ckptDir,m.backup),'utf8');
  assert.equal(sha(dump),m.backup_sha256);
  assert.equal(readFileSync(join(ckptDir,m.checksum),'utf8').trim(),m.backup_sha256);
 }
 const key=e=>e.event_id,shape=e=>({event_id:e.event_id,kind:e.kind,parent:e.parent_id??null,hash:e.event_body_hash,received:e.received_at});
 assert.deepEqual(coldEvents.map(shape).sort((a,b)=>key(a)<key(b)?-1:1),[...finalMeta.events].sort((a,b)=>key(a)<key(b)?-1:1));
 assert.equal(coldEvents.length,finalMeta.events.length);
});

test('the real Monday collector settles the restored journal on regulation time',()=>{
 assert.equal(summary.mode,'continuation');assert.equal(summary.accuracy_claim,false);
 assert.equal(reads.length,1);assert.equal(reads[0].table,'fixtures');
 assert.equal(study.records.length,12);
 assert.equal(report.sunday.coverage.roster,4);
 assert.equal(study.records.filter(r=>r.missing_enrollment).length,0);
 assert.equal(study.records.filter(r=>r.labels.length===1).length,12);

 // Regulation time decides 101: mean Brier 0.5125 is the 0.78 of a draw with the
 // 0.245 of 102's home win. Scoring 101 as the extra-time win would give 0.3125.
 assert.equal(report.sunday.arms['E-Refreshed'].n,2);
 assert.equal(round6(report.sunday.arms['E-Refreshed'].brier),0.5125);
 assert.equal(report.sunday.arms['E-Refreshed'].failed,2);
 assert.equal(report.sunday.arms.E.n,0);assert.equal(report.sunday.arms.E.abstained,4);

 // Postponed beyond 48 hours voids; abandoned inside 48 hours stays pending.
 assert.equal(report.sunday.coverage.void,1);
 assert.equal(report.sunday.coverage.pending,1);

 // No paid run happened, so every AI arm is attributed as a disabled failure on
 // its own model's job and nothing is scored or presented as a model output.
 for(const model of MODELS){
  const m=report.models[model];
  assert.equal(m.coverage.roster,4);
  for(const arm of ['A1','A2','A3']){assert.equal(m.arms[arm].n,0);assert.equal(m.arms[arm].failed,4);}
 }
 const aiRows=study.records.filter(r=>r.cohort==='sunday-ai');
 assert.equal(aiRows.length,8);
 assert.equal(aiRows.every(r=>MODELS.includes(r.provider_model)),true);
 for(const r of aiRows)for(const f of r.forecasts.filter(f=>['A1','A2','A3'].includes(f.arm))){
  assert.equal(f.status,'failed');assert.equal(f.reason,'paid_execution_disabled');
  assert.equal(f.fallback_scored_as_ai,false);assert.equal(f.probabilities,undefined);
  assert.equal(f.generation_id,undefined);
 }
 // Nothing invents a receipt, a probability or a result anywhere in the study.
 for(const r of study.records)for(const f of r.forecasts){
  if(f.status==='forecast')assert.equal(typeof f.generated_at_utc,'string',r.job_id+':'+f.arm);
  else assert.equal(f.probabilities,undefined,r.job_id+':'+f.arm);
 }
 assert.equal(report.reserved_liability_usd,0);
 assert.equal(report.actual_ai_spend_usd,0);
 assert.equal(report.accuracy_claim,false);
 assert.equal(report.confirmatory_eligible,false);
 // Collecting outcomes leaves the verified chain exactly as it was.
 assert.deepEqual(verifyCheckpointFiles(ckptDir,parentSha).map(m=>m.backup_sha256),metas.map(m=>m.backup_sha256));
});

test('outcome collection extends the verified chain instead of standing outside it',async()=>{
 // The collector wrote its own parent-linked generation from the head hash.
 assert.equal(summary.checkpoint.parent_sha256,finalMeta.backup_sha256);
 assert.equal(summary.checkpoint.reserved_micros,0);
 const chain=verifyCheckpointFiles(mondayCkptDir,finalMeta.backup_sha256);
 assert.equal(chain.length,1);
 assert.equal(chain[0].backup_sha256,summary.checkpoint.backup_sha256);
 assert.equal(readFileSync(join(mondayCkptDir,chain[0].checksum),'utf8').trim(),chain[0].backup_sha256);
 // Only labels were added, and every pre-collection event keeps its hash.
 const added=chain[0].events.filter(e=>e.kind==='label');
 assert.equal(added.length,6);
 assert.equal(chain[0].events.length,finalMeta.events.length+6);
 const before=new Map(finalMeta.events.map(e=>[e.event_id,e.hash]));
 assert.equal(chain[0].events.filter(e=>before.has(e.event_id)).every(e=>before.get(e.event_id)===e.hash),true);
 assert.equal(chain[0].events.filter(e=>e.kind==='reservation'||e.kind==='usage').length,0);
 // Both proofs must be given together or neither is accepted, and the refusal
 // comes before any container or restore is started.
 await assert.rejects(()=>collectResults({dir:mondayDir,backup:finalMeta.backup,checksum:finalMeta.checksum},{read,label:'phase8-cycle-reject',checkpointDir:mondayCkptDir}),/required together/);
 await assert.rejects(()=>collectResults({dir:mondayDir,backup:finalMeta.backup,checksum:finalMeta.checksum},{read,label:'phase8-cycle-reject',parentSha256:finalMeta.backup_sha256}),/required together/);
});

test('nothing in the cycle can reach production, a provider or a real private record',()=>{
 const info=JSON.parse(docker(['inspect',db.name]))[0];
 assert.equal(info.Config.Image,IMAGE);
 assert.equal(info.HostConfig.NetworkMode,'none');
 assert.equal(Object.values(info.NetworkSettings.Ports??{}).some(v=>v?.length),false);
 assert.equal(db.sql('select count(*)from public.predictions'),'0');
 assert.equal(db.sql('select max_bytes from research.control'),'262144000');
 assert.throws(()=>db.sql('set role anon;select *from shadow_eval.weekend_events'),/permission/);
 assert.throws(()=>db.sql('delete from shadow_eval.weekend_events'),/immutable/);
 // The journal, its restored copy and both checkpoints all carry no liability.
 assert.equal(store.reservedMicros(),0);
 assert.equal(coldEvents.filter(e=>e.kind==='reservation'||e.kind==='usage').length,0);
 assert.equal(metas.every(m=>m.reserved_micros===0),true);
 assert.equal(JSON.stringify(report).includes('openrouter.ai'),false);
});

test('an interrupted enrollment keeps every declared target in the denominator',async()=>{
 const other=localDatabase('phase8-cycle-interrupted');await other.start();
 const scratch=mkdtempSync(join(tmpdir(),'mm-phase8-interrupted-'));
 try{
  for(const f of STAGING)other.apply(f);
  repository(other).install();const partial=weekendStore(other);partial.install();
  // The real writer refuses fixture id 0, so the runner stops after its study and
  // packet are already immutable and only part of the roster has jobs.
  const source=SOURCE();source.rows.push({fxid:0,lid:39,home:'H0',away:'A0',status:'NS',...at(AHEAD+MINUTE)});source.targets.push(0);
  await assert.rejects(()=>runSunday({store:partial,source,engine:engineFor(partial),kind:'synthetic_verification',synthetic:true,
   supervised:true,recoveryVerified:true,externalCopyVerified:true,paid:false,
   checkpoint:checkpointWriter(other,partial,join(scratch,'checkpoints'),sha(other.dump()))}),/weekend operation failed/);

  const declared=partial.events().find(e=>e.kind==='study').body.roster;
  assert.equal(declared.length,5);
  assert.equal(partial.events().filter(e=>e.kind==='job').length,12);
  const view=resultsView(partial);
  assert.equal(view.mode,'continuation');
  const missing=view.study.records.filter(r=>r.missing_enrollment);
  assert.equal(view.study.records.length,15);assert.equal(missing.length,3);
  assert.equal(missing.every(r=>r.fixture_id==='0'),true);
  assert.equal(missing.every(r=>r.forecasts.every(f=>f.status==='failed'&&f.reason==='declared_target_enrollment_or_capture_failed')),true);
  assert.equal(missing.some(r=>r.forecasts.some(f=>f.generated_at_utc||f.probabilities)),false);
  assert.equal(resultsReport(view,'2026-10-26T08:00:00Z').sunday.coverage.roster,5);
  assert.equal(partial.reservedMicros(),0);
 }finally{other.close();rmSync(scratch,{recursive:true,force:true});}
});

test('recovery refuses a corrupted, relinked or incomplete checkpoint chain',()=>{
 const clone=()=>{const d=mkdtempSync(join(tmpdir(),'mm-phase8-ckpt-'));for(const n of readdirSync(ckptDir))copyFileSync(join(ckptDir,n),join(d,n));return d;};
 const dirs=[];
 try{
  const corrupt=clone();dirs.push(corrupt);
  writeFileSync(join(corrupt,finalMeta.backup),readFileSync(join(corrupt,finalMeta.backup),'utf8')+'\n-- tampered\n');
  assert.throws(()=>verifyCheckpointFiles(corrupt,parentSha),/hash mismatch/);

  const relinked=clone();dirs.push(relinked);
  const meta=JSON.parse(readFileSync(join(relinked,'checkpoint-000002.json'),'utf8'));
  writeFileSync(join(relinked,'checkpoint-000002.json'),JSON.stringify({...meta,parent_sha256:'d'.repeat(64)})+'\n');
  assert.throws(()=>verifyCheckpointFiles(relinked,parentSha),/parent continuity/);

  const incomplete=clone();dirs.push(incomplete);
  rmSync(join(incomplete,finalMeta.checksum));
  assert.throws(()=>verifyCheckpointFiles(incomplete,parentSha),/incomplete private checkpoint/);

  const truncated=clone();dirs.push(truncated);
  for(const n of ['checkpoint-000001.json','checkpoint-000001.sql','checkpoint-000001.sha256'])rmSync(join(truncated,n));
  assert.throws(()=>verifyCheckpointFiles(truncated,parentSha),/missing checkpoint generation/);

  const foreign=clone();dirs.push(foreign);
  assert.throws(()=>verifyCheckpointFiles(foreign,'e'.repeat(64)),/parent continuity/);
  assert.throws(()=>verifyCheckpointFiles(ckptDir,'not-a-sha'),/parent continuity/);
  // A directory that already holds a journal is never silently reset.
  assert.throws(()=>checkpointWriter(db,store,ckptDir,parentSha),/empty checkpoint directory/);
  assert.throws(()=>checkpointWriter(db,store,join(home,'never-created'),'short'),/parent SHA256/);
 }finally{for(const d of dirs)rmSync(d,{recursive:true,force:true});}
});
