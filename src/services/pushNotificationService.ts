// VVC LIAM CORE // Native Push Notification & Service Worker Service
// Enables native background notifications and Web Push even when app is minimized or closed
import { backendFetch } from './backendApi';

export interface PushSubscriptionStatus {
  isSupported: boolean;
  isServiceWorkerReady: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  endpoint?: string;
}

export interface BackgroundAlertOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  taskId?: string;
  url?: string;
  requireInteraction?: boolean;
  renotify?: boolean;
  delayMs?: number;
}

let swRegistration: ServiceWorkerRegistration | null = null;
let isRegistering = false;

/**
 * Convert URL-safe base64 string to Uint8Array for PushManager applicationServerKey
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if Service Worker is supported in current browser environment
 */
export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Check if Web Push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current browser notification permission
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Register Service Worker (/sw.js)
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    console.warn('[VVC LIAM CORE SW] Service Worker no es soportado en este navegador.');
    return null;
  }

  if (swRegistration) {
    return swRegistration;
  }

  if (isRegistering) {
    return navigator.serviceWorker.ready;
  }

  isRegistering = true;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    swRegistration = reg;
    console.log('[VVC LIAM CORE SW] Service Worker registrado exitosamente con scope:', reg.scope);

    // Listen for updates
    reg.addEventListener('updatefound', () => {
      const installingWorker = reg.installing;
      if (installingWorker) {
        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[VVC LIAM CORE SW] Nueva versión disponible y activada.');
          }
        });
      }
    });

    return reg;
  } catch (error) {
    console.error('[VVC LIAM CORE SW] Error registrando Service Worker:', error);
    return null;
  } finally {
    isRegistering = false;
  }
}

/**
 * Get active Service Worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (swRegistration) return swRegistration;
  if (!isServiceWorkerSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (reg) {
      swRegistration = reg;
      return reg;
    }
    return await registerServiceWorker();
  } catch {
    return null;
  }
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      // Automatically attempt push subscription upon grant
      await subscribeToPushNotifications();
    }
    return perm;
  } catch (error) {
    console.warn('[VVC LIAM CORE SW] Error solicitando permisos de notificación:', error);
    return Notification.permission;
  }
}

/**
 * Retrieve VAPID Public Key from server
 */
export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const response = await backendFetch('/api/push/vapid-public-key');
    if (!response.ok) return null;
    const data = await response.json();
    return data.publicKey || null;
  } catch (err) {
    console.warn('[VVC LIAM CORE SW] No se pudo obtener la clave pública VAPID:', err);
    return null;
  }
}

/**
 * Subscribe the user to native browser Web Push via PushManager and register with server
 */
export async function subscribeToPushNotifications(): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (!isPushSupported()) {
    return { success: false, error: 'Web Push no está soportado en este navegador.' };
  }

  const perm = getNotificationPermission();
  if (perm !== 'granted') {
    return { success: false, error: 'Permiso de notificaciones no concedido.' };
  }

  try {
    const reg = await registerServiceWorker();
    if (!reg) {
      return { success: false, error: 'Service Worker no disponible.' };
    }

    // Check existing subscription
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      const vapidKey = await fetchVapidPublicKey();
      if (!vapidKey) {
        return { success: false, error: 'No se pudo contactar el servidor para obtener la clave VAPID.' };
      }

      const convertedKey = urlBase64ToUint8Array(vapidKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });
    }

    // Register subscription on backend
    if (subscription) {
      await backendFetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      localStorage.setItem('vvc_liam_push_active', 'true');
      console.log('[VVC LIAM CORE SW] Suscripción Push nativa sincronizada con el servidor.');
      return { success: true, subscription };
    }

    return { success: false, error: 'No se pudo generar la suscripción push.' };
  } catch (error: any) {
    console.error('[VVC LIAM CORE SW] Error suscribiendo a notificaciones Push:', error);
    return { success: false, error: error?.message || 'Fallo de suscripción Push.' };
  }
}

/**
 * Unsubscribe from Push Notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await getServiceWorkerRegistration();
    if (!reg) return false;

    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await backendFetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
      localStorage.removeItem('vvc_liam_push_active');
      return true;
    }
    return true;
  } catch (err) {
    console.warn('[VVC LIAM CORE SW] Error al desuscribir:', err);
    return false;
  }
}

/**
 * Get complete Push and SW status
 */
export async function getPushSubscriptionStatus(): Promise<PushSubscriptionStatus> {
  const isSupported = isPushSupported();
  const perm = getNotificationPermission();

  if (!isSupported) {
    return {
      isSupported: false,
      isServiceWorkerReady: false,
      permission: perm,
      isSubscribed: false,
    };
  }

  const reg = await getServiceWorkerRegistration();
  let isSubscribed = false;
  let endpoint = undefined;

  if (reg) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      isSubscribed = true;
      endpoint = sub.endpoint;
    }
  }

  return {
    isSupported: true,
    isServiceWorkerReady: Boolean(reg && reg.active),
    permission: perm,
    isSubscribed,
    endpoint,
  };
}

/**
 * Send an immediate background notification using Service Worker or server push
 */
export async function sendBackgroundAlert(
  title: string,
  options?: BackgroundAlertOptions
): Promise<void> {
  const perm = getNotificationPermission();
  if (perm !== 'granted') {
    console.warn('[VVC LIAM CORE SW] Notificación bloqueada por permisos de navegador.');
    return;
  }

  const defaultOptions: any = {
    body: options?.body || 'Alerta de recordatorio u orden de sistema.',
    icon: options?.icon || '/pwa-192x192.png',
    badge: options?.badge || '/pwa-192x192.png',
    vibrate: [200, 100, 200, 100, 300],
    tag: options?.tag || `vvc-${Date.now()}`,
    renotify: options?.renotify ?? true,
    requireInteraction: options?.requireInteraction ?? true,
    data: {
      url: options?.url || '/',
      taskId: options?.taskId,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Abrir Asistente 👁️' },
      { action: 'dismiss', title: 'Descartar ✖' },
    ],
  };

  // 1. Direct Service Worker registration showNotification (Native, works in background)
  try {
    const reg = await getServiceWorkerRegistration();
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, defaultOptions);
      return;
    }
  } catch (swErr) {
    console.warn('[VVC LIAM CORE SW] Falló showNotification en SW:', swErr);
  }

  // 2. Post message to active SW controller
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_BACKGROUND_NOTIFICATION',
      title,
      options: defaultOptions,
    });
    return;
  }

  // 3. Trigger server Web Push
  try {
    await backendFetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body: defaultOptions.body,
        icon: defaultOptions.icon,
        badge: defaultOptions.badge,
        tag: defaultOptions.tag,
        taskId: options?.taskId,
      }),
    });
  } catch (serverErr) {
    console.warn('[VVC LIAM CORE SW] Falló envío push desde el servidor:', serverErr);
  }

  // 4. Fallback to standard window Notification if still in foreground
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: defaultOptions.body,
        icon: defaultOptions.icon,
      });
    } catch {}
  }
}

/**
 * Schedule a background notification to trigger after delayMs (even if app is in background)
 */
export async function scheduleBackgroundAlert(
  title: string,
  options?: BackgroundAlertOptions,
  delayMs: number = 5000
): Promise<void> {
  const reg = await getServiceWorkerRegistration();

  // Send to Service Worker
  if (reg && reg.active) {
    reg.active.postMessage({
      type: 'SCHEDULE_BACKGROUND_NOTIFICATION',
      title,
      options,
      delayMs,
    });
  }

  // Also schedule on backend via Web Push for guaranteed OS delivery
  try {
    await backendFetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body: options?.body,
        icon: options?.icon || '/pwa-192x192.png',
        badge: options?.badge || '/pwa-192x192.png',
        tag: options?.tag,
        taskId: options?.taskId,
        delayMs,
      }),
    });
  } catch (err) {
    console.warn('[VVC LIAM CORE SW] Falló programación en servidor:', err);
  }
}

/**
 * Trigger an immediate test native background notification
 */
export async function testNativePushNotification(): Promise<{ success: boolean; message: string }> {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') {
    return {
      success: false,
      message: 'Permiso de notificaciones denegado en el navegador.',
    };
  }

  await registerServiceWorker();
  await subscribeToPushNotifications();

  await sendBackgroundAlert('VVC LIAM CORE // Alerta en Segundo Plano Activa', {
    body: 'El Service Worker está monitoreando tareas y alertas nativas en segundo plano.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `test-${Date.now()}`,
    requireInteraction: true,
  });

  return {
    success: true,
    message: 'Alerta push nativa disparada a través del Service Worker.',
  };
}

/**
 * Listen for clicks on native background notifications
 */
export function initNotificationClickListener(
  onNotificationClick: (data: { taskId?: string }) => void
): () => void {
  if (!isServiceWorkerSupported()) return () => {};

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'NOTIFICATION_CLICKED') {
      console.log('[VVC LIAM CORE SW] Notificación clickeada recibida en la app:', event.data);
      onNotificationClick({ taskId: event.data.taskId });
    }
  };

  navigator.serviceWorker.addEventListener('message', handleMessage);

  return () => {
    navigator.serviceWorker.removeEventListener('message', handleMessage);
  };
}
