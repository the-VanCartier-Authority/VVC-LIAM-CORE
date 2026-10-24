import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
test('I08: Firestore projection preserves temporal metadata without inventing absent dates/hours (SDK fixture)', async t => {
  const fixture = { writes: [], rows: [] }; globalThis.__i08Firestore = fixture;
  t.after(() => { delete globalThis.__i08Firestore; });
  const output = await build({ entryPoints: ['src/services/firestoreSyncService.ts'], bundle: true, write: false,
    platform: 'node', format: 'esm', plugins: [{ name: 'fixture-only', setup(b) {
      b.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'firestore', namespace: 'fixture' }));
      b.onResolve({ filter: /\/googleAuth$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'auth' ? 'export const db = {};' : `
        export const collection = (_db, ...path) => path, doc = (_db, ...path) => path;
        export const setDoc = async (path, value) => { globalThis.__i08Firestore.writes.push(value); };
        export const deleteDoc = async () => {}, getDocs = async () => {}, serverTimestamp = () => 0;
        export const onSnapshot = (_ref, callback) => { callback({ forEach(fn) {
          globalThis.__i08Firestore.rows.forEach((row, i) => fn({ id: 'fixture-' + i, data: () => row }));
        } }); return () => {}; };`, loader: 'js' }));
    } }] });
  const service = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
  const task = { id: 'task', title: 'Fixture', dueDate: '2026-11-02', timeDue: '10:00',
    timeZone: 'America/New_York', dueAt: '2026-11-02T15:00:00.000Z', snoozedUntil: '2026-11-02T15:00:00.000Z',
    priority: 'media', category: 'personal', isCompleted: false, recurrence: 'none', subtasks: [], createdAt: 1, updatedAt: 1 };
  await service.saveTaskToFirestore('fixture-user', task);
  fixture.rows = fixture.writes; let tasks;
  service.subscribeToUserTasks('fixture-user', value => { tasks = value; });
  for (const key of ['dueDate', 'timeDue', 'timeZone', 'dueAt', 'snoozedUntil']) assert.equal(tasks[0][key], task[key], key);
  fixture.rows = [{ title: 'Legacy without due date' }];
  service.subscribeToUserTasks('fixture-user', value => { tasks = value; });
  assert.equal(tasks[0].dueDate, ''); assert.equal(tasks[0].timeDue, ''); assert.equal(tasks[0].timeZone, undefined);
  const event = { id: 'event', title: 'Fixture', date: '2026-11-02', time: '23:30',
    endDate: '2026-11-03', endTime: '00:30', timeZone: 'UTC', allDay: false };
  fixture.writes = []; await service.saveEventToFirestore('fixture-user', event);
  fixture.rows = fixture.writes; let events;
  service.subscribeToUserEvents('fixture-user', value => { events = value; });
  for (const key of ['date', 'time', 'endDate', 'endTime', 'timeZone', 'allDay']) assert.equal(events[0][key], event[key], key);
  const allDay = { ...event, time: '', endTime: '', allDay: true };
  fixture.writes = []; await service.saveEventToFirestore('fixture-user', allDay);
  fixture.rows = fixture.writes;
  service.subscribeToUserEvents('fixture-user', value => { events = value; });
  assert.equal(events[0].time, ''); assert.equal(events[0].allDay, true);
});
