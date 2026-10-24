import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { PushDestinations, PushRegistry, PushError, pushPayload, createPushSender } from '../src/server/pushDelivery.ts';
import { resolveProvider, postProviderBytes, EgressPolicyError } from '../src/server/providerEgress.ts';
import webpush from 'web-push';
import { startApp, post } from './server-helper.mjs';

const subscription = id => { const key = createECDH('prime256v1'); return {
  endpoint: `https://fcm.googleapis.com/fcm/send/fixture-${id}`, expirationTime: null,
  keys: { p256dh: key.generateKeys().toString('base64url'), auth: randomBytes(16).toString('base64url') } }; };

test('B05: exact server host policy, key schema and all DNS answers are enforced', async () => {
  const destinations = new PushDestinations();
  for (const endpoint of ['http://fcm.googleapis.com/fcm/send/a', 'https://fcm.googleapis.com:444/a',
    'https://fcm.googleapis.com.evil.test/a', 'https://fcm.googleapis.com./a',
    'https://user:fixture@fcm.googleapis.com/a', 'https://fcm.googleapis.com/a#b',
    'https://127.0.0.1/a', 'https://[::1]/a', 'https://169.254.169.254/a', 'https://evil.test/a'])
    assert.throws(() => destinations.subscription({ ...subscription('a'), endpoint }), PushError);
  for (const raw of ['null', '{}', '["*.example.com"]', '["127.0.0.1"]', '["host.test:443"]', '["UPPER.test"]'])
    assert.throws(() => new PushDestinations(raw), PushError);
  assert.equal(new PushDestinations('["push.example.com"]').endpoint('https://push.example.com/token?a=b'), 'https://push.example.com/token?a=b');
  for (const change of [{ keys: {} }, { keys: { p256dh: 'x', auth: 'x' } }, { expirationTime: 0 },
    { keys: { p256dh: Buffer.alloc(65, 4).toString('base64url'), auth: randomBytes(16).toString('base64url') } }])
    assert.throws(() => destinations.subscription({ ...subscription('a'), ...change }), PushError);
  const provider = destinations.provider(subscription('a').endpoint);
  assert.equal(provider.localException, undefined);
  for (const address of ['127.0.0.1', '10.1.1.1', '169.254.169.254', '::ffff:127.0.0.1', 'fc00::1'])
    await assert.rejects(resolveProvider(provider, async () => [{ address: '8.8.8.8', family: 4 },
      { address, family: address.includes(':') ? 6 : 4 }]), EgressPolicyError);
});

test('B05: send audience and expiry cleanup stay within the owner, even during replacement', async () => {
  const destinations = new PushDestinations(), calls = [];
  let release;
  const registry = new PushRegistry(destinations, async (sub, payload) => {
    calls.push({ endpoint: sub.endpoint, payload });
    if (sub.endpoint.endsWith('fixture-a')) return new Promise(resolve => { release = resolve; });
    return 201;
  });
  const a = subscription('a'), b = subscription('b');
  registry.subscribe('a', a); registry.subscribe('b', b);
  const running = registry.dispatch('a', 'fixture-a-only');
  registry.unsubscribe('a', a.endpoint);
  registry.subscribe('b', a);
  release(410); await running;
  assert.equal(registry.count('b'), 2, 'late expiry cannot delete a replacement record');
  assert.equal(registry.count('a'), 0);
  assert.deepEqual(calls, [{ endpoint: a.endpoint, payload: 'fixture-a-only' }]);
  // A request already transmitted cannot be recalled; later candidates are rechecked.
  assert.deepEqual(await registry.dispatch('a', 'fixture-no-audience'), {
    sent: 0, failed: 0, total: 0, delivery: 'service_acceptance_only' });
});

test('B05: service acceptance, failures and owned expiry are reported separately', async () => {
  const registry = new PushRegistry(new PushDestinations(), async sub => sub.endpoint.endsWith('fixture-expired') ? 410 : 201);
  registry.subscribe('a', subscription('ok')); registry.subscribe('a', subscription('expired'));
  registry.subscribe('b', subscription('b'));
  assert.deepEqual(await registry.dispatch('a', 'fixture'), { sent: 1, failed: 1, total: 1, delivery: 'service_acceptance_only' });
  assert.equal(registry.count('b'), 1);
});

test('B05: scheduled callbacks retain their UID, respect unsubscribe and have bounded capacity', async t => {
  const calls = [], registry = new PushRegistry(new PushDestinations(), async sub => { calls.push(sub.endpoint); return 201; });
  t.after(() => registry.dispose());
  const a = subscription('a'); registry.subscribe('a', a); registry.subscribe('b', subscription('b'));
  registry.schedule('a', 'fixture', 1);
  registry.unsubscribe('a', a.endpoint);
  await new Promise(resolve => setTimeout(resolve, 20)); assert.deepEqual(calls, []);
  for (let n = 0; n < 10; n++) registry.schedule('a', 'fixture', 60000);
  assert.throws(() => registry.schedule('a', 'fixture', 60000), error => error.status === 429);
  for (let n = 0; n < 5; n++) registry.subscribe('a', subscription(String(n)));
  assert.throws(() => registry.subscribe('a', subscription('over-limit')), error => error.status === 429);
});

test('B05: active delivery limits remain held until sends finish', async () => {
  const releases = [], registry = new PushRegistry(new PushDestinations(), () => new Promise(resolve => releases.push(resolve)));
  registry.subscribe('a', subscription('a'));
  const first = registry.dispatch('a', 'fixture'), second = registry.dispatch('a', 'fixture');
  await assert.rejects(registry.dispatch('a', 'fixture'), error => error.status === 429);
  releases.forEach(release => release(201)); await Promise.all([first, second]);
  registry.unsubscribe('a', subscription('a').endpoint);
  assert.equal((await registry.dispatch('a', 'fixture')).sent, 0);
});

test('B05: binary push transport keeps ciphertext intact and never follows a redirect', async t => {
  const received = [], server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    received.push({ data: Buffer.concat(chunks), auth: req.headers.authorization, host: req.headers.host });
    if (req.url === '/redirect') { res.writeHead(307, { Location: 'http://169.254.169.254/' }); res.end(); }
    else { res.writeHead(201); res.end(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const target = { id: 'fixture-push', kind: 'openai-compatible', allowByok: false, endpoint: `http://push.fixture:${port}/ok`,
    localException: { providerId: 'fixture-push', hostname: 'push.fixture', port, addresses: ['127.0.0.1'] } };
  const resolve = async () => [{ address: '127.0.0.1', family: 4 }];
  const body = Buffer.from([0, 255, 1, 128, 42]);
  assert.equal((await postProviderBytes(target, body, { Authorization: 'fixture-vapid', TTL: 60,
    'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm' }, 1000, resolve)).status, 201);
  assert.deepEqual(received[0], { data: body, auth: 'fixture-vapid', host: `push.fixture:${port}` });
  await assert.rejects(postProviderBytes({ ...target, endpoint: target.endpoint.replace('/ok', '/redirect') }, body, {}, 1000, resolve), EgressPolicyError);
  for (const headers of [{ Host: 'evil.test' }, { Cookie: 'fixture' }, { Authorization: 'fixture\r\nInjected: 1' }])
    await assert.rejects(postProviderBytes(target, body, headers, 1000, resolve), EgressPolicyError);
  assert.equal(received.length, 2);
});

test('B05: payload/navigation and HTTP validation reject oversized or off-origin inputs before sending', async t => {
  for (const input of [{ delayMs: '1000' }, { delayMs: 86400001 }, { delayMs: -1 }, { url: 'https://evil.test' },
    { icon: '//evil.test/a' }, { badge: '/\\evil.test/a' }, { title: {} }, { body: 'á'.repeat(1800) }])
    assert.throws(() => pushPayload(input), PushError);
  const app = await startApp(); t.after(() => app.stop());
  for (const body of [{ ...subscription('a'), endpoint: 'https://127.0.0.1/a' }, { ...subscription('a'), keys: {} }])
    assert.equal((await post(app.base, '/api/push/subscribe', body)).status, 400);
  assert.equal((await post(app.base, '/api/push/send', { delayMs: 86400001 })).status, 400);
  const scheduled = await post(app.base, '/api/push/send', { delayMs: 50000 });
  assert.equal(scheduled.status, 202);
  assert.deepEqual(await scheduled.json(), { success: true, scheduled: true, delayMs: 50000,
    delivery: 'not_attempted', durable: false });
});

test('B05: real Web Push encryption generates ciphertext locally without a service call', () => {
  const keys = webpush.generateVAPIDKeys();
  webpush.setVapidDetails('mailto:fixture@example.test', keys.publicKey, keys.privateKey);
  const sub = new PushDestinations().subscription(subscription('crypto'));
  const details = webpush.generateRequestDetails(sub, 'fixture-sensitive-text', { TTL: 60, contentEncoding: 'aes128gcm' });
  assert.ok(Buffer.isBuffer(details.body)); assert.ok(details.body.length > 20);
  assert.ok(!details.body.includes(Buffer.from('fixture-sensitive-text')));
  assert.match(details.headers.Authorization, /^vapid /);
  assert.equal(typeof createPushSender(new PushDestinations()), 'function');
});
