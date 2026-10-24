// Planning arithmetic only; no budgets are changed and no trial is launched.
export function projectStorage({phase4,dataPerJob,indexPerJob,initialShadowBytes,candidates}){
 if(phase4.budget_bytes!==262144000)throw Error('unexpected shared budget');
 if(![dataPerJob,indexPerJob,initialShadowBytes].every(x=>Number.isFinite(x)&&x>=0)||!Number.isInteger(candidates)||candidates<1)throw Error('invalid storage inputs');
 return {budget_bytes:262144000,budget_changed:false,candidates,data_per_job:dataPerJob,index_per_job:indexPerJob,initial_shadow_bytes:initialShadowBytes,
  interpretation:'Unconstrained synthetic capacity forecast, not permission to exceed admission. Phase 4 polling/diversity assumptions retained; no new measured polling slopes.',
  scenarios:phase4.scenarios.map(s=>({name:s.name,predictions_day:s.predictions_day,forecasts:s.forecasts.map(f=>{
   const jobs=f.days*s.predictions_day*candidates,shadow_data_bytes=jobs*dataPerJob,shadow_index_bytes=jobs*indexPerJob;
   const total=f.planning_bytes+1.25*(initialShadowBytes+shadow_data_bytes+shadow_index_bytes);
   return {days:f.days,existing_components_bytes:f.components_bytes,shadow_data_bytes,shadow_index_bytes,total_planning_bytes:total,within_250MiB:total<=262144000};
  })}))};
}
