import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startApp } from './server-helper.mjs';

const zero = { generate: 0, configure: 0, set: 0, delete: 0, send: 0, schedule: 0 };
async function fixture(t, extraEnv = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'vvc-disabled-push-'));
  const effects = join(directory, 'effects.jsonl');
  await writeFile(effects, '');
  let app;
  t.after(async () => { await app?.stop(); await rm(directory, { recursive: true, force: true }); });
  app = await startApp({ VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '',
    VVC_PUSH_EFFECTS_FILE: effects, ...extraEnv }, ['./tests/fixtures/observe-push-effects.mjs']);
  return { ...app, async counts() {
    const counts = { ...zero };
    for (const line of (await readFile(effects, 'utf8')).trim().split('\n').filter(Boolean))
      counts[JSON.parse(line).event]++;
    return counts;
  } };
}
async function operation(app, headers, path, body = {}, method = 'POST') {
  const response = await fetch(app.base + path, { method,
    headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
function disabled(response) {
  assert.equal(response.status, 503);
  assert.equal(response.data.code, 'PUSH_DISABLED'); assert.equal(response.data.success, false);
  assert.equal(response.data.realExecution, false); assert.equal(response.data.outcome.status, 'unavailable');
}

test('G02 push: two authenticated users cannot subscribe, delete, send, broadcast or schedule', async t => {
  const app = await fixture(t);
  const users = [app.authHeaders, { Authorization: 'Bearer ' + await app.identity.token('fixture-user-b') }];
  for (const headers of users)
    assert.equal((await fetch(app.base + '/api/vaos/tasks', { headers })).status, 200);
  const subscriptions = users.map((_, i) => ({ endpoint: `https://push-disabled.invalid/user-${i}`,
    keys: { p256dh: 'synthetic-public-key', auth: 'synthetic-auth' } }));
  const responses = [];
  for (let i = 0; i < users.length; i++)
    responses.push(await operation(app, users[i], '/api/push/subscribe', subscriptions[i]));
  for (const headers of users) {
    responses.push(await operation(app, headers, '/api/push/send', { title: 'synthetic broadcast' }));
    responses.push(await operation(app, headers, '/api/push/send', { title: 'synthetic delayed', delayMs: 73 }));
  }
  await delay(180); // Old code dispatches to both synthetic registered endpoints; transport is stubbed.
  for (let i = 0; i < users.length; i++)
    responses.push(await operation(app, users[i], '/api/push/unsubscribe', { endpoint: subscriptions[i].endpoint }));
  const counts = await app.counts();
  console.log(JSON.stringify({ regression: 'G02 push disabled', statuses: responses.map(x => x.status),
    effects: counts, actualNotificationNetworkCalls: 0 }));
  for (const response of responses) disabled(response);
  assert.deepEqual(counts, zero, 'no key setup, registry mutation, sends or delayed dispatch');
});

test('G02 push: default-off discovery is truthful and server/request hints cannot enable it', async t => {
  const app = await fixture(t, { PUSH_ENABLED: 'true', ENABLE_PUSH: 'true',
    VAPID_PUBLIC_KEY: 'synthetic-invalid-public', VAPID_PRIVATE_KEY: 'synthetic-invalid-private' });
  const config = await (await fetch(app.base + '/api/config')).json();
  const key = await (await fetch(app.base + '/api/push/vapid-public-key')).json();
  const status = await (await fetch(app.base + '/api/push/status', { headers: app.authHeaders })).json();
  assert.equal(config.hasPushEnabled, false); assert.equal(key.publicKey, '');
  assert.deepEqual(status, { enabled: false, hasVapidKey: false, activeSubscribers: 0 });
  disabled(await operation(app, app.authHeaders, '/api/push/send?enabled=true', { enabled: true, force: true }));
  assert.deepEqual(await app.counts(), zero);
});

test('G02 push: the gate precedes JSON and covers methods, route variants and future broadcast paths', async t => {
  const app = await fixture(t);
  for (const [method, path] of [['POST', '/api/push/subscribe/'], ['POST', '/API/PUSH/SEND'],
    ['DELETE', '/api/push/unsubscribe'], ['PUT', '/api/push/subscribe'], ['PATCH', '/api/push/send'],
    ['POST', '/api/push/broadcast']]) disabled(await operation(app, app.authHeaders, path, {}, method));
  const raw = await new Promise((resolve, reject) => {
    const req = request(app.base + '/api/push/send', { method: 'POST',
      headers: { ...app.authHeaders, 'Content-Type': 'application/json', 'Content-Length': '1' } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', part => { text += part; });
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(text) }));
    });
    req.on('error', reject); req.end('{');
  });
  disabled(raw);
  assert.equal((await fetch(app.base + '/api/push/send', { method: 'POST' })).status, 401);
  assert.deepEqual(await app.counts(), zero);
});
