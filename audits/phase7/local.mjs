import {readFileSync}from 'node:fs';
import {generateKeyPairSync}from 'node:crypto';
import {performance}from 'node:perf_hooks';
import {setTimeout}from 'node:timers/promises';
import {repository}from '../phase6/repository.mjs';
import {freezeCandidate}from '../phase6/core.mjs';
import {literal}from '../test-support/local-db.mjs';
import {seedHistory}from '../test-support/history.mjs';
import {canonicalHash,canonicalJSON,epochMicros}from '../lib/snapshot-contract.mjs';
import {sealDataset,sealFreeze,sourceVersions,verifyDataset}from './attestation.mjs';
import {prepareSamples}from './samples.mjs';
import {fitCoefficient,verifyArtifact}from './train.mjs';
import {validateCoefficient}from './evaluate.mjs';
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const hash=x=>{if(!/^[0-9a-f]{64}$/.test(x))throw Error('invalid hash');return quote(x);};
const uuid=x=>{if(!/^[0-9a-f-]{36}$/.test(x))throw Error('invalid snapshot');return quote(x)+'::uuid';};
const utc=c=>`to_char(${c} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
export const serverClock=db=>db.sql(`select ${utc('clock_timestamp()')}`);
export function trainingRepository(db){
 const repo=repository(db); // The inherited boundary verifies image/network/ports.
 const call=sql=>db.sql('set role shadow_operator;'+sql).split('\n').at(-1);
 return{
  install(){return db.sql(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));},
  exportDataset(candidateId,privateKey,keyId){
   const roster=repo.exportStudy(candidateId),observations={},examples=[];
   for(const row of roster.records){
    if(!row.snapshot){examples.push({fixture_id:row.fixture_id,snapshot:null,source_prediction:row.source_prediction,settlements:[]});continue;}
    const sql=`select jsonb_build_object('snapshot',s.envelope,'capture',jsonb_build_object('capture_kind',s.capture_kind,'received_at_utc',${utc('s.received_at_utc')},'payload_hash',s.payload_hash,'envelope_text',s.envelope::text,'manifest_hash',m.payload_hash),
     'manifest',jsonb_build_object('payload_hash',m.payload_hash,'body_text',m.body::text,'chunks',(select coalesce(jsonb_agg(jsonb_build_object('ordinal',x.ordinal,'chunk_hash',x.chunk_hash,'member_count',c.member_count,'members',(select jsonb_agg(jsonb_build_object('ordinal',v.ordinal,'observation_id',v.observation_id)order by v.ordinal)from research.evidence_chunk_members v where v.chunk_hash=x.chunk_hash))order by x.ordinal),'[]')from research.evidence_manifest_chunks x join research.evidence_chunks c using(chunk_hash)where x.manifest_id=m.manifest_id)),
     'rows',(select coalesce(jsonb_agg((to_jsonb(o)-'input')||jsonb_build_object('fixture_id',o.fixture_id::text,'value_text',o.value::text)),'[]')from research.read_snapshot_evidence(s.snapshot_id)o))
     from research.prediction_snapshots s join research.evidence_manifests m on m.manifest_id=s.evidence_manifest_id where s.snapshot_id=${uuid(row.snapshot.snapshot_id)}`;
    const value=JSON.parse(db.sql('set role shadow_reader;'+sql).split('\n').at(-1));
    for(const o of value.rows){if(observations[o.observation_id]&&canonicalJSON(observations[o.observation_id])!==canonicalJSON(o))throw Error('conflicting immutable observation');observations[o.observation_id]=o;}
    const settlements=JSON.parse(call(`select coalesce(jsonb_agg(jsonb_build_object('revision',revision,'received_at_utc',${utc('received_at')},'envelope_text',envelope::text,'payload_hash',payload_hash)order by revision),'[]')from shadow_eval.settlements where job_id=${hash(row.job_id)}`));
    examples.push({fixture_id:row.fixture_id,snapshot:value.snapshot,capture:value.capture,manifest:value.manifest,source_prediction:row.source_prediction,settlements});
   }
   const payload={schema_version:1,dataset_kind:'synthetic_verification',source:{source_id:'local-'+db.name,clock_domain:'postgres_server'},source_versions:sourceVersions(),exported_at_utc:serverClock(db),observations,examples};
   return sealDataset(payload,privateKey,keyId);
  },
  saveDataset(packet,prepared,policy){
   const v=verifyDataset(packet,policy);
   if(v.payload.source.clock_domain!=='postgres_server'||v.payload.source.source_id!=='local-'+db.name)throw Error('actual local server snapshot source required');
   if(canonicalJSON(prepared)!==canonicalJSON(prepareSamples(packet,policy,prepared.label_cutoff_utc)))throw Error('prepared samples changed');
   const eligible=new Map(prepared.eligible.map(x=>[x.fixture_id,x])),rejected=new Map(prepared.rejected.map(x=>[x.fixture_id,x.reason]));
   const rows=v.payload.examples.map(r=>({fixture_id:r.fixture_id,snapshot_id:r.snapshot?.snapshot_id??null,status:eligible.has(r.fixture_id)?'eligible':'rejected',reason:rejected.get(r.fixture_id)??null,sample:eligible.get(r.fixture_id)??null}));
   const header={dataset_hash:v.dataset_hash,kind:v.payload.dataset_kind,source:v.payload.source,source_versions:v.payload.source_versions,exported_at_utc:v.payload.exported_at_utc,roster:rows.length,roster_hash:canonicalHash(rows.map(r=>({fixture_id:r.fixture_id,snapshot_id:r.snapshot_id}))),signature_hash:canonicalHash(v.signature)};
   return call(`select shadow_eval.register_training_dataset(${literal(header)},${literal(rows)})`);
  },
  freezeArtifact(artifact,protocol,privateKey,keyId){verifyArtifact(artifact);const receipt=JSON.parse(call(`select shadow_eval.register_training_artifact(${literal(artifact)},${hash(canonicalHash(protocol))})`));return sealFreeze(receipt,privateKey,keyId);}
 };
}
async function waitUntil(db,at){const left=Number(epochMicros(at)-epochMicros(serverClock(db)))/1000;if(left>15000)throw Error('synthetic clock wait exceeds bounded window');if(left>0)await setTimeout(left+30);if(epochMicros(serverClock(db))<epochMicros(at))throw Error('server clock did not reach synthetic event');}
export async function syntheticClockProof(db,{training=30,validation=18,clockHorizonSeconds=3,privateSink}={}){
 if(!Number.isInteger(training)||training<20||training>60||!Number.isInteger(validation)||validation<1||validation>30||!Number.isInteger(clockHorizonSeconds)||clockHorizonSeconds<2||clockHorizonSeconds>5)throw Error('bounded synthetic proof required');
 const local=trainingRepository(db),repo=repository(db),{privateKey,publicKey}=generateKeyPairSync('ed25519'),policy={key_id:'local-synthetic-poc',public_key_pem:publicKey.export({type:'spki',format:'pem'}),purpose:'phase7-synthetic-poc',allowed_kind:'synthetic_verification',source_id:'local-'+db.name,clock_domain:'postgres_server'};
 const started=performance.now(),startUtc=serverClock(db),history=[];
 for(let i=0;i<5;i++){const d=new Date(Date.parse(startUtc)-(i+1)*86400000).toISOString().slice(0,10);history.push({fxid:String(610000+i),lid:39,home:'Alpha',away:'Beta',date:d,time:'18:00',status:'FINISHED',gh:2,ga:1,xg_h:1.5,xg_a:1,season:2026});}
 seedHistory(db,history);
 async function cohort(count,prefix,tag,issueNotBefore=null,kickoffOverride=null){
  const c=freezeCandidate({version:'phase7-source-'+tag,adapter_id:'identity-v1',configuration:{},frozen_at_utc:serverClock(db),study_kind:'synthetic_verification'});repo.register(c);
  const kickoff=kickoffOverride??new Date(Math.ceil((Date.parse(serverClock(db))+clockHorizonSeconds*1000)/1000)*1000).toISOString(),date=kickoff.slice(0,10),time=kickoff.slice(11,19);
  const targets=Array.from({length:count},(_,i)=>({fxid:String(prefix+i),lid:39,home:'Alpha',away:'Beta',date,time,status:'NS',season:2026}));seedHistory(db,targets);
  const providerEvent=serverClock(db),odds=targets.map((r,i)=>({observation_id:`${String(prefix+i).padStart(8,'0')}-2222-4222-8222-222222222222`,fixture_id:r.fxid,source_kind:'odds',source_ref:'synthetic-book',collector_run_id:'22222222-2222-4222-8222-222222222222',field_name:'odds_1x2',value:{fxid:r.fxid,id:prefix+i,captured_at:providerEvent,mins_to_kick:1,h:1.9,d:3.2,a:4.8},availability:'observed',feature_schema_version:1,source_hash:'a'.repeat(64),effective_at_utc:null,played_at_utc:null}));
  db.sql(`set role research_collector;select research.append_observations(${literal(odds)})`);
  if(issueNotBefore)await waitUntil(db,issueNotBefore);
  db.sql(`set role research_publisher;insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)select fxid::bigint,lid,date::date,time,home,away,.4,.2,.4,1.5,1,'1X',.6,355,clock_timestamp(),'Double Chance'from jsonb_to_recordset(${literal(targets)})as x(fxid text,lid int,date text,time text,home text,away text)`);
  const captured=JSON.parse(db.sql(`select jsonb_agg(jsonb_build_object('fixture_id',fixture_id::text,'snapshot_id',snapshot_id)order by fixture_id)from research.prediction_snapshots where fixture_id between ${prefix} and ${prefix+count-1}`));
  if(captured?.length!==count)throw Error('synthetic source capture failed');
  const jobs=captured.map(r=>({...r,job_id:repo.declareJob(c.candidate_id,r.fixture_id,r.snapshot_id)}));
  await waitUntil(db,kickoff);
  for(const[i,j]of jobs.entries())repo.settle(j.job_id,{fixture_id:j.fixture_id,kind:'synthetic_verification',event_finished_at_utc:kickoff,synthetic_event_duration_seconds:0,fixture:{date,time,status:'FT',provider:'af',gh:i%3===2?0:1,ga:i%3===2?1:0,ft_h:i%3===2?0:1,ft_a:i%3===2?1:0}});
  return c;
 }
 const trainSource=await cohort(training,710000,'training'),trainPacket=local.exportDataset(trainSource.candidate_id,privateKey,policy.key_id),fitCutoff=serverClock(db);
 const fitAt=performance.now(),fitConfig={version:'phase7-clock-proof-v1',train_start_utc:startUtc,fit_cutoff_utc:fitCutoff,minimum_examples:20},artifact=fitCoefficient(trainPacket,policy,fitConfig),fitMs=performance.now()-fitAt;
 const prep=prepareSamples(trainPacket,policy,fitCutoff);local.saveDataset(trainPacket,prep,policy);local.saveDataset(trainPacket,prep,policy);
 const validationStart=new Date(Math.ceil((Date.parse(serverClock(db))+5000)/1000)*1000).toISOString();
 const valKickoff=new Date(Date.parse(validationStart)+clockHorizonSeconds*1000).toISOString();
 const protocol={start_utc:validationStart,end_utc:valKickoff,label_cutoff_utc:new Date(Date.parse(valKickoff)+10000).toISOString()};
 const frozen=local.freezeArtifact(artifact,protocol,privateKey,policy.key_id);
 const valSource=await cohort(validation,720000,'validation',validationStart,valKickoff);
 await waitUntil(db,protocol.label_cutoff_utc);
 const valPacket=local.exportDataset(valSource.candidate_id,privateKey,policy.key_id),valAt=performance.now(),validationReport=validateCoefficient(artifact,frozen,valPacket,policy,protocol),validationMs=performance.now()-valAt;
 local.saveDataset(valPacket,prepareSamples(valPacket,policy,protocol.label_cutoff_utc),policy);
 const tables=JSON.parse(db.sql("select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'total_bytes',pg_total_relation_size(c.oid),'index_bytes',pg_indexes_size(c.oid)+case when c.reltoastrelid<>0 then pg_indexes_size(c.reltoastrelid)else 0 end)order by n.nspname,c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('research','shadow_eval')and c.relkind='r'"));
 const frozenAt=epochMicros(frozen.payload.registered_at_utc),issues=valPacket.payload.examples.map(r=>epochMicros(r.snapshot.issue_time_utc));
 if(privateSink)privateSink({training:trainPacket,validation:valPacket,artifact,freeze:frozen,protocol,policy,privateKey});
 return{kind:'synthetic_verification',accuracy_claim:false,real_football_examples:0,training:{status:artifact.status,beta:artifact.beta,n:artifact.training.n,artifact_hash:artifact.artifact_hash},validation:validationReport,
  chronology:{training_export_before_fit:epochMicros(trainPacket.payload.exported_at_utc)<epochMicros(fitCutoff),registration_before_validation_issue:issues.every(i=>i>frozenAt),clock_domain:'actual local PostgreSQL server receipts; synthetic zero-duration event times'},
  runtime:{total_ms:performance.now()-started,fit_ms:fitMs,validation_ms:validationMs,parent_max_rss_kib:process.resourceUsage().maxRSS},storage:{budget_bytes:262144000,tables,total_relation_bytes:tables.reduce((s,t)=>s+t.total_bytes,0),private_training_export_bytes:Buffer.byteLength(canonicalJSON(trainPacket)),private_validation_export_bytes:Buffer.byteLength(canonicalJSON(valPacket)),coefficient_artifact_bytes:Buffer.byteLength(canonicalJSON(artifact))}};
}
