import type { VaosTaskDetail } from './adapters/types';
const terminal = new Set(['COMPLETED', 'FAILED', 'UNAVAILABLE', 'CANCELLED', 'INTERRUPTED']);
export function taskPollView(task: VaosTaskDetail, queryExpired = false) {
  if (!terminal.has(task.status)) return { stop: queryExpired,
    text: queryExpired ? `Consulta detenida: tarea ${task.status}. El resultado no está disponible; consulta su estado de nuevo.` : `Tarea ${task.status}.` };
  if (task.status !== 'COMPLETED') return { stop: true,
    text: `Tarea ${task.status}: ${task.result?.text || 'No hay un resultado de generación verificado.'} No acredita acciones externas.` };
  const duration = typeof task.durationMs === 'number' ? `${task.durationMs.toFixed(1)}ms` : 'N/D';
  return { stop: true, text: `Generación terminada en ${duration}. No acredita acciones externas.` };
}
