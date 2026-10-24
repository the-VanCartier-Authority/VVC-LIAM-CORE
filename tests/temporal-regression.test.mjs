import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { generateGoogleCalendarUrl, detectEventConflicts, parseICSFeed } from '../src/utils/calendarSync.ts';
let parse;
before(async () => {
  const bundle = await build({ entryPoints: ['src/utils/rtLiteEngine.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
  parse = (await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))).parseNaturalVoiceCommand;
});
function fixed(t, zone = 'America/Los_Angeles') {
  const previous = process.env.TZ; process.env.TZ = zone;
  t.after(() => { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; });
  t.mock.timers.enable({ apis: ['Date'], now: 1792823400000 }); // 2026-10-24T06:30Z = Oct 23, 23:30 LA.
}
test('I08: de la mañana is a time period, and today is the local calendar day', t => {
  fixed(t);
  const task = parse('crear tarea medicina a las 8 de la mañana', {}, []).newTask;
  assert.equal(task.dueDate, '2026-10-23'); assert.equal(task.timeDue, '08:00');
});
test('I08: 12 AM means midnight', t => {
  fixed(t);
  assert.equal(parse('crear tarea medicina a las 12am', {}, []).newTask.timeDue, '00:00');
});
test('I08: minute precision PM and tomorrow retain the correct local date', t => {
  fixed(t);
  const event = parse('agendar reunión mañana a las 3:30pm hasta las 4:30pm', {}, []).newCalendarEvent;
  assert.equal(event.time, '15:30'); assert.equal(event.endTime, '16:30');
  assert.equal(event.date, '2026-10-24'); assert.equal(event.timeZone, 'America/Los_Angeles');
});
test('I08: invalid clock does not create an alarm', t => {
  fixed(t);
  assert.equal(parse('alarma a las 25:99', {}, []).newAlarm, undefined);
});
test('I08: February 31 never rolls into March', t => {
  fixed(t);
  assert.equal(parse('agendar reunión el 31 de febrero de 2027 a las 10:00', {}, []).newCalendarEvent, undefined);
});
for (const [day, hour] of [['2026-03-08', '02:30'], ['2026-11-01', '01:30']])
  test(`I08: DST gap/fold ${day} ${hour} needs clarification`, t => {
    fixed(t, 'UTC');
    assert.equal(parse(`agendar reunión el ${day} a las ${hour} zona America/New_York`, {}, []).newCalendarEvent, undefined);
  });
test('I08: Google template uses the recorded zone instead of appending Z to wall time', t => {
  fixed(t, 'America/New_York');
  const url = new URL(generateGoogleCalendarUrl({ id: 'fixture', title: 'fixture', date: '2026-11-02',
    time: '10:00', endTime: '11:00', timeZone: 'America/New_York' }));
  assert.equal(url.searchParams.get('dates'), '20261102T150000Z/20261102T160000Z');
});
test('I08: crossing midnight preserves the end date', t => {
  fixed(t, 'UTC');
  const url = new URL(generateGoogleCalendarUrl({ id: 'fixture', title: 'fixture', date: '2026-10-24',
    time: '23:30', endDate: '2026-10-25', endTime: '00:30', timeZone: 'UTC' }));
  assert.equal(url.searchParams.get('dates'), '20261024T233000Z/20261025T003000Z');
});
test('I08: conflict comparison uses instants across different recorded zones', t => {
  fixed(t, 'UTC');
  const result = detectEventConflicts({ id: 'a', date: '2026-11-02', time: '07:00', endTime: '08:00', timeZone: 'America/Los_Angeles' },
    [{ id: 'b', title: 'fixture', date: '2026-11-02', time: '10:00', endTime: '11:00', timeZone: 'America/New_York' }]);
  assert.equal(result.hasConflict, true);
});
test('I08: imported UTC stays explicitly UTC instead of becoming a floating local clock', t => {
  fixed(t, 'America/New_York');
  const [event] = parseICSFeed('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:fixture\r\nDTSTART:20261102T150000Z\r\nDTEND:20261102T160000Z\r\nSUMMARY:fixture\r\nEND:VEVENT\r\nEND:VCALENDAR');
  assert.equal(event.timeZone, 'UTC');
});
test('I08: task edits and snoozes cannot retain a stale day/instant', t => {
  fixed(t);
  const task = { id: 'task', title: 'Café', dueDate: '2026-10-23', timeDue: '23:00', timeZone: 'America/Los_Angeles',
    dueAt: '2026-10-24T06:00:00.000Z', priority: 'media', category: 'personal', recurrence: 'none', subtasks: [], isCompleted: false };
  const snooze = parse('posponer tarea café 60 minutos', {}, [], [task]).taskToModify.updates;
  assert.equal(snooze.dueDate, '2026-10-24'); assert.equal(snooze.timeDue, '00:30');
  assert.equal(snooze.dueAt, '2026-10-24T07:30:00.000Z');
  const edited = parse('cambiar hora de tarea café a las 3:30pm', {}, [], [task]).taskToModify.updates;
  assert.equal(edited.timeDue, '15:30'); assert.equal(edited.dueAt, '2026-10-23T22:30:00.000Z');
  assert.equal(parse('cambiar hora de tarea café a las 25:99', {}, [], [task]).taskToModify, undefined);
});
test('I08: unknown availability and unsupported dates cannot produce a clear/scheduled result', t => {
  fixed(t);
  const invalid = [{ id: 'bad', title: 'Invalid', date: '2026-02-31', time: '10:00' }];
  assert.equal(parse('agendar reunión mañana a las 10:00', {}, [], [], invalid).newCalendarEvent, undefined);
  assert.match(parse('comprobar conflicto', {}, [], [], invalid).spokenResponse, /No se puede comprobar/);
  assert.equal(parse('resolver conflicto', {}, [], [], invalid).eventsToUpdate, undefined);
  assert.equal(parse('agendar reunión el lunes a las 10:00', {}, []).newCalendarEvent, undefined);
  assert.equal(parse('agendar reunión el 31/02 a las 10:00', {}, []).newCalendarEvent, undefined);
  assert.equal(parse('alarma a las 01:30 el 2026-11-01 zona America/New_York', {}, []).newAlarm, undefined);
  const noTime = parse('crear tarea medicina sin fecha', {}, []).newTask;
  assert.equal(noTime.dueDate, ''); assert.equal(noTime.timeDue, ''); assert.equal(noTime.dueAt, undefined);
});
