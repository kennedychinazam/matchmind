import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../phase6/resources.mjs').catch(()=>({}));
test('storage planning keeps 250 MiB shared ceiling and includes every shadow candidate',()=>{
 assert.equal(typeof api.projectStorage,'function');
 const phase4={budget_bytes:262144000,scenarios:[{name:'test',predictions_day:2,forecasts:[{days:30,components_bytes:{observations:100,indexes:20},planning_bytes:150,total_bytes:120}]}]};
 const out=api.projectStorage({phase4,dataPerJob:100,indexPerJob:50,initialShadowBytes:10,candidates:2});
 assert.equal(out.budget_bytes,262144000);assert.equal(out.scenarios[0].forecasts[0].shadow_data_bytes,12000);
 assert.equal(out.scenarios[0].forecasts[0].shadow_index_bytes,6000);
 assert.equal(out.scenarios[0].forecasts[0].total_planning_bytes,150+1.25*(18000+10));
 assert.throws(()=>api.projectStorage({phase4:{...phase4,budget_bytes:999},dataPerJob:1,indexPerJob:1,initialShadowBytes:0,candidates:1}),/budget/);
});
