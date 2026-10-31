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

test('the app boots as Build 355 on a phone viewport with no errors and no sideways scroll', async t => {
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
    assert.equal(info.build, 355);
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
  const html = readFileSync(join(ROOT,'index.html'),'utf8');
  // The Supabase publishable key is meant to ship and is RLS-gated. Nothing else may.
  assert.equal(/eyJ[A-Za-z0-9_-]{20,}\./.test(html), false, 'a JWT is embedded in the page');
  assert.equal(/sk-[A-Za-z0-9_-]{16,}/.test(html), false, 'an AI provider key is embedded');
  assert.equal(/sk_live|sb_secret|service_role/.test(html), false, 'a secret-tier key is embedded');
  // The API-Football key is the user's own, read from the input, never shipped.
  assert.match(html, /const afState = \{ key:''/, 'afState.key must ship empty');
});

test('release the shared browser and server', async t => {
  if(!ready) return t.skip(skip());
  await shutdown();
});
