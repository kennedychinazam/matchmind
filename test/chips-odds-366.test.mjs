// Build 366: short Analysis chips, the reason on the match page, and odds from the edition.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs'; import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const span=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,'boundary '+a);return html.slice(i,j);};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('Lean chip: compact code and percentage, "Lean" on a second line, no team names, no pop-up',()=>{
  const ctx={escapeHtml:esc,GOAL_MARKETS:{O25:{short:'O2.5'},U35:{short:'U3.5'}},Math,String};vm.createContext(ctx);
  vm.runInContext(span('function chipCode(code)','function pickMarket(')+span('function leanCode(c)','function leanDetailChip(')+';this.lc=leanChip;',ctx);
  const f={home:'A Very Long Home Team Name FC',away:'Another Long Away Side'};
  assert.equal(ctx.lc(f,{c:'2D',q:.654}),'<span class="predchip lean">2DNB · 65%<span class="tier">Lean</span></span>');
  assert.equal(ctx.lc(f,{c:'O25',q:.7}),'<span class="predchip lean">O2.5 · 70%<span class="tier">Lean</span></span>');
  assert.doesNotMatch(ctx.lc(f,{c:'1X',q:.66}),/Home Team|title=/);
});
test('the list chip reads "No pick" and the old reason labels are gone from the list',()=>{
  const fx=span('function fxCells(L,f,smap)','let _toastT=null;');
  assert.match(html,/const NO_PICK_CHIP = '<span class="predchip muted-chip nopick">No pick<\/span>';/);
  assert.doesNotMatch(fx,/pickStatusChip\(|TOSSUP_CHIP|GATE_TEXT\[/,'the list still builds a long status');
  assert.match(span('function dnbVoidChip(pick)','function fxCells('),/forecastStatusChip\('Void',/);
});
test('the match page explains a no-pick fixture with the existing reason texts',()=>{
  const r=span('function noPickReason(L, f)','function fxCells(');
  for(const k of ['PICK_STATUS.withheld.why','pickStatusWhy(','GATE_WHY[','Too close to call'])assert.ok(r.includes(k),k);
  assert.match(html,/const why=kind==='prediction'&&!f\._pickUnavailable\?noPickReason\(L,f\):'';/);
});
test('public odds: one edition read, never a price taken after kick-off, merged into the one store',()=>{
  const ctx={Number,isFinite};vm.createContext(ctx);
  vm.runInContext(span("const PUBLIC_ODDS_KEYS","let _publicOdds")+span('function publicOddsRow(o)','function publicOddsEnsure(')+';this.row=publicOddsRow;',ctx);
  assert.equal(ctx.row({f:7,k:-1,h:2}),null,'a post-kick capture was accepted');
  assert.equal(ctx.row({f:7,k:5,h:0.5}),null,'an impossible price was accepted');
  assert.deepEqual({...ctx.row({f:7,k:30,h:2.1,o25:1.9})}.h,2.1);
  assert.match(html,/supa\.rpc\('matchmind_odds_v1', \{\}\)/);
  assert.match(span('async function dailyOddsLoad(day, fxids)','/* ══ BUILD 342'),/!fixtureRawCurrent\(\) && !isPublisher\(\)[\s\S]*publicOddsMerge/);
});
test('odds SQL: additive edition key, closed envelope untouched, role membership given back',()=>{
  const up=readFileSync(new URL('../release/odds-display/ODDS-DISPLAY-up.sql',import.meta.url),'utf8');
  const down=readFileSync(new URL('../release/odds-display/ODDS-DISPLAY-down.sql',import.meta.url),'utf8');
  assert.match(up,/mins_to_kick>=0/);assert.match(up,/public\.matchmind_odds_v1\(\)/);
  assert.doesNotMatch(up,/prices\)|,prices,|s\.\*/,'per-book prices projected');
  assert.doesNotMatch(up,/create or replace function mm_fixture_delivery\.display/i);
  assert.match(up,/grant mm_display_materializer to postgres with set false, inherit false;/);
  assert.match(down,/drop function public\.matchmind_odds_v1\(\);/);
  assert.doesNotMatch(up+down,/API key/i);
});
test('Build 366 ships the client and the service worker together',()=>{
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const b=+html.match(/const APP_BUILD = (\d+);/)[1];assert.ok(b>=366);assert.ok(sw.includes("'matchmind-v"+b+"'"));
});
