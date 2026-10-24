import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../phase7/pilot.mjs').catch(()=>({}));
test('fixed-duration pilot prices complete lifecycle, all data classes and unchanged quota',()=>{
 assert.equal(typeof api.estimatePilot,'function');const p=api.estimatePilot({days:14,bootstrapObservations:68400});
 assert.equal(p.budget_bytes,262144000);assert.equal(p.maximum_predictions,28);assert.equal(p.label_tail_days,7);
 assert.equal(p.assumptions.preissue_odds_per_prediction,1);assert.equal(p.assumptions.outcome_revisions_per_prediction,3);
 assert.equal(p.capacity_statements.accuracy_powered,false);
 for(const k of ['historical_observations','manifests','training_examples','shadow_forecasts','outcome_labels','bookmaker_observations','indexes','operational'])assert.ok(Number.isFinite(p.components_bytes[k]));
 assert.equal(p.planning_bytes,p.total_bytes*1.25);
 assert.ok(api.estimatePilot({days:14,bootstrapObservations:150000}).preflight_pass===false);
 assert.throws(()=>api.estimatePilot({days:365,bootstrapObservations:1}),/bounded/);
});
