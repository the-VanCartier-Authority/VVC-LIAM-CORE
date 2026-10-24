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
