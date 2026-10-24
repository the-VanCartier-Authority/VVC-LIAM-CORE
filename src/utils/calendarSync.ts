// Local calendar comparison and file/template adapters. No provider sync is performed here.
import type { CalendarEvent } from '../types';
import { TemporalInputError, addCalendarDays, calendarDate, clockTime, compactInstant, compactWall,
  eventInterval, foldICalLines, icalText, localTimeZone, timeZone, zonedParts,
  type CalendarTiming } from './temporal.ts';

type Slot = CalendarTiming & { endTime: string; label: string };
function singleInterval(event: CalendarTiming & { recurrence?: string }) {
  if (event.recurrence && event.recurrence !== 'none')
    throw new TemporalInputError('UNSUPPORTED_RECURRENCE', 'La comprobación y exportación sólo admiten eventos puntuales; revisa la recurrencia.');
  return eventInterval(event);
}
export interface ConflictAnalysis {
  status: 'clear' | 'conflict' | 'unavailable';
  hasConflict: boolean;
  conflictingEvents: CalendarEvent[];
  message: string;
  suggestedSlots: Slot[];
}
export function timeToMinutes(value: string): number {
  const [hour, minute] = clockTime(value).split(':').map(Number);
  return hour * 60 + minute;
}
export function minutesToTime(value: number): string {
  if (!Number.isSafeInteger(value)) throw new TemporalInputError('INVALID_TIME', 'Minutos no válidos.');
  const minutes = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export function detectEventConflicts(candidate: CalendarTiming & { id?: string; recurrence?: string }, existingEvents: CalendarEvent[]): ConflictAnalysis {
  try {
    const zone = candidate.timeZone || localTimeZone(), interval = singleInterval(candidate);
    const others = existingEvents.filter(event => !candidate.id || event.id !== candidate.id)
      .map(event => ({ event, interval: singleInterval(event) }));
    const overlaps = (start: number, end: number) => others.filter(other =>
      start < other.interval.end.getTime() && other.interval.start.getTime() < end);
    const conflicts = overlaps(interval.start.getTime(), interval.end.getTime());
    if (!conflicts.length) return { status: 'clear', hasConflict: false, conflictingEvents: [],
      message: 'Sin solapamientos en los eventos locales válidos. No comprueba calendarios externos.', suggestedSlots: [] };
    const suggestedSlots: Slot[] = [], seen = new Set<string>();
    const duration = interval.end.getTime() - interval.start.getTime();
    const propose = (timing: CalendarTiming, label: string) => {
      try {
        const next = eventInterval(timing, zone), key = next.start.toISOString();
        if (!seen.has(key) && !overlaps(next.start.getTime(), next.end.getTime()).length) {
          seen.add(key);
          suggestedSlots.push({ date: next.date, time: next.time, endTime: next.endTime,
            endDate: next.endDate, timeZone: candidate.timeZone, allDay: candidate.allDay, label });
        }
      } catch (error) { if (!(error instanceof TemporalInputError)) throw error; }
    };
    if (!candidate.allDay) {
      const after = Math.max(...conflicts.map(other => other.interval.end.getTime())) + 15 * 60000;
      const before = Math.min(...conflicts.map(other => other.interval.start.getTime())) - duration - 15 * 60000;
      for (const start of [after, before]) {
        const a = zonedParts(start, zone), b = zonedParts(start + duration, zone);
        if (a.date === interval.date && b.date === a.date && a.time >= '08:00' && b.time <= '22:00')
          propose({ ...candidate, date: a.date, time: a.time, endDate: b.date, endTime: b.time }, `El ${a.date} a las ${a.time} (${zone})`);
      }
    }
    for (let day = 1; day <= 7 && suggestedSlots.length < 3; day++) {
      const date = addCalendarDays(interval.date, day);
      const days = Math.round((Date.parse(interval.endDate + 'T00:00Z') - Date.parse(interval.date + 'T00:00Z')) / 86400000);
      propose({ ...candidate, date, endDate: addCalendarDays(date, days), endTime: interval.endTime },
        `El ${date}${candidate.allDay ? ' (día completo)' : ` a las ${interval.time}`} (${zone})`);
    }
    return { status: 'conflict', hasConflict: true, conflictingEvents: conflicts.map(other => other.event),
      message: `Solapamiento con ${conflicts.map(other => `"${other.event.title}"`).join(', ')}. ${suggestedSlots.length} alternativas comprobadas en la lista local.`, suggestedSlots };
  } catch (error) {
    if (!(error instanceof TemporalInputError)) throw error;
    return { status: 'unavailable', hasConflict: false, conflictingEvents: [], suggestedSlots: [],
      message: `No se puede comprobar disponibilidad: ${error.message} Revisa los datos temporales.` };
  }
}
export function resolveEventConflict(candidate: CalendarEvent, existingEvents: CalendarEvent[]): { resolvedEvent: CalendarEvent; note: string } {
  const analysis = detectEventConflicts(candidate, existingEvents);
  if (analysis.status === 'unavailable') throw new TemporalInputError('AVAILABILITY_UNKNOWN', analysis.message);
  if (!analysis.hasConflict) return { resolvedEvent: candidate, note: 'Sin cambios requeridos en la lista local.' };
  const slot = analysis.suggestedSlots[0];
  if (!slot) throw new TemporalInputError('NO_FREE_SLOT', 'No se encontró un horario libre en los próximos siete días.');
  const { label, ...timing } = slot;
  const note = `Horario local reajustado: ${label}. No sincronizado con proveedores.`;
  return { resolvedEvent: { ...candidate, ...timing, syncStatus: 'conflict_resolved', conflictNote: note }, note };
}

export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const interval = singleInterval(event);
  const dates = event.allDay ? `${interval.date.replace(/-/g, '')}/${interval.endDate.replace(/-/g, '')}`
    : interval.timeZone ? `${compactInstant(interval.start)}/${compactInstant(interval.end)}`
      : `${compactWall(interval.date, interval.time)}/${compactWall(interval.endDate, interval.endTime)}`;
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates,
    details: event.description || '', location: event.location || '' });
  if (interval.timeZone) params.set('ctz', interval.timeZone);
  if (event.attendees?.length) params.set('add', event.attendees.join(','));
  return `https://calendar.google.com/calendar/render?${params}`;
}
export function generateOutlookCalendarUrl(event: CalendarEvent): string {
  const interval = singleInterval(event);
  const params = new URLSearchParams({ subject: event.title,
    startdt: event.allDay ? interval.date : interval.timeZone ? interval.start.toISOString() : `${interval.date}T${interval.time}:00`,
    enddt: event.allDay ? interval.endDate : interval.timeZone ? interval.end.toISOString() : `${interval.endDate}T${interval.endTime}:00`,
    body: event.description || '', location: event.location || '' });
  if (event.allDay) params.set('allday', 'true');
  return `https://outlook.live.com/calendar/0/action/compose?${params}`;
}
export function calendarEventLines(event: CalendarEvent): string[] {
  if (event.recurrence && event.recurrence !== 'none')
    throw new TemporalInputError('UNSUPPORTED_RECURRENCE', 'La exportación admite eventos puntuales. Revisa la recurrencia antes de exportar.');
  const interval = eventInterval(event);
  const start = event.allDay ? `DTSTART;VALUE=DATE:${interval.date.replace(/-/g, '')}`
    : `DTSTART:${interval.timeZone ? compactInstant(interval.start) : compactWall(interval.date, interval.time)}`;
  const end = event.allDay ? `DTEND;VALUE=DATE:${interval.endDate.replace(/-/g, '')}`
    : `DTEND:${interval.timeZone ? compactInstant(interval.end) : compactWall(interval.endDate, interval.endTime)}`;
  return ['BEGIN:VEVENT', `UID:${icalText(event.iCalUID || `event-${event.id}@vvc-liam.internal`)}`,
    `DTSTAMP:${compactInstant(new Date())}`, start, end, `SUMMARY:${icalText(event.title)}`,
    ...(event.location ? [`LOCATION:${icalText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${icalText(event.description)}`] : []),
    ...(!event.allDay ? ['BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15M', `DESCRIPTION:${icalText(event.title)}`, 'END:VALARM'] : []), 'END:VEVENT'];
}
export function generateAppleCalendarICS(event: CalendarEvent): string {
  return foldICalLines(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//VVC LIAM CORE//Calendar Export//ES',
    'CALSCALE:GREGORIAN', ...calendarEventLines(event), 'END:VCALENDAR']);
}

function unescapeText(value: string) { return value.replace(/\\([nN,;\\])/g, (_, char) => /n/i.test(char) ? '\n' : char); }
type Property = { name: string; params: Record<string, string>; value: string };
function importedTime(property: Property) {
  const { params, value } = property;
  if (Object.keys(params).some(key => !['TZID', 'VALUE'].includes(key)))
    throw new TemporalInputError('UNSUPPORTED_ICS', 'Parámetros temporales no admitidos.');
  if (params.VALUE === 'DATE') {
    if (!/^\d{8}$/.test(value) || params.TZID) throw new TemporalInputError('INVALID_ICS', 'Fecha de día completo no válida.');
    return { date: calendarDate(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`), time: '', allDay: true, timeZone: undefined };
  }
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!match || match[6] !== '00' || (params.VALUE && params.VALUE !== 'DATE-TIME') || (match[7] && params.TZID))
    throw new TemporalInputError('UNSUPPORTED_ICS', 'Se admiten horas a precisión de minutos, UTC, flotantes o TZID IANA.');
  return { date: calendarDate(`${match[1]}-${match[2]}-${match[3]}`), time: clockTime(`${match[4]}:${match[5]}`),
    allDay: false, timeZone: match[7] ? 'UTC' : params.TZID ? timeZone(params.TZID) : undefined };
}
// Deliberately limited subset. Reject unsupported schedules as a whole, never fabricate defaults.
export function parseICSFeed(content: string, source: 'google' | 'outlook' | 'apple' = 'apple'): CalendarEvent[] {
  if (typeof content !== 'string' || content.length > 2 * 1024 * 1024)
    throw new TemporalInputError('INVALID_ICS', 'El calendario supera el límite de 2 MiB.');
  const lines = content.replace(/\r?\n[ \t]/g, '').split(/\r?\n/).filter(Boolean);
  if (lines[0] !== 'BEGIN:VCALENDAR' || lines.at(-1) !== 'END:VCALENDAR')
    throw new TemporalInputError('INVALID_ICS', 'Calendario incompleto o no reconocido.');
  const events: CalendarEvent[] = []; let fields: Property[] | undefined, alarm = false;
  for (const line of lines.slice(1, -1)) {
    if (/^METHOD:/i.test(line) && !/^METHOD:PUBLISH$/i.test(line))
      throw new TemporalInputError('UNSUPPORTED_ICS', 'No se admiten invitaciones, respuestas ni cancelaciones como archivos de importación.');
    if (/^(?:BEGIN:VTIMEZONE|RRULE[:;]|RDATE[:;]|EXDATE[:;]|RECURRENCE-ID[:;]|DURATION[:;]|METHOD:CANCEL|STATUS:CANCELLED)/i.test(line))
      throw new TemporalInputError('UNSUPPORTED_ICS', 'Este importador no admite recurrencias, zonas VTIMEZONE ni cancelaciones. Importa eventos simples sin recurrencia.');
    if (line === 'BEGIN:VEVENT') {
      if (fields || events.length >= 2000) throw new TemporalInputError('INVALID_ICS', 'Estructura o número de eventos no admitido.');
      fields = []; continue;
    }
    if (line === 'BEGIN:VALARM' && fields && !alarm) { alarm = true; continue; }
    if (line === 'END:VALARM' && alarm) { alarm = false; continue; }
    if (line === 'END:VEVENT') {
      if (!fields || alarm) throw new TemporalInputError('INVALID_ICS', 'Evento incompleto.');
      const one = (name: string, required = false) => {
        const values = fields!.filter(field => field.name === name);
        if (values.length > 1 || (required && !values.length)) throw new TemporalInputError('INVALID_ICS', `Campo ${name} duplicado o ausente.`);
        return values[0];
      };
      const start = importedTime(one('DTSTART', true)!);
      const endProperty = one('DTEND');
      if (!endProperty && !start.allDay) throw new TemporalInputError('UNSUPPORTED_ICS', 'El evento con hora requiere DTEND explícito.');
      const end = endProperty ? importedTime(endProperty) : { ...start, date: addCalendarDays(start.date, 1) };
      if (start.allDay !== end.allDay || start.timeZone !== end.timeZone)
        throw new TemporalInputError('UNSUPPORTED_ICS', 'Inicio y fin deben usar el mismo tipo y zona horaria.');
      const title = unescapeText(one('SUMMARY', true)!.value);
      if (!title.trim()) throw new TemporalInputError('INVALID_ICS', 'Falta el título del evento.');
      const event: CalendarEvent = { id: `ev-import-${crypto.randomUUID()}`, title,
        ...start, endDate: end.date, endTime: end.time, description: unescapeText(one('DESCRIPTION')?.value || ''),
        location: unescapeText(one('LOCATION')?.value || ''), iCalUID: unescapeText(one('UID')?.value || '') || undefined,
        attendees: fields.filter(field => field.name === 'ATTENDEE' && /^mailto:/i.test(field.value)).map(field => field.value.slice(7)),
        category: 'reunion', isAutomated: false, source, syncStatus: 'local' };
      eventInterval(event); events.push(event); fields = undefined; continue;
    }
    if (alarm) continue;
    if (/^(?:BEGIN|END):/.test(line)) throw new TemporalInputError('UNSUPPORTED_ICS', 'Componente de calendario no admitido.');
    if (!fields) continue;
    const colon = line.indexOf(':');
    if (colon < 1) throw new TemporalInputError('INVALID_ICS', 'Propiedad de calendario no válida.');
    const [name, ...parameters] = line.slice(0, colon).split(';'), params: Record<string, string> = {};
    for (const parameter of parameters) {
      const equals = parameter.indexOf('=');
      if (equals < 1) throw new TemporalInputError('INVALID_ICS', 'Parámetro de calendario no válido.');
      const key = parameter.slice(0, equals).toUpperCase();
      if (Object.hasOwn(params, key)) throw new TemporalInputError('INVALID_ICS', 'Parámetro duplicado.');
      params[key] = parameter.slice(equals + 1).replace(/^"(.*)"$/, '$1');
    }
    fields.push({ name: name.toUpperCase(), params, value: line.slice(colon + 1) });
  }
  if (fields || alarm || !events.length) throw new TemporalInputError('INVALID_ICS', 'No hay eventos simples completos para importar.');
  return events;
}
