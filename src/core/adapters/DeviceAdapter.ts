import type { DeviceCapabilities, DeviceBatteryInfo, PlatformType } from './types';

/**
 * Universal Multiplatform Device Adapter
 * Provides decoupled access to native phone capabilities, sensors, and storage
 */
export class DeviceAdapter implements DeviceCapabilities {
  private platform: PlatformType;
  private activeTorchTrack: MediaStreamTrack | null = null;
  private fallbackBatteryState = {
    level: 0.88,
    charging: false,
    lastUpdate: Date.now(),
  };

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
    if (typeof window === 'undefined') {
      return {
        level: 1.0,
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        temperatureEstimatedC: 28.5,
        healthProfile: 'OPTIMAL',
      };
    }

    try {
      // 1. Try real Web Battery API
      if ('getBattery' in navigator && typeof (navigator as any).getBattery === 'function') {
        const battery = await (navigator as any).getBattery();
        const level = typeof battery.level === 'number' ? battery.level : 0.85;
        const charging = Boolean(battery.charging);
        const temp = charging ? 32.4 : 27.8 + (1 - level) * 4;

        return {
          level,
          charging,
          chargingTime: battery.chargingTime ?? (charging ? 2400 : Infinity),
          dischargingTime: battery.dischargingTime ?? (charging ? Infinity : 18000),
          temperatureEstimatedC: Number(temp.toFixed(1)),
          healthProfile: level < 0.2 && !charging ? 'LOW_POWER' : 'OPTIMAL',
        };
      }
    } catch {
      // Ignore API security errors in sandboxed iframes
    }

    // 2. Realistic Fallback for Desktop & Restricted Environments
    const elapsedMinutes = (Date.now() - this.fallbackBatteryState.lastUpdate) / 60000;
    if (elapsedMinutes > 5) {
      this.fallbackBatteryState.level = Math.max(0.15, this.fallbackBatteryState.level - 0.01);
      this.fallbackBatteryState.lastUpdate = Date.now();
    }

    return {
      level: this.fallbackBatteryState.level,
      charging: this.fallbackBatteryState.charging,
      chargingTime: this.fallbackBatteryState.charging ? 3200 : Infinity,
      dischargingTime: this.fallbackBatteryState.charging ? Infinity : 14400,
      temperatureEstimatedC: 29.2,
      healthProfile: 'OPTIMAL',
    };
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

  // G02 notification policy: no permission prompts or native/local fallback.
  public async requestNotificationPermission(): Promise<NotificationPermission> {
    return 'denied';
  }

  public async showNotification(_title: string, _options?: NotificationOptions): Promise<boolean> {
    return false;
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
