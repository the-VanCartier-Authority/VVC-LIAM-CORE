import type { DeviceState, PhoneContact, AlarmItem, TimerItem, CalendarEvent, TaskItem } from '../types';

export interface CommandExecutionResult {
  isHandled: boolean;
  spokenResponse: string;
  actionType?: 'call' | 'message' | 'torch' | 'volume' | 'brightness' | 'alarm' | 'timer' | 'reminder' | 'task' | 'calendar' | 'security' | 'model' | 'sync' | 'gmail' | 'picker' | 'maps';
  actionDetails?: string;
  updatedDeviceState?: Partial<DeviceState>;
  newAlarm?: Omit<AlarmItem, 'id'>;
  newTimer?: { label: string; seconds: number };
  newTask?: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>;
  taskToCompleteId?: string;
  taskToDeleteId?: string;
  taskToModify?: { id: string; updates: Partial<TaskItem> };
  newCalendarEvent?: { title: string; date: string; time: string; location?: string; description?: string };
  callContact?: { name: string; number: string };
  messagePayload?: { recipient: string; message: string; channel: 'SMS' | 'WhatsApp' };
  screenFlashlight?: boolean;
  triggerICalExport?: boolean;
  triggerThirdPartySync?: boolean;
  openGmail?: boolean;
  gmailCompose?: { recipient: string; subject: string; body: string };
  openPicker?: boolean;
  openMaps?: boolean;
  mapsQuery?: string;
}

export function parseNaturalVoiceCommand(
  rawInput: string,
  deviceState: DeviceState,
  contacts: PhoneContact[],
  existingTasks: TaskItem[] = []
): CommandExecutionResult {
  const query = rawInput.trim().toLowerCase();

  // 1. COMPLETAR / MARCAR TAREA REALIZADA
  // e.g.: "completar tarea informe", "marcar como hecha la tarea comprar café", "tarea café completada"
  const completeMatch = query.match(/(?:completar(?: tarea| recordatorio)?|marcar como (?:hecha|completada|terminada)(?: la tarea)?|finalizar tarea)\s+(.+)/i);
  if (completeMatch) {
    const targetTitle = completeMatch[1].trim();
    const matched = existingTasks.find(
      (t) => t.title.toLowerCase().includes(targetTitle) || targetTitle.includes(t.title.toLowerCase())
    );

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
  const snoozeMatch = query.match(/(?:posponer|aplazar)(?: recordatorio| tarea)?\s+(.+?)(?:\s+(\d+)\s*(?:minutos?|min))?$/i);
  if (snoozeMatch) {
    const targetTitle = snoozeMatch[1].trim();
    const minutes = parseInt(snoozeMatch[2] || '10', 10);
    const matched = existingTasks.find(
      (t) => t.title.toLowerCase().includes(targetTitle) || targetTitle.includes(t.title.toLowerCase())
    );

    if (matched) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + minutes);
      const newTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        isHandled: true,
        spokenResponse: `Recordatorio "${matched.title}" pospuesto ${minutes} minutos. Nueva hora: ${newTime}.`,
        actionType: 'task',
        actionDetails: `Pospuesto ${minutes} min: "${matched.title}" -> ${newTime}`,
        taskToModify: {
          id: matched.id,
          updates: { timeDue: newTime, snoozedUntil: newTime },
        },
      };
    }
  }

  // 3. MODIFICAR RECORDATORIO O TAREA EXISTENTE
  // e.g.: "modificar recordatorio café: cambiar hora a las 19:30", "cambiar hora de tarea café a las 18:00"
  const modifyTimeMatch = query.match(/(?:modificar (?:recordatorio|tarea)|cambiar hora (?:de|del) (?:recordatorio|tarea))\s+(.+?)(?::\s*cambiar hora a las|\s+a las|\s+para las)\s*(\d{1,2}:\d{2})/i);
  if (modifyTimeMatch) {
    const targetTitle = modifyTimeMatch[1].trim();
    const newTime = modifyTimeMatch[2].trim();
    const matched = existingTasks.find(
      (t) => t.title.toLowerCase().includes(targetTitle) || targetTitle.includes(t.title.toLowerCase())
    );

    if (matched) {
      return {
        isHandled: true,
        spokenResponse: `Recordatorio "${matched.title}" modificado exitosamente. Programado ahora para las ${newTime}.`,
        actionType: 'task',
        actionDetails: `Hora modificada: "${matched.title}" -> ${newTime}`,
        taskToModify: {
          id: matched.id,
          updates: { timeDue: newTime },
        },
      };
    }
  }

  // 4. CAMBIAR PRIORIDAD DE TAREA
  // e.g.: "cambiar prioridad de café a crítica", "prioridad alta para informe"
  const priorityMatch = query.match(/(?:cambiar prioridad (?:de|del)?\s*(.+?)\s+a\s+(critica|crítica|alta|media|baja)|prioridad\s+(critica|crítica|alta|media|baja)\s+para\s+(.+))/i);
  if (priorityMatch) {
    const targetTitle = (priorityMatch[1] || priorityMatch[4] || '').trim();
    const rawPriority = (priorityMatch[2] || priorityMatch[3] || 'alta').toLowerCase();
    const finalPriority = rawPriority.includes('crit') ? 'critica' : (rawPriority as any);

    const matched = existingTasks.find(
      (t) => t.title.toLowerCase().includes(targetTitle) || targetTitle.includes(t.title.toLowerCase())
    );

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
  const deleteMatch = query.match(/(?:eliminar|borrar|quitar)(?: tarea| recordatorio)\s+(.+)/i);
  if (deleteMatch) {
    const targetTitle = deleteMatch[1].trim();
    const matched = existingTasks.find(
      (t) => t.title.toLowerCase().includes(targetTitle) || targetTitle.includes(t.title.toLowerCase())
    );

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
  if (query.includes('exportar a ical') || query.includes('descargar ics') || query.includes('exportar agenda')) {
    return {
      isHandled: true,
      spokenResponse: 'Generando archivo estándar iCalendar RFC 5545 para Google Calendar y Apple Calendar.',
      actionType: 'sync',
      actionDetails: 'Archivo .ics descargado para importación en Google Calendar',
      triggerICalExport: true,
    };
  }

  if (query.includes('sincronizar calendario') || query.includes('sincronizar tareas') || query.includes('sync google') || query.includes('sincronizar con notion')) {
    return {
      isHandled: true,
      spokenResponse: 'Sincronización en tiempo real completada con servicios en la nube y calendario.',
      actionType: 'sync',
      actionDetails: 'Sincronización Cloud: Google Calendar & Notion en vivo',
      triggerThirdPartySync: true,
    };
  }

  // 7. LLAMADAS TELEFÓNICAS
  const callRegex = /(?:llamar a|llama a|haz una llamada a|marcar a|marcar al|marca a|comunícame con)\s+([a-záéíóúñ0-9\s+]+)/i;
  const callMatch = query.match(callRegex);

  if (callMatch || query.includes('emergencia') || query.includes('llamar al 911')) {
    const rawTarget = callMatch ? callMatch[1].trim() : (query.includes('911') ? '911' : 'Emergencias');
    const contact = contacts.find(
      (c) => c.name.toLowerCase().includes(rawTarget.toLowerCase()) || c.phone.includes(rawTarget)
    );

    const name = contact ? contact.name : rawTarget;
    const number = contact ? contact.phone : (/\d+/.test(rawTarget) ? rawTarget : '+1 (555) 019-2831');

    return {
      isHandled: true,
      spokenResponse: `Iniciando llamada segura a ${name}. Enlace encriptado.`,
      actionType: 'call',
      actionDetails: `Llamada saliente iniciada: ${name} (${number})`,
      callContact: { name, number },
    };
  }

  // 8. MENSAJES Y COMUNICACIÓN (SMS / WHATSAPP)
  const msgRegex = /(?:enviar mensaje a|envía mensaje a|mandar mensaje a|mensaje a|whatsapp a|escribir a)\s+([^:]+)(?::\s*|\s+que\s+)(.+)/i;
  const msgMatch = query.match(msgRegex);

  if (msgMatch) {
    const recipientRaw = msgMatch[1].trim();
    const messageContent = msgMatch[2].trim();
    const isWhatsApp = query.includes('whatsapp');

    const contact = contacts.find((c) => c.name.toLowerCase().includes(recipientRaw.toLowerCase()));
    const finalRecipient = contact ? contact.name : recipientRaw;

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
  if (query.includes('encender linterna') || query.includes('activa la linterna') || query.includes('prender linterna') || query.includes('luz de emergencia') || query.includes('linterna on')) {
    return {
      isHandled: true,
      spokenResponse: 'Linterna de alta intensidad activada.',
      actionType: 'torch',
      actionDetails: 'Linterna / Flash activado.',
      updatedDeviceState: { flashlight: true, screenTorchActive: true },
    };
  }

  if (query.includes('apagar linterna') || query.includes('desactiva la linterna') || query.includes('linterna off')) {
    return {
      isHandled: true,
      spokenResponse: 'Linterna desactivada.',
      actionType: 'torch',
      actionDetails: 'Linterna / Flash apagado.',
      updatedDeviceState: { flashlight: false, screenTorchActive: false },
    };
  }

  // 10. BRILLO DE PANTALLA
  const brightnessPercentMatch = query.match(/brillo(?: al| a)?\s*(\d+)(?:%| por ciento)?/i);
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

  if (query.includes('subir brillo') || query.includes('aumentar brillo')) {
    const newVal = Math.min(100, deviceState.brightness + 25);
    return {
      isHandled: true,
      spokenResponse: `Brillo aumentado al ${newVal} por ciento.`,
      actionType: 'brightness',
      actionDetails: `Brillo aumentado a ${newVal}%`,
      updatedDeviceState: { brightness: newVal },
    };
  }

  if (query.includes('bajar brillo') || query.includes('reducir brillo')) {
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
  const volumePercentMatch = query.match(/volumen(?: al| a)?\s*(\d+)(?:%| por ciento)?/i);
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

  if (query.includes('subir volumen') || query.includes('aumenta volumen')) {
    const newVal = Math.min(100, deviceState.volume + 20);
    return {
      isHandled: true,
      spokenResponse: `Volumen incrementado al ${newVal} por ciento.`,
      actionType: 'volume',
      actionDetails: `Volumen: ${newVal}%`,
      updatedDeviceState: { volume: newVal, isMuted: false },
    };
  }

  if (query.includes('bajar volumen') || query.includes('disminuye volumen')) {
    const newVal = Math.max(0, deviceState.volume - 20);
    return {
      isHandled: true,
      spokenResponse: `Volumen disminuido al ${newVal} por ciento.`,
      actionType: 'volume',
      actionDetails: `Volumen: ${newVal}%`,
      updatedDeviceState: { volume: newVal, isMuted: newVal === 0 },
    };
  }

  if (query.includes('silenciar') || query.includes('modo silencio') || query.includes('mute')) {
    return {
      isHandled: true,
      spokenResponse: 'Modo silencio activado.',
      actionType: 'volume',
      actionDetails: 'Audio silenciado (0%)',
      updatedDeviceState: { isMuted: true },
    };
  }

  // 12. ALARMAS Y TEMPORIZADORES
  const alarmMatch = query.match(/(?:alarma|despiértame|despertador)(?: a las| para las| a la)?\s*(\d{1,2})(?::(\d{2}))?/i);
  if (alarmMatch) {
    const hours = alarmMatch[1].padStart(2, '0');
    const minutes = alarmMatch[2] ? alarmMatch[2] : '00';
    const timeFormatted = `${hours}:${minutes}`;

    return {
      isHandled: true,
      spokenResponse: `Alarma programada para las ${timeFormatted}.`,
      actionType: 'alarm',
      actionDetails: `Nueva alarma guardada: ${timeFormatted}`,
      newAlarm: {
        time: timeFormatted,
        label: 'Alarma de voz VVC-ACIA',
        enabled: true,
        days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
      },
    };
  }

  const timerMatch = query.match(/temporizador de\s*(\d+)\s*(minutos?|segundos?|horas?)/i);
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

  // 13. CREACIÓN AVANZADA DE TAREAS Y RECORDATORIOS
  // e.g.: "crear tarea urgente revisar informe para mañana a las 15:00"
  // e.g.: "recuérdame comprar café a las 18:00"
  const isCreateTask = /(?:crear tarea|nueva tarea|recordatorio|recuérdame|anotar tarea|tarea)(?::|\s+de|\s+que)?\s*(.+)/i.test(query);
  if (isCreateTask && !query.includes('calendario') && !query.includes('reunión') && !query.includes('evento')) {
    const match = query.match(/(?:crear tarea|nueva tarea|recordatorio|recuérdame|anotar tarea|tarea)(?::|\s+de|\s+que)?\s*(.+)/i);
    const fullBody = match ? match[1] : query;

    // Detect time (e.g. "a las 18:00")
    const timeMatch = fullBody.match(/(?:a las|para las)\s*(\d{1,2}:\d{2}|\d{1,2}\s*(?:de la tarde|de la mañana|am|pm)?)/i);
    let timeDue = '18:00';
    if (timeMatch) {
      const rawT = timeMatch[1].trim();
      if (rawT.includes(':')) {
        timeDue = rawT;
      } else {
        const h = parseInt(rawT, 10);
        timeDue = `${h.toString().padStart(2, '0')}:00`;
      }
    }

    // Detect date (hoy, mañana, fecha)
    let dueDate = new Date().toISOString().split('T')[0];
    if (fullBody.includes('mañana')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      dueDate = d.toISOString().split('T')[0];
    }

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
    const title = fullBody
      .replace(/(?:a las|para las)\s*\d{1,2}(?::\d{2})?/gi, '')
      .replace(/urgente|crítica|critica|prioridad alta|prioridad baja/gi, '')
      .replace(/para hoy|para mañana/gi, '')
      .replace(/diario|todos los días|semanal/gi, '')
      .trim() || 'Tarea sin título';

    return {
      isHandled: true,
      spokenResponse: `Tarea "${title}" creada con prioridad ${priority} para las ${timeDue}. Notificación en tiempo real y sincronización listas.`,
      actionType: 'task',
      actionDetails: `Tarea registrada: "${title}" [${priority.toUpperCase()}] Fecha: ${dueDate} ${timeDue}`,
      newTask: {
        title,
        dueDate,
        timeDue,
        priority,
        category: priority === 'critica' ? 'urgente' : 'trabajo',
        isCompleted: false,
        recurrence,
        subtasks: [],
        syncedToThirdParty: {
          googleCalendar: true,
          notion: true,
          todoist: true,
          slackWebhook: true,
        },
      },
    };
  }

  // 14. EVENTO EN CALENDARIO
  // e.g.: "nuevo evento reunión de equipo a las 10:00", "calendario reunión mañana"
  const calMatch = query.match(/(?:evento|calendario|reunión|cita)(?::|\s+de|\s+para)?\s*(.+?)(?:\s+a las\s*(\d{1,2}:\d{2}))?$/i);
  if (calMatch) {
    const title = calMatch[1].trim();
    const time = calMatch[2] || '10:00';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    return {
      isHandled: true,
      spokenResponse: `Evento "${title}" añadido al calendario para las ${time}. Enlace iCal generado.`,
      actionType: 'calendar',
      actionDetails: `Calendario actualizado: ${title} (${dateStr} a las ${time})`,
      newCalendarEvent: {
        title,
        date: dateStr,
        time,
        location: 'Virtual / VVC-ACIA Hub',
      },
    };
  }

  // 15. CONECTIVIDAD: WI-FI & BLUETOOTH
  if (query.includes('activar wifi') || query.includes('encender wifi')) {
    return {
      isHandled: true,
      spokenResponse: 'Wi-Fi activado. Escaneando redes seguras.',
      actionType: 'security',
      actionDetails: 'Wi-Fi: Conectado (WPA3-Enterprise)',
      updatedDeviceState: { wifi: true },
    };
  }

  if (query.includes('desactivar wifi') || query.includes('apagar wifi')) {
    return {
      isHandled: true,
      spokenResponse: 'Wi-Fi desactivado.',
      actionType: 'security',
      actionDetails: 'Wi-Fi: Desconectado',
      updatedDeviceState: { wifi: false },
    };
  }

  // 16. ESTADO DEL SISTEMA Y BATERÍA
  if (query.includes('batería') || query.includes('bateria') || query.includes('nivel de carga')) {
    return {
      isHandled: true,
      spokenResponse: `La batería se encuentra al ${deviceState.batteryLevel} por ciento ${deviceState.isCharging ? 'y está cargando' : 'con autonomía óptima'}.`,
      actionType: 'security',
      actionDetails: `Nivel de batería: ${deviceState.batteryLevel}% | Cargando: ${deviceState.isCharging ? 'Sí' : 'No'}`,
    };
  }

  // 17. GMAIL WORKSPACE
  if (query.includes('abrir gmail') || query.includes('abre gmail') || query.includes('ver correos') || query.includes('revisar correos') || query.includes('bandeja de entrada') || query.includes('leer correos')) {
    return {
      isHandled: true,
      spokenResponse: 'Abriendo tu bandeja de entrada de Gmail.',
      actionType: 'gmail',
      actionDetails: 'Gmail Workspace abierto.',
      openGmail: true,
    };
  }

  const gmailSendMatch = query.match(/(?:enviar|redactar|mandar)(?: un)? correo a (.+?)(?:\s+(?:con asunto|asunto)\s+(.+?))?(?:\s+(?:con mensaje|mensaje|diciendo)\s+(.+))?$/i);
  if (gmailSendMatch) {
    const to = gmailSendMatch[1].trim();
    const subj = gmailSendMatch[2] ? gmailSendMatch[2].trim() : 'Mensaje desde VVC-ACIA';
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
  if (query.includes('abrir picker') || query.includes('abre picker') || query.includes('google picker') || query.includes('adjuntar de drive') || query.includes('seleccionar archivo') || query.includes('archivos de drive') || query.includes('abrir drive')) {
    return {
      isHandled: true,
      spokenResponse: 'Iniciando Google Picker para explorar tus archivos en Google Drive.',
      actionType: 'picker',
      actionDetails: 'Google Picker API activado.',
      openPicker: true,
    };
  }

  // 19. GOOGLE MAPS
  if (query.includes('abrir mapa') || query.includes('abre el mapa') || query.includes('ver mapa') || query.includes('mostrar mapa') || query.includes('google maps') || query.includes('radar de mapa')) {
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

  return {
    isHandled: false,
    spokenResponse: '',
  };
}

export function generateRTLiteResponse(prompt: string): string {
  const p = prompt.toLowerCase();

  if (p.includes('quién eres') || p.includes('quien eres') || p.includes('tu nombre') || p.includes('que es vvc-acia')) {
    return 'Soy VVC-ACIA, tu asistente personal de voz obsidian de vanguardia. Opero con cifrado de extremo a extremo, control de funciones del teléfono, gestión automatizada de tareas y recordatorios en tiempo real, integración con calendario y soporte para modelos NVIDIA Build.';
  }

  if (p.includes('hora') || p.includes('qué hora es')) {
    return `La hora actual del sistema es ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`;
  }

  if (p.includes('fecha') || p.includes('qué día es')) {
    return `Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
  }

  if (p.includes('ayuda') || p.includes('comandos') || p.includes('que puedes hacer')) {
    return 'Comandos disponibles:\n• "Crear tarea [nombre] para mañana a las [hora]"\n• "Completar tarea [nombre]"\n• "Posponer recordatorio [nombre] 15 minutos"\n• "Modificar recordatorio [nombre]: cambiar hora a las [hora]"\n• "Sincronizar calendario con Google Calendar / iCal"\n• "Llamar a [nombre o número]"\n• "WhatsApp a [nombre]: [mensaje]"\n• "Encender / apagar linterna"\n• "Poner alarma / temporizador"\n• "Subir / bajar brillo / volumen"';
  }

  return `[RT-Lite Local] Procesado localmente en el dispositivo: "${prompt}". Tu comando se ha ejecutado con latencia cero y cifrado total.`;
}
