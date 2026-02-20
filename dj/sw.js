const CACHE_NAME = 'desu-dj-v2';
const ASSETS = [
  './',
  './css/style.css',
  './js/main.js',
  './js/modules/audioEngine.js',
  './js/modules/constants.js',
  './js/modules/deck.js',
  './js/modules/mixer.js',
  './js/modules/storage.js',
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
  const url = new URL(e.request.url);

  // CDN resources (Tone.js etc.): network-first
  if (url.origin !== location.origin) {
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Same-origin: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
