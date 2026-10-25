import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {evaluateWeekend,eventsToStudy} from '../phase8/report.mjs';
import {canonicalKickoff} from '../phase8/kickoff.mjs';
import {MODELS} from './contracts.mjs';
export function admitSunday(guards,now){
 if(guards.kind==='synthetic_verification'&&guards.synthetic===true)return;
 if(guards.kind!=='football'||now.slice(0,10)!=='2026-10-25')throw Error('actual Sunday observation window required');
 if(guards.recoveryVerified!==true||guards.externalCopyVerified!==true||guards.supervised!==true)throw Error('supervised recovery and retained external archive required');
 if(guards.engine!==undefined)throw Error('real engine cannot be replaced');
}
export function evidenceView(source,fixtureId,receipt){
 const fixture=source.rows.find(r=>r.fxid===Number(fixtureId));if(!fixture)throw Error('source fixture absent');
 const rows=source.rows.filter(r=>r.lid===fixture.lid),columns=[...new Set(rows.flatMap(r=>Object.keys(r)))].sort();
 const missing={};rows.forEach((r,i)=>{const absent=columns.flatMap((k,j)=>Object.hasOwn(r,k)?[]:[j]);if(absent.length)missing[i]=absent;});
 return{fixture_id:String(fixtureId),home:fixture.home,away:fixture.away,receipt_at_utc:receipt,
  facts:[{ref:'packet:'+canonicalHash(source)+':competition:'+fixture.lid,data:{kind:'complete_competition_as_collected_v1',columns,rows:rows.map(r=>columns.map(k=>r[k]??null)),missing,complete_competition:true,receipt_provenance:'receipt-now only; historical mutable values do not prove pre-Saturday availability'}}]};
}
export function continuationStudy(events,packets=new Map()){
 const study=eventsToStudy(events,[]),byJob=new Map(events.filter(e=>e.kind==='job').map(e=>[e.event_id,e]));
 for(const r of study.records){
  const packet=packets.get(byJob.get(r.job_id)?.parent_id);
  r.odds=(packet?.body?.odds??[]).filter(o=>String(o.fxid)===r.fixture_id).map(o=>({...o,received_at_utc:o.received_at_utc??packet.received_at}));
 }
 // A paid continuation adds distinct jobs beneath a fresh packet of the same
 // frozen study. Its report view references the immutable baseline events;
 // the superseded paid-disabled jobs remain in the event journal.
 const continued=study.records.filter(r=>r.cohort==='sunday-ai-continuation');
 for(const row of continued){
  const event=byJob.get(row.job_id),baselineJob=event?.body?.baseline_job_id;
  const original=study.records.find(r=>r.job_id===baselineJob);
  if(!original||original.cohort!=='sunday-engine'||original.fixture_id!==row.fixture_id||event.body.baseline_forecast_id!==baselineJob+':E-Refreshed')throw Error('invalid paid continuation lineage');
  const expected=events.find(e=>e.event_id===event.body.baseline_forecast_id);
  if(!expected||expected.event_body_hash!==event.body.baseline_hash)throw Error('changed frozen continuation baseline');
  row.forecasts=[...original.forecasts.filter(f=>['E','E-Refreshed'].includes(f.arm)),...row.forecasts];
  row.labels=original.labels;row.cohort='sunday-ai';row.continuation_of=baselineJob;
 }
 const covered=new Set(continued.map(r=>r.fixture_id+'|'+r.provider_model));
 if(continued.length){
  study.records=study.records.filter(r=>r.cohort!=='sunday-ai'||r.continuation_of||!covered.has(r.fixture_id+'|'+r.provider_model));
 }
 for(const s of events.filter(e=>e.kind==='study'&&e.body.experiment==='openrouter-private-v1')){
  for(const target of s.body.roster??[]){
   for(const[tag,model]of [['engine',null],['openai',MODELS[0]],['kimi',MODELS[1]]]){
    const job=s.event_id+':'+target.fixture_id+':'+tag;
   if(model&&covered.has(target.fixture_id+'|'+model))continue;
    if(study.records.some(r=>r.job_id===job))continue;
    const known=study.records.find(r=>r.fixture_id===target.fixture_id);
    study.records.push({...target,job_id:job,window:'2026-10-25',cohort:model?'sunday-ai':'sunday-engine',provider_model:model,missing_enrollment:true,virtual_export_only:true,odds:[],labels:known?.labels??[],forecasts:['E','E-Refreshed','A1','A2','A3'].map(arm=>({arm,status:'failed',reason:'declared_target_enrollment_or_capture_failed'}))});
   }
  }
 }
 return study;
}
export function exportContinuation(store){
 const events=store.events(),packets=new Map(events.filter(e=>e.kind==='packet').map(e=>[e.event_id,store.read(e.event_id)]));
 return continuationStudy(events,packets);
}
export function evaluateContinuation(study,cutoff){
 const sat=study.records.filter(r=>!r.cohort||r.cohort==='saturday'),sun=study.records.filter(r=>r.cohort==='sunday-engine');
 const select=records=>evaluateWeekend({...study,records},cutoff);
 if(new Set(sun.map(r=>r.fixture_id)).size!==sun.length)throw Error('duplicate Sunday fixture');
 const saturday=select(sat),sunday=select(sun),models=Object.fromEntries(MODELS.map(m=>[m,select(study.records.filter(r=>r.cohort==='sunday-ai'&&r.provider_model===m))]));
 const satByFixture=new Map();for(const r of sat){if(satByFixture.has(r.fixture_id))throw Error('duplicate Saturday fixture');satByFixture.set(r.fixture_id,r);}
 const pairedRows=sun.flatMap(r=>{
  const s=satByFixture.get(r.fixture_id),f=s?.forecasts.find(x=>x.arm==='E-Refreshed'&&x.status==='forecast');if(!f)return[];
  try{if(epochMicros(f.generated_at_utc)>epochMicros(f.received_at_utc)||epochMicros(f.received_at_utc)>=epochMicros(canonicalKickoff(s.kickoff_at_utc))||epochMicros(f.received_at_utc)>=epochMicros(cutoff))return[];}catch{return[];}
  // Comparison-only view; the stored Saturday issuance and own kickoff remain unchanged.
  const ko=canonicalKickoff(s.kickoff_at_utc);return[{...r,original:{made_at:f.generated_at_utc,p_home:f.probabilities[0],p_draw:f.probabilities[1],p_away:f.probabilities[2],kickoff:ko.slice(0,10),ktime:ko.slice(11,19),build:355}}];
 });
 const contrast=select(pairedRows).comparisons.original_context_vs_E_Refreshed;
 return{version:'openrouter-weekend-report-v1',as_of_utc:cutoff,input_hash:canonicalHash(study),saturday,sunday,models,saturday_vs_sunday:{...contrast,timing:'Saturday versus Sunday issuance; identical fixtures, different information cutoffs; exploratory only'},
  actual_ai_spend_usd:Number.isSafeInteger(study.actual_paid_micros)?study.actual_paid_micros/1000000:null,reserved_liability_usd:study.reserved_micros/1000000,accuracy_claim:false,confirmatory_eligible:false,
  limitations:['Per-model reports share the global ledger: never sum their displayed spending.','AI models receive identical lossless competition views of a common frozen packet; the engine retains its full loader input. AI does not receive gate/engine probabilities or bookmaker odds.','Saturday and Sunday forecasts are correlated repeated fixtures with different issuance times.','Historical values were collected now; no retrospective receipt provenance is inferred.','No Monday execution is established merely by computing synthetic/future-cutoff reports.']};
}
