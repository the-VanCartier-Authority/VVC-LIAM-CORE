import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventInterval, TemporalInputError, taskTiming, taskDueInstant, taskDueInMinute, snoozeTaskTiming } from '../src/utils/temporal.ts';
import { parseICSFeed, generateAppleCalendarICS, generateGoogleCalendarUrl, generateOutlookCalendarUrl,
  detectEventConflicts, resolveEventConflict } from '../src/utils/calendarSync.ts';
import { generateICSContent } from '../src/utils/ical.ts';
const event = (extra = {}) => ({ id: 'fixture', title: 'Consulta médica', date: '2026-11-02', time: '10:00', endTime: '11:00', ...extra });
const calendar = lines => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:fixture', 'SUMMARY:Consulta', ...lines, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');

test('I08: UTC, IANA, floating and all-day ICS preserve temporal semantics on export', () => {
  const cases = [
    ['DTSTART:20261102T150000Z', 'DTEND:20261102T160000Z'],
    ['DTSTART;TZID=America/New_York:20261102T100000', 'DTEND;TZID=America/New_York:20261102T110000'],
    ['DTSTART:20261102T100000', 'DTEND:20261102T110000'],
    ['DTSTART;VALUE=DATE:20261102', 'DTEND;VALUE=DATE:20261104'],
  ];
  for (const lines of cases) {
    const [first] = parseICSFeed(calendar(lines)), output = generateAppleCalendarICS(first), [second] = parseICSFeed(output);
    const a = eventInterval(first), b = eventInterval(second);
    assert.equal(a.start.getTime(), b.start.getTime()); assert.equal(a.end.getTime(), b.end.getTime());
    assert.equal(Boolean(first.allDay), Boolean(second.allDay));
    if (!first.timeZone) assert.equal(second.timeZone, undefined);
    else assert.equal(second.timeZone, 'UTC');
    assert.equal(second.syncStatus, 'local');
    if (!first.timeZone && !first.allDay) assert.match(output, /DTSTART:20261102T100000\r/);
    if (first.allDay) assert.match(output, /DTEND;VALUE=DATE:20261104/);
  }
});
test('I08: ICS folding and TEXT escaping cannot inject properties and preserve Unicode', () => {
  const title = 'á'.repeat(95) + ', revisión; ruta\\archivo\nSTATUS:CANCELLED';
  const source = event({ title, description: 'Una línea\nOtra, con; signos\\', timeZone: 'UTC' });
  const output = generateAppleCalendarICS(source);
  for (const line of output.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  assert.ok(!output.split('\r\n').includes('STATUS:CANCELLED'));
  const [restored] = parseICSFeed(output);
  assert.equal(restored.title, title); assert.equal(restored.description, source.description);
  assert.equal(restored.iCalUID, 'event-fixture@vvc-liam.internal');
});
test('I08: unsupported/malformed ICS fails as a whole without inventing start, end or recurrence', () => {
  for (const lines of [
    ['DTSTART:20260231T100000Z', 'DTEND:20260301T110000Z'],
    ['DTSTART:20261102T250000Z', 'DTEND:20261102T260000Z'],
    ['DTSTART:20261102T100001Z', 'DTEND:20261102T110001Z'],
    ['DTSTART:20261102T100000Z'],
    ['DTSTART:20261102T100000Z', 'DTSTART:20261102T100000Z', 'DTEND:20261102T110000Z'],
    ['DTSTART;TZID=America/New_York:20260308T023000', 'DTEND;TZID=America/New_York:20260308T033000'],
    ['DTSTART;TZID=America/New_York:20261101T013000', 'DTEND;TZID=America/New_York:20261101T023000'],
    ['DTSTART;TZID=CST:20261102T100000', 'DTEND;TZID=CST:20261102T110000'],
    ['DTSTART:20261102T100000Z', 'DTEND:20261102T110000Z', 'RRULE:FREQ=DAILY'],
    ['DTSTART:20261102T100000Z', 'DTEND:20261102T110000Z', 'STATUS:CANCELLED'],
  ]) assert.throws(() => parseICSFeed(calendar(lines)), TemporalInputError);
  const valid = calendar(['DTSTART:20261102T100000Z', 'DTEND:20261102T110000Z']);
  const invalid = valid.replace('END:VCALENDAR', 'BEGIN:VEVENT\r\nSUMMARY:Incomplete\r\nEND:VEVENT\r\nEND:VCALENDAR');
  assert.throws(() => parseICSFeed(invalid), TemporalInputError);
  assert.throws(() => parseICSFeed(valid.replace('END:VCALENDAR', '')), TemporalInputError);
  assert.throws(() => parseICSFeed(valid.replace('VERSION:2.0', 'METHOD:REQUEST')), TemporalInputError);
});
test('I08: links and ICS share the recorded UTC interval across midnight and DST', () => {
  const source = event({ date: '2026-03-07', time: '23:30', endDate: '2026-03-08', endTime: '03:30', timeZone: 'America/New_York' });
  const g = new URL(generateGoogleCalendarUrl(source)), o = new URL(generateOutlookCalendarUrl(source));
  assert.equal(g.searchParams.get('dates'), '20260308T043000Z/20260308T073000Z');
  assert.equal(g.searchParams.get('ctz'), 'America/New_York');
  assert.equal(o.searchParams.get('startdt'), '2026-03-08T04:30:00.000Z');
  assert.equal(o.searchParams.get('enddt'), '2026-03-08T07:30:00.000Z');
  const output = generateICSContent([source], []);
  assert.match(output, /DTSTART:20260308T043000Z/); assert.match(output, /DTEND:20260308T073000Z/);
  assert.equal(new URL(generateGoogleCalendarUrl(event())).searchParams.get('dates'), '20261102T100000/20261102T110000');
});
test('I08: all-day end dates are exclusive and zero/backwards intervals are rejected', () => {
  const allDay = event({ allDay: true, time: '', endTime: undefined, endDate: '2026-11-04' });
  assert.equal(new URL(generateGoogleCalendarUrl(allDay)).searchParams.get('dates'), '20261102/20261104');
  assert.equal(new URL(generateOutlookCalendarUrl(allDay)).searchParams.get('allday'), 'true');
  for (const source of [event({ endTime: '10:00' }), event({ endDate: '2026-11-01' }), event({ endTime: undefined, endDate: '2026-11-03' })])
    assert.throws(() => generateAppleCalendarICS(source), TemporalInputError);
});
test('I08: next-day suggestions are checked, and unavailable data is never declared clear', () => {
  const source = event({ timeZone: 'UTC' });
  const blockers = [event({ id: 'all-today', allDay: true, time: '', endTime: undefined, timeZone: 'UTC' }),
    event({ id: 'all-tomorrow', date: '2026-11-03', allDay: true, time: '', endTime: undefined, timeZone: 'UTC' })];
  const result = detectEventConflicts(source, blockers);
  assert.equal(result.status, 'conflict'); assert.ok(result.suggestedSlots.length);
  assert.ok(result.suggestedSlots.every(slot => slot.date !== '2026-11-03'));
  for (const slot of result.suggestedSlots) assert.equal(detectEventConflicts(slot, blockers).status, 'clear');
  const invalid = [event({ id: 'invalid', time: '25:99' })];
  assert.equal(detectEventConflicts(source, invalid).status, 'unavailable');
  assert.throws(() => resolveEventConflict(source, invalid), TemporalInputError);
  const recurring = event({ recurrence: 'daily' });
  assert.equal(detectEventConflicts(recurring, []).status, 'unavailable');
  assert.throws(() => generateICSContent([recurring], []), TemporalInputError);
});
test('I08: task export preserves no date, date-only, floating and recorded-zone due values', () => {
  const base = { id: 'task-fixture', title: 'Comprar, leche', isCompleted: false, recurrence: 'none', priority: 'media', subtasks: [] };
  const cases = [
    [{ dueDate: '', timeDue: '' }, undefined],
    [{ dueDate: '2026-11-02', timeDue: '' }, 'DUE;VALUE=DATE:20261102'],
    [{ dueDate: '2026-11-02', timeDue: '10:00' }, 'DUE:20261102T100000'],
    [taskTiming('2026-11-02', '10:00', 'America/New_York'), 'DUE:20261102T150000Z'],
  ];
  for (const [timing, expected] of cases) {
    const output = generateICSContent([], [{ ...base, ...timing }]);
    const due = output.split('\r\n').find(line => line.startsWith('DUE'));
    assert.equal(due, expected);
  }
  assert.throws(() => generateICSContent([], [{ ...base, ...taskTiming('2026-11-02', '10:00', 'UTC'), dueAt: '2026-11-03T10:00:00.000Z' }]), TemporalInputError);
});
test('I08: snooze crossing local midnight retains the actual instant and cannot fire a day early', () => {
  const now = new Date('2026-10-24T06:55:12Z');
  const timing = snoozeTaskTiming('America/Los_Angeles', 10, now);
  assert.deepEqual(timing, { dueDate: '2026-10-24', timeDue: '00:05', timeZone: 'America/Los_Angeles',
    dueAt: '2026-10-24T07:05:12.000Z', snoozedUntil: '2026-10-24T07:05:12.000Z' });
  const task = { ...timing, isCompleted: false };
  assert.equal(taskDueInstant(task).toISOString(), timing.dueAt);
  assert.equal(taskDueInMinute(task, new Date('2026-10-23T07:05:12Z')), false);
  assert.equal(taskDueInMinute(task, new Date('2026-10-24T07:05:12Z')), true);
  assert.equal(taskDueInMinute({ ...task, isCompleted: true }, new Date(timing.dueAt)), false);
  assert.equal(taskDueInMinute({ ...task, dueDate: '2026-10-23' }, new Date(timing.dueAt)), false);
  assert.equal(taskDueInMinute({ dueDate: '', timeDue: '00:05', isCompleted: false }, new Date(timing.dueAt)), false);
});
