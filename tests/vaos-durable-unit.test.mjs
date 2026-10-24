import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VaosOrchestrator } from '../src/server/vaosOrchestrator.ts';
import { VaosStore, QueueError } from '../src/server/vaosStore.ts';
import { BackendLimits, ResourceLimitError } from '../src/server/backendLimits.ts';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const pathFor = t => { const path = mkdtempSync(join(tmpdir(), 'vvc-i10-unit-')); t.after(() => rmSync(path, { recursive: true, force: true })); return join(path, 'queue.sqlite'); };
async function until(check) { for (let i = 0; i < 200; i++) { if (check()) return; await wait(5); } assert.fail('Condition was not reached'); }

test('I10: priority queue, immutable returned snapshots and worker capacity are real', async t => {
  const started = [], pending = [], service = new VaosOrchestrator(new BackendLimits(), { databasePath: pathFor(t), paused: true, workers: 1,
    execute: async task => { started.push(task.taskId); return new Promise(resolve => pending.push(resolve)); } });
  t.after(() => service.close());
  const first = service.enqueueTask('a', 'operational', 'profile', 'P1_HIGH');
  const second = service.enqueueTask('a', 'critical', 'profile', 'P0_CRITICAL');
  assert.equal(service.queuePosition(second.taskId), 1); assert.equal(service.queuePosition(first.taskId), 2);
  first.ownerUid = 'b'; assert.equal(service.getTask(first.taskId, 'b'), undefined);
  assert.throws(() => service.enqueueTask('a', 'third', 'profile', 'P1_HIGH'), ResourceLimitError);
  service.setPaused(false); await until(() => started.length === 1);
  assert.deepEqual(started, [second.taskId]); assert.equal(service.getTask(first.taskId, 'a').status, 'QUEUED');
  pending.shift()({ text: 'fixture', tokens: 2 }); await until(() => started.length === 2);
  assert.deepEqual(started, [second.taskId, first.taskId]);
  pending.shift()({ text: 'fixture', tokens: 2 }); await until(() => service.getTask(first.taskId, 'a').status === 'COMPLETED');
  assert.equal(service.getTask(first.taskId, 'a').result.outcome.realExecution, false);
});
test('I10: cancellation cannot release a concurrency lease before the provider settles', async t => {
  let finish;
  const limits = new BackendLimits('{"concurrentTasksPerUser":1}');
  const service = new VaosOrchestrator(limits, { databasePath: pathFor(t), execute: async () => new Promise(resolve => { finish = resolve; }) });
  t.after(() => service.close());
  const first = service.enqueueTask('a', 'fixture', 'profile', 'P1_HIGH');
  await until(() => finish);
  service.cancelTask(first.taskId, 'a');
  assert.equal(service.getTask(first.taskId, 'a').status, 'CANCELLED');
  assert.throws(() => service.enqueueTask('a', 'fixture', 'profile', 'P1_HIGH'), ResourceLimitError);
  finish({ text: 'late fixture' }); await wait(10);
  const next = service.enqueueTask('a', 'new', 'profile', 'P1_HIGH');
  assert.ok(next.taskId); service.cancelTask(next.taskId, 'a');
  assert.equal(service.getTask(first.taskId, 'a').status, 'CANCELLED');
});
test('I10: storage failure before transmission pauses work and never returns fake success', async t => {
  let calls = 0;
  const path = pathFor(t), service = new VaosOrchestrator(new BackendLimits(), { databasePath: path, paused: true,
    execute: async () => { calls++; return { text: 'fixture' }; } });
  const task = service.enqueueTask('a', 'fixture', 'profile', 'P1_HIGH');
  const mock = t.mock.method(VaosStore.prototype, 'save', () => { throw Error('synthetic disk failure'); });
  service.setPaused(false); await wait(20);
  assert.equal(calls, 0); assert.equal(service.health(), 'UNAVAILABLE'); assert.throws(() => service.getTask(task.taskId, 'a'), error => error.code === 'QUEUE_UNAVAILABLE');
  service.close(); mock.mock.restore();
  const store = new VaosStore(path); t.after(() => store.close()); assert.equal(store.all()[0].status, 'QUEUED');
});
test('I10: failure to persist a provider result recovers as interrupted and cannot repeat generation automatically', async t => {
  let calls = 0;
  const path = pathFor(t), service = new VaosOrchestrator(new BackendLimits(), { databasePath: path, paused: true,
    execute: async () => { calls++; return { text: 'fixture' }; } });
  const task = service.enqueueTask('a', 'fixture', 'profile', 'P1_HIGH');
  const save = VaosStore.prototype.save;
  const mock = t.mock.method(VaosStore.prototype, 'save', function (record) {
    if (record.status === 'COMPLETED') throw Error('synthetic disk failure after response'); return save.call(this, record);
  });
  service.setPaused(false); await wait(20); assert.equal(calls, 1);
  assert.throws(() => service.getTask(task.taskId, 'a'), QueueError);
  service.close(); mock.mock.restore();
  const recovered = new VaosOrchestrator(new BackendLimits(), { databasePath: path, execute: async () => { calls++; return { text: 'duplicate' }; } });
  t.after(() => recovered.close()); await wait(20);
  assert.equal(recovered.getTask(task.taskId, 'a').status, 'INTERRUPTED'); assert.equal(calls, 1);
});
test('I10: private SQLite rejects another worker, symlinks, public files, unknown schemas and corruption', t => {
  assert.throws(() => new VaosStore(join(process.cwd(), 'dist', 'private', 'queue.sqlite')), /QUEUE_WEB_ROOT_FORBIDDEN/);
  const path = pathFor(t), store = new VaosStore(path);
  assert.throws(() => new VaosStore(path), /QUEUE_STORAGE_UNAVAILABLE/);
  store.close(); const again = new VaosStore(path); again.close();
  chmodSync(path, 0o644); assert.throws(() => new VaosStore(path), /QUEUE_PRIVATE_FILE_REQUIRED/); chmodSync(path, 0o600);
  const link = path + '.link'; symlinkSync(path, link); assert.throws(() => new VaosStore(link), /QUEUE_PRIVATE_FILE_REQUIRED/);
  const schema = new DatabaseSync(path); schema.exec('PRAGMA user_version=2'); schema.close();
  assert.throws(() => new VaosStore(path), /QUEUE_STORAGE_UNAVAILABLE/);
  writeFileSync(path, 'not a database'); assert.throws(() => new VaosStore(path));
});
test('I10: durable admission quota and idempotency tombstones survive process-instance closure', t => {
  const path = pathFor(t); let store = new VaosStore(path);
  const task = { taskId: 'task-fixture', ownerUid: 'a', command: 'fixture', agentId: 'profile', priority: 'P1_HIGH', route: 'ASYNC_PATH', status: 'QUEUED', createdAt: Date.now(), injectedSkills: [] };
  store.insert(task, 'fixture-key', 'fingerprint', 12288); store.close(); store = new VaosStore(path); t.after(() => store.close());
  assert.equal(store.replay('a', 'fixture-key', 'fingerprint').taskId, task.taskId);
  assert.equal(store.replay('b', 'fixture-key', 'fingerprint'), undefined);
  assert.throws(() => store.replay('a', 'fixture-key', 'other'), error => error.code === 'IDEMPOTENCY_CONFLICT');
  assert.throws(() => store.insert({ ...task, taskId: 'task-two' }, 'another-key', 'another', 12288), ResourceLimitError);
  store.save({ ...task, status: 'FAILED' }); store.prune(Date.now() + 86400001);
  assert.throws(() => store.replay('a', 'fixture-key', 'fingerprint'), error => error.status === 410);
});

test('I10: oversized serialized output fails truthfully without poisoning storage or releasing a fake completion', async t => {
  const service = new VaosOrchestrator(new BackendLimits(), { databasePath: pathFor(t),
    execute: async () => ({ text: '\u0001'.repeat(50000) }) }); t.after(() => service.close());
  const task = service.enqueueTask('a', 'fixture', 'profile', 'P1_HIGH');
  await until(() => service.getTask(task.taskId, 'a').status === 'FAILED');
  assert.equal(service.health(), 'OK'); assert.equal(service.getTask(task.taskId, 'a').result.outcome.status, 'failed');
});
test('I10: restart reevaluates current policy before recovering queued work', async t => {
  const path = pathFor(t), store = new VaosStore(path);
  const task = { taskId: 'policy-changed', ownerUid: 'a', command: '<script>old fixture', agentId: 'profile', priority: 'P0_CRITICAL', route: 'ASYNC_PATH', status: 'QUEUED', createdAt: Date.now(), injectedSkills: [], model: 'gemini-2.5-flash', delivery: 'not_attempted' };
  store.insert(task, undefined, 'policy-fixture', 1000000); store.close();
  let calls = 0;
  const service = new VaosOrchestrator(new BackendLimits(), { databasePath: path, execute: async () => { calls++; return { text: 'forbidden' }; } });
  t.after(() => service.close()); await wait(20);
  assert.equal(service.getTask(task.taskId, 'a').status, 'FAILED'); assert.equal(calls, 0);
});
