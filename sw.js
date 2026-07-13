// MatchMind PRO service worker — offline app shell
const CACHE = 'matchmind-v7';
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
  if(url.origin !== location.origin) return;             // API calls go straight to network
  e.respondWith(
    fetch(e.request).then(res=>{                          // network-first so updates arrive
      const copy = res.clone();
      caches.open(CACHE).then(c=>c.put(e.request, copy));
      return res;
    }).catch(()=>caches.match(e.request))                 // offline -> cached shell
  );
});
