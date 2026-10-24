import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { BackendLimits, ResourceLimitError } from '../src/server/backendLimits.ts';
import { startApp, post } from './server-helper.mjs';

test('per-user and global concurrency leases release once for requests and tasks', () => {
  for (const kind of ['request', 'task']) {
    const config = kind === 'request' ? { concurrentRequestsPerUser: 1, concurrentRequestsGlobal: 2 }
      : { concurrentTasksPerUser: 1, concurrentTasksGlobal: 2 };
    const limits = new BackendLimits(JSON.stringify(config));
    const releaseA = limits[kind]('user-a');
    assert.throws(() => limits[kind]('user-a'), ResourceLimitError);
    const releaseB = limits[kind]('user-b');
    assert.throws(() => limits[kind]('user-c'), ResourceLimitError);
    releaseA(); releaseA();
    const releaseC = limits[kind]('user-c');
    assert.throws(() => limits[kind]('user-d'), ResourceLimitError);
    releaseB(); releaseC();
  }
});

test('token reservations and rate windows are scoped to UID and expire using server time', () => {
  let now = 86400000;
  const limits = new BackendLimits('{"requestsPerMinute":2,"tokenReservationsPerDay":12288}', () => now);
  limits.request('a')(); limits.request('a')();
  assert.throws(() => limits.request('a'), ResourceLimitError);
  limits.request('b')();
  limits.reserveGeneration('a');
  assert.throws(() => limits.reserveGeneration('a'), ResourceLimitError);
  limits.reserveGeneration('b');
  now += 60000; limits.request('a')();
  now += 86400000; limits.reserveGeneration('a');
  for (const raw of ['null', '{"constructor":1}', '{"requestsPerMinute":0}', '{"requestsPerMinute":1.5}', '{"unknown":1}'])
    assert.throws(() => new BackendLimits(raw));
});

test('HTTP concurrent generations are bounded until the provider finishes', async t => {
  let finish;
  let firstReady;
  const ready = new Promise(resolve => { firstReady = resolve; });
  let count = 0;
  const fixture = createServer(async (req, res) => {
    for await (const _ of req) {}
    if (++count === 1) { finish = () => res.end('{"choices":[{"message":{"content":"fixture"}}]}'); firstReady(); }
    else res.end('{"choices":[{"message":{"content":"fixture"}}]}');
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  t.after(() => { fixture.closeAllConnections(); fixture.close(); });
  const port = fixture.address().port;
  const app = await startApp({ BACKEND_LIMITS_JSON: '{"concurrentRequestsPerUser":1}', LLM_PROVIDERS_JSON: JSON.stringify([
    { id: 'fixture', kind: 'openai-compatible', endpoint: `http://127.0.0.1:${port}/v1/chat/completions`, allowByok: true,
      localException: { providerId: 'fixture', hostname: '127.0.0.1', port } },
  ]) }); t.after(() => app.stop());
  const first = post(app.base, '/api/chat/custom', { providerId: 'fixture', messages: [] });
  await ready;
  assert.equal((await post(app.base, '/api/chat/custom', { providerId: 'fixture', messages: [] })).status, 429);
  assert.equal(count, 1);
  finish(); assert.equal((await first).status, 200);
  assert.equal((await post(app.base, '/api/chat/custom', { providerId: 'fixture', messages: [] })).status, 200);
});

test('HTTP rejects malformed/bounded fields and enforces conservative token quota', async t => {
  const app = await startApp({ BACKEND_LIMITS_JSON: '{"tokenReservationsPerDay":12288}' }); t.after(() => app.stop());
  for (const body of [{ messages: [{ role: 'user', content: 'x'.repeat(32001) }] },
    { messages: new Array(65).fill({ role: 'user', content: 'fixture' }) }, { temperature: 99 }, { max_tokens: -1 }])
    assert.equal((await post(app.base, '/api/chat/nvidia', body)).status, 400);
  assert.equal((await post(app.base, '/api/chat/nvidia', { messages: [] })).status, 401); // no provider key; reservation remains conservative
  assert.equal((await post(app.base, '/api/chat/nvidia', { messages: [] })).status, 429);
});

test('VAOS task concurrency remains reserved after HTTP dispatch returns and releases at terminal state', async t => {
  const app = await startApp({ GEMINI_API_KEY: 'synthetic-only',
    BACKEND_LIMITS_JSON: '{"concurrentTasksPerUser":1,"concurrentTasksGlobal":2}' }, ['./tests/fixtures/slow-gemini.mjs']);
  t.after(() => app.stop());
  const request = { command: 'crear documento fixture' };
  const first = await post(app.base, '/api/vaos/dispatch', request);
  assert.equal(first.status, 200); const { asyncTask } = await first.json();
  assert.equal((await post(app.base, '/api/vaos/dispatch', request)).status, 429);
  for (const [uid, expected] of [['fixture-user-b', 200], ['fixture-user-c', 429]]) {
    const response = await fetch(app.base + '/api/vaos/dispatch', { method: 'POST',
      headers: { Authorization: `Bearer ${await app.identity.token(uid)}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    assert.equal(response.status, expected);
  }
  for (let i = 0; i < 100; i++) {
    const task = await (await fetch(app.base + asyncTask.pollUrl, { headers: app.authHeaders })).json();
    if (task.status === 'FAILED') break;
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  assert.equal((await post(app.base, '/api/vaos/dispatch', request)).status, 200);
});
