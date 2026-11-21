// Build 362: three tiers (Strong / Lean / Toss-up) and Ken's Analysis order.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs'; import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const span=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,'boundary '+a);return html.slice(i,j);};
test('Strong bar is max(0.75, fitted bar); a published pick is re-asked with its issue bar',()=>{
  assert.match(html,/const STRONG_MIN = 0\.75;/);assert.match(html,/const LEAN_MIN = 0\.65;/);
  assert.match(html,/function strongBarFor\(L\)\{ return Math\.max\(STRONG_MIN, gateBarFor\(L\)\); \}/);
  assert.match(html,/ladderPick\(p, f\.home, f\.away, L, arch \? gateBarFor\(L\) : undefined\)/);
  assert.match(html,/gateReason\(L, f, lp\.code, lp\.prob, gateBarFor\(L\)\) : 'no market clears the bar'/);
});
test('Lean picks the first rung in [0.65, Strong bar) that clears the edge floor',()=>{
  const ctx={rungsFor:()=>[{code:'1',prob:0.6},{code:'1X',prob:0.7},{code:'O25',prob:0.66}],sharedBarKnown:()=>true,
    gateBarFor:()=>0.72,gateEdgeFor:()=>0,pickEdge:()=>0.05,pickMarket:c=>c==='1X'?'Double Chance':'Winner',Math};
  vm.createContext(ctx);vm.runInContext('const STRONG_MIN=0.75,LEAN_MIN=0.65;'+span('function strongBarFor(L)','function gateEdgeFor(L)')+span('function leanPickFor(','/* build 120')+';this.lp=leanPickFor;',ctx);
  assert.deepEqual({...ctx.lp({id:1},{},'H','A')},{code:'1X',prob:0.7,market:'Double Chance'});
  ctx.pickEdge=()=>-0.01; assert.equal(ctx.lp({id:1},{},'H','A'),null);
  ctx.pickEdge=()=>0.05; ctx.rungsFor=()=>[{code:'1',prob:0.8}]; assert.equal(ctx.lp({id:1},{},'H','A'),null);
});
test('Analysis order follows the priority list, favourites first, live first within a tier',()=>{
  const ctx={afState:{favL:[]},skillProven:()=>false,leaguePriority:()=>0,normStatus:s=>s,Date};
  vm.createContext(ctx);vm.runInContext(span('const ANALYSIS_TIER','let _edgeHidden')+';this.order=analysisOrder;',ctx);
  const soon=new Date(Date.now()+86400000).toISOString().slice(0,10);
  const L=(id,name,st='NS')=>({id,name,upcoming:[{date:soon,status:st}]});
  const ids=[[667,'Club Friendlies'],[10,'Friendlies'],[253,'MLS'],[88,'Eredivisie'],[45,'FA Cup'],[531,'UEFA Super Cup'],[5,'Nations League'],[29,'WCQ CAF'],[32,'WCQ UEFA'],[20,'CAF Conf'],[12,'CAF CL'],[848,'UECL'],[3,'UEL'],[39,'EPL'],[2,'UCL'],[1,'World Cup'],[233,'Egypt'],[19,'CHAN'],[960,'Euro Q']];
  const got=ids.map(([i,n])=>L(i,n)).sort(ctx.order).map(x=>x.id);
  assert.deepEqual(got,[1,2,39,3,848,12,20,32,29,5,960,531,45,88,233,19,253,10,667]);
  ctx.afState.favL=[253];assert.equal([L(2,'UCL'),L(253,'MLS')].sort(ctx.order)[0].id,253);
  ctx.afState.favL=[];assert.equal([L(140,'LaLiga'),L(39,'EPL','2H')].sort(ctx.order)[0].id,39);
  assert.doesNotMatch(span('function visibleLeagues','TAB NAVIGATION'),/return Ls\.sort\(\(a,b\)=> \(skillProven/);
});
test('Lean SQL freezes rows and stays off the closed display envelope',()=>{
  const up=readFileSync(new URL('../release/lean-tiers/LEAN-TIERS-up.sql',import.meta.url),'utf8');
  assert.match(up,/before insert or update or delete on public\.lean_picks/);
  assert.match(up,/grant mm_display_materializer to postgres with set false, inherit false;/);
  assert.match(up,/public\.matchmind_leans_v1\(\)/); assert.doesNotMatch(up,/create or replace function mm_fixture_delivery\.display/i);
});
