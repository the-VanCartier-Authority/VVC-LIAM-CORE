import { NOTIFICATION_POLICY_REVISION } from '../shared/notificationPolicy';

// PWA lifecycle only: never requests permission, subscribes or schedules alerts.
let registration: ServiceWorkerRegistration | null = null;
let pending: Promise<ServiceWorkerRegistration | null> | null = null;
let observing = false;
let policyConfirmed = false;

export function isServiceWorkerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

// An old worker may not answer. A registration/update promise alone is NOT
// evidence that the new disabled worker controls this page.
export async function confirmDisabledWorker(worker: ServiceWorker | null): Promise<boolean> {
  if (!worker || typeof MessageChannel === 'undefined') return false;
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = (confirmed: boolean) => {
      clearTimeout(deadline);
      channel.port1.close();
      channel.port2.close();
      resolve(confirmed);
    };
    // Bounded acknowledgement deadline, not a notification timer.
    const deadline = setTimeout(() => finish(false), 1500);
    channel.port1.onmessage = event => finish(
      event.data?.type === 'NOTIFICATION_POLICY' &&
      event.data?.revision === NOTIFICATION_POLICY_REVISION && event.data?.enabled === false,
    );
    try { worker.postMessage({ type: 'GET_NOTIFICATION_POLICY' }, [channel.port2]); }
    catch { finish(false); }
  });
}

async function confirmController() {
  const controller = navigator.serviceWorker.controller;
  const confirmed = await confirmDisabledWorker(controller);
  // A late timeout from the old controller must not overwrite the new worker's
  // acknowledgement after controllerchange.
  if (controller !== navigator.serviceWorker.controller) return;
  policyConfirmed = confirmed;
  if (!policyConfirmed) console.warn('[PWA] Política del worker activo sin confirmar; una instalación anterior puede seguir activa.');
}

export function isDisabledWorkerConfirmed(): boolean { return policyConfirmed; }

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) return null;
  if (pending) return pending;
  pending = (async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      if (!observing) {
        observing = true;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          policyConfirmed = false;
          void confirmController();
        });
        window.addEventListener('online', () => { void registerServiceWorker(); });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registerServiceWorker();
        });
      }
      // Fetch both worker and imported script without the HTTP cache. The new
      // worker calls skipWaiting/clients.claim itself; never activate an unknown
      // legacy waiting worker by sending it SKIP_WAITING.
      try { await registration.update(); }
      catch { console.warn('[PWA] No se pudo comprobar una actualización del worker (posible modo sin conexión).'); }
      await confirmController();
      return registration;
    } catch {
      policyConfirmed = false;
      console.warn('[PWA] Actualización del worker no disponible; no se confirma el cierre de una instalación anterior.');
      return null;
    } finally { pending = null; }
  })();
  return pending;
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) return null;
  return registration || await navigator.serviceWorker.getRegistration('/') || null;
}
