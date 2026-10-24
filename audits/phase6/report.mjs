// Scores frozen private exports only. No fitting, database writes or network calls.
import { canonicalHash, canonicalJSON, epochMicros, probabilities, snapshotFromCapture, validatePredictionSnapshot, utcInstant } from '../lib/snapshot-contract.mjs';
import { publishedVerdict, settledScore, resultCode } from '../lib/independent-grade.mjs';
import { probabilityScore, fairMarket } from '../lib/bookmaker-metrics.mjs';
import { paired, calibration, wilson } from '../phase5/validation.mjs';
const classes=['1','X','2'];
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
function metrics(rows,predict){
 const scores=rows.map(r=>probabilityScore(predict(r),r.actual));
 const hits=rows.filter(r=>classes[predict(r).indexOf(Math.max(...predict(r)))]===r.actual).length;
 return {n:rows.length,brier:mean(scores.map(s=>s.brier)),log_loss:mean(scores.map(s=>s.logLoss)),top1_accuracy:rows.length?hits/rows.length:null,
  top1_wilson:wilson(hits,rows.length),calibration:calibration(rows,predict)};
}
export function eligibleMarket(record,snapshot){
 if(record.capture?.capture_kind!=='at_issue')return null;
 const issue=epochMicros(snapshot.issue_time_utc),eligible=[];
 for(const o of record.observations??[]){try{
  const at=epochMicros(o.received_at_utc),p=o.value,captured=epochMicros(p.captured_at);
  if(o.field_name!=='odds_1x2'||o.source_kind!=='odds'||o.availability!=='observed'||o.feature_schema_version!==1||String(o.fixture_id)!==snapshot.fixture_id||String(p.fxid)!==snapshot.fixture_id||
   at!==epochMicros(o.observed_at_utc)||at>=issue||issue-at>86400000000n||captured>at||issue-captured>86400000000n||!(p.mins_to_kick>0)||!Number.isSafeInteger(p.id)||p.id<=0)continue;
  const fair=fairMarket(p);if(fair)eligible.push({at,id:p.id,observation_id:o.observation_id,probabilities:fair.probabilities});
 }catch{/* Explicitly unpaired; never infer missing timestamps. */}}
 eligible.sort((a,b)=>a.at===b.at?b.id-a.id:a.at>b.at?-1:1);
 return eligible[0]?.probabilities??null;
}
function comparisons(rows){
 const matched=rows.filter(r=>r.market);
 return {original_vs_candidate:paired(rows,r=>r.original,r=>r.candidate),
  original_vs_candidate_on_market_pairs:paired(matched,r=>r.original,r=>r.candidate),
  market_vs_original:paired(matched,r=>r.market,r=>r.original),market_vs_candidate:paired(matched,r=>r.market,r=>r.candidate)};
}
export function buildReport({candidate,records,attempts=[],asOfUtc}){
 const cutoff=epochMicros(asOfUtc),body=structuredClone(candidate);delete body.candidate_id;
 if(canonicalHash(body)!==candidate.candidate_id||canonicalHash(candidate.configuration)!==candidate.configuration_hash)throw Error('candidate lineage invalid');
 const coverage={roster:records.length,scored:0,market_pairs:0,missing_snapshots:0,missing_results:0,abstentions:0,pending:0,voids:0,excluded:0,invalid_outcomes:0,ambiguous_90m:0,
  successful_forecasts:0,attempt_events:attempts.length,failed_attempts:attempts.filter(e=>e.state==='failed').length};
 const seen=new Set(),jobs=new Set(),rows=[],reasons={};
 for(const record of [...records].sort((a,b)=>a.fixture_id.localeCompare(b.fixture_id))){
  if(seen.has(record.fixture_id)||jobs.has(record.job_id))throw Error('duplicate fixture/job');seen.add(record.fixture_id);jobs.add(record.job_id);
  if(!record.snapshot){coverage.missing_snapshots++;continue;}
  const s=record.snapshot.source_prediction?snapshotFromCapture(record.snapshot):validatePredictionSnapshot(record.snapshot),p=record.source_prediction;
  if(String(record.fixture_id)!==s.fixture_id||String(p.fxid)!==s.fixture_id)throw Error('fixture identity mismatch');
  if(canonicalJSON([p.p_home,p.p_draw,p.p_away])!==canonicalJSON(s.probabilities)||epochMicros(p.made_at)!==epochMicros(s.issue_time_utc))throw Error('original source lineage mismatch');
  const originalKickoff=utcInstant(String(p.kickoff).slice(0,10)+'T'+p.ktime+(p.ktime.length===5?':00Z':'Z'));
  if(p.build!==s.prediction_build||p.pick!==s.pick||epochMicros(originalKickoff)!==epochMicros(s.kickoff_at_utc))throw Error('original kickoff/build/pick lineage mismatch');
  if(epochMicros(s.issue_time_utc)>cutoff){coverage.excluded++;continue;}
  const result=record.result;
  if(result&&(result.snapshot_id!==s.snapshot_id||result.candidate_id!==candidate.candidate_id||result.configuration_hash!==candidate.configuration_hash||result.candidate_version!==candidate.version||result.study_kind!==candidate.study_kind||!['forecast','fallback'].includes(result.status)||
   result.baseline_payload_hash!==record.capture?.payload_hash||result.evidence_manifest_hash!==record.capture?.manifest_hash||result.visibility!=='shadow'||result.confirmatory_eligible!==false))throw Error('result lineage mismatch');
  if(result?.status==='fallback'&&canonicalJSON(result.probabilities)!==canonicalJSON(s.probabilities))throw Error('fallback lineage mismatch');
  const usable=record.result_received_at_utc&&epochMicros(record.result_received_at_utc)>cutoff?null:result;
  const fallback=!usable||usable.status==='fallback';
  if(!usable)coverage.missing_results++;
  if(fallback){coverage.abstentions++;const reason=usable?.reason??'unrecorded_result';reasons[reason]=(reasons[reason]??0)+1;}else coverage.successful_forecasts++;
  const candidateP=probabilities(usable?.probabilities??s.probabilities);
  const revisions=[];
  for(const settlement of record.settlements??[]){
   if(String(settlement.fixture_id)!==s.fixture_id)throw Error('settlement fixture mismatch');
   if(settlement.kind!==candidate.study_kind)throw Error('settlement cohort mismatch');
   if(epochMicros(settlement.received_at_utc)<=cutoff)revisions.push(settlement);
  }
  revisions.sort((a,b)=>b.revision-a.revision);
  if(!revisions.length){coverage.pending++;continue;}
  const f=revisions[0].fixture,verdict=publishedVerdict(p,f,Date.parse(asOfUtc));
  if(verdict.excluded){coverage.excluded++;continue;}
  if(verdict.voidLate){coverage.voids++;continue;}
  if(!verdict.done){coverage.pending++;continue;}
  const score=settledScore(f),actual=resultCode(score?.h,score?.a);
  if(!actual){coverage.invalid_outcomes++;continue;}
  // Public grader retains its provider-goals fallback. An offline AET/PEN accuracy
  // comparison cannot establish 90 minutes without a valid explicit FT pair.
  if(/^(AET|PEN)$/.test(String(f.status??'').trim().toUpperCase())&&![f.ft_h,f.ft_a].every((v,i)=>Number.isInteger(v)&&v>=0&&v<=[f.gh,f.ga][i])){coverage.ambiguous_90m++;continue;}
  if(!Number.isSafeInteger(p.lid))throw Error('missing competition');
  const market=eligibleMarket(record,s);
  rows.push({id:s.fixture_id,league:p.lid,issued_at:s.issue_time_utc,actual,original:s.probabilities,candidate:candidateP,market,fallback,
   xgEdge:usable?.diagnostics?.xgEdge??null});
 }
 for(const event of attempts)if(!jobs.has(event.job_id))throw Error('attempt outside frozen roster');
 coverage.scored=rows.length;coverage.market_pairs=rows.filter(r=>r.market).length;
 coverage.abstention_rate=coverage.roster?coverage.abstentions/coverage.roster:null;
 coverage.market_pair_rate=coverage.roster?coverage.market_pairs/coverage.roster:null;
 const groupBy=key=>[...new Set(rows.map(key))].sort().map(group=>{
  const rs=rows.filter(r=>key(r)===group);return {group,n:rs.length,metrics:{original:metrics(rs,r=>r.original),candidate:metrics(rs,r=>r.candidate)},comparisons:comparisons(rs)};
 });
 const marketRows=rows.filter(r=>r.market),successful=rows.filter(r=>!r.fallback);
 return {schema_version:1,study_kind:candidate.study_kind,confirmatory_eligible:false,as_of_utc:asOfUtc,
  input_hash:canonicalHash({candidate,records,attempts,asOfUtc}),candidate_id:candidate.candidate_id,coverage,reasons,
  metrics:{original:metrics(rows,r=>r.original),candidate:metrics(rows,r=>r.candidate),market:metrics(marketRows,r=>r.market),
   original_on_market_pairs:metrics(marketRows,r=>r.original),candidate_on_market_pairs:metrics(marketRows,r=>r.candidate)},
  comparisons:comparisons(rows),successful_only:{n:successful.length,comparisons:comparisons(successful)},
  by_competition:groupBy(r=>String(r.league)),by_issuance_month:groupBy(r=>r.issued_at.slice(0,7)),
  hypothesis:{feature:'existing M14 xgEdge',available:rows.filter(r=>Number.isFinite(r.xgEdge)).length,
   interpretation:'Synthetic results verify mechanics only. No accuracy gain or prospective evidence is established.'},
  limitations:['No automatic prospective eligibility; chronological dates alone are insufficient.','Week and league bootstrap intervals are separate descriptive sensitivity checks, not complete multiway dependence inference.',
   'No historical ordered-engine-input replay, independent training artifact or new untouched holdout is established.','Caller JSON cannot establish provenance; use the private integrity-checked database export.']};
}
