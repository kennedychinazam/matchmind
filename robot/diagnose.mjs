/* MatchMind - the pick-coverage diagnostic runner (2026-11-21).

   Serves THIS checkout's index.html on localhost, opens it in a headless browser signed in as the
   publisher (so the app may read the raw fixtures it fits on), waits for the full history to load,
   and evaluates robot/diag-page.js inside the page. That file calls the app's own engine functions,
   so what it measures is what the app would do, not a second copy of it.

   IT WRITES NOTHING. Every non-read request to the database (inserts, upserts, updates, deletes and
   the one publishing RPC) is answered locally with an empty success and never leaves the runner. The
   published record, the bars and the board are untouched. Output is printed as `DIAG <json>` lines. */
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EMAIL = process.env.MM_PUBLISHER_EMAIL || '';
const PASSWORD = process.env.MM_PUBLISHER_PASSWORD || '';
const CHANNEL = process.env.MM_CHANNEL || 'chrome';
const BT_FROM = process.env.MM_BT_FROM || '2024-07-01';
const PORT = 8123;
const log = (m, x) => console.log(new Date().toISOString() + '  ' + m + (x ? '  ' + JSON.stringify(x) : ''));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p);
  if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(f));
});

function isWrite(req) {
  const u = req.url(), m = req.method();
  if (!/supabase\.co\//.test(u)) return false;
  if (/\/auth\/v1\//.test(u)) return false;                       // sign-in and token refresh
  if (/\/rest\/v1\/rpc\//.test(u)) return /matchmind_publish_display_v1/.test(u);   // reads, except the publishing RPC
  if (/\/functions\/v1\//.test(u)) return m !== 'GET' && m !== 'OPTIONS';
  return m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS';
}

async function main() {
  if (!EMAIL || !PASSWORD) throw new Error('publisher credentials missing');
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const url = `http://127.0.0.1:${PORT}/`;
  const ctx = await chromium.launchPersistentContext('./diag-profile', { channel: CHANNEL, headless: true, timezoneId: 'Africa/Lagos', viewport: { width: 412, height: 915 } });
  let faked = 0;
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    if (isWrite(req)) { faked++; return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
    return route.continue();
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('pageerror', (e) => log('page error: ' + String(e && e.message || e).slice(0, 200)));
  const open = async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof APP_BUILD !== 'undefined' && typeof supa !== 'undefined' && !!supa, null, { timeout: 120000, polling: 1000 });
  };
  await open();
  const err = await page.evaluate(async ([e, p]) => { const { error } = await supa.auth.signInWithPassword({ email: e, password: p }); return error ? String(error.message) : null; }, [EMAIL, PASSWORD]);
  if (err) throw new Error('sign-in refused: ' + err);
  await open();
  await page.waitForFunction(() => !!authUser, null, { timeout: 180000, polling: 1000 });
  log('signed in', { build: await page.evaluate(() => APP_BUILD) });
  const t0 = Date.now(); let quiet = null, s = null;
  while (Date.now() - t0 < 40 * 60000) {
    s = await page.evaluate(() => ({ loadedAt: _leaguesLoadedAt || 0, back: !!_histBackfillRunning, comps: Object.keys(afState.leagues || {}).length,
      expected: COMP_IDS.length, q: archiveQueue.size + driftQueue.size, measures: _measuresState, pub: isPublisher(),
      matches: Object.values(afState.leagues || {}).reduce((a, L) => a + (L.matches || []).length, 0) }));
    const ok = s.loadedAt > 0 && !s.back && s.comps >= Math.floor(s.expected * 0.9) && s.measures === 'loaded';
    if (ok) { if (quiet == null) quiet = Date.now(); if (Date.now() - quiet > 90000) break; } else quiet = null;
    await sleep(5000);
  }
  log('settled', { secs: Math.round((Date.now() - t0) / 1000), ...s, faked });
  await page.addScriptTag({ content: readFileSync(join(ROOT, 'robot', 'diag-page.js'), 'utf8') });
  const out = await page.evaluate((o) => mmDiag(o), { btFrom: BT_FROM });
  const text = JSON.stringify(out);
  for (let i = 0; i < text.length; i += 6000) console.log('DIAG ' + String(i / 6000).padStart(3, '0') + ' ' + text.slice(i, i + 6000));
  log('done', { bytes: text.length, faked });
  await ctx.close();
  server.close();
}
main().then(() => process.exit(0)).catch((e) => { log('FAILED: ' + String(e && e.message || e).slice(0, 500)); process.exit(1); });
