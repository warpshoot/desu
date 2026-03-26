const CACHE_NAME = 'desu-draw-v1';
const ASSETS = [
  './',
  './css/style.css',
  './js/main.js',
  './js/modules/canvas.js',
  './js/modules/history.js',
  './js/modules/save.js',
  './js/modules/state.js',
  './js/modules/storage.js',
  './js/modules/ui.js',
  './js/modules/utils.js',
  './js/modules/tools/fill.js',
  './js/modules/tools/pen.js',
  './js/modules/tools/tone.js',
  './icons/pen.png',
  './icons/bet.png',
  './icons/ata.png',
  './icons/tone.png',
  './icons/er1.png',
  './icons/er2.svg',
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
