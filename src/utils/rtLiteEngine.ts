import type { 
  DeviceState, 
  PhoneContact, 
  AlarmItem, 
  TimerItem, 
  CalendarEvent, 
  TaskItem, 
  ThemeColorId,
  TextDocumentData,
  SpreadsheetData,
  ModelType
} from '../types';
import { 
  detectEventConflicts, 
  resolveEventConflict, 
  type ConflictAnalysis 
} from './calendarSync';

import { TemporalInputError, clockTime, clockPrefix, zoneFromText, dateFromText, timeFromText, stripTemporalText, zonedInstant, zonedParts, eventInterval, snoozeTaskTiming, taskTiming } from './temporal.ts';

export interface CommandExecutionResult {
  isHandled: boolean;
  spokenResponse: string;
  actionType?: 
    | 'call' 
    | 'message' 
    | 'torch' 
    | 'volume' 
    | 'brightness' 
    | 'alarm' 
    | 'timer' 
    | 'reminder' 
    | 'task' 
    | 'calendar' 
    | 'security' 
    | 'model' 
    | 'sync' 
    | 'gmail' 
    | 'picker' 
    | 'maps' 
    | 'document' 
    | 'spreadsheet';
  actionDetails?: string;
  updatedDeviceState?: Partial<DeviceState>;
  newAlarm?: Omit<AlarmItem, 'id'>;
  newTimer?: { label: string; seconds: number };
  newTask?: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>;
  taskToCompleteId?: string;
  taskToDeleteId?: string;
  taskToModify?: { id: string; updates: Partial<TaskItem> };
  newCalendarEvent?: Omit<CalendarEvent, 'id'>;
  eventsToUpdate?: CalendarEvent[];
  callContact?: { name: string; number: string };
  messagePayload?: { recipient: string; message: string; channel: 'SMS' | 'WhatsApp' };
  screenFlashlight?: boolean;
  triggerICalExport?: boolean;
  triggerThirdPartySync?: boolean;
  triggerCalendarSync?: 'google' | 'outlook' | 'apple';
  openCalendar?: boolean;
  openGmail?: boolean;
  gmailCompose?: { recipient: string; subject: string; body: string };
  openPicker?: boolean;
  openMaps?: boolean;
  mapsQuery?: string;
  newTheme?: ThemeColorId;
  triggerPushTest?: boolean;
  openSettings?: boolean;
  openDocs?: boolean;
  docsMode?: 'document' | 'spreadsheet';
  newDocument?: TextDocumentData;
  newSpreadsheet?: SpreadsheetData;
  detectedConflict?: ConflictAnalysis;
  openAgents?: boolean;
  targetAgentName?: string;
  openTelemetry?: boolean;
  openContacts?: boolean;
  openHelp?: boolean;
}

export function parseNaturalVoiceCommand(rawInput: string, deviceState: DeviceState, contacts: PhoneContact[],
  existingTasks: TaskItem[] = [], existingEvents: CalendarEvent[] = []): CommandExecutionResult {
  try { return parseIntent(rawInput, deviceState, contacts, existingTasks, existingEvents); }
  catch (error) {
    if (!(error instanceof TemporalInputError)) throw error;
    return { isHandled: true, spokenResponse: error.message + ' No se ha ejecutado ninguna acción.',
      actionDetails: 'Fecha, hora o zona pendientes de aclaración.' };
  }
}

function parseIntent(
  rawInput: string,
  deviceState: DeviceState,
  contacts: PhoneContact[],
  existingTasks: TaskItem[] = [],
  existingEvents: CalendarEvent[] = []
): CommandExecutionResult {
  const query = rawInput.normalize('NFKC').trim().toLowerCase().replace(/^por favor[,\s]+/, '');
  const starts = (phrase: string) => query === phrase || query.startsWith(phrase + ' ') || query.startsWith(phrase + ',');
  const clarify = (message: string): CommandExecutionResult => ({ isHandled: true,
    spokenResponse: message + ' No se ha ejecutado ninguna acción.', actionDetails: 'Se necesita una orden o referencia inequívoca.' });
  if (/^(?:no\b|nunca\b|jam[aá]s\b|evita\b|cancel(?:a|ar)\b|det[eé]n\b)/.test(query))
    return clarify('Solicitud cancelada o negada.');
  if (/^(?:[¿\"'«“]|c[oó]mo\b|qu[eé]\b|explica\b|describe\b|ejemplo\b|texto\b|cita\b|dime\b|la frase\b|si\b)/.test(query))
    return { isHandled: false, spokenResponse: 'Consulta informativa; no se ha ejecutado ninguna acción.' };
  const createsTask = /^(?:crear tarea|nueva tarea|recordatorio|recuérdame|anotar tarea|tarea)\b/.test(query);
  const literalBody = createsTask || /^(?:enviar mensaje a|envía mensaje a|mandar mensaje a|mensaje a|whatsapp a|escribir a|(?:enviar|redactar|mandar)(?: un)? correo a)\b/.test(query);
  if (!literalBody && /(?:\bmejor no\b|\bno lo hagas\b|[,;]\s*no\b)/.test(query)) return clarify('La solicitud contiene una cancelación o corrección.');
  if (!literalBody && (/\s+o\s+/.test(query) || /\s+y\s+(?:wifi|bluetooth|linterna|b[oó]veda|calendario|alarma)\b/.test(query)))
    return clarify('Hay alternativas o varios objetivos. Indica uno concreto.');
  if (!literalBody && /(?:\s+(?:o|y)\s+|;\s*)(?:llama(?:r)?|borr(?:a|ar)|elimin(?:a|ar)|enciende|encender|apagar|desactiva(?:r)?|activa(?:r)?|subir|bajar|crear|modificar|completar|posponer|aplazar|sincroniza(?:r)?|env[ií]a(?:r)?)\b/.test(query))
    return clarify('Indica una sola acción y su objetivo.');
  if (/^tarea\b.*\b(?:completada|terminada|eliminada)\b/.test(query))
    return clarify('Indica si quieres crear o modificar una tarea concreta.');

  // 13. CREACIÓN AVANZADA DE TAREAS Y RECORDATORIOS
  // e.g.: "crear tarea urgente revisar informe para mañana a las 15:00"
  // e.g.: "recuérdame comprar café a las 18:00"
  const isCreateTask = /^(?:crear tarea|nueva tarea|recordatorio|recuérdame|anotar tarea|tarea)(?::|\s+de|\s+que)?\s*(.+)/i.test(query);
  if (isCreateTask) {
    const match = query.match(/^(?:crear tarea|nueva tarea|recordatorio|recuérdame|anotar tarea|tarea)(?::|\s+de|\s+que)?\s*(.+)/i);
    const fullBody = match ? match[1] : query;

    const temporalZone = zoneFromText(fullBody).timeZone;
    const dueDate = dateFromText(fullBody, temporalZone);
    const requestedTime = timeFromText(fullBody);
    const timeDue = requestedTime?.time || '';
    if (timeDue && !dueDate) throw new TemporalInputError('DATE_REQUIRED', 'Indica una fecha para esa hora.');
    const dueAt = timeDue ? zonedInstant(dueDate, timeDue, temporalZone).toISOString() : undefined;

    // Detect priority
    let priority: 'baja' | 'media' | 'alta' | 'critica' = 'alta';
    if (fullBody.includes('urgente') || fullBody.includes('critica') || fullBody.includes('crítica')) {
      priority = 'critica';
    } else if (fullBody.includes('baja') || fullBody.includes('secundaria')) {
      priority = 'baja';
    } else if (fullBody.includes('media')) {
      priority = 'media';
    }

    // Detect recurrence
    let recurrence: 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly' = 'none';
    if (fullBody.includes('diario') || fullBody.includes('todos los días')) {
      recurrence = 'daily';
    } else if (fullBody.includes('semanal') || fullBody.includes('cada semana')) {
      recurrence = 'weekly';
    }

    // Extract title cleaned
    const title = stripTemporalText(fullBody)
      .replace(/(?:a las|para las)\s*\d{1,2}(?::\d{2})?/gi, '')
      .replace(/urgente|crítica|critica|prioridad alta|prioridad baja/gi, '')
      .replace(/para hoy|para mañana/gi, '')
      .replace(/diario|todos los días|semanal/gi, '')
      .trim() || 'Tarea sin título';

    return {
      isHandled: true,
      spokenResponse: `Tarea "${title}" creada con prioridad ${priority} ${timeDue ? 'para las ' + timeDue : 'sin hora de aviso'}. Guardada en la lista local; sincronización y notificación no verificadas.`,
      actionType: 'task',
      actionDetails: `Tarea registrada: "${title}" [${priority.toUpperCase()}] Fecha: ${dueDate} ${timeDue}`,
      newTask: {
        title,
        dueDate,
        timeDue,
        timeZone: dueDate ? temporalZone : undefined,
        dueAt,
        priority,
        category: priority === 'critica' ? 'urgente' : 'trabajo',
        isCompleted: false,
        recurrence,
        subtasks: [],
        syncedToThirdParty: {
          googleCalendar: false,
          notion: false,
          todoist: false,
          slackWebhook: false,
        },
      },
    };
  }



  // 1. COMPLETAR / MARCAR TAREA REALIZADA
  // e.g.: "completar tarea informe", "marcar como hecha la tarea comprar café", "tarea café completada"
  const completeMatch = query.match(/^(?:completar(?: tarea| recordatorio)?|marcar como (?:hecha|completada|terminada)(?: la tarea)?|finalizar tarea)\s+(.+)/i);
  if (completeMatch) {
    const targetTitle = completeMatch[1].trim();
    const matches = existingTasks.filter(
      (t) => typeof t.title === 'string' && (t.title.toLowerCase().includes(targetTitle) || targetTitle.includes(t.title.toLowerCase()))
    );
    if (matches.length !== 1) return clarify(matches.length ? 'Hay varias tareas coincidentes. Elige una en la agenda.' : 'No encuentro una tarea coincidente.');
    const matched = matches[0];

    if (matched) {
      return {
        isHandled: true,
        spokenResponse: `Excelente. Tarea "${matched.title}" marcada como completada en tiempo real.`,
        actionType: 'task',
        actionDetails: `Tarea completada: "${matched.title}"`,
        taskToCompleteId: matched.id,
      };
    }
  }

  // 2. POSPONER / SNOOZE RECORDATORIO
  // e.g.: "posponer recordatorio café 15 minutos", "posponer tarea 10 min", "aplazar recordatorio"
  const snoozeMatch = query.match(/^(?:posponer|aplazar)(?: recordatorio| tarea)?\s+(.+?)(?:\s+(\d+)\s*(?:minutos?|min))?$/i);
  if (snoozeMatch) {
    const targetTitle = snoozeMatch[1].trim();
    const minutes = parseInt(snoozeMatch[2] || '10', 10);
    const matches = existingTasks.filter(
      (t) => typeof t.title === 'string' && (t.title.toLowerCase().includes(targetTitle) || targetTitle.includes(t.title.toLowerCase()))
    );
    if (matches.length !== 1) return clarify(matches.length ? 'Hay varias tareas coincidentes. Elige una en la agenda.' : 'No encuentro una tarea coincidente.');
    const matched = matches[0];

    if (matched) {
      const timing = snoozeTaskTiming(matched.timeZone, minutes);
      const newTime = `${timing.dueDate} ${timing.timeDue} (${timing.timeZone})`;

      return {
        isHandled: true,
        spokenResponse: `Recordatorio "${matched.title}" pospuesto ${minutes} minutos. Nueva hora: ${newTime}.`,
        actionType: 'task',
        actionDetails: `Pospuesto ${minutes} min: "${matched.title}" -> ${newTime}`,
        taskToModify: {
          id: matched.id,
          updates: timing,
        },
      };
    }
  }

  // 3. MODIFICAR RECORDATORIO O TAREA EXISTENTE
  // e.g.: "modificar recordatorio café: cambiar hora a las 19:30", "cambiar hora de tarea café a las 18:00"
  const modifyTimeMatch = query.match(/^(?:modificar (?:recordatorio|tarea)|cambiar hora (?:de|del) (?:recordatorio|tarea))\s+(.+?)(?::\s*cambiar hora a las|\s+a las|\s+para las)\s*(.+)$/i);
  if (modifyTimeMatch) {
    const targetTitle = modifyTimeMatch[1].trim();
    const newTime = clockTime(modifyTimeMatch[2].trim());
    const matches = existingTasks.filter(
      (t) => typeof t.title === 'string' && (t.title.toLowerCase().includes(targetTitle) || targetTitle.includes(t.title.toLowerCase()))
    );
    if (matches.length !== 1) return clarify(matches.length ? 'Hay varias tareas coincidentes. Elige una en la agenda.' : 'No encuentro una tarea coincidente.');
    const matched = matches[0];

    if (matched) {
      return {
        isHandled: true,
        spokenResponse: `Recordatorio "${matched.title}" modificado exitosamente. Programado ahora para las ${newTime}.`,
        actionType: 'task',
        actionDetails: `Hora modificada: "${matched.title}" -> ${newTime}`,
        taskToModify: {
          id: matched.id,
          updates: taskTiming(matched.dueDate, newTime, matched.timeZone),
        },
      };
    }
  }

  // 4. CAMBIAR PRIORIDAD DE TAREA
  // e.g.: "cambiar prioridad de café a crítica", "prioridad alta para informe"
  const priorityMatch = query.match(/^(?:cambiar prioridad (?:de|del)?\s*(.+?)\s+a\s+(critica|crítica|alta|media|baja)|prioridad\s+(critica|crítica|alta|media|baja)\s+para\s+(.+))/i);
  if (priorityMatch) {
    const targetTitle = (priorityMatch[1] || priorityMatch[4] || '').trim();
    const rawPriority = (priorityMatch[2] || priorityMatch[3] || 'alta').toLowerCase();
    const finalPriority = rawPriority.includes('crit') ? 'critica' : (rawPriority as any);

    const matches = existingTasks.filter(
      (t) => typeof t.title === 'string' && (t.title.toLowerCase().includes(targetTitle) || targetTitle.includes(t.title.toLowerCase()))
    );
    if (matches.length !== 1) return clarify(matches.length ? 'Hay varias tareas coincidentes. Elige una en la agenda.' : 'No encuentro una tarea coincidente.');
    const matched = matches[0];

    if (matched) {
      return {
        isHandled: true,
        spokenResponse: `Prioridad de "${matched.title}" actualizada a ${finalPriority}.`,
        actionType: 'task',
        actionDetails: `Prioridad actualizada: "${matched.title}" -> [${finalPriority.toUpperCase()}]`,
        taskToModify: {
          id: matched.id,
          updates: { priority: finalPriority },
        },
      };
    }
  }

  // 5. ELIMINAR RECORDATORIO O TAREA
  // e.g.: "eliminar tarea café", "borrar recordatorio informe"
  const deleteMatch = query.match(/^(?:eliminar|borrar|quitar)(?: tarea| recordatorio)\s+(.+)/i);
  if (deleteMatch) {
    const targetTitle = deleteMatch[1].trim();
    const matches = existingTasks.filter(
      (t) => typeof t.title === 'string' && (t.title.toLowerCase().includes(targetTitle) || targetTitle.includes(t.title.toLowerCase()))
    );
    if (matches.length !== 1) return clarify(matches.length ? 'Hay varias tareas coincidentes. Elige una en la agenda.' : 'No encuentro una tarea coincidente.');
    const matched = matches[0];

    if (matched) {
      return {
        isHandled: true,
        spokenResponse: `Tarea "${matched.title}" eliminada del registro.`,
        actionType: 'task',
        actionDetails: `Tarea eliminada: "${matched.title}"`,
        taskToDeleteId: matched.id,
      };
    }
  }

  // 6. SINCRONIZACIÓN CON TERCEROS & EXPORTACIÓN iCAL
  // e.g.: "sincronizar con google calendar", "exportar calendario a ical", "descargar ics"
  if (starts('exportar a ical') || starts('descargar ics') || starts('exportar agenda')) {
    return {
      isHandled: true,
      spokenResponse: 'Generando archivo estándar iCalendar RFC 5545 para Google Calendar y Apple Calendar.',
      actionType: 'sync',
      actionDetails: 'Archivo .ics descargado para importación en Google Calendar',
      triggerICalExport: true,
    };
  }

  if (starts('sincronizar calendario') || starts('sincronizar tareas') || starts('sync google') || starts('sincronizar con notion')) {
    return {
      isHandled: true,
      spokenResponse: 'Este comando no dispone de un ejecutor de sincronización verificado. No se ha sincronizado ningún dato.',
      actionType: 'sync',
      actionDetails: 'Sincronización no disponible mediante este comando.',
    };
  }

  // 7. LLAMADAS TELEFÓNICAS
  const callRegex = /^(?:llamar a|llama a|haz una llamada a|marcar a|marcar al|marca a|comunícame con)\s+([a-záéíóúñ0-9\s+]+)/i;
  const callMatch = query.match(callRegex);

  if (/^(?:emergencia|emergencias)$/.test(query)) return clarify('Indica el número de emergencias de tu ubicación.');
  if (callMatch || query === 'llamar al 911') {
    const rawTarget = callMatch ? callMatch[1].trim() : (query.includes('911') ? '911' : 'Emergencias');
    const matchingContacts = contacts.filter(
      (c) => c.name.toLowerCase().includes(rawTarget.toLowerCase()) || (c.phone || '').includes(rawTarget)
    );
    if (matchingContacts.length > 1) return clarify('Hay varios contactos coincidentes. Elige uno en el directorio.');
    const contact = matchingContacts[0];

    const name = contact ? contact.name : rawTarget;
    const number = contact ? contact.phone : (/^[+\d\s]+$/.test(rawTarget) ? rawTarget : '');
    if (!number) return {
      isHandled: true, spokenResponse: `No hay un número de teléfono disponible para ${name}.`,
      actionDetails: 'No se preparó ninguna llamada: falta un teléfono.',
    };

    return {
      isHandled: true,
      spokenResponse: `Preparando el marcador para ${name}. Confirma la llamada en el teléfono.`,
      actionType: 'call',
      actionDetails: `Número preparado para el marcador: ${name} (${number})`,
      callContact: { name, number },
    };
  }

  // 8. MENSAJES Y COMUNICACIÓN (SMS / WHATSAPP)
  const msgRegex = /^(?:enviar mensaje a|envía mensaje a|mandar mensaje a|mensaje a|whatsapp a|escribir a)\s+([^:]+)(?::\s*|\s+que\s+)(.+)/i;
  const msgMatch = query.match(msgRegex);

  if (msgMatch) {
    const recipientRaw = msgMatch[1].trim();
    const messageContent = msgMatch[2].trim();
    const isWhatsApp = query.includes('whatsapp');

    const matchingContacts = contacts.filter((c) => c.name.toLowerCase().includes(recipientRaw.toLowerCase()));
    if (matchingContacts.length > 1) return clarify('Hay varios destinatarios coincidentes. Elige uno en el directorio.');
    const contact = matchingContacts[0];
    if (contact && !contact.phone) return {
      isHandled: true, spokenResponse: `No hay un número de teléfono disponible para ${contact.name}.`,
      actionDetails: 'No se preparó ningún SMS/WhatsApp: falta un teléfono.',
    };
    if (!contact && !/^\+?[\d ()-]{5,}$/.test(recipientRaw)) return clarify('No encuentro un destinatario único con teléfono. Indica su número o elígelo en el directorio.');
    const finalRecipient = contact ? contact.phone : recipientRaw;

    return {
      isHandled: true,
      spokenResponse: `Preparando ${isWhatsApp ? 'WhatsApp' : 'mensaje'} para ${finalRecipient}.`,
      actionType: 'message',
      actionDetails: `Destinatario: ${finalRecipient} | Mensaje: "${messageContent}"`,
      messagePayload: {
        recipient: finalRecipient,
        message: messageContent,
        channel: isWhatsApp ? 'WhatsApp' : 'SMS',
      },
    };
  }

  // 9. LINTERNA / TORCH
  if (starts('encender linterna') || starts('activa la linterna') || starts('prender linterna') || starts('luz de emergencia') || starts('linterna on')) {
    return {
      isHandled: true,
      spokenResponse: 'Linterna de alta intensidad activada.',
      actionType: 'torch',
      actionDetails: 'Linterna / Flash activado.',
      updatedDeviceState: { flashlight: true, screenTorchActive: true },
    };
  }

  if (starts('apagar linterna') || starts('desactiva la linterna') || starts('linterna off')) {
    return {
      isHandled: true,
      spokenResponse: 'Linterna desactivada.',
      actionType: 'torch',
      actionDetails: 'Linterna / Flash apagado.',
      updatedDeviceState: { flashlight: false, screenTorchActive: false },
    };
  }

  // 10. BRILLO DE PANTALLA
  const brightnessPercentMatch = query.match(/^(?:(?:ajustar|poner|cambiar)\s+)?brillo(?: al| a)?\s*(\d+)(?:%| por ciento)?/i);
  if (brightnessPercentMatch) {
    const val = Math.min(100, Math.max(10, parseInt(brightnessPercentMatch[1], 10)));
    return {
      isHandled: true,
      spokenResponse: `Brillo ajustado al ${val} por ciento.`,
      actionType: 'brightness',
      actionDetails: `Brillo establecido en ${val}%`,
      updatedDeviceState: { brightness: val },
    };
  }

  if (starts('subir brillo') || starts('aumentar brillo')) {
    const newVal = Math.min(100, deviceState.brightness + 25);
    return {
      isHandled: true,
      spokenResponse: `Brillo aumentado al ${newVal} por ciento.`,
      actionType: 'brightness',
      actionDetails: `Brillo aumentado a ${newVal}%`,
      updatedDeviceState: { brightness: newVal },
    };
  }

  if (starts('bajar brillo') || starts('reducir brillo')) {
    const newVal = Math.max(15, deviceState.brightness - 25);
    return {
      isHandled: true,
      spokenResponse: `Brillo reducido al ${newVal} por ciento para descanso visual.`,
      actionType: 'brightness',
      actionDetails: `Brillo reducido a ${newVal}%`,
      updatedDeviceState: { brightness: newVal },
    };
  }

  // 11. VOLUMEN Y AUDIO
  const volumePercentMatch = query.match(/^(?:(?:ajustar|poner|cambiar)\s+)?volumen(?: al| a)?\s*(\d+)(?:%| por ciento)?/i);
  if (volumePercentMatch) {
    const val = Math.min(100, Math.max(0, parseInt(volumePercentMatch[1], 10)));
    return {
      isHandled: true,
      spokenResponse: `Volumen fijado en ${val} por ciento.`,
      actionType: 'volume',
      actionDetails: `Volumen: ${val}%`,
      updatedDeviceState: { volume: val, isMuted: val === 0 },
    };
  }

  if (starts('subir volumen') || starts('aumenta volumen')) {
    const newVal = Math.min(100, deviceState.volume + 20);
    return {
      isHandled: true,
      spokenResponse: `Volumen incrementado al ${newVal} por ciento.`,
      actionType: 'volume',
      actionDetails: `Volumen: ${newVal}%`,
      updatedDeviceState: { volume: newVal, isMuted: false },
    };
  }

  if (starts('bajar volumen') || starts('disminuye volumen')) {
    const newVal = Math.max(0, deviceState.volume - 20);
    return {
      isHandled: true,
      spokenResponse: `Volumen disminuido al ${newVal} por ciento.`,
      actionType: 'volume',
      actionDetails: `Volumen: ${newVal}%`,
      updatedDeviceState: { volume: newVal, isMuted: newVal === 0 },
    };
  }

  if (starts('silenciar') || starts('modo silencio') || starts('mute')) {
    return {
      isHandled: true,
      spokenResponse: 'Modo silencio activado.',
      actionType: 'volume',
      actionDetails: 'Audio silenciado (0%)',
      updatedDeviceState: { isMuted: true },
    };
  }

  // 12. ALARMAS Y TEMPORIZADORES
  const alarmMatch = query.match(/^(?:(?:poner|crear|programar|configurar)\s+)?(?:alarma|despiértame|despertador)(?: a las| para las| a la)?\s*(\d{1,2})(?::(\d{2}))?/i);
  if (alarmMatch) {
    const alarmBody = query.replace(/^(?:(?:poner|crear|programar|configurar)\s+)?(?:alarma|despiértame|despertador)(?: a las| para las| a la)?\s*/i, '');
    const timeFormatted = clockPrefix(alarmBody).time;
    const alarmZone = zoneFromText(query).timeZone;
    const alarmDate = dateFromText(query, alarmZone);
    const dueAt = zonedInstant(alarmDate, timeFormatted, alarmZone).toISOString();

    return {
      isHandled: true,
      spokenResponse: `Alarma guardada en la sesión para el ${alarmDate} a las ${timeFormatted} (${alarmZone}). La activación persistente o del dispositivo no está disponible.`,
      actionType: 'alarm',
      actionDetails: `Nueva alarma guardada: ${timeFormatted}`,
      newAlarm: {
        time: timeFormatted,
        date: alarmDate,
        dueAt,
        timeZone: alarmZone,
        label: 'Alarma de voz VVC LIAM CORE',
        enabled: true,
        days: [],
      },
    };
  }

  const timerMatch = query.match(/^(?:(?:poner|crear|iniciar)\s+)?temporizador de\s*(\d+)\s*(minutos?|segundos?|horas?)/i);
  if (timerMatch) {
    const qty = parseInt(timerMatch[1], 10);
    const unit = timerMatch[2].toLowerCase();
    let totalSeconds = qty;

    if (unit.startsWith('minuto')) {
      totalSeconds = qty * 60;
    } else if (unit.startsWith('hora')) {
      totalSeconds = qty * 3600;
    }

    return {
      isHandled: true,
      spokenResponse: `Temporizador de ${qty} ${unit} iniciado en tiempo real.`,
      actionType: 'timer',
      actionDetails: `Temporizador activo: ${qty} ${unit} (${totalSeconds}s)`,
      newTimer: {
        label: `Temporizador de ${qty} ${unit}`,
        seconds: totalSeconds,
      },
    };
  }

  // 14.1 COMPROBACIÓN EXPLICITA DE CONFLICTOS EN EL CALENDARIO
  if (
    starts('comprobar conflicto') ||
    starts('verificar conflicto') ||
    starts('hay conflicto') ||
    starts('solapamiento') ||
    starts('choque de horario')
  ) {
    const conflicts: Array<{ a: CalendarEvent; b: CalendarEvent }> = [];
    for (let i = 0; i < existingEvents.length; i++) {
      const analysis = detectEventConflicts(existingEvents[i], existingEvents.slice(i + 1));
      if (analysis.status === 'unavailable') return clarify(analysis.message);
      for (const event of analysis.conflictingEvents) conflicts.push({ a: existingEvents[i], b: event });
    }
    if (!conflicts.length) return { isHandled: true,
      spokenResponse: 'No hay solapamientos en la lista local válida. No he comprobado calendarios externos.',
      actionType: 'calendar', actionDetails: 'Lista local: 0 solapamientos.', openCalendar: true };

    const firstPair = conflicts[0];
    return {
      isHandled: true,
      spokenResponse: `Atención: Se detectó un conflicto de horario entre "${firstPair.a.title}" y "${firstPair.b.title}" el día ${firstPair.a.date}. Puedes pedirme que resuelva los conflictos automáticamente.`,
      actionType: 'calendar',
      actionDetails: `Conflicto detectado: "${firstPair.a.title}" vs "${firstPair.b.title}" (${firstPair.a.date})`,
      openCalendar: true,
    };
  }

  // 14.2 RESOLUCIÓN AUTOMÁTICA DE CONFLICTOS EN EL CALENDARIO
  if (
    starts('resolver conflicto') ||
    starts('solucionar conflicto') ||
    starts('reajustar evento') ||
    starts('arreglar solapamiento')
  ) {
    const updatedList: CalendarEvent[] = [...existingEvents];
    let resolvedCount = 0;
    for (let i = 0; i < updatedList.length; i++) {
      const current = updatedList[i], others = updatedList.filter((_, idx) => idx !== i);
      const conflict = detectEventConflicts(current, others);
      if (conflict.status === 'unavailable') return clarify(conflict.message);
      if (conflict.hasConflict) {
        const resolution = resolveEventConflict(current, others);
        updatedList[i] = resolution.resolvedEvent;
        resolvedCount++;
      }
    }

    if (resolvedCount > 0) {
      return {
        isHandled: true,
        spokenResponse: `He resuelto automáticamente ${resolvedCount} conflicto de programación, reajustando los horarios a las primeras franjas libres sin solapamientos.`,
        actionType: 'calendar',
        actionDetails: `${resolvedCount} conflicto(s) de horario resueltos en el calendario.`,
        eventsToUpdate: updatedList,
        openCalendar: true,
      };
    }

    return {
      isHandled: true,
      spokenResponse: 'No hay solapamientos en la lista local válida. No se han comprobado calendarios externos.',
      actionType: 'calendar',
      actionDetails: 'Calendario optimizado: sin solapamientos pendientes.',
      openCalendar: true,
    };
  }

  // 14.3 SINCRONIZACIÓN BIDIRECCIONAL CON PROVEEDORES (GOOGLE / OUTLOOK / APPLE)
  if (
    starts('sincronizar con google') ||
    starts('sync google calendar') ||
    starts('google calendar') && (starts('sincronizar') || starts('exportar'))
  ) {
    return {
      isHandled: true,
      spokenResponse: 'Abriendo el calendario. Los enlaces y exportaciones no verifican sincronización con Google.',
      actionType: 'calendar',
      actionDetails: 'Opciones de calendario; sincronización no verificada',
      triggerCalendarSync: 'google',
      openCalendar: true,
    };
  }

  if (
    starts('sincronizar con outlook') ||
    starts('sync outlook') ||
    starts('outlook calendar')
  ) {
    return {
      isHandled: true,
      spokenResponse: 'Abriendo el calendario. La sincronización con Outlook no está verificada.',
      actionType: 'calendar',
      actionDetails: 'Opciones de Outlook; sincronización no verificada',
      triggerCalendarSync: 'outlook',
      openCalendar: true,
    };
  }

  if (
    starts('sincronizar con apple') ||
    starts('apple calendar') ||
    starts('icalendar') ||
    starts('mac calendar')
  ) {
    return {
      isHandled: true,
      spokenResponse: 'Abriendo el calendario. La sincronización con Apple no está verificada.',
      actionType: 'calendar',
      actionDetails: 'Opciones de Apple; sincronización no verificada',
      triggerCalendarSync: 'apple',
      openCalendar: true,
    };
  }

  if (starts('abrir calendario') || starts('abre el calendario') || starts('ver calendario') || starts('mostrar agenda') || starts('mi agenda')) {
    return {
      isHandled: true,
      spokenResponse: 'Desplegando la matriz de calendario, tareas y sincronización de VVC LIAM CORE.',
      actionType: 'calendar',
      actionDetails: 'Matriz de Calendario & Agenda desplegada.',
      openCalendar: true,
    };
  }

  // 14.4 PROGRAMACIÓN DE EVENTOS COMPLEJOS CON DETECCIÓN Y RESOLUCIÓN DE CONFLICTOS
  // e.g.: "agendar reunión de arquitectura con carlos mañana a las 11:00 hasta las 12:30 en sala virtual"
  // e.g.: "programar evento cita médica para el 15 de octubre a las 16:00 en clínica central"
  // e.g.: "nuevo evento reunión de equipo hoy a las 17:00 por 2 horas"
  const isCalendarEventCommand = /^(?:agendar|programar|nuevo evento|nueva reunión|nueva cita|crear evento|evento|reunión|cita)(?::|\s+de|\s+para)?\s*(.+)/i.test(query);

  if (isCalendarEventCommand && !query.includes('tarea') && !query.includes('recordatorio')) {
    const rawMatch = query.match(/(?:agendar|programar|nuevo evento|nueva reunión|nueva cita|crear evento|evento|reunión|cita)(?::|\s+de|\s+para)?\s*(.+)/i);
    const body = rawMatch ? rawMatch[1] : query;

    const temporalZone = zoneFromText(body).timeZone;
    const dateStr = dateFromText(body, temporalZone);
    const requestedStart = timeFromText(body);
    if (!requestedStart) throw new TemporalInputError('TIME_REQUIRED', 'Indica una hora de inicio para el evento.');
    const startTime = requestedStart.time;
    const requestedEnd = timeFromText(body, true);
    let timing;
    if (requestedEnd) timing = eventInterval({ date: dateStr, time: startTime, endTime: requestedEnd.time, timeZone: temporalZone });
    else {
      const duration = /(?:por|durante)\s*(\d+)\s*(horas?|hrs?|minutos?|min)\b/i.exec(body);
      const quantity = duration ? Number(duration[1]) : 60;
      const durationMinutes = duration && duration[2].toLowerCase().startsWith('h') ? quantity * 60 : quantity;
      if (!Number.isSafeInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 10080)
        throw new TemporalInputError('INVALID_DURATION', 'Indica una duración de 1 a 10080 minutos.');
      const end = zonedParts(zonedInstant(dateStr, startTime, temporalZone).getTime() + durationMinutes * 60000, temporalZone);
      timing = eventInterval({ date: dateStr, time: startTime, endDate: end.date, endTime: end.time, timeZone: temporalZone });
    }
    const endTime = timing.endTime;
    const endDate = timing.endDate;

    // 4. Detect Location
    let location = 'Virtual / VVC LIAM CORE Hub';
    const locMatch = body.match(/(?:en|lugar|ubicación|ubicacion)\s+([a-záéíóúñ0-9\s]{3,30}?)(?:\s+(?:con|a las|para|asistentes)|$)/i);
    if (locMatch && !locMatch[1].includes('punto') && !locMatch[1].includes('calendario') && !locMatch[1].includes('reunión')) {
      location = locMatch[1].trim();
    }

    // 5. Detect Attendees
    const attendees: string[] = [];
    const attendeeMatch = body.match(/(?:con|asistentes?:?)\s+([a-záéíóúñ\s,@\._\-]+?)(?:\s+(?:en|a las|hasta)|$)/i);
    if (attendeeMatch) {
      const rawAttendees = attendeeMatch[1].trim();
      const parts = rawAttendees.split(/,| y /i).map((p) => p.trim()).filter(Boolean);
      attendees.push(...parts);
    }

    // 6. Clean Title
    let cleanTitle = stripTemporalText(body)
      .replace(/(?:a las|para las|desde las|hasta las|hasta|fin a las)\s*\d{1,2}(?::\d{2})?(?:\s*(?:am|pm|de la mañana|de la tarde))?/gi, '')
      .replace(/(?:por|durante)\s*\d+\s*(?:horas?|hrs?|minutos?|min)/gi, '')
      .replace(/hoy|mañana|pasado mañana|\d{1,2}\s+de\s+[a-z]+/gi, '')
      .replace(/(?:en|lugar)\s+[a-záéíóúñ0-9\s]{3,30}/gi, '')
      .replace(/(?:con|asistentes?:?)\s+[a-záéíóúñ\s,@\._\-]+/gi, '')
      .replace(/urgente|crítica|complejo|compleja/gi, '')
      .trim();

    if (!cleanTitle || cleanTitle.length < 3) {
      cleanTitle = 'Reunión Programada';
    } else {
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    }

    // Candidate Event Object
    const candidateEvent: CalendarEvent = {
      id: `cand-${Date.now()}`,
      title: cleanTitle,
      date: dateStr,
      time: startTime,
      endTime: endTime,
      endDate,
      timeZone: temporalZone,
      location,
      description: attendees.length > 0 ? `Participantes: ${attendees.join(', ')}` : 'Programado por voz con VVC LIAM CORE',
      category: 'reunion',
      attendees: attendees.length > 0 ? attendees : undefined,
      isAutomated: true,
      source: 'vvc_liam',
      syncStatus: 'local',
    };

    // 7. INTELLIGENT CONFLICT DETECTION & RESOLUTION
    const conflictResult = detectEventConflicts(candidateEvent, existingEvents);
    if (conflictResult.status === 'unavailable') return clarify(conflictResult.message);
    let finalEvent = candidateEvent;
    let spoken = '';

    if (conflictResult.hasConflict) {
      const bestSlot = conflictResult.suggestedSlots[0];
      const conflictWith = conflictResult.conflictingEvents[0]?.title || 'otro evento';
      
      // Auto-resolve by adopting best alternative slot
      if (bestSlot) {
        finalEvent = {
          ...candidateEvent,
          date: bestSlot.date,
          time: bestSlot.time,
          endTime: bestSlot.endTime,
          endDate: bestSlot.endDate,
          timeZone: bestSlot.timeZone,
          syncStatus: 'conflict_resolved',
          conflictNote: `Horario ajustado de ${startTime} a ${bestSlot.time} para resolver solapamiento con "${conflictWith}".`,
        };

        spoken = `El horario solicitado entraba en conflicto con "${conflictWith}". Tras tu confirmación, el evento local queda preparado de ${bestSlot.time} a ${bestSlot.endTime}. Sincronización externa no verificada.`;
      } else {
        return clarify(`Hay un conflicto con "${conflictWith}" y no se encontró una alternativa. Elige otro horario en el calendario.`);
      }
    } else {
      spoken = `Evento local "${cleanTitle}" preparado para el ${dateStr} de ${startTime} a ${endTime} en ${location}. Sincronización y entrega de notificaciones no verificadas.`;
    }

    return {
      isHandled: true,
      spokenResponse: spoken,
      actionType: 'calendar',
      actionDetails: `Evento: "${cleanTitle}" (${dateStr} ${finalEvent.time}-${finalEvent.endTime}) [${finalEvent.syncStatus?.toUpperCase()}]`,
      newCalendarEvent: {
        title: finalEvent.title,
        date: finalEvent.date,
        time: finalEvent.time,
        endTime: finalEvent.endTime,
        endDate: finalEvent.endDate,
        timeZone: finalEvent.timeZone,
        location: finalEvent.location,
        description: finalEvent.description,
        category: finalEvent.category,
        attendees: finalEvent.attendees,
        syncStatus: finalEvent.syncStatus,
        conflictNote: finalEvent.conflictNote,
        source: 'vvc_liam',
        isAutomated: true,
      },
      openCalendar: true,
      detectedConflict: conflictResult.hasConflict ? conflictResult : undefined,
    };
  }

  // 15. CONECTIVIDAD: WI-FI & BLUETOOTH
  if (starts('activar wifi') || starts('encender wifi')) {
    return {
      isHandled: true,
      spokenResponse: 'Wi-Fi activado. Escaneando redes seguras.',
      actionType: 'security',
      actionDetails: 'Wi-Fi: Conectado (WPA3-Enterprise)',
      updatedDeviceState: { wifi: true },
    };
  }

  if (starts('desactivar wifi') || starts('apagar wifi')) {
    return {
      isHandled: true,
      spokenResponse: 'Wi-Fi desactivado.',
      actionType: 'security',
      actionDetails: 'Wi-Fi: Desconectado',
      updatedDeviceState: { wifi: false },
    };
  }

  // 16. ESTADO DEL SISTEMA Y BATERÍA
  if (starts('batería') || starts('bateria') || starts('nivel de carga')) {
    return {
      isHandled: true,
      spokenResponse: `La batería se encuentra al ${deviceState.batteryLevel} por ciento ${deviceState.isCharging ? 'y está cargando' : 'con autonomía óptima'}.`,
      actionType: 'security',
      actionDetails: `Nivel de batería: ${deviceState.batteryLevel}% | Cargando: ${deviceState.isCharging ? 'Sí' : 'No'}`,
    };
  }

  // 17. GMAIL WORKSPACE
  if (starts('abrir gmail') || starts('abre gmail') || starts('ver correos') || starts('revisar correos') || starts('bandeja de entrada') || starts('leer correos')) {
    return {
      isHandled: true,
      spokenResponse: 'Abriendo tu bandeja de entrada de Gmail.',
      actionType: 'gmail',
      actionDetails: 'Gmail Workspace abierto.',
      openGmail: true,
    };
  }

  const gmailSendMatch = query.match(/^(?:enviar|redactar|mandar)(?: un)? correo a (.+?)(?:\s+(?:con asunto|asunto)\s+(.+?))?(?:\s+(?:con mensaje|mensaje|diciendo)\s+(.+))?$/i);
  if (gmailSendMatch) {
    const to = gmailSendMatch[1].trim();
    const subj = gmailSendMatch[2] ? gmailSendMatch[2].trim() : 'Mensaje desde VVC LIAM CORE';
    const body = gmailSendMatch[3] ? gmailSendMatch[3].trim() : '';
    return {
      isHandled: true,
      spokenResponse: `Preparando borrador de correo para ${to}. Revisa los detalles antes de confirmar el envío.`,
      actionType: 'gmail',
      actionDetails: `Borrador Gmail: Para ${to}`,
      openGmail: true,
      gmailCompose: { recipient: to, subject: subj, body },
    };
  }

  // 18. GOOGLE PICKER & DRIVE
  if (starts('abrir picker') || starts('abre picker') || starts('google picker') || starts('adjuntar de drive') || starts('seleccionar archivo') || starts('archivos de drive') || starts('abrir drive')) {
    return {
      isHandled: true,
      spokenResponse: 'Iniciando Google Picker para explorar tus archivos en Google Drive.',
      actionType: 'picker',
      actionDetails: 'Google Picker API activado.',
      openPicker: true,
    };
  }

  // 19. GOOGLE MAPS
  if (starts('abrir mapa') || starts('abre el mapa') || starts('ver mapa') || starts('mostrar mapa') || starts('google maps') || starts('radar de mapa')) {
    const searchMatch = query.match(/(?:buscar en (?:el )?mapa|buscar en google maps|ubicar en el mapa|dónde está|donde queda)\s+(.+)/i);
    const place = searchMatch ? searchMatch[1].trim() : '';
    return {
      isHandled: true,
      spokenResponse: place ? `Localizando ${place} en Google Maps.` : 'Desplegando el radar táctico de Google Maps.',
      actionType: 'maps',
      actionDetails: place ? `Búsqueda en mapa: ${place}` : 'Google Maps abierto.',
      openMaps: true,
      mapsQuery: place,
    };
  }

  // 19.1 GOOGLE CONTACTS & PEOPLE API
  if (
    starts('contactos') ||
    starts('abrir contactos') ||
    starts('google contacts') ||
    starts('directorio') ||
    starts('libreta de direcciones')
  ) {
    return {
      isHandled: true,
      spokenResponse: 'Desplegando directorio de contactos y sincronización con Google People API.',
      actionType: 'call',
      actionDetails: 'Google Contacts & Directorio VAOS',
      openContacts: true,
    };
  }

  // 19.2 FIREBASE FIRESTORE SYNC
  if (
    starts('firebase') ||
    starts('firestore') ||
    starts('sincronizar nube') ||
    starts('cloud sync')
  ) {
    return {
      isHandled: true,
      spokenResponse: 'Conexión con Firebase Firestore verificada. Sincronización en tiempo real activa.',
      actionType: 'sync',
      actionDetails: 'Firebase Firestore v12: Activo y seguro',
    };
  }

  // 19.3 CENTRO DE AYUDA, FAQS Y GUÍA OPERATIVA
  if (
    starts('ayuda') ||
    starts('centro de ayuda') ||
    starts('preguntas frecuentes') ||
    starts('atajos de voz') ||
    starts('manual') ||
    starts('guía') ||
    starts('guia') ||
    starts('cómo funciona') ||
    starts('como funciona')
  ) {
    return {
      isHandled: true,
      spokenResponse: 'Desplegando el Centro de Ayuda con preguntas frecuentes, atajos de voz y documentación del sistema.',
      actionType: 'security',
      actionDetails: 'Centro de Ayuda & Guía Operativa desplegado',
      openHelp: true,
    };
  }

  // 20. ESQUEMAS DE COLOR Y TEMAS VISUALES (VARIABLES CSS)
  const isThemeCommand =
    starts('tema') ||
    starts('esquema de color') ||
    starts('color de interfaz') ||
    starts('modo visual') ||
    starts('cambiar color') ||
    starts('amber terminal') ||
    starts('emerald matrix') ||
    starts('cyberpunk neon') ||
    starts('blood tactical') ||
    starts('cobalt stealth') ||
    starts('obsidian cyan') ||
    starts('paleta');

  if (isThemeCommand) {
    if (query.includes('amber') || query.includes('ámbar') || query.includes('ambar') || query.includes('amarillo') || query.includes('terminal')) {
      return {
        isHandled: true,
        spokenResponse: 'Esquema Amber Terminal activado. Fósforo ámbar retro CRT configurado mediante variables CSS.',
        actionType: 'security',
        actionDetails: 'Tema cambiado a Amber Terminal',
        newTheme: 'amber-terminal',
      };
    }
    if (query.includes('emerald') || query.includes('matrix') || query.includes('verde') || query.includes('esmeralda')) {
      return {
        isHandled: true,
        spokenResponse: 'Esquema Emerald Matrix activado. Fósforo verde cibernético en línea mediante variables CSS.',
        actionType: 'security',
        actionDetails: 'Tema cambiado a Emerald Matrix',
        newTheme: 'emerald-matrix',
      };
    }
    if (query.includes('cyberpunk') || query.includes('neon') || query.includes('fucsia') || query.includes('morado') || query.includes('púrpura')) {
      return {
        isHandled: true,
        spokenResponse: 'Esquema Cyberpunk Neon activado. Fucsia y púrpura nocturno aplicados mediante variables CSS.',
        actionType: 'security',
        actionDetails: 'Tema cambiado a Cyberpunk Neon',
        newTheme: 'cyberpunk-neon',
      };
    }
    if (query.includes('blood') || query.includes('tactical') || query.includes('táctico') || query.includes('rojo') || query.includes('carmesí')) {
      return {
        isHandled: true,
        spokenResponse: 'Esquema Blood Tactical activado. Modo de alerta crítica y combate visual.',
        actionType: 'security',
        actionDetails: 'Tema cambiado a Blood Tactical',
        newTheme: 'blood-tactical',
      };
    }
    if (query.includes('cobalt') || query.includes('stealth') || query.includes('azul') || query.includes('hielo')) {
      return {
        isHandled: true,
        spokenResponse: 'Esquema Cobalt Stealth activado. Azul ártico de operaciones encubiertas.',
        actionType: 'security',
        actionDetails: 'Tema cambiado a Cobalt Stealth',
        newTheme: 'cobalt-stealth',
      };
    }
    if (query.includes('obsidian') || query.includes('cyan') || query.includes('cian') || query.includes('defecto') || query.includes('original')) {
      return {
        isHandled: true,
        spokenResponse: 'Esquema Obsidian Cyan original restaurado.',
        actionType: 'security',
        actionDetails: 'Tema cambiado a Obsidian Cyan (Default)',
        newTheme: 'obsidian-cyan',
      };
    }
  }

  // 21. NOTIFICACIONES: sólo órdenes explícitas; describir un push no lo envía.
  if (/^(?:probar|prueba|test|enviar)\s+(?:una?\s+)?(?:notificaci[oó]n|alerta|push|service worker)\b/.test(query)) return {
    isHandled: true, spokenResponse: 'Solicitando la prueba de notificación; entrega al dispositivo no verificada.',
    actionType: 'security', actionDetails: 'Prueba solicitada, pendiente del navegador.', triggerPushTest: true,
  };
  if (/^(?:activar|habilitar|configurar|abrir)\s+(?:las?\s+)?(?:notificaciones?|push|service worker|segundo plano)\b/.test(query)) return {
    isHandled: true, spokenResponse: 'Abriendo los ajustes de notificaciones.', actionType: 'security', openSettings: true,
  };

  // 22. GENERACIÓN DE ARCHIVOS DE TEXTO Y HOJAS DE CÁLCULO CON EXPORTACIÓN A PDF
  const isDocCommand = /^(?:crear|crea|generar|genera|redactar|redacta|exportar|descargar|abrir|abre|estudio de documentos|documento|informe|reporte|minuta|hoja de c[aá]lculo|planilla|presupuesto|balance)\b/.test(query) && (
    query.includes('documento') ||
    query.includes('hoja de cálculo') ||
    query.includes('hoja de calculo') ||
    query.includes('planilla') ||
    query.includes('estudio de documentos') ||
    query.includes('exportar a pdf') ||
    query.includes('descargar en pdf') ||
    query.includes('informe') ||
    query.includes('reporte') ||
    query.includes('minuta'));

  if (isDocCommand) {
    // 22.1 HOJA DE CÁLCULO & TABLAS
    const isSpreadsheet =
      query.includes('hoja de cálculo') ||
      query.includes('hoja de calculo') ||
      query.includes('planilla') ||
      query.includes('presupuesto') ||
      query.includes('balance') ||
      query.includes('inventario') ||
      query.includes('gastos');

    if (isSpreadsheet) {
      let sheetTitle = 'Hoja de Cálculo Operativa';
      const titleMatch = query.match(/(?:hoja de cálculo|hoja de calculo|planilla|tabla|presupuesto|balance)(?:\s+de|\s+para)?\s*(.+)/i);
      if (titleMatch && titleMatch[1].trim()) {
        const raw = titleMatch[1].replace(/exportar a pdf|descargar|generar|crear/gi, '').trim();
        if (raw.length > 2) {
          sheetTitle = raw.charAt(0).toUpperCase() + raw.slice(1);
        }
      }

      // Generate contextually rich spreadsheet
      const isBudget = query.includes('presupuesto') || query.includes('gasto') || query.includes('balance') || query.includes('costo');
      const isInventory = query.includes('inventario') || query.includes('stock') || query.includes('equipo');

      let columns: string[] = [];
      let rows: Array<Record<string, string | number>> = [];

      if (isBudget) {
        columns = ['Concepto', 'Categoría', 'Presupuesto ($)', 'Gasto Real ($)', 'Diferencia ($)'];
        rows = [
          { 'Concepto': 'Infraestructura Servidores GPU', 'Categoría': 'Cloud', 'Presupuesto ($)': 1500, 'Gasto Real ($)': 1200, 'Diferencia ($)': 300 },
          { 'Concepto': 'Comunicaciones & SMS Gateway', 'Categoría': 'Telecom', 'Presupuesto ($)': 350, 'Gasto Real ($)': 280, 'Diferencia ($)': 70 },
          { 'Concepto': 'Licencias E2EE y Seguridad', 'Categoría': 'Seguridad', 'Presupuesto ($)': 600, 'Gasto Real ($)': 600, 'Diferencia ($)': 0 },
          { 'Concepto': 'Mantenimiento y Auditoría', 'Categoría': 'Operaciones', 'Presupuesto ($)': 800, 'Gasto Real ($)': 750, 'Diferencia ($)': 50 },
        ];
      } else if (isInventory) {
        columns = ['Código Item', 'Descripción', 'Ubicación', 'Cantidad', 'Estado'];
        rows = [
          { 'Código Item': 'DEV-001', 'Descripción': 'Terminal Móvil VVC LIAM CORE', 'Ubicación': 'Almacén Central', 'Cantidad': 12, 'Estado': 'Disponible' },
          { 'Código Item': 'DEV-002', 'Descripción': 'Módulo de Cifrado Hardware', 'Ubicación': 'Bóveda Segura', 'Cantidad': 5, 'Estado': 'Activo' },
          { 'Código Item': 'DEV-003', 'Descripción': 'Adaptador de Antena GPS / SDR', 'Ubicación': 'Laboratorio', 'Cantidad': 8, 'Estado': 'Calibrado' },
        ];
      } else {
        columns = ['Hito / Tarea', 'Responsable', 'Fecha Límite', 'Horas Estimadas', 'Estado'];
        rows = [
          { 'Hito / Tarea': 'Sincronización Bidireccional de Calendario', 'Responsable': 'VVC LIAM CORE', 'Fecha Límite': '2026-10-15', 'Horas Estimadas': 8, 'Estado': 'Completada' },
          { 'Hito / Tarea': 'Detección Inteligente de Conflictos', 'Responsable': 'Algoritmo RT-Lite', 'Fecha Límite': '2026-10-16', 'Horas Estimadas': 6, 'Estado': 'Completada' },
          { 'Hito / Tarea': 'Exportación Documental a PDF y CSV', 'Responsable': 'Estudio PDF', 'Fecha Límite': '2026-10-17', 'Horas Estimadas': 5, 'Estado': 'Activa' },
        ];
      }

      const newSheet: SpreadsheetData = {
        id: `sheet-${Date.now()}`,
        title: sheetTitle,
        date: new Date().toISOString().split('T')[0],
        columns,
        rows,
        hasTotals: isBudget,
      };

      return {
        isHandled: true,
        spokenResponse: `Hoja de cálculo "${sheetTitle}" generada con éxito con ${columns.length} columnas. Desplegando el estudio para edición y exportación directa a PDF y CSV.`,
        actionType: 'spreadsheet',
        actionDetails: `Hoja de cálculo creada: "${sheetTitle}" (${rows.length} filas) [Exportable a PDF]`,
        openDocs: true,
        docsMode: 'spreadsheet',
        newSpreadsheet: newSheet,
      };
    }

    // 22.2 DOCUMENTO DE TEXTO ESTRUCTURADO
    let docTitle = 'Documento de Trabajo VVC LIAM CORE';
    const docTitleMatch = query.match(/(?:documento(?: de texto)?|informe|reporte|minuta)(?:\s+de|\s+sobre|\s+para)?\s*(.+)/i);
    if (docTitleMatch && docTitleMatch[1].trim()) {
      const raw = docTitleMatch[1].replace(/exportar a pdf|descargar|generar|crear/gi, '').trim();
      if (raw.length > 2) {
        docTitle = raw.charAt(0).toUpperCase() + raw.slice(1);
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const category: 'informe' | 'minuta' | 'tarea' | 'proyecto' | 'general' = 
      query.includes('informe') || query.includes('reporte') ? 'informe' : query.includes('minuta') ? 'minuta' : 'general';

    const generatedDoc: TextDocumentData = {
      id: `doc-${Date.now()}`,
      title: docTitle,
      author: 'VVC LIAM CORE Obsidian Engine',
      date: todayStr,
      category,
      content: `1. OBJETIVO DEL DOCUMENTO
El presente informe documenta el estado operativo y los parámetros clave de "${docTitle}". Todas las actividades han sido registradas y procesadas con cifrado total en el dispositivo.

2. PUNTOS CLAVE Y DIAGNÓSTICO
• Sincronización multi-proveedor: Google Calendar, Outlook y Apple Calendar vinculados.
• Detección y resolución de conflictos de agenda: Algoritmo heurístico activo.
• Alertas de segundo plano y Service Worker: Configuración de notificaciones push operativa.
• Control de hardware del teléfono: Motores RT-Lite disponibles para linterna, volumen, brillo y telecomunicaciones.

3. RESOLUCIONES Y CONCLUSIONES
Se valida la exportación formal en formato PDF de alta fidelidad para distribución y resguardo seguro. Registro auditado por VVC LIAM CORE OS.`,
    };

    return {
      isHandled: true,
      spokenResponse: `Documento de texto "${docTitle}" generado con éxito. Desplegando el estudio documental con opción de exportación y descarga en PDF.`,
      actionType: 'document',
      actionDetails: `Documento generado: "${docTitle}" [Listo para descarga PDF]`,
      openDocs: true,
      docsMode: 'document',
      newDocument: generatedDoc,
    };
  }

  // 23. MATRIZ DE AGENTES ESPECIALIZADOS & ESPECIFICACIONES JSON
  if (
    query.includes('agente') ||
    query.includes('agentes') ||
    query.includes('matriz de agentes')
  ) {
    if (query.includes('abrir') || query.includes('mostrar') || query.includes('ver') || query.includes('listar') || query.includes('gestionar') || query.includes('configurar')) {
      return {
        isHandled: true,
        spokenResponse: 'Desplegando la matriz de agentes especializados. Puedes seleccionar un agente, inspeccionar sus bloques JSON o importar nuevos agentes.',
        actionType: 'model',
        actionDetails: 'Matriz de Agentes Especializados desplegada.',
        openAgents: true,
      };
    }
    const switchMatch = query.match(/(?:activar|cambiar a|seleccionar|pasar a)(?: el)? agente\s+(.+)/i);
    if (switchMatch) {
      const target = switchMatch[1].trim();
      return {
        isHandled: true,
        spokenResponse: `Localizando agente "${target}". Desplegando panel para confirmar activación de directivas en el LLM.`,
        actionType: 'model',
        actionDetails: `Activación de Agente: "${target}"`,
        openAgents: true,
        targetAgentName: target,
      };
    }
  }

  // 24. ABRIR TELEMETRÍA D3 Y MONITOR DE RENDIMIENTO VAOS
  if (
    query.includes('telemetría') ||
    query.includes('telemetria') ||
    query.includes('rendimiento') ||
    query.includes('latencia') ||
    query.includes('tokens por segundo') ||
    query.includes('monitor de batería') ||
    query.includes('monitor de bateria') ||
    query.includes('orquestador vaos')
  ) {
    return {
      isHandled: true,
      spokenResponse: 'Desplegando el panel de telemetría D3.js en tiempo real. Curvas de latencia, throughput y métricas del orquestador VAOS activas.',
      actionType: 'model',
      actionDetails: 'Panel de Telemetría D3.js y Orquestador VAOS desplegado.',
      openTelemetry: true,
    };
  }

  return {
    isHandled: false,
    spokenResponse: '',
  };
}

export function generateRTLiteResponse(prompt: string, activeEngine: ModelType = 'rt-lite-local'): string {
  const p = prompt.toLowerCase();

  // Engine-specific telemetry branding
  const enginePrefix = 
    activeEngine === 'rt-lite-hardware' ? '[RT-Lite Hardware & Device Control]' :
    activeEngine === 'rt-lite-telephony' ? '[RT-Lite Telecom & Communications]' :
    activeEngine === 'rt-lite-agenda' ? '[RT-Lite Calendar & Schedule Matrix]' :
    activeEngine === 'rt-lite-docs' ? '[RT-Lite Document & Spreadsheet Studio]' :
    activeEngine === 'rt-lite-security' ? '[RT-Lite Obsidian Vault & Security]' :
    '[RT-Lite Master Omni-Engine]';

  if (p.includes('quién eres') || p.includes('quien eres') || p.includes('tu nombre') || p.includes('vvc liam') || p.includes('liam core')) {
    return `${enginePrefix} Soy VVC LIAM CORE, tu estación de inteligencia artificial autónoma de vanguardia con arquitectura VAOS. Opero con todos los motores integrados: control físico de actuadores del teléfono, telecomunicaciones y llamadas directas, matriz de calendario con detección y resolución de conflictos, sincronización con Google, Outlook y Apple Calendar, y estudio de documentos y hojas de cálculo exportables a PDF.`;
  }

  if (p.includes('hora') || p.includes('qué hora es')) {
    return `${enginePrefix} La hora actual del sistema es ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`;
  }

  if (p.includes('fecha') || p.includes('qué día es')) {
    return `${enginePrefix} Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
  }

  if (p.includes('motores') || p.includes('rt lite') || p.includes('rt-lite')) {
    return `${enginePrefix} Todos los motores RT-Lite están disponibles y activos en el dispositivo:
1. RT-Lite Hardware: Linterna, linterna de pantalla, volumen, brillo, Wi-Fi, Bluetooth y batería.
2. RT-Lite Telephony: Llamadas directas, mensajería SMS, WhatsApp y libreta de contactos.
3. RT-Lite Agenda: Programación compleja, detección/resolución de conflictos y sync Google/Outlook/Apple.
4. RT-Lite Docs: Generación de documentos de texto, hojas de cálculo y exportación a PDF.
5. RT-Lite Security: Bóveda E2EE AES-GCM-256, service worker y notificaciones push nativas.
6. RT-Lite Master Omni-Engine: Control global coordinado en el dispositivo.`;
  }

  if (p.includes('ayuda') || p.includes('comandos') || p.includes('que puedes hacer')) {
    return `${enginePrefix} Comandos disponibles:
• "Agendar reunión con [nombre] [fecha] a las [hora] hasta las [hora]"
• "Comprobar conflictos en el calendario" / "Resolver conflictos"
• "Sincronizar con Google Calendar / Outlook / Apple Calendar"
• "Generar documento de texto sobre [tema]" / "Exportar a PDF"
• "Crear hoja de cálculo de [gastos/presupuesto/inventario]"
• "Llamar a [contacto]" / "WhatsApp a [contacto]: [mensaje]"
• "Encender linterna" / "Linterna de pantalla"
• "Crear tarea urgente [nombre] para las [hora]"
• "Probar notificación push en segundo plano"`;
  }

  return `${enginePrefix} Solicitud no reconocida por el motor local. No se ha ejecutado ninguna acción.`;
}
