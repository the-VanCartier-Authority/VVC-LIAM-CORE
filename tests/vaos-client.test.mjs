import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
let adapter, poll;
async function modules() {
  if (adapter) return;
  const output = await build({ entryPoints: ['src/core/adapters/ApiClientAdapter.ts'], bundle: true, write: false, platform: 'node', format: 'esm',
    plugins: [{ name: 'fixture-transport', setup(b) {
      b.onResolve({ filter: /\/backendApi$/ }, () => ({ path: 'transport', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const backendFetch = async (url, options) => { globalThis.__vaosClientFixture.push({url, options}); return Response.json({}); };', loader: 'js' }));
    } }] });
  adapter = (await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))).ApiClientAdapter;
  poll = (await import('../src/core/vaosTaskView.ts')).taskPollView;
}
test('I10: real adapter sends idempotency in a header and explicit retry can reuse the same key', async t => {
  await modules(); globalThis.__vaosClientFixture = []; t.after(() => { delete globalThis.__vaosClientFixture; });
  const api = new adapter();
  await api.dispatchVaos({ command: 'fixture' }, 'fixture-request-key');
  await api.dispatchVaos({ command: 'fixture' }, 'fixture-request-key');
  await api.dispatchVaos({ command: 'fixture' });
  const calls = globalThis.__vaosClientFixture;
  assert.equal(calls[0].options.headers['Idempotency-Key'], calls[1].options.headers['Idempotency-Key']);
  assert.match(calls[2].options.headers['Idempotency-Key'], /^[0-9a-f-]{36}$/);
  assert.equal(JSON.parse(calls[0].options.body).idempotencyKey, undefined);
});
test('I10: cancelled, interrupted, failed, unavailable and timed-out polling cannot display a completed benchmark', async () => {
  await modules();
  for (const status of ['CANCELLED', 'INTERRUPTED', 'FAILED', 'UNAVAILABLE']) {
    const result = poll({ status }); assert.equal(result.stop, true); assert.match(result.text, new RegExp(status));
    assert.doesNotMatch(result.text, /Benchmark completado|Generación terminada/);
  }
  const pending = poll({ status: 'PROCESSING' }, true); assert.equal(pending.stop, true); assert.match(pending.text, /resultado no está disponible/);
  assert.equal(poll({ status: 'QUEUED' }).stop, false);
  assert.match(poll({ status: 'COMPLETED', durationMs: 12.5 }).text, /Generación terminada/);
});
