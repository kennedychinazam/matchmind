/* Verify a hosted Build 358 staging preview. Runs from a GitHub runner (this container has no route
 * to pages.dev or to staging). Anonymous and read only. Nothing is written anywhere.
 *
 *   node staging/verify-preview-url.mjs https://<name>.pages.dev staging/dist
 *
 * 'staging/dist' is rebuilt from the candidate in the same job, so the check is: what Cloudflare serves
 * is byte-identical to what the reviewed build script produces from the immutable candidate.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, resolve} from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url), {chromium} = require('playwright-core');
const url = new URL(process.argv[2]); const dist = resolve(process.argv[3] || 'staging/dist');
const STG = 'rdcbnvfnxenrpnnwxszs', PROD = 'toqfdrcjzwnlydqekude';
const results = []; let fail = 0;
const check = (n, ok, d = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  [' + String(d).slice(0, 240) + ']' : ''}`); if (!ok) fail++; };
const sha = b => createHash('sha256').update(b).digest('hex');
const SELFTEST = process.env.MM_VERIFY_SELFTEST === '1' && url.hostname === '127.0.0.1';   // local dry run of this script only
check('the URL is https on a pages.dev host that is not the production site', SELFTEST || (url.protocol === 'https:' && /\.pages\.dev$/.test(url.hostname) && !/github\.io$/.test(url.hostname)), url.origin + (SELFTEST ? ' (SELFTEST)' : ''));
const info = JSON.parse(readFileSync(join(dist, 'BUILD-INFO.json'), 'utf8'));
const served = {};
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'BUILD-INFO.json']) {
  const r = await fetch(new URL('/' + f, url), {cache: 'no-store'}); const b = Buffer.from(await r.arrayBuffer()); served[f] = {status: r.status, ct: r.headers.get('content-type'), cc: r.headers.get('cache-control'), sha: sha(b)};
  const want = f === 'BUILD-INFO.json' ? sha(readFileSync(join(dist, f))) : info.output_sha256[f];
  check(`${f} is served with the reviewed bytes`, r.status === 200 && served[f].sha === want, `HTTP ${r.status} ${served[f].sha.slice(0, 12)} want ${String(want).slice(0, 12)}`);
}
check('the served files sit at the site root', Object.values(served).every(s => s.status === 200));
check('sw.js is served as JavaScript', /javascript/.test(served['sw.js'].ct || ''), served['sw.js'].ct);
check('the manifest is served as a manifest or JSON', /manifest|json/.test(served['manifest.webmanifest'].ct || ''), served['manifest.webmanifest'].ct);
const man = JSON.parse(await (await fetch(new URL('/manifest.webmanifest', url))).text());
check('manifest: staging name, standalone, root scope, both icons', man.name === 'MatchMind STAGING' && man.display === 'standalone' && man.scope === './' && man.start_url === './' && man.icons.length === 2);
check('the page bytes contain the staging project and no production reference', !readFileSync(join(dist, 'index.html'), 'latin1').includes(PROD));

const browser = await chromium.launch({executablePath: process.env.MM_TEST_CHROMIUM, args: ['--no-sandbox']});
const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'allow'});
const reqs = []; context.on('request', q => reqs.push(q.url()));
const page = await context.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto(url.href, {waitUntil: 'load'});
const state = async () => page.evaluate(() => ({supa: SUPA_URL, bar: !!document.getElementById('stagingBar'), leagues: Object.keys(afState.leagues || {}).length, archive: Object.keys(afState.archive || {}).length, until: _presentationUntil, asOf: _presentationAsOf, chip: document.getElementById('dataChip').textContent, title: document.title, build: APP_BUILD}));
let s = null; for (let i = 0; i < 40 && !(s && s.leagues > 0); i++) { await page.waitForTimeout(500); s = await state(); }
check('the hosted page is configured for the staging project and shows the STAGING bar', s.supa === `https://${STG}.supabase.co` && s.bar && s.build === 358, JSON.stringify(s));
check('the hosted page adopted a valid published edition', s.leagues > 0 && s.until > Date.now(), `leagues ${s.leagues} until ${new Date(s.until).toISOString()}`);
check('the page archive holds the frozen predictions', s.archive >= 145, 'archive ' + s.archive);
// PWA
await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.active && r.active.state; });
check('service worker registered and active at the site root', await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active && new URL(r.scope).pathname === '/'); }));
await page.reload({waitUntil: 'load'});
check('the page is controlled by the service worker after one reload', await page.evaluate(() => !!navigator.serviceWorker.controller));
const cdp = await context.newCDPSession(page); const inst = await cdp.send('Page.getInstallabilityErrors');
/* 'in-incognito' is a property of the automated browser context, not of the site, so it is the one error ignored. */
const instErrs = (inst.installabilityErrors || []).filter(e => e.errorId !== 'in-incognito');
check('Chromium reports no installability errors', instErrs.length === 0, JSON.stringify(instErrs));
const cached = await page.evaluate(async () => { const ks = await caches.keys(); const out = {}; for (const k of ks) out[k] = (await (await caches.open(k)).keys()).map(r => new URL(r.url).pathname); return out; });
check('the shell is cached under the Build 358 cache name', Object.keys(cached).includes('matchmind-v358') && ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'].every(p => (cached['matchmind-v358'] || []).includes(p)), JSON.stringify(cached));
await context.setOffline(true);
let offlineOk = false; try { await page.reload({waitUntil: 'load'}); offlineOk = await page.evaluate(() => !!document.getElementById('stagingBar') && typeof APP_BUILD === 'number'); } catch (e) {}
check('offline reload still opens the app shell', offlineOk);
await context.setOffline(false);
// network restrictions
const hosts = [...new Set(reqs.map(u => { try { return new URL(u).hostname; } catch { return u; } }))].sort();
const allowed = [url.hostname, `${STG}.supabase.co`, 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];
check('every host contacted is allowed', hosts.every(h => allowed.includes(h)), hosts.join(', '));
check('no production, provider, AI, Edge Function or push-service request', !reqs.some(u => u.includes(PROD) || /api-sports|openrouter|anthropic|moonshot|deepseek|\/functions\/v1\/|fcm\.googleapis|push\.apple|mozilla\.com\/push/.test(u)));
check('no script error', errs.length === 0, errs.join(' | '));
await browser.close();
console.log(JSON.stringify({url: url.origin, served}, null, 1));
console.log(results.join('\n'));
console.log(fail ? `\n${fail} FAILED` : `\nALL ${results.length} HOSTED PREVIEW CHECKS PASSED`);
process.exit(fail ? 1 : 0);
