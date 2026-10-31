import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchTaskWebhook } from '../src/utils/ical.ts';
const url = 'https://fixture.example.test/hooks/synthetic';
const task = { id: 'fixture', title: 'fixture task', dueDate: '2026-10-24', timeDue: '12:00', priority: 'alta',
  category: 'trabajo', isCompleted: false, recurrence: 'none', subtasks: [] };

test('D01: an observed webhook HTTP error cannot be turned into status 200/success', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('synthetic-secret-echo', { status: 403 }));
  const result = await dispatchTaskWebhook(url, 'created', task);
  assert.equal(result.success, false); assert.equal(result.status, 403); assert.equal(result.delivery, 'failed');
  assert.equal(result.realExecution, false); assert.doesNotMatch(JSON.stringify(result), /synthetic-secret-echo/);
});

test('D01: opaque/no-cors or missing receipts mean unverified delivery', async t => {
  const opaque = new Response(null); Object.defineProperty(opaque, 'type', { value: 'opaque' });
  Object.defineProperty(opaque, 'status', { value: 0 });
  t.mock.method(globalThis, 'fetch', async () => opaque);
  const result = await dispatchTaskWebhook(url, 'created', task);
  assert.equal(result.success, false); assert.equal(result.delivery, 'unverified');
  assert.equal(result.realExecution, false);
});

test('D01: observed acceptance preserves HTTP status and never proves downstream execution', async t => {
  let captured;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    captured = options;
    return new Response(null, { status: 202 });
  });
  const result = await dispatchTaskWebhook(url, 'created', task);
  assert.equal(result.success, true); assert.equal(result.status, 202); assert.equal(result.delivery, 'accepted');
  assert.equal(result.realExecution, false); assert.notEqual(result.outcome.status, 'executed');
  assert.equal(captured.mode, 'cors'); assert.equal(captured.credentials, 'omit'); assert.equal(captured.redirect, 'error');
});

test('D01: network/CORS failure has no receipt and must not invent one', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw Error('synthetic-sensitive-network-detail'); });
  const result = await dispatchTaskWebhook(url, 'created', task);
  assert.equal(result.success, false); assert.equal(result.delivery, 'unverified');
  assert.equal(result.status, undefined); assert.doesNotMatch(JSON.stringify(result), /synthetic-sensitive-network-detail/);
});

test('D01: invalid or credential-bearing webhook URLs have no attempted request', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(null, { status: 200 }); });
  for (const destination of ['not a url', 'https://user:synthetic@fixture.example.test/hooks', 'file:///tmp/fixture']) {
    const result = await dispatchTaskWebhook(destination, 'created', task);
    assert.equal(result.success, false); assert.equal(result.delivery, 'not_attempted');
  }
  assert.equal(calls, 0);
});
