// Transparent arithmetic on measured local synthetic storage; never changes a database budget.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const evaluation=JSON.parse(readFileSync(process.argv[2]||'/tmp/mm-final-evaluation.json'));
const polling=JSON.parse(readFileSync(process.argv[3]||'/tmp/mm-storage-polls.json'));
const output=process.argv[4]||'/tmp/mm-storage-forecast.json';
function components(tables){const c={observations:0,manifests:0,snapshots:0,operational:0,shadow:0,indexes:0};for(const t of tables){assert.ok(t.index_bytes<=t.total_bytes);c[t.category]+=t.total_bytes-t.index_bytes;c.indexes+=t.index_bytes;}return c;}
const keys=['observations','manifests','snapshots','operational','shadow','indexes'];
const diff=(a,b)=>Object.fromEntries(keys.map(k=>[k,a[k]-b[k]]));
const byWorkload={};for(const w of ['repeat','diverse']){
 const get=phase=>components(evaluation.storage.find(x=>x.workload===w&&x.phase===phase).tables);
 const base=get('archive'),ten=get('predictions_10'),thirty=get('predictions_30');
 byWorkload[w]={base,after10:ten,after30:thirty,steady_per_prediction:Object.fromEntries(keys.map(k=>[k,Math.max(0,(thirty[k]-ten[k])/20)])),prefix_per_prediction:Object.fromEntries(keys.map(k=>[k,Math.max(0,(thirty[k]-base[k])/30)]))};
}
// Split index growth by category, rather than assigning observation indexes to manifests.
function categoryIndexes(tables,category){return tables.filter(t=>t.category===category).reduce((s,t)=>s+t.index_bytes,0);}
const archive=evaluation.storage.find(x=>x.workload==='repeat'&&x.phase==='archive');
const observedPollRates=polling.profiles.map(p=>{
 const a=components(p.after_first),b=components(p.after_twenty_more),n=p.persisted-600;
 return {nominal_percent:p.change_percent,persisted:p.persisted,attempted:p.attempted,new_versions_after_first:n,realized_changed_fraction:n/12000,bytes_per_changed_observation:n?{data:(b.observations-a.observations)/n,index:(b.indexes-a.indexes)/n}:null};
});
const seed=polling.profiles[0];const a=components(seed.initial),b=components(seed.after_first);
const perObservation={data:Math.max((b.observations-a.observations)/600,...observedPollRates.filter(p=>p.bytes_per_changed_observation).map(p=>p.bytes_per_changed_observation.data)),index:Math.max((b.indexes-a.indexes)/600,...observedPollRates.filter(p=>p.bytes_per_changed_observation).map(p=>p.bytes_per_changed_observation.index))};
const oa=components(polling.odds.after_first),ob=components(polling.odds.after_twenty_more);
const perOddsObservation={data:(ob.observations-oa.observations)/2000,index:(ob.indexes-oa.indexes)/2000};
const slopes={};for(const w of ['repeat','diverse']){
 const records=evaluation.storage.filter(s=>s.workload===w),get=p=>records.find(s=>s.phase===p).tables;
 slopes[w]={manifest_data:byWorkload[w].steady_per_prediction.manifests,manifest_index:(categoryIndexes(get('predictions_30'),'manifests')-categoryIndexes(get('predictions_10'),'manifests'))/20,snapshot_data:Math.max(byWorkload[w].steady_per_prediction.snapshots,byWorkload[w].prefix_per_prediction.snapshots),snapshot_index:Math.max((categoryIndexes(get('predictions_30'),'snapshots')-categoryIndexes(get('archive'),'snapshots'))/30,(categoryIndexes(get('predictions_30'),'snapshots')-categoryIndexes(get('predictions_10'),'snapshots'))/20),operational_data:Math.max(byWorkload[w].steady_per_prediction.operational,byWorkload[w].prefix_per_prediction.operational),operational_index:Math.max((categoryIndexes(get('predictions_30'),'operational')-categoryIndexes(get('archive'),'operational'))/30,0)};
}
const scenarios=[{name:'small shadow pilot',predictions_day:2,new_fixtures_day:2,interval_minutes:15,active_hours:6,changed_fraction:.01,repeat_share:.95,competition_groups:1},{name:'focused coverage',predictions_day:10,new_fixtures_day:10,interval_minutes:5,active_hours:6,changed_fraction:.05,repeat_share:.5,competition_groups:2},{name:'broad frequent collection',predictions_day:30,new_fixtures_day:30,interval_minutes:1,active_hours:12,changed_fraction:.10,repeat_share:.1,competition_groups:2}];
const base=components(archive.tables); // baseline references measured from successful snapshot envelopes in the evaluator
const initialRequiredReferences=10500; // rounded down from observed ~10.5k to make history growth conservative
const budget=262144000,planningReserve=1.25,initialFields=36,polledFields=6;
for(const s of scenarios){
 s.polls_per_fixture_day=s.active_hours*60/s.interval_minutes;s.odds_rows_per_poll=1;s.new_stat_observations_day=s.new_fixtures_day*(initialFields+s.polls_per_fixture_day*polledFields*s.changed_fraction);s.new_odds_observations_day=s.new_fixtures_day*s.polls_per_fixture_day*s.odds_rows_per_poll;s.new_observations_day=s.new_stat_observations_day+s.new_odds_observations_day;
 const blend=k=>slopes.repeat[k]*s.repeat_share+slopes.diverse[k]*(1-s.repeat_share);
 s.forecasts=[];
 function project(days){
  const factor=1+(.5*12*s.new_fixtures_day/s.competition_groups*days/initialRequiredReferences);
  const c={...base};c.observations+=days*(s.new_stat_observations_day*perObservation.data+s.new_odds_observations_day*perOddsObservation.data);c.manifests+=days*s.predictions_day*blend('manifest_data')*factor;c.snapshots+=days*s.predictions_day*blend('snapshot_data');c.operational+=days*s.predictions_day*blend('operational_data');
  c.indexes+=days*((s.new_stat_observations_day*perObservation.index+s.new_odds_observations_day*perOddsObservation.index)+s.predictions_day*(blend('manifest_index')*factor+blend('snapshot_index')+blend('operational_index')));
  const total=Object.values(c).reduce((a,b)=>a+b,0);return {days,components_bytes:c,total_bytes:total,planning_bytes:total*planningReserve,history_link_growth_factor:factor,within_250MiB_with_reserve:total*planningReserve<=budget};
 }
 for(const d of [30,90,180])s.forecasts.push(project(d));
 s.first_day_over_200MiB=null;s.first_day_over_250MiB=null;for(let d=0;d<=180;d++){const n=project(d).planning_bytes;if(n>200*1048576&&s.first_day_over_200MiB===null)s.first_day_over_200MiB=d;if(n>budget&&s.first_day_over_250MiB===null)s.first_day_over_250MiB=d;}
}
const result={units:'bytes; MiB=1048576 bytes',budget_bytes:budget,budget_changed:false,assumptions:{initial_fields_new_fixture:initialFields,polled_fields:polledFields,initial_required_references:initialRequiredReferences,new_required_refs_per_new_fixture:12,planning_reserve_multiplier:planningReserve,history_growth:'Average link-size factor = 1 + (12 * new fixtures/day / competition groups * horizon / initial reference count)/2',exclusions:['WAL','backups','Auth/other application tables','new leagues requiring an extra archive seed','AI prompts/responses','unbounded operational bloat'],warning:'Unconstrained required capacity, not permission or ability to exceed admission. Page slopes and fixed reuse shares are synthetic estimates, not validated 180-day upper bounds.'},base,perObservation,perOddsObservation,observedPollRates,slopes,scenarios};
writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
