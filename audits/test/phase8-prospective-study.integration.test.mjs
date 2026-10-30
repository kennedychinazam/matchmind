import test,{before,after}from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase,docker,IMAGE}from '../test-support/local-db.mjs';
import {repository}from '../phase6/repository.mjs';
import {weekendStore}from '../phase8/store.mjs';
import {runSunday}from '../phase8-continuation/supervised.mjs';
import {STUDIES,PROSPECTIVE,resultsView,resultsReport}from '../phase8-continuation/protocol.mjs';
import {MODELS}from '../phase8-continuation/contracts.mjs';
import {canonicalHash}from '../lib/snapshot-contract.mjs';

const MINUTE=60000;
// Whole-minute anchors: fixture times are minute precision, so an anchor with
// seconds can round back across its own issue time.
const AHEAD=new Date((Math.floor(Date.now()/MINUTE)+3)*MINUTE).toISOString();
const at=iso=>({date:iso.slice(0,10),time:iso.slice(11,19)});
const row=(fxid,lid)=>({fxid,lid,home:'H'+fxid,away:'A'+fxid,status:'NS',...at(AHEAD)});
// The prospective study shares one fixture with the original on purpose: the two
// studies must not collide over it.
const SUNDAY=()=>({synthetic:true,source_read_at_utc:new Date().toISOString(),targets:[701,702],originals:[],odds:[],rows:[row(701,39),row(702,39)]});
const LATER=()=>({synthetic:true,source_read_at_utc:new Date().toISOString(),targets:[702,703],originals:[],odds:[],rows:[row(702,39),row(703,40)]});
const engineFor=store=>async packet=>{
 const generated_at_utc=store.clock();
 return{synthetic_clock:true,source_sha256:'synthetic',input_hash:canonicalHash(packet),
  predictions:packet.targets.map(id=>({fixture_id:String(id),status:'forecast',generated_at_utc,probabilities:[.5,.3,.2],
   prediction:{pW:.5,pD:.3,pL:.2},decision:{pick:'1'},eligible:true,exclusion_reason:null}))};
};
const options=(store,source,extra={})=>({store,source,engine:engineFor(store),kind:'synthetic_verification',synthetic:true,
 supervised:true,recoveryVerified:true,externalCopyVerified:true,paid:false,checkpoint:async()=>{},...extra});

const db=localDatabase('phase8-prospective');
let store,sunday,later,heldJob;
const HOLD=306000;
before(async()=>{
 docker(['image','inspect',IMAGE]);await db.start();
 for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 repository(db).install();store=weekendStore(db);store.install();
 sunday=await runSunday(options(store,SUNDAY()));
 // A retained worst-case hold from an earlier failed attempt, exactly as the
 // recovered journal carries one. It is never released or recreated here.
 heldJob=store.events().find(e=>e.kind==='job'&&e.body.cohort===STUDIES[0].engine).event_id;
 store.reserve('retained-hold',heldJob,HOLD,'a'.repeat(64));
 later=await runSunday(options(store,LATER(),{cohorts:PROSPECTIVE}));
});
after(()=>db.close());

test('a later prospective study enrolls alongside the original without touching it',()=>{
 assert.equal(sunday.fixtures,2);assert.equal(later.fixtures,2);
 const events=store.events(),studies=events.filter(e=>e.kind==='study');
 assert.equal(studies.length,2);
 assert.deepEqual(studies.map(s=>s.body.experiment).sort(),[STUDIES[0].experiment,PROSPECTIVE.experiment].sort());
 assert.equal(studies.filter(s=>s.event_id.startsWith('sunday:')).length,1);
 assert.equal(studies.filter(s=>s.event_id.startsWith('prospective:')).length,1);
 // Each study's jobs carry only its own cohort names.
 const cohorts={};for(const j of events.filter(e=>e.kind==='job'))cohorts[j.body.cohort]=(cohorts[j.body.cohort]??0)+1;
 assert.deepEqual(cohorts,{[STUDIES[0].engine]:2,[STUDIES[0].ai]:4,[PROSPECTIVE.engine]:2,[PROSPECTIVE.ai]:4});
 // The original study's own events are untouched by the later enrollment.
 const original=store.read(heldJob);
 assert.equal(original.body.cohort,STUDIES[0].engine);
 assert.equal(store.read(heldJob+':E-Refreshed').body.status,'forecast');
});

test('both studies share the one global ledger and the retained hold is preserved',()=>{
 // Enrolling the later study added no reservation and released none.
 assert.equal(store.reservedMicros(),HOLD);
 const reservations=store.events().filter(e=>e.kind==='reservation');
 assert.equal(reservations.length,1);
 assert.equal(reservations[0].event_id,'retained-hold');
 assert.equal(reservations[0].body.reserved_micros,HOLD);
 assert.equal(store.read('retained-hold:commit').body.status,'accepted');
 assert.equal(store.events().filter(e=>e.kind==='usage').length,0);
 // One ledger, reported once for the whole journal, not once per study.
 const report=resultsReport(resultsView(store),store.clock());
 assert.equal(report.reserved_liability_usd,HOLD/1000000);
});

test('the reporter keeps the original Sunday research separate from the prospective study',()=>{
 const report=resultsReport(resultsView(store),store.clock());
 assert.equal(report.prospective_experiment,PROSPECTIVE.experiment);
 assert.equal(report.sunday.coverage.roster,2);
 assert.equal(report.prospective.coverage.roster,2);
 for(const m of MODELS){
  assert.equal(report.models[m].coverage.roster,2);
  assert.equal(report.prospective_models[m].coverage.roster,2);
 }
 // The shared fixture appears once in each study and is never double counted.
 const view=resultsView(store).study;
 assert.deepEqual(view.records.filter(r=>r.cohort===STUDIES[0].engine).map(r=>r.fixture_id).sort(),['701','702']);
 assert.deepEqual(view.records.filter(r=>r.cohort===PROSPECTIVE.engine).map(r=>r.fixture_id).sort(),['702','703']);
 // No paid run happened, so every AI arm in both studies is a disabled failure.
 for(const section of [report.models,report.prospective_models])for(const m of MODELS)for(const arm of ['A1','A2','A3']){
  assert.equal(section[m].arms[arm].n,0);
  assert.equal(section[m].arms[arm].failed,2);
 }
 assert.equal(report.accuracy_claim,false);
});

test('neither study can be enrolled twice and the retained hold cannot be retried',async()=>{
 await assert.rejects(()=>runSunday(options(store,LATER(),{cohorts:PROSPECTIVE})),/already enrolled/);
 await assert.rejects(()=>runSunday(options(store,SUNDAY())),/already enrolled/);
 // The same reservation id with the same terms is idempotent, never a new hold.
 assert.equal(store.reserve('retained-hold',heldJob,HOLD,'a'.repeat(64)),'retained-hold');
 assert.equal(store.reservedMicros(),HOLD);
 // Changed terms under the same id are a conflict, not a second attempt.
 assert.throws(()=>store.reserve('retained-hold',heldJob,HOLD+1,'a'.repeat(64)),/conflict/);
 assert.throws(()=>store.reserve('retained-hold',heldJob,HOLD,'b'.repeat(64)),/conflict/);
 // A dispatch marker still cannot exist without an accepted confirmation, and
 // the ledger is unchanged by every refusal above.
 assert.equal(store.reservedMicros(),HOLD);
 assert.equal(store.events().filter(e=>e.kind==='reservation').length,1);
});

test('the ledger ceiling counts the retained hold against the later study',()=>{
 // A single balanced bundle is 2 OpenAI plus 2 Kimi worst cases. With the hold
 // already standing, the ceiling must admit it from the remaining headroom.
 const CEILING=5000000,BUNDLE=2*306000+2*821820;
 assert.equal(BUNDLE,2255640);
 assert.equal(store.reservedMicros()+BUNDLE<=CEILING,true);
 assert.equal(store.reservedMicros()+2*BUNDLE<=CEILING,true);
 assert.equal(store.reservedMicros()+3*BUNDLE<=CEILING,false);
 // The database refuses a reservation that would cross the ceiling, counting the
 // retained hold, without releasing anything.
 const job=store.events().find(e=>e.kind==='job'&&e.body.cohort===PROSPECTIVE.ai).event_id;
 assert.throws(()=>store.reserve('over-ceiling',job,CEILING-HOLD+1,'c'.repeat(64)),/budget/);
 assert.equal(store.reservedMicros(),HOLD);
});
