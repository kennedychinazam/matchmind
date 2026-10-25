import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {runEngine,ENGINE_SOURCE_SHA256} from '../phase8/engine.mjs';
import {canonicalKickoff} from '../phase8/kickoff.mjs';
import {MODELS,CEILING,buildRequest} from './contracts.mjs';
import {admitSunday,evidenceView,STUDIES} from './protocol.mjs';
// Supervised orchestration only; no timer, source collector, public publisher or hosted write.
// One code path serves both studies. A later prospective study passes its own
// cohort descriptor, so it shares this journal and therefore the one global
// ledger, while its study id, experiment and cohort names stay its own. The
// enrollment guard is per experiment, so neither study can be enrolled twice and
// neither can overwrite the other.
export async function runSunday(options){
 const {store,source,client,preflight,checkpoint}=options;
 const cohorts=options.cohorts??STUDIES[0];
 const windowTag=options.window??'2026-10-25';
 admitSunday(options,store.clock());
 if(store.events().some(e=>e.kind==='study'&&e.body.experiment===cohorts.experiment||e.kind==='job'&&e.body.cohort===cohorts.engine))throw Error('study already enrolled; reconcile existing immutable cohort instead of duplicating it');
 const synthetic=options.kind==='synthetic_verification';
 if(synthetic&&source.synthetic!==true)throw Error('synthetic mode cannot accept genuine football data');
 if(!synthetic&&(epochMicros(store.clock())-epochMicros(source.source_read_at_utc)>900000000n||epochMicros(source.source_read_at_utc)>epochMicros(store.clock())))throw Error('fresh supervised source receipt required');
 if(!synthetic&&source.synthetic===true)throw Error('synthetic evidence cannot become real forecasts');
 if(source.contexts!==undefined)throw Error('unadjusted fresh engine packet required');
 const engine=synthetic?options.engine:runEngine;
 const inputRows=new Map(source.rows.map(r=>[r.fxid,r])),inputOriginals=new Map(source.originals.map(r=>[Number(r.fxid),r]));
 const roster=source.targets.map(id=>{const r=inputRows.get(id);if(!r)throw Error('missing source roster');return{fixture_id:String(id),league:r.lid,kickoff_at_utc:canonicalKickoff(r.date+'T'+r.time+'Z'),original:inputOriginals.get(id)??null};});
 const session=store.clock().replaceAll(/[^0-9]/g,''),cohort=cohorts.key+':'+session;
 const study=store.append('study',cohort,null,{version:'weekend-v1',windows:['2026-10-24','2026-10-25'],experiment:cohorts.experiment,window:windowTag,roster,kind:options.kind,ai_total_ceiling_micros:CEILING,selection:'All source target jobs retained; kickoff/fixture order; balanced four-request model bundles subject to complete context, physical worst-case budget and 450-second dispatch allowance.',models:MODELS,tools:false});
 const packetId=store.append('packet',cohort+':packet',study,source),receipt=store.receipt(packetId),packet={...source,receipt_at_utc:receipt};
 const initial=new Map(source.rows.map(r=>[r.fxid,r])),originals=new Map(source.originals.map(r=>[Number(r.fxid),r]));
 const targets=[...source.targets].sort((a,b)=>{const x=initial.get(a),y=initial.get(b);return(x.date+'T'+x.time).localeCompare(y.date+'T'+y.time)||a-b;});
 const groups=[];
 for(const id of targets){
  const row=initial.get(id);if(!row)throw Error('missing roster fixture; retain packet and stop');
  const ko=canonicalKickoff(row.date+'T'+row.time+'Z'),jobs=[];
  for(const [tag,model]of [['engine',null],['openai',MODELS[0]],['kimi',MODELS[1]]]){
   const jid=cohort+':'+id+':'+tag;
   store.append('job',jid,packetId,{fixture_id:String(id),league:row.lid,window:windowTag,cohort:model?cohorts.ai:cohorts.engine,provider_model:model,kickoff_at_utc:ko,original:originals.get(id)??null});jobs.push({jid,model});
  }groups.push({id,ko,jobs});
 }
 const save=(j,arm,body)=>{
  const id=j.jid+':'+arm;
  try{store.append('forecast',id,j.jid,{arm,...body});}
  catch{if(!store.read(id))store.append('forecast',id,j.jid,{arm,status:'failed',reason:'pre_kickoff_persistence_failed'});}
 };
 let output=null;
 try{output=await engine(packet);if(!synthetic&&(output.synthetic_clock!==false||output.source_sha256!==ENGINE_SOURCE_SHA256))throw Error('engine identity');}
 catch{output=null;}
 const predictions=new Map((output?.predictions??[]).map(r=>[Number(r.fixture_id),r]));
 for(const g of groups){
  g.baseline=predictions.get(g.id);
  for(const j of g.jobs){
   save(j,'E',{status:'abstain',reason:'original_context_only'});
   save(j,'E-Refreshed',g.baseline?.status==='forecast'?{status:'forecast',generated_at_utc:g.baseline.generated_at_utc,probabilities:g.baseline.probabilities,prediction:g.baseline.prediction,decision:g.baseline.decision,eligible:g.baseline.eligible,exclusion_reason:g.baseline.exclusion_reason,model_version:'Build355-private-openrouter-v1',engine_source_hash:output.source_sha256,input_hash:output.input_hash}:{status:'failed',reason:g.baseline?.exclusion_reason??'engine_failed'});
  }
 }
 await checkpoint();let providerBlocked=false;
 for(const g of groups){
  const modelJobs=g.jobs.filter(j=>j.model),fail=(j,reason,status='failed')=>{for(const arm of ['A1','A2','A3'])save(j,arm,{status,reason,baseline_fallback:g.baseline?.probabilities??null,fallback_scored_as_ai:false});};
  if(!options.paid||providerBlocked||g.baseline?.status!=='forecast'||g.baseline.eligible!==true){for(const j of modelJobs)fail(j,!options.paid?'paid_execution_disabled':providerBlocked?'provider_preflight_or_contract_blocked':g.baseline?.status!=='forecast'?'baseline_unavailable':'baseline_ineligible');continue;}
  let evidence,initialProfiles;
  try{
   if(epochMicros(g.ko)-epochMicros(store.clock())<450000000n)throw Error('request_deadline');
   evidence=evidenceView(source,g.id,receipt);initialProfiles=(await preflight()).profiles;
   if(initialProfiles.length!==2||!MODELS.every(m=>initialProfiles.some(p=>p.model===m)))throw Error('model_profiles');
   if(store.reservedMicros()+initialProfiles.reduce((s,p)=>s+2*p.reserved_micros,0)>CEILING){for(const j of modelJobs)fail(j,'insufficient_balanced_bundle_budget','abstain');continue;}
   // Byte upper bound plus conservative message framing; never truncate history to fit.
   if(initialProfiles.some(p=>Buffer.byteLength(JSON.stringify(buildRequest('A3',p,evidence,store.clock()).body))+16384>p.context_length-1024)){for(const j of modelJobs)fail(j,'complete_evidence_exceeds_safe_context','abstain');continue;}
  }catch{providerBlocked=true;for(const j of modelJobs)fail(j,'source_or_provider_preflight_blocked');continue;}
  for(const j of modelJobs){
   const baseline=store.read(j.jid+':E-Refreshed'),ack=store.read(j.jid+':E-Refreshed:commit');
   if(baseline?.body?.status!=='forecast'||ack?.body?.status!=='accepted'){fail(j,'baseline_commit_unconfirmed');continue;}
   for(const arm of ['scout','A3']){
    let result,request;
    try{
     if(providerBlocked)throw Error('provider_blocked');
     const checked=await preflight(),profile=checked.profiles.find(p=>p.model===j.model);request=buildRequest(arm,profile,evidence,store.clock());
     if(Buffer.byteLength(JSON.stringify(request.body))+16384>profile.context_length-1024)throw Error('context_capacity');
     result=await client.execute(store,{id:'or:'+canonicalHash({job:j.jid,arm}),job:j.jid,request,profile},{...options,checkpoint,account:checked.account});
     if(result.halt)providerBlocked=true;
    }catch{providerBlocked=true;result={status:'failed',reason:'provider_or_budget_admission_failed'};}
    const common={model:j.model,model_version:'OpenRouter-private-v1',input_hash:output.input_hash,ai_evidence_hash:request?.input_hash??null,request_hash:request?.request_hash??null,generated_at_utc:store.clock(),generation_id:result.generation_id??null};
    if(result.status!=='response'||result.decision.abstain){for(const a of arm==='scout'?['A1','A2']:['A3'])save(j,a,{...common,status:result.status==='response'?'abstain':'failed',reason:result.decision?.reason??result.reason,baseline_fallback:g.baseline.probabilities,fallback_scored_as_ai:false});continue;}
    const d=result.decision;
    if(arm==='A3')save(j,'A3',{...common,status:'forecast',probabilities:d.probabilities,evidence_refs:d.evidence_refs});
    else{
     save(j,'A2',{...common,status:'forecast',veto:d.veto,evidence_refs:d.evidence_refs});
     try{
      let adjusted=g.baseline.prediction,contextHash=null;
      if(d.hm!==1||d.am!==1){
       const context=await engine({...packet,contexts:{[g.id]:{hm:d.hm,am:d.am}}});
       const c=context.predictions.find(r=>Number(r.fixture_id)===g.id);
       if(context.source_sha256!==output.source_sha256||canonicalHash(c?.prediction)!==canonicalHash(g.baseline.prediction)||!c?.a1?.prediction)throw Error('context baseline changed');
       adjusted=c.a1.prediction;contextHash=context.input_hash;
      }
      save(j,'A1',{...common,generated_at_utc:store.clock(),status:'forecast',probabilities:[adjusted.pW,adjusted.pD,adjusted.pL],prediction:adjusted,context_input_hash:contextHash,context:{hm:d.hm,am:d.am},evidence_refs:d.evidence_refs});
     }catch{save(j,'A1',{...common,status:'abstain',reason:'exact_context_baseline_unavailable',baseline_fallback:g.baseline.probabilities,fallback_scored_as_ai:false});}
    }
   }
  }
 }
 await checkpoint();return{session:cohort,jobs:groups.length*3,fixtures:groups.length,retained_liability_micros:store.reservedMicros(),provider_blocked:providerBlocked,paid_mode_requested:!!options.paid,synthetic_verification:synthetic};
}
