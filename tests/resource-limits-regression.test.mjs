import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, post } from './server-helper.mjs';

test('B02: authenticated requests have per-user rate limits independent of another user', async t => {
  const app = await startApp({ BACKEND_LIMITS_JSON: '{"requestsPerMinute":2}' }); t.after(() => app.stop());
  assert.equal((await fetch(app.base + '/api/vaos/tasks', { headers: app.authHeaders })).status, 200);
  assert.equal((await fetch(app.base + '/api/vaos/tasks', { headers: app.authHeaders })).status, 200);
  const limited = await fetch(app.base + '/api/vaos/tasks', { headers: app.authHeaders });
  assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('Retry-After')) > 0);
  const userB = { Authorization: `Bearer ${await app.identity.token('fixture-user-b')}` };
  assert.equal((await fetch(app.base + '/api/vaos/tasks', { headers: userB })).status, 200);
});

test('B02: excessive generation and JSON payloads fail before a provider is called', async t => {
  const app = await startApp(); t.after(() => app.stop());
  assert.equal((await post(app.base, '/api/chat/nvidia', { max_tokens: 100000, messages: [] })).status, 400);
  assert.equal((await post(app.base, '/api/chat/custom', { fixture: 'x'.repeat(270000) })).status, 413);
});
