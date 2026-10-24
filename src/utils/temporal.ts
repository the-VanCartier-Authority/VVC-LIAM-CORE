// Calendar values are distinct from instants. Never append Z to a wall clock.
export class TemporalInputError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
const fail = (code: string, message: string): never => { throw new TemporalInputError(code, message); };
const pad = (value: number) => String(value).padStart(2, '0');
const DAY = 86400000;

export function calendarDate(input: string): string {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return fail('INVALID_DATE', 'Indica una fecha válida en formato AAAA-MM-DD.');
  const [year, month, day] = input.split('-').map(Number);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0);
  if (year < 1 || year > 9999 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    return fail('INVALID_DATE', 'La fecha indicada no existe.');
  return input;
}
const calendarEpoch = (value: string) => Date.parse(calendarDate(value) + 'T00:00:00Z');
export function addCalendarDays(value: string, days: number): string {
  if (!Number.isSafeInteger(days)) return fail('INVALID_DATE', 'Desplazamiento de fecha no válido.');
  const date = new Date(calendarEpoch(value) + days * DAY);
  if (!Number.isFinite(date.getTime())) return fail('INVALID_DATE', 'La fecha está fuera del rango admitido.');
  return calendarDate(date.toISOString().slice(0, 10));
}
export function calendarDayDistance(start: string, end: string) { return (calendarEpoch(end) - calendarEpoch(start)) / DAY; }

export function timeZone(input: string): string {
  if (typeof input !== 'string' || (input.toUpperCase() !== 'UTC' && !/^[A-Za-z_+-]+\/[A-Za-z0-9_+\/-]+$/.test(input)))
    return fail('INVALID_TIME_ZONE', 'Indica una zona IANA como Europe/Madrid, America/New_York o UTC.');
  try { return new Intl.DateTimeFormat('en', { timeZone: input }).resolvedOptions().timeZone; }
  catch { return fail('INVALID_TIME_ZONE', 'Zona horaria no reconocida.'); }
}
export function localTimeZone(): string { return timeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'); }
const formats = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string) {
  const canonical = timeZone(zone);
  let format = formats.get(canonical);
  if (!format) {
    format = new Intl.DateTimeFormat('en-CA', { timeZone: canonical, calendar: 'iso8601',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    if (formats.size >= 32) formats.delete(formats.keys().next().value!);
    formats.set(canonical, format);
  }
  return format;
}
export function zonedParts(instant: Date | number, zone = localTimeZone()) {
  const value = typeof instant === 'number' ? new Date(instant) : instant;
  if (!Number.isFinite(value.getTime())) return fail('INVALID_INSTANT', 'Instante no válido.');
  const parts = Object.fromEntries(formatter(zone).formatToParts(value).map(part => [part.type, part.value]));
  const date = `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`;
  return { date, time: `${parts.hour}:${parts.minute}`, second: Number(parts.second) };
}
export function localCalendarDate(now = new Date(), zone = localTimeZone()) { return zonedParts(now, zone).date; }

export function clockTime(input: string): string {
  if (typeof input !== 'string') return fail('INVALID_TIME', 'Falta una hora válida.');
  const text = input.trim().toLowerCase().replace(/a\.m\./g, 'am').replace(/p\.m\./g, 'pm').replace(/\.$/, '');
  if (text === 'medianoche') return '00:00';
  if (/^mediod[ií]a$/.test(text)) return '12:00';
  const match = /^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm|(?:de|por) la (?:mañana|tarde|noche))?$/.exec(text);
  if (!match) return fail('INVALID_TIME', 'Indica una hora válida, por ejemplo 08:30 o 3:30pm.');
  let hour = Number(match[1]); const minute = Number(match[2] || 0), period = match[3] || '';
  if (minute > 59 || hour > 23) return fail('INVALID_TIME', 'Hora o minutos fuera de rango.');
  if (period === 'am' || period === 'pm') {
    if (hour < 1 || hour > 12) return fail('INVALID_TIME', 'AM/PM requiere una hora de 1 a 12.');
    hour = hour % 12 + (period === 'pm' ? 12 : 0);
  } else if (period.includes('mañana')) {
    if (hour === 12) return fail('AMBIGUOUS_TIME', 'Aclara si quieres medianoche (12am) o mediodía (12pm).');
    if (hour > 11) return fail('INVALID_TIME', 'La hora no corresponde a la mañana.');
  } else if (period.includes('tarde')) {
    if (!hour) return fail('INVALID_TIME', 'La hora no corresponde a la tarde.');
    if (hour < 12) hour += 12;
  } else if (period.includes('noche')) {
    if (hour === 12) hour = 0;
    else if (hour >= 6 && hour < 12) hour += 12;
    else if (hour > 0 && hour < 6) return fail('AMBIGUOUS_TIME', 'Aclara AM/PM para esa hora de la noche.');
    else if (hour >= 13 && hour < 18) return fail('INVALID_TIME', 'La hora no corresponde a la noche.');
  }
  return `${pad(hour)}:${pad(minute)}`;
}

export function zonedInstant(dateInput: string, clockInput: string, zoneInput = localTimeZone()): Date {
  const date = calendarDate(dateInput), time = clockTime(clockInput), zone = timeZone(zoneInput);
  const nominal = Date.parse(`${date}T${time}:00Z`), offsets = new Set<number>();
  // Snapshots across the surrounding transition cover both offsets, including
  // half-hour DST and skipped civil days. Every candidate must roundtrip exactly.
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const instant = nominal + hours * 3600000, part = zonedParts(instant, zone);
    offsets.add(Date.parse(`${part.date}T${part.time}:${pad(part.second)}Z`) - instant);
  }
  const matches: number[] = [];
  for (const offset of offsets) {
    const instant = nominal - offset, part = zonedParts(instant, zone);
    if (part.date === date && part.time === time && part.second === 0) matches.push(instant);
  }
  if (!matches.length) return fail('NONEXISTENT_LOCAL_TIME', 'Esa hora no existe en la zona indicada por un cambio de horario. Elige otra hora.');
  if (matches.length > 1) return fail('AMBIGUOUS_LOCAL_TIME', 'Esa hora se repite en la zona indicada. Usa una hora inequívoca o UTC.');
  return new Date(matches[0]);
}

export function zoneFromText(text: string, fallback = localTimeZone()) {
  const match = /\bzona(?: horaria)?\s+([A-Za-z0-9_+\/-]+)\b/i.exec(text);
  return { timeZone: timeZone(match ? match[1] : fallback), matched: match?.[0] || '' };
}
const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function dateFromText(text: string, zone = localTimeZone(), now = new Date()): string {
  if (/\bsin fecha\b/i.test(text)) return '';
  const today = localCalendarDate(now, zone), requested: string[] = [];
  const cleaned = text.toLowerCase().replace(/(?:de|por) la mañana/g, '');
  if (/\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|pr[oó]xima semana|pr[oó]ximo mes)\b/.test(cleaned) ||
      /\b\d{1,2}\/\d{1,2}(?![\d/])\b/.test(cleaned.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '')))
    return fail('AMBIGUOUS_DATE', 'Indica la fecha completa en AAAA-MM-DD o DD/MM/AAAA.');
  for (const match of cleaned.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) requested.push(calendarDate(match[0]));
  for (const match of cleaned.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g))
    requested.push(calendarDate(`${match[3]}-${pad(Number(match[2]))}-${pad(Number(match[1]))}`));
  const monthPattern = new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${months.join('|')})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`, 'g');
  for (const match of cleaned.matchAll(monthPattern)) {
    const year = match[3] || today.slice(0, 4);
    const date = calendarDate(`${year}-${pad(months.indexOf(match[2]) + 1)}-${pad(Number(match[1]))}`);
    if (!match[3] && date < today) return fail('AMBIGUOUS_YEAR', 'Indica el año para esa fecha que ya ha pasado.');
    requested.push(date);
  }
  for (const match of cleaned.matchAll(/\b(pasado mañana|mañana|hoy|ayer)\b/g))
    requested.push(addCalendarDays(today, match[1] === 'pasado mañana' ? 2 : match[1] === 'mañana' ? 1 : match[1] === 'ayer' ? -1 : 0));
  if (new Set(requested).size > 1) return fail('AMBIGUOUS_DATE', 'Hay varias fechas distintas; indica una sola.');
  return requested[0] || today;
}

export function clockPrefix(text: string) {
  const match = /^(mediod[ií]a|medianoche|[\d:.]+(?:\s*(?:a\.m\.|p\.m\.|am|pm|(?:de|por) la (?:mañana|tarde|noche)))?)(?=$|\s|[,;])/i.exec(text.trimStart());
  if (!match) return fail('INVALID_TIME', 'Falta una hora válida después de la indicación horaria.');
  return { time: clockTime(match[1]), matched: match[0] };
}
export function timeFromText(text: string, end = false): { time: string; matched: string } | undefined {
  const pattern = end ? /\b(?:hasta las|fin a las|hasta)\s+/gi : /\b(?:a las|para las|desde las|inicio a las)\s+/gi;
  const found: Array<{ time: string; matched: string }> = [];
  for (const match of text.matchAll(pattern)) {
    if (!end && match.index! > 0 && /(?:hasta|fin)\s+$/.test(text.slice(0, match.index))) continue;
    const value = clockPrefix(text.slice(match.index! + match[0].length));
    found.push({ time: value.time, matched: match[0] + value.matched });
    if (/^\s+(?:o|y)\s+\d/.test(text.slice(match.index! + match[0].length + value.matched.length)))
      return fail('AMBIGUOUS_TIME', 'Hay varias horas posibles; indica una sola.');
  }
  if (found.length > 1) return fail('AMBIGUOUS_TIME', 'Indica una sola hora de inicio y una de fin.');
  return found[0];
}

export function stripTemporalText(text: string): string {
  let result = text;
  for (const end of [false, true]) {
    const clock = timeFromText(text, end);
    if (clock) result = result.replace(clock.matched, '');
  }
  result = result.replace(/\bzona(?: horaria)?\s+[A-Za-z0-9_+\/-]+\b/gi, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '').replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '')
    .replace(new RegExp(`\\b\\d{1,2}\\s+de\\s+(?:${months.join('|')})(?:\\s+(?:de\\s+)?\\d{4})?\\b`, 'gi'), '')
    .replace(/\b(?:pasado mañana|hoy|ayer|sin fecha)\b/gi, '')
    .replace(/(?<!de la )(?<!por la )\bmañana\b/gi, '')
    .replace(/\b(?:por|durante)\s*\d+\s*(?:horas?|hrs?|minutos?|min)\b/gi, '');
  return result.replace(/\s+/g, ' ').trim();
}

export interface CalendarTiming { date: string; time: string; endTime?: string; endDate?: string; timeZone?: string; allDay?: boolean; }
export function eventInterval(event: CalendarTiming, fallbackZone = localTimeZone()) {
  const date = calendarDate(event.date), zone = timeZone(event.timeZone || fallbackZone);
  if (event.allDay) {
    const endDate = event.endDate ? calendarDate(event.endDate) : addCalendarDays(date, 1);
    if (endDate <= date) return fail('INVALID_INTERVAL', 'La fecha final de un evento de día completo es exclusiva y debe ser posterior.');
    return { start: zonedInstant(date, '00:00', zone), end: zonedInstant(endDate, '00:00', zone),
      date, time: '', endDate, endTime: '', timeZone: event.timeZone ? zone : undefined, allDay: true };
  }
  const time = clockTime(event.time), endTime = event.endTime ? clockTime(event.endTime) : undefined;
  const start = zonedInstant(date, time, zone);
  if (!endTime) {
    if (event.endDate) return fail('TIME_REQUIRED', 'Indica la hora final junto a la fecha final.');
    const end = new Date(start.getTime() + 3600000), localEnd = zonedParts(end, zone);
    // Ensure this can be represented without a hidden DST fold.
    zonedInstant(localEnd.date, localEnd.time, zone);
    return { start, end, date, time, endDate: localEnd.date, endTime: localEnd.time,
      timeZone: event.timeZone ? zone : undefined, allDay: false };
  }
  const endDate = event.endDate ? calendarDate(event.endDate) : endTime < time ? addCalendarDays(date, 1) : date;
  const end = zonedInstant(endDate, endTime, zone);
  if (end.getTime() <= start.getTime()) return fail('INVALID_INTERVAL', 'El final debe ser posterior al inicio.');
  return { start, end, date, time, endDate, endTime, timeZone: event.timeZone ? zone : undefined, allDay: false };
}
export function taskTiming(dueDate: string, timeDue: string, zone = localTimeZone()) {
  const normalizedZone = timeZone(zone);
  if (!dueDate) {
    if (timeDue) return fail('DATE_REQUIRED', 'Indica una fecha para esa hora.');
    return { dueDate: '', timeDue: '', timeZone: normalizedZone, dueAt: undefined, snoozedUntil: undefined };
  }
  const date = calendarDate(dueDate), time = timeDue ? clockTime(timeDue) : '';
  return { dueDate: date, timeDue: time, timeZone: normalizedZone,
    dueAt: time ? zonedInstant(date, time, normalizedZone).toISOString() : undefined, snoozedUntil: undefined };
}
export function snoozeTaskTiming(zone: string | undefined, minutes: number, now = new Date()) {
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 10080)
    return fail('INVALID_DURATION', 'Posponer requiere entre 1 y 10080 minutos.');
  const normalizedZone = timeZone(zone || localTimeZone()), due = new Date(now.getTime() + minutes * 60000);
  const parts = zonedParts(due, normalizedZone);
  return { dueDate: parts.date, timeDue: parts.time, timeZone: normalizedZone,
    dueAt: due.toISOString(), snoozedUntil: due.toISOString() };
}
export function taskDueInstant(task: { dueDate: string; timeDue: string; timeZone?: string; dueAt?: string }) {
  if (!task.dueDate || !task.timeDue) return undefined;
  const date = calendarDate(task.dueDate), time = clockTime(task.timeDue), zone = task.timeZone || localTimeZone();
  if (task.dueAt) {
    const due = new Date(task.dueAt);
    if (!Number.isFinite(due.getTime()) || due.toISOString() !== task.dueAt)
      return fail('INVALID_INSTANT', 'El instante del recordatorio no es válido.');
    const parts = zonedParts(due, zone);
    if (parts.date !== date || parts.time !== time)
      return fail('INCONSISTENT_INSTANT', 'La fecha, hora y zona no coinciden con el instante del recordatorio.');
    return due;
  }
  return zonedInstant(date, time, zone);
}
export function taskDueInMinute(task: { dueDate: string; timeDue: string; timeZone?: string; dueAt?: string; isCompleted: boolean }, now = new Date()) {
  if (task.isCompleted) return false;
  try {
    const due = taskDueInstant(task);
    return due !== undefined && Math.floor(due.getTime() / 60000) === Math.floor(now.getTime() / 60000);
  } catch (error) { if (error instanceof TemporalInputError) return false; throw error; }
}
export function compactInstant(value: Date) { return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }
export function compactWall(date: string, time: string) { return calendarDate(date).replace(/-/g, '') + 'T' + clockTime(time).replace(':', '') + '00'; }
export function icalText(value: string) { return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/\r/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
export function foldICalLines(lines: string[]) {
  return lines.map(line => {
    let output = '', bytes = 0;
    for (const char of line) {
      const length = new TextEncoder().encode(char).length;
      if (bytes + length > 75) { output += '\r\n '; bytes = 1; }
      output += char; bytes += length;
    }
    return output;
  }).join('\r\n');
}
