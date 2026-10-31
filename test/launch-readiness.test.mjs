/* Launch-readiness regressions for Build 355, 31 October 2026.
   Drives the real index.html in Chromium over a local static server. It never reaches the
   network: every request off 127.0.0.1 is aborted, which is also the exact condition the
   first-visit defect needs. No provider call, no backend write, no paid request. */
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

/* The browser driver is whatever the host already has: the audits workflow exports
   MM_TEST_CHROMIUM, the cloud image ships one at /opt/pw-browsers/chromium, and the publisher
   robot pins playwright-core. Nothing here downloads a browser. */
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
function serve(){
  const server = createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]);
    if(p === '/') p = '/index.html';
    const f = join(ROOT, p);
    if(!f.startsWith(ROOT) || !existsSync(f)){ res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {'content-type': TYPES[extname(f)] || 'application/octet-stream',
                        'service-worker-allowed': '/'});
    res.end(readFileSync(f));
  });
  return new Promise(ok => server.listen(0,'127.0.0.1',()=>ok({server, port: server.address().port})));
}

/* The release build, read from the source rather than pinned twice. Task 4's whole point is that
   APP_BUILD and the service-worker cache name move together, so the test derives one and compares
   the other against it. */
const APP_HTML = readFileSync(join(ROOT,'index.html'),'utf8');
const SW_JS = readFileSync(join(ROOT,'sw.js'),'utf8');
const RELEASE_BUILD = Number(/const APP_BUILD = (\d+)/.exec(APP_HTML)[1]);

const chromium = loadChromium();
const exe = browserPath();
const ready = !!(chromium && exe);
const skip = () => 'needs a local Chromium: set MM_TEST_CHROMIUM or install playwright-core';

/* Opens the app with every off-host request aborted, optionally pre-seeding localStorage or
   defining a stub window.supabase before the page scripts run. */
const FLAGS = ['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking',
  '--disable-component-update','--disable-sync','--no-first-run','--no-default-browser-check'];
let _browser = null, _srv = null;
async function host(){
  if(!_srv) _srv = await serve();
  if(!_browser) _browser = await chromium.launch({executablePath: exe, args: FLAGS});
  return {port: _srv.port};
}
async function shutdown(){
  if(_browser){ await _browser.close(); _browser = null; }
  if(_srv){ _srv.server.close(); _srv = null; }
}
async function open({port, stubSdk=false, seed=null, viewport={width:390,height:844}}){
  const browser = _browser;
  const ctx = await browser.newContext({viewport, isMobile:true, hasTouch:true});
  await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:'+port)
    ? r.continue() : r.abort());
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  if(stubSdk)
    await page.addInitScript(()=>{ window.supabase = { createClient(){ throw new Error('offline stub'); } }; });
  if(seed)
    await page.addInitScript(s => { try{ for(const [k,v] of Object.entries(s)) localStorage.setItem(k,v); }catch{} }, seed);
  await page.goto('http://127.0.0.1:'+port+'/', {waitUntil:'load', timeout:60000});
  await page.waitForTimeout(2500);
  return {browser, ctx, page, pageErrors};
}

test('a first visit with no key and no backend never sits on "Loading matches…"', async t => {
  if(!ready) return t.skip(skip());
  const {port} = await host();
  {
    const {ctx, page, pageErrors} = await open({port});
    const seen = await page.evaluate(()=>({
      meta: document.getElementById('scoresMeta').textContent,
      rows: document.getElementById('scoresList').children.length,
      sdk: typeof window.supabase,
      client: typeof supa !== 'undefined' && supa !== null,
      key: typeof afState !== 'undefined' ? afState.key : null
    }));
    // The exact state the defect needed: no SDK, no client, no saved key.
    assert.equal(seen.sdk, 'undefined');
    assert.equal(seen.client, false);
    assert.equal(seen.key, '');
    // The regression itself. Before the fix this read "Loading matches…" for ever.
    assert.notEqual(seen.meta.trim(), 'Loading matches…');
    assert.match(seen.meta, /unavailable|cannot reach the server/i);
    assert.equal(seen.rows, 0);
    assert.deepEqual(pageErrors, []);
    await ctx.close();
  }
});

test('the SDK loading but failing to give a client is reported as configuration, not network', async t => {
  if(!ready) return t.skip(skip());
  const {port} = await host();
  {
    const {ctx, page} = await open({port, stubSdk:true});
    const meta = await page.evaluate(()=>document.getElementById('scoresMeta').textContent);
    assert.match(meta, /unavailable/i);
    assert.match(meta, /no data source/i, 'with window.supabase present the reason must not blame the network');
    await ctx.close();
  }
});

test('a saved API-Football key still takes the legacy path, not the no-source branch', async t => {
  if(!ready) return t.skip(skip());
  const {port} = await host();
  {
    // The fix must only fire when BOTH sources are absent. With a key present the app keeps
    // its own behaviour, so the new branch must not have swallowed it.
    /* The key lives inside the `mm_state` blob under `afKey`, which is what `saveState` writes.
       `restoreState` bails on `!s.fb.length`, so the blob needs one match row for the key to be
       restored at all: two synthetic fixtures in the shape the CSV loader produces. */
    const {ctx, page} = await open({port, seed:{mm_state: JSON.stringify({
      afKey:'synthetic-launch-test-key',
      fb:[{date:'2026-01-10', home:'Synthetic A', away:'Synthetic B', hg:1, ag:0},
          {date:'2026-01-17', home:'Synthetic B', away:'Synthetic A', hg:2, ag:2}]
    })}});
    const seen = await page.evaluate(()=>({
      key: typeof afState !== 'undefined' ? afState.key : null,
      field: (document.getElementById('afKey')||{}).value,
      meta: document.getElementById('scoresMeta').textContent
    }));
    assert.equal(seen.field, 'synthetic-launch-test-key', 'the seeded key must have been restored');
    assert.doesNotMatch(seen.meta, /cannot reach the server/i,
      'a user with a key must not be told the server is unreachable by the no-source branch');
    await ctx.close();
  }
});

test('the app boots as the release build on a phone viewport with no errors and no sideways scroll', async t => {
  if(!ready) return t.skip(skip());
  const {port} = await host();
  {
    const {ctx, page, pageErrors} = await open({port});
    const info = await page.evaluate(()=>({
      build: typeof APP_BUILD !== 'undefined' ? APP_BUILD : null,
      lang: document.documentElement.lang,
      viewport: (document.querySelector('meta[name=viewport]')||{}).content || null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      broken: [...document.images].filter(i=>i.complete && i.naturalWidth===0).length,
      tabs: [...document.querySelectorAll('.nav-btn[data-view]')].map(b=>b.getAttribute('data-view')),
      sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller)
    }));
    assert.equal(info.build, RELEASE_BUILD);
    assert.equal(info.lang, 'en');
    assert.match(info.viewport, /width=device-width/);
    assert.equal(info.overflow, false);
    assert.equal(info.broken, 0);
    assert.deepEqual(info.tabs, ['scores','predict','tips','favs','data']);
    assert.equal(info.sw, true);
    assert.deepEqual(pageErrors, []);
    await ctx.close();
  }
});

test('every bottom-nav tab renders an empty state rather than a blank screen', async t => {
  if(!ready) return t.skip(skip());
  const {port} = await host();
  {
    const {ctx, page} = await open({port});
    for(const view of ['scores','predict','tips','favs','data']){
      await page.click('.nav-btn[data-view="'+view+'"]');
      await page.waitForTimeout(900);
      const text = await page.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').trim());
      assert.ok(text.length > 60, view+' rendered almost nothing: '+JSON.stringify(text.slice(0,120)));
      assert.doesNotMatch(text, /Loading matches…/, view+' still shows the loading placeholder');
    }
    await ctx.close();
  }
});

/* Draw No Bet is a CONDITIONAL probability, P(win | not a draw). The number is honest only while
   the market stays named next to it, so the labelling is pinned here. This asserts the existing
   Build 355 wording; it changes no formula. */
test('Draw No Bet stays named wherever it is shown, and a drawn DNB grades as void', async t => {
  if(!ready) return t.skip(skip());
  const {port} = await host();
  {
    const {ctx, page} = await open({port});
    const seen = await page.evaluate(()=>({
      label: pickLabel('1D','Home','Away'),
      away: pickLabel('2D','Home','Away'),
      chip: chipCode('1D'),
      market: pickMarket('1D'),
      drawn: gradePick('1D','X',1,1),
      won: gradePick('1D','1',2,1),
      lost: gradePick('1D','2',0,1),
      // The conditional itself: P(win | no draw) must exceed the outright win probability.
      conditional: (()=>{ const pW=0.15, pD=0.20, pL=0.65; return pL/(pW+pL); })()
    }));
    assert.equal(seen.label, 'Home (Draw No Bet)');
    assert.equal(seen.away, 'Away (Draw No Bet)');
    assert.equal(seen.chip, '1 DNB');
    assert.equal(seen.market, 'Draw No Bet');
    assert.equal(seen.drawn, 'void');
    assert.equal(seen.won, 'hit');
    assert.equal(seen.lost, 'miss');
    // 81.3% conditional against a 65.0% outright: the gap a user must not read as the same number.
    assert.ok(seen.conditional > 0.81 && seen.conditional < 0.82, String(seen.conditional));
    await ctx.close();
  }
});

test('no provider or AI credential is embedded in the shipped page', async t => {
  const html = APP_HTML;
  // The Supabase publishable key is meant to ship and is RLS-gated. Nothing else may.
  assert.equal(/eyJ[A-Za-z0-9_-]{20,}\./.test(html), false, 'a JWT is embedded in the page');
  assert.equal(/sk-[A-Za-z0-9_-]{16,}/.test(html), false, 'an AI provider key is embedded');
  assert.equal(/sk_live|sb_secret|service_role/.test(html), false, 'a secret-tier key is embedded');
  // The API-Football key is the user's own, read from the input, never shipped.
  assert.match(html, /const afState = \{ key:''/, 'afState.key must ship empty');
});


/* ── Build 356 corrections ────────────────────────────────────────────────────────────────── */

test('the release build and the service-worker cache move together', async t => {
  // A mismatch is what traps a returning device on an old version: mmVersionWatch compares
  // APP_BUILD against the matchmind-v<n> it reads out of sw.js over the network, so if the two
  // ever drift the banner either never appears or appears for ever.
  const cache = /const CACHE = 'matchmind-v(\d+)';/.exec(SW_JS);
  assert.ok(cache, 'sw.js must declare a matchmind-v<n> cache name');
  assert.equal(Number(cache[1]), RELEASE_BUILD,
    'APP_BUILD and the sw.js cache version must be the same number');
  assert.ok(RELEASE_BUILD > 355, 'the release build must be ahead of Build 355');
  // The watcher and its reload banner must still be present and compare against APP_BUILD.
  assert.match(APP_HTML, /fetch\('\.\/sw\.js\?cb=' \+ Date\.now\(\), \{ cache: 'no-store' \}\)/);
  assert.match(APP_HTML, /\+m\[1\] > APP_BUILD/);
  assert.match(APP_HTML, /is available — tap to reload/);
  // sw.js must never answer its own version probe out of the cache.
  assert.match(SW_JS, /if\(SW_PATH_RE\.test\(url\.pathname\)\)\{ e\.respondWith\(fetch\(e\.request\)\); return; \}/);
});

test('the product describes statistical forecasts, not AI predictions', async t => {
  const manifest = readFileSync(join(ROOT,'manifest.webmanifest'),'utf8');
  // The brand stays.
  assert.match(APP_HTML, /<title>MatchMind PRO/);
  assert.match(manifest, /"name": "MatchMind PRO"/);
  // No surface may claim the predictions themselves are AI.
  for(const [where, text] of [['title', /<title>([^<]*)<\/title>/.exec(APP_HTML)[1]],
                              ['manifest description', /"description": "([^"]*)"/.exec(manifest)[1]]]){
    assert.doesNotMatch(text, /AI (sports )?(predictions|forecasts)/i, where+' still claims AI predictions');
    assert.match(text, /statistical/i, where+' must say what actually produces the numbers');
  }
  assert.doesNotMatch(APP_HTML, /AI's strongest recommendation/,
    'the hero placeholder must not attribute the engine pick to AI');
  // The planned AI feature is described, not removed: the write-up path and its providers stay.
  assert.match(APP_HTML, /runAIWriter/, 'the AI write-up path must not be removed');
  assert.match(APP_HTML, /Professional AI Write-up/, 'the AI write-up feature must still be offered');
  assert.match(manifest, /AI-written commentary/i, 'the manifest should still name the AI commentary');
  // And the write-up must keep saying it is derived from the engine output.
  assert.match(APP_HTML, /Written by \$\{r\.label\} from the engine output above/);
});

test('a Draw No Bet headline is explained as conditional, with the three outright numbers', async t => {
  if(!ready) return t.skip(skip());
  const {port} = await host();
  {
    const {ctx, page} = await open({port});
    // The Director's worked example: 70% win, 17.5% draw, 12.5% loss -> about 84.8% conditional.
    const seen = await page.evaluate(()=>{
      const shown = {pW:0.125, pD:0.175, pL:0.70};
      return {
        away: dnbNote('2D', shown),
        home: dnbNote('1D', {pW:0.70, pD:0.175, pL:0.125}),
        straight: dnbNote('1', shown),
        double: dnbNote('1X', shown),
        goals: dnbNote('O25', shown),
        missing: dnbNote('2D', {pW:0.125, pD:null, pL:0.70}),
        // the conditional the ladder itself publishes for this fixture
        rung: (()=>{ const r = rungsFor({pW:0.125, pD:0.175, pL:0.70, over:null, btts:null})
                                 .find(x=>x.code==='2D'); return r ? r.prob : null; })()
      };
    });
    // The conditional the user sees above the line is the win share of the numbers on it.
    assert.ok(seen.rung > 0.848 && seen.rung < 0.849, 'conditional DNB: '+seen.rung);
    // All four quantities are present and distinguishable.
    assert.match(seen.away, /Draws are set aside/);
    assert.match(seen.away, /70\.0% win/);
    assert.match(seen.away, /17\.5% draw, stake returned/);
    assert.match(seen.away, /12\.5% loss/);
    // Orientation: the home DNB names the home side's own win probability.
    assert.match(seen.home, /70\.0% win/);
    assert.match(seen.home, /12\.5% loss/);
    // Every non-DNB market stays untouched, so the card is not overloaded.
    assert.equal(seen.straight, '');
    assert.equal(seen.double, '');
    assert.equal(seen.goals, '');
    // Incomplete inputs produce no claim at all.
    assert.equal(seen.missing, '');
    await ctx.close();
  }
});

test('the DNB line is shown only when a pick is actually published', async t => {
  if(!ready) return t.skip(skip());
  const {port} = await host();
  {
    const {ctx, page} = await open({port});
    const seen = await page.evaluate(()=>{
      const shown = {pW:0.125, pD:0.175, pL:0.70};
      const el = document.getElementById('heroDnb');
      const conf = document.getElementById('heroConf');
      const out = {};
      // A published DNB pick: the line appears.
      conf.textContent = '84.8% confidence';
      setHeroDnb('2D', shown);
      out.published = {text: el.textContent, hidden: el.classList.contains('hidden')};
      // A gated or withheld fixture leaves heroConf empty, so the line must go.
      conf.textContent = '';
      setHeroDnb('2D', shown);
      out.gated = {text: el.textContent, hidden: el.classList.contains('hidden')};
      // A published straight win: no line.
      conf.textContent = '72.0% confidence';
      setHeroDnb('1', shown);
      out.straight = {text: el.textContent, hidden: el.classList.contains('hidden')};
      return out;
    });
    assert.match(seen.published.text, /Draws are set aside/);
    assert.equal(seen.published.hidden, false);
    assert.equal(seen.gated.text, '');
    assert.equal(seen.gated.hidden, true);
    assert.equal(seen.straight.text, '');
    assert.equal(seen.straight.hidden, true);
    await ctx.close();
  }
});

test('a saved API-Football key is restored even with no cached matches', async t => {
  if(!ready) return t.skip(skip());
  const {port} = await host();
  {
    // The regression for the restoreState guard: a key with an EMPTY corpus, which is what a
    // cleared cache or a quota-dropped corpus leaves behind.
    const {ctx, page} = await open({port, seed:{mm_state: JSON.stringify({
      afKey:'synthetic-launch-test-key', fb:[]
    })}});
    const seen = await page.evaluate(()=>({
      field: (document.getElementById('afKey')||{}).value,
      meta: document.getElementById('scoresMeta').textContent
    }));
    assert.equal(seen.field, 'synthetic-launch-test-key',
      'the key must come back without a cached corpus');
    assert.doesNotMatch(seen.meta, /cannot reach the server/i,
      'with a key restored the app must not report itself sourceless');
    await ctx.close();
  }
});

test('the existing prediction and grading behaviour is unchanged', async t => {
  if(!ready) return t.skip(skip());
  const {port} = await host();
  {
    const {ctx, page} = await open({port});
    const seen = await page.evaluate(()=>{
      const P = {pW:0.125, pD:0.175, pL:0.70, over:{2.5:0.55, 3.5:0.30}, btts:0.52};
      return {
        // the ladder: straight win -> DNB -> double chance, in that order, unchanged
        rungs: rungsFor(P).map(r=>r.code),
        probs: rungsFor(P).map(r=>+r.prob.toFixed(4)),
        // grading and settlement, unchanged
        dnbVoid: gradePick('1D','X',1,1),
        dnbHit: gradePick('1D','1',2,1),
        dnbMiss: gradePick('1D','2',0,1),
        dcHit: gradePick('1X','X',1,1),
        over: gradePick('O25',null,2,1),
        under: gradePick('U25',null,1,0),
        // labels and market names, unchanged
        labels: ['1','X','2','1X','X2','1D','2D','12'].map(c=>pickLabel(c,'Home','Away')),
        markets: ['1','1X','1D','BTS','O25'].map(pickMarket),
        // the calibration table still touches only U35
        // rounded: binary64 makes 0.8-0.0175 land at 0.7825000000000001
        calib: [calibrate('1D',0.8), calibrate('2D',0.8), +calibrate('U35',0.8).toFixed(6)]
      };
    });
    /* The ladder: best-paying rung first, then DNB, then double chance, then the strongest goals
       line. U35 leads the goals group at 1-0.30 = 0.70 shifted to 0.6825 by CALIB_SHIFT.U35, which
       is the one calibration entry that exists and is visible right here. */
    assert.deepEqual(seen.rungs, ['2','2D','X2','U35']);
    assert.deepEqual(seen.probs, [0.7, 0.8485, 0.875, 0.6825]);
    assert.equal(seen.dnbVoid, 'void');
    assert.equal(seen.dnbHit, 'hit');
    assert.equal(seen.dnbMiss, 'miss');
    assert.equal(seen.dcHit, 'hit');
    assert.equal(seen.over, 'hit');
    assert.equal(seen.under, 'hit');
    assert.deepEqual(seen.labels, ['Home to win','Draw','Away to win','Home or Draw','Draw or Away',
      'Home (Draw No Bet)','Away (Draw No Bet)','Either team']);
    assert.deepEqual(seen.markets, ['Winner','Double Chance','Draw No Bet','BTTS','Goals']);
    assert.deepEqual(seen.calib, [0.8, 0.8, 0.7825]);
    await ctx.close();
  }
});

test('release the shared browser and server', async t => {
  if(!ready) return t.skip(skip());
  await shutdown();
});
