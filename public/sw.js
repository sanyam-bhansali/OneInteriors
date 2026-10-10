/*
 * One Interiors service worker — the smallest one that earns its keep.
 *
 * It makes the site installable and gives a phone with no signal a clear
 * page instead of the browser's dinosaur. It deliberately caches nothing
 * else: quotes and matches are priced live, and a stale copy of either is
 * worse than none.
 */
const OFFLINE = '/offline.html';
const CACHE = 'oi-offline-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
