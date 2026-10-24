import type { CommandExecutionResult } from '../utils/rtLiteEngine';

function frozenClone<T>(value: T): T {
  const copy = structuredClone(value), seen = new WeakSet<object>();
  const freeze = (item: unknown) => {
    if (!item || typeof item !== 'object' || seen.has(item)) return;
    seen.add(item); for (const child of Object.values(item)) freeze(child); Object.freeze(item);
  };
  freeze(copy); return copy;
}

// Memory-only, single-use authority for one exact local action snapshot. Context
// is opaque and never logged/persisted; callers bind it to UID and relevant data.
export function createConfirmationGate<T>(clock: () => number = () => performance.now(),
  makeNonce: () => string = () => crypto.randomUUID()) {
  let pending: { nonce: string; created: number; context: string; action: T } | null = null;
  return {
    request(action: T, context: string) {
      const nonce = makeNonce();
      pending = { nonce, created: clock(), context, action: frozenClone(action) };
      return nonce;
    },
    take(nonce: string, context: string): T | undefined {
      const item = pending; pending = null;
      const now = clock();
      if (!item || item.nonce !== nonce || item.context !== context || !Number.isFinite(now) || !Number.isFinite(item.created) ||
          now < item.created || now - item.created >= 60000) return undefined;
      return item.action;
    },
    cancel() { pending = null; },
    isPending() { return pending !== null; },
  };
}

export function needsSensitiveConfirmation(intent: CommandExecutionResult, hasTaskWebhook = false): boolean {
  return Boolean(intent.callContact || intent.taskToDeleteId || intent.eventsToUpdate?.length || intent.triggerPushTest ||
    intent.triggerThirdPartySync || (intent.triggerCalendarSync && intent.newCalendarEvent) ||
    (intent.newTask && hasTaskWebhook) || (intent.newCalendarEvent && (intent.newCalendarEvent.conflictNote || intent.detectedConflict?.hasConflict)));
}
export function sensitiveActionSummary(intent: CommandExecutionResult, taskTitle = '', webhook = ''): string {
  if (intent.callContact) return `Abrir el marcador para ${intent.callContact.name} (${intent.callContact.number}). Confirma la llamada en el teléfono.`;
  if (intent.triggerPushTest) return 'Solicitar una prueba de notificación al navegador/dispositivo. La entrega no está verificada.';
  if (intent.taskToDeleteId) return `Eliminar de la lista local la tarea «${taskTitle || intent.taskToDeleteId}».`;
  if (intent.eventsToUpdate) return `Reprogramar ${intent.eventsToUpdate.length} eventos del calendario local.`;
  if (intent.newCalendarEvent) return `Preparar el evento «${intent.newCalendarEvent.title}» (${intent.newCalendarEvent.date} ${intent.newCalendarEvent.time}) en el calendario local. ${intent.newCalendarEvent.conflictNote || ''}${intent.triggerCalendarSync ? ` Solicitar apertura del enlace de ${intent.triggerCalendarSync}.` : ''}`;
  if (intent.newTask && webhook) {
    let target = 'destino configurado';
    try { target = new URL(webhook).host; } catch {}
    return `Crear la tarea «${intent.newTask.title}» y solicitar su envío al webhook de ${target}. La entrega no está verificada.`;
  }
  return 'Solicitar la operación externa indicada. La entrega o sincronización no están verificadas.';
}
