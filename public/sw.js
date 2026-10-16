// VVC LIAM CORE // Native Service Worker for Background Push Notifications & Offline Caching
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

// Activate: Clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
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

// Native Push Event: Handles incoming Web Push notifications from server
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'VVC LIAM CORE // Alerta', body: event.data.text() };
    }
  }

  const title = data.title || 'VVC LIAM CORE // Alerta en Segundo Plano';
  const options = {
    body: data.body || 'Alerta o recordatorio programado en segundo plano.',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    vibrate: [200, 100, 200, 100, 300],
    tag: data.tag || `vvc-liam-${Date.now()}`,
    renotify: true,
    requireInteraction: data.requireInteraction !== false,
    data: {
      url: data.url || '/',
      taskId: data.taskId,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Abrir Asistente 👁️' },
      { action: 'dismiss', title: 'Descartar ✖' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click: Focus existing window or open app
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click action:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (event.notification.data?.taskId && 'postMessage' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              taskId: event.notification.data.taskId,
            });
          }
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Message listener: Allows client to command the Service Worker
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_BACKGROUND_NOTIFICATION') {
    const { title, options } = event.data;
    const notificationOptions = {
      body: options?.body || 'Alerta de recordatorio en segundo plano.',
      icon: options?.icon || '/pwa-192x192.png',
      badge: options?.badge || '/pwa-192x192.png',
      vibrate: [200, 100, 200, 100, 300],
      tag: options?.tag || `vvc-alert-${Date.now()}`,
      renotify: true,
      requireInteraction: options?.requireInteraction !== false,
      data: {
        url: options?.url || '/',
        taskId: options?.taskId,
        timestamp: Date.now(),
      },
      actions: [
        { action: 'open', title: 'Abrir Asistente 👁️' },
        { action: 'dismiss', title: 'Descartar ✖' },
      ],
      ...options,
    };

    self.registration.showNotification(title || 'VVC LIAM CORE // Alerta', notificationOptions);
  }

  if (event.data.type === 'SCHEDULE_BACKGROUND_NOTIFICATION') {
    const { title, options, delayMs = 5000 } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title || 'VVC LIAM CORE // Alerta Programada', {
        body: options?.body || 'Recordatorio en segundo plano.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [250, 100, 250],
        tag: options?.tag || `vvc-scheduled-${Date.now()}`,
        renotify: true,
        data: {
          url: options?.url || '/',
          taskId: options?.taskId,
        },
        actions: [
          { action: 'open', title: 'Ver Alerta 👁️' },
        ],
        ...options,
      });
    }, Math.max(0, delayMs));
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
