import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {runEngine,ENGINE_SOURCE_SHA256} from '../phase8/engine.mjs';
import {canonicalKickoff} from '../phase8/kickoff.mjs';
import {MODELS,CEILING,buildRequest} from './contracts.mjs';
import {admitSunday,evidenceView} from './protocol.mjs';

// Append-only repair of a verified engine-only Sunday study. Existing jobs,
// forecasts, packets and reservations are never updated or reused.
export async function continueSundayAI(options){
 const {store,source,client,preflight,checkpoint}=options;
 admitSunday(options,store.clock());
 const synthetic=options.kind==='synthetic_verification';
 if(options.paid!==true||!synthetic&&options.engine!==undefined||synthetic!==Boolean(source?.synthetic))throw Error('invalid paid continuation mode');
 if(!synthetic&&(epochMicros(store.clock())-epochMicros(source.source_read_at_utc)>900000000n||epochMicros(source.source_read_at_utc)>epochMicros(store.clock())))throw Error('fresh Sunday receipt required');
 if(source.contexts!==undefined||!source.history_complete&&!synthetic||!Array.isArray(source.targets)||!Array.isArray(source.rows)||!synthetic&&(source.collection?.initial_count!==source.rows.length||source.collection?.final_count!==source.rows.length))throw Error('complete unadjusted source required');
 if(typeof checkpoint!=='function'||typeof preflight!=='function'||!client?.execute)throw Error('supervised paid gates required');
 const prior=store.events(),priorById=new Map(prior.map(e=>[e.event_id,e])),studies=prior.filter(e=>e.kind==='study'&&e.body.experiment==='openrouter-private-v1');
 if(studies.length!==1||prior.some(e=>e.kind==='reservation'||e.kind==='usage'||e.kind==='job'&&e.body.cohort==='sunday-ai-continuation'))throw Error('ambiguous or already paid continuation; reconcile, never redispatch');
 const study=studies[0],roster=study.body.roster;
 if(!Array.isArray(roster)||new Set(roster.map(r=>r.fixture_id)).size!==roster.length||roster.length!==prior.filter(e=>e.kind==='job'&&e.body.cohort==='sunday-engine').length)throw Error('incomplete frozen Sunday roster');
 const originalPacketEvents=prior.filter(e=>e.kind==='packet'&&e.parent_id===study.event_id);
 if(originalPacketEvents.length!==1)throw Error('ambiguous original Sunday packet');
 const frozenId=originalPacketEvents[0].event_id,frozen=store.read(frozenId).body,frozenPacket={...frozen,receipt_at_utc:store.receipt(frozenId)},frozenHash=canonicalHash(frozenPacket),frozenRows=new Map(frozen.rows.map(x=>[String(x.fxid),x]));
 const oldJobs=new Map(prior.filter(e=>e.kind==='job'&&e.body.cohort==='sunday-engine').map(e=>[e.body.fixture_id,e]));
 // The frozen engine-only checkpoint predates confirmation events. Its entire
 // event manifest is verified by recovery; newer chains must retain their acks.
 const legacyWithoutConfirmations=!prior.some(e=>e.kind==='confirmation'),original=new Map();
 for(const r of roster){
  const job=oldJobs.get(r.fixture_id),f=job&&priorById.get(job.event_id+':E-Refreshed'),ack=f&&priorById.get(f.event_id+':commit');
  if(!job||job.parent_id!==frozenId||!f||f.parent_id!==job.event_id||f.body.status!=='forecast'||typeof f.body.eligible!=='boolean'||!legacyWithoutConfirmations&&ack?.body?.status!=='accepted'||!synthetic&&f.body.engine_source_hash!==ENGINE_SOURCE_SHA256||f.body.input_hash!==frozenHash)throw Error('frozen Sunday engine lineage mismatch');
  for(const tag of ['openai','kimi']){
   const legacy=priorById.get(study.event_id+':'+r.fixture_id+':'+tag);
   if(legacy?.kind!=='job'||legacy.parent_id!==frozenId)throw Error('missing frozen model cohort');
   for(const arm of ['A1','A2','A3']){
    const old=priorById.get(legacy.event_id+':'+arm);
    if(old?.body?.status!=='failed'||old.body.reason!=='paid_execution_disabled')throw Error('model arm already issued or unresolved');
   }
  }
  original.set(r.fixture_id,{job,forecast:f,roster:r});
 }
 const checked=await preflight();
 if(!checked?.account||checked.profiles?.length!==2||!MODELS.every(m=>checked.profiles.some(p=>p.model===m)))throw Error('authenticated model/account preflight absent');
 const engine=synthetic?options.engine:runEngine,receipt=store.clock();
 const freshPacket={...source,receipt_at_utc:receipt},current=await engine(freshPacket);
 if(!synthetic&&(current.synthetic_clock!==false||current.source_sha256!==ENGINE_SOURCE_SHA256))throw Error('exact Build 355 identity failed');
 if(!Array.isArray(current.predictions)||current.predictions.length!==source.targets.length)throw Error('fresh source engine coverage failed');
 const freshPredictions=new Map(current.predictions.map(x=>[String(x.fixture_id),x])),rows=new Map(source.rows.map(x=>[String(x.fxid),x]));
 const ordered=[...roster].sort((a,b)=>a.kickoff_at_utc.localeCompare(b.kickoff_at_utc)||Number(a.fixture_id)-Number(b.fixture_id));
 const decisions=[],eligible=[];
 for(const r of ordered){
  const old=original.get(r.fixture_id).forecast.body,now=freshPredictions.get(r.fixture_id),row=rows.get(r.fixture_id),baselineRow=frozenRows.get(r.fixture_id),reason=old.status!=='forecast'||old.eligible!==true?'frozen_engine_ineligible':!row||!source.targets.includes(Number(r.fixture_id))?'fresh_source_target_missing':canonicalKickoff(row.date+'T'+row.time+'Z')!==r.kickoff_at_utc||row.lid!==r.league||row.home!==baselineRow?.home||row.away!==baselineRow?.away?'fixture_identity_changed':row.status!=='NS'?'fixture_not_unplayed':now?.status!=='forecast'||now.eligible!==true?'fresh_engine_ineligible':epochMicros(r.kickoff_at_utc)-epochMicros(store.clock())<450000000n?'request_deadline':null;
  decisions.push({fixture_id:r.fixture_id,kickoff_at_utc:r.kickoff_at_utc,reason:reason??'candidate'});
  if(!reason)eligible.push(r);
 }
 if(!eligible.length)return{study:study.event_id,decisions,selected:[],reserved_micros:store.reservedMicros(),paid_calls:0};
 const session=store.clock().replaceAll(/[^0-9]/g,''),packetId=study.event_id+':continuation-packet:'+session;
 store.append('packet',packetId,study.event_id,source);
 const packetReceipt=store.receipt(packetId),selected=[];let paidCalls=0,halt=false;
 const save=(job,arm,body)=>{
  const id=job.event_id+':'+arm;
  try{store.append('forecast',id,job.event_id,{arm,...body});return true;}
  catch{if(!store.read(id))store.append('forecast',id,job.event_id,{arm,status:'failed',reason:'private_forecast_commit_failed'});return false;}
 };
 await checkpoint();
 for(const r of eligible){
  if(halt)break;
  let evidence,profiles;
  try{
   if(epochMicros(store.clock())-epochMicros(source.source_read_at_utc)>900000000n&&!synthetic){decisions.find(x=>x.fixture_id===r.fixture_id).reason='source_stale';halt=true;break;}
   if(epochMicros(r.kickoff_at_utc)-epochMicros(store.clock())<450000000n){decisions.find(x=>x.fixture_id===r.fixture_id).reason='request_deadline';continue;}
   evidence=evidenceView(source,r.fixture_id,packetReceipt);
   const fresh=await preflight();profiles=fresh.profiles;
   if(profiles.length!==2||!MODELS.every(m=>profiles.some(p=>p.model===m)))throw Error('model profile changed');
   if(store.reservedMicros()+profiles.reduce((sum,p)=>sum+2*p.reserved_micros,0)>CEILING){decisions.find(x=>x.fixture_id===r.fixture_id).reason='insufficient_balanced_bundle_budget';break;}
   if(profiles.some(p=>Buffer.byteLength(JSON.stringify(buildRequest('A3',p,evidence,store.clock()).body))+16384>p.context_length-1024)){decisions.find(x=>x.fixture_id===r.fixture_id).reason='complete_evidence_exceeds_context';continue;}
  }catch{decisions.find(x=>x.fixture_id===r.fixture_id).reason='source_or_provider_preflight_blocked';halt=true;break;}
  const old=original.get(r.fixture_id),jobs=[];
  for(const [tag,model]of [['openai',MODELS[0]],['kimi',MODELS[1]]]){
   const event_id=study.event_id+':'+r.fixture_id+':'+tag+':ai-cont:'+session;
   store.append('job',event_id,packetId,{fixture_id:r.fixture_id,league:r.league,window:'2026-10-25',cohort:'sunday-ai-continuation',provider_model:model,kickoff_at_utc:r.kickoff_at_utc,original:r.original,baseline_job_id:old.job.event_id,baseline_forecast_id:old.forecast.event_id,baseline_hash:old.forecast.event_body_hash});
   jobs.push({event_id,model,baseline:old.forecast.body});
  }
  await checkpoint();selected.push(r.fixture_id);decisions.find(x=>x.fixture_id===r.fixture_id).reason='selected';
  for(const job of jobs){
   for(const arm of ['scout','A3']){
    let result,request;
    try{
     if(halt||epochMicros(r.kickoff_at_utc)-epochMicros(store.clock())<450000000n||!synthetic&&epochMicros(store.clock())-epochMicros(source.source_read_at_utc)>900000000n)throw Error('request_deadline_source_or_halt');
     const checked=await preflight(),profile=checked.profiles.find(p=>p.model===job.model);
     request=buildRequest(arm,profile,evidence,store.clock());
     if(Buffer.byteLength(JSON.stringify(request.body))+16384>profile.context_length-1024)throw Error('context_capacity');
     result=await client.execute(store,{id:'or:'+canonicalHash({job:job.event_id,arm}),job:job.event_id,request,profile},{...options,checkpoint,account:checked.account});
     paidCalls++;
     if(result.halt||result.status==='failed')halt=true;
    }catch{halt=true;result={status:'failed',reason:'provider_or_budget_admission_failed'};}
    const common={model:job.model,model_version:'OpenRouter-private-v1',input_hash:job.baseline.input_hash,ai_evidence_hash:request?.input_hash??null,request_hash:request?.request_hash??null,generated_at_utc:store.clock(),generation_id:result.generation_id??null,baseline_forecast_id:old.forecast.event_id};
    if(result.status!=='response'||result.decision.abstain){for(const a of arm==='scout'?['A1','A2']:['A3'])save(job,a,{...common,status:result.status==='response'?'abstain':'failed',reason:result.decision?.reason??result.reason,baseline_fallback:job.baseline.probabilities,fallback_scored_as_ai:false});continue;}
    const d=result.decision;
    if(arm==='A3'){if(!save(job,'A3',{...common,status:'forecast',probabilities:d.probabilities,evidence_refs:d.evidence_refs}))halt=true;}
    else{
     if(!save(job,'A2',{...common,status:'forecast',veto:d.veto,evidence_refs:d.evidence_refs}))halt=true;
     try{
      let adjusted=job.baseline.prediction,contextHash=null;
      if(d.hm!==1||d.am!==1){
       const context=await engine({...frozenPacket,contexts:{[r.fixture_id]:{hm:d.hm,am:d.am}}});
       const c=context.predictions.find(x=>String(x.fixture_id)===r.fixture_id);
       if(context.source_sha256!==ENGINE_SOURCE_SHA256&&!synthetic||canonicalHash(c?.prediction)!==canonicalHash(job.baseline.prediction)||!c?.a1?.prediction)throw Error('frozen engine context parity failed');
       adjusted=c.a1.prediction;contextHash=context.input_hash;
      }
      if(!save(job,'A1',{...common,generated_at_utc:store.clock(),status:'forecast',probabilities:[adjusted.pW,adjusted.pD,adjusted.pL],prediction:adjusted,context_input_hash:contextHash,context:{hm:d.hm,am:d.am},evidence_refs:d.evidence_refs}))halt=true;
     }catch{save(job,'A1',{...common,status:'abstain',reason:'exact_context_baseline_unavailable',baseline_fallback:job.baseline.probabilities,fallback_scored_as_ai:false});}
    }
   }
  }
  await checkpoint();
 }
 await checkpoint();return{study:study.event_id,packet:packetId,decisions,selected,reserved_micros:store.reservedMicros(),paid_calls:paidCalls,halt};
}
