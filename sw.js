const CACHE_NAME = 'play-loop-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/legacy/pages.js',
  '/legacy/ui.js',
  '/legacy/pwa.js',
  '/legacy/player.js',
  '/legacy/search.js',
  '/manifest.json',
  '/logo.svg',
  '/favicon.svg',
  '/icon-maskable.svg',
  '/autism.svg'
];

// Install Event: Pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static app assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Cache first with Network fallback for static assets
self.addEventListener('fetch', (event) => {
  // Ignore API calls, external CDN resources, and non-GET requests for offline caching
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version & update cache in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            /* ignore background fetch failures */
          });
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          if (event.request.url.startsWith('http')) {
            try {
              cache.put(event.request, responseToCache).catch(e => console.warn('Cache put error:', e));
            } catch (e) {}
          }
        });

        return networkResponse;
      });
    })
  );
});
