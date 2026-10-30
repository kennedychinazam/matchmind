// A narrowly scoped historical exploratory view, additive only. It reads the
// journal and never writes it, creates no confirmation event, and leaves the
// strict report and the spending ledger exactly as they are.
//
// The exception exists for one documented reason: the Sunday cohort was written
// by code that sets requires_confirmation into a database restored from a
// Saturday-era dump whose kind constraint could not store a 'confirmation' row,
// so the acknowledgement was impossible rather than withheld. Checkpoint
// verification is NOT an accepted confirmation, and nothing here pretends it is.
import {epochMicros} from '../lib/snapshot-contract.mjs';
import {canonicalKickoff} from '../phase8/kickoff.mjs';
import {verifyAncestry} from './recovery.mjs';
import {evaluateContinuation} from './protocol.mjs';
export const LEGACY_CLASSIFICATION='legacy_checkpoint_verified_unconfirmed';
const HEX64=/^[0-9a-f]{64}$/;
const validProbabilities=p=>Array.isArray(p)&&p.length===3
 &&p.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1)
 &&Math.abs(p.reduce((s,x)=>s+x,0)-1)<=.005;

// Every field is required proof, not a hint. Missing or contradictory proof
// throws rather than degrading into a weaker check.
export function legacyAttestation({checkpoints,kindConstraintDef,studyId,engineInputHash,corruptBodyHashes,restoredEventCount}={}){
 if(!Array.isArray(checkpoints)||!checkpoints.length)throw Error('verified checkpoint chain required');
 const ancestry=verifyAncestry(checkpoints.map(c=>({events:c.events,liability_micros:c.reserved_micros})));
 if(typeof kindConstraintDef!=='string'||!/\bkind\b/.test(kindConstraintDef))throw Error('restored kind constraint required');
 if(kindConstraintDef.includes('confirmation'))throw Error('restored store admits confirmations; legacy exception does not apply');
 if(corruptBodyHashes!==0)throw Error('restored body hash integrity required');
 const head=checkpoints.at(-1).events;
 if(restoredEventCount!==head.length)throw Error('restored event count differs from the verified head');
 if(typeof studyId!=='string'||!studyId)throw Error('exact legacy study identity required');
 const manifest=new Map(head.map(e=>[e.event_id,e]));
 if(manifest.get(studyId)?.kind!=='study')throw Error('legacy study absent from the verified head');
 if(!HEX64.test(engineInputHash??''))throw Error('original engine input hash required');
 return Object.freeze({classification:LEGACY_CLASSIFICATION,study_id:studyId,engine_input_hash:engineInputHash,
  checkpoints:ancestry.checkpoints,verified_event_count:ancestry.event_count,retained_liability_micros:ancestry.liability_micros,
  restored_kind_constraint:kindConstraintDef,manifest});
}

export function qualifyLegacyForecast(attestation,{forecast,job,acknowledged}){
 const no=reason=>({qualified:false,reason});
 const body=forecast?.body;
 if(!body||!job)return no('original_event_absent');
 // Scope: the original engine baseline of the attested Sunday study only.
 if(body.arm!=='E-Refreshed')return no('arm_not_original_engine_baseline');
 if(job.body?.cohort!=='sunday-engine')return no('cohort_not_sunday_engine');
 if(body.status!=='forecast')return no('status_not_forecast');
 if(body.requires_confirmation!==true)return no('confirmation_not_required');
 if(acknowledged)return no('acknowledgement_present');
 // Ancestry and immutability, against the verified head manifest.
 const fm=attestation.manifest.get(forecast.event_id);
 if(!fm||fm.kind!=='forecast')return no('event_absent_from_verified_head');
 if(fm.hash!==forecast.event_body_hash)return no('body_hash_mismatch_against_verified_head');
 const jm=attestation.manifest.get(fm.parent),pm=jm&&attestation.manifest.get(jm.parent);
 if(fm.parent!==job.event_id||jm?.kind!=='job'||pm?.kind!=='packet'||pm.parent!==attestation.study_id)return no('verified_study_lineage_mismatch');
 // Receipt before its own kickoff, and generation before its own receipt.
 let kickoff,receipt,generated;
 try{kickoff=epochMicros(canonicalKickoff(job.body.kickoff_at_utc));receipt=epochMicros(forecast.received_at);generated=epochMicros(body.generated_at_utc);}
 catch{return no('unparseable_receipt_or_kickoff');}
 if(!(receipt<kickoff))return no('receipt_not_before_kickoff');
 if(!(generated<=receipt))return no('generated_after_receipt');
 // Genuine original engine input lineage and a usable probability vector.
 if(!HEX64.test(body.input_hash??''))return no('engine_input_lineage_absent');
 if(body.input_hash!==attestation.engine_input_hash)return no('engine_input_hash_mismatch');
 if(typeof body.engine_source_hash!=='string'||!body.engine_source_hash)return no('engine_source_hash_absent');
 if(!validProbabilities(body.probabilities))return no('invalid_probabilities');
 return{qualified:true,classification:LEGACY_CLASSIFICATION};
}

// Returns a new study view; the input study and every event are left untouched.
export function applyLegacyException(study,events,attestation){
 const jobs=new Map(events.filter(e=>e.kind==='job').map(e=>[e.event_id,e]));
 const acknowledged=new Set(events.filter(e=>e.kind==='confirmation'&&e.body?.status==='accepted').map(e=>e.parent_id));
 const originals=new Map(events.filter(e=>e.kind==='forecast').map(e=>[e.parent_id+'|'+e.body?.arm,e]));
 const included=[],excluded=[];
 const records=study.records.map(row=>({...row,forecasts:row.forecasts.map(f=>{
  if(f.status!=='failed'||f.reason!=='commit_unconfirmed')return f;
  const forecast=originals.get(row.job_id+'|'+f.arm),job=jobs.get(row.job_id);
  const verdict=qualifyLegacyForecast(attestation,{forecast,job,acknowledged:forecast?acknowledged.has(forecast.event_id):false});
  const where={fixture_id:row.fixture_id,job_id:row.job_id,arm:f.arm};
  if(!verdict.qualified){excluded.push({...where,reason:verdict.reason});return f;}
  included.push({...where,event_id:forecast.event_id,generated_at_utc:forecast.body.generated_at_utc});
  // The original contents and receipt stand, and the missing acknowledgement
  // stays visible on the record rather than being erased by the reclassification.
  const {reason,...rest}=f;
  return{...rest,status:forecast.body.status,legacy_classification:LEGACY_CLASSIFICATION,
   acknowledged:false,commit_unconfirmed:true,strict_status:'failed',strict_reason:'commit_unconfirmed'};
 })}));
 return{study:{...study,records},included,excluded};
}

export function evaluateHistorical(study,events,attestation,cutoff){
 const view=applyLegacyException(study,events,attestation);
 const report=evaluateContinuation(view.study,cutoff);
 const exclusions={};for(const x of view.excluded)exclusions[x.reason]=(exclusions[x.reason]??0)+1;
 return{...report,view:'historical_exploratory',confirmed_issuance:false,accuracy_claim:false,confirmatory_eligible:false,
  legacy_exception:{classification:LEGACY_CLASSIFICATION,study_id:attestation.study_id,
   verified_checkpoints:attestation.checkpoints,verified_event_count:attestation.verified_event_count,
   retained_liability_micros:attestation.retained_liability_micros,
   restored_kind_constraint:attestation.restored_kind_constraint,
   included_events:view.included.length,included_fixtures:new Set(view.included.map(x=>x.fixture_id)).size,
   excluded_events:view.excluded.length,exclusions,included:view.included,excluded:view.excluded},
  limitations:[...report.limitations,
   'Reclassified records are '+LEGACY_CLASSIFICATION+': checkpoint-verified historical engine output with no acknowledgement event. That is not confirmed issuance.',
   'The exception covers the attested study’s original E-Refreshed baseline only. AI arms, paid requests, later studies and any other unconfirmed record keep the strict rules.',
   'Event counts are not fixture counts: one fixture carries a baseline on each of its cohort jobs.',
   'Descriptive retrospective scoring only. No publication, no confirmed issuance and no confirmatory superiority is claimed.']};
}
