import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startApp, post } from './server-helper.mjs';

test('I02: one server policy rejection governs every cloud chat route and its backups', async t => {
  const calls = [], fixture = createServer(async (req, res) => {
    for await (const _ of req) {} calls.push(req.url);
    res.end(JSON.stringify({ choices: [{ message: { content: 'fixture' } }] }));
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const port = fixture.address().port, dir = await mkdtemp(join(tmpdir(), 'vvc-chat-policy-')), capture = join(dir, 'calls');
  await writeFile(capture, '');
  const app = await startApp({ GEMINI_API_KEY: 'synthetic-gemini-server', F01_CAPTURE_FILE: capture,
    LLM_PROVIDERS_JSON: JSON.stringify(['nvidia', 'openai-compatible'].map((kind, index) => ({ id: `fixture-${index}`,
      kind, endpoint: `http://127.0.0.1:${port}/${index}`, allowByok: true,
      localException: { providerId: `fixture-${index}`, hostname: '127.0.0.1', port } }))) },
    ['./tests/fixtures/mock-gemini.mjs']);
  t.after(async () => { await app.stop(); fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve));
    await rm(dir, { recursive: true, force: true }); });
  for (const [route, providerId, model] of [['nvidia', 'fixture-0', 'fixture/model'],
    ['custom', 'fixture-1', 'fixture/model'], ['gemini', 'gemini', 'google/gemini-2.5-flash']]) {
    await t.test(route, async () => {
      const response = await post(app.base, `/api/chat/${route}`, { providerId, model, apiKey: 'synthetic-only',
        messages: [{ role: 'user', content: '<script>fixture</script>' }], prompt: '<script>fixture</script>',
        fallback: 'gemini-flash', isExclusiveAgent: true });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).policyApproved, false);
    });
  }
  await t.test('chat cannot bypass a priority downgrade rejection', async () => {
    const response = await post(app.base, '/api/chat/custom', { providerId: 'fixture-1', apiKey: 'synthetic-only',
      model: 'fixture/model', messages: [{ role: 'user', content: 'abrir bóveda' }], forcePriority: 'P2_LOW' });
    assert.equal(response.status, 403); assert.equal((await response.json()).code, 'PRIORITY_DOWNGRADE');
  });
  assert.deepEqual(calls, []); assert.equal(await readFile(capture, 'utf8'), '');
});
