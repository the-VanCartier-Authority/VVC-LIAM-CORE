import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './server-helper.mjs';

async function dispatch(app, headers, command, forgedOwner) {
  const response = await fetch(app.base + '/api/vaos/dispatch?ownerUid=' + forgedOwner, { method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'X-User-Id': forgedOwner },
    body: JSON.stringify({ command, uid: forgedOwner, ownerUid: forgedOwner }) });
  assert.equal(response.status, 200);
  return response.json();
}

async function settled(app, path, headers) {
  for (let i = 0; i < 100; i++) {
    const response = await fetch(app.base + path, { headers });
    assert.equal(response.status, 200);
    const task = await response.json();
    if (!['QUEUED', 'PROCESSING'].includes(task.status)) return task;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Synthetic task did not settle');
}

test('G02 B03: ownership survives terminal state; both users reject cross-access and forged UID hints', async t => {
  const app = await startApp(); t.after(() => app.stop());
  const a = app.authHeaders;
  const b = { Authorization: 'Bearer ' + await app.identity.token('fixture-user-b') };
  const da = await dispatch(app, a, 'crear documento private-synthetic-a', 'fixture-user-b');
  const db = await dispatch(app, b, 'crear documento private-synthetic-b', 'fixture-user-a');
  const ta = await settled(app, da.asyncTask.pollUrl, a);
  const tb = await settled(app, db.asyncTask.pollUrl, b);
  assert.equal(ta.ownerUid, 'fixture-user-a'); assert.equal(tb.ownerUid, 'fixture-user-b');
  for (const task of [ta, tb]) {
    assert.equal(task.status, 'UNAVAILABLE'); assert.equal(task.result.data.realExecution, false);
    assert.equal(task.result.outcome.status, 'unavailable');
  }
  for (const [path, headers, forged, privateCommand] of [
    [da.asyncTask.pollUrl, b, 'fixture-user-a', ta.command],
    [db.asyncTask.pollUrl, a, 'fixture-user-b', tb.command]
  ]) {
    const denied = await fetch(app.base + path + '?uid=' + forged,
      { headers: { ...headers, 'X-User-Id': forged } });
    assert.equal(denied.status, 404); assert.ok(!(await denied.text()).includes(privateCommand));
  }
  assert.equal((await fetch(app.base + da.asyncTask.pollUrl)).status, 401);
  const listA = await (await fetch(app.base + '/api/vaos/tasks?uid=fixture-user-b', { headers: a })).json();
  const listB = await (await fetch(app.base + '/api/vaos/tasks?uid=fixture-user-a', { headers: b })).json();
  assert.deepEqual(listA.map(task => task.taskId), [ta.taskId]);
  assert.deepEqual(listB.map(task => task.taskId), [tb.taskId]);
});

test('G02 B03: telemetry and stats are independently scoped for both signed identities', async t => {
  const app = await startApp(); t.after(() => app.stop());
  const a = app.authHeaders;
  const b = { Authorization: 'Bearer ' + await app.identity.token('fixture-user-b') };
  await dispatch(app, a, 'fixture-private-telemetry-a', 'fixture-user-b');
  await dispatch(app, b, 'fixture-private-telemetry-b', 'fixture-user-a');
  const read = async (headers, hint) => (await fetch(app.base + '/api/vaos/telemetry?ownerUid=' + hint,
    { headers: { ...headers, 'X-User-Id': hint } })).json();
  const pa = await read(a, 'fixture-user-b'), pb = await read(b, 'fixture-user-a');
  assert.equal(pa.stats.totalDispatched, 1); assert.equal(pb.stats.totalDispatched, 1);
  for (const [data, owner, command] of [[pa, 'fixture-user-a', 'fixture-private-telemetry-a'],
    [pb, 'fixture-user-b', 'fixture-private-telemetry-b']]) {
    assert.equal(data.points.length, 1); assert.equal(data.points[0].command, command);
    assert.ok(data.points.every(point => point.ownerUid === owner && point.taskId !== 'boot-probe-01'));
  }
});
