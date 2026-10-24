import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDate, addCalendarDays, clockTime, dateFromText, timeFromText, zoneFromText,
  zonedInstant, eventInterval, TemporalInputError } from '../src/utils/temporal.ts';

test('I08: strict Gregorian dates, leap years and calendar day arithmetic', () => {
  assert.equal(calendarDate('2028-02-29'), '2028-02-29');
  for (const date of ['2027-02-29', '2026-02-31', '2026-13-01', '2026-00-10', '2026-10-00', 'bad'])
    assert.throws(() => calendarDate(date), TemporalInputError);
  assert.equal(addCalendarDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addCalendarDays('2026-03-01', -1), '2026-02-28');
});
test('I08: clock normalization preserves minute precision and explicit AM/PM', () => {
  for (const [raw, expected] of [['12am', '00:00'], ['12pm', '12:00'], ['3:30pm', '15:30'],
    ['8 de la mañana', '08:00'], ['18:05 de la tarde', '18:05'], ['medianoche', '00:00'], ['mediodía', '12:00']])
    assert.equal(clockTime(raw), expected);
  for (const raw of ['25:00', '12:99', '13pm', '0am', '12 de la mañana', '1.5', '3 de la noche'])
    assert.throws(() => clockTime(raw), TemporalInputError);
  assert.equal(timeFromText('mañana a las 3:30pm hasta las 4:30pm').time, '15:30');
  assert.equal(timeFromText('mañana a las 3:30pm hasta las 4:30pm', true).time, '16:30');
  assert.throws(() => timeFromText('a las 3 o 4'), TemporalInputError);
});
test('I08: relative civil dates use their zone and do not confuse de la mañana', () => {
  const now = new Date('2026-10-24T06:30:00Z');
  assert.equal(dateFromText('a las 8 de la mañana', 'America/Los_Angeles', now), '2026-10-23');
  assert.equal(dateFromText('mañana a las 8 de la mañana', 'America/Los_Angeles', now), '2026-10-24');
  assert.equal(dateFromText('pasado mañana', 'America/Los_Angeles', now), '2026-10-25');
  assert.equal(dateFromText('31 de diciembre de 2027', 'UTC', now), '2027-12-31');
  assert.throws(() => dateFromText('hoy y mañana', 'UTC', now), TemporalInputError);
  assert.equal(zoneFromText('zona America/New_York').timeZone, 'America/New_York');
  assert.throws(() => zoneFromText('zona CST'), TemporalInputError);
});
test('I08: IANA conversion covers positive/negative and fractional offsets', () => {
  for (const [date, time, zone, expected] of [
    ['2026-11-02', '10:00', 'America/New_York', '2026-11-02T15:00:00.000Z'],
    ['2026-07-01', '07:00', 'Europe/Madrid', '2026-07-01T05:00:00.000Z'],
    ['2026-07-01', '10:30', 'Asia/Kolkata', '2026-07-01T05:00:00.000Z'],
    ['2026-01-01', '00:30', 'Pacific/Kiritimati', '2025-12-31T10:30:00.000Z'],
  ]) assert.equal(zonedInstant(date, time, zone).toISOString(), expected);
});
test('I08: DST gaps/folds and skipped civil days have no implicit offset choice', () => {
  for (const [date, time, zone] of [['2026-03-08', '02:30', 'America/New_York'], ['2026-11-01', '01:30', 'America/New_York'],
    ['2026-10-04', '02:15', 'Australia/Lord_Howe'], ['2026-04-05', '01:45', 'Australia/Lord_Howe'],
    ['2011-12-30', '12:00', 'Pacific/Apia']]) assert.throws(() => zonedInstant(date, time, zone), TemporalInputError);
});
test('I08: overnight intervals retain their day and all-day intervals follow civil DST', () => {
  const overnight = eventInterval({ date: '2026-10-24', time: '23:30', endTime: '00:30', timeZone: 'UTC' });
  assert.equal(overnight.endDate, '2026-10-25'); assert.equal(overnight.end - overnight.start, 3600000);
  const day = date => eventInterval({ date, time: '', allDay: true, timeZone: 'America/New_York' });
  assert.equal(day('2026-11-01').end - day('2026-11-01').start, 25 * 3600000);
  assert.equal(day('2026-03-08').end - day('2026-03-08').start, 23 * 3600000);
});
