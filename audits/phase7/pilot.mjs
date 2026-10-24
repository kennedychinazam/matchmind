// Capacity estimate only; never starts collection or increases a budget.
import {readFileSync}from 'node:fs';
const measured=JSON.parse(readFileSync(new URL('../phase4/results/2026-10-24-storage-forecast.json',import.meta.url)));
const phase6=JSON.parse(readFileSync(new URL('../phase6/results/2026-10-24-feasibility.json',import.meta.url)));
export function estimatePilot({days=7,bootstrapObservations=68400,repeatShare=0}={}){
 if(![7,14,28].includes(days)||!Number.isInteger(bootstrapObservations)||bootstrapObservations<0||!Number.isFinite(repeatShare)||repeatShare<0||repeatShare>1)throw Error('bounded pilot assumptions required');
 const predictions=days*2,fixtures=Math.ceil(days*30/7),components={historical_observations:0,manifests:0,training_examples:0,shadow_forecasts:0,outcome_labels:0,bookmaker_observations:0,indexes:0,operational:0};
 const fields=fixtures*36*(1+2*.05),obs=bootstrapObservations+fields;
 components.historical_observations=obs*measured.perObservation.data;components.indexes=obs*measured.perObservation.index;
 const blend=k=>repeatShare*measured.slopes.repeat[k]+(1-repeatShare)*measured.slopes.diverse[k];
 const scale=Math.max(1,bootstrapObservations/phase6.database.observations),growth=1+fixtures*12/(2*10500);
 components.manifests=predictions*blend('manifest_data')*scale*growth;components.indexes+=predictions*blend('manifest_index')*scale*growth;
 components.bookmaker_observations=predictions*measured.perOddsObservation.data;components.indexes+=predictions*measured.perOddsObservation.index;
 // Compact sample/label/artifact costs are conservative allowances, not measured football sizes.
 components.training_examples=predictions*2048+32768;components.shadow_forecasts=predictions*4096;components.outcome_labels=predictions*3*2048;
 components.operational=predictions*8*512+1048576;
 components.indexes+=predictions*(2048+2048+3*1024+8*128)+131072;
 components.manifests+=predictions*blend('snapshot_data');components.indexes+=predictions*blend('snapshot_index');
 const total=Object.values(components).reduce((s,v)=>s+v,0),planning=total*1.25;
 return{budget_bytes:262144000,budget_changed:false,issue_days:days,label_tail_days:7,maximum_predictions:predictions,
  assumptions:{bootstrap_observations:bootstrapObservations,repeat_share:repeatShare,full_competition_new_fixtures:fixtures,full_fields_per_fixture_assumption:36,correction_checks:2,changed_field_fraction:.05,
   preissue_odds_per_prediction:1,outcome_revisions_per_prediction:3,manifest_scale:scale,history_growth: growth,planning_multiplier:1.25,
   source:'Retained Phase4 observation/manifest slopes and Phase6 volume. No new empirical football polling or storage measurements.',
   exclusions:['WAL/catalogue/containers','private backups and export copies','new-source archive beyond the stated inventory','unbounded bloat'],
   integrity:'These field counts are estimates, never collection limits. Retain complete required evidence; halt enrollment if actual requirements exceed capacity.'},
  components_bytes:components,total_bytes:total,planning_bytes:planning,stop_at_bytes:209715200,preflight_pass:total<=209715200&&planning<=262144000,
  capacity_statements:{accuracy_powered:false,realistic_issue_volume:'Cap only; one competition may supply substantially fewer qualifying issues. No fixture/calendar API was queried.',
   launch_authorized:false,warning:'Signature/clock/source/publisher compatibility and actual inventory approval are prerequisites. This calculation is not permission to collect.'}};
}
