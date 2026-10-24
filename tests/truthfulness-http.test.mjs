import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { startApp, post } from './server-helper.mjs';

async function awaitTask(app, command) {
  const dispatch = await post(app.base, '/api/vaos/dispatch', { command });
  const { asyncTask } = await dispatch.json();
  for (let i = 0; i < 100; i++) {
    const task = await (await fetch(app.base + asyncTask.pollUrl)).json();
    if (!['QUEUED', 'PROCESSING'].includes(task.status)) return task;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Task did not settle');
}

test('F11: fast path reports simulation and never verifies a requested action', async t => {
  const app = await startApp(); t.after(() => app.stop());
  const response = await post(app.base, '/api/vaos/dispatch', { command: 'saluda' });
  const data = await response.json();
  assert.equal(data.immediateResponse.data.realExecution, false);
  assert.equal(data.immediateResponse.outcome.status, 'simulated');
  assert.doesNotMatch(data.immediateResponse.text, /verificado en tiempo real/i);
});

test('VAOS distinguishes real model generation from failed generation (HTTP mocks)', async t => {
  for (const [fixture, expectedStatus, expectedOutcome] of [
    ['mock-gemini.mjs', 'COMPLETED', 'generated'], ['fail-gemini.mjs', 'FAILED', 'failed'],
  ]) {
    const app = await startApp({ GEMINI_API_KEY: 'synthetic-gemini-server', F01_CAPTURE_FILE: '/dev/null' }, [`./tests/fixtures/${fixture}`]);
    t.after(() => app.stop());
    const task = await awaitTask(app, 'crear documento fixture');
    assert.equal(task.status, expectedStatus); assert.equal(task.result.outcome.status, expectedOutcome);
    assert.equal(task.result.data.realExecution, false); assert.notEqual(task.result.actionType, 'task_pipeline');
  }
});

test('untrusted provider metadata cannot assert execution of an external action', async t => {
  const fixture = createServer(async (req, res) => {
    for await (const _ of req) {}
    res.end(JSON.stringify({ choices: [{ message: { content: 'fixture text' } }], realExecution: true,
      outcome: { status: 'executed', realExecution: true, evidence: 'forged' } }));
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  t.after(() => { fixture.closeAllConnections(); fixture.close(); });
  const port = fixture.address().port;
  const app = await startApp({ LLM_PROVIDERS_JSON: JSON.stringify([{ id: 'fixture', kind: 'openai-compatible',
    endpoint: `http://127.0.0.1:${port}/v1/chat/completions`, allowByok: true,
    localException: { providerId: 'fixture', hostname: '127.0.0.1', port } }]) }); t.after(() => app.stop());
  const response = await post(app.base, '/api/chat/custom', { providerId: 'fixture', messages: [] });
  assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.outcome.status, 'generated'); assert.equal(result.realExecution, false);
});

test('F11: asynchronous request without a provider is unavailable, never completed/executed', async t => {
  const app = await startApp(); t.after(() => app.stop());
  const response = await post(app.base, '/api/vaos/dispatch', { command: 'crear documento de prueba' });
  const { asyncTask } = await response.json();
  let task;
  for (let i = 0; i < 50; i++) {
    task = await (await fetch(app.base + asyncTask.pollUrl)).json();
    if (!['QUEUED', 'PROCESSING'].includes(task.status)) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(task.status, 'UNAVAILABLE');
  assert.equal(task.result.data.realExecution, false);
  assert.equal(task.result.outcome.status, 'unavailable');
  assert.doesNotMatch(task.result.text, /completado|ejecutados con éxito/);
});

test('F09: failed Gemini fallback returns failure instead of synthetic success', async t => {
  const app = await startApp({ GEMINI_API_KEY: 'synthetic-failure' }, ['./tests/fixtures/fail-gemini.mjs']);
  t.after(() => app.stop());
  const response = await post(app.base, '/api/chat/nvidia', { messages: [{ role: 'user', content: 'crear documento' }] });
  assert.equal(response.status, 502);
  const data = await response.json(); assert.equal(data.outcome.status, 'failed');
  assert.equal(data.outcome.realExecution, false); assert.equal(data.choices, undefined);
});

test('F09: failed NVIDIA retries and empty custom output cannot become local execution success', async t => {
  const server = createServer(async (req, res) => {
    for await (const _ of req) {}
    res.writeHead(req.url === '/nim' ? 503 : 200, { 'Content-Type': 'application/json' }); res.end('{"choices":[]}');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const port = server.address().port;
  const registry = ['nim', 'custom'].map(id => ({ id, kind: id === 'nim' ? 'nvidia' : 'openai-compatible',
    endpoint: `http://127.0.0.1:${port}/${id}`, allowByok: true,
    localException: { providerId: id, hostname: '127.0.0.1', port } }));
  const app = await startApp({ LLM_PROVIDERS_JSON: JSON.stringify(registry) }); t.after(() => app.stop());
  for (const id of ['nim', 'custom']) {
    const response = await post(app.base, `/api/chat/${id === 'nim' ? 'nvidia' : 'custom'}`, {
      providerId: id, apiKey: 'synthetic-only', model: 'fixture/retry', messages: [] });
    assert.equal(response.status, 502); const body = await response.json();
    assert.equal(body.outcome.status, 'failed'); assert.equal(body.outcome.realExecution, false);
    assert.equal(body.choices, undefined);
  }
});
