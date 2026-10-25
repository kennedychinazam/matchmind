import test,{before,after}from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase,docker,IMAGE}from '../test-support/local-db.mjs';
import {repository}from '../phase6/repository.mjs';
import {weekendStore}from '../phase8/store.mjs';
import {refreshWriter}from '../phase8-continuation/local.mjs';
import {canonicalHash}from '../lib/snapshot-contract.mjs';

// The Saturday study completed at 14:49:05Z, before commit 4b77f62 added
// 'confirmation' at 15:12:35Z, so a cold restore of that checkpoint brings this
// narrower definition back with it and rejects the acknowledgement the current
// writer requires. Reproduce that exact table constraint, not a filtered view.
const LEGACY_KINDS="'study','packet','job','forecast','label','reservation','usage'";
const constrain=(db,kinds)=>db.sql(`BEGIN;SET LOCAL ROLE research_owner;DO $do$DECLARE c text;BEGIN FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='shadow_eval.weekend_events'::regclass AND contype='c' AND conkey::int2[]=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='shadow_eval.weekend_events'::regclass AND attname='kind')]::int2[] LOOP EXECUTE format('ALTER TABLE shadow_eval.weekend_events DROP CONSTRAINT %I',c);END LOOP;END$do$;ALTER TABLE shadow_eval.weekend_events ADD CONSTRAINT weekend_events_kind_check CHECK(kind IN(${kinds}));COMMIT;`);

const db=localDatabase('phase8-legacy-confirmation');let store,job;
before(async()=>{
 docker(['image','inspect',IMAGE]);await db.start();
 for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 repository(db).install();store=weekendStore(db);store.install();
 const study=store.append('study','weekend-2026-10-24',null,{version:'weekend-v1',windows:['2026-10-24','2026-10-25'],kind:'synthetic_verification'});
 const packet=store.append('packet','packet-1',study,{synthetic:true,rows:[{fxid:1}]});
 job=store.append('job','job-1',packet,{fixture_id:'1',kickoff_at_utc:new Date(Date.now()+3600000).toISOString(),original:null});
});
after(()=>db.close());

test('a restored legacy kind constraint refuses the reservation instead of stranding an unconfirmable hold',()=>{
 constrain(db,LEGACY_KINDS);
 assert.throws(()=>store.reserve('legacy-request',job,306000,canonicalHash({legacy:1})),/cannot confirm reservations/);
 assert.equal(store.read('legacy-request'),null);
 assert.equal(store.reservedMicros(),0);
});

test('restore maintenance widens the constraint and changes no stored event or retained liability',()=>{
 const before=store.events();
 refreshWriter(db);
 assert.deepEqual(store.events(),before);
 assert.equal(store.reservedMicros(),0);
});

test('the refreshed restore records the mandatory reservation commit confirmation',()=>{
 store.reserve('upgraded-request',job,306000,canonicalHash({upgraded:1}));
 assert.equal(store.read('upgraded-request:commit').body.status,'accepted');
 assert.equal(store.reservedMicros(),306000);
});
