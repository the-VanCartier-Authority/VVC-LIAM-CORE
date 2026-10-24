import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startApp, post } from './server-helper.mjs';

let app, dir, capture;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'vvc-f01-gemini-')); capture = join(dir, 'calls.jsonl');
  await writeFile(capture, '');
  app = await startApp({ GEMINI_API_KEY: 'synthetic-gemini-server', F01_CAPTURE_FILE: capture }, ['./tests/fixtures/mock-gemini.mjs']);
});
after(async () => { await app?.stop(); if (dir) await rm(dir, { recursive: true, force: true }); });
test('Gemini SDK keeps fixed Google origin for server key, BYOK, key test and NVIDIA fallback (mock only)', async () => {
  const response = await post(app.base, '/api/chat/gemini', { prompt: 'fixture', model: 'google/gemini-2.5-flash' });
  assert.equal(response.status, 200); assert.equal((await response.json()).text, 'gemini fixture');
  assert.equal((await post(app.base, '/api/chat/gemini', { prompt: 'fixture', apiKey: 'synthetic-gemini-byok' })).status, 200);
  assert.equal((await post(app.base, '/api/secrets/test', { provider: 'gemini', apiKey: 'synthetic-gemini-byok' })).status, 200);
  assert.equal((await post(app.base, '/api/chat/nvidia', { fallback: 'gemini-flash', messages: [{ role: 'user', content: 'fixture' }] })).status, 200);
  const calls = (await readFile(capture, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(calls.length, 4); assert.ok(calls.every(c => c.origin === 'https://generativelanguage.googleapis.com'));
  assert.deepEqual(calls.map(c => c.serverKey), [true, false, false, true]);
  assert.deepEqual(calls.map(c => c.byok), [false, true, true, false]);
});
test('Gemini client cannot replace the registered origin or select another provider', async () => {
  await writeFile(capture, '');
  for (const route of ['/api/chat/gemini', '/api/secrets/test']) {
    for (const input of [{ endpoint: 'https://evil.example/v1' }, { providerId: 'nvidia' }]) {
      const response = await post(app.base, route, { provider: 'gemini', prompt: 'fixture', ...input });
      assert.equal(response.status, 400); assert.equal((await response.json()).code, 'EGRESS_POLICY');
    }
  }
  assert.equal(await readFile(capture, 'utf8'), '');
});
