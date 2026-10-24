import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startApp, post } from './server-helper.mjs';
const body = { command: 'crear documento fixture durable', injectedSkills: [] };
async function directory(t) { const path = await mkdtemp(join(tmpdir(), 'vvc-durable-')); t.after(() => rm(path, { recursive: true, force: true })); return path; }
test('I10: acknowledged task survives a real server process restart', async t => {
  const path = await directory(t), env = { VAOS_DATABASE_PATH: join(path, 'tasks.sqlite') };
  let app = await startApp(env);
  t.after(async () => { if (app) await app.stop(); });
  const result = await (await post(app.base, '/api/vaos/dispatch', body)).json();
  assert.ok(result.asyncTask.taskId);
  await app.stop(); app = null;
  app = await startApp(env);
  const response = await fetch(app.base + result.asyncTask.pollUrl, { headers: app.authHeaders });
  assert.equal(response.status, 200);
  const task = await response.json(); assert.equal(task.ownerUid, 'fixture-user-a');
  assert.equal(task.command, body.command); assert.equal(task.result?.outcome.realExecution, false);
});
test('I10: idempotency scoped to verified UID returns the original task', async t => {
  const path = await directory(t), app = await startApp({ VAOS_DATABASE_PATH: join(path, 'tasks.sqlite') });
  t.after(() => app.stop());
  const send = () => fetch(app.base + '/api/vaos/dispatch', { method: 'POST',
    headers: { ...app.authHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': 'fixture-request-one' }, body: JSON.stringify(body) });
  const first = await (await send()).json(), second = await (await send()).json();
  assert.equal(second.asyncTask.taskId, first.asyncTask.taskId);
});
test('I10: owner can cancel processing and late provider response cannot overwrite cancellation', async t => {
  const path = await directory(t), app = await startApp({ VAOS_DATABASE_PATH: join(path, 'tasks.sqlite'), GEMINI_API_KEY: 'synthetic-gemini-server' }, ['./tests/fixtures/slow-gemini.mjs']);
  t.after(() => app.stop());
  const result = await (await post(app.base, '/api/vaos/dispatch', body)).json();
  const cancelled = await fetch(app.base + result.asyncTask.pollUrl, { method: 'DELETE', headers: app.authHeaders });
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).status, 'CANCELLED');
  await new Promise(resolve => setTimeout(resolve, 800));
  const detail = await (await fetch(app.base + result.asyncTask.pollUrl, { headers: app.authHeaders })).json();
  assert.equal(detail.status, 'CANCELLED'); assert.equal(detail.result.outcome.realExecution, false);
});
