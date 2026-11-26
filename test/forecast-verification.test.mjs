import test from 'node:test';
import assert from 'node:assert/strict';
import {datedForecastExpectation} from '../staging/mirror/forecast-verification.mjs';
const base={fxid:1552533,lid:62,home:'Harbor Athletic',away:'Granite United',date:'2026-11-21',time:'13:00',status:'FINISHED',gh:1,ga:2,ft_h:1,ft_a:2,
 prediction:{market:'Goals',pick:'U35',pick_prob:.777,kickoff:'2026-11-20',ktime:'19:00',made_at:'2026-11-17T23:51:38.476+00:00',withheld_at:null}};
test('a verified completed rescheduled goals forecast keeps a graded badge and exact original provenance',()=>{
 const before=JSON.stringify(base),e=datedForecastExpectation(base);assert.equal(e.badge,'U3.5 ✓');assert.equal(e.outcome,'Won');assert.equal(e.probability,'0.777');assert.equal(e.pendingBadge,'U3.5 · 78%');
 assert.equal(e.kickoff,'2026-11-20T19:00');assert.equal(e.publishedAt,base.prediction.made_at);assert.equal(JSON.parse(e.selectionKey)[1],1552533);assert.equal(JSON.stringify(base),before);
});
for(const [name,patch,prediction,badge,outcome] of [
 ['pending',{status:'NS'}, {},'U3.5 · 78%','Pending'],
 ['lost goals',{gh:3,ga:1,ft_h:3,ft_a:1},{},'U3.5 ✗','Lost'],
 ['won home',{gh:2,ga:0,ft_h:2,ft_a:0},{market:'Winner',pick:'1'},'1 ✓','Won'],
 ['lost away',{gh:2,ga:0,ft_h:2,ft_a:0},{market:'Winner',pick:'2'},'2 ✗','Lost'],
 ['DNB draw',{gh:1,ga:1,ft_h:1,ft_a:1},{market:'DNB',pick:'1D'},'1 DNB · Void','Void'],
 ['48-hour relocation',{date:'2026-11-22',time:'19:00'},{},'U3.5 · 78%','Unsettled'],
 ['unverified extra time',{status:'AET',ft_h:null,ft_a:null},{},'U3.5 · 78%','Pending'],
 ['withdrawn issued forecast',{}, {withheld_at:'2026-11-20T10:00:00Z'},'U3.5 · 78%',null]
])test(name+' uses verified results without replacing the issued selection',()=>{const e=datedForecastExpectation({...base,...patch,prediction:{...base.prediction,...prediction}});assert.equal(e.badge,badge);assert.equal(e.outcome,outcome);assert.equal(e.probability,'0.777');assert.equal(e.graded,['Won','Lost','Void'].includes(outcome));});
test('same-club fixtures and separately issued selections have distinct immutable identities',()=>{
 const original=datedForecastExpectation(base),otherFixture=datedForecastExpectation({...base,fxid:1552534}),otherPick=datedForecastExpectation({...base,prediction:{...base.prediction,pick:'O35'}});
 assert.notEqual(original.selectionKey,otherFixture.selectionKey);assert.notEqual(original.selectionKey,otherPick.selectionKey);assert.equal(original.probability,otherFixture.probability);
});
test('unknown graded markets fail explicitly instead of accepting an invented grade',()=>{assert.throws(()=>datedForecastExpectation({...base,prediction:{...base.prediction,pick:'UNKNOWN'}}),/Unsupported/);});
