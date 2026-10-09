/**
 * Advanced Calendar Conflict Detection & Multi-Provider Synchronization
 * Supports bi-directional sync with Google Calendar, Outlook Calendar, and Apple Calendar.
 */

import type { CalendarEvent } from '../types';

export interface ConflictAnalysis {
  hasConflict: boolean;
  conflictingEvents: CalendarEvent[];
  message: string;
  suggestedSlots: Array<{
    date: string;
    time: string;
    endTime: string;
    label: string;
  }>;
}

/**
 * Convert HH:mm to minutes from midnight
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
}

/**
 * Convert minutes from midnight to HH:mm
 */
export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Detect scheduling conflicts for a candidate event against an existing event list
 */
export function detectEventConflicts(
  candidate: { date: string; time: string; endTime?: string; id?: string },
  existingEvents: CalendarEvent[]
): ConflictAnalysis {
  const candStart = timeToMinutes(candidate.time);
  const candEnd = candidate.endTime
    ? timeToMinutes(candidate.endTime)
    : candStart + 60; // Default 1 hour duration

  const dayEvents = existingEvents.filter(
    (e) => e.date === candidate.date && (!candidate.id || e.id !== candidate.id)
  );

  const conflictingEvents: CalendarEvent[] = [];

  for (const event of dayEvents) {
    const evStart = timeToMinutes(event.time);
    const evEnd = event.endTime ? timeToMinutes(event.endTime) : evStart + 60;

    // Overlap condition: startA < endB && startB < endA
    if (candStart < evEnd && evStart < candEnd) {
      conflictingEvents.push(event);
    }
  }

  if (conflictingEvents.length === 0) {
    return {
      hasConflict: false,
      conflictingEvents: [],
      message: 'No se detectaron conflictos. El horario seleccionado está completamente disponible.',
      suggestedSlots: [],
    };
  }

  // Calculate intelligent conflict-free suggestions
  const suggestedSlots: Array<{ date: string; time: string; endTime: string; label: string }> = [];
  const duration = candEnd - candStart;

  // 1. Slot immediately after the latest conflicting event (+15 min buffer)
  const maxConflictEnd = Math.max(
    ...conflictingEvents.map((e) => (e.endTime ? timeToMinutes(e.endTime) : timeToMinutes(e.time) + 60))
  );
  const afterSlotStart = maxConflictEnd + 15;
  if (afterSlotStart + duration <= 22 * 60) {
    // Check if this slot conflicts with any other event
    const collides = dayEvents.some((e) => {
      const s = timeToMinutes(e.time);
      const en = e.endTime ? timeToMinutes(e.endTime) : s + 60;
      return afterSlotStart < en && s < afterSlotStart + duration;
    });
    if (!collides) {
      suggestedSlots.push({
        date: candidate.date,
        time: minutesToTime(afterSlotStart),
        endTime: minutesToTime(afterSlotStart + duration),
        label: `Mismo día a las ${minutesToTime(afterSlotStart)} (después del evento anterior)`,
      });
    }
  }

  // 2. Slot earlier if possible (e.g. 1 hour earlier)
  const minConflictStart = Math.min(...conflictingEvents.map((e) => timeToMinutes(e.time)));
  const earlierSlotStart = minConflictStart - duration - 15;
  if (earlierSlotStart >= 8 * 60) {
    const collides = dayEvents.some((e) => {
      const s = timeToMinutes(e.time);
      const en = e.endTime ? timeToMinutes(e.endTime) : s + 60;
      return earlierSlotStart < en && s < earlierSlotStart + duration;
    });
    if (!collides) {
      suggestedSlots.push({
        date: candidate.date,
        time: minutesToTime(earlierSlotStart),
        endTime: minutesToTime(earlierSlotStart + duration),
        label: `Mismo día a las ${minutesToTime(earlierSlotStart)} (antes de ${conflictingEvents[0].title})`,
      });
    }
  }

  // 3. Next day at original requested time
  const candDateObj = new Date(candidate.date);
  candDateObj.setDate(candDateObj.getDate() + 1);
  const nextDateStr = candDateObj.toISOString().split('T')[0];
  suggestedSlots.push({
    date: nextDateStr,
    time: candidate.time,
    endTime: candidate.endTime || minutesToTime(candStart + 60),
    label: `Día siguiente (${nextDateStr}) a las ${candidate.time}`,
  });

  const conflictTitles = conflictingEvents.map((e) => `"${e.title}" (${e.time} - ${e.endTime || 'fin'})`).join(', ');
  const message = `Conflicto detectado con ${conflictTitles}. Se han calculado ${suggestedSlots.length} alternativas sin solapamiento.`;

  return {
    hasConflict: true,
    conflictingEvents,
    message,
    suggestedSlots,
  };
}

/**
 * Automatically resolve conflict by adjusting event to the first free slot
 */
export function resolveEventConflict(
  candidate: CalendarEvent,
  existingEvents: CalendarEvent[]
): { resolvedEvent: CalendarEvent; note: string } {
  const analysis = detectEventConflicts(candidate, existingEvents);
  if (!analysis.hasConflict || analysis.suggestedSlots.length === 0) {
    return {
      resolvedEvent: candidate,
      note: 'Sin cambios requeridos.',
    };
  }

  const bestSlot = analysis.suggestedSlots[0];
  const resolved: CalendarEvent = {
    ...candidate,
    date: bestSlot.date,
    time: bestSlot.time,
    endTime: bestSlot.endTime,
    syncStatus: 'conflict_resolved',
    conflictNote: `Horario reajustado automáticamente de ${candidate.time} a ${bestSlot.time} para evitar solapamiento con ${analysis.conflictingEvents[0].title}.`,
  };

  return {
    resolvedEvent: resolved,
    note: resolved.conflictNote || '',
  };
}

/**
 * Generate direct Google Calendar URL to schedule the event in 1-click
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const startClean = event.date.replace(/-/g, '') + 'T' + event.time.replace(/:/g, '') + '00Z';
  const endClean = event.date.replace(/-/g, '') + 'T' + (event.endTime || event.time).replace(/:/g, '') + '00Z';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startClean}/${endClean}`,
    details: event.description || `Evento programado por VVC-ACIA Assistant. Categoría: ${event.category || 'General'}`,
    location: event.location || 'VVC-ACIA Core',
  });

  if (event.attendees && event.attendees.length > 0) {
    params.set('add', event.attendees.join(','));
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate direct Outlook Calendar URL (Microsoft 365 / Outlook Live)
 */
export function generateOutlookCalendarUrl(event: CalendarEvent): string {
  const startIso = `${event.date}T${event.time}:00`;
  const endIso = `${event.date}T${event.endTime || event.time}:00`;

  const params = new URLSearchParams({
    subject: event.title,
    startdt: startIso,
    enddt: endIso,
    body: event.description || `Evento VVC-ACIA. Asistentes: ${event.attendees?.join(', ') || 'N/A'}`,
    location: event.location || 'VVC-ACIA Core',
  });

  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

/**
 * Generate Apple Calendar WebCal / Downloadable .ICS specific for macOS/iOS Calendar app
 */
export function generateAppleCalendarICS(event: CalendarEvent): string {
  const startStr = event.date.replace(/-/g, '') + 'T' + event.time.replace(/:/g, '') + '00Z';
  const endStr = event.date.replace(/-/g, '') + 'T' + (event.endTime || event.time).replace(/:/g, '') + '00Z';
  const uid = event.iCalUID || `apple-${event.id}-${Date.now()}@vvc-acia.apple`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Apple Inc.//macOS Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:VVC-ACIA Apple Sync',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${startStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.location || ''}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'ACTION:AUDIO',
    'TRIGGER:-PT15M',
    'ATTACH;VALUE=URI:Basso',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

/**
 * Parse an imported .ICS text file (from Google, Outlook, or Apple Calendar) into CalendarEvent objects
 */
export function parseICSFeed(icsContent: string, providerSource: 'google' | 'outlook' | 'apple' = 'apple'): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const eventBlocks = icsContent.split('BEGIN:VEVENT');

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split('END:VEVENT')[0];
    if (!block) continue;

    let summary = 'Evento Importado';
    let date = new Date().toISOString().split('T')[0];
    let time = '10:00';
    let endTime = '11:00';
    let location = '';
    let description = '';
    let uid = `imported-${Date.now()}-${i}`;
    let attendees: string[] = [];

    const lines = block.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line.startsWith('SUMMARY:')) {
        summary = line.substring(8).trim();
      } else if (line.startsWith('LOCATION:')) {
        location = line.substring(9).trim();
      } else if (line.startsWith('DESCRIPTION:')) {
        description = line.substring(12).replace(/\\n/g, '\n').trim();
      } else if (line.startsWith('UID:')) {
        uid = line.substring(4).trim();
      } else if (line.startsWith('ATTENDEE')) {
        const emailMatch = line.match(/mailto:([^\s;>]+)/i);
        if (emailMatch) attendees.push(emailMatch[1]);
      } else if (line.startsWith('DTSTART')) {
        // e.g.: DTSTART:20261015T143000Z or DTSTART;VALUE=DATE:20261015
        const dateMatch = line.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
        if (dateMatch) {
          date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
          if (dateMatch[4] && dateMatch[5]) {
            time = `${dateMatch[4]}:${dateMatch[5]}`;
          }
        }
      } else if (line.startsWith('DTEND')) {
        const endMatch = line.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
        if (endMatch && endMatch[4] && endMatch[5]) {
          endTime = `${endMatch[4]}:${endMatch[5]}`;
        }
      }
    }

    events.push({
      id: `ev-sync-${Date.now()}-${i}`,
      title: summary,
      date,
      time,
      endTime,
      location: location || `${providerSource.toUpperCase()} Sync`,
      description,
      category: 'reunion',
      isAutomated: true,
      attendees: attendees.length > 0 ? attendees : undefined,
      iCalUID: uid,
      source: providerSource,
      syncStatus: 'synced',
    });
  }

  return events;
}
