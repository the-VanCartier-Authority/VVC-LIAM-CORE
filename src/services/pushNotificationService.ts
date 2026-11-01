// G02: notification operations are unavailable, including local fallbacks.
import { notificationUnavailable } from '../shared/notificationPolicy';
export { isServiceWorkerSupported, registerServiceWorker, getServiceWorkerRegistration } from './serviceWorkerLifecycle';

export interface PushSubscriptionStatus {
  enabled: false;
  code: 'PUSH_DISABLED';
  isSupported: boolean;
  isServiceWorkerReady: false;
  permission: NotificationPermission;
  // Unknown: disabling delivery does not remove or inspect legacy subscriptions.
  isSubscribed: null;
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

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Read-only information about an existing browser permission, never a request.
export function getNotificationPermission(): NotificationPermission {
  return typeof Notification === 'undefined' ? 'denied' : Notification.permission;
}

// Policy denial, not a change to the browser's stored permission.
export async function requestNotificationPermission(): Promise<NotificationPermission> { return 'denied'; }
export async function fetchVapidPublicKey(): Promise<null> { return null; }
export async function subscribeToPushNotifications() { return notificationUnavailable(); }
// Do not unsubscribe/delete legacy data automatically while operations are off.
export async function unsubscribeFromPushNotifications(): Promise<false> { return false; }
export async function getPushSubscriptionStatus(): Promise<PushSubscriptionStatus> {
  return { enabled: false, code: 'PUSH_DISABLED', isSupported: isPushSupported(),
    isServiceWorkerReady: false, permission: getNotificationPermission(), isSubscribed: null };
}
export async function sendBackgroundAlert(_title: string, _options: BackgroundAlertOptions = {}) {
  return notificationUnavailable();
}
export async function scheduleBackgroundAlert(_title: string, _options: BackgroundAlertOptions = {}, _delayMs = 5000) {
  return notificationUnavailable();
}
export async function testNativePushNotification() { return notificationUnavailable(); }
export function initNotificationClickListener(_callback: (data: { taskId?: string }) => void) {
  return () => {};
}
