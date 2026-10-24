// Local iCalendar export; provider delivery is a separate operation.
import type { CalendarEvent, TaskItem } from '../types';
import { executionOutcome } from '../shared/executionOutcome.ts';
import type { ExecutionOutcome } from '../shared/executionOutcome.ts';
import { calendarEventLines } from './calendarSync.ts';
import { calendarDate, compactInstant, compactWall, foldICalLines, icalText, taskDueInstant, TemporalInputError, localCalendarDate } from './temporal.ts';

export function generateICSContent(events: CalendarEvent[], tasks: TaskItem[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//VVC LIAM CORE//Agenda Export//ES', 'CALSCALE:GREGORIAN'];
  events.forEach(event => lines.push(...calendarEventLines(event)));
  tasks.forEach(task => {
    if (task.recurrence && task.recurrence !== 'none')
      throw new TemporalInputError('UNSUPPORTED_RECURRENCE', 'La exportación admite tareas puntuales. No se exportará una recurrencia como si fuera un único vencimiento.');
    const due = taskDueInstant(task);
    if (!task.dueDate && task.timeDue) throw new TemporalInputError('DATE_REQUIRED', 'Falta la fecha de una tarea con hora.');
    lines.push('BEGIN:VTODO', `UID:${icalText(`task-${task.id}@vvc-liam.internal`)}`, `DTSTAMP:${compactInstant(new Date())}`);
    if (task.dueDate) lines.push(due ? `DUE:${task.timeZone ? compactInstant(due) : compactWall(task.dueDate, task.timeDue)}`
      : `DUE;VALUE=DATE:${calendarDate(task.dueDate).replace(/-/g, '')}`);
    lines.push(`SUMMARY:${icalText(task.title)}`, `STATUS:${task.isCompleted ? 'COMPLETED' : 'NEEDS-ACTION'}`,
      `PRIORITY:${task.priority === 'critica' ? '1' : task.priority === 'alta' ? '2' : '5'}`);
    if (task.description) lines.push(`DESCRIPTION:${icalText(task.description)}`);
    if (due) lines.push('BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${icalText(task.title)}`, 'END:VALARM');
    lines.push('END:VTODO');
  });
  lines.push('END:VCALENDAR');
  return foldICalLines(lines);
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
  link.setAttribute('download', `vvc_liam_core_agenda_${localCalendarDate()}.ics`);
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
