const CACHE_NAME = 'desu-pattern-v1';
const ASSETS = [
  './',
  './js/app.js',
  './icons/rect.png',
  './icons/arc.png',
  './icons/triangle.png',
  './icons/sym.png',
  './icons/sym_x.png',
  './icons/sym_y.png',
  './icons/sym_xy.png',
  './icons/file.svg',
  './icon.svg',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
