import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startApp, post } from './server-helper.mjs';

let app, directory, capture;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vvc-f01-'));
  capture = join(directory, 'calls.jsonl');
  await writeFile(capture, '');
  app = await startApp({ NVIDIA_API_KEY: 'f01-synthetic-server', F01_CAPTURE_FILE: capture },
    ['./tests/fixtures/capture-fetch.mjs']);
});
after(async () => { await app?.stop(); await rm(directory, { recursive: true, force: true }); });

const endpoint = 'http://127.0.0.1:3199/f01-mock';
const messages = [{ role: 'user', content: 'fixture' }];
for (const [name, route, body] of [
  ['NVIDIA primary / server key', '/api/chat/nvidia', { endpoint, messages }],
  ['NVIDIA retry / server key', '/api/chat/nvidia', { endpoint, messages, model: 'fixture/retry' }],
  ['custom chat / BYOK', '/api/chat/custom', { endpoint, messages, apiKey: 'f01-synthetic-byok' }],
  ['NVIDIA key test / server key', '/api/secrets/test', { provider: 'nvidia', endpoint }],
  ['custom key test / BYOK', '/api/secrets/test', { provider: 'custom', endpoint, apiKey: 'f01-synthetic-byok' }],
]) {
  test(`F01 blocks unregistered destination: ${name}`, async () => {
    await writeFile(capture, '');
    const response = await post(app.base, route, body);
    const calls = (await readFile(capture, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
    // These fail on main before the fix, proving each HTTP sink forwards a synthetic credential.
    assert.equal(calls.length, 0, `Untrusted HTTP sends: ${calls.length}; synthetic server key: ${calls.some(c => c.serverCredential)}; synthetic BYOK: ${calls.some(c => c.byokCredential)}`);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'EGRESS_POLICY');
  });
}
