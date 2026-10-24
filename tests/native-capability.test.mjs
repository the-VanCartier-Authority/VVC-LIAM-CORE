import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeviceAdapter } from '../src/core/adapters/DeviceAdapter.ts';

test('a mobile user agent alone cannot establish a native application runtime', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const fixture = { navigator: { userAgent: 'Android synthetic mobile browser' }, matchMedia: () => ({ matches: false }) };
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: fixture });
    assert.equal(new DeviceAdapter().isNativeApp(), false);
    fixture.Capacitor = { isNativePlatform: () => false };
    assert.equal(new DeviceAdapter().isNativeApp(), false);
    fixture.Capacitor.isNativePlatform = () => true;
    assert.equal(new DeviceAdapter().isNativeApp(), true);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else delete globalThis.window;
  }
});
