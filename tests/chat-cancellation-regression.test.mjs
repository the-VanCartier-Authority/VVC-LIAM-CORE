import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startApp } from './server-helper.mjs';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function setupFixture(t, kind) {
  let ready, release, closed = false;
  const received = new Promise(resolve => { ready = resolve; });
  const server = createServer(async (req, res) => {
    for await (const _ of req) {}
    res.on('close', () => { closed = true; });
    release = () => { if (!res.destroyed) { res.writeHead(500); res.end('{}'); } };
    ready();
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const port = server.address().port;
  return { received, release: () => release(), closed: () => closed, registry: JSON.stringify([
    { id: 'fixture', kind, endpoint: 'http://127.0.0.1:' + port + '/v1/chat/completions', allowByok: true,
      localException: { providerId: 'fixture', hostname: '127.0.0.1', port } },
  ]) };
}
async function captureDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'vvc-cancel-')); t.after(() => rm(directory, { recursive: true, force: true }));
  return join(directory, 'capture.txt');
}
function send(app, path, body, signal) {
  return fetch(app.base + path, { method: 'POST', headers: { ...app.authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal }).catch(error => error);
}
test('I11b: disconnect closes an already transmitted custom-provider request', async t => {
  const fixture = await setupFixture(t, 'openai-compatible'), app = await startApp({ LLM_PROVIDERS_JSON: fixture.registry }); t.after(() => app.stop());
  const controller = new AbortController();
  const request = send(app, '/api/chat/custom', { providerId: 'fixture', model: 'fixture', messages: [{ role: 'user', content: 'fixture' }] }, controller.signal);
  await fixture.received; controller.abort(); await request;
  for (let i = 0; i < 100 && !fixture.closed(); i++) await pause(10);
  assert.equal(fixture.closed(), true);
});
test('I11b: a disconnected NVIDIA request cannot start its explicit Gemini fallback', async t => {
  const fixture = await setupFixture(t, 'nvidia'), capture = await captureDirectory(t);
  const app = await startApp({ LLM_PROVIDERS_JSON: fixture.registry, GEMINI_API_KEY: 'synthetic-gemini-server', F01_CAPTURE_FILE: capture }, ['./tests/fixtures/mock-gemini.mjs']); t.after(() => app.stop());
  const controller = new AbortController();
  const request = send(app, '/api/chat/nvidia', { providerId: 'fixture', model: 'fixture', apiKey: 'synthetic-nim',
    messages: [{ role: 'user', content: 'fixture' }], fallback: 'gemini-flash' }, controller.signal);
  await fixture.received; controller.abort(); await request; await pause(100); fixture.release(); await pause(500);
  const calls = await readFile(capture, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  assert.equal(calls, '');
});
test('I11b: disconnect propagates to the Gemini SDK abort signal', async t => {
  const capture = await captureDirectory(t), app = await startApp({ GEMINI_API_KEY: 'synthetic-gemini-server', F01_CAPTURE_FILE: capture }, ['./tests/fixtures/cancellable-gemini.mjs']); t.after(() => app.stop());
  const controller = new AbortController();
  const request = send(app, '/api/chat/gemini', { prompt: 'fixture' }, controller.signal);
  let content = '';
  for (let i = 0; i < 100; i++) { content = await readFile(capture, 'utf8').catch(() => ''); if (content.includes('started')) break; await pause(10); }
  assert.match(content, /started/); controller.abort(); await request;
  for (let i = 0; i < 100; i++) { content = await readFile(capture, 'utf8'); if (content.includes('aborted')) break; await pause(10); }
  assert.match(content, /aborted/);
});
