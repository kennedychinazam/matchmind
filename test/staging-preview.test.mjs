// The Build 358 STAGING preview is a derived artifact. It must point at the staging project only,
// must be unable to reach production, a provider, an AI function or push, and must leave the
// release candidate untouched. Offline: no network, no provider, no hosted database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url), {chromium} = require('playwright-core');
const R = f => readFileSync(new URL('../' + f, import.meta.url));
const PROD = 'toqfdrcjzwnlydqekude', STG = 'rdcbnvfnxenrpnnwxszs', STG_KEY = 'sb_publishable_WKB88h4KAPtLVphsfNF9fg_W90ym80y';
const dist = mkdtempSync(join(tmpdir(), 'mm-stg-'));
execFileSync(process.execPath, [new URL('../staging/build-preview.mjs', import.meta.url).pathname, dist], {stdio: 'pipe'});
const D = f => readFileSync(join(dist, f));

test('the preview names the staging project and key, and nothing of production', () => {
  const html = D('index.html').toString('utf8');
  assert.ok(html.includes(`const SUPA_URL = 'https://${STG}.supabase.co';`), 'SUPA_URL is not the staging project');
  assert.ok(html.includes(`const SUPA_KEY = '${STG_KEY}';`), 'SUPA_KEY is not the staging publishable key');
  for (const bad of [PROD, 'wrXk5NFfWkrCdLgiQsaMHg', 'service_role', 'sb_secret_']) {
    for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'BUILD-INFO.json'])
      assert.ok(!D(f).toString('latin1').includes(bad), `${f} contains ${bad}`);
  }
});
test('the release candidate is untouched and only the documented hunks differ', () => {
  assert.ok(R('index.html').toString('utf8').includes(PROD), 'the candidate must keep its own configuration');
  assert.ok(D('sw.js').equals(R('sw.js')), 'sw.js must be byte-identical');
  assert.ok(D('icon-192.png').equals(R('icon-192.png')) && D('icon-512.png').equals(R('icon-512.png')));
  const a = R('index.html').toString('utf8').split('\r\n'), b = D('index.html').toString('utf8').split('\r\n');
  const removed = a.filter(l => !b.includes(l)), added = b.filter(l => !a.includes(l));
  assert.equal(removed.length, 3, 'removed lines: ' + removed.map(l => l.slice(0, 40)).join(' | '));
  assert.ok(removed.some(l => /^const SUPA_URL/.test(l)) && removed.some(l => /^const SUPA_KEY/.test(l)) && removed.some(l => /^<title>MatchMind PRO/.test(l)));
  assert.ok(added.some(l => /^const SUPA_URL = 'https:\/\/rdcbnvfnxenrpnnwxszs/.test(l)) && added.length < 40, 'added lines: ' + added.length);
  assert.equal(a.length + added.length - removed.length, b.length, 'every other line is identical, in the same order');
});
test('the build refuses when an expected anchor is missing', async () => {
  const {transform} = await import(new URL('../staging/build-preview.mjs', import.meta.url).href);
  assert.throws(() => transform('<head>only', '{}'), /staging build refused/);
});

async function open(t) {
  const exe = process.env.MM_TEST_CHROMIUM; assert.ok(exe && existsSync(exe), 'local offline Chromium required');
  const browser = await chromium.launch({executablePath: exe, args: ['--no-sandbox', '--disable-background-networking']});
  t.after(() => browser.close());
  const context = await browser.newContext({serviceWorkers: 'block', viewport: {width: 390, height: 844}});
  const seen = [];
  await context.route('**/*', r => { const u = r.request().url(); seen.push(u);
    return u === 'http://staging-preview.test/' ? r.fulfill({status: 200, contentType: 'text/html', body: D('index.html')}) : r.abort(); });
  const page = await context.newPage(); await page.goto('http://staging-preview.test/');
  return {page, seen};
}
test('in the browser: staging configuration, a visible bar, and a guard that refuses everything else', async t => {
  const {page, seen} = await open(t);
  assert.equal(await page.evaluate(() => SUPA_URL), `https://${STG}.supabase.co`);
  assert.equal(await page.evaluate(() => SUPA_KEY), STG_KEY);
  assert.match(await page.title(), /^STAGING /);
  const bar = await page.evaluate(() => { const e = document.getElementById('stagingBar'); const r = e.getBoundingClientRect(); return {t: e.textContent, h: r.height, w: r.width, vw: innerWidth}; });
  assert.match(bar.t, /STAGING .* not production/); assert.ok(bar.h > 0 && bar.w <= bar.vw, '#stagingBar is not on screen');
  const probe = u => page.evaluate(async u => { try { await fetch(u); return 'passed-guard'; } catch (e) { return /Blocked in the staging preview/.test(String(e)) ? 'blocked' : 'passed-guard:' + e.name; } }, u);
  for (const u of [`https://${PROD}.supabase.co/rest/v1/x`, 'https://v3.football.api-sports.io/fixtures', 'https://api.anthropic.com/v1/messages',
                   'https://openrouter.ai/api/v1/chat/completions', `https://${STG}.supabase.co/functions/v1/ai-analyze`])
    assert.equal(await probe(u), 'blocked', u);
  assert.notEqual(await probe(`https://${STG}.supabase.co/rest/v1/rpc/matchmind_display_v1`), 'blocked', 'the staging API itself must pass the guard');
  assert.equal(await page.evaluate(() => { try { new XMLHttpRequest().open('GET', 'https://v3.football.api-sports.io/x'); return 'open'; } catch (e) { return 'blocked'; } }), 'blocked');
  assert.equal(await page.evaluate(() => navigator.sendBeacon('https://example.com/x', 'a')), false);
  const push = await page.evaluate(async () => { try { await PushManager.prototype.subscribe.call({}); return 'subscribed'; } catch (e) { return e.name; } });
  assert.equal(push, 'NotAllowedError');
  assert.ok(!seen.some(u => u.includes(PROD) || u.includes('api-sports') || u.includes('openrouter') || u.includes('anthropic')), 'a forbidden host was requested: ' + seen.filter(u => /toqf|api-sports|openrouter|anthropic/.test(u)));
});
