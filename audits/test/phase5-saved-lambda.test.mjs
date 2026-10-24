import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const api=await import('../phase5/saved-lambda.mjs').catch(()=>({}));
test('offline ablation executes existing grid with symmetric Poisson probabilities',()=>{
  assert.equal(typeof api.loadSavedLambdaGrid,'function');
  const grid=api.loadSavedLambdaGrid(readFileSync(new URL('../../index.html',import.meta.url),'utf8'));
  const p=grid.predict(1,1,0);
  assert.ok(Math.abs(p[0]-p[2])<1e-12);
  assert.ok(Math.abs(p.reduce((a,b)=>a+b)-1)<1e-12);
  assert.ok(Math.abs(p[1]-.3085083226)<1e-9);
  const corrected=grid.predict(1,1,-.08);
  assert.ok(corrected[1]>p[1]);
  assert.throws(()=>grid.predict(null,1,0),/lambda/);
});
