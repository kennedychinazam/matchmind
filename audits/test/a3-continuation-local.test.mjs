import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {localDatabase,literal} from '../test-support/local-db.mjs';import {repository} from '../phase6/repository.mjs';import {weekendStore} from '../phase8/store.mjs';import {singleStore} from '../a3-supervised/local.mjs';import {continuationScenario} from '../test-support/a3-continuation.mjs';import {canonicalHash,canonicalJSON} from '../lib/snapshot-contract.mjs';
for(const mode of ['verified_bound','capacity_risk'])test('additive '+mode+' SQL preserves old functions, immutable halt/holds and atomic one-attempt budget',async t=>{
 const db=localDatabase('a3-continuation-offline');await db.start();try{
 for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 repository(db).install();weekendStore(db).install();const store=singleStore(db);store.installSingle();store.installCapacityException();
 const oldDefs=db.sql("SELECT jsonb_object_agg(oid::text,pg_get_functiondef(oid))FROM pg_proc WHERE pronamespace='shadow_eval'::regnamespace"),old=JSON.parse(oldDefs);
 assert.equal(typeof store.installContinuation,'function');store.installContinuation();
 for(const [oid,def]of Object.entries(old))assert.equal(JSON.parse(db.sql('SELECT to_json(pg_get_functiondef('+oid+'::oid))')),def);
 assert.equal(store.readContinuation('none','continuation'),null);
 const s=continuationScenario(mode),today=new Date().toISOString().slice(0,10),at=new Date().toISOString();
 const declaration={version:'a3-supervised-single-v1',fixture_id:'1550169',issuance_date_utc:['2026-10-28','2026-10-29'].includes(today)?today:'2026-10-28',model:'openai/gpt-6-luna',provider:'OpenAI',one_request:true,source_hash:s.plan.packet.source.source_hash};
 store.declare('old-study',{...declaration,fixture_id:'1492438'});const op=store.append('packet','old-packet','old-study',{}),oj=store.append('job','old-job',op,{fixture_id:'1492438',kickoff_at_utc:new Date(Date.now()+172800000).toISOString()});
 for(let i=0;i<6;i++)store.append('reservation','old-hold-'+i,oj,{reserved_micros:i===0?1529008:306000,request_hash:'9'.repeat(64)});
 store.append('usage','old-halt','old-hold-5',{halt:true,status:'failed_or_ambiguous'});
 db.sql("SET ROLE research_owner;INSERT INTO shadow_eval.a3_single_attempts VALUES('old-study','old-job','old-hold-5',repeat('9',64),clock_timestamp());INSERT INTO shadow_eval.a3_capacity_exceptions VALUES('old-exception','old-study','old-job','{}',encode(public.digest('{}','sha256'),'hex'),clock_timestamp());INSERT INTO shadow_eval.a3_capacity_attempts VALUES('santos-palmeiras-1492438-20261028-a3-capacity-risk-v1','old-exception','old-study','old-hold-5',clock_timestamp())");
 const preserved=db.sql("SELECT jsonb_agg(jsonb_build_array(event_id,kind,parent_id,event_body_hash,received_at)ORDER BY event_id)FROM shadow_eval.weekend_events");
 store.declare('new-study',declaration);const source=s.map.get('new-packet').body;source.source_read_at_utc=at;source.collection.earliest_receipt_at_utc=at;const p=store.append('packet','new-packet','new-study',source),j=store.append('job','new-job',p,{fixture_id:'1550169',kickoff_at_utc:'2026-10-29T19:45:00Z'}),receipt=store.receipt(p);
 const b={...s.approval.body,issuance_date_utc:declaration.issuance_date_utc,expires_at_utc:new Date(Math.min(Date.now()+590000,Date.parse('2026-10-29T19:37:30Z'))).toISOString(),halt_anchors:[{event_id:'old-halt',event_body_hash:store.read('old-halt').event_body_hash}]};
 const review={...s.review.body,issuance_date_utc:declaration.issuance_date_utc,source_received_at_utc:receipt};
 for(const role of ['anon','authenticated','shadow_runner'])assert.throws(()=>db.sql(`SET ROLE ${role};SELECT shadow_eval.a3_continuation_record('source_review','bad','${j}',${literal(review)})`));
 if(!['2026-10-28','2026-10-29'].includes(today)||Date.now()+360000>=Date.parse('2026-10-29T19:37:30Z')){assert.throws(()=>store.recordContinuation('source_review','expired',j,review));assert.equal(store.reservedMicros(),3059008);t.skip('Scoped fixture window expired (continuation.sql hard wall 2026-10-29T19:37:30Z): negative admission, additive-install and role refusals verified; positive recording, reservation, race and budget paths not executed. See audits/a3-supervised/EXPIRED-WINDOW-COVERAGE.md for why no safe restoration exists');return;}
 for(const mutate of [r=>r.settlement_basis='unknown',r=>r.source_received_at_utc=new Date(Date.now()+60000).toISOString(),r=>r.extra=true,r=>r.fixture_id='1492438']){const r=structuredClone(review);mutate(r);assert.throws(()=>store.recordContinuation('source_review','bad',j,r));}
 store.recordContinuation('source_review','source-review',j,review);b.source_review_body_hash=store.readContinuation('source-review','source_review').body_hash;
 for(const mutate of [r=>r.halt_anchors=[],r=>r.halt_anchors[0].event_body_hash='0'.repeat(64),r=>r.max_new_micros=1,r=>r.study_id='old-study',r=>r.expires_at_utc=at,r=>r.allow_halt=true]){const r=structuredClone(b);mutate(r);assert.throws(()=>store.recordContinuation('continuation','bad',j,r));}
 store.recordContinuation('continuation','new-approval',j,b);const approved=store.readContinuation('new-approval','continuation');assert.throws(()=>store.recordContinuation('continuation','duplicate',j,b));
 for(const op of ['UPDATE shadow_eval.a3_continuation_receipts SET body=\'{}\'','DELETE FROM shadow_eval.a3_continuation_receipts','TRUNCATE shadow_eval.a3_continuation_receipts'])assert.throws(()=>db.sql(op));
 for(const role of ['anon','authenticated'])assert.throws(()=>db.sql(`SET ROLE ${role};SELECT *FROM shadow_eval.a3_continuation_receipts`));
 let risk;
 if(mode==='capacity_risk'){
  const rb={...s.risk.body,issuance_date_utc:declaration.issuance_date_utc,expires_at_utc:b.expires_at_utc,continuation_body_hash:approved.body_hash,director_approval_sha256:b.director_approval_sha256};
  for(const mutate of [r=>r.complete_input_upper_tokens=100,r=>r.capacity_status='verified',r=>r.provider_input_cap_tokens=1000000,r=>r.continuation_body_hash='0'.repeat(64)]){const r=structuredClone(rb);mutate(r);assert.throws(()=>store.recordContinuation('capacity_risk','bad-risk',j,r));}
  store.recordContinuation('capacity_risk','new-risk',j,rb);risk=store.readContinuation('new-risk','capacity_risk');
 }else store.recordOperator('readiness','normal-ready',j,s.readiness.body);
 const auth={...s.authorization.body,issuance_date_utc:declaration.issuance_date_utc,expires_at_utc:b.expires_at_utc,continuation_body_hash:approved.body_hash,...(risk?{scoped_capacity_body_hash:risk.body_hash}:{}),byok:{recorded_at_utc:at}};store.recordOperator('authorization','paid-auth',j,auth);
 const reservation={reserved_micros:306000,request_hash:b.request_hash,request_body_hash:b.request_body_hash,canonical_request_body:canonicalJSON(s.plan.body),packet_hash:b.packet_hash,profile:s.plan.profile,request:{body:s.plan.body},...(risk?{scoped_capacity_id:'new-risk',scoped_capacity_body_hash:risk.body_hash,capacity_status:'unverified',complete_input_upper_tokens:null}:{readiness_id:'normal-ready'}),continuation_id:'new-approval',continuation_body_hash:approved.body_hash,source_review_id:'source-review',source_review_body_hash:b.source_review_body_hash,gate_deadline_utc:new Date(Date.now()+115000).toISOString()};
 for(const mutate of [r=>r.reserved_micros=1,r=>r.continuation_id='missing',r=>r.continuation_body_hash='0'.repeat(64),r=>r.canonical_request_body='{}',r=>r.request.body.max_tokens=1,r=>r.gate_deadline_utc=at,r=>r.readiness_id='missing']){const r=structuredClone(reservation);mutate(r);assert.throws(()=>store.reserveContinuation('paid-auth','bad',j,r));assert.equal(store.reservedMicros(),3059008);}
 const short={...b,director_approval_sha256:'7'.repeat(64),expires_at_utc:new Date(Date.now()+60000).toISOString()};
 store.recordContinuation('continuation','short-approval',j,short);const sh=store.readContinuation('short-approval','continuation');
 store.recordOperator('authorization','short-auth',j,{...auth,continuation_id:'short-approval',continuation_body_hash:sh.body_hash,operator_message_sha256:'6'.repeat(64)});
 if(mode==='verified_bound')assert.throws(()=>store.reserveContinuation('short-auth','too-late',j,{...reservation,continuation_id:'short-approval',continuation_body_hash:sh.body_hash}),/pre HTTP window/);
 assert.equal(store.reservedMicros(),3059008);
 assert.throws(()=>store.reserveContinuation('paid-auth','wrong-study','old-job',reservation));
 // An additional hold in this synthetic transaction must force the common $5
 // writer to reject atomically. Failure rolls back this whole temporary branch.
 assert.throws(()=>db.sql(`BEGIN;SET ROLE shadow_operator;SELECT shadow_eval.weekend_append('reservation','budget-extra','old-job',${literal({reserved_micros:1800000,request_hash:'8'.repeat(64),requires_confirmation:true})});SELECT shadow_eval.a3_continuation_reserve('paid-auth','over-budget','${j}',${literal(reservation)});COMMIT;`),/budget exhausted/);
 assert.equal(store.read('budget-extra'),null);assert.equal(store.reservedMicros(),3059008);
 assert.throws(()=>db.sql(`BEGIN;SET ROLE shadow_operator;SELECT shadow_eval.weekend_append('usage','unreviewed-halt','old-hold-4','{"halt":true}'::jsonb);SELECT shadow_eval.a3_continuation_reserve('paid-auth','unreviewed','${j}',${literal(reservation)});COMMIT;`),/halt/);assert.equal(store.read('unreviewed-halt'),null);
 const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
 const races=await Promise.allSettled(['new-hold','race-hold'].map(rid=>new Promise((resolve,reject)=>{const child=execFile('docker',['--host=unix:///var/run/docker.sock','exec','-i',db.name,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','matchmind_test','-At'],{env,timeout:30000},(error,out)=>error?reject(error):resolve(out.trim().split('\n').at(-1)));child.stdin.end(`SET ROLE shadow_operator;SELECT shadow_eval.a3_continuation_reserve('paid-auth','${rid}','${j}',${literal(reservation)})`);})));
 assert.equal(races.filter(r=>r.status==='fulfilled').length,1);assert.equal(races.filter(r=>r.status==='rejected').length,1);const winner=races.find(r=>r.status==='fulfilled').value;
 assert.equal(store.reservedMicros(),3365008);assert.equal(store.hasSingleAttempt(j),true);assert.equal(store.hasCapacityAttempt(),true);assert.equal(store.read(winner+':commit').body.status,'accepted');
 assert.throws(()=>store.reserveContinuation('paid-auth','retry',j,reservation));assert.equal(store.reservedMicros(),3365008);
 assert.equal(db.sql("SELECT jsonb_agg(jsonb_build_array(event_id,kind,parent_id,event_body_hash,received_at)ORDER BY event_id)FROM shadow_eval.weekend_events WHERE event_id LIKE 'old-%'"),preserved);
 assert.equal(db.sql('SELECT count(*)FROM shadow_eval.a3_capacity_attempts'),'1');assert.equal(db.sql('SELECT count(*)FROM shadow_eval.a3_continuation_attempts'),'1');
 for(const op of ['UPDATE shadow_eval.a3_continuation_attempts SET request_hash=repeat(\'0\',64)','DELETE FROM shadow_eval.a3_continuation_attempts','TRUNCATE shadow_eval.a3_continuation_attempts'])assert.throws(()=>db.sql(op));
 for(const [oid,def]of Object.entries(old))assert.equal(JSON.parse(db.sql('SELECT to_json(pg_get_functiondef('+oid+'::oid))')),def);
 }finally{db.close();}
});
