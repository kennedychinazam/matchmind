import {canonicalHash,epochMicros,snapshotFromCapture,validatePredictionSnapshot}from '../lib/snapshot-contract.mjs';
import {probabilityScore}from '../lib/bookmaker-metrics.mjs';
import {paired,calibration}from '../phase5/validation.mjs';
import {eligibleMarket}from '../phase6/report.mjs';
import {verifyDataset,verifyFreeze}from './attestation.mjs';
import {prepareSamples,completeEvidence}from './samples.mjs';
import {verifyArtifact,candidateProbabilities}from './train.mjs';
const average=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
function metrics(rs,predict){const scores=rs.map(r=>probabilityScore(predict(r),r.actual));return{n:rs.length,brier:average(scores.map(x=>x.brier)),log_loss:average(scores.map(x=>x.logLoss)),
 top1_accuracy:average(rs.map(r=>Number(['1','X','2'][predict(r).indexOf(Math.max(...predict(r)))]===r.actual))),calibration:calibration(rs,predict)};}
export function validateCoefficient(artifact,freezePacket,packet,policy,configuration){
 verifyArtifact(artifact);const freeze=verifyFreeze(freezePacket,policy).payload,verified=verifyDataset(packet,policy);
 if(freeze.artifact_hash!==artifact.artifact_hash||freeze.training_dataset_hash!==artifact.training_dataset_hash||freeze.protocol_hash!==canonicalHash(configuration))throw Error('freeze artifact/protocol mismatch');
 if(!configuration||Object.keys(configuration).sort().join(',')!=='end_utc,label_cutoff_utc,start_utc')throw Error('invalid validation protocol');
 const start=epochMicros(configuration.start_utc),end=epochMicros(configuration.end_utc),cutoff=epochMicros(configuration.label_cutoff_utc),frozenAt=epochMicros(freeze.registered_at_utc);
 if(start>=end||end>cutoff||frozenAt<epochMicros(artifact.configuration.fit_cutoff_utc)||frozenAt>=start)throw Error('freeze/validation period chronology');
 if(epochMicros(verified.payload.exported_at_utc)<cutoff)throw Error('validation export precedes fixed label cutoff');
 const trainingIds=new Set(artifact.training.roster_fixture_ids);
 for(const row of verified.payload.examples){if(trainingIds.has(String(row.fixture_id)))throw Error('training/validation fixture overlap');
  if(row.snapshot){const s=row.snapshot.source_prediction?snapshotFromCapture(row.snapshot):validatePredictionSnapshot(row.snapshot);if(epochMicros(s.issue_time_utc)<=frozenAt)throw Error('artifact registration must precede validation issuance');}}
 const prepared=prepareSamples(packet,policy,configuration.label_cutoff_utc),eligible=new Map(prepared.eligible.map(r=>[r.id,r])),records=new Map(verified.payload.examples.map(r=>[String(r.fixture_id),r]));
 const rows=prepared.scorable.filter(r=>epochMicros(r.issued_at)>=start&&epochMicros(r.issued_at)<end).map(r=>{
  const feature=eligible.get(r.id),fallback=!feature||artifact.status!=='fitted',record=records.get(r.id),s=record.snapshot.source_prediction?snapshotFromCapture(record.snapshot):validatePredictionSnapshot(record.snapshot);
  const market=eligibleMarket({...record,observations:completeEvidence(record,verified.payload)},s);
  return{...r,candidate:fallback?[...r.baseline]:candidateProbabilities(r.baseline,feature.xgEdge,artifact.beta),market,fallback};
 });
 const pairs=rows.filter(r=>r.market);
 const compare=rs=>({original_vs_candidate:paired(rs,r=>r.baseline,r=>r.candidate),
  original_vs_candidate_on_market_pairs:paired(rs.filter(r=>r.market),r=>r.baseline,r=>r.candidate),
  market_vs_original:paired(rs.filter(r=>r.market),r=>r.market,r=>r.baseline),market_vs_candidate:paired(rs.filter(r=>r.market),r=>r.market,r=>r.candidate)});
 return{schema_version:1,dataset_kind:'synthetic_verification',accuracy_claim:false,confirmatory_eligible:false,production_ready:false,artifact_hash:artifact.artifact_hash,validation_dataset_hash:verified.dataset_hash,
  protocol_hash:canonicalHash(configuration),freeze_receipt_hash:freezePacket.dataset_hash,
  coverage:{roster:prepared.roster,scored:rows.length,feature_eligible:rows.filter(r=>eligible.has(r.id)).length,fallbacks:rows.filter(r=>r.fallback).length,market_pairs:pairs.length,rejected:prepared.rejected},
  metrics:{original:metrics(rows,r=>r.baseline),candidate:metrics(rows,r=>r.candidate),original_on_market_pairs:metrics(pairs,r=>r.baseline),candidate_on_market_pairs:metrics(pairs,r=>r.candidate),market:metrics(pairs,r=>r.market)},
  comparisons:compare(rows),by_competition:[...new Set(rows.map(r=>r.league))].sort((a,b)=>a-b).map(league=>({league,...compare(rows.filter(r=>r.league===league))})),
  by_issuance_month:[...new Set(rows.map(r=>r.issued_at.slice(0,7)))].sort().map(period=>({period,...compare(rows.filter(r=>r.issued_at.startsWith(period)))})),
  limitations:['Synthetic fitting verifies mechanics, not football skill.','No real collection authority or learned football artifact is configured.','Separate week/league intervals are descriptive and small clusters can be uninformative.']};
}
