import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startApp, post } from './server-helper.mjs';
const command = 'crear documento fixture recovery';
async function environment(t) {
  const directory = await mkdtemp(join(tmpdir(), 'vvc-i10-http-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, VAOS_DATABASE_PATH: join(directory, 'tasks.sqlite'), F01_CAPTURE_FILE: join(directory, 'capture.txt') };
}
async function waitFor(app, path, expected) {
  for (let i = 0; i < 150; i++) {
    const response = await fetch(app.base + path, { headers: app.authHeaders }); assert.equal(response.status, 200);
    const task = await response.json(); if (task.status === expected) return task;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Expected task status ' + expected);
}
test('I10: queued work recovers once after SIGKILL; completed result and receipt survive another restart', async t => {
  const env = await environment(t);
  let app = await startApp({ ...env, VAOS_QUEUE_PAUSED: 'true', GEMINI_API_KEY: 'synthetic-gemini-server' });
  t.after(async () => { if (app) await app.stop(); });
  const submit = () => fetch(app.base + '/api/vaos/dispatch', { method: 'POST', headers: { ...app.authHeaders,
    'Content-Type': 'application/json', 'Idempotency-Key': 'fixture-durable-once' }, body: JSON.stringify({ command }) });
  const first = await (await submit()).json();
  assert.equal(first.asyncTask.status, 'QUEUED'); assert.equal(first.asyncTask.durable, true);
  await app.stop('SIGKILL'); app = null;
  app = await startApp({ ...env, GEMINI_API_KEY: 'synthetic-gemini-server' }, ['./tests/fixtures/mock-gemini.mjs']);
  const done = await waitFor(app, first.asyncTask.pollUrl, 'COMPLETED');
  assert.equal(done.result.outcome.status, 'generated'); assert.equal(done.result.outcome.realExecution, false);
  const other = { Authorization: `Bearer ${await app.identity.token('fixture-user-b')}` };
  assert.equal((await fetch(app.base + first.asyncTask.pollUrl, { headers: other })).status, 404);
  assert.equal((await readFile(env.F01_CAPTURE_FILE, 'utf8')).trim().split('\n').length, 1);
  await app.stop('SIGKILL'); app = null;
  app = await startApp({ ...env, GEMINI_API_KEY: 'synthetic-gemini-server' }, ['./tests/fixtures/mock-gemini.mjs']);
  const replay = await (await submit()).json(); assert.equal(replay.asyncTask.taskId, first.asyncTask.taskId);
  assert.equal(replay.asyncTask.status, 'COMPLETED');
  assert.equal((await readFile(env.F01_CAPTURE_FILE, 'utf8')).trim().split('\n').length, 1);
  assert.equal((await stat(env.VAOS_DATABASE_PATH)).mode & 0o777, 0o600);
  const bytes = await readFile(env.VAOS_DATABASE_PATH);
  assert.equal(bytes.includes(Buffer.from('synthetic-gemini-server')), false);
  assert.equal(bytes.includes(Buffer.from('fixture-durable-once')), false); // raw idempotency key is hashed
});
test('I10: processing interrupted by SIGKILL stays uncertain; explicit acknowledged retry gets a linked task', async t => {
  const env = await environment(t);
  let app = await startApp({ ...env, GEMINI_API_KEY: 'synthetic-gemini-server' }, ['./tests/fixtures/holding-gemini.mjs']);
  t.after(async () => { if (app) await app.stop(); });
  const { asyncTask } = await (await post(app.base, '/api/vaos/dispatch', { command })).json();
  await waitFor(app, asyncTask.pollUrl, 'PROCESSING');
  for (let i = 0; i < 100; i++) { try { if ((await readFile(env.F01_CAPTURE_FILE, 'utf8')).includes('generation-started')) break; } catch {} await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.equal((await readFile(env.F01_CAPTURE_FILE, 'utf8')).trim(), 'generation-started');
  await app.stop('SIGKILL'); app = null;
  app = await startApp({ ...env, GEMINI_API_KEY: 'synthetic-gemini-server' }, ['./tests/fixtures/mock-gemini.mjs']);
  const interrupted = await waitFor(app, asyncTask.pollUrl, 'INTERRUPTED');
  assert.equal(interrupted.result.data.generationMayHaveOccurred, true);
  assert.equal(interrupted.result.outcome.realExecution, false);
  assert.equal((await readFile(env.F01_CAPTURE_FILE, 'utf8')).trim(), 'generation-started');
  const retryPath = asyncTask.pollUrl + '/retry';
  assert.equal((await post(app.base, retryPath, {})).status, 409);
  assert.equal((await post(app.base, retryPath, { acknowledgeUncertainDelivery: true })).status, 400);
  const submit = () => fetch(app.base + retryPath, { method: 'POST', headers: { ...app.authHeaders, 'Content-Type': 'application/json',
    'Idempotency-Key': 'fixture-explicit-retry' }, body: JSON.stringify({ acknowledgeUncertainDelivery: true }) });
  const retry = await (await submit()).json(); assert.equal(retry.retryOf, asyncTask.taskId);
  const done = await waitFor(app, retry.pollUrl, 'COMPLETED'); assert.equal(done.retryOf, asyncTask.taskId);
  assert.equal((await (await submit()).json()).taskId, retry.taskId);
  const other = { Authorization: `Bearer ${await app.identity.token('fixture-user-b')}` };
  assert.equal((await fetch(app.base + asyncTask.pollUrl, { method: 'DELETE', headers: other })).status, 404);
  assert.equal((await fetch(app.base + retryPath, { method: 'POST', headers: { ...other, 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
  assert.equal((await readFile(env.F01_CAPTURE_FILE, 'utf8')).trim().split('\n').length, 2);
});
test('I10: idempotency conflicts, two-user keys and queued cancellation have no provider call', async t => {
  const env = await environment(t), app = await startApp({ ...env, VAOS_QUEUE_PAUSED: 'true' }); t.after(() => app.stop());
  const userB = { Authorization: `Bearer ${await app.identity.token('fixture-user-b')}` };
  const send = (headers, value = command, key = 'fixture-shared-key') => fetch(app.base + '/api/vaos/dispatch', { method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ command: value, ownerUid: 'fixture-user-b' }) });
  const first = await (await send(app.authHeaders)).json(), second = await (await send(userB)).json();
  assert.notEqual(first.asyncTask.taskId, second.asyncTask.taskId);
  assert.equal((await send(app.authHeaders, command + ' distinto')).status, 409);
  assert.equal((await send(app.authHeaders, command, 'bad')).status, 400);
  assert.equal((await fetch(app.base + first.asyncTask.pollUrl, { method: 'DELETE', headers: userB })).status, 404);
  const cancelled = await (await fetch(app.base + first.asyncTask.pollUrl, { method: 'DELETE', headers: app.authHeaders })).json();
  assert.equal(cancelled.status, 'CANCELLED'); assert.equal(cancelled.result.data.generationMayHaveOccurred, false);
  assert.equal((await fetch(app.base + first.asyncTask.pollUrl, { method: 'DELETE' })).status, 401);
  assert.equal((await (await send(app.authHeaders)).json()).asyncTask.status, 'CANCELLED');
});
test('I10: stalled SDK request reaches an enforced deadline and never tries another model', async t => {
  const env = await environment(t), app = await startApp({ ...env, GEMINI_API_KEY: 'synthetic-gemini-server',
    VAOS_ATTEMPT_TIMEOUT_MS: '50' }, ['./tests/fixtures/holding-gemini.mjs']); t.after(() => app.stop());
  const { asyncTask } = await (await post(app.base, '/api/vaos/dispatch', { command })).json();
  const failed = await waitFor(app, asyncTask.pollUrl, 'FAILED');
  assert.equal(failed.delivery, 'unknown'); assert.equal(failed.result.data.generationMayHaveOccurred, true);
  assert.equal(failed.result.outcome.realExecution, false);
  assert.equal((await readFile(env.F01_CAPTURE_FILE, 'utf8')).trim().split('\n').length, 1);
});
