// Supervised receipt-now results read and private restore. NO hosted writes.
import {readFileSync,writeFileSync}from 'node:fs';
import {resolve,isAbsolute}from 'node:path';
import {fileURLToPath}from 'node:url';
import {createHash}from 'node:crypto';
import {localDatabase,docker,IMAGE}from '../test-support/local-db.mjs';
import {repository}from '../phase6/repository.mjs';
import {weekendStore}from './store.mjs';
import {readSource}from './source.mjs';
import {resultsView,resultsReport}from '../phase8-continuation/protocol.mjs';
import {privateDirectory}from './files.mjs';
import {loadBackup}from './archive.mjs';
export const USAGE='usage: node audits/phase8/collect-results.mjs /private/weekend-run-directory [prior-backup.sql prior-hash.sha256]';
export function parseArguments(argv){
 const dir=argv[2];if(!dir||!isAbsolute(dir)||![3,5].includes(argv.length))throw Error(USAGE);
 return{dir,backup:argv[3]??'private-weekend-backup.sql',checksum:argv[4]??'backup.sha256'};
}
// The label read and the container label stay injectable so a disposable
// synthetic run can exercise this exact workflow without a network call. The
// command line always uses the real read-only reader.
export async function collectResults({dir,backup,checksum},{read=readSource,label='phase8-results'}={}){
 const real=privateDirectory(dir);
 const input=JSON.parse(readFileSync(resolve(real,'study.json'))),dump=loadBackup(real,backup,checksum);
 const db=localDatabase(label);docker(['image','inspect',IMAGE]);await db.start();
 try{
  for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);repository(db).install();db.restore(dump);
  const restored={name:db.name,sql:s=>db.sql(s,'matchmind_restore')},store=weekendStore(restored),cycle=store.clock().replaceAll(/[^0-9]/g,''),jobs=store.events().filter(e=>e.kind==='job');
  for(let i=0;i<jobs.length;i+=50){
   const group=jobs.slice(i,i+50),response=read('fixtures',{select:'fxid,date,time,status,gh,ga,ft_h,ft_a,provider,updated_at',fxid:'in.('+group.map(j=>j.body.fixture_id).join(',')+')',order:'fxid.asc',limit:1000});
   const map=new Map(response.rows.map(r=>[String(r.fxid),r]));
   for(const j of group)store.append('label',j.event_id+':label:'+cycle,j.event_id,{fixture_id:j.body.fixture_id,fixture:map.get(j.body.fixture_id)??null,source:'read_only_receipt_now',source_read_at_utc:response.received_at_utc,legacy_updated_at_is_not_settlement_receipt:true});
  }
  // A continuation journal carries per-model cohorts and declared-but-unenrolled
  // roster rows, so it needs the continuation view and report, never the older
  // single-cohort summary.
  const sourceOdds=input.records.flatMap(r=>r.odds),view=resultsView(store,sourceOdds),study=view.study,at=store.clock(),report=resultsReport(view,at);
  const save=(name,value)=>writeFileSync(resolve(real,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
  save('study-'+cycle+'.json',study);save('report-'+cycle+'.json',report);
  const nextDump=docker(['exec',db.name,'pg_dump','-U','postgres','-d','matchmind_restore']);save('private-weekend-backup-'+cycle+'.sql',nextDump);save('backup-'+cycle+'.sha256',createHash('sha256').update(nextDump).digest('hex')+'\n');
  // Originals and input lineage never change. An operator selects the new verified
  // dump for the next restore; no unattended overwrite or scheduler is claimed.
  const summary=view.mode==='continuation'?{roster:{saturday:report.saturday.coverage.roster,sunday:report.sunday.coverage.roster},saturday:report.saturday.coverage,sunday:report.sunday.coverage,sunday_arms:report.sunday.arms}:{coverage:report.coverage,arms:report.arms};
  return{cycle,mode:view.mode,observed_at_utc:at,...summary,actual_ai_spend_usd:report.actual_ai_spend_usd,accuracy_claim:false};
 }finally{db.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {cycle,...summary}=await collectResults(parseArguments(process.argv));
 process.stdout.write(JSON.stringify(summary,null,2)+'\n');
}
