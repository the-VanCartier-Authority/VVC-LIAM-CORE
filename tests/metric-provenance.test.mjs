import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeviceAdapter } from '../src/core/adapters/DeviceAdapter.ts';
import { startApp, post } from './server-helper.mjs';

test('D02: empty telemetry has no invented latency or TPS', async t => {
  const app = await startApp(); t.after(() => app.stop());
  const result = await (await fetch(app.base + '/api/vaos/telemetry', { headers: app.authHeaders })).json();
  assert.equal(result.stats.avgFastPathLatencyMs, null);
  assert.equal(result.stats.avgAsyncDurationMs, null);
  assert.equal(result.stats.avgTokensPerSec, null);
});

test('D02: local templates/routing cannot report model TPS', async t => {
  const app = await startApp(); t.after(() => app.stop());
  await post(app.base, '/api/vaos/dispatch', { command: 'fixture routing' });
  const result = await (await fetch(app.base + '/api/vaos/telemetry', { headers: app.authHeaders })).json();
  assert.equal(result.points[0].tokensPerSec, null);
  assert.equal(result.points[0].tokensSource, 'unavailable');
  assert.equal(result.points[0].latencyScope, 'policy_routing');
});

test('D02: missing battery API means unavailable, never a synthetic battery reading', async () => {
  const battery = await new DeviceAdapter().getBatteryInfo();
  assert.equal(battery.level, null); assert.equal(battery.source, 'unavailable');
  assert.equal(battery.temperatureEstimatedC, null);
});

test('D02: provider usage and character estimates are distinguished; only provider usage has a process rate', async t => {
  for (const [fixture, source] of [['mock-gemini-usage.mjs', 'provider'], ['mock-gemini.mjs', 'estimated']]) {
    const app = await startApp({ GEMINI_API_KEY: 'synthetic-gemini-server', F01_CAPTURE_FILE: '/dev/null' }, [`./tests/fixtures/${fixture}`]);
    t.after(() => app.stop());
    const dispatch = await post(app.base, '/api/vaos/dispatch', { command: 'crear documento fixture' });
    const { asyncTask } = await dispatch.json();
    let task;
    for (let i = 0; i < 100; i++) {
      task = await (await fetch(app.base + asyncTask.pollUrl, { headers: app.authHeaders })).json();
      if (task.result) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(task.result.tokensSource, source);
    if (source === 'provider') {
      assert.equal(task.result.tokensGenerated, 12); assert.ok(task.result.tokensPerSec > 0);
    } else assert.equal(task.result.tokensPerSec, null);
    const telemetry = await (await fetch(app.base + '/api/vaos/telemetry', { headers: app.authHeaders })).json();
    assert.equal(telemetry.points[0].latencyScope, 'processing_wall_time');
  }
});

test('D02: browser battery measurements retain provenance without inventing temperature or health', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const fakeNavigator = { userAgent: 'synthetic desktop', async getBattery() {
    return { level: 0.5, charging: false, chargingTime: Infinity, dischargingTime: 1200 };
  } };
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: fakeNavigator });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { navigator: fakeNavigator, matchMedia: () => ({ matches: false }) } });
    const battery = await new DeviceAdapter().getBatteryInfo();
    assert.equal(battery.level, 0.5); assert.equal(battery.source, 'browser');
    assert.equal(battery.chargingTime, null); assert.equal(battery.temperatureEstimatedC, null);
    assert.equal(battery.healthProfile, undefined);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else delete globalThis.window;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator;
  }
});
