// ─── Eco Family Flow – Service Worker ───────────────────────────────────────
const CACHE_NAME = 'eco-family-flow-v3'; // bump this whenever cached assets change

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

// ── Install: pre-cache the app shell ────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for the app shell, network for everything else ──────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Let Firebase / Firestore / Google auth traffic go straight to the network
  if (event.request.url.includes('firestore') ||
      event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Serve from cache, then quietly refresh the cache in the background
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => null);
        event.waitUntil(fetchPromise);
        return cachedResponse;
      }

      // Not cached — go to the network
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html').then(shell =>
            shell || new Response(
              '<h1>You are offline</h1><p>Please check your connection.</p>',
              { headers: { 'Content-Type': 'text/html' } }
            )
          );
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ── Push notifications ──────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Eco Family Flow';
  const options = {
    body: data.body || 'You have a new notification',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click – focus or open the app ──────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
