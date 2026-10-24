import {canonicalHash,epochMicros}from '../lib/snapshot-contract.mjs';
import {fairMarket,probabilityScore}from '../lib/bookmaker-metrics.mjs';
import {publishedVerdict,settledScore,resultCode,isFinished,utcKickoff}from '../lib/independent-grade.mjs';
import {paired,calibration}from '../phase5/validation.mjs';
import {canonicalKickoff}from './kickoff.mjs';
import {readFileSync}from 'node:fs';import {createHash}from 'node:crypto';
const scorerHash=createHash('sha256');for(const path of ['./report.mjs','./kickoff.mjs','../phase5/validation.mjs','../lib/bookmaker-metrics.mjs','../lib/independent-grade.mjs','../lib/snapshot-contract.mjs'])scorerHash.update(path).update(readFileSync(new URL(path,import.meta.url)));
const SCORER_SOURCE_HASH=scorerHash.digest('hex');
const ARMS=['E','E-Refreshed','A1','A2','A3'],mean=xs=>xs.length?xs.reduce((s,v)=>s+v,0)/xs.length:null;
export function eventsToStudy(events,odds=[],packetReceipt=null){
 const study=events.find(e=>e.kind==='study');if(!study)throw Error('study absent');
 const reservations=events.filter(e=>e.kind==='reservation'),reserved=reservations.reduce((s,e)=>s+e.body.reserved_micros,0);
 const records=events.filter(e=>e.kind==='job').map(e=>({...e.body,job_id:e.event_id,
  forecasts:events.filter(f=>f.kind==='forecast'&&f.parent_id===e.event_id).map(f=>{const ack=events.find(a=>a.kind==='confirmation'&&a.parent_id===f.event_id&&a.body.status==='accepted');return{...f.body,...(f.body.requires_confirmation&&!ack?{status:'failed',reason:'commit_unconfirmed'}:{}),stored_received_at_utc:f.received_at,received_at_utc:ack?.received_at??f.received_at};}),
  labels:events.filter(l=>l.kind==='label'&&l.parent_id===e.event_id&&l.body.fixture).map((l,i)=>({revision:i+1,received_at_utc:l.received_at,fixture:l.body.fixture})),
  odds:odds.filter(o=>String(o.fxid)===e.body.fixture_id).map(o=>({...o,received_at_utc:o.received_at_utc??packetReceipt}))}));
 return{study:{started_at_utc:study.received_at,version:study.body.version},records,reserved_micros:reserved,actual_paid_micros:reserved===0?0:null};
}
function labelFor(row,cutoff){
 const labels=[...(row.labels??[])].filter(l=>epochMicros(l.received_at_utc)<cutoff).sort((a,b)=>a.revision-b.revision);const f=labels.at(-1)?.fixture;
 const anchor=canonicalKickoff(row.kickoff_at_utc),p={kickoff:anchor.slice(0,10),ktime:anchor.slice(11,19),build:355,pick:'1'};
 const verdict=publishedVerdict(p,f,Number(cutoff/1000n));if(verdict.voidLate)return{reason:'void'};
 if(!f||!isFinished(f.status))return{reason:'pending'};
 const kickoff=Date.parse(f.date+'T'+f.time+'Z');if(!Number.isFinite(kickoff)||BigInt(kickoff)*1000n>=cutoff||BigInt(kickoff)*1000n>epochMicros(labels.at(-1).received_at_utc))return{reason:'invalid_label'};
 if(/^(AET|PEN)$/i.test(f.status)&&!(Number.isInteger(f.ft_h)&&Number.isInteger(f.ft_a)&&f.ft_h>=0&&f.ft_a>=0&&f.ft_h<=f.gh&&f.ft_a<=f.ga))return{reason:'ambiguous_90_minute'};
 const s=settledScore(f),actual=resultCode(s?.h,s?.a);return actual?{actual,fixture:f}:{reason:'invalid_label'};
}
function timely(f,row){
 try{return f?.status==='forecast'&&epochMicros(f.generated_at_utc)<=epochMicros(f.received_at_utc)&&epochMicros(f.received_at_utc)<epochMicros(canonicalKickoff(row.kickoff_at_utc));}catch{return false;}
}
function marketFor(row,issue){
 let best=null;
 for(const o of row.odds??[])try{
  const receipt=epochMicros(o.received_at_utc),captured=epochMicros(o.captured_at),issued=epochMicros(issue),fair=fairMarket(o);
  if(String(o.fxid)!==String(row.fixture_id)||!(Number(o.mins_to_kick)>0)||receipt>=issued||captured>receipt||receipt>=epochMicros(canonicalKickoff(row.kickoff_at_utc))||issued-captured>86400000000n||!fair)continue;
  if(!best||receipt>best.at)best={at:receipt,p:fair.probabilities};
 }catch{}
 return best?.p??null;
}
function metrics(rows){return{n:rows.length,brier:mean(rows.map(r=>probabilityScore(r.p,r.actual).brier)),log_loss:mean(rows.map(r=>probabilityScore(r.p,r.actual).logLoss)),accuracy:mean(rows.map(r=>Number(['1','X','2'][r.p.indexOf(Math.max(...r.p))]===r.actual))),calibration:calibration(rows,r=>r.p)};}
export function evaluateWeekend(study,asOfUtc){
 const cutoff=epochMicros(asOfUtc),cohorts=Object.fromEntries(ARMS.map(a=>[a,[]])),counts=Object.fromEntries(ARMS.map(a=>[a,{failed:0,missing:0,abstained:0,late:0,vetoed:0,unverified_input:0,timely_responses:0,verified_forecasts:0}])),context=[],coverage={roster:study.records.length,originals_before_collection:0,pending:0,void:0,invalid_label:0,ambiguous_90_minute:0},seen=new Set();
 for(const row of study.records){
  if(seen.has(row.job_id))throw Error('duplicate evaluation job');seen.add(row.job_id);
  const label=labelFor(row,cutoff);if(label.reason)coverage[label.reason]++;
  const original=row.original;
  const old=original&&epochMicros(original.made_at)<epochMicros(study.study.started_at_utc);if(old)coverage.originals_before_collection++;
  if(original&&label.actual&&probabilityScore([original.p_home,original.p_draw,original.p_away],label.actual)){
   const op={...original,kickoff:original.kickoff??row.kickoff_at_utc.slice(0,10),ktime:original.ktime??row.kickoff_at_utc.slice(11,19),build:original.build??355,pick:'1'},ko=utcKickoff(op.kickoff,op.ktime),verdict=publishedVerdict(op,label.fixture,Number(cutoff/1000n));
   if(ko!==null&&epochMicros(original.made_at)<BigInt(ko)*1000n&&!verdict.excluded&&!verdict.voidLate&&verdict.done)context.push({p:[original.p_home,original.p_draw,original.p_away],actual:label.actual});
  }
  for(const arm of ARMS){
   const f=(row.forecasts??[]).find(f=>f.arm===arm);
   if(!f){counts[arm].missing++;continue;}if(f.status==='failed'){counts[arm].failed++;continue;}if(f.status==='abstain'){counts[arm].abstained++;continue;}
   if(!timely(f,row)||epochMicros(f.received_at_utc)>=cutoff||arm==='E'&&old){counts[arm].late++;continue;}
   counts[arm].timely_responses++;
   if(['A1','A2','A3'].includes(arm)){
    const baseline=(row.forecasts??[]).find(x=>x.arm==='E-Refreshed');
    if(!/^[0-9a-f]{64}$/.test(f.input_hash??'')||f.input_hash!==baseline?.input_hash){counts[arm].unverified_input++;continue;}
   }
   if(arm==='A2'&&f.veto){counts[arm].vetoed++;continue;}
   const p=arm==='A2'?(row.forecasts??[]).find(x=>x.arm==='E-Refreshed'&&timely(x,row))?.probabilities:f.probabilities;
   if(probabilityScore(p,'1'))counts[arm].verified_forecasts++;
   if(!label.actual||!probabilityScore(p,label.actual))continue;
   cohorts[arm].push({id:row.job_id,league:row.league??'unrecorded',issued_at:f.generated_at_utc,p,actual:label.actual,market:marketFor(row,f.generated_at_utc),window:row.window});
  }
 }
 const comparisons={};for(const arm of ARMS){const pairs=cohorts[arm].filter(r=>r.market);comparisons[arm+'_vs_market']=paired(pairs,r=>r.market,r=>r.p);}
 for(const arm of ['A1','A2','A3']){const baseline=new Map(cohorts['E-Refreshed'].map(r=>[r.id,r])),pairs=cohorts[arm].filter(r=>baseline.has(r.id)).map(r=>({...r,baseline:baseline.get(r.id).p}));comparisons[arm+'_vs_E-Refreshed']=paired(pairs,r=>r.baseline,r=>r.p);}
 const aiSuccess=counts.A1.verified_forecasts+counts.A3.verified_forecasts;
 const actualSpend=Number.isSafeInteger(study.actual_paid_micros)&&study.actual_paid_micros>=0?study.actual_paid_micros/1000000:null;
 return{schema_version:1,scorer_version:'weekend-report-v2',scorer_source_hash:SCORER_SOURCE_HASH,as_of_utc:asOfUtc,input_hash:canonicalHash(study),accuracy_claim:false,confirmatory_eligible:false,coverage,arms:Object.fromEntries(ARMS.map(a=>[a,{...metrics(cohorts[a]),...counts[a],coverage:study.records.length?counts[a].verified_forecasts/study.records.length:0,response_coverage:study.records.length?counts[a].timely_responses/study.records.length:0}])),original_context:metrics(context),comparisons,
  strata:{competitions:[...new Set(study.records.map(r=>r.league))].filter(v=>v!=null).map(league=>({league,arms:Object.fromEntries(ARMS.map(a=>[a,metrics(cohorts[a].filter(r=>r.league===league))]))})),observation_windows:[...new Set(study.records.map(r=>r.window))].map(window=>({window,arms:Object.fromEntries(ARMS.map(a=>[a,metrics(cohorts[a].filter(r=>r.window===window))]))}))},
  actual_ai_spend_usd:actualSpend,reserved_liability_usd:study.reserved_micros/1000000,ai_cost_per_success_usd:aiSuccess&&actualSpend!==null?actualSpend/aiSuccess:null,
  limitations:['Weekend results are exploratory, not proof of superiority or profitability.','Originals observed before collection are contextual, not contemporaneous E forecasts.','Different generation times are retained; AI comparisons require identical frozen input lineage.','Descriptive paired intervals are not powered confirmatory evidence.']};
}
