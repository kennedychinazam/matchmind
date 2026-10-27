import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {localDatabase,literal} from '../test-support/local-db.mjs';import {repository} from '../phase6/repository.mjs';import {weekendStore} from '../phase8/store.mjs';import {singleStore,assertSingleStore} from '../a3-supervised/local.mjs';
const declaration={version:'a3-supervised-single-v1',fixture_id:'1',issuance_date_utc:'2026-10-27',model:'openai/gpt-6-luna',provider:'OpenAI',one_request:true,source_hash:'a'.repeat(64)};
test('additive isolated schema preserves original Sunday writer, private receipts and shared budget authority',async()=>{
 const db=localDatabase('a3-supervised-schema');await db.start();try{
 for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 repository(db).install();const old=weekendStore(db);old.install();
 const before=db.sql("SELECT pg_get_functiondef('shadow_eval.weekend_append(text,text,text,jsonb)'::regprocedure)");
 const store=singleStore(db);store.installSingle();assert.equal(db.sql("SELECT pg_get_functiondef('shadow_eval.weekend_append(text,text,text,jsonb)'::regprocedure)"),before);
 assert.equal(assertSingleStore(store),store);assert.throws(()=>assertSingleStore({...store}),/owned/);assert.throws(()=>{store.readAuthorization=()=>({authorized:true});},TypeError);
 const originalName=db.name;db.name='mm-phase3-00000-nonexistent';assert.equal(store.readAuthorization('missing'),null);db.name=originalName;
 assert.throws(()=>store.assertLedgerAnchor(),/ancestry/);
 for(const role of ['anon','authenticated','shadow_runner'])assert.throws(()=>db.sql(`SET ROLE ${role};SELECT shadow_eval.a3_single_study('bad',${literal(declaration)})`));
 for(const change of [d=>delete d.fixture_id,d=>d.fixture_id=null,d=>d.issuance_date_utc='2026-11-01',d=>d.extra='bad',d=>d.model='other']){const d=structuredClone(declaration);change(d);assert.throws(()=>store.declare('bad',d));}
 store.declare('single',declaration);assert.throws(()=>store.declare('single',declaration));
 const packet=store.append('packet','single:packet','single',{source:'synthetic schema test only'}),job=store.append('job','single:job',packet,{fixture_id:'1',kickoff_at_utc:new Date(Date.now()+86400000).toISOString()});
 assert.equal(store.readAuthorization('missing'),null);assert.equal(store.readReadiness('missing'),null);assert.equal(store.reservedMicros(),0);
 const proof={version:'a3-reviewed-provider-bound-v1',request_hash:'b'.repeat(64),review_artifact_sha256:'c'.repeat(64),profile_hash:'d'.repeat(64),schema_hash:'e'.repeat(64),complete_input_upper_tokens:1000,schema_contract_reviewed:true,output_contract_reviewed:true};
 for(const field of ['request_hash','review_artifact_sha256','profile_hash','schema_hash','complete_input_upper_tokens']){const b={...proof,[field]:null};assert.throws(()=>store.recordOperator('readiness','bad',job,b));}
 assert.throws(()=>db.sql(`SET ROLE shadow_runner;SELECT shadow_eval.a3_operator_record('readiness','review',${literal(job)}::text,${literal(proof)})`));
 store.recordOperator('readiness','review',job,proof);assert.equal(store.readReadiness('review').body.complete_input_upper_tokens,1000);
 assert.throws(()=>db.sql("UPDATE shadow_eval.a3_operator_receipts SET body='{}'::jsonb"));assert.throws(()=>db.sql('DELETE FROM shadow_eval.a3_operator_receipts'));assert.throws(()=>db.sql('TRUNCATE shadow_eval.a3_operator_receipts'));
 for(const role of ['anon','authenticated'])assert.throws(()=>db.sql(`SET ROLE ${role};SELECT *FROM shadow_eval.a3_operator_receipts`));
 assert.equal(store.reservedMicros(),0);assert.equal(db.sql('SELECT count(*)FROM shadow_eval.weekend_events WHERE kind=\'reservation\''),'0');
 const today=new Date().toISOString().slice(0,10);
 if(/^2026-10-(?:2[7-9]|3[01])$/u.test(today)){
  // The genuine policy intentionally expires after Oct31. Outside that window
  // the deterministic CPU tests cover positive paths; this SQL path must block.
  const at=new Date().toISOString();store.declare('atomic',{...declaration,issuance_date_utc:today});
  const p=store.append('packet','atomic:packet','atomic',{collection:{earliest_receipt_at_utc:at}}),j=store.append('job','atomic:job',p,{fixture_id:'1',kickoff_at_utc:new Date(Date.now()+86400000).toISOString()});
  store.recordOperator('readiness','atomic:review',j,proof);
  const auth={version:'a3-single-final-v1',fixture_id:'1',issuance_date_utc:today,model:'openai/gpt-6-luna',provider:'OpenAI',request_hash:proof.request_hash,operator_message_sha256:'f'.repeat(64),expires_at_utc:new Date(Date.now()+300000).toISOString(),max_new_micros:1,byok:{recorded_at_utc:at}};
  store.recordOperator('authorization','atomic:auth',j,auth);
  const b={reserved_micros:1,request_hash:proof.request_hash,readiness_id:'atomic:review',gate_deadline_utc:new Date(Date.now()+240000).toISOString()};
  store.reserveSingle('atomic:auth','atomic:r1',j,b);assert.equal(store.reservedMicros(),1);assert.equal(store.hasSingleAttempt(j),true);
  assert.throws(()=>store.reserveSingle('atomic:auth','atomic:r2',j,b),/attempted/);assert.equal(store.reservedMicros(),1);
  assert.equal(store.read('atomic:r1:commit').body.status,'accepted');
  // A new hash and distinct new operator message cannot reset the study latch.
  store.recordOperator('readiness','atomic:review2',j,{...proof,request_hash:'1'.repeat(64)});
  store.recordOperator('authorization','atomic:auth2',j,{...auth,request_hash:'1'.repeat(64),operator_message_sha256:'2'.repeat(64)});
  assert.throws(()=>store.reserveSingle('atomic:auth2','atomic:r3',j,{...b,request_hash:'1'.repeat(64),readiness_id:'atomic:review2'}),/attempted/);assert.equal(store.reservedMicros(),1);
  store.declare('race',{...declaration,issuance_date_utc:today});const rp=store.append('packet','race:packet','race',{collection:{earliest_receipt_at_utc:new Date().toISOString()}}),rj=store.append('job','race:job',rp,{fixture_id:'1',kickoff_at_utc:new Date(Date.now()+86400000).toISOString()});
  store.recordOperator('readiness','race:review',rj,proof);store.recordOperator('authorization','race:auth',rj,{...auth,operator_message_sha256:'3'.repeat(64)});
  const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
  const races=await Promise.allSettled(['race:r1','race:r2'].map(rid=>new Promise((resolve,reject)=>{const child=execFile('docker',['--host=unix:///var/run/docker.sock','exec','-i',db.name,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','matchmind_test','-At'],{env,timeout:30000},(error,out)=>error?reject(error):resolve(out));child.stdin.end(`SET ROLE shadow_operator;SELECT shadow_eval.a3_single_reserve('race:auth','${rid}','race:job',${literal({...b,readiness_id:'race:review'})})`);})));assert.equal(races.filter(r=>r.status==='fulfilled').length,1);assert.equal(races.filter(r=>r.status==='rejected').length,1);assert.equal(store.reservedMicros(),2);
 }
 }finally{db.close();}
});
