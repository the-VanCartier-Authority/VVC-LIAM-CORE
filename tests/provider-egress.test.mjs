import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { ProviderRegistry, providerKey, isPublicAddress, resolveProvider, assertConnectedPeer,
  postProvider, EgressPolicyError, UpstreamError } from '../src/server/providerEgress.ts';

const entry = (overrides = {}) => ({ id: 'fixture', kind: 'openai-compatible',
  endpoint: 'https://provider.example/v1/chat/completions', allowByok: true, ...overrides });
const provider = overrides => new ProviderRegistry(JSON.stringify([entry(overrides)])).select('custom', { providerId: 'fixture' });

test('registry alone defines destinations; legacy endpoints select an exact registered URL', () => {
  const registry = new ProviderRegistry(JSON.stringify([entry()]));
  assert.equal(registry.select('custom', { endpoint: entry().endpoint }).id, 'fixture');
  assert.equal(registry.select('nvidia', {}).endpoint, 'https://integrate.api.nvidia.com/v1/chat/completions');
  assert.equal(registry.select('gemini', {}).endpoint, 'https://generativelanguage.googleapis.com/v1beta');
  for (const input of [{}, { providerId: 'nvidia' }, { providerId: 'gemini' }, { providerId: {} },
    { providerId: 'fixture', endpoint: 'https://evil.example' }, { endpoint: 'https://provider.example/v1/chat/completions/extra' },
    { endpoint: 'https://provider.example.evil/v1/chat/completions' }, { endpoint: 'https://provider.example:444/v1/chat/completions' }])
    assert.throws(() => registry.select('custom', input), EgressPolicyError);
});

test('registry rejects malformed URLs, duplicate IDs/targets, unscoped exceptions and reused default secrets', () => {
  for (const endpoint of ['file:///tmp/fixture', 'ftp://provider.example', 'https://user:secret@provider.example',
    'https://provider.example?apiKey=fixture', 'https://provider.example/#fragment',
    'https://provider.example./v1', 'https://provider.example\\@evil.example', 'http://127.0.0.1:11434/v1/chat/completions'])
    assert.throws(() => provider({ endpoint }), EgressPolicyError);
  for (const overrides of [{ id: 'nvidia' }, { id: '*' }, { kind: 'gemini' }, { apiKeyEnv: 'NVIDIA_API_KEY' },
    { apiKeyEnv: 'GEMINI_API_KEY' }, { apiKeyEnv: 'bad-key' }, { allowByok: 'true' }, { allowPrivateNetwork: true },
    { localException: { providerId: '*', hostname: 'provider.example', port: 443 } },
    { localException: { providerId: 'fixture', hostname: '*', port: 443 } },
    { localException: { providerId: 'fixture', hostname: 'provider.example', port: 80 } },
    { localException: { providerId: 'fixture', hostname: 'provider.example', port: 443, all: true } }])
    assert.throws(() => provider(overrides), EgressPolicyError);
  for (const raw of ['null', '{}', '[null]', 'invalid', JSON.stringify([entry(), entry()]),
    JSON.stringify([entry(), entry({ id: 'other' })])]) assert.throws(() => new ProviderRegistry(raw), EgressPolicyError);
});

test('keys are bound to the selected provider and BYOK permission; placeholders never leave', () => {
  const target = provider({ apiKeyEnv: 'FIXTURE_API_KEY' });
  const env = { NVIDIA_API_KEY: 'synthetic-nvidia', GEMINI_API_KEY: 'synthetic-gemini', FIXTURE_API_KEY: 'synthetic-custom' };
  assert.equal(providerKey(target, undefined, env), 'synthetic-custom');
  assert.equal(providerKey(target, 'synthetic-byok', env), 'synthetic-byok');
  assert.equal(providerKey(provider(), undefined, env), '');
  assert.equal(providerKey(target, '', { FIXTURE_API_KEY: 'MY_FIXTURE_API_KEY' }), '');
  assert.throws(() => providerKey(provider({ allowByok: false }), 'synthetic-byok', env), EgressPolicyError);
  for (const value of [{}, 'key\r\nInjected: yes', 'key\0', 'x'.repeat(8193)])
    assert.throws(() => providerKey(target, value, env), EgressPolicyError);
});

for (const address of ['0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.169.254',
  '172.16.0.1', '192.0.0.1', '192.0.2.1', '192.88.99.1', '192.168.1.1', '198.18.0.1',
  '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '::', '::1',
  '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:8.8.8.8', 'fe80::1', 'fc00::1', 'ff02::1',
  '64:ff9b::a00:1', '2001::1', '2001:db8::1', '2002:7f00:1::1', '3fff::1', 'not-an-ip']) {
  test(`blocks non-public address ${address}`, () => assert.equal(isPublicAddress(address), false));
}

test('public IPv4 and IPv6 remain eligible; every DNS answer must pass', async () => {
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true);
  const target = provider();
  const publicAnswers = [{ address: '8.8.8.8', family: 4 }, { address: '2606:4700:4700::1111', family: 6 }];
  assert.deepEqual(await resolveProvider(target, async () => publicAnswers), publicAnswers);
  for (const bad of [[], [{ address: '8.8.8.8', family: 6 }], [{ address: 'bad', family: 4 }],
    [...publicAnswers, { address: '127.0.0.1', family: 4 }], [...publicAnswers, { address: '::1', family: 6 }]])
    await assert.rejects(resolveProvider(target, async () => bad), EgressPolicyError);
});

test('URL-normalized numeric IPv4 aliases cannot bypass IP checks', async () => {
  for (const hostname of ['2130706433', '0x7f000001', '0177.0.0.1', '127.1', '[::ffff:127.0.0.1]', '[::1]']) {
    const target = provider({ endpoint: `https://${hostname}/v1/chat/completions` });
    await assert.rejects(resolveProvider(target, async () => assert.fail('literal must not use DNS')), EgressPolicyError);
  }
});

test('local exceptions are exact and exclude metadata, unspecified, mapped and multicast addresses', async () => {
  const target = provider({ endpoint: 'http://local.fixture:11434/v1/chat/completions',
    localException: { providerId: 'fixture', hostname: 'local.fixture', port: 11434, addresses: ['127.0.0.1', '192.168.1.10', '::1', 'fc00::1'] } });
  for (const [address, family] of [['127.0.0.1', 4], ['192.168.1.10', 4], ['::1', 6], ['fc00::1', 6]])
    assert.equal((await resolveProvider(target, async () => [{ address, family }])).length, 1);
  for (const address of ['169.254.169.254', '0.0.0.0', '224.0.0.1', '8.8.8.8'])
    await assert.rejects(resolveProvider(target, async () => [{ address, family: 4 }]), EgressPolicyError);
  for (const address of ['fe80::1', '::', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1'])
    await assert.rejects(resolveProvider(target, async () => [{ address, family: 6 }]), EgressPolicyError);
  for (const change of [{ id: 'other' }, { endpoint: 'http://other.fixture:11434/v1/chat/completions' },
    { endpoint: 'http://local.fixture:11435/v1/chat/completions' }])
    await assert.rejects(resolveProvider({ ...target, ...change }, async () => [{ address: '127.0.0.1', family: 4 }]), EgressPolicyError);
});

test('connected peer must equal the validated IP and port before HTTP headers are sent', () => {
  const pinned = [{ address: '8.8.8.8', family: 4 }];
  assert.doesNotThrow(() => assertConnectedPeer(pinned, '8.8.8.8', 443, 443));
  for (const [address, port] of [['127.0.0.1', 443], ['8.8.4.4', 443], ['::1', 443], ['8.8.8.8', 80], [undefined, undefined]])
    assert.throws(() => assertConnectedPeer(pinned, address, port, 443), EgressPolicyError);
});

test('transport pins DNS once per connection and rejects changed DNS on the next attempt', async t => {
  const calls = [];
  const server = createServer(async (req, res) => {
    calls.push({ host: req.headers.host, auth: req.headers.authorization });
    res.end(JSON.stringify({ choices: [{ message: { content: 'fixture' } }] }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const target = provider({ endpoint: `http://rebind.fixture:${port}/v1/chat/completions`,
    localException: { providerId: 'fixture', hostname: 'rebind.fixture', port, addresses: ['127.0.0.1'] } });
  let resolutions = 0;
  const resolver = async () => [{ address: ++resolutions === 1 ? '127.0.0.1' : '169.254.169.254', family: 4 }];
  assert.equal((await postProvider(target, 'synthetic-byok', {}, 1000, resolver)).status, 200);
  assert.equal(resolutions, 1, 'connection must not perform a second DNS lookup');
  assert.deepEqual(calls, [{ host: `rebind.fixture:${port}`, auth: 'Bearer synthetic-byok' }]);
  await assert.rejects(postProvider(target, 'synthetic-byok', {}, 1000, resolver), EgressPolicyError);
  assert.equal(calls.length, 1, 'revalidated retry must not send to the changed destination');
});

test('DNS errors/timeouts and body timeouts produce sanitized errors and no retries', async t => {
  await assert.rejects(postProvider(provider(), 'synthetic-byok', {}, 20, async () => { throw Error('synthetic-secret'); }),
    error => error instanceof UpstreamError && !error.message.includes('synthetic-secret'));
  await assert.rejects(postProvider(provider(), '', {}, 20, () => new Promise(() => {})), UpstreamError);
  let calls = 0;
  const server = createServer((_req, res) => { calls++; res.writeHead(200); res.write('{'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const port = server.address().port;
  const target = provider({ endpoint: `http://127.0.0.1:${port}/v1/chat/completions`,
    localException: { providerId: 'fixture', hostname: '127.0.0.1', port } });
  await assert.rejects(postProvider(target, '', {}, 40), UpstreamError);
  assert.equal(calls, 1);
});

test('network address fallback uses only validated IPs and never duplicates a transmitted request', async t => {
  let calls = 0;
  const server = createServer((_req, res) => { calls++; res.end('{}'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const target = provider({ endpoint: `http://dual.fixture:${port}/v1/chat/completions`,
    localException: { providerId: 'fixture', hostname: 'dual.fixture', port, addresses: ['127.0.0.1', '127.0.0.2'] } });
  let resolutions = 0;
  const resolver = async () => { resolutions++; return [{ address: '127.0.0.2', family: 4 }, { address: '127.0.0.1', family: 4 }]; };
  assert.equal((await postProvider(target, 'synthetic-byok', {}, 1000, resolver)).status, 200);
  assert.equal(calls, 1); assert.equal(resolutions, 1);
});
