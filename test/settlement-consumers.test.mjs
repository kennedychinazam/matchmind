/* Behavioural regressions for the settlement consumers (Issue #7, PR #11 review R1-R3).
   These drive the REAL functions over real app state, rather than scanning source lines.
   Deterministic and offline: every request off 127.0.0.1 is aborted. No provider call, no
   backend, no paid request. Nothing is regraded and no archive is written. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync, existsSync} from 'node:fs';
import {join, extname, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {'.html':'text/html','.js':'text/javascript','.json':'application/json',
               '.png':'image/png','.webmanifest':'application/manifest+json'};
function loadChromium(){
  const require = createRequire(import.meta.url);
  for(const id of ['playwright','playwright-core','/opt/node-tools/node_modules/playwright/index.js']){
    try{ return require(id).chromium; }catch{}
  }
  return null;
}
function browserPath(){
  for(const p of [process.env.MM_TEST_CHROMIUM, '/opt/pw-browsers/chromium',
                  '/usr/bin/chromium', '/usr/bin/google-chrome'])
    if(p && existsSync(p)) return p;
  return null;
}
const chromium = loadChromium(), exe = browserPath();
const ready = !!(chromium && exe);
const skip = () => 'needs a local Chromium: set MM_TEST_CHROMIUM or install playwright-core';

let _b = null, _s = null, _page = null;
async function enginePage(){
  if(_page) return _page;
  const server = createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]);
    if(p === '/') p = '/index.html';
    const f = join(ROOT, p);
    if(!f.startsWith(ROOT) || !existsSync(f)){ res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, {'content-type': TYPES[extname(f)] || 'application/octet-stream'});
    res.end(readFileSync(f));
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  _s = server;
  const port = server.address().port;
  _b = await chromium.launch({executablePath: exe,
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking',
          '--disable-component-update','--disable-sync','--no-first-run']});
  const ctx = await _b.newContext({viewport:{width:1280,height:900}});
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:'+port) ? r.continue() : r.abort());
  _page = await ctx.newPage();
  await _page.goto('http://127.0.0.1:'+port+'/', {waitUntil:'load', timeout:60000});
  await _page.waitForFunction(()=>typeof fixtureResult === 'function' && typeof gradeFromHistory === 'function',
    null, {timeout:60000});
  return _page;
}

/* The scenario the Director asked to be replayed, built once and reused.
   A cup tie that was level 2-2 at 90 minutes and finished 3-2 after extra time, where the
   provider's fulltime pair is unusable, PLUS a stale cached history row written by a build
   before the refusal existed, which holds the post-extra-time final as if it were the result. */
const SCENARIO = `
  (() => {
    const FXID = 788036, DATE = '2026-10-27', HOME = 'Replay Home', AWAY = 'Replay Away';
    // the current provider row: AET, no usable 90-minute pair
    const providerRow = {fxid:FXID, date:DATE, time:'19:45', status:'AET',
                         gh:3, ga:2, ft_h:null, ft_a:null, home:HOME, away:AWAY};
    const settled = settledRow(providerRow);
    // the Scores map, as afScoresFromCloud builds it
    const smap = {}; smap[FXID] = Object.assign({
      fxid:FXID, date:DATE, time:'19:45', status:'AET', home:HOME, away:AWAY,
      gh:settled.gh, ga:settled.ga, settlement:settled.settlement,
      raw_gh:settled.raw_gh, raw_ga:settled.raw_ga}, aetOf(settled));
    // a STALE cached history row from a build before the refusal: the extra-time final, as hg/ag
    const L = {id:81, name:'Replay Cup', country:'Synthetic', sport:'football',
               matches:[{date:DATE, time:'19:45', home:HOME, away:AWAY, hg:3, ag:2, hth:1, hta:1}]};
    afState.leagues = {81: L}; afState.leagueOrder = [81];
    afState.cloudFix = {};
    const fixture = {fxid:FXID, date:DATE, time:'19:45', home:HOME, away:AWAY, status:'AET'};
    return {FXID, DATE, HOME, AWAY, providerRow, settled, smap, L, fixture};
  })()
`;

test('R1 replay: an unresolved 90-minute score is not overridden by stale cached history', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  const seen = await page.evaluate(`(() => {
    const S = ${SCENARIO};
    const res = fixtureResult(S.L, S.fixture, S.smap);
    // What a grader downstream would do with whatever came back.
    const graded = res && res.gh != null && res.ga != null
      ? gradePick('1D', actualCode(res.gh, res.ga), res.gh, res.ga) : null;
    return {
      settledUnresolved: unsettled90(S.settled),
      settledGoals: [S.settled.gh, S.settled.ga],
      rawFinalKept: [S.settled.raw_gh, S.settled.raw_ga],
      // the bypass: did the stale corpus row come back as a result?
      result: res ? {gh: res.gh, ga: res.ga} : null,
      gradedAs: graded
    };
  })()`);
  assert.equal(seen.settledUnresolved, true, 'the provider row must settle as unresolved');
  assert.deepEqual(seen.settledGoals, [null, null]);
  assert.deepEqual(seen.rawFinalKept, [3, 2], 'the extra-time final is preserved for display');
  // THE REGRESSION. Before the fix, fixtureResult fell through to L.matches and returned 3-2,
  // which graded a home Draw No Bet as `hit` on a tie that was level at 90 minutes.
  assert.equal(seen.result, null,
    'fixtureResult must withhold a result for a fixture whose 90-minute score is unavailable');
  assert.equal(seen.gradedAs, null, 'and nothing may be graded from it');
});

test('R1b replay: gradeFromHistory does not grade a record entry from stale cached history', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  const seen = await page.evaluate(`(() => {
    const S = ${SCENARIO};
    // a pending record entry for the same tie, as the device stores it
    afState.record = [{fxid:S.FXID, date:S.DATE, home:S.HOME, away:S.AWAY,
                       pick:'1D', prob:0.848, result:null, gh:null, ga:null}];
    gradeFromHistory();
    const r = afState.record[0];
    return {result: r.result, gh: r.gh, ga: r.ga};
  })()`);
  // Before the fix this wrote result '1' and 3-2 straight off the stale corpus row.
  assert.equal(seen.result, null, 'gradeFromHistory must leave the entry pending');
  assert.equal(seen.gh, null);
  assert.equal(seen.ga, null);
});

test('an ordinary finished match is still graded from cached history, as it always was', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  // The control. The refusal must be specific to the unresolved fixture, not a blanket
  // distrust of cached history, which the whole app depends on.
  const seen = await page.evaluate(()=>{
    const DATE = '2026-10-20';
    const L = {id:78, name:'Replay League', country:'Synthetic', sport:'football',
               matches:[{date:DATE, time:'19:45', home:'Ord Home', away:'Ord Away', hg:2, ag:0, hth:1, hta:0}]};
    afState.leagues = {78: L}; afState.leagueOrder = [78]; afState.cloudFix = {};
    afState.record = [{fxid:999001, date:DATE, home:'Ord Home', away:'Ord Away',
                       pick:'1', prob:0.7, result:null, gh:null, ga:null}];
    gradeFromHistory();
    const r = afState.record[0];
    const res = fixtureResult(L, {fxid:999001, date:DATE, home:'Ord Home', away:'Ord Away'}, {});
    return {recordResult: r.result, recordScore: [r.gh, r.ga],
            fixtureResult: res ? [res.gh, res.ga] : null};
  });
  assert.equal(seen.recordResult, '1', 'an ordinary cached result must still grade');
  assert.deepEqual(seen.recordScore, [2, 0]);
  assert.deepEqual(seen.fixtureResult, [2, 0], 'and fixtureResult must still read cached history');
});

test('R2: the legacy direct-provider path keeps the marker and the real final score', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  const seen = await page.evaluate(()=>{
    // The shape legacySettled receives: a raw API-Football fixture object. Invented, not fetched.
    const mk = (status, gh, ga, fth, fta) => ({
      fixture:{id:788048, date:'2026-10-27T19:45:00+00:00', status:{short:status}},
      teams:{home:{name:'Legacy Home'}, away:{name:'Legacy Away'}},
      goals:{home:gh, away:ga},
      score:{fulltime:{home:fth, away:fta}}
    });
    const unresolved = legacySettled(mk('AET', 3, 2, null, null));
    const cleanAet   = legacySettled(mk('AET', 3, 2, 2, 2));
    const normalFt   = legacySettled(mk('FT',  2, 0, 2, 0));
    const legacyFt   = legacySettled(mk('FT',  2, 1, null, null));
    return {
      unresolved: {gh:unresolved.gh, ga:unresolved.ga, settlement:unresolved.settlement||null,
                   raw:[unresolved.raw_gh===undefined?null:unresolved.raw_gh,
                        unresolved.raw_ga===undefined?null:unresolved.raw_ga],
                   marked: unsettled90(unresolved)},
      cleanAet: {gh:cleanAet.gh, ga:cleanAet.ga, aet:aetText(cleanAet), marked:unsettled90(cleanAet)},
      normalFt: {gh:normalFt.gh, ga:normalFt.ga, marked:unsettled90(normalFt)},
      legacyFt: {gh:legacyFt.gh, ga:legacyFt.ga, marked:unsettled90(legacyFt)}
    };
  });
  // The refusal survives the legacy transform, so the no-backend feed can be truthful.
  assert.equal(seen.unresolved.marked, true, 'legacySettled must preserve the unresolved marker');
  assert.equal(seen.unresolved.gh, null);
  assert.deepEqual(seen.unresolved.raw, [3, 2], 'and the real final score, for display');
  // Everything else is untouched.
  assert.equal(seen.cleanAet.gh, 2, 'a clean AET still settles on the 90-minute score');
  assert.equal(seen.cleanAet.aet, 'AET 3–2');
  assert.equal(seen.cleanAet.marked, false);
  assert.deepEqual([seen.normalFt.gh, seen.normalFt.ga], [2, 0]);
  assert.equal(seen.normalFt.marked, false);
  assert.deepEqual([seen.legacyFt.gh, seen.legacyFt.ga], [2, 1], 'legacy FT keeps the fallback');
  assert.equal(seen.legacyFt.marked, false);
});

test('the shared result map withholds an unresolved fixture from every reader', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  const seen = await page.evaluate(()=>{
    const rows = [
      {fxid:1, status:'FT',  gh:2, ga:0, ft_h:2, ft_a:0, date:'2026-10-01', home:'A', away:'B'},
      {fxid:2, status:'AET', gh:3, ga:2, ft_h:null, ft_a:null, date:'2026-10-02', home:'C', away:'D'},
      {fxid:3, status:'PEN', gh:1, ga:1, ft_h:1, ft_a:1, date:'2026-10-03', home:'E', away:'F'}
    ];
    const res = {};
    for(const f of rows){ const s = settledRow(f); if(!unsettled90(s)) res[f.fxid] = s; }
    // what a reader does with a fixture that is absent from the map
    const absent = res[2] === undefined;
    const graded = Object.keys(res).map(k => {
      const s = res[k];
      return {fxid:k, grade: gradePick('1D', actualCode(s.gh, s.ga), s.gh, s.ga)};
    });
    return {absent, keys:Object.keys(res), graded};
  });
  assert.equal(seen.absent, true, 'the unresolved fixture must be absent, not stored null');
  assert.deepEqual(seen.keys, ['1','3']);
  // 1 finished 2-0 so a home DNB hits; 3 was level at 90 so it voids. Both correct.
  assert.deepEqual(seen.graded.map(g=>g.grade), ['hit', 'void']);
});

test('the 48-hour late-void rule is untouched', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  /* `pickPlayedLate` requires a FINISHED fixture carrying goals; an earlier version of this test
     passed neither and read false for both cases, which was my error, not the app's. */
  const seen = await page.evaluate(()=>({
    hours: VOID_AFTER_HOURS,
    late: pickPlayedLate({kickoff:'2026-10-01', ktime:'19:45'},
            {status:'FT', gh:2, ga:0, date:'2026-10-10', time:'19:45'}),
    onTime: pickPlayedLate({kickoff:'2026-10-01', ktime:'19:45'},
            {status:'FT', gh:2, ga:0, date:'2026-10-01', time:'21:00'}),
    // an unresolved fixture has no goals, so the late rule declines to judge it either way
    unresolvedNotJudged: pickPlayedLate({kickoff:'2026-10-01', ktime:'19:45'},
            {status:'AET', gh:null, ga:null, date:'2026-10-10', time:'19:45'})
  }));
  assert.equal(seen.hours, 48);
  assert.equal(seen.late, true);
  assert.equal(seen.onTime, false);
  assert.equal(seen.unresolvedNotJudged, false,
    'the late rule needs a score, so an unresolved fixture is neither graded nor late-voided');
});

test('R4: a plausible but wrong fulltime pair is a declared residual, not a fixed case', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  /* Build 320 audited 128 extra-time rows and found 7 where the provider's `fulltime` already
     carried the final score. Such a pair is integer, non-negative and no greater than the final,
     so it passes every field check. This test PINS that it still settles as via:'ft' rather than
     pretending the patch catches it, so nobody later reads the suite as a correctness claim. */
  const seen = await page.evaluate(()=>{
    // the contaminated shape: 3-2 after extra time, with fulltime ALSO recorded as 3-2
    const contaminated = {status:'AET', gh:3, ga:2, ft_h:3, ft_a:2};
    const honest       = {status:'AET', gh:3, ga:2, ft_h:2, ft_a:2};
    const c = settledScore(contaminated), h = settledScore(honest);
    const cr = settledRow(contaminated), hr = settledRow(honest);
    return {
      contaminated: {via:c.via, settled:cr.gh+'-'+cr.ga, marked:unsettled90(cr),
                     grade: gradePick('1D', actualCode(cr.gh, cr.ga), cr.gh, cr.ga)},
      honest: {via:h.via, settled:hr.gh+'-'+hr.ga, marked:unsettled90(hr),
               grade: gradePick('1D', actualCode(hr.gh, hr.ga), hr.gh, hr.ga)}
    };
  });
  // The residual, stated as a fact about this patch rather than hidden.
  assert.equal(seen.contaminated.via, 'ft',
    'a plausible but wrong pair still passes; only goal events could catch it');
  assert.equal(seen.contaminated.settled, '3-2');
  assert.equal(seen.contaminated.marked, false);
  assert.equal(seen.contaminated.grade, 'hit', 'and it still grades, which is the declared limit');
  // The honest pair, for contrast, settles on the 90 minutes and voids the DNB.
  assert.equal(seen.honest.settled, '2-2');
  assert.equal(seen.honest.grade, 'void');
});

test('R7: newer confirmed fulltime recovers while old and undated replays cannot override', async t => {
  if(!ready) return t.skip(skip());
  const page=await enginePage();
  const seen=await page.evaluate(()=>{
    const id=990771, d='2026-10-27', home='Recovery H', away='Recovery A';
    const f={fxid:id,date:d,home,away,status:'AET'};
    const L={matches:[{date:d,home,away,hg:3,ag:2}]};
    const row=(at,fh,fa)=>({fxid:id,date:d,home,away,status:'AET',gh:3,ga:2,
      ft_h:fh,ft_a:fa,updated_at:at});
    const first=settledRow(row('2026-10-27T22:00:00Z',null,null));
    const old=settledRow(row('2026-10-27T21:00:00Z',2,2));
    const undated=settledRow(row(null,2,2));
    const before=fixtureResult(L,f,{[id]:old});
    const corrected=settledRow(row('2026-10-27T22:05:00Z',2,2));
    const after=fixtureResult(L,f,{[id]:corrected});
    afState.leagues={81:L};afState.leagueOrder=[81];afState.cloudFix={};
    afState.record=[{fxid:id,date:d,home,away,pick:'1D',result:null,gh:null,ga:null}];
    gradeFromHistory();
    const grade={result:afState.record[0].result,gh:afState.record[0].gh,ga:afState.record[0].ga};
    const oldUnresolved=settledRow(row('2026-10-27T22:00:00Z',null,null));
    return {first:unsettled90(first),old:unsettled90(old),undated:unsettled90(undated),
      before:before&&[before.gh,before.ga],corrected:[corrected.gh,corrected.ga],
      after:after&&[after.gh,after.ga],afterAet:after&&[after.fgh,after.fga],
      grade,oldUnresolved:unsettled90(oldUnresolved),oldReplayScore:[oldUnresolved.gh,oldUnresolved.ga],
      oldReplayFinal:[oldUnresolved.fgh,oldUnresolved.fga],oldReplayAt:oldUnresolved.updated_at,
      blockedNow:unresolved90Fixture(id),afterOld:fixtureResult(L,f,{[id]:corrected})};
  });
  assert.equal(seen.first,true);
  assert.equal(seen.old,true);
  assert.equal(seen.undated,true);
  assert.equal(seen.before,null);
  assert.deepEqual(seen.corrected,[2,2]);
  assert.deepEqual(seen.after,[2,2]);
  assert.deepEqual(seen.afterAet,[3,2],'a corrected 90-minute score must preserve the AET final marker');
  assert.deepEqual(seen.grade,{result:'X',gh:2,ga:2},'cached 3-2 must not grade after authoritative correction');
  assert.equal(seen.oldUnresolved,false,'rejected old input projects the newer confirmed authority');
  assert.deepEqual(seen.oldReplayScore,[2,2]);assert.deepEqual(seen.oldReplayFinal,[3,2]);
  assert.equal(seen.oldReplayAt,'2026-10-27T22:05:00Z');
  assert.equal(seen.blockedNow,false,'old replay must not re-register stale refusal');
  assert.deepEqual([seen.afterOld.gh,seen.afterOld.ga],[2,2]);
});

test('R7: untimestamped legacy provider correction restores a confirmed 90-minute pair', async t => {
  if(!ready) return t.skip(skip());
  const page=await enginePage();
  const seen=await page.evaluate(()=>{
    const id=990772,base={fxid:id,status:'PEN',gh:1,ga:1,ft_h:null,ft_a:null};
    const a=settledRow(base), b=unresolved90Fixture(id);
    const c=settledRow({...base,ft_h:1,ft_a:1});
    return {wasUnresolved:unsettled90(a),wasBlocked:b,score:[c.gh,c.ga],
      blockedNow:unresolved90Fixture(id)};
  });
  assert.equal(seen.wasUnresolved,true);
  assert.equal(seen.wasBlocked,true);
  assert.deepEqual(seen.score,[1,1]);
  assert.equal(seen.blockedNow,false);
});


for(const kind of ['older timestamped','undated']) test('confirmed predecessor rejects '+kind+' score in direct grading and history consumers',async t=>{
  if(!ready)return t.skip(skip());
  const page=await enginePage();
  const seen=await page.evaluate(kind=>{
    return ['AET','PEN'].map((status,i)=>{
      const id=991000+(kind==='undated'?10:0)+i;
      const row={fxid:id,status,date:'2026-10-27',home:'Ordering H',away:'Ordering A',gh:3,ga:2,
        ft_h:2,ft_a:2,updated_at:'2026-10-27T22:05:00Z'};
      const incoming={...row,gh:4,ft_h:3,updated_at:kind==='undated'?null:'2026-10-27T22:00:00Z'};
      const before=JSON.stringify([row,incoming]);settledRow(row);const direct=settledRow(incoming);
      const fixture={fxid:id,date:row.date,home:row.home,away:row.away,status};
      const L={matches:[{date:row.date,home:row.home,away:row.away,hg:3,ag:2}]};
      const result=fixtureResult(L,fixture,{[id]:direct});
      afState.leagues={81:L};afState.leagueOrder=[81];afState.cloudFix={};
      afState.record=[{...fixture,pick:'1D',result:null,gh:null,ga:null}];gradeFromHistory();
      return {direct:[direct.gh,direct.ga],raw:[direct.fgh,direct.fga],at:direct.updated_at,
        ft:[direct.ft_h,direct.ft_a],registry:verified90Fixture(id),result:result&&[result.gh,result.ga],
        directGrade:gradePick('1D',actualCode(direct.gh,direct.ga),direct.gh,direct.ga),
        history:afState.record[0].result,unchanged:before===JSON.stringify([row,incoming])};
    });
  },kind);
  for(const x of seen){assert.deepEqual(x.direct,[2,2]);assert.deepEqual(x.raw,[3,2]);
    assert.deepEqual(x.ft,[2,2]);assert.equal(x.at,'2026-10-27T22:05:00Z');
    assert.deepEqual([x.registry.gh,x.registry.ga],[2,2]);assert.deepEqual(x.result,[2,2]);
    assert.equal(x.directGrade,'void');assert.equal(x.history,'X');assert.equal(x.unchanged,true);}
});

test('observation decision explicitly distinguishes accepted/rejected and authoritative prior',async t=>{
  if(!ready)return t.skip(skip());const page=await enginePage();
  const x=await page.evaluate(()=>{
    const row={fxid:991100,status:'AET',gh:3,ga:2,ft_h:2,ft_a:2,updated_at:'2026-10-27T22:05:00Z'};
    const a=observe90Settlement(row,settledScore(row));
    const old={...row,ft_h:3,updated_at:'2026-10-27T22:00:00Z'},b=observe90Settlement(old,settledScore(old));
    return {a:{accepted:a.accepted,prior:a.prior,score:a.authoritative&&[a.authoritative.gh,a.authoritative.ga]},
      b:{accepted:b.accepted,score:b.authoritative&&[b.authoritative.gh,b.authoritative.ga],prior:b.prior&&[b.prior.gh,b.prior.ga]}};
  });
  assert.equal(x.a.accepted,true);assert.equal(x.a.prior,null);assert.deepEqual(x.a.score,[2,2]);
  assert.equal(x.b.accepted,false);assert.deepEqual(x.b.score,[2,2]);assert.deepEqual(x.b.prior,[2,2]);
});

test('equal-time confirmed contradictions fail closed and require a newer correction',async t=>{
  if(!ready)return t.skip(skip());const page=await enginePage();
  const x=await page.evaluate(()=>{
    const row={fxid:991101,status:'AET',gh:3,ga:2,ft_h:2,ft_a:2,updated_at:'2026-10-27T22:05:00Z'};
    settledRow(row);const same=settledRow({...row});const conflict=settledRow({...row,ft_h:3});
    const repeatedConflict=settledRow({...conflict});
    const replay=settledRow(row),blocked=unresolved90Fixture(row.fxid);
    const newer=settledRow({...row,ft_h:1,updated_at:'2026-10-27T22:06:00Z'});
    const other={...row,fxid:991103};settledRow(other);const rawConflict=settledRow({...other,gh:4});
    return {rawConflict:unsettled90(rawConflict),repeatedConflict:unsettled90(repeatedConflict),same:[same.gh,same.ga],conflict:unsettled90(conflict),replay:unsettled90(replay),blocked,
      newer:[newer.gh,newer.ga],recovered:!unresolved90Fixture(row.fxid)};
  });
  assert.equal(x.rawConflict,true);assert.equal(x.repeatedConflict,true);assert.deepEqual(x.same,[2,2]);assert.equal(x.conflict,true);assert.equal(x.replay,true);assert.equal(x.blocked,true);
  assert.deepEqual(x.newer,[1,2]);assert.equal(x.recovered,true);
});

test('rejected missing scores retain dated authority and repeated projections retain raw final',async t=>{
  if(!ready)return t.skip(skip());const page=await enginePage();
  const x=await page.evaluate(()=>{
    const row={fxid:991102,status:'AET',gh:3,ga:2,ft_h:2,ft_a:2,updated_at:'2026-10-27T22:05:00Z'};
    const first=settledRow(row),again=settledRow({...first});
    const missing=settledRow({...row,ft_h:null,ft_a:null,updated_at:null});
    const oldMissing=settledRow({...row,ft_h:null,ft_a:null,updated_at:'2026-10-27T22:00:00Z'});
    const alias={...row,fxid:991104};delete alias.updated_at;alias.updatedAt='2026-10-27T22:05:00Z';settledRow(alias);
    const rejected=settledRow({...alias,gh:1,ga:0,ft_h:1,ft_a:0,updated_at:'2026-10-27T22:00:00Z'});
    return {first,again,missing,oldMissing,registry:verified90Fixture(row.fxid),
      alias:{score:[rejected.gh,rejected.ga],final:[rejected.fgh,rejected.fga],at:rejected.updatedAt,
        staleAtPresent:Object.prototype.hasOwnProperty.call(rejected,'updated_at')}};
  });
  assert.deepEqual(x.alias,{score:[2,2],final:[3,2],at:'2026-10-27T22:05:00Z',staleAtPresent:false});
  for(const r of [x.first,x.again,x.missing,x.oldMissing,x.registry]){
    assert.deepEqual([r.gh,r.ga],[2,2]);assert.deepEqual([r.fgh,r.fga],[3,2]);
  }
});


test('a finished-status spelling cannot bypass a tracked fixture dated authority',async t=>{
  if(!ready)return t.skip(skip());const page=await enginePage();
  const seen=await page.evaluate(()=>{
    return ['FT','FINISHED'].flatMap((status,i)=>[null,'2026-10-27T22:00:00Z'].map((at,j)=>{
      const id=991200+i*10+j,prior={fxid:id,status:i?'PEN':'AET',gh:3,ga:2,ft_h:2,ft_a:2,updated_at:'2026-10-27T22:05:00Z'};
      settledRow(prior);const stale=settledRow({...prior,status,gh:4,ft_h:3,updated_at:at});
      return {score:[stale.gh,stale.ga],final:[stale.fgh,stale.fga],at:stale.updated_at,
        registry:verified90Fixture(id),grade:gradePick('1D',actualCode(stale.gh,stale.ga),stale.gh,stale.ga)};
    }));
  });
  for(const x of seen){assert.deepEqual(x.score,[2,2]);assert.deepEqual(x.final,[3,2]);assert.equal(x.at,'2026-10-27T22:05:00Z');assert.equal(x.grade,'void');assert.deepEqual([x.registry.gh,x.registry.ga],[2,2]);}
});
test('newer tracked FT corrections use unchanged FT fallback and keep consumers coherent',async t=>{
  if(!ready)return t.skip(skip());const page=await enginePage();
  const x=await page.evaluate(()=>{
    const base={fxid:991250,status:'AET',gh:3,ga:2,ft_h:2,ft_a:2,updated_at:'2026-10-27T22:05:00Z'};
    settledRow(base);
    const sameTime=settledRow({...base,status:'FT',ft_h:3});const blocked=unresolved90Fixture(base.fxid);
    const corrected=settledRow({...base,status:'FT',gh:1,ga:0,ft_h:null,ft_a:null,updated_at:'2026-10-27T22:06:00Z'});
    const registry=verified90Fixture(base.fxid),again=settledRow({...corrected});
    const missing=settledRow({...base,status:'FINISHED',gh:null,ga:null,ft_h:null,ft_a:null,updated_at:'2026-10-27T22:07:00Z'});
    const missingAgain=settledRow({...missing});
    return {missingAgain:unsettled90(missingAgain),sameTime:unsettled90(sameTime),blocked,corrected:[corrected.gh,corrected.ga],
      registry:[registry.gh,registry.ga],again:[again.gh,again.ga],missing:unsettled90(missing),
      blockedAfterMissing:unresolved90Fixture(base.fxid)};
  });
  assert.equal(x.missingAgain,true);assert.equal(x.sameTime,true);assert.equal(x.blocked,true);assert.deepEqual(x.corrected,[1,0]);assert.deepEqual(x.registry,[1,0]);assert.deepEqual(x.again,[1,0]);assert.equal(x.missing,true);assert.equal(x.blockedAfterMissing,true);
});
test('release the shared browser and server', async t => {
  if(!ready) return t.skip(skip());
  if(_b) await _b.close();
  if(_s) _s.close();
});
