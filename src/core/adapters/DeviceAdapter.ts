import type { DeviceCapabilities, DeviceBatteryInfo, PlatformType } from './types';

/**
 * Universal Multiplatform Device Adapter
 * Provides decoupled access to native phone capabilities, sensors, and storage
 */
export class DeviceAdapter implements DeviceCapabilities {
  private platform: PlatformType;
  private activeTorchTrack: MediaStreamTrack | null = null;

  constructor() {
    this.platform = this.detectPlatform();
  }

  public getPlatform(): PlatformType {
    return this.platform;
  }

  public isNativeApp(): boolean {
    return (
      this.platform === 'android' ||
      this.platform === 'ios' ||
      this.platform === 'windows' ||
      (typeof window !== 'undefined' && (window as any).Capacitor !== undefined)
    );
  }

  private detectPlatform(): PlatformType {
    if (typeof window === 'undefined') return 'web';
    const ua = window.navigator.userAgent.toLowerCase();
    
    // Check if running inside PWA standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    // Check Android
    if (/android/i.test(ua)) {
      return isStandalone ? 'pwa' : 'android';
    }
    // Check iOS
    if (/iphone|ipad|ipod/i.test(ua)) {
      return isStandalone ? 'pwa' : 'ios';
    }
    // Check Windows
    if (/windows|win32/i.test(ua)) {
      return isStandalone ? 'pwa' : 'windows';
    }

    return isStandalone ? 'pwa' : 'web';
  }

  public async getBatteryInfo(): Promise<DeviceBatteryInfo> {
    const unavailable: DeviceBatteryInfo = { level: null, charging: null, chargingTime: null,
      dischargingTime: null, temperatureEstimatedC: null, source: 'unavailable' };
    if (typeof window === 'undefined') return unavailable;

    try {
      // 1. Try real Web Battery API
      if ('getBattery' in navigator && typeof (navigator as any).getBattery === 'function') {
        const battery = await (navigator as any).getBattery();
        const level = typeof battery.level === 'number' && battery.level >= 0 && battery.level <= 1 ? battery.level : null;
        const charging = typeof battery.charging === 'boolean' ? battery.charging : null;

        return {
          level,
          charging,
          chargingTime: Number.isFinite(battery.chargingTime) ? battery.chargingTime : null,
          dischargingTime: Number.isFinite(battery.dischargingTime) ? battery.dischargingTime : null,
          temperatureEstimatedC: null,
          source: 'browser',
        };
      }
    } catch {
      // Ignore API security errors in sandboxed iframes
    }

    return unavailable;
  }

  public vibrate(pattern: number | number[] = 50): boolean {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        return navigator.vibrate(pattern);
      } catch {
        return false;
      }
    }
    return false;
  }

  public async toggleTorch(enabled: boolean): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      if (enabled) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = (track.getCapabilities?.() || {}) as any;
          if (capabilities.torch) {
            await (track as any).applyConstraints({
              advanced: [{ torch: true }],
            });
            this.activeTorchTrack = track;
            return true;
          }
        }
      } else {
        if (this.activeTorchTrack) {
          try {
            await (this.activeTorchTrack as any).applyConstraints({
              advanced: [{ torch: false }],
            });
          } catch {}
          this.activeTorchTrack.stop();
          this.activeTorchTrack = null;
          return true;
        }
      }
    } catch {
      // Camera permissions or unsupported
    }
    return false;
  }

  public async requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  public async showNotification(title: string, options?: NotificationOptions): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission !== 'granted') {
      const perm = await this.requestNotificationPermission();
      if (perm !== 'granted') return false;
    }

    try {
      // Prefer service worker registration if available
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.showNotification(title, {
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            ...options,
          });
          return true;
        }
      }
      new Notification(title, options);
      return true;
    } catch {
      return false;
    }
  }

  public async copyToClipboard(text: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }

  public getStorageItem<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const item = localStorage.getItem(`vvc_liam_${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  public setStorageItem<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`vvc_liam_${key}`, JSON.stringify(value));
    } catch {
      // Storage full or quota exceeded
    }
  }
}
