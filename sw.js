// MatchMind PRO service worker — offline app shell + push notifications
const CACHE = 'matchmind-v90';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if(url.origin !== location.origin) return;
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
