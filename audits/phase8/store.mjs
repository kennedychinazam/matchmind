// Only the inherited pinned network-none Docker database; accepts no URL.
import {readFileSync}from 'node:fs';
import {execFile}from 'node:child_process';
import {repository}from '../phase6/repository.mjs';
import {literal}from '../test-support/local-db.mjs';
const q=x=>x===null?'NULL':"'"+String(x).replaceAll("'","''")+"'";
const safeError=e=>Error('private weekend operation failed: '+(['permission','storage','conflict','budget','kickoff','late','probab','immutable'].find(s=>String(e.stderr??e.message??e).includes(s))??'database'));
export function weekendStore(db){
 repository(db); // Verify cached image, local socket, no network/ports.
 const needsConfirmation=(kind,body)=>kind==='reservation'||kind==='forecast'&&body.status==='forecast';
 const statement=(kind,id,parent,body)=>`SET ROLE shadow_operator;SELECT shadow_eval.weekend_append(${q(kind)},${q(id)},${q(parent)},${literal(needsConfirmation(kind,body)?{...body,requires_confirmation:true}:body)})`;
 const call=sql=>{try{return db.sql(sql).split('\n').at(-1);}catch(e){throw safeError(e);}};
 const confirm=id=>{try{call(statement('confirmation',id+':commit',id,{status:'accepted'}));}catch{call(statement('confirmation',id+':commit',id,{status:'failed',reason:'late_or_unconfirmed_commit'}));throw Error('late or unconfirmed private commit');}};
 const append=(kind,id,parent,body)=>{const result=call(statement(kind,id,parent,body));if(needsConfirmation(kind,body))confirm(id);return result;};
 return{
  install(){return db.sql(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));},
  append,
  read(id){return JSON.parse(call(`SET ROLE shadow_reader;SELECT to_jsonb(e)FROM shadow_eval.weekend_events e WHERE event_id=${q(id)}`)||'null');},
  events(){return JSON.parse(call("SET ROLE shadow_reader;SELECT coalesce(jsonb_agg(CASE WHEN kind='packet' THEN to_jsonb(e)-'body'||jsonb_build_object('body',jsonb_build_object('omitted_from_report',true))ELSE to_jsonb(e)END ORDER BY received_at,event_id),'[]')FROM shadow_eval.weekend_events e"));},
  receipt(id){return call(`SELECT to_char(received_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')FROM shadow_eval.weekend_events WHERE event_id=${q(id)}`);},
  reserve(id,job,amount,requestHash){return append('reservation',id,job,{reserved_micros:amount,request_hash:requestHash});},
  reserveAsync(id,job,amount,requestHash){
   const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
   return new Promise((resolve,reject)=>{const child=execFile('docker',['--host=unix:///var/run/docker.sock','exec','-i',db.name,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','matchmind_test','-At'],{env,timeout:30000,maxBuffer:1024*1024},(error,out,stderr)=>{if(error){error.stderr=stderr;reject(safeError(error));}else resolve(out.trim().split('\n').at(-1));});child.stdin.end(statement('reservation',id,job,{reserved_micros:amount,request_hash:requestHash}));}).then(result=>{confirm(result);return result;});
  },
  reservedMicros(){return Number(call("SET ROLE shadow_reader;SELECT coalesce(sum((body->>'reserved_micros')::bigint),0)FROM shadow_eval.weekend_events WHERE kind='reservation'"));},
  storage(){return JSON.parse(call("SELECT jsonb_build_object('budget_bytes',(SELECT max_bytes FROM research.control),'relation_bytes',(SELECT coalesce(sum(pg_total_relation_size(oid)),0)FROM pg_class WHERE relnamespace IN('research'::regnamespace,'shadow_eval'::regnamespace)AND relkind IN('r','S')))"));},
  clock(){return call("SELECT to_char(clock_timestamp()AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')");}
 };
}
