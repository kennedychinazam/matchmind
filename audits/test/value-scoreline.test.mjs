import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const distributionURL=new URL('../value-intelligence/scoreline.mjs',import.meta.url);
const marketURL=new URL('../value-intelligence/markets.mjs',import.meta.url);
async function api(){assert.ok(existsSync(distributionURL),'offline coherent distribution module required');assert.ok(existsSync(marketURL),'fourteen-market aggregator required');return {...await import(distributionURL),...await import(marketURL)};}
const references=JSON.parse(readFileSync(new URL('../test-support/value-scoreline-reference.json',import.meta.url)));
const near=(a,b,t=2e-11)=>assert.ok(Math.abs(a-b)<=t,`${a} differs from ${b} by ${Math.abs(a-b)}, tolerance ${t}`);
function identities(p){
 assert.equal(Object.keys(p).length,14);
 for(const v of Object.values(p))assert.ok(Number.isFinite(v)&&v>=0&&v<=1);
 near(p.HOME+p.DRAW+p.AWAY,1,2e-14);
 near(p.DC_1X,p.HOME+p.DRAW,2e-14);near(p.DC_12,p.HOME+p.AWAY,2e-14);near(p.DC_X2,p.DRAW+p.AWAY,2e-14);
 near(p.BTTS_YES+p.BTTS_NO,1,2e-14);
 for(const k of [1,2,3])near(p[`OVER_${k}_5`]+p[`UNDER_${k}_5`],1,2e-14);
 assert.ok(p.OVER_3_5<=p.OVER_2_5+1e-14&&p.OVER_2_5<=p.OVER_1_5+1e-14&&p.BTTS_YES<=p.OVER_1_5+1e-14);
}
test('scoreline mathematics agrees with independent 75-digit decimal references',async()=>{
 const {scorelineDistribution,marketProbabilities}=await api();
 for(const c of references.cases){const d=scorelineDistribution(c.parameters),p=marketProbabilities(d);identities(p);for(const[k,v]of Object.entries(c.reference))near(p[k],Number(v),d.error.eventProbabilityAllowance);}
});
test('zero-rate degenerate distributions preserve impossible events and complements',async()=>{
 const {scorelineDistribution,marketProbabilities}=await api();
 const z=marketProbabilities(scorelineDistribution({lambdaHome:0,lambdaAway:0}));assert.equal(z.DRAW,1);assert.equal(z.HOME,0);assert.equal(z.AWAY,0);assert.equal(z.OVER_1_5,0);assert.equal(z.BTTS_NO,1);
 const one=marketProbabilities(scorelineDistribution({lambdaHome:0,lambdaAway:2}));assert.equal(one.HOME,0);assert.equal(one.BTTS_YES,0);near(one.DRAW,Math.exp(-2));
 const tiny=marketProbabilities(scorelineDistribution({lambdaHome:1e-100,lambdaAway:0}));assert.ok(tiny.HOME>0);assert.equal(tiny.AWAY,0);
});
test('tiny possible totals survive both subtraction cancellation and premature support cutoff',async()=>{
 const {scorelineDistribution,marketProbabilities}=await api();
 const tiny=marketProbabilities(scorelineDistribution({lambdaHome:1e-6,lambdaAway:1e-6}));
 assert.ok(tiny.OVER_2_5>1.3e-18&&tiny.OVER_2_5<1.4e-18);
 // Full Poisson(2e-6) four-goal mass is approximately (2e-6)^4/24;
 // unlike the former 0..3 rectangle, this includes the 4-0 and 0-4 cells.
 assert.ok(tiny.OVER_3_5>6.66e-25&&tiny.OVER_3_5<6.67e-25);
 const one=marketProbabilities(scorelineDistribution({lambdaHome:1e-100,lambdaAway:0}));assert.ok(one.OVER_1_5>4.9e-201&&one.OVER_1_5<5.1e-201);
 const cutoff=scorelineDistribution({lambdaHome:1e-4,lambdaAway:0}),p=marketProbabilities(cutoff);assert.ok(cutoff.support.homeMax>=4);assert.ok(p.OVER_3_5>4.16e-18&&p.OVER_3_5<4.17e-18);
 const high=marketProbabilities(scorelineDistribution({lambdaHome:20,lambdaAway:20}));assert.ok(high.UNDER_1_5>0);identities(tiny);identities(p);identities(high);
});
test('adaptive tails track omitted mass instead of hiding truncation during normalization',async()=>{
 const {scorelineDistribution,marketProbabilities}=await api();
 for(const params of [{lambdaHome:20,lambdaAway:20},{lambdaHome:0.1,lambdaAway:9},{lambdaHome:2,lambdaAway:3,rho:-.08}]){
  const d=scorelineDistribution(params,{tailTolerance:1e-10});
  assert.ok(d.error.analyticTailUpperBound<=1e-10);assert.ok(d.normalization.retainedMass>0&&d.normalization.retainedMass<=1+d.error.floatingPointAllowance);
  assert.ok(1-d.normalization.retainedMass<=d.error.analyticTailUpperBound+d.error.floatingPointAllowance);
  assert.ok(d.error.eventProbabilityAllowance>=d.error.analyticTailUpperBound+d.error.floatingPointAllowance);
  const p=marketProbabilities(d);identities(p);assert.equal(d.actionable,false);assert.equal(d.calibration,'not_validated');
 }
 const coarse=scorelineDistribution({lambdaHome:20,lambdaAway:20},{tailTolerance:1e-4}),fine=scorelineDistribution({lambdaHome:20,lambdaAway:20},{tailTolerance:1e-14});
 assert.ok(fine.support.homeMax>coarse.support.homeMax);assert.ok(fine.support.awayMax>coarse.support.awayMax);
 const c=marketProbabilities(coarse),f=marketProbabilities(fine);for(const k of Object.keys(c))near(c[k],f[k],coarse.error.eventProbabilityAllowance+fine.error.eventProbabilityAllowance);
});
test('closed-form Poisson totals and BTTS independently verify seeded rate properties and exchange symmetry',async()=>{
 const {scorelineDistribution,marketProbabilities}=await api();let state=20261026;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
 for(let n=0;n<300;n++){
  const h=random()*20,a=random()*20,d=scorelineDistribution({lambdaHome:h,lambdaAway:a}),p=marketProbabilities(d),swap=marketProbabilities(scorelineDistribution({lambdaHome:a,lambdaAway:h}));identities(p);
  near(p.HOME,swap.AWAY);near(p.DRAW,swap.DRAW);near(p.BTTS_YES,(-Math.expm1(-h))*(-Math.expm1(-a)),d.error.eventProbabilityAllowance);
  for(const k of [1,2,3]){let cdf=0;for(let i=0;i<=k;i++){let factorial=1;for(let j=2;j<=i;j++)factorial*=j;cdf+=Math.exp(-(h+a))*(h+a)**i/factorial;}near(p[`UNDER_${k}_5`],cdf,d.error.eventProbabilityAllowance);}
 }
});
test('Dixon-Coles changes only four low cells without a positivity clamp or invalid fallback',async()=>{
 const {scorelineDistribution,marketProbabilities}=await api();
 const h=1.8,a=1.4,rho=-.08,base=marketProbabilities(scorelineDistribution({lambdaHome:h,lambdaAway:a})),p=marketProbabilities(scorelineDistribution({lambdaHome:h,lambdaAway:a,rho})),shift=h*a*rho*Math.exp(-h-a);
 near(p.HOME,base.HOME+shift);near(p.AWAY,base.AWAY+shift);near(p.DRAW,base.DRAW-2*shift);near(p.BTTS_YES,base.BTTS_YES-shift);near(p.OVER_2_5,base.OVER_2_5);
 for(const r of [-1,.5,NaN,Infinity])assert.throws(()=>scorelineDistribution({lambdaHome:2,lambdaAway:2,rho:r}));
 for(let i=1;i<=60;i++){const h=i/5,a=(61-i)/5,r=-.5/Math.max(h,a);const p=marketProbabilities(scorelineDistribution({lambdaHome:h,lambdaAway:a,rho:r}));identities(p);}
});
test('invalid parameters, impossible numerical precision and insufficient support fail explicitly',async()=>{
 const {scorelineDistribution}=await api();
 for(const lambdaHome of [-1,20.01,NaN,Infinity,'1',null,undefined])assert.throws(()=>scorelineDistribution({lambdaHome,lambdaAway:1}));
 for(const options of [{tailTolerance:0},{tailTolerance:1e-16},{tailTolerance:1},{maxGoals:257},{maxGoals:1.5},{madeUp:true}])assert.throws(()=>scorelineDistribution({lambdaHome:1,lambdaAway:1},options));
 assert.throws(()=>scorelineDistribution({lambdaHome:20,lambdaAway:20},{maxGoals:12}),/support|tail/i);
 assert.throws(()=>scorelineDistribution({lambdaHome:1,lambdaAway:1,engine:1}));
});
test('market aggregation rejects corrupt mass, nonrectangular support and invalid cell coordinates',async()=>{
 const {scorelineDistribution,marketProbabilities}=await api(),d=scorelineDistribution({lambdaHome:1,lambdaAway:2});
 const corrupt=structuredClone(d);corrupt.cells[0].probability+=.1;assert.throws(()=>marketProbabilities(corrupt));
 const missing=structuredClone(d);missing.cells.pop();assert.throws(()=>marketProbabilities(missing));
 const duplicate=structuredClone(d);duplicate.cells[1]=duplicate.cells[0];assert.throws(()=>marketProbabilities(duplicate));
 const negative=structuredClone(d);negative.cells[0].probability=-.1;assert.throws(()=>marketProbabilities(negative));
 const nonfinite=structuredClone(d);nonfinite.cells[0].probability=NaN;assert.throws(()=>marketProbabilities(nonfinite));
 assert.throws(()=>marketProbabilities({cells:[]}));
});
test('identical numeric inputs replay deterministically without mutating inputs or allowing output mutation',async()=>{
 const {scorelineDistribution,marketProbabilities}=await api(),params={lambdaHome:1.8,lambdaAway:1.4},options={tailTolerance:1e-12},before=structuredClone({params,options});
 const a=scorelineDistribution(params,options),b=scorelineDistribution(params,options);assert.deepEqual(a,b);assert.deepEqual({params,options},before);
 assert.throws(()=>{a.cells[0].probability=1;});const m=marketProbabilities(a);assert.throws(()=>{m.HOME=1;});
});
