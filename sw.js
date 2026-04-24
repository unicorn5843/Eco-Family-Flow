const CACHE_NAME = 'ecofamilyflow-v2';
const urlsToCache = [
  '/Eco-Family-Flow/',
  '/Eco-Family-Flow/index.html',
  '/Eco-Family-Flow/manifest.json'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
