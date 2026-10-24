// Local Docker exec only. No URL, Supabase SDK, connection string or process env API.
import { readFileSync } from 'node:fs';
import { docker, IMAGE, literal } from '../test-support/local-db.mjs';
import { canonicalHash, snapshotFromCapture } from '../lib/snapshot-contract.mjs';
import { verifyCandidate } from './core.mjs';
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const hash=x=>{if(typeof x!=='string'||!/^[0-9a-f]{64}$/.test(x))throw Error('invalid hash');return quote(x);};
const uuid=x=>{if(typeof x!=='string'||!/^[0-9a-f-]{36}$/.test(x))throw Error('invalid snapshot id');return quote(x)+'::uuid';};
const time=x=>`to_char(${x} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
export function repository(db){
 if(!db||typeof db.name!=='string'||!/^mm-phase3-[0-9]+-[a-z0-9-]+$/.test(db.name)||typeof db.sql!=='function')throw Error('explicit local database required');
 const info=JSON.parse(docker(['inspect',db.name]))[0];
 if(info.Config.Image!==IMAGE||info.HostConfig.NetworkMode!=='none'||Object.keys(info.NetworkSettings.Ports??{}).some(k=>info.NetworkSettings.Ports[k]?.length))throw Error('local database isolation failed');
 const call=(role,sql)=>db.sql(`SET ROLE ${role};${sql}`).split('\n').at(-1);
 return {
  install(){return db.sql(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));},
  register(c){verifyCandidate(c);return call('shadow_operator',`SELECT shadow_eval.register_candidate(${literal(c)})`);},
  declareJob(cid,fid,sid){if(!/^[1-9][0-9]{0,17}$/.test(fid))throw Error('invalid fixture');const jid=canonicalHash({candidate_id:cid,fixture_id:fid});
   return call('shadow_operator',`SELECT shadow_eval.declare_job(${hash(jid)},${hash(cid)},${quote(fid)}::bigint,${sid===null?'NULL':uuid(sid)})`);},
  load(sid){
   const row=JSON.parse(call('shadow_reader',`SELECT jsonb_build_object('envelope',s.envelope,'payload_hash',s.payload_hash,'capture_kind',s.capture_kind,'manifest_hash',m.payload_hash,'observations',(SELECT coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('fixture_id',o.fixture_id::text)),'[]')FROM research.read_snapshot_evidence(s.snapshot_id)o))FROM research.prediction_snapshots s JOIN research.evidence_manifests m ON m.manifest_id=s.evidence_manifest_id WHERE s.snapshot_id=${uuid(sid)}`)||'null');
   if(!row)throw Error('snapshot missing');
   return {snapshot:snapshotFromCapture(row.envelope),capture:{payload_hash:row.payload_hash,capture_kind:row.capture_kind,manifest_hash:row.manifest_hash,source_prediction:row.envelope.source_prediction},observations:row.observations};
  },
  save(r){return call('shadow_runner',`SELECT shadow_eval.save_result(${literal(r)})`);},
  recordAttempt(e){if(!e||Object.keys(e).sort().join(',')!=='code,job_id,state')throw Error('invalid attempt');return call('shadow_runner',`SELECT shadow_eval.record_attempt(${hash(e.job_id)},${quote(e.state)},${quote(e.code)})`);},
  settle(jid,b){return call('shadow_operator',`SELECT shadow_eval.settle(${hash(jid)},${literal(b)})`);},
  exportStudy(cid){return JSON.parse(call('shadow_reader',`SELECT jsonb_build_object('candidate',c.envelope,'registered_at_utc',${time('c.registered_at')},
   'records',(SELECT coalesce(jsonb_agg(jsonb_build_object('job_id',j.job_id,'fixture_id',j.fixture_id::text,'source_prediction',j.source_prediction,'snapshot',s.envelope,
    'capture',jsonb_build_object('payload_hash',s.payload_hash,'capture_kind',s.capture_kind,'manifest_hash',m.payload_hash),
    'result',r.envelope,'result_received_at_utc',${time('r.received_at')},'declared_at_utc',${time('j.declared_at')},
    'observations',CASE WHEN s.snapshot_id IS NULL THEN '[]'::jsonb ELSE(SELECT coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('fixture_id',o.fixture_id::text)),'[]')FROM research.read_snapshot_evidence(s.snapshot_id)o)END,
    'settlements',(SELECT coalesce(jsonb_agg(t.envelope||jsonb_build_object('revision',t.revision,'received_at_utc',${time('t.received_at')},'pg_payload_hash',t.payload_hash)ORDER BY t.revision),'[]')FROM shadow_eval.settlements t WHERE t.job_id=j.job_id))ORDER BY j.fixture_id),'[]')
    FROM shadow_eval.jobs j LEFT JOIN research.prediction_snapshots s ON s.snapshot_id=j.snapshot_id LEFT JOIN research.evidence_manifests m ON m.manifest_id=s.evidence_manifest_id LEFT JOIN shadow_eval.results r ON r.job_id=j.job_id WHERE j.candidate_id=c.candidate_id),
   'attempts',(SELECT coalesce(jsonb_agg(jsonb_build_object('job_id',a.job_id,'state',a.state,'code',a.code,'received_at_utc',${time('a.received_at')})ORDER BY a.attempt_id),'[]')FROM shadow_eval.attempts a JOIN shadow_eval.jobs j USING(job_id)WHERE j.candidate_id=c.candidate_id))FROM shadow_eval.candidates c WHERE c.candidate_id=${hash(cid)}`));}
 };
}
