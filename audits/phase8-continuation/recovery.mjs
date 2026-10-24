import {readFileSync,readdirSync,existsSync,writeFileSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {privateDirectory} from '../phase8/files.mjs';
import {loadBackup} from '../phase8/archive.mjs';
import {localDatabase} from '../test-support/local-db.mjs';
import {ENGINE_SOURCE_SHA256} from '../phase8/engine.mjs';
import {canonicalHash} from '../lib/snapshot-contract.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function extractRecovery(archive,checksum,destination){
 if(statSync(archive).size>64*1024*1024)throw Error('unsafe archive size');
 const bytes=readFileSync(archive),expected=readFileSync(checksum,'utf8').trim().split(/\s+/)[0];
 if(!/^[a-f0-9]{64}$/.test(expected)||sha(bytes)!==expected)throw Error('recovery archive checksum mismatch');
 if(existsSync(destination)&&readdirSync(destination).length)throw Error('empty new recovery directory required');
 const dir=privateDirectory(destination);
 try{execFileSync('python3',[fileURLToPath(new URL('./extract.py',import.meta.url)),archive,dir],{stdio:['ignore','pipe','pipe'],timeout:60000});}
 catch{throw Error('unsafe or invalid recovery archive; do not use partial extraction');}
 return{directory:dir,archive_sha256:expected};
}
export function verifyAncestry(checkpoints){
 if(!checkpoints.length)throw Error('no recovery checkpoint');
 let prior=new Map(),liability=0;
 for(const c of checkpoints){
  const map=new Map(c.events.map(e=>[e.event_id,canonicalHash(e)]));
  if(map.size!==c.events.length||[...prior].some(([id,h])=>map.get(id)!==h))throw Error('broken immutable backup ancestry');
  if(!Number.isSafeInteger(c.liability_micros)||c.liability_micros<liability||c.liability_micros>5000000)throw Error('invalid retained liability');
  prior=map;liability=c.liability_micros;
 }
 return{checkpoints:checkpoints.length,event_count:prior.size,liability_micros:liability};
}
export function verifyFrozenEngine(engine,stored,sourceHash,inputHash){
 if(engine.source_sha256!==sourceHash||engine.input_hash!==inputHash)throw Error('frozen engine source/input mismatch');
 const map=new Map(engine.predictions.map(p=>[String(p.fixture_id),p]));
 for(const row of stored){const body=row.body,p=map.get(String(row.fixture_id??body.fixture_id));
  if(!p||body.input_hash!==inputHash||canonicalHash(body.probabilities)!==canonicalHash(p.probabilities)||canonicalHash(body.prediction)!==canonicalHash(p.prediction))throw Error('frozen forecast differs from archived engine');
 }
 if(stored.length!==engine.predictions.filter(p=>p.status===undefined||p.status==='forecast').length)throw Error('missing frozen forecasts');
 return stored.length;
}
export function classifyAuxiliary(auxiliary,known){
 for(const checkpoint of known){
  try{verifyAncestry([auxiliary,checkpoint]);return{name:auxiliary.name,matches:checkpoint.name,kind:auxiliary.events.length===checkpoint.events.length?'equivalent_event_set':'earlier_event_prefix',liability_micros:auxiliary.liability_micros};}catch{}
 }
 throw Error('unclassified backup is not a verified ancestor; reconcile complete backup ancestry');
}
async function inspectAuxiliary(dump,label){
 const db=localDatabase(label);await db.start();
 try{
  for(const role of ['research_owner','research_operator','research_publisher','research_reader','research_collector','shadow_operator','shadow_reader','shadow_runner','anon','authenticated','service_role'])db.sql(`CREATE ROLE ${role} NOLOGIN`);
  db.restore(dump);const sql=s=>db.sql(s,'matchmind_restore');
  if(sql("SELECT count(*)FROM shadow_eval.weekend_events WHERE event_body_hash<>encode(public.digest(body::text,'sha256'),'hex')")!=='0')throw Error('corrupt auxiliary event');
  return{events:JSON.parse(sql("SELECT jsonb_agg(jsonb_build_object('event_id',event_id,'kind',kind,'parent',parent_id,'hash',event_body_hash,'received',received_at)ORDER BY event_id)FROM shadow_eval.weekend_events")),liability_micros:Number(sql("SELECT coalesce(sum((body->>'reserved_micros')::bigint),0)FROM shadow_eval.weekend_events WHERE kind='reservation'"))};
 }finally{db.close();}
}
// Read-only verification of the owner's archived SQL, only in disposable network-none PostgreSQL.
export async function verifyRecovery(directory){
 const dir=privateDirectory(directory),run=join(dir,'saturday-run');
 const manifest=JSON.parse(readFileSync(join(run,'recovery-manifest.json'),'utf8'));
 const names=readdirSync(run).filter(n=>/^private-weekend-backup(?:-\d+)?\.sql$/.test(n)).sort((a,b)=>a==='private-weekend-backup.sql'?-1:b==='private-weekend-backup.sql'?1:a.localeCompare(b));
 if(names.length!==3||names.at(-1)!==manifest.private_latest_backup)throw Error('incomplete or ambiguous Saturday checkpoint ancestry');
 const checkpoints=[],source=JSON.parse(readFileSync(join(dir,'raw-source.json'),'utf8'));
 for(let i=0;i<names.length;i++){
  const name=names[i],checksum=name==='private-weekend-backup.sql'?'backup.sha256':name.replace('private-weekend-backup-','backup-').replace('.sql','.sha256');
  if(i===names.length-1&&checksum!==manifest.private_latest_backup_checksum)throw Error('latest checksum mismatch');
  const dump=loadBackup(run,name,checksum),db=localDatabase('recovery-'+i);await db.start();
  try{
   // pg_dump excludes cluster roles. Create only known NOLOGIN roles, never connection grants.
   for(const role of ['research_owner','research_operator','research_publisher','research_reader','research_collector','shadow_operator','shadow_reader','shadow_runner','anon','authenticated','service_role'])db.sql(`CREATE ROLE ${role} NOLOGIN`);
   db.restore(dump);
   const sql=s=>db.sql(s,'matchmind_restore');
   if(sql("SELECT count(*)FROM shadow_eval.weekend_events WHERE event_body_hash<>encode(public.digest(body::text,'sha256'),'hex')")!=='0')throw Error('corrupt stored immutable event');
   const events=JSON.parse(sql("SELECT jsonb_agg(jsonb_build_object('event_id',event_id,'kind',kind,'parent',parent_id,'hash',event_body_hash,'received',received_at) ORDER BY event_id)FROM shadow_eval.weekend_events"));
   const liability=Number(sql("SELECT coalesce(sum((body->>'reserved_micros')::bigint),0)FROM shadow_eval.weekend_events WHERE kind='reservation'"));
   const packet=JSON.parse(sql("SELECT body FROM shadow_eval.weekend_events WHERE kind='packet'"));
   if(canonicalHash(packet)!==canonicalHash(source)||source.rows.length!==93680)throw Error('incomplete original evidence packet');
   if(i===0){
    const receipt=sql(`SELECT to_char(received_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')FROM shadow_eval.weekend_events WHERE kind='packet'`);
    const frozen=JSON.parse(sql("SELECT jsonb_agg(jsonb_build_object('fixture_id',j.body->>'fixture_id','body',e.body))FROM shadow_eval.weekend_events e JOIN shadow_eval.weekend_events j ON j.event_id=e.parent_id WHERE e.kind='forecast' AND e.body->>'arm'='E-Refreshed' AND e.body->>'status'='forecast'"));
    verifyFrozenEngine(JSON.parse(readFileSync(join(run,'engine-output.json'),'utf8')),frozen,ENGINE_SOURCE_SHA256,canonicalHash({...source,receipt_at_utc:receipt}));
   }

   const counts=JSON.parse(sql("SELECT jsonb_object_agg(kind,n)FROM(SELECT kind,count(*)n FROM shadow_eval.weekend_events GROUP BY kind)t"));
   if(counts.job!==145||counts.forecast!==725||Number(sql("SELECT count(*)FROM shadow_eval.weekend_events WHERE kind='forecast' AND body->>'arm'='E-Refreshed' AND body->>'status'='forecast'"))!==145)throw Error('missing immutable forecast records');
   for(const role of ['anon','authenticated']){
    if(sql(`SELECT has_table_privilege('${role}','shadow_eval.weekend_events','SELECT')`)!=='f')throw Error('private permission failed');
   }
   if(sql('SELECT max_bytes FROM research.control')!=='262144000')throw Error('research budget changed');
   checkpoints.push({name,sha256:sha(dump),events,liability_micros:liability,counts});
  }finally{db.close();}
 }
 const auxiliary=[];
 for(const extra of readdirSync(run).filter(n=>n.endsWith('.sql')&&!names.includes(n))){
  const dump=readFileSync(join(run,extra),'utf8'),state=await inspectAuxiliary(dump,'recovery-aux-'+auxiliary.length);
  auxiliary.push({...classifyAuxiliary({...state,name:extra},checkpoints),sha256:sha(dump)});
 }
 const summary=verifyAncestry(checkpoints);
 const proof={version:'saturday-recovery-v1',verified_at_utc:new Date().toISOString(),...summary,auxiliary_checkpoints:auxiliary,packet_hash:canonicalHash(source),source_rows:source.rows.length,immutable_refreshed_forecasts:145,frozen_engine_parity_verified:true,checkpoint_hashes:checkpoints.map(c=>({name:c.name,sha256:c.sha256})),latest_checkpoint:manifest.private_latest_backup,
  note:'Owner separately confirmed external archive+checksum retention. Local verification does not assert new issuance or new receipt provenance. Saturday legacy confirmation semantics retained.'};
 return proof;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [archive,checksum,destination]=process.argv.slice(2);
 if(!archive||!checksum||!destination||process.argv.length!==5)throw Error('usage: recovery.mjs /private/archive.tgz /private/archive.sha256 /private/new-recovery-directory');
 const extraction=extractRecovery(archive,checksum,destination),proof=await verifyRecovery(extraction.directory);
 writeFileSync(join(extraction.directory,'recovery-verification.json'),JSON.stringify({...proof,...extraction},null,2)+'\n',{flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify({verified:true,checkpoints:proof.checkpoints,forecasts:145,liability_micros:proof.liability_micros,source_rows:proof.source_rows})+'\n');
}
