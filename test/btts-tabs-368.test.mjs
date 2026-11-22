// Build 368: independent Tips tabs (per-market bars), no Under 2.5 or BTTS No in new issuance, X2 and 1D
// calibration shifts, the away-DNB Lean skip, and BTTS / Over legs in the slip generator from issued Tips.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs'; import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const span=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,'boundary '+a);return html.slice(i,j);};
const engine=()=>{ const ctx={Math}; vm.createContext(ctx);
  vm.runInContext(span('const CALIB_SHIFT =','function allSelections(')+span('function rungsFor(P){','/* BUILD 146')
    +span('const TIP_BARS =','function tipRankedRows(')+';this.rungsFor=rungsFor;this.tmp=tipMarketPick;this.cal=calibrate;',ctx); return ctx; };

test('source: shifts, tab bars, slip markets, winner tab markets',()=>{
  assert.match(html,/const CALIB_SHIFT = \{ U35: -0\.03, X2: -0\.015, '1D': -0\.015 \};/);
  assert.match(html,/const TIP_BARS = \{ BTS: 0\.62, O25: 0\.60, O35: 0\.60, U35: 0\.77 \};/);
  assert.match(html,/const BOARD_WINNER_TAB_MARKETS = \['Winner', 'Double Chance', 'Draw No Bet'\];/);
  assert.match(html,/const SLIP_BOARD_MARKETS = \['1X2', 'DC', 'DNB', 'OU25', 'OU35', 'BTTS'\];/);
  assert.match(html,/\['ou','Goals'\]/);
  assert.ok(!/R\('U25'/.test(span('function rungsFor(P){','/* BUILD 146')),'no Under 2.5 rung');
  assert.ok(!/R\('NBT'/.test(span('function rungsFor(P){','/* BUILD 146')),'no BTTS No rung');
  assert.ok(!html.includes("['1 & Under 2.5'"),'no Under 2.5 combo row');
});
test('the ladder: result rungs, then the best of O2.5, U3.5 and BTTS Yes, calibrated',()=>{
  const c=engine();
  const P={pW:0.125,pD:0.175,pL:0.70,over:{2.5:0.30,3.5:0.10},btts:0.40};
  const r=c.rungsFor(P).map(x=>x.code+':'+x.prob.toFixed(4));
  assert.equal(JSON.stringify(r),JSON.stringify(['2:0.7000','2D:0.8485','X2:0.8600','U35:0.8700']));   // U2.5 (0.70) and BTTS No (0.60) are gone
  assert.equal(+c.cal('1D',0.8).toFixed(4),0.785); assert.equal(c.cal('2D',0.8),0.8); assert.equal(c.cal('1X',0.8),0.8);
});
test('Goals and BTTS tabs: each market at its own bar, never Under 2.5 or BTTS No',()=>{
  const c=engine();
  assert.equal(c.tmp('btts',{btts:0.619}),null);
  assert.equal(c.tmp('btts',{btts:0.63}).code,'BTS');
  assert.equal(c.tmp('btts',{btts:0.30}),null);                                   // a strong "No" is not listed
  assert.equal(c.tmp('ou',{over:{2.5:0.20,3.5:0.05}}).code,'U35');              // 0.95-0.03 clears 0.77
  assert.equal(c.tmp('ou',{over:{2.5:0.45,3.5:0.25}}),null);                    // U3.5 0.72 < 0.77, Over 2.5 0.45
  assert.equal(c.tmp('ou',{over:{2.5:0.66,3.5:0.40}}).code,'O25');
  assert.equal(c.tmp('ou',{over:{2.5:0.35,3.5:0.10}}).code,'U35');              // never U2.5 even at 0.65
});
test('Lean passes over an away Draw No Bet and asks the next rung',()=>{
  const ctx={rungsFor:()=>[{code:'2',prob:0.55},{code:'2D',prob:0.70},{code:'X2',prob:0.72}],sharedBarKnown:()=>true,
    gateBarFor:()=>0.75,gateEdgeFor:()=>0,pickEdge:()=>0.05,pickMarket:c=>c==='X2'?'Double Chance':'Winner',Math,xrComp:()=>false};
  vm.createContext(ctx);vm.runInContext('const STRONG_MIN=0.75,LEAN_MIN=0.65;'+span('function strongBarFor(L)','function gateEdgeFor(L)')+span('function leanPickFor(','/* build 120')+';this.lp=leanPickFor;',ctx);
  assert.deepEqual({...ctx.lp({id:1},{},'H','A')},{code:'X2',prob:0.72,market:'Double Chance'});
  ctx.rungsFor=()=>[{code:'1',prob:0.55},{code:'1D',prob:0.70}];
  assert.equal(ctx.lp({id:1},{},'H','A').code,'1D');
});
