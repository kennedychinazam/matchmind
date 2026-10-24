// Supervised run only. No scheduler, provider transport, public publisher or writes.
import {readFileSync,writeFileSync,existsSync}from 'node:fs';
import {resolve,relative,isAbsolute}from 'node:path';
import {fileURLToPath}from 'node:url';
import {createHash}from 'node:crypto';
import {localDatabase,docker,IMAGE}from '../test-support/local-db.mjs';
import {repository}from '../phase6/repository.mjs';
import {trainingRepository}from '../phase7/local.mjs';
import {canonicalHash,epochMicros}from '../lib/snapshot-contract.mjs';
import {runEngine}from './engine.mjs';
import {weekendStore}from './store.mjs';
import {evaluateWeekend,eventsToStudy}from './report.mjs';
import {privateDirectory}from './files.mjs';
import {canonicalKickoff}from './kickoff.mjs';
const dir=process.argv[2],rawFile=process.argv[3];
if(!dir||!rawFile||!isAbsolute(dir)||!isAbsolute(rawFile)||process.argv.length!==4)throw Error('usage: node audits/phase8/run-weekend.mjs /private/new-directory /private/raw-source.json');
const real=privateDirectory(dir);
const save=(name,value)=>writeFileSync(resolve(real,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
const source=JSON.parse(readFileSync(rawFile,'utf8')),db=localDatabase('phase8-weekend');docker(['image','inspect',IMAGE]);await db.start();
let store;
try{
 for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 repository(db).install();trainingRepository(db).install();store=weekendStore(db);store.install();
 const window=store.clock().slice(0,10);if(!['2026-10-24','2026-10-25'].includes(window))throw Error('outside fixed weekend observation windows');
 const study=store.append('study','weekend-20261024-v1',null,{version:'weekend-v1',kind:'receipt_now_private_exploratory',windows:['2026-10-24','2026-10-25'],engine_build:355,ai_total_ceiling_micros:5000000,ai_enabled:false,selection:'All future unplayed weekend targets in complete fixed engine scope; sorted kickoff then fixture ID; no confidence/outcome filter.'});
 const pid=store.append('packet','packet:'+canonicalHash(source),study,source),receipt=store.receipt(pid),packet={...source,receipt_at_utc:receipt};
 const initial=new Map(source.rows.map(r=>[r.fxid,r])),originals=new Map(source.originals.map(r=>[r.fxid,r])),jobs=[];
 const ids=[...source.targets].sort((a,b)=>{const x=initial.get(a),y=initial.get(b);return(x.date+'T'+x.time).localeCompare(y.date+'T'+y.time)||a-b;});
 for(const id of ids){const row=initial.get(id),key=window+':'+id,kickoff=canonicalKickoff(row.date+'T'+row.time+'Z');
  const jid=store.append('job',key,pid,{fixture_id:String(id),league:row.lid,window,kickoff_at_utc:kickoff,original:originals.get(id)??null});jobs.push({jid,id,kickoff});}
 let engine,failure=null;
 try{engine=await runEngine(packet);save('engine-output.json',engine);}catch{failure='engine_packet_or_execution_failed';}
 const predictions=new Map((engine?.predictions??[]).map(r=>[Number(r.fixture_id),r]));
 for(const j of jobs){
  const r=predictions.get(j.id),body=r?.status==='forecast'?{arm:'E-Refreshed',status:'forecast',generated_at_utc:r.generated_at_utc,probabilities:r.probabilities,model_version:'Build355-private-weekend-v1',engine_source_hash:engine.source_sha256,executor_hash:createHash('sha256').update(readFileSync(new URL('./engine.mjs',import.meta.url))).digest('hex'),input_hash:engine.input_hash,decision:r.decision,eligible:r.eligible,exclusion_reason:r.exclusion_reason,prediction:r.prediction}:{arm:'E-Refreshed',status:'failed',reason:r?.exclusion_reason??failure??'engine_missing'};
  try{store.append('forecast',j.jid+':E-Refreshed',j.jid,body);}catch{if(!store.read(j.jid+':E-Refreshed'))store.append('forecast',j.jid+':E-Refreshed',j.jid,{arm:'E-Refreshed',status:'failed',reason:'persistence_or_pre_kickoff_admission_failed'});}
  store.append('forecast',j.jid+':E',j.jid,{arm:'E',status:'abstain',reason:'original_preserved_as_context_only_no_at_issue_capture'});
  for(const arm of ['A1','A2','A3'])store.append('forecast',j.jid+':'+arm,j.jid,{arm,status:'failed',reason:'provider_account_network_and_durable_budget_authority_unverified'});
 }
 const events=store.events(),exported={...eventsToStudy(events,source.odds,receipt),packet_hash:canonicalHash(source),packet_received_at_utc:receipt},records=exported.records,forecastEvents=records.flatMap(r=>r.forecasts).map(body=>({body}));save('study.json',exported);
 const report=evaluateWeekend(exported,store.clock());save('report.json',report);
 const summary={kind:'genuine_receipt_now_supervised_weekend',window,observed_at_utc:store.clock(),source_rows:source.rows.length,roster:records.length,engine_forecasts:forecastEvents.filter(e=>e.body.arm==='E-Refreshed'&&e.body.status==='forecast').length,engine_failures:forecastEvents.filter(e=>e.body.arm==='E-Refreshed'&&e.body.status==='failed').length,ai_forecasts:0,ai_failures:jobs.length*3,actual_ai_spend_usd:0,reserved_liability_usd:0,all_outcomes_pending:true,packet_hash:canonicalHash(source),storage:store.storage(),engine_source_hash:engine?.source_sha256??null,executor_hash:createHash('sha256').update(readFileSync(new URL('./engine.mjs',import.meta.url))).digest('hex'),operational:'This supervised run only; no durable scheduler or Sunday/Monday execution is claimed.',accuracy_claim:false,engine_failure:failure};
 save('aggregates.json',summary);save('private-weekend-backup.sql',db.dump());save('backup.sha256',createHash('sha256').update(readFileSync(resolve(real,'private-weekend-backup.sql'))).digest('hex')+'\n');
 process.stdout.write(JSON.stringify(summary,null,2)+'\n');
}finally{
 // If an earlier step failed, preserve available private state for reconciliation.
 try{if(store&&!existsSync(resolve(real,'private-weekend-backup.sql')))writeFileSync(resolve(real,'emergency-backup.sql'),db.dump(),{mode:0o600,flag:'wx'});}finally{db.close();}
}
