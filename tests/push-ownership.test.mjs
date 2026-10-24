import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startApp, post } from './server-helper.mjs';

export function subscription(id = 'a') {
  const ecdh = createECDH('prime256v1');
  return { endpoint: `https://fcm.googleapis.com/fcm/send/fixture-${id}`,
    expirationTime: null, keys: { p256dh: ecdh.generateKeys().toString('base64url'),
      auth: randomBytes(16).toString('base64url') } };
}

test('B05: authenticated B cannot count, notify, claim or delete A subscriptions', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'vvc-push-fixture-'));
  const capture = join(dir, 'captured.txt');
  const app = await startApp({ VVC_PUSH_CAPTURE: capture }, ['./tests/fixtures/capture-push.mjs']);
  t.after(async () => { await app.stop(); await rm(dir, { recursive: true, force: true }); });
  const b = { Authorization: `Bearer ${await app.identity.token('fixture-user-b')}` };
  const postB = (route, body) => fetch(app.base + route, { method: 'POST',
    headers: { ...b, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const sub = subscription();
  assert.equal((await post(app.base, '/api/push/subscribe', { ...sub, ownerUid: 'fixture-user-b' })).status, 200);
  await t.test('status exposes only own subscription count', async () => {
    const statusB = await (await fetch(app.base + '/api/push/status', { headers: b })).json();
    assert.equal(statusB.activeSubscribers, 0);
    const statusA = await (await fetch(app.base + '/api/push/status', { headers: app.authHeaders })).json();
    assert.equal(statusA.activeSubscribers, 1);
  });
  await t.test('forged target UID cannot broadcast to another owner', async () => {
    const result = await (await postB('/api/push/send', { title: 'fixture', uid: 'fixture-user-a',
      ownerUid: 'fixture-user-a', audience: 'all' })).json();
    assert.equal(result.sent, 0);
    assert.equal(await readFile(capture, 'utf8').catch(() => ''), '');
  });
  await t.test('a subscription cannot be reassigned by another account', async () => {
    assert.equal((await postB('/api/push/subscribe', sub)).status, 409);
  });
  await t.test('foreign and missing unsubscribe endpoints are indistinguishable', async () => {
    assert.equal((await postB('/api/push/unsubscribe', { endpoint: sub.endpoint })).status, 404);
    assert.equal((await postB('/api/push/unsubscribe', { endpoint: sub.endpoint + '-absent' })).status, 404);
    assert.equal((await post(app.base, '/api/push/unsubscribe', { endpoint: sub.endpoint })).status, 200);
  });
});
