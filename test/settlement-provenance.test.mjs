/* Build 357 settlement-provenance regressions (Issue #7, finding F6).
   Loads the real index.html in Chromium and calls its own settlement functions. Deterministic,
   offline: every request off 127.0.0.1 is aborted. No provider call, no backend, no paid request,
   no archive read. Nothing here regrades or writes anything. */
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

/* Resolve Chromium from whatever the host already has. Nothing is downloaded. */
function loadChromium(){
  const require = createRequire(import.meta.url);
  for(const id of ['playwright','playwright-core']){
    try{ return require(id).chromium; }catch{}
  }
  for(const p of ['/opt/node-tools/node_modules/playwright/index.js']){
    try{ return require(p).chromium; }catch{}
  }
  return null;
}
function browserPath(){
  for(const p of [process.env.MM_TEST_CHROMIUM, '/opt/pw-browsers/chromium',
                  '/usr/bin/chromium', '/usr/bin/google-chrome'])
    if(p && existsSync(p)) return p;
  return null;
}
const chromium = loadChromium();
const exe = browserPath();
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
  await _page.waitForFunction(()=>typeof settledScore === 'function' && typeof unsettled90 === 'function',
    null, {timeout:60000});
  return _page;
}

/* The nine score shapes the Director named, plus a no-final-score row and legacy league history. */
const SHAPES = [
  {id:'clean FT',                     row:{status:'FT',  gh:2, ga:0, ft_h:2,  ft_a:0},  via:'ft',         settled:'2-0'},
  {id:'clean AET',                    row:{status:'AET', gh:3, ga:2, ft_h:2,  ft_a:2},  via:'ft',         settled:'2-2'},
  {id:'clean PEN',                    row:{status:'PEN', gh:1, ga:1, ft_h:1,  ft_a:1},  via:'ft',         settled:'1-1'},
  {id:'AET, ft pair missing',         row:{status:'AET', gh:3, ga:2, ft_h:null, ft_a:null}, via:'unresolved'},
  {id:'AET, ft pair half missing',    row:{status:'AET', gh:3, ga:2, ft_h:2,  ft_a:null},   via:'unresolved'},
  {id:'AET, ft exceeds the final',    row:{status:'AET', gh:2, ga:1, ft_h:3,  ft_a:1},      via:'unresolved'},
  {id:'AET, ft non-integer',          row:{status:'AET', gh:3, ga:2, ft_h:2.5, ft_a:2},     via:'unresolved'},
  {id:'AET, ft negative',             row:{status:'AET', gh:3, ga:2, ft_h:-1, ft_a:2},      via:'unresolved'},
  {id:'PEN, ft pair missing',         row:{status:'PEN', gh:1, ga:1, ft_h:null, ft_a:null}, via:'unresolved'},
  {id:'legacy league FT, no ft pair', row:{status:'FT',  gh:2, ga:1, ft_h:null, ft_a:null}, via:'final',  settled:'2-1'},
  {id:'legacy FT, ft impossible',     row:{status:'FT',  gh:1, ga:1, ft_h:5,  ft_a:5},      via:'final',  settled:'1-1'},
  {id:'no final score at all',        row:{status:'FT',  gh:null, ga:null, ft_h:null, ft_a:null}, via:'final'},
  {id:'not finished',                 row:{status:'NS',  gh:null, ga:null, ft_h:null, ft_a:null}, via:'final'}
];

test('every score shape settles the way it should, and extra time without a 90-minute pair fails closed', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  const seen = await page.evaluate(shapes => shapes.map(s => {
    const score = settledScore(s.row);
    const row = settledRow(s.row);
    return {id:s.id, via:score.via,
            settledAs: row.gh==null||row.ga==null ? null : row.gh+'-'+row.ga,
            unresolved: unsettled90(row),
            rawKept: row.raw_gh!=null && row.raw_ga!=null ? row.raw_gh+'-'+row.raw_ga : null,
            sourceUntouched: s.row.gh===score.fgh || score.fgh==null};
  }), SHAPES);
  for(let i=0;i<SHAPES.length;i++){
    const want = SHAPES[i], got = seen[i];
    assert.equal(got.via, want.via, want.id+' via');
    if(want.via === 'unresolved'){
      assert.equal(got.settledAs, null, want.id+' must yield no 90-minute score');
      assert.equal(got.unresolved, true, want.id+' must be marked unresolved');
      assert.equal(got.rawKept, want.row.gh+'-'+want.row.ga, want.id+' must preserve the raw final');
    } else {
      assert.equal(got.unresolved, false, want.id+' must not be marked unresolved');
      if(want.settled) assert.equal(got.settledAs, want.settled, want.id+' settled score');
    }
  }
});

test('an ordinary finished league match with no fulltime pair keeps working', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  // This is the case that must NOT be rejected: most of the historical corpus is FT rows whose
  // ft pair was never backfilled, and for a match that ended at 90 minutes the final score IS
  // the 90-minute score.
  const seen = await page.evaluate(()=>{
    const legacy = [
      {status:'FT', gh:0, ga:0, ft_h:null, ft_a:null},
      {status:'FT', gh:4, ga:3, ft_h:null, ft_a:null},
      {status:'FINISHED', gh:1, ga:0, ft_h:null, ft_a:null}   // a long-form alias
    ];
    return legacy.map(r => { const s = settledRow(r);
      return {settled: s.gh+'-'+s.ga, unresolved: unsettled90(s),
              graded: gradePick('1', actualCode(s.gh,s.ga), s.gh, s.ga)}; });
  });
  assert.deepEqual(seen.map(x=>x.settled), ['0-0','4-3','1-0']);
  assert.deepEqual(seen.map(x=>x.unresolved), [false,false,false]);
  assert.deepEqual(seen.map(x=>x.graded), ['miss','hit','hit']);
});

test('the refusal never invents a result, and never grades one', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  const seen = await page.evaluate(()=>{
    const row = settledRow({status:'AET', gh:3, ga:2, ft_h:null, ft_a:null});
    // Before build 357 this row settled 3-2 and a home Draw No Bet graded `hit`. The truth is
    // that the tie was level at 90 minutes, so the market voids.
    return {
      unresolved: unsettled90(row),
      gh: row.gh, ga: row.ga,
      // `actualCode(null,null)` returns 'X', which is exactly why every consumer that could
      // reach it is guarded rather than relying on the null alone.
      actualCodeOfNulls: actualCode(row.gh, row.ga),
      // nothing may treat the row as a finished score
      isFinishedScore: isFinishedScore(Object.assign({}, row)),
      // and the raw provider values are still there, unaltered
      rawFinal: row.raw_gh + '-' + row.raw_ga,
      extraTimePair: row.fgh===undefined ? null : row.fgh + '-' + row.fga
    };
  });
  assert.equal(seen.unresolved, true);
  assert.equal(seen.gh, null);
  assert.equal(seen.ga, null);
  assert.equal(seen.actualCodeOfNulls, 'X', 'documents why the consumer guards are necessary');
  assert.equal(seen.isFinishedScore, false, 'an unresolved row must never read as a finished score');
  assert.equal(seen.rawFinal, '3-2', 'the raw final is preserved for display and audit');
});

test('the source row handed in is never mutated', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  const seen = await page.evaluate(()=>{
    const original = {status:'AET', gh:3, ga:2, ft_h:null, ft_a:null, fxid:1234};
    const before = JSON.stringify(original);
    settledScore(original); settledRow(original); unsettled90(settledRow(original));
    return {before, after: JSON.stringify(original)};
  });
  assert.equal(seen.after, seen.before, 'settlement must not write back onto the provider row');
});

test('an unresolved row joins neither a result map nor the training corpus', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  const seen = await page.evaluate(()=>{
    // The shape every res-map consumer builds, and the shape the corpus push builds.
    const rows = [
      {fxid:1, status:'FT',  gh:2, ga:0, ft_h:2, ft_a:0, date:'2026-10-01', home:'A', away:'B'},
      {fxid:2, status:'AET', gh:3, ga:2, ft_h:null, ft_a:null, date:'2026-10-02', home:'C', away:'D'},
      {fxid:3, status:'AET', gh:3, ga:2, ft_h:2, ft_a:2, date:'2026-10-03', home:'E', away:'F'}
    ];
    const res = {};
    for(const f of rows){ const s = settledRow(f); if(!unsettled90(s)) res[f.fxid] = s; }
    const corpus = [];
    for(const r of rows){ const s = settledRow(r);
      if(!unsettled90(s)) corpus.push({date:r.date, home:r.home, away:r.away, hg:s.gh, ag:s.ga}); }
    return {mapKeys: Object.keys(res), corpusSize: corpus.length,
            corpusHasNullGoals: corpus.some(m => m.hg==null || m.ag==null),
            settledInMap: Object.values(res).map(s=>s.gh+'-'+s.ga)};
  });
  assert.deepEqual(seen.mapKeys, ['1','3'], 'fixture 2 must be omitted, not stored null');
  assert.equal(seen.corpusSize, 2);
  assert.equal(seen.corpusHasNullGoals, false,
    'a null-goal row would enter the fit as a phantom 0-0, because _accum reads hgOf(m) || 0');
  assert.deepEqual(seen.settledInMap, ['2-0','2-2']);
});

test('the engine would read a phantom 0-0 from a null-goal row, which is why the corpus is guarded', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  const seen = await page.evaluate(()=>{
    // Demonstrates the hazard the guard exists for, on the real engine accessors.
    const m = {date:'2026-10-02', home:'C', away:'D', hg:null, ag:null};
    return {hgOf: footballEngine.hgOf(m), agOf: footballEngine.agOf(m),
            coercedTo: (footballEngine.hgOf(m) || 0) + '-' + (footballEngine.agOf(m) || 0)};
  });
  assert.equal(seen.coercedTo, '0-0',
    'confirms the hazard: an unguarded null-goal row trains the fit as a goalless draw');
});

test('every settlement consumer in the file is guarded or provably safe', async t => {
  const lines = readFileSync(join(ROOT,'index.html'),'utf8').split(/\r?\n/);
  /* Every call site of settledRow/settledScore, excluding the definitions. A guard counts when it
     sits in the same statement or within the next few lines, which is how two of them are written. */
  const sites = [];
  lines.forEach((line, i) => {
    if(!/\b(settledRow|settledScore)\s*[({]/.test(line)) return;
    if(/^function\s+(settledRow|settledScore)/.test(line.trim())) return;
    sites.push({line: i+1, text: line.trim(), window: lines.slice(i, i+6).join('\n')});
  });
  assert.ok(sites.length >= 12, 'expected at least twelve call sites, found '+sites.length);

  /* Three sites are safe without naming the predicate, and each is named here with its reason so
     a future reader cannot mistake an omission for one of them. */
  const PROVEN_SAFE = [
    {match: /settledScore\(x\)/,                reason: 'loadAiShadow guards on s.gh == null and continues'},
    {match: /settledRow\(\{ status: f\.fixture/, reason: 'legacySettled settles a live provider response inline'},
    {match: /const s = settledScore\(r\), out =/, reason: 'inside settledRow itself'}
  ];
  /* The refusal is spelled two ways, one per layer: `unsettled90(row)` for a settled ROW, and
     `via === 'unresolved'` for a raw SCORE object, which carries no row marker. Both count. */
  const GUARD = /unsettled90|via === 'unresolved'/;
  const unguarded = sites.filter(s =>
    !GUARD.test(s.window) && !PROVEN_SAFE.some(p => p.match.test(s.text)));
  assert.deepEqual(unguarded.map(s=>s.line+': '+s.text.slice(0,70)), [],
    'every settlement consumer must refuse an unresolved settlement adjacently, or be listed as proven safe');

  /* And the two training-corpus pushes must be guarded, by name, because an unguarded null-goal
     row enters the fit as a phantom 0-0 rather than being skipped. */
  const corpusPushes = sites.filter(s => /L\.matches\.push|add\.push/.test(s.window));
  assert.ok(corpusPushes.length >= 2, 'expected both corpus pushes, found '+corpusPushes.length);
  for(const p of corpusPushes)
    assert.match(p.window, /unsettled90/, 'corpus push at line '+p.line+' must be guarded');
});

test('the patched page still boots clean on desktop and mobile', async t => {
  if(!ready) return t.skip(skip());
  const page = await enginePage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  const info = await page.evaluate(()=>({
    build: typeof APP_BUILD !== 'undefined' ? APP_BUILD : null,
    settlementFns: ['settledScore','settledRow','unsettled90','aetOf','aetText','gradePick']
      .every(n => typeof globalThis[n] === 'function'),
    extraTimeStatuses: typeof EXTRA_TIME_STATUS !== 'undefined' ? [...EXTRA_TIME_STATUS] : null,
    finished: [...FINISHED],
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    tabs: [...document.querySelectorAll('.nav-btn[data-view]')].map(b=>b.getAttribute('data-view'))
  }));
  assert.equal(info.settlementFns, true);
  assert.deepEqual(info.extraTimeStatuses, ['AET','PEN']);
  assert.deepEqual(info.finished, ['FT','AET','PEN'],
    'the finished vocabulary is unchanged: only the AET/PEN fallback behaviour moved');
  assert.deepEqual(info.tabs, ['scores','predict','tips','favs','data']);
  assert.equal(info.overflow, false);
  assert.deepEqual(errs, []);
  await page.setViewportSize({width:390, height:844});
  await page.waitForTimeout(600);
  const mobile = await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth + 2);
  assert.equal(mobile, false, 'no sideways scroll at phone width');
  assert.deepEqual(errs, []);
});

test('no statistical formula, market table or grading rule moved', async t => {
  const html = readFileSync(join(ROOT,'index.html'),'utf8');
  // Pinned so a settlement patch cannot quietly become a model change.
  assert.match(html, /const CALIB_SHIFT = \{ U35: -0\.0175 \};/);
  assert.match(html, /SHRINK_K_LEAGUE: 8,/);
  assert.match(html, /SHRINK_K_CUP: 32,/);
  assert.match(html, /RHO: -0\.08,/);
  assert.match(html, /const NEWCOMER = \{ MIN: 0\.85, FULL: 20 \};/);
  assert.match(html, /W: 1\.1672,/);
  assert.match(html, /K: \{ SAME: 1\.50, CROSS: 0\.75, ONE: 1\.50 \}/);
  assert.match(html, /if\(c === '1D'\) return actual==='1' \? 'hit' : actual==='X' \? 'void' : 'miss';/);
  assert.match(html, /const dnb = P\.pW \+ P\.pL;/);
  assert.match(html, /const lambdaH = Math\.max\(\.05, h\.attackHome \* a\.defenceAway \* avgH\);/);
});

test('release the shared browser and server', async t => {
  if(!ready) return t.skip(skip());
  if(_b) await _b.close();
  if(_s) _s.close();
});
