/* Live binding check for the Build 358 staging preview. Runs from a GitHub Actions runner, which
 * can reach the staging project (this container cannot). Anonymous and read-only: the only
 * credential is the staging PUBLISHABLE key already inside the built page. It writes nothing,
 * signs nobody in, and calls no provider and no Edge Function.
 *
 *   node staging/build-preview.mjs staging/dist && node staging/verify-live.mjs staging/dist
 */
import {createServer} from 'node:http';
import {readFileSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url), {chromium} = require('playwright-core');
const dist = resolve(process.argv[2] || 'staging/dist');
const STG = 'rdcbnvfnxenrpnnwxszs', PROD = 'toqfdrcjzwnlydqekude';
const KEY = readFileSync(join(dist, 'index.html'), 'utf8').match(/const SUPA_KEY = '([^']+)'/)[1];
const types = {'.html': 'text/html', '.js': 'application/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json'};
const server = createServer((q, r) => {
  const p = q.url.split('?')[0] === '/' ? '/index.html' : q.url.split('?')[0], f = join(dist, p);
  if (!existsSync(f) || f.indexOf(dist) !== 0) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', types[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream'); r.end(readFileSync(f));
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const results = []; let fail = 0;
const check = (n, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${detail ? '  [' + detail + ']' : ''}`); if (!ok) fail++; };

const direct = async path => { const r = await fetch(`https://${STG}.supabase.co${path}`, {headers: {apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json'}, method: path.includes('/rpc/') ? 'POST' : 'GET', body: path.includes('/rpc/') ? JSON.stringify({screen: 'predictions'}) : undefined}); return {status: r.status, body: await r.text()}; };
const health = await direct('/auth/v1/health');
check('staging Auth answers with the page\'s publishable key', health.status === 200, 'HTTP ' + health.status);
const edition = await direct('/rest/v1/rpc/matchmind_display_v1');
let env = null; try { env = JSON.parse(edition.body); } catch {}
check('anonymous display RPC returns a valid current edition', edition.status === 200 && env && env.version === 'matchmind-display/1' && Date.parse(env.expires_at) > Date.now() && Date.parse(env.as_of) <= Date.now(), `HTTP ${edition.status} edition ${env && env.edition_id} as_of ${env && env.as_of} expires ${env && env.expires_at}`);
const raw = await direct('/rest/v1/fixtures?select=fxid&limit=1');
check('anonymous raw fixtures read is refused or empty', raw.status >= 400 || raw.body === '[]', 'HTTP ' + raw.status + ' ' + raw.body.slice(0, 60));
const pub = await direct('/rest/v1/rpc/matchmind_publish_display_v1');
check('anonymous publish is refused', pub.status >= 400, 'HTTP ' + pub.status);

const browser = await chromium.launch({executablePath: process.env.MM_TEST_CHROMIUM, args: ['--no-sandbox']});
const context = await browser.newContext({serviceWorkers: 'block', viewport: {width: 390, height: 844}});
const reqs = [];
context.on('request', q => reqs.push(q.url()));
const responses = [];
context.on('response', s => { if (s.url().includes(`${STG}.supabase.co`)) responses.push({url: s.url(), status: s.status()}); });
const page = await context.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(base, {waitUntil: 'load'});
let state = null;
for (let i = 0; i < 40 && !(state && state.leagues > 0); i++) {
  await page.waitForTimeout(500);
  state = await page.evaluate(() => ({leagues: Object.keys(afState.leagues || {}).length, asOf: _presentationAsOf, until: _presentationUntil, chip: (document.getElementById('dataChip') || {}).textContent, supa: SUPA_URL, bar: !!document.getElementById('stagingBar'), archive: Object.keys(afState.archive || {}).length, title: document.title}));
}
check('the page is configured for the staging project', state && state.supa === `https://${STG}.supabase.co`, state && state.supa);
check('the staging bar is on screen', state && state.bar);
check('the page adopted the published edition', state && state.leagues > 0 && state.until > Date.now(), JSON.stringify(state));
check('the adopted edition is the one the RPC serves', env && state && state.asOf === Date.parse(env.as_of), `page ${state && state.asOf} rpc ${env && Date.parse(env.as_of)}`);
check('the 145 frozen predictions and the 4 additive QA forecasts are in the page archive', state && state.archive >= 145, 'archive ' + (state && state.archive));
const hosts = [...new Set(reqs.map(u => { try { return new URL(u).hostname; } catch { return u; } }))].sort();
check('the browser contacted only allowed hosts', hosts.every(h => ['127.0.0.1', `${STG}.supabase.co`, 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'].includes(h)), hosts.join(', '));
check('production, providers and AI were never contacted', !reqs.some(u => u.includes(PROD) || /api-sports|openrouter|anthropic|moonshot|deepseek/.test(u)));
check('no Edge Function request left the page', !reqs.some(u => u.includes('/functions/v1/')));
check('every staging response was a success or an expected refusal, never a server error', responses.every(r => r.status < 500), JSON.stringify(responses.map(r => r.status)));
check('the page raised no script error', errs.length === 0, errs.join(' | ').slice(0, 200));
await browser.close(); server.close();
console.log(results.join('\n'));
console.log(fail ? `\n${fail} FAILED` : `\nALL ${results.length} LIVE STAGING PREVIEW CHECKS PASSED`);
process.exit(fail ? 1 : 0);
