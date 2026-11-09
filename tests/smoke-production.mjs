import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { startApp, post } from './server-helper.mjs';

const index = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const asset = index.match(/src="(\/assets\/[^"\s]+\.js)"/)?.[1];
assert.ok(asset, 'build must exist before production smoke');
let calls = 0;
const fixture = createServer(async (req, res) => {
  calls++;
  for await (const _ of req) {}
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ choices: [{ message: { content: 'production fixture' } }] }));
});
fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
const port = fixture.address().port;
const endpoint = `http://127.0.0.1:${port}/v1/chat/completions`;
let app;
try {
  app = await startApp({ NVIDIA_API_KEY: 'synthetic-smoke-server', LLM_PROVIDERS_JSON: JSON.stringify([
    { id: 'smoke', kind: 'ollama', endpoint, allowByok: true,
      localException: { providerId: 'smoke', hostname: '127.0.0.1', port } },
  ]) });
  const root = await fetch(app.base);
  assert.equal(root.status, 200); assert.equal(await root.text(), index);
  assert.doesNotMatch(index, /@vite\/client/);
  assert.equal((await fetch(app.base + asset)).status, 200);
  assert.equal((await fetch(app.base + '/manifest.json')).status, 200);
  assert.equal((await fetch(app.base + '/api/vaos/tasks')).status, 401);
  assert.equal((await fetch(app.base + '/api/vaos/tasks', { headers: app.authHeaders })).status, 200);
  const config = await (await fetch(app.base + '/api/config')).text();
  assert.doesNotMatch(config, /synthetic-smoke-server/);
  assert.equal(JSON.parse(config).hasPushEnabled, false);
  assert.equal((await (await fetch(app.base + '/api/push/status', { headers: app.authHeaders })).json()).enabled, false);
  const push = await post(app.base, '/api/push/send', { title: 'synthetic disabled smoke', delayMs: 73 });
  assert.equal(push.status, 503); assert.equal((await push.json()).code, 'PUSH_DISABLED');
  for (const [route, provider] of [['/api/chat/nvidia', 'nvidia'], ['/api/chat/custom', 'custom'],
    ['/api/secrets/test', 'nvidia'], ['/api/secrets/test', 'custom']]) {
    const result = await post(app.base, route, { provider, endpoint: endpoint + '/unregistered',
      model: 'fixture/retry', messages: [{ role: 'user', content: 'fixture' }], apiKey: 'synthetic-smoke-byok' });
    assert.equal(result.status, 400); assert.equal((await result.json()).code, 'EGRESS_POLICY');
  }
  assert.equal(calls, 0);
  const accepted = await post(app.base, '/api/chat/custom', { providerId: 'smoke', model: 'fixture', messages: [] });
  assert.equal(accepted.status, 200); assert.equal((await accepted.json()).choices[0].message.content, 'production fixture');
  assert.equal(calls, 1);
  assert.equal((await post(app.base, '/api/chat/gemini', { prompt: 'fixture' })).status, 401);
  console.log(JSON.stringify({ node: process.version, mode: 'production', staticHtml: 200, asset: 200,
    manifest: 200, rejectedRoutes: 4, rejectedDestinationCalls: 0, registeredFixtureCalls: calls,
    missingGeminiKey: 401, missingIdentity: 401, validIdentity: 200, pushDisabled: 503, externalInferenceCalls: 0 }));
} finally {
  await app?.stop(); fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
}
