// VVC LIAM CORE // Native Push Notification & Background Alert Service Worker Listener
console.log('[VVC LIAM SW] Push & Background Worker Loaded');

// Native Push Event: Handles incoming Web Push notifications from server
self.addEventListener('push', (event) => {
  console.log('[VVC LIAM SW] Push notification event received:', event);

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
  console.log('[VVC LIAM CORE SW] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if open
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
      // If no window is open, open the app
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
});
