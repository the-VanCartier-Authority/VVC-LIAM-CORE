// Integration regression for B05 binary transport + I11b chat cancellation.
// Local sockets, synthetic ciphertext/authorization, no push service or inference.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { postProvider, postProviderBytes } from '../src/server/providerEgress.ts';

async function fixture(t) {
  const received = [], closed = [];
  let receive;
  const held = new Promise(resolve => { receive = resolve; });
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    received.push({ path: req.url, body: Buffer.concat(chunks), authorization: req.headers.authorization,
      contentType: req.headers['content-type'] });
    res.on('close', () => closed.push(req.url));
    if (req.url === '/hold') { res.writeHead(200); res.write('{'); receive(); }
    else { res.writeHead(201); res.end('{}'); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const port = server.address().port;
  const target = path => ({ id: 'combination', kind: 'openai-compatible', allowByok: true,
    endpoint: `http://combination.fixture:${port}${path}`,
    localException: { providerId: 'combination', hostname: 'combination.fixture', port, addresses: ['127.0.0.1'] } });
  return { target, received, held, closed };
}
const dns = async () => [{ address: '127.0.0.1', family: 4 }];
test('integration B05/I11b: an already cancelled binary request performs no DNS or HTTP', async t => {
  const f = await fixture(t), controller = new AbortController(); controller.abort(); let lookups = 0;
  await assert.rejects(postProviderBytes(f.target('/ok'), Buffer.from([0, 255, 13]),
    { Authorization: 'synthetic-vapid', 'Content-Type': 'application/octet-stream' }, 1000,
    async () => { lookups++; return dns(); }, controller.signal), /solicitud fue cancelada/);
  assert.equal(lookups, 0); assert.equal(f.received.length, 0);
});
test('integration B05/I11b: binary abort preserves exact bytes and leaves later JSON/binary requests usable', async t => {
  const f = await fixture(t), controller = new AbortController(), ciphertext = Buffer.from([0, 255, 128, 13, 10, 0]);
  const headers = { Authorization: 'synthetic-vapid', 'Content-Type': 'application/octet-stream', TTL: 30 };
  const pending = postProviderBytes(f.target('/hold'), ciphertext, headers, 1000, dns, controller.signal);
  await f.held; controller.abort(); await assert.rejects(pending, /solicitud fue cancelada/);
  for (let i = 0; i < 100 && !f.closed.includes('/hold'); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(f.closed.includes('/hold'));
  assert.deepEqual(f.received[0].body, ciphertext); assert.equal(f.received[0].authorization, 'synthetic-vapid');
  assert.equal((await postProvider(f.target('/json'), 'synthetic-byok', { content: 'fixture' }, 1000, dns)).status, 201);
  assert.equal((await postProviderBytes(f.target('/bytes'), ciphertext, headers, 1000, dns)).status, 201);
  assert.deepEqual(f.received.map(r => r.path), ['/hold', '/json', '/bytes']);
  assert.deepEqual(JSON.parse(f.received[1].body.toString()), { content: 'fixture' });
  assert.equal(f.received[1].authorization, 'Bearer synthetic-byok');
  assert.equal(f.received[1].contentType, 'application/json');
  assert.deepEqual(f.received[2].body, ciphertext); assert.equal(f.received[2].authorization, 'synthetic-vapid');
});
