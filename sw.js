// ─── Eco Family Flow – Service Worker ────────────────────────────────────────
const CACHE_NAME = 'eco-family-flow-v2'; // bump version when assets change
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Icons (adjust sizes/names to match your manifest)
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // If you bundle libraries locally, add them here (recommended)
  // '/lib/chart.min.js',
  // '/lib/html2canvas.min.js',
  // '/lib/jspdf.min.js'
];

// ── Install: pre‑cache the app shell ───────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre‑caching assets');
      return cache.addAll(ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  // Activate immediately (skip waiting)
  self.skipWaiting();
});

// ── Activate: clean old caches ──────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    }).then(() => {
      console.log('[SW] Now controlling clients');
      return self.clients.claim();
    })
  );
});

// ── Fetch: cache‑first for app shell, network‑only for everything else ──────
self.addEventListener('fetch', event => {
  // Skip non‑GET requests and Firebase stuff
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firestore') ||
      event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis')) {
    return; // let browser handle it
  }

  // For our known assets, try cache first, then network
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Return cached file, and optionally update cache in background
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, networkResponse.clone())
            );
          }
          return networkResponse;
        }).catch(() => null);
        event.waitUntil(fetchPromise);
        return cachedResponse;
      }
      // Not in cache – go to network
      return fetch(event.request).catch(() => {
        // If the request is a page navigation, return offline fallback
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html').then(offline => {
            return offline || new Response(
              '<h1>You are offline</h1><p>Please check your connection.</p>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
        }
        // For other resources, just return a generic error
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ── Push notifications (if you use web push) ────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Eco Family Flow';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' } // optional deep link
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click – open the app ───────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // If a window is already open, focus it
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          return;
        }
      }
      // Otherwise open a new window/tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
