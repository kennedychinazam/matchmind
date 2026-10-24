import test,{before,after}from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from 'node:fs';
import {localDatabase,docker,IMAGE}from '../test-support/local-db.mjs';
import {repository}from '../phase6/repository.mjs';
import {testPolicy,testPrivateKey,fixturePayload}from '../test-support/phase7.mjs';
import {sealDataset,sourceVersions}from '../phase7/attestation.mjs';
import {fitCoefficient}from '../phase7/train.mjs';
import {prepareSamples}from '../phase7/samples.mjs';
const api=await import('../phase7/local.mjs').catch(()=>({}));
const db=localDatabase('phase7-local');let local,packet,prepared,artifact;
before(async()=>{docker(['image','inspect',IMAGE]);await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);repository(db).install();});
after(()=>db.close());
test('synthetic-only local training store has immutable private roles and shared original quota',()=>{
 assert.equal(typeof api.trainingRepository,'function');local=api.trainingRepository(db);local.install();
 assert.equal(db.sql('select max_bytes from research.control'),'262144000');
 for(const role of ['anon','authenticated','shadow_runner','research_collector'])assert.throws(()=>db.sql(`set role ${role};select * from shadow_eval.training_datasets`),/permission/);
 packet=sealDataset(fixturePayload(sourceVersions()),testPrivateKey,testPolicy.key_id);prepared=prepareSamples(packet,testPolicy,'2026-10-03T00:00:00Z');
 artifact=fitCoefficient(packet,testPolicy,{version:'local-test-v1',train_start_utc:'2026-10-01T00:00:00Z',fit_cutoff_utc:'2026-10-03T00:00:00Z',minimum_examples:20});
 // Unit-clock fixtures are not server snapshots: materialization must reject them.
 assert.throws(()=>local.saveDataset(packet,prepared,testPolicy),/snapshot|source|local/);
 assert.equal(db.sql('select count(*)from shadow_eval.training_datasets'),'0');
});
test('public roles cannot call training writers and quota failure does not alter originals',()=>{
 for(const role of ['anon','authenticated','shadow_runner'])assert.throws(()=>db.sql(`set role ${role};select shadow_eval.register_training_dataset('{}'::jsonb,'[]'::jsonb)`),/permission/);
 assert.equal(db.sql("select count(*)from pg_proc where pronamespace='shadow_eval'::regnamespace and has_function_privilege('anon',oid,'EXECUTE')"),'0');
 assert.equal(db.sql('select count(*)from public.predictions'),'0');
 const dump=db.dump();db.restore(dump);assert.equal(db.sql('select count(*)from shadow_eval.training_datasets','matchmind_restore'),'0');
});
test('full actual-server-clock receipt proof runs end to end without a real model or hosted access',async()=>{
 assert.equal(typeof api.syntheticClockProof,'function');
 let frozen;
 const outcome=await api.syntheticClockProof(db,{training:24,validation:12,clockHorizonSeconds:3,privateSink:data=>{frozen=data;}});
 assert.equal(outcome.accuracy_claim,false);assert.equal(outcome.real_football_examples,0);
 assert.equal(outcome.training.status,'fitted');assert.equal(outcome.validation.coverage.roster,12);
 assert.equal(outcome.validation.coverage.scored,12);assert.equal(outcome.validation.coverage.feature_eligible,12);
 assert.ok(outcome.chronology.training_export_before_fit&&outcome.chronology.registration_before_validation_issue);
 assert.equal(db.sql('select count(*)from shadow_eval.training_datasets'),'2');
 assert.throws(()=>db.sql('delete from shadow_eval.training_examples'),/immutable/);
 assert.equal(db.sql('select count(*)from public.predictions'),'36');
 const alternate=fitCoefficient(frozen.training,frozen.policy,{...frozen.artifact.configuration,version:'quota-test-v2'});
 const originals=db.sql('select string_agg(payload_hash,\',\'order by snapshot_id)from research.prediction_snapshots');
 db.sql('update research.control set max_bytes=1');
 assert.throws(()=>local.freezeArtifact(alternate,frozen.protocol,frozen.privateKey,frozen.policy.key_id),/storage limit/);
 db.sql('update research.control set max_bytes=262144000');
 assert.equal(db.sql('select string_agg(payload_hash,\',\'order by snapshot_id)from research.prediction_snapshots'),originals);
 db.sql(readFileSync(new URL('../phase7/rollback.sql',import.meta.url),'utf8'));
 assert.throws(()=>local.freezeArtifact(alternate,frozen.protocol,frozen.privateKey,frozen.policy.key_id),/permission/);
});
