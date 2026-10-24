import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { once } from 'node:events';
import { ProviderRegistry, postProvider } from '../src/server/providerEgress.ts';
import { RequestAbortedError } from '../src/server/requestCancellation.ts';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function provider(port, secure = false, addresses = ['127.0.0.1']) {
  return new ProviderRegistry(JSON.stringify([{ id: 'fixture', kind: 'openai-compatible', allowByok: true,
    endpoint: (secure ? 'https' : 'http') + '://cancel.fixture:' + port + '/v1/chat/completions',
    localException: { providerId: 'fixture', hostname: 'cancel.fixture', port, addresses },
  }])).select('custom', { providerId: 'fixture' });
}
async function httpFixture(t, hold = false) {
  let ready, calls = 0, closed = false;
  const received = new Promise(resolve => { ready = resolve; });
  const server = createServer(async (req, res) => {
    for await (const _ of req) {}
    calls++;
    res.on('close', () => { closed = true; });
    if (hold) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{"choices":['); ready(); }
    else { res.end('{"fixture":true}'); ready(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return { target: provider(server.address().port), received, calls: () => calls, closed: () => closed };
}
test('I11b: cancellation before DNS sends neither lookup nor credential-bearing request', async t => {
  const fixture = await httpFixture(t), controller = new AbortController(); controller.abort();
  let lookups = 0;
  await assert.rejects(postProvider(fixture.target, 'synthetic-key', {}, 1000, async () => {
    lookups++; return [{ address: '127.0.0.1', family: 4 }];
  }, controller.signal), RequestAbortedError);
  assert.equal(lookups, 0); assert.equal(fixture.calls(), 0);
});
test('I11b: a DNS answer arriving after cancellation cannot dial its validated IP', async t => {
  const fixture = await httpFixture(t), controller = new AbortController(); let resolveDns;
  const pending = postProvider(fixture.target, 'synthetic-key', {}, 1000,
    () => new Promise(resolve => { resolveDns = resolve; }), controller.signal);
  controller.abort(); resolveDns([{ address: '127.0.0.1', family: 4 }]);
  await assert.rejects(pending, RequestAbortedError); await pause(20); assert.equal(fixture.calls(), 0);
});
test('I11b: a late DNS rejection is handled without further work', async t => {
  const fixture = await httpFixture(t), controller = new AbortController(); let rejectDns;
  const pending = postProvider(fixture.target, 'synthetic-key', {}, 1000,
    () => new Promise((_resolve, reject) => { rejectDns = reject; }), controller.signal);
  controller.abort(); await assert.rejects(pending, RequestAbortedError);
  rejectDns(Error('synthetic late DNS error')); await pause(20); assert.equal(fixture.calls(), 0);
});
test('I11b: aborting a partial upstream response rejects and closes its socket', async t => {
  const fixture = await httpFixture(t, true), controller = new AbortController();
  const pending = postProvider(fixture.target, 'synthetic-key', {}, 5000,
    async () => [{ address: '127.0.0.1', family: 4 }], controller.signal);
  await fixture.received; controller.abort();
  await assert.rejects(pending, RequestAbortedError);
  for (let i = 0; i < 100 && !fixture.closed(); i++) await pause(10);
  assert.equal(fixture.closed(), true); assert.equal(fixture.calls(), 1);
});
test('I11b: abort during TLS handshake closes the connection without HTTP credentials or an IP retry', async t => {
  const sockets = new Set(), chunks = []; let hello, closed = false, connections = 0;
  const received = new Promise(resolve => { hello = resolve; });
  const server = createTcpServer(socket => {
    sockets.add(socket); connections++;
    socket.on('data', chunk => { chunks.push(chunk); hello(); });
    socket.on('close', () => { sockets.delete(socket); closed = true; });
    socket.on('error', () => {});
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); });
  const target = provider(server.address().port, true, ['127.0.0.1', '127.0.0.2']), controller = new AbortController();
  const pending = postProvider(target, 'synthetic-tls-secret', {}, 5000,
    async () => [{ address: '127.0.0.1', family: 4 }, { address: '127.0.0.2', family: 4 }], controller.signal);
  await received; controller.abort(); await assert.rejects(pending, RequestAbortedError);
  for (let i = 0; i < 100 && !closed; i++) await pause(10);
  assert.equal(closed, true); assert.equal(connections, 1);
  const bytes = Buffer.concat(chunks);
  assert.equal(bytes[0], 0x16);
  assert.equal(bytes.includes(Buffer.from('synthetic-tls-secret')), false);
  assert.equal(bytes.includes(Buffer.from('Authorization:')), false);
});
test('I11b: an active signal preserves a normal complete response', async t => {
  const fixture = await httpFixture(t), controller = new AbortController();
  const response = await postProvider(fixture.target, 'synthetic-key', {}, 1000,
    async () => [{ address: '127.0.0.1', family: 4 }], controller.signal);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { fixture: true });
  controller.abort(); assert.equal(fixture.calls(), 1);
});
