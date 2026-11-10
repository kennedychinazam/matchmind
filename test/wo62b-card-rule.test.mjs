// WO62B approved daily-card policy, offline synthetic data only. No DOM/network/provider calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
function policy(){
  const from=source.indexOf('const CARD_MAX_CARDS_PER_FIXTURE');
  assert.ok(from>=0,'approved two-card selection policy is absent; current fixture-only exclusion rejects a legitimate second distinct selection');
  const to=source.indexOf('/* ══ BUILD 272',from);assert.ok(to>from,'policy boundary exists');
  return vm.runInNewContext(source.slice(from,to)+'\n({cardLegAllowed,cardPicksConflict,max:CARD_MAX_CARDS_PER_FIXTURE,table:CARD_PICK_CONFLICTS})');
}
test('daily-card policy allows a second distinct side/goals pick but never a repeated pick or third card',()=>{
  const p=policy();assert.equal(p.max,2);
  assert.equal(p.cardLegAllowed({'42':['1']},42,'O25'),true);
  assert.equal(p.cardLegAllowed({'42':['1']},'42','1'),false);
  assert.equal(p.cardLegAllowed({'42':['1','O25']},42,'NBT'),false);
  assert.equal(p.cardLegAllowed({'42':['1','O25']},43,'NBT'),true);
});
test('approved conflict families are symmetric and identical selections always conflict',()=>{
  const p=policy();const codes=['1','X','2','1X','X2','1D','2D','1/1','1/X','1/2','X/1','X/X','X/2','2/1','2/X','2/2','O15','O25','O35','BTS','U15','U25','U35','NBT'];
  for(const a of codes){assert.equal(p.cardPicksConflict(a,a),true,a+' duplicate');for(const b of codes)assert.equal(p.cardPicksConflict(a,b),p.cardPicksConflict(b,a),a+'/'+b+' symmetry');}
  for(const [a,b] of [['1','1X'],['1D','1'],['X','X2'],['2','2D'],['1/1','1'],['O15','O35'],['BTS','O25'],['U15','U35'],['NBT','U25']])assert.equal(p.cardPicksConflict(a,b),true,a+'/'+b);
  for(const [a,b] of [['1','O25'],['2D','BTS'],['X','U35'],['1/1','2/2']])assert.equal(p.cardPicksConflict(a,b),false,a+'/'+b+' approved distinct pair');
  assert.equal(p.cardPicksConflict(null,'1'),true);assert.equal(p.cardPicksConflict('1',''),true);
});
test('real card-loop prefilter exposes a valid alternative before one-selection-per-fixture eligibility',()=>{
  const render=source.slice(source.indexOf('function renderDailySlips(){'));
  const expression=render.match(/const _free = ([^;]+);/);assert.ok(expression,'real card-loop candidate filter');
  const candidates=[{f:{fxid:42},code:'1'},{f:{fxid:42},code:'1X'},{f:{fxid:42},code:'O25'},{f:{fxid:43},code:'BTS'}];
  const cardLegAllowed=source.includes('const CARD_MAX_CARDS_PER_FIXTURE')?policy().cardLegAllowed:undefined;
  const free=vm.runInNewContext(expression[1],{cands:candidates,_taken:new Set(['42']),_placed:{42:['1']},cardLegAllowed});
  assert.deepEqual(Array.from(free,c=>[c.f.fxid,c.code]),[[42,'O25'],[43,'BTS']]);
  assert.match(expression[1],/cardLegAllowed/,'caller must use selection-aware policy');
  assert.ok(render.indexOf(expression[0])<render.indexOf('dailyEligible(_free'),'filter applies before eligibility chooses one pick');
});
test('Banker, shared, frozen and freshly built paths all retain exact fixture selection codes',()=>{
  policy();const render=source.slice(source.indexOf('function renderDailySlips(){'));
  const from=render.indexOf('const _placed =');const to=render.indexOf('/* The Banker first.',from);
  assert.ok(from>=0&&to>from,'real selection-tracking accumulator exists');
  const accumulate=vm.runInNewContext(render.slice(from,to)+'\n({placed:_placed,take:_takeLegs})');
  const rows=[{fxid:42,code:'1'},{f:{fxid:42},code:'O25'},{fxid:43,code:'BTS'}];const before=JSON.stringify(rows);
  for(const row of rows)accumulate.take([row]);assert.deepEqual(Array.from(accumulate.placed['42']),['1','O25']);assert.equal(JSON.stringify(rows),before,'input cards never rewritten');
  for(const call of ['_takeLegs(_bk.legs)','_takeLegs(shared.legs)','_takeLegs(fz.legs)','_takeLegs(legs)'])assert.ok(render.includes(call),'missing historical/fresh path '+call);
});
