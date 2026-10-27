import {readFileSync} from 'node:fs';
import {weekendStore} from '../phase8/store.mjs';
import {literal,docker} from '../test-support/local-db.mjs';
import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
const anchor=JSON.parse(readFileSync(new URL('./ledger-anchor.json',import.meta.url)));
const stores=new WeakSet();
export function assertSingleStore(store){if(!stores.has(store))throw Error('owned_isolated_single_store_required');return store;}
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
export function singleStore(db){
 // Never trust a caller-provided SQL function to authenticate operator receipts.
 const database=db?.database??'matchmind_test';if(!['matchmind_test','matchmind_restore'].includes(database))throw Error('fixed_local_database_required');
 const name=db?.name;
 const local=Object.freeze({name,sql:s=>docker(['exec','-i',name,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',database,'-At'],s).trim()});
 const original=weekendStore(local); // Validates pinned image/socket/network-none.
 const query=sql=>local.sql(sql).trim().split('\n').at(-1);
 const receipt=(id,kind)=>JSON.parse(query(`SET ROLE shadow_reader;SELECT coalesce((SELECT jsonb_build_object('receipt_id',receipt_id,'kind',kind,'job_id',job_id,'body',body,'body_hash',body_hash,'received_at',received_at)FROM shadow_eval.a3_operator_receipts WHERE receipt_id=${q(id)} AND kind=${q(kind)}),'null'::jsonb)`));
 const store={...original,installSingle(){local.sql(readFileSync(new URL('./local.sql',import.meta.url),'utf8'));return local.sql(readFileSync(new URL('./attempts.sql',import.meta.url),'utf8'));},
  installAttemptGuard(){return local.sql(readFileSync(new URL('./attempts.sql',import.meta.url),'utf8'));},
  installCapacityException(){return local.sql(readFileSync(new URL('./capacity-exception.sql',import.meta.url),'utf8'));},
  readCapacityException(id){return JSON.parse(query(`SET ROLE shadow_reader;SELECT coalesce((SELECT jsonb_build_object('receipt_id',receipt_id,'kind','capacity_exception','study_id',study_id,'job_id',job_id,'body',body,'body_hash',body_hash,'received_at',received_at)FROM shadow_eval.a3_capacity_exceptions WHERE receipt_id=${q(id)} AND body_hash=encode(public.digest(body::text,'sha256'),'hex')),'null'::jsonb)`));},
  recordCapacityException(id,job,body){return query(`SET ROLE shadow_operator;SELECT shadow_eval.a3_capacity_record(${q(id)},${q(job)},${literal(body)})`);},
  hasCapacityAttempt(){return query('SET ROLE shadow_reader;SELECT EXISTS(SELECT FROM shadow_eval.a3_capacity_attempts)')==='t';},
  reserveCapacity(auth,id,job,body){return query(`SET ROLE shadow_operator;SELECT shadow_eval.a3_capacity_reserve(${q(auth)},${q(id)},${q(job)},${literal(body)})`);},
  assertLedgerAnchor(){const rows=JSON.parse(query(`SET ROLE shadow_reader;SELECT coalesce(jsonb_agg(jsonb_build_array(event_id,kind,parent_id,event_body_hash,received_at)ORDER BY event_id),'[]'::jsonb)FROM shadow_eval.weekend_events WHERE received_at<=${q(anchor.cutoff_utc)}::timestamptz`));const normalized=rows.map(r=>[...r.slice(0,4),epochMicros(r[4]).toString()]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);if(normalized.length!==anchor.events||canonicalHash(normalized)!==anchor.identity_hash)throw Error('accepted_shared_ledger_ancestry_missing_or_changed');return true;},
  declare(id,body){return query(`SET ROLE shadow_operator;SELECT shadow_eval.a3_single_study(${q(id)},${literal(body)})`);},
  readAuthorization:id=>receipt(id,'authorization'),readReadiness:id=>receipt(id,'readiness'),
  hasSingleAttempt(job){return query(`SET ROLE shadow_reader;SELECT EXISTS(SELECT FROM shadow_eval.a3_single_attempts a JOIN shadow_eval.weekend_events j ON j.parent_id=(SELECT parent_id FROM shadow_eval.weekend_events WHERE event_id=${q(job)})WHERE a.job_id=j.event_id)`) ==='t';},
  reserveSingle(auth,id,job,body){return query(`SET ROLE shadow_operator;SELECT shadow_eval.a3_single_reserve(${q(auth)},${q(id)},${q(job)},${literal(body)})`);},
  recordOperator(kind,id,job,body){return query(`SET ROLE shadow_operator;SELECT shadow_eval.a3_operator_record(${q(kind)},${q(id)},${q(job)},${literal(body)})`);}
 };Object.freeze(store);stores.add(store);return store;
}
export function enrollOne(db,source,{study_id,issuance_date_utc}){
 if(source.synthetic===true||source.collection?.kind!=='a3_single_readonly_v1'||source.targets.length!==1)throw Error('genuine_complete_readonly_source_required');
 const store=singleStore(db),id=String(source.targets[0]),f=source.rows.find(r=>String(r.fxid)===id);
 store.declare(study_id,{version:'a3-supervised-single-v1',fixture_id:id,issuance_date_utc,model:'openai/gpt-6-luna',provider:'OpenAI',one_request:true,source_hash:canonicalHash(source)});
 const packet=store.append('packet',study_id+':packet',study_id,source),receipt=store.receipt(packet);
 const job=store.append('job',study_id+':job',packet,{fixture_id:id,provider_model:'openai/gpt-6-luna',kickoff_at_utc:f.date+'T'+f.time+':00Z',cohort:'a3-supervised-single-v1'});
 return{study_id,packet_id:packet,job_id:job,receipt_at_utc:receipt};
}
