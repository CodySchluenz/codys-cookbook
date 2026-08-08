// Offline support. RULE: bump CACHE on ANY shell change (html/css/js/manifest/icons).
// Recipe data is network-first, so content updates never require a bump.
const CACHE = 'cookbook-v6';
const SHELL = [
  './', './css/app.css', './js/app.js', './js/scale.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  if (url.pathname.endsWith('.json')) e.respondWith(networkFirst(e.request));
  else e.respondWith(cacheFirst(e.request));
});

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    if (fresh.ok) (await caches.open(CACHE)).put(req, fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    const hit = await caches.match(req);
    return hit ?? new Response('{"error":"offline"}', {
      status: 503, headers: { 'content-type': 'application/json' },
    });
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const fresh = await fetch(req);
  if (fresh.ok) (await caches.open(CACHE)).put(req, fresh.clone()).catch(() => {});
  return fresh;
}
