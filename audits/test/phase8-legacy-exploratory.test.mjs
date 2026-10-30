import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {continuationStudy,evaluateContinuation} from '../phase8-continuation/protocol.mjs';
import {legacyAttestation,qualifyLegacyForecast,applyLegacyException,evaluateHistorical,LEGACY_CLASSIFICATION} from '../phase8-continuation/legacy-exploratory.mjs';
import {MODELS} from '../phase8-continuation/contracts.mjs';
import {canonicalHash} from '../lib/snapshot-contract.mjs';

// The exact constraint the real Saturday-era dump restores, with no 'confirmation'.
const LEGACY_CONSTRAINT="CHECK ((kind = ANY (ARRAY['study'::text, 'packet'::text, 'job'::text, 'forecast'::text, 'label'::text, 'reservation'::text, 'usage'::text])))";
const CURRENT_CONSTRAINT=LEGACY_CONSTRAINT.replace("'usage'::text","'usage'::text, 'confirmation'::text");
const IH='a'.repeat(64),STUDY='sunday:legacy',PACKET='sunday:legacy:packet';
const KICKOFF='2026-10-25T15:00:00Z',GEN='2026-10-25T00:28:15.303000Z',RECV='2026-10-25T00:28:16.000000Z';
const LABEL_AT='2026-10-25T17:10:00.000000Z',CUTOFF='2026-10-28T08:00:00Z';
const FIXTURES=['201','202','203','204','205'];
const bodyHash=b=>createHash('sha256').update(canonicalHash(b)).digest('hex');
const ev=(kind,event_id,parent_id,body,received_at)=>({event_id,kind,parent_id,body,received_at,event_body_hash:bodyHash(body)});
const baseline=(extra={})=>({arm:'E-Refreshed',status:'forecast',requires_confirmation:true,generated_at_utc:GEN,
 probabilities:[.5,.3,.2],input_hash:IH,engine_source_hash:'synthetic',model_version:'Build355-private-openrouter-v1',...extra});
const label=(fixture)=>fixture;

function journal(){
 const roster=FIXTURES.map(fixture_id=>({fixture_id,league:39,kickoff_at_utc:KICKOFF,original:null}));
 const events=[
  ev('study',STUDY,null,{version:'weekend-v1',windows:['2026-10-24','2026-10-25'],experiment:'openrouter-private-v1',roster,models:MODELS},'2026-10-25T00:27:02.370426Z'),
  ev('packet',PACKET,STUDY,{synthetic:true,rows:[]},'2026-10-25T00:27:30.000000Z')
 ];
 const job=(fixture,tag)=>{
  const id=STUDY+':'+fixture+':'+tag;
  events.push(ev('job',id,PACKET,{fixture_id:fixture,league:39,window:'2026-10-25',
   cohort:tag==='engine'?'sunday-engine':'sunday-ai',provider_model:tag==='engine'?null:MODELS[0],
   kickoff_at_utc:KICKOFF,original:null},'2026-10-25T00:27:5'+(fixture.slice(-1))+'.000000Z'));
  return id;
 };
 // One engine job per declared fixture, plus one model job to prove the
 // exception cannot spread to an AI cohort.
 const eligibility={'201':{eligible:true},'202':{eligible:false,exclusion_reason:'low'},
  '203':{eligible:false,exclusion_reason:'nobase'},'204':{eligible:true},'205':{eligible:true}};
 for(const f of FIXTURES){
  const j=job(f,'engine');
  events.push(ev('forecast',j+':E-Refreshed',j,baseline(eligibility[f]),RECV));
  events.push(ev('forecast',j+':E',j,{arm:'E',status:'abstain',reason:'original_context_only'},RECV));
 }
 const ai=job('201','openai');
 events.push(ev('forecast',ai+':E-Refreshed',ai,baseline({eligible:true}),RECV));
 events.push(ev('forecast',ai+':A3',ai,{arm:'A3',status:'forecast',requires_confirmation:true,generated_at_utc:GEN,
  probabilities:[.4,.35,.25],input_hash:IH,model_version:'OpenRouter-private-v1'},RECV));
 // Genuine settled outcomes. 201 is won in extra time but drawn at 90; 205 has
 // an extra-time score its regulation score cannot be derived from.
 const labels={'201':{status:'AET',gh:2,ga:1,ft_h:1,ft_a:1},'202':{status:'FT',gh:2,ga:0,ft_h:null,ft_a:null},
  '203':{status:'PST',gh:null,ga:null,ft_h:null,ft_a:null},'205':{status:'AET',gh:2,ga:1,ft_h:3,ft_a:0}};
 for(const [f,fixture] of Object.entries(labels))
  events.push(ev('label',STUDY+':'+f+':engine:label',STUDY+':'+f+':engine',
   {fixture_id:f,fixture:{fxid:Number(f),date:'2026-10-25',time:'15:00:00',provider:'af',...fixture},source:'read_only_receipt_now'},LABEL_AT));
 return events;
}

const metaOf=e=>({event_id:e.event_id,kind:e.kind,parent:e.parent_id??null,hash:e.event_body_hash,received:e.received_at});
const chainFor=events=>[{events:events.slice(0,6).map(metaOf),reserved_micros:0},{events:events.map(metaOf),reserved_micros:0}];
const attestFor=(events,extra={})=>legacyAttestation({checkpoints:chainFor(events),kindConstraintDef:LEGACY_CONSTRAINT,
 studyId:STUDY,engineInputHash:IH,corruptBodyHashes:0,restoredEventCount:events.length,...extra});
const strictStudy=events=>continuationStudy(events,new Map());

test('the strict report still refuses every unconfirmed forecast',()=>{
 const events=journal(),study=strictStudy(events),report=evaluateContinuation(study,CUTOFF);
 const engineBaselines=study.records.filter(r=>r.cohort==='sunday-engine').map(r=>r.forecasts.find(f=>f.arm==='E-Refreshed'));
 assert.equal(engineBaselines.length,5);
 assert.equal(engineBaselines.every(f=>f.status==='failed'&&f.reason==='commit_unconfirmed'),true);
 assert.equal(report.sunday.arms['E-Refreshed'].n,0);
 assert.equal(report.sunday.arms['E-Refreshed'].failed,5);
 assert.equal(report.view,undefined);
 assert.equal(report.accuracy_claim,false);
});

test('the historical view admits only the attested study original engine baselines',()=>{
 const events=journal(),attestation=attestFor(events);
 const report=evaluateHistorical(strictStudy(events),events,attestation,CUTOFF);
 const x=report.legacy_exception;
 assert.equal(report.view,'historical_exploratory');
 assert.equal(report.confirmed_issuance,false);
 assert.equal(x.classification,LEGACY_CLASSIFICATION);
 // Five engine baselines qualify, over five distinct fixtures. Event counts are
 // never read as fixture counts.
 assert.equal(x.included_events,5);
 assert.equal(x.included_fixtures,5);
 assert.deepEqual([...new Set(x.included.map(i=>i.arm))],['E-Refreshed']);
 // The model cohort's own baseline and its A3 are both refused.
 assert.equal(x.exclusions.cohort_not_sunday_engine,1);
 assert.equal(x.exclusions.arm_not_original_engine_baseline,1);
 assert.equal(x.excluded_events,2);
 // Reclassified records keep their contents, their receipt and their missing ack.
 const row=applyLegacyException(strictStudy(events),events,attestation).study.records.find(r=>r.job_id===STUDY+':202:engine');
 const f=row.forecasts.find(f=>f.arm==='E-Refreshed');
 assert.equal(f.status,'forecast');assert.equal(f.legacy_classification,LEGACY_CLASSIFICATION);
 assert.equal(f.acknowledged,false);assert.equal(f.commit_unconfirmed,true);
 assert.equal(f.strict_reason,'commit_unconfirmed');assert.equal(f.reason,undefined);
 assert.equal(f.generated_at_utc,GEN);assert.deepEqual(f.probabilities,[.5,.3,.2]);
 assert.equal(f.eligible,false);assert.equal(f.exclusion_reason,'low');
});

test('an AI forecast can never borrow the exception, and no AI arm acquires a score',()=>{
 const events=journal(),attestation=attestFor(events);
 const report=evaluateHistorical(strictStudy(events),events,attestation,CUTOFF);
 const a3=report.legacy_exception.excluded.find(e=>e.arm==='A3');
 assert.equal(a3.reason,'arm_not_original_engine_baseline');
 for(const model of MODELS)for(const arm of ['A1','A2','A3'])assert.equal(report.models[model].arms[arm].n,0);
 const aiJob=events.find(e=>e.kind==='job'&&e.body.cohort==='sunday-ai');
 const forecast=events.find(e=>e.event_id===aiJob.event_id+':A3');
 assert.deepEqual(qualifyLegacyForecast(attestation,{forecast,job:aiJob,acknowledged:false}),
  {qualified:false,reason:'arm_not_original_engine_baseline'});
});

test('a tampered or unverified checkpoint cannot qualify anything',()=>{
 const events=journal();
 // A head manifest whose hash no longer matches the stored event. The target
 // sits past the first generation, so the chain itself stays self-consistent
 // and the head is the only thing that disagrees.
 const chain=chainFor(events);
 const target=chain[1].events.find(e=>e.event_id===STUDY+':205:engine:E-Refreshed');
 assert.equal(chain[0].events.some(e=>e.event_id===target.event_id),false);
 const tampered=legacyAttestation({checkpoints:[chain[0],{...chain[1],events:chain[1].events.map(e=>e===target?{...e,hash:'f'.repeat(64)}:e)}],
  kindConstraintDef:LEGACY_CONSTRAINT,studyId:STUDY,engineInputHash:IH,corruptBodyHashes:0,restoredEventCount:events.length});
 const report=evaluateHistorical(strictStudy(events),events,tampered,CUTOFF);
 assert.equal(report.legacy_exception.exclusions.body_hash_mismatch_against_verified_head,1);
 assert.equal(report.legacy_exception.included_events,4);
 // A chain whose earlier generation disagrees with its successor is not a chain.
 const forked=[{events:chain[0].events.map(e=>({...e,hash:'e'.repeat(64)})),reserved_micros:0},chain[1]];
 assert.throws(()=>legacyAttestation({checkpoints:forked,kindConstraintDef:LEGACY_CONSTRAINT,studyId:STUDY,
  engineInputHash:IH,corruptBodyHashes:0,restoredEventCount:events.length}),/ancestry/);
 // Every other proof is mandatory, and absent proof throws rather than degrades.
 const base={checkpoints:chain,kindConstraintDef:LEGACY_CONSTRAINT,studyId:STUDY,engineInputHash:IH,corruptBodyHashes:0,restoredEventCount:events.length};
 assert.throws(()=>legacyAttestation({...base,corruptBodyHashes:1}),/body hash integrity/);
 assert.throws(()=>legacyAttestation({...base,restoredEventCount:events.length-1}),/event count differs/);
 assert.throws(()=>legacyAttestation({...base,kindConstraintDef:CURRENT_CONSTRAINT}),/admits confirmations/);
 assert.throws(()=>legacyAttestation({...base,studyId:'sunday:absent'}),/absent from the verified head/);
 assert.throws(()=>legacyAttestation({...base,engineInputHash:'short'}),/engine input hash/);
 assert.throws(()=>legacyAttestation({...base,checkpoints:[]}),/checkpoint chain required/);
 assert.throws(()=>legacyAttestation(),/checkpoint chain required/);
});

test('a newer study missing its confirmations cannot use the legacy exception',()=>{
 const NEW='sunday:newer',NEWPACKET=NEW+':packet',job=NEW+':901:engine';
 const events=[
  ev('study',NEW,null,{version:'weekend-v1',windows:['2026-10-24','2026-10-25'],experiment:'openrouter-private-v1',
   roster:[{fixture_id:'901',league:39,kickoff_at_utc:KICKOFF,original:null}],models:MODELS},'2026-10-25T09:00:00.000000Z'),
  ev('packet',NEWPACKET,NEW,{synthetic:true,rows:[]},'2026-10-25T09:00:10.000000Z'),
  ev('job',job,NEWPACKET,{fixture_id:'901',league:39,window:'2026-10-25',cohort:'sunday-engine',provider_model:null,kickoff_at_utc:KICKOFF,original:null},'2026-10-25T09:00:20.000000Z'),
  ev('forecast',job+':E-Refreshed',job,baseline({eligible:true}),'2026-10-25T09:00:30.000000Z')
 ];
 // The attestation names the legacy study; this journal's own head is attested
 // too, so study scope is the only thing that can refuse it.
 const attestation=legacyAttestation({checkpoints:[{events:events.map(metaOf),reserved_micros:0}],
  kindConstraintDef:LEGACY_CONSTRAINT,studyId:NEW,engineInputHash:IH,corruptBodyHashes:0,restoredEventCount:events.length});
 assert.equal(evaluateHistorical(strictStudy(events),events,attestation,CUTOFF).legacy_exception.included_events,1);
 const scoped=legacyAttestation({checkpoints:[{events:events.map(metaOf),reserved_micros:0}],
  kindConstraintDef:LEGACY_CONSTRAINT,studyId:NEW,engineInputHash:'b'.repeat(64),corruptBodyHashes:0,restoredEventCount:events.length});
 assert.equal(evaluateHistorical(strictStudy(events),events,scoped,CUTOFF).legacy_exception.exclusions.engine_input_hash_mismatch,1);
 const foreign={...attestation,study_id:'sunday:legacy'};
 const out=applyLegacyException(strictStudy(events),events,foreign);
 assert.equal(out.included.length,0);
 assert.equal(out.excluded[0].reason,'verified_study_lineage_mismatch');
});

test('the historical view changes no denominator and settles only on genuine results',()=>{
 const events=journal(),attestation=attestFor(events);
 const before=JSON.stringify(strictStudy(events));
 const strict=evaluateContinuation(strictStudy(events),CUTOFF);
 const study=strictStudy(events),report=evaluateHistorical(study,events,attestation,CUTOFF);
 // The strict study object and the journal are untouched by the exception.
 assert.equal(JSON.stringify(strictStudy(events)),before);
 assert.equal(study.records.length,15);
 assert.equal(report.sunday.coverage.roster,strict.sunday.coverage.roster);
 assert.equal(report.sunday.coverage.roster,5);
 for(const model of MODELS)assert.equal(report.models[model].coverage.roster,strict.models[model].coverage.roster);
 assert.equal(report.sunday.arms.E.abstained,strict.sunday.arms.E.abstained);

 // Regulation time decides 201: mean Brier 0.58 is its 0.78 against a draw with
 // 202's 0.38 against a home win. Settling 201 on the extra-time home win would
 // make both 0.38 and the mean 0.38.
 assert.equal(report.sunday.arms['E-Refreshed'].n,2);
 assert.equal(Math.round(report.sunday.arms['E-Refreshed'].brier*1e6)/1e6,0.58);
 // 203 postponed past 48 hours voids, 204 has no result, 205's extra-time score
 // cannot yield a regulation result.
 assert.equal(report.sunday.coverage.void,1);
 assert.equal(report.sunday.coverage.pending,1);
 assert.equal(report.sunday.coverage.ambiguous_90_minute,1);
 assert.equal(report.accuracy_claim,false);assert.equal(report.confirmatory_eligible,false);
 assert.equal(report.limitations.some(l=>l.includes(LEGACY_CLASSIFICATION)),true);
});

test('no performance is reported before genuine settled results exist',()=>{
 const events=journal(),attestation=attestFor(events);
 // A cutoff before any outcome receipt: the baselines are admitted, and nothing
 // is scored from them.
 const report=evaluateHistorical(strictStudy(events),events,attestation,'2026-10-25T10:00:00Z');
 assert.equal(report.legacy_exception.included_events,5);
 assert.equal(report.sunday.arms['E-Refreshed'].n,0);
 assert.equal(report.sunday.arms['E-Refreshed'].brier,null);
 assert.equal(report.sunday.coverage.pending,5);
 assert.equal(report.sunday.arms['E-Refreshed'].verified_forecasts,5);
 assert.equal(report.accuracy_claim,false);
 assert.equal(report.confirmed_issuance,false);
});
