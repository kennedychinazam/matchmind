/* Build 357 release acceptance: EMULATED mobile and PWA checks.
   PROOF CLASS: Chromium device emulation on a disposable local origin. This is NOT a physical
   device. It cannot establish real iOS Safari behaviour, a real install prompt, real touch
   input, real notification permission, battery or thermal behaviour, or real network
   transitions. Those need an operator with hardware; see the final report.
   No provider request, no backend, no credential, no production row. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
const playwrightPath=process.env.PWA_PLAYWRIGHT;
const executablePath=process.env.PWA_CHROMIUM||process.env.MM_TEST_CHROMIUM;
const repo=new URL('../',import.meta.url);
const DEVICES=['iPhone 14','iPhone SE','Pixel 7','iPad Mini'];

/* Poll a condition the page can only answer asynchronously. */
async function settle(page,fn,message,timeoutMs=30000){
  const deadline=Date.now()+timeoutMs;
  for(;;){
    if(await page.evaluate(fn)) return;
    if(Date.now()>deadline) throw new Error('timed out: '+message);
    await new Promise(r=>setTimeout(r,100));
  }
}

test('emulated phones and tablets: layout, tap targets, worker control and offline shell',
 {skip:!playwrightPath||!executablePath?'set PWA_PLAYWRIGHT and PWA_CHROMIUM for browser integration':false,timeout:180000},
 async t=>{
  const require=createRequire(import.meta.url);
  const {chromium,devices}=require(playwrightPath);
  const [html,sw,manifest,i192,i512]=await Promise.all(
    ['index.html','sw.js','manifest.webmanifest','icon-192.png','icon-512.png']
    .map(n=>readFile(new URL(n,repo))));

  /* The shipped build number and the worker's cache name must agree, or a device can sit on an
     old shell forever. Checked against the bytes this run actually serves. */
  const build=/const APP_BUILD = (\d+)[;\s]/.exec(html.toString());
  const cache=/const CACHE = 'matchmind-v(\d+)';/.exec(sw.toString());
  assert.ok(build&&cache,'APP_BUILD or CACHE not found');
  assert.equal(build[1],cache[1],'APP_BUILD and the service-worker cache name disagree');

  const m=JSON.parse(manifest.toString());
  assert.equal(m.display,'standalone');
  assert.equal(m.scope,'./');
  assert.ok(m.name&&m.short_name&&m.start_url&&m.theme_color&&m.background_color);
  assert.deepEqual(m.icons.map(i=>i.sizes).sort(),['192x192','512x512']);
  assert.ok(m.icons.some(i=>/maskable/.test(i.purpose||'')),'no maskable icon');

  let offline=false;
  const assets={'/':[html,'text/html'],'/index.html':[html,'text/html'],
    '/manifest.webmanifest':[manifest,'application/manifest+json'],
    '/icon-192.png':[i192,'image/png'],'/icon-512.png':[i512,'image/png'],
    '/sw.js':[sw,'application/javascript']};
  const server=createServer((req,res)=>{
    if(offline){req.socket.destroy();return;}
    const a=assets[new URL(req.url,'http://127.0.0.1').pathname];
    if(!a){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':a[1],'Cache-Control':'no-store','Service-Worker-Allowed':'/'});
    res.end(a[0]);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({executablePath,
    args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});
  t.after(async()=>{await browser.close();server.close();});

  const report=[];
  for(const name of DEVICES){
    const profile=devices[name];
    assert.ok(profile,'unknown device profile: '+name);
    const ctx=await browser.newContext({...profile,serviceWorkers:'allow'});
    await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    const page=await ctx.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin,{waitUntil:'load'});
    /* page.waitForFunction treats a returned Promise as a truthy value, so an async predicate
       never actually waits. Poll from Node with page.evaluate, which does await. */
    await settle(page,async()=>{
      const r=await navigator.serviceWorker.getRegistration();
      return !!(r&&r.active&&r.active.state==='activated'&&navigator.serviceWorker.controller===r.active);
    },name+': service worker never took control');
    /* The install does caches.addAll(SHELL), which is ATOMIC: if one request is still in flight
       when the origin goes away, the whole addAll rejects and NOTHING is cached. Waiting for the
       five shell entries is both what makes the offline check meaningful and what stops this
       harness racing the install. */
    await settle(page,async()=>{
      const names=await caches.keys();
      if(!names.length) return false;
      const keys=(await (await caches.open(names[0])).keys()).map(r=>new URL(r.url).pathname);
      return ['/','/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png']
        .every(p=>keys.includes(p));
    },name+': the offline shell was never fully cached');

    const seen=await page.evaluate(()=>{
      const d=document.documentElement;
      const navs=[...document.querySelectorAll('.nav-btn')].map(b=>{
        const r=b.getBoundingClientRect();
        return {view:b.dataset.view,w:Math.round(r.width),h:Math.round(r.height),
                visible:r.width>0&&r.height>0};
      });
      return {sideways:d.scrollWidth-d.clientWidth,navs,
        viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},
        build:typeof APP_BUILD==='number'?APP_BUILD:null,
        title:document.title};
    });

    assert.ok(seen.sideways<=1,name+': page scrolls sideways by '+seen.sideways+'px');
    assert.equal(seen.navs.length,5,name+': expected five navigation tabs');
    for(const b of seen.navs){
      assert.equal(b.visible,true,name+': tab '+b.view+' is not visible');
      /* WCAG 2.5.8 minimum target size is 24x24 CSS px; 44x44 is the comfortable touch target.
         Asserting the accessibility minimum, and recording the real size for the report. */
      assert.ok(b.w>=24&&b.h>=24,name+': tab '+b.view+' target is '+b.w+'x'+b.h+' CSS px');
    }
    assert.deepEqual(errors,[],name+': page runtime errors');

    /* The offline shell: with the origin destroyed, a reload must still be served by the worker. */
    offline=true;
    await page.reload({waitUntil:'load'});
    const offlineSeen=await page.evaluate(()=>({title:document.title,
      build:typeof APP_BUILD==='number'?APP_BUILD:null,
      navs:document.querySelectorAll('.nav-btn').length}));
    offline=false;
    assert.equal(offlineSeen.title,seen.title,name+': offline shell served a different document');
    assert.equal(offlineSeen.build,seen.build,name+': offline shell served a different build');
    assert.equal(offlineSeen.navs,5,name+': offline shell lost its navigation');

    report.push({device:name,...seen.viewport,sideways:seen.sideways,
      smallestTab:Math.min(...seen.navs.map(b=>Math.min(b.w,b.h))),
      offlineShell:'served build '+offlineSeen.build});
    await ctx.close();
  }
  /* Recorded so the acceptance evidence carries the numbers, not just a pass. */
  console.log('EMULATED DEVICE ACCEPTANCE (not physical hardware):');
  for(const r of report) console.log('  '+JSON.stringify(r));
});
