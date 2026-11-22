/* Build 366: the goals markets follow the current scoring level (GOAL_LEVEL), CALIB_SHIFT.U35 is
   refitted, and the Smart Bet cards take legs at 70% or better with no goals preference.
   Drives the real index.html in Chromium over a local static server; every request off 127.0.0.1
   is aborted. No provider call, no backend write. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync, existsSync} from 'node:fs';
import {join, extname, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');

test('source: one GOAL_LEVEL, refitted U35 shift, 0.70 card floor, no preferGoals', () => {
  assert.match(HTML, /const GOAL_LEVEL = \{ ON: true, POOL_DAYS: 60, POOL_K: 500, LEAGUE_N: 300, LEAGUE_K: 300, MIN_HISTORY: 30 \};/);
  assert.match(HTML, /const CALIB_SHIFT = \{ U35: -0\.03, X2: -0\.015, '1D': -0\.015 \};/);   // build 368 adds X2 and 1D
  assert.match(HTML, /const DAILY_CARD_FLOOR_LO = 0\.70;/);
  assert.match(HTML, /const DAILY_CARD_FLOOR_HI = 0\.70;/);
  assert.match(HTML, /safe: \{ BTS: DAILY_CARD_FLOOR_LO \}/);
  assert.ok(!/preferGoals\s*:\s*true/.test(HTML), 'no tier sets preferGoals');
  // the result grid keeps the unscaled rates: predict and neutral both route through goalLevelRates
  assert.ok(HTML.includes('const out = this.marketsFor(lambdaH, lambdaA, goalLevelRates(this, upTo), rhoOverride);'));
  assert.ok(HTML.includes('return this.marketsFor(avgH, avgA, goalLevelRates(this, upTo));'));
  // the live publish writes the goals-level expected goals the published goals panel prices
  assert.ok(HTML.includes('xg_home:+(p.goalsXgH != null ? p.goalsXgH : p.lambdaH).toFixed(3)'));
});

function loadChromium(){
  const require = createRequire(import.meta.url);
  for(const id of ['playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright/index.js', '/opt/node22/lib/node_modules/playwright/index.js']){
    try{ return require(id).chromium; }catch{}
  }
  return null;
}
function browserPath(){
  for(const p of [process.env.MM_TEST_CHROMIUM, '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'])
    if(p && existsSync(p)) return p;
  return null;
}
const chromium = loadChromium(), exe = browserPath();
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.webmanifest':'application/manifest+json'};

test('engine: 1X2 unchanged, goals follow the level, unregistered and published grids unscaled', async t => {
  if(!(chromium && exe)) return t.skip('needs a local Chromium');
  const server = createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if(p === '/') p = '/index.html';
    const f = join(ROOT, p);
    if(!f.startsWith(ROOT) || !existsSync(f)){ res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': TYPES[extname(f)] || 'application/octet-stream'}); res.end(readFileSync(f));
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  const browser = await chromium.launch({executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage']});
  try{
    const ctx = await browser.newContext();
    await ctx.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());
    await ctx.addInitScript(() => localStorage.setItem('mm_intro', '1'));
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto('http://127.0.0.1:' + port + '/', {waitUntil: 'load', timeout: 60000});
    await page.waitForTimeout(2000);
    const seen = await page.evaluate(() => {
      /* A synthetic competition: 600 matches, the first 400 at 2 goals, the last 200 at 4. */
      const ms = [];
      const teams = ['A','B','C','D','E','F','G','H'];
      for(let i = 0; i < 600; i++){
        const d = new Date(Date.UTC(2024, 0, 1) + i * 864e5).toISOString().slice(0, 10);
        const hi = i >= 400;
        ms.push({date: d, home: teams[i % 8], away: teams[(i + 3) % 8], hg: hi ? 2 : 1, ag: hi ? 2 : 1});
      }
      const L = {id: 39, name: 'Premier League', sport: 'football', matches: ms, upcoming: []};
      const saved = afState.leagues; afState.leagues = Object.assign({}, saved, {39: L});
      registerLeagueDampen(L);
      const E = Object.create(footballEngine); E.matches = ms;
      const on = E.predict('A', 'D');
      GOAL_LEVEL.ON = false; const off = E.predict('A', 'D'); GOAL_LEVEL.ON = true;
      const early = E.predict('A', 'D', 350);
      const U = Object.create(footballEngine); U.matches = ms.slice();          // not a registered competition
      const unreg = goalLevelFor(U, null);
      const grid = publishedGrid(1.4, 1.1, null, {rates: {n: 100, btts: 50, o15: 75, o25: 50, o35: 25}});
      const plain = Object.create(footballEngine); plain.matches = [];
      const ref = plain.marketsFor(1.4, 1.1, {btts: 0.5, 1.5: 0.75, 2.5: 0.5, 3.5: 0.25, n: 100});
      afState.leagues = saved;
      return {s: on.goalScale, sOff: off.goalScale, sEarly: early.goalScale, unreg,
              pW: [on.pW, off.pW], pD: [on.pD, off.pD], o25: [on.over[2.5], off.over[2.5]],
              xg: [on.goalsXgH + on.goalsXgA, on.lambdaH + on.lambdaA],
              gridScale: grid.goalScale, gridO25: grid.over[2.5], refO25: ref.over[2.5],
              tiers: DAILY_TIERS.map(x => !!x.preferGoals),
              floors: Object.values(DAILY_CARD_LEG_FLOORS).filter(v => v != null)};
    });
    assert.deepEqual(errs, []);
    assert.ok(seen.s > 1.05, 'a higher-scoring recent run lifts the goals level: ' + seen.s);
    assert.equal(seen.sOff, 1);
    assert.equal(seen.sEarly, 1, 'before LEAGUE_N + MIN_HISTORY matches there is no level');
    assert.equal(seen.unreg, 1, 'an unregistered match array is never scaled');
    assert.equal(seen.pW[0], seen.pW[1], '1X2 does not move');
    assert.equal(seen.pD[0], seen.pD[1], '1X2 does not move');
    assert.ok(seen.o25[0] > seen.o25[1], 'Over 2.5 rises with the level');
    assert.ok(seen.xg[0] > seen.xg[1]);
    assert.equal(seen.gridScale, 1, 'the published grid is never scaled');
    assert.equal(seen.gridO25, seen.refO25, 'the published grid is the plain marketsFor');
    assert.deepEqual(seen.tiers, seen.tiers.map(() => false));
    for(const v of seen.floors) assert.ok(v >= 0.70, 'every card leg floor is at least 0.70');
    await ctx.close();
  } finally { await browser.close(); server.close(); }
});
