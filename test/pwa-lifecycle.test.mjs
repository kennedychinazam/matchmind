import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

// Opt in because this integration test needs a separately installed browser and Playwright.
const playwrightPath = process.env.PWA_PLAYWRIGHT;
const executablePath = process.env.PWA_CHROMIUM;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const repo = new URL('../', import.meta.url);

test('disposable origin: worker update, offline shell, and forward-version rollback', { skip: !playwrightPath || !executablePath ? 'set PWA_PLAYWRIGHT and PWA_CHROMIUM for browser integration' : false, timeout: 120000 }, async () => {
  const { chromium } = createRequire(import.meta.url)(playwrightPath);
  const [worker, html, manifest, icon192, icon512] = await Promise.all(['sw.js', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'].map(name => readFile(new URL(name, repo))));
  assert.equal(digest(worker), '67640f8c46be5635b6efe536f33564ec08530c84e8b79ca5b527c79ee15d430a');
  // Bind cached/offline bytes to the exact current candidate, not an older accepted HTML digest.
  assert.match(html.toString(), /const APP_BUILD = 357[;\s]/);
  assert.match(html.toString(), /<title>MatchMind/);
  const updatedHtml = Buffer.from(html.toString().replace('<head>', '<head><meta name="synthetic-app-version" content="N+1">'));
  assert.notEqual(digest(updatedHtml), digest(html));
  let version = 357, offline = false;
  const requests = [], phases = [], errors = [];
  const workerFor = v => v === 357 ? worker : Buffer.from(worker.toString().replace("const CACHE = 'matchmind-v357';", `const CACHE = 'matchmind-v${v}';`) + `\n// Synthetic response fixture ${v}.\nself.addEventListener('message', e => { if (e.data === 'fixture-identity') e.ports[0].postMessage('synthetic-worker-${v}'); });\n`);
  const bodyFor = v => v === 358 ? updatedHtml : html;
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (offline) { req.socket.destroy(); return; }
    const assets = { '/': [bodyFor(version), 'text/html'], '/index.html': [bodyFor(version), 'text/html'], '/manifest.webmanifest': [manifest, 'application/manifest+json'], '/icon-192.png': [icon192, 'image/png'], '/icon-512.png': [icon512, 'image/png'], '/sw.js': [workerFor(version), 'application/javascript'] };
    const asset = assets[path];
    requests.push({ path, version, sha256: asset ? digest(asset[0]) : null });
    if (!asset) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store', 'Service-Worker-Allowed': '/' }); res.end(asset[0]);
  });
  let browser;
  const evidence = { proof_class: 'local desktop Chromium; exact baseline worker and app, synthetic response-only update and forward-version rollback; not deployed versions', baseline_worker_sha256: digest(worker), baseline_html_sha256: digest(html), updated_html_sha256: digest(updatedHtml), phases, requests, errors };
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=127.0.0.1;localhost', '--disable-quic', '--disable-background-networking', '--disable-component-update', '--disable-sync'] });
    evidence.browser = browser.version();
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'load' });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; localStorage.setItem('pwa-fixture-marker', 'preserved'); });
    // page.waitForFunction treats a returned Promise as truthy, so an ASYNC predicate resolves
    // at once whatever it computes - proven on the pinned playwright-core 1.63.0: a predicate
    // `async () => false` resolves in ~30ms while the sync form times out. This wait was
    // therefore a no-op and verified nothing. Poll from Node, which does await.
    for (let waited = 0; ; waited += 100) {
      const controlled = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r?.active?.state === 'activated' && navigator.serviceWorker.controller === r.active); });
      if (controlled) break;
      assert.ok(waited < 30000, 'the service worker never took control of the page');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    async function receipt(v, label) {
      const received = await page.evaluate(async ({ v }) => {
        const registration = await navigator.serviceWorker.getRegistration();
        const names = await caches.keys();
        const response = await caches.match('/index.html', { cacheName: `matchmind-v${v}` });
        const bytes = response && await response.arrayBuffer();
        const hash = bytes && Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
        return { names, cached_html_sha256: hash, controlled_by_active: navigator.serviceWorker.controller === registration.active, active_state: registration.active?.state, marker: localStorage.getItem('pwa-fixture-marker') };
      }, { v });
      assert.deepEqual(received.names, [`matchmind-v${v}`]);
      assert.equal(received.cached_html_sha256, digest(bodyFor(v)));
      assert.equal(received.controlled_by_active, true);
      assert.equal(received.active_state, 'activated');
      assert.equal(received.marker, 'preserved');
      phases.push({ label, version: v, worker_sha256: digest(workerFor(v)), ...received });
    }
    await receipt(357, 'baseline activated and controls page');
    async function offlineReload(v, label) {
      offline = true;
      const response = await page.reload({ waitUntil: 'load' });
      assert.equal(response.status(), 200);
      const offlineBodyHash = digest(await response.body());
      assert.equal(offlineBodyHash, digest(bodyFor(v)));
      assert.equal(await page.evaluate(() => document.querySelector('meta[name="synthetic-app-version"]')?.content ?? null), v === 358 ? 'N+1' : null);
      await receipt(v, label);
      phases.at(-1).offline_response_sha256 = offlineBodyHash;
      phases.at(-1).offline_app_marker = v === 358 ? 'N+1' : null;
      offline = false;
    }
    await offlineReload(357, 'baseline offline reload');
    const probeCached = await page.evaluate(async () => {
      await fetch('/sw.js?cb=synthetic-probe', { cache: 'no-store' });
      return !!(await caches.match('/sw.js?cb=synthetic-probe'));
    });
    assert.equal(probeCached, false);
    phases.push({ label: 'version probe fetched without caching', cached: probeCached });
    async function update(v) {
      // Keep object references in the page: URL equality alone cannot identify workers.
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        window.__pwa = { old: navigator.serviceWorker.controller, registration, candidate: null, changes: 0 };
        navigator.serviceWorker.addEventListener('controllerchange', () => { window.__pwa.changes++; });
        registration.addEventListener('updatefound', () => { window.__pwa.candidate = registration.installing; }, { once: true });
        await caches.open('synthetic-obsolete-cache');
      });
      version = v;
      await page.evaluate(() => window.__pwa.registration.update());
      await page.waitForFunction(() => { const p = window.__pwa; return p.candidate && p.candidate !== p.old && p.candidate.state === 'activated' && p.registration.active === p.candidate && navigator.serviceWorker.controller === p.candidate && p.changes > 0; }, null, { timeout: 20000 });
      const identity = await page.evaluate(async () => {
        const p = window.__pwa;
        const channel = new MessageChannel();
        const id = new Promise(resolve => { channel.port1.onmessage = e => resolve(e.data); });
        p.candidate.postMessage('fixture-identity', [channel.port2]);
        return { response: await id, unique_object: p.candidate !== p.old, active_and_controller_are_candidate: p.registration.active === p.candidate && navigator.serviceWorker.controller === p.candidate, controller_changes: p.changes };
      });
      assert.equal(identity.response, `synthetic-worker-${v}`);
      assert.ok(requests.some(r => r.path === '/sw.js' && r.version === v && r.sha256 === digest(workerFor(v))));
      await receipt(v, v === 358 ? 'synthetic N+1 update' : 'synthetic forward-version rollback to N content');
      phases.at(-1).identity = identity;
    }
    await update(358);
    await offlineReload(358, 'updated content offline reload');
    await update(359);
    await offlineReload(359, 'rolled-back content offline reload');
    evidence.result = 'PASS';
  } catch (e) {
    evidence.result = 'FAIL'; evidence.failure = { message: e.message, stack: e.stack }; throw e;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    if (process.env.PWA_EVIDENCE) await writeFile(process.env.PWA_EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');
  }
});
