// MatchMind PRO service worker — offline app shell + push notifications
const CACHE = 'matchmind-v354';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
/* ══ BUILD 350 — THE UPDATE CHECK IS NEVER STORED, AND THE COPIES ARE SWEPT UP (WO-51) ══════════
   KEN'S RULE, and it is the whole of this change: **the file that asks "is there a new version?"
   must never be answered from the old version.**

   THE CAUSE, IN ONE SENTENCE: the `fetch` handler below put EVERY same-origin response into the
   cache, and a Cache Storage key is the whole URL INCLUDING its query string — so the app's version
   probe, `./sw.js?cb=<Date.now()>` in `mmVersionWatch`, which is unique by design and fires on boot
   and on every return to the foreground, wrote a brand-new entry on every single check.
   `{cache:'no-store'}` on that fetch never helped: it governs the HTTP cache, not this one.
   Measured on a real device on live 349: 946 entries, 941 of them `sw.js?cb=` copies and 5 real,
   having grown from 772 to 946 in a single session. */
const SW_PATH_RE = /(^|\/)sw\.js$/;     // the parsed path, never a substring of the whole URL

/* Sweep the copies already on a device. THE CACHE ITSELF IS NEVER DELETED — that would be one line
   and would cost every returning user their offline copy for one load, which is the risk WO-51
   names. Only keys whose PATH is `sw.js` are removed, so the five real entries (`./`,
   `index.html`, the manifest and the two icons) cannot be caught by it.
   On a phone holding 900 of them this is one `keys()` and 900 `delete`s against the device's own
   store with no network involved, and completes in well under a second. */
async function sweepVersionProbes(){
  try{
    const c = await caches.open(CACHE);
    let n = 0;
    for(const req of await c.keys()){
      let u; try{ u = new URL(req.url); }catch(_){ continue; }
      if(SW_PATH_RE.test(u.pathname) && (await c.delete(req))) n++;
    }
    return n;
  }catch(_){ return 0; }
}

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>sweepVersionProbes()).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if(url.origin !== location.origin) return;
  /* Fetched and dropped, never stored, and never served FROM the store either: answering the version
     probe out of the old version is exactly what Ken's rule forbids, and a stale answer here is
     worse than none — `mmVersionWatch` already treats a failed probe as "not a stale build", which
     is the right reading when the device is offline. `sw.js` was never in SHELL, so nothing the app
     needs offline is lost by not caching it. */
  if(SW_PATH_RE.test(url.pathname)){ e.respondWith(fetch(e.request)); return; }
  e.respondWith(
    fetch(e.request).then(res=>{
      const copy = res.clone();
      caches.open(CACHE).then(c=>c.put(e.request, copy));
      return res;
    }).catch(()=>caches.match(e.request))
  );
});

/* ── PUSH NOTIFICATIONS (build 90) ────────────────────────────────────────────
   The service worker is the only thing that can show a notification when the app is closed, which
   is the entire point — so this code runs with no page, no app state and no engine available.
   Everything shown must arrive inside the push payload.

   `tag` collapses repeats: if two pushes about the same fixture arrive, the second replaces the
   first instead of stacking. Without it, a phone that was offline for an hour dumps a pile of
   duplicate reminders the moment it reconnects. */
self.addEventListener('push', event=>{
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch(_) { d = { body: event.data && event.data.text() }; }

  const title = d.title || 'MatchMind';
  const opts = {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: d.tag || 'matchmind',
    renotify: !!d.renotify,
    // a kick-off reminder is time-critical; a digest is not, so it must not buzz
    requireInteraction: false,
    silent: d.kind === 'digest',
    data: { url: d.url || './', fxid: d.fxid || null, kind: d.kind || null }
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

/* Tapping a notification should land on the thing it was about — and should re-use an already-open
   MatchMind rather than opening a second copy of the app. */
self.addEventListener('notificationclick', event=>{
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || './', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(list=>{
      for(const c of list){
        if(c.url.startsWith(self.location.origin)){
          // tell the running app which match to open; it listens for this in onMessage
          c.postMessage({ mm:'open-fixture', fxid: data.fxid || null });
          return c.focus();
        }
      }
      return self.clients.openWindow(target + (data.fxid ? ('#match='+data.fxid) : ''));
    })
  );
});

/* Push services expire subscriptions periodically. When that happens the browser fires this event
   and the old endpoint is already dead — so the app re-subscribes on next open (it checks on boot).
   Nothing useful can be done from here without the user's auth token, so this only logs. */
self.addEventListener('pushsubscriptionchange', ()=>{
  // handled on next app open by ensurePushFresh()
});
