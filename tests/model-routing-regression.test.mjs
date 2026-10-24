import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startApp, post } from './server-helper.mjs';

test('I03a/F08: Gemma and DiffusionGemma cannot be silently replaced by Gemini Flash', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'vvc-routing-')), capture = join(dir, 'calls');
  await writeFile(capture, '');
  const app = await startApp({ GEMINI_API_KEY: 'synthetic-gemini-server', F01_CAPTURE_FILE: capture },
    ['./tests/fixtures/mock-gemini.mjs']);
  t.after(async () => { await app.stop(); await rm(dir, { recursive: true, force: true }); });
  for (const model of ['google/gemma-4-31b-it', 'google/diffusiongemma-26b-a4b-it']) {
    await t.test(model, async () => {
      const response = await post(app.base, '/api/chat/gemini', { model, prompt: 'fixture' });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, 'MODEL_PROVIDER_MISMATCH');
    });
  }
  await t.test('another provider is never used implicitly when NVIDIA has no key', async () => {
    const response = await post(app.base, '/api/chat/nvidia', { model: 'google/gemma-4-31b-it', messages: [] });
    assert.equal(response.status, 401); assert.equal((await response.json()).code, 'MISSING_API_KEY');
  });
});

test('I03a: a failed chosen NIM never invokes a replacement model without explicit fallback', async t => {
  const models = [], fixture = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks)); models.push(payload.model);
    res.writeHead(payload.model === 'google/gemma-4-31b-it' ? 503 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'fixture replacement' } }] }));
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  t.after(() => new Promise(resolve => fixture.close(resolve)));
  const port = fixture.address().port;
  const app = await startApp({ LLM_PROVIDERS_JSON: JSON.stringify([{ id: 'fixture-nim', kind: 'nvidia',
    endpoint: `http://127.0.0.1:${port}/nim`, allowByok: true,
    localException: { providerId: 'fixture-nim', hostname: '127.0.0.1', port } }]) });
  t.after(() => app.stop());
  const response = await post(app.base, '/api/chat/nvidia', { providerId: 'fixture-nim', apiKey: 'synthetic-nim',
    model: 'google/gemma-4-31b-it', messages: [] });
  assert.equal(response.status, 502);
  assert.deepEqual(models, ['google/gemma-4-31b-it']);
});
