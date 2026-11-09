// VVC LIAM CORE // Offline caching; notifications explicitly disabled by G02.
importScripts('/sw-push.js');
const CACHE_NAME = 'vvc-liam-core-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/screenshot-desktop.png',
  '/screenshot-mobile.png'
];

// Install: Cache core assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Cache addAll notice:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate the disabled policy without deleting existing user or legacy caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch: Network first with cache fallback for static assets and offline page
self.addEventListener('fetch', (event) => {
  // Ignore API requests, non-GET requests, and dev bundling endpoints
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('/@vite') ||
    event.request.url.includes('/@fs') ||
    event.request.url.includes('/src/') ||
    event.request.url.includes('node_modules')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and store successful GET responses in cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        // Fallback to cache if offline
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === 'navigate') {
          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) {
            return offlinePage;
          }
          return caches.match('/');
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
