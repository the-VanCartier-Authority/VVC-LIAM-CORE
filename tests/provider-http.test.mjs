import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createServer as createTlsServer } from 'node:https';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { postProvider, ProviderRegistry, UpstreamError } from '../src/server/providerEgress.ts';
import { startApp, post } from './server-helper.mjs';

let app, server, redirectTarget, tlsServer, dir, tlsPort, port, targetPort;
const calls = [], redirected = [], tlsCalls = [];
const messages = [{ role: 'user', content: 'fixture' }];
const local = (id, kind, hostname, port, path, extra = {}) => ({ id, kind,
  endpoint: `http://${hostname.includes(':') ? `[${hostname}]` : hostname}:${port}/${path}`, allowByok: true,
  localException: { providerId: id, hostname, port, ...(hostname === 'localhost' ? { addresses: ['127.0.0.1', '::1'] } : {}) }, ...extra });
const listen = async (server, hostname = '127.0.0.1') => { server.listen(0, hostname); await once(server, 'listening'); return server.address().port; };
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
before(async () => {
  redirectTarget = createServer((_req, res) => { redirected.push(true); res.end('must not be called'); });
  targetPort = await listen(redirectTarget);
  server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    calls.push({ path: req.url, auth: req.headers.authorization, body, host: req.headers.host });
    if (req.url.startsWith('/redirect/')) {
      res.writeHead(Number(req.url.split('/')[2]), { Location: `http://127.0.0.1:${targetPort}/stolen` }); res.end(); return;
    }
    if (req.url === '/error') { res.writeHead(401); res.end('echoed synthetic-provider-key'); return; }
    if (req.url === '/large') { res.end('x'.repeat(4 * 1024 * 1024 + 1)); return; }
    if (req.url === '/empty') { res.writeHead(204); res.end(); return; }
    res.setHeader('Content-Type', 'application/json');
    if (body.model === 'fixture/retry') res.statusCode = 503;
    res.end(JSON.stringify({ choices: [{ message: { content: 'fixture response' } }] }));
  });
  port = await listen(server, '::');
  // Disposable test certificate/key, generated locally; only the child app trusts it.
  dir = await mkdtemp(join(tmpdir(), 'vvc-f01-tls-'));
  const certPath = join(dir, 'localhost.pem'), keyPath = join(dir, 'localhost.key');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', keyPath, '-out', certPath, '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
  tlsServer = createTlsServer({ key: await readFile(keyPath), cert: await readFile(certPath) }, async (req, res) => {
    tlsCalls.push({ auth: req.headers.authorization, sni: req.socket.servername, host: req.headers.host });
    for await (const _ of req) {}
    res.end(JSON.stringify({ choices: [{ message: { content: 'tls fixture' } }] }));
  });
  tlsPort = await listen(tlsServer, '::');
  const registry = [
    local('nim', 'nvidia', '127.0.0.1', port, 'nim', { apiKeyEnv: 'FIXTURE_NIM_KEY' }),
    local('openai', 'openai-compatible', '127.0.0.1', port, 'openai', { apiKeyEnv: 'FIXTURE_OPENAI_KEY' }),
    local('ollama', 'ollama', '127.0.0.1', port, 'ollama/v1/chat/completions'),
    local('vllm', 'vllm', '127.0.0.1', port, 'vllm/v1/chat/completions'),
    local('ipv6', 'ollama', '::1', port, 'ipv6/v1/chat/completions'),
    local('no-byok', 'openai-compatible', '127.0.0.1', port, 'no-byok', { allowByok: false }),
    local('echo-error', 'openai-compatible', '127.0.0.1', port, 'error'),
    local('large', 'openai-compatible', '127.0.0.1', port, 'large'),
    ...[301, 302, 303, 307, 308].map(code => local(`redirect-${code}`, 'openai-compatible', '127.0.0.1', port, `redirect/${code}`)),
    local('redirect-nim', 'nvidia', '127.0.0.1', port, 'redirect/302/nim', { apiKeyEnv: 'FIXTURE_NIM_KEY' }),
    local('tls', 'openai-compatible', 'localhost', tlsPort, 'tls', { endpoint: `https://localhost:${tlsPort}/tls` }),
    local('tls-wrong-host', 'openai-compatible', '127.0.0.1', tlsPort, 'tls', { endpoint: `https://127.0.0.1:${tlsPort}/tls` }),
  ];
  app = await startApp({ LLM_PROVIDERS_JSON: JSON.stringify(registry), NODE_EXTRA_CA_CERTS: certPath,
    NVIDIA_API_KEY: 'synthetic-default-nvidia', GEMINI_API_KEY: '',
    FIXTURE_NIM_KEY: 'synthetic-nim', FIXTURE_OPENAI_KEY: 'synthetic-openai' });
});
after(async () => { await app?.stop(); await Promise.all([server, redirectTarget, tlsServer].filter(Boolean).map(close));
  if (dir) await rm(dir, { recursive: true, force: true }); });

test('NVIDIA primary, retry and key test use only the registered NIM and its own key', async () => {
  calls.length = 0;
  let response = await post(app.base, '/api/chat/nvidia', { providerId: 'nim', messages, model: 'fixture/model' });
  assert.equal(response.status, 200); assert.equal((await response.json()).model_used, 'fixture/model');
  response = await post(app.base, '/api/chat/nvidia', { providerId: 'nim', messages, model: 'fixture/retry' });
  assert.equal(response.status, 200);
  assert.match((await response.json()).model_used, /Llama/);
  response = await post(app.base, '/api/secrets/test', { provider: 'nvidia', providerId: 'nim' });
  assert.equal(response.status, 200); assert.equal((await response.json()).success, true);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(c => c.path === '/nim' && c.auth === 'Bearer synthetic-nim'));
  assert.deepEqual(calls.map(c => c.body.model), ['fixture/model', 'fixture/retry',
    'meta/llama-3.2-11b-vision-instruct', 'meta/llama-3.2-11b-vision-instruct']);
});

for (const id of ['openai', 'ollama', 'vllm', 'ipv6']) test(`preserves ${id} OpenAI chat contract, BYOK and key test`, async () => {
  calls.length = 0;
  let response = await post(app.base, '/api/chat/custom', { providerId: id, apiKey: 'synthetic-byok', model: 'fixture/model', messages });
  assert.equal(response.status, 200); assert.equal((await response.json()).choices[0].message.content, 'fixture response');
  assert.equal(calls[0].body.model, 'fixture/model'); assert.deepEqual(calls[0].body.messages, messages);
  assert.equal(calls[0].auth, 'Bearer synthetic-byok');
  response = await post(app.base, '/api/secrets/test', { provider: 'custom', providerId: id, apiKey: 'synthetic-byok' });
  assert.equal(response.status, 200); assert.equal((await response.json()).success, true);
  assert.equal(calls[1].auth, 'Bearer synthetic-byok');
});

test('legacy exact registered endpoint works; credential-free Ollama never inherits NVIDIA key', async () => {
  calls.length = 0;
  assert.equal((await post(app.base, '/api/chat/custom', { endpoint: `http://127.0.0.1:${port}/ollama/v1/chat/completions`, messages })).status, 200);
  assert.equal(calls[0].auth, undefined);
  assert.equal((await post(app.base, '/api/chat/custom', { providerId: 'openai', messages })).status, 200);
  assert.equal(calls[1].auth, 'Bearer synthetic-openai');
});

test('request cannot enlarge local exceptions, switch provider keys, disable TLS or change registered paths', async () => {
  calls.length = 0;
  for (const body of [
    { endpoint: `http://127.0.0.1:${targetPort}/stolen`, localException: { providerId: 'openai', hostname: '127.0.0.1', port: targetPort } },
    { providerId: 'openai', endpoint: `http://127.0.0.1:${port}/other` },
    { providerId: 'nvidia' }, { providerId: 'gemini' },
    { providerId: 'no-byok', apiKey: 'synthetic-byok' },
    { providerId: 'tls', endpoint: `http://localhost:${tlsPort}/tls`, rejectUnauthorized: false },
  ]) assert.equal((await post(app.base, '/api/chat/custom', { ...body, messages })).status, 400);
  assert.equal(calls.length, 0); assert.equal(redirected.length, 0);
});

for (const status of [301, 302, 303, 307, 308]) test(`rejects HTTP ${status} without forwarding server keys or BYOK`, async () => {
  calls.length = 0;
  for (const route of ['/api/chat/custom', '/api/secrets/test']) {
    const response = await post(app.base, route, { provider: 'custom', providerId: `redirect-${status}`, apiKey: 'synthetic-byok', messages });
    assert.equal(response.status, 400); assert.equal((await response.json()).code, 'EGRESS_POLICY');
  }
  assert.equal(calls.length, 2); assert.equal(redirected.length, 0);
});

test('NVIDIA policy error stops retry and fallback; secret test rejects redirects too', async () => {
  calls.length = 0;
  for (const route of ['/api/chat/nvidia', '/api/secrets/test']) {
    const response = await post(app.base, route, { provider: 'nvidia', providerId: 'redirect-nim', model: 'fixture/retry', messages });
    assert.equal(response.status, 400); assert.equal((await response.json()).code, 'EGRESS_POLICY');
  }
  assert.equal(calls.length, 2, 'no retry after a policy rejection');
  assert.equal(redirected.length, 0);
});

test('HTTPS verifies CA and hostname and preserves SNI before sending credentials', async () => {
  tlsCalls.length = 0;
  let response = await post(app.base, '/api/chat/custom', { providerId: 'tls', apiKey: 'synthetic-byok', messages });
  assert.equal(response.status, 200); assert.equal((await response.json()).choices[0].message.content, 'tls fixture');
  assert.deepEqual(tlsCalls, [{ auth: 'Bearer synthetic-byok', sni: 'localhost', host: `localhost:${tlsPort}` }]);
  response = await post(app.base, '/api/chat/custom', { providerId: 'tls-wrong-host', apiKey: 'synthetic-byok', messages });
  assert.equal(response.status, 502); assert.equal(tlsCalls.length, 1, 'hostname mismatch must send no HTTP headers');
  const target = new ProviderRegistry(JSON.stringify([local('untrusted', 'openai-compatible', 'localhost', tlsPort, 'tls',
    { endpoint: `https://localhost:${tlsPort}/tls` })])).select('custom', { providerId: 'untrusted' });
  await assert.rejects(postProvider(target, 'synthetic-byok', {}), UpstreamError);
  assert.equal(tlsCalls.length, 1, 'untrusted CA must send no HTTP headers');
});

test('provider error bodies cannot echo keys; oversized bodies fail without exposing them', async () => {
  for (const route of ['/api/chat/custom', '/api/secrets/test']) {
    const response = await post(app.base, route, { provider: 'custom', providerId: 'echo-error', apiKey: 'synthetic-provider-key', messages });
    assert.equal(response.status, 401); assert.doesNotMatch(await response.text(), /synthetic-provider-key/);
  }
  const response = await post(app.base, '/api/chat/custom', { providerId: 'large', messages });
  assert.equal(response.status, 502); assert.equal((await response.json()).code, 'UPSTREAM_ERROR');
  const target = new ProviderRegistry(JSON.stringify([local('empty', 'openai-compatible', '127.0.0.1', port, 'empty')]))
    .select('custom', { providerId: 'empty' });
  assert.equal((await postProvider(target, '', {})).status, 204);
});
