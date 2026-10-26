/**
 * iCalendar (RFC 5545) & Third-Party Integration Dispatcher
 * Seamless export to Google Calendar, Apple Calendar, Outlook, and webhook integrations.
 */

import type { CalendarEvent, TaskItem } from '../types';
import { executionOutcome } from '../shared/executionOutcome.ts';
import type { ExecutionOutcome } from '../shared/executionOutcome.ts';

/**
 * Format Date & Time into iCal timestamp format (YYYYMMDDTHHMMSSZ)
 */
function formatICalDateTime(dateStr: string, timeStr = '00:00'): string {
  const [year, month, day] = dateStr.split('-');
  const [hours, minutes] = timeStr.split(':');

  const d = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10) || 0,
    parseInt(minutes, 10) || 0
  );

  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Generate standard RFC 5545 .ics calendar content
 */
export function generateICSContent(events: CalendarEvent[], tasks: TaskItem[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VVC-LIAM-CORE//Voice Assistant//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:VVC LIAM CORE Agenda & Tareas',
    'X-WR-TIMEZONE:UTC',
  ];

  // Export Calendar Events
  events.forEach((event) => {
    const startStr = formatICalDateTime(event.date, event.time);
    const endStr = formatICalDateTime(event.date, event.endTime || event.time);
    const uid = event.iCalUID || `event-${event.id}-${Date.now()}@vvc-liam.internal`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${formatICalDateTime(new Date().toISOString().split('T')[0])}`);
    lines.push(`DTSTART:${startStr}`);
    lines.push(`DTEND:${endStr}`);
    lines.push(`SUMMARY:${event.title.replace(/\n/g, ' ')}`);
    if (event.location) {
      lines.push(`LOCATION:${event.location.replace(/\n/g, ' ')}`);
    }
    if (event.description) {
      lines.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
    }
    lines.push('STATUS:CONFIRMED');
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT15M');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Recordatorio VVC LIAM CORE: ${event.title}`);
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  });

  // Export Tasks & Reminders as VTODO / VEVENT with alarm
  tasks.forEach((task) => {
    const taskDate = task.dueDate || new Date().toISOString().split('T')[0];
    const taskStart = formatICalDateTime(taskDate, task.timeDue);
    const uid = `task-${task.id}@vvc-liam.internal`;

    lines.push('BEGIN:VTODO');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${formatICalDateTime(new Date().toISOString().split('T')[0])}`);
    lines.push(`DUE:${taskStart}`);
    lines.push(`SUMMARY:${task.title}`);
    lines.push(`STATUS:${task.isCompleted ? 'COMPLETED' : 'NEEDS-ACTION'}`);
    lines.push(`PRIORITY:${task.priority === 'critica' ? '1' : task.priority === 'alta' ? '2' : '5'}`);
    if (task.description) {
      lines.push(`DESCRIPTION:${task.description.replace(/\n/g, '\\n')}`);
    }
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT0M');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${task.title}`);
    lines.push('END:VALARM');
    lines.push('END:VTODO');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Trigger immediate client-side download of the .ics file
 */
export function downloadICSFile(events: CalendarEvent[], tasks: TaskItem[]) {
  const content = generateICSContent(events, tasks);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `vvc_liam_core_agenda_${new Date().toISOString().split('T')[0]}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Dispatch task payload to third-party webhook (Slack, Notion, Zapier, Custom)
 */
export async function dispatchTaskWebhook(
  webhookUrl: string,
  event: 'created' | 'completed' | 'notified' | 'modified',
  task: TaskItem
): Promise<{ success: boolean; delivery: 'accepted' | 'failed' | 'unverified' | 'not_attempted';
  realExecution: false; outcome: ExecutionOutcome; status?: number; error?: string }> {
  let destination: URL;
  try {
    destination = new URL(webhookUrl);
    if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password || destination.hash) throw Error();
  } catch {
    return { success: false, delivery: 'not_attempted', realExecution: false,
      outcome: executionOutcome('unavailable', 'webhook'), error: 'URL de webhook inválida.' };
  }

  const payload = {
    event: `vvc_liam.task.${event}`,
    timestamp: new Date().toISOString(),
    source: 'VVC LIAM CORE Voice Assistant',
    task: {
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      timeDue: task.timeDue,
      priority: task.priority,
      category: task.category,
      isCompleted: task.isCompleted,
      recurrence: task.recurrence,
      subtasksCount: task.subtasks?.length || 0,
      subtasksCompleted: task.subtasks?.filter((s) => s.completed).length || 0,
    },
  };

  try {
    const res = await fetch(destination.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      mode: 'cors', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(15000),
    });

    if (res.type === 'opaque' || res.type === 'opaqueredirect' || res.status === 0) return {
      success: false, delivery: 'unverified', realExecution: false, outcome: executionOutcome('unavailable', 'webhook'),
      error: 'No hay recibo HTTP legible; la entrega no está verificada.',
    };
    if (!res.ok) return { success: false, delivery: 'failed', realExecution: false, status: res.status,
      outcome: executionOutcome('failed', 'webhook'), error: `El servicio devolvió HTTP ${res.status}.` };
    return { success: true, delivery: 'accepted', status: res.status, realExecution: false,
      outcome: executionOutcome('generated', 'webhook-payload') };
  } catch {
    // CORS, network, timeout or redirect errors may occur after transmission.
    // Absence of a receipt proves neither delivery nor non-delivery.
    return { success: false, delivery: 'unverified', realExecution: false,
      outcome: executionOutcome('unavailable', 'webhook'),
      error: 'No hay recibo verificable de red/CORS. La solicitud puede haber llegado; entrega desconocida.' };
  }
}
