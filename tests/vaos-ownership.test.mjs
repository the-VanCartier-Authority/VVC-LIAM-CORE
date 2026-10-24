import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, post } from './server-helper.mjs';

test('B03: two valid Firebase users cannot read each other tasks or telemetry', async t => {
  const app = await startApp(); t.after(() => app.stop());
  const userB = { Authorization: `Bearer ${await app.identity.token('fixture-user-b')}` };
  const dispatch = await post(app.base, '/api/vaos/dispatch', {
    command: 'crear documento fixture-privado-a', ownerUid: 'fixture-user-b', uid: 'fixture-user-b' });
  const { asyncTask } = await dispatch.json();
  await post(app.base, '/api/vaos/dispatch', { command: 'fixture-telemetria-privada-a' });
  await t.test('detail is private even when its ID is known', async () => {
    assert.equal((await fetch(app.base + asyncTask.pollUrl, { headers: userB })).status, 404);
    assert.equal((await fetch(app.base + asyncTask.pollUrl, { headers: app.authHeaders })).status, 200);
  });
  await t.test('list is scoped before applying the result limit', async () => {
    const tasksA = await (await fetch(app.base + '/api/vaos/tasks', { headers: app.authHeaders })).json();
    const tasksB = await (await fetch(app.base + '/api/vaos/tasks', { headers: userB })).json();
    assert.ok(tasksA.some(task => task.taskId === asyncTask.taskId));
    assert.deepEqual(tasksB, []);
  });
  await t.test('telemetry points and stats exclude other users and system boot probes', async () => {
    const a = await (await fetch(app.base + '/api/vaos/telemetry', { headers: app.authHeaders })).json();
    const b = await (await fetch(app.base + '/api/vaos/telemetry', { headers: userB })).json();
    assert.ok(a.points.some(point => point.command === 'fixture-telemetria-privada-a'));
    assert.deepEqual(b.points, []); assert.equal(b.stats.totalDispatched, 0);
    assert.ok(a.points.every(point => point.ownerUid === 'fixture-user-a'));
  });
});
