import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../test-support/synthetic.mjs';
const api=await import('../lib/asof-features.mjs').catch(()=>({}));
const issue='2026-10-20T12:00:00Z';
let seq=0;
function obs(fixture_id,field_name,value,at='2026-10-20T10:00:00Z',played=null) {return {observation_id:String(++seq),fixture_id:String(fixture_id),field_name,value,availability:'observed',observed_at_utc:at,received_at_utc:at,played_at_utc:played,effective_at_utc:null,source_kind:'collector',source_ref:'synthetic',source_hash:'a'.repeat(64),payload_hash:'b'.repeat(64),feature_schema_version:1};}
export function evidence(){
 const out=[];
 for(const [id,fields] of [[456,{home:'Alpha',away:'Beta',lid:39,date:'2026-10-21',time:'18:00',status:'NS',season:2026}], [123,{home:'Alpha',away:'Beta',lid:39,date:'2026-10-18',time:'18:00',status:'FINISHED',gh:2,ga:1,season:2026}]])
 for(const [k,v] of Object.entries(fields)) out.push(obs(id,k,v,'2026-10-20T10:00:00Z',id===123?'2026-10-18T18:00:00Z':null));
 return out;
}
test('as-of adapter rejects late xG/lineups even when mutable latest rows contain them',()=>{
 const inputs=api.buildAsOfInputs({snapshot:snapshot(),observations:[...evidence(),obs(123,'xg_h',9,'2026-10-20T13:00:00Z','2026-10-18T18:00:00Z'),obs(123,'lineup_h',{xi:[{id:7,pos:'G'}]},'2026-10-20T13:00:00Z','2026-10-18T18:00:00Z')],latestFixtures:[{fxid:123,xg_h:9}]});
 assert.equal(inputs.league.matches.length,1);
 assert.equal(inputs.league.matches[0]._x.xg_h,undefined);assert.equal(inputs.league.matches[0]._x.xi_h,undefined);
 assert.ok(inputs.missing.includes('123:xg_h'));assert.ok(inputs.manifest.excluded.length>=2);
});
test('pre-issue value version wins over later correction; unknown timing is excluded',()=>{
 const x=api.buildAsOfInputs({snapshot:snapshot(),observations:[...evidence(),obs(123,'xg_h',1.2,'2026-10-20T10:00:00Z','2026-10-18T18:00:00Z'),obs(123,'xg_h',9,'2026-10-20T13:00:00Z','2026-10-18T18:00:00Z'),{...obs(123,'xg_a',5),observed_at_utc:null,availability:'unknown',value:null}]});
 assert.equal(x.league.matches[0]._x.xg_h,1.2);assert.equal(x.league.matches[0]._x.xg_a,undefined);
});
test('microsecond receipts after issue cannot round down into eligible evidence',()=>{
 const x=api.buildAsOfInputs({snapshot:snapshot(),observations:[...evidence(),obs(123,'xg_h',9,'2026-10-20T12:00:00.000001Z','2026-10-18T18:00:00Z')]});
 assert.equal(x.league.matches[0]._x.xg_h,undefined);
});
test('adapter executes the actual existing M14 builder offline and yields known rest/history',()=>{
 const x=api.buildAsOfInputs({snapshot:snapshot(),observations:evidence()});
 const f=api.existingMatchFeatures(x);
 assert.equal(f.restH,3);assert.equal(f.restA,3);assert.equal(f.histH,1);assert.equal(f.histA,1);assert.equal(f.xgDiffH,null);
 assert.equal(x.manifest.implementation_hash.length,64);
 assert.equal(x.manifest.baseline_replay,'incomplete');
});
test('conflicting IDs, forged earlier observations and unsupported schema fail closed',()=>{
 const rows=evidence();
 assert.throws(()=>api.buildAsOfInputs({snapshot:snapshot(),observations:[...rows,{...rows[0],value:'other'}]}),/duplicate/);
 for(const patch of [{received_at_utc:'2026-10-20T13:00:00Z'},{feature_schema_version:2}]) {
  const x=api.buildAsOfInputs({snapshot:snapshot(),observations:[...rows, {...obs(123,'xg_h',9),...patch}]});
  assert.equal(x.league.matches[0]._x.xg_h,undefined);
 }
});
test('unproven target identity causes abstention instead of guessing names',()=>{
 const x=api.buildAsOfInputs({snapshot:snapshot(),observations:[]});
 assert.equal(x.fixture,null);assert.ok(x.missing.includes('456:home'));
});
test('historical outcome-derived fields require played-time provenance',()=>{
 const x=api.buildAsOfInputs({snapshot:snapshot(),observations:[...evidence(),obs(123,'xg_h',9)]});
 assert.equal(x.league.matches[0]._x.xg_h,undefined);
});
test('existing provider-form calculation uses only five eligible prior xG pairs',()=>{
 const rows=evidence().filter(o=>o.fixture_id==='456');
 for(let i=1;i<=5;i++) {
  const date=`2026-10-${String(i).padStart(2,'0')}`,played=date+'T18:00:00Z';
  for(const [k,v] of Object.entries({home:'Alpha',away:'Beta',lid:39,date,time:'18:00',status:'FINISHED',gh:2,ga:1,xg_h:1.4,xg_a:1,season:2026})) rows.push(obs(i,k,v,'2026-10-20T10:00:00Z',played));
 }
 const x=api.buildAsOfInputs({snapshot:snapshot(),observations:rows});
 const f=api.existingMatchFeatures(x);
 assert.ok(Math.abs(f.xgDiffH-.4)<1e-12);assert.ok(Math.abs(f.xgDiffA+.4)<1e-12);
 assert.equal(f.histH,5);
});
