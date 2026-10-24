import React, { useState, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  CheckSquare, 
  Plus, 
  Trash2, 
  X, 
  Clock, 
  AlertCircle, 
  Bell, 
  CheckCircle2, 
  ShieldCheck, 
  Share2, 
  Download, 
  Edit3, 
  Repeat, 
  ExternalLink, 
  Send, 
  Check, 
  ChevronRight, 
  ListChecks, 
  Sparkles,
  Link as LinkIcon,
  Upload,
  Layers,
  Users,
  Compass,
  FileUp,
  Globe,
  Radio,
  RefreshCw,
} from 'lucide-react';
import type { CalendarEvent, TaskItem, SubtaskItem } from '../types';
import { downloadICSFile, dispatchTaskWebhook } from '../utils/ical';
import {
  detectEventConflicts,
  resolveEventConflict,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
  generateAppleCalendarICS,
  parseICSFeed,
  type ConflictAnalysis
} from '../utils/calendarSync';
import type { User } from 'firebase/auth';
import { getAccessToken } from '../services/googleAuth';
import {
  listGoogleCalendarEvents,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  type GoogleCalendarEventItem,
} from '../services/googleCalendarService';

interface CalendarRemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onDeleteEvent: (id: string) => void;
  onBatchAddEvents?: (newEvents: CalendarEvent[]) => void;
  tasks: TaskItem[];
  onToggleTask: (id: string) => void;
  onAddTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTask: (id: string, updates: Partial<TaskItem>) => void;
  onDeleteTask: (id: string) => void;
  onConvertTaskToEvent: (task: TaskItem) => void;
  thirdPartyWebhookUrl: string;
  onUpdateWebhookUrl: (url: string) => void;
  currentUser?: User | null;
  onSignInGoogle?: () => void;
}

export const CalendarRemindersModal: React.FC<CalendarRemindersModalProps> = ({
  isOpen,
  onClose,
  events,
  onAddEvent,
  onDeleteEvent,
  onBatchAddEvents,
  tasks,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onConvertTaskToEvent,
  thirdPartyWebhookUrl,
  onUpdateWebhookUrl,
  currentUser,
  onSignInGoogle,
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'calendar' | 'google' | 'integrations'>('tasks');
  const [filterPriority, setFilterPriority] = useState<'all' | 'pending' | 'completed' | 'critica'>('all');

  // Task Creation Form
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('18:00');
  const [newPriority, setNewPriority] = useState<'baja' | 'media' | 'alta' | 'critica'>('alta');
  const [newCategory, setNewCategory] = useState<'trabajo' | 'personal' | 'urgente' | 'sistema' | 'proyecto'>('trabajo');
  const [newRecurrence, setNewRecurrence] = useState<'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly'>('none');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [tempSubtasks, setTempSubtasks] = useState<string[]>([]);
  const [syncGoogle, setSyncGoogle] = useState(true);
  const [syncNotion, setSyncNotion] = useState(true);

  // Edit Task Inline Modal/Drawer State
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Complex Event Creation Form
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEventTime, setNewEventTime] = useState('10:00');
  const [newEventEndTime, setNewEventEndTime] = useState('11:00');
  const [newEventLocation, setNewEventLocation] = useState('Enlace Seguro VVC LIAM CORE');
  const [newEventCategory, setNewEventCategory] = useState<'reunion' | 'tarea' | 'llamada' | 'personal' | 'sistema'>('reunion');
  const [newEventAttendees, setNewEventAttendees] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventRecurrence, setNewEventRecurrence] = useState<'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly'>('none');

  // File import state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);

  // Webhook Test State
  const [testWebhookStatus, setTestWebhookStatus] = useState<string | null>(null);

  // Compute live conflict analysis for candidate event
  const conflictAnalysis: ConflictAnalysis = detectEventConflicts(
    {
      date: newEventDate,
      time: newEventTime,
      endTime: newEventEndTime,
    },
    events
  );

  // Live Google Calendar State
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEventItem[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleSuccess, setGoogleSuccess] = useState<string | null>(null);
  const [googleEventToDelete, setGoogleEventToDelete] = useState<GoogleCalendarEventItem | null>(null);
  const [gDirectTitle, setGDirectTitle] = useState('');
  const [gDirectDate, setGDirectDate] = useState(new Date().toISOString().split('T')[0]);
  const [gDirectTime, setGDirectTime] = useState('11:00');
  const [gDirectEndTime, setGDirectEndTime] = useState('12:00');
  const [gDirectDesc, setGDirectDesc] = useState('');

  const fetchGoogleEvents = async () => {
    setIsLoadingGoogle(true);
    setGoogleError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setGoogleError('Inicia sesión con Google para acceder a tu Google Calendar.');
        return;
      }
      const items = await listGoogleCalendarEvents(token);
      setGoogleEvents(items);
      setGoogleSuccess(`✓ ${items.length} eventos de Google Calendar sincronizados.`);
      setTimeout(() => setGoogleSuccess(null), 3500);
    } catch (err: any) {
      setGoogleError(err.message || 'Error al conectar con Google Calendar');
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleCreateGoogleDirectEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gDirectTitle.trim()) return;
    setIsLoadingGoogle(true);
    setGoogleError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Se requiere iniciar sesión con Google');
      const startDateTime = new Date(`${gDirectDate}T${gDirectTime}:00`).toISOString();
      const endDateTime = new Date(`${gDirectDate}T${gDirectEndTime || gDirectTime}:00`).toISOString();
      await createGoogleCalendarEvent(token, {
        summary: gDirectTitle.trim(),
        description: gDirectDesc.trim() || undefined,
        startDateTime,
        endDateTime,
      });
      setGoogleSuccess(`✓ Evento "${gDirectTitle}" agendado exitosamente en Google Calendar.`);
      setGDirectTitle('');
      setGDirectDesc('');
      fetchGoogleEvents();
      setTimeout(() => setGoogleSuccess(null), 4000);
    } catch (err: any) {
      setGoogleError(err.message || 'Error al crear evento en Google Calendar');
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const confirmDeleteGoogleEvent = async () => {
    if (!googleEventToDelete) return;
    setIsLoadingGoogle(true);
    setGoogleError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Token no disponible');
      await deleteGoogleCalendarEvent(token, googleEventToDelete.id);
      setGoogleEvents((prev) => prev.filter((e) => e.id !== googleEventToDelete.id));
      setGoogleSuccess(`✓ Evento "${googleEventToDelete.summary}" eliminado de Google Calendar.`);
      setGoogleEventToDelete(null);
      setTimeout(() => setGoogleSuccess(null), 3500);
    } catch (err: any) {
      setGoogleError(err.message || 'Error al eliminar evento');
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  if (!isOpen) return null;

  // Add temporary subtask
  const handleAddTempSubtask = () => {
    if (!subtaskInput.trim()) return;
    setTempSubtasks((prev) => [...prev, subtaskInput.trim()]);
    setSubtaskInput('');
  };

  // Submit new Task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const subtasksList: SubtaskItem[] = tempSubtasks.map((st, i) => ({
      id: `st-${Date.now()}-${i}`,
      title: st,
      completed: false,
    }));

    onAddTask({
      title: newTitle.trim(),
      dueDate: newDate,
      timeDue: newTime,
      priority: newPriority,
      category: newCategory,
      isCompleted: false,
      recurrence: newRecurrence,
      subtasks: subtasksList,
      syncedToThirdParty: {
        googleCalendar: syncGoogle,
        notion: syncNotion,
        todoist: true,
        slackWebhook: Boolean(thirdPartyWebhookUrl),
      },
    });

    setNewTitle('');
    setTempSubtasks([]);
  };

  // Submit new Calendar Event with conflict detection & resolution
  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    const attendeesList = newEventAttendees
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    let eventDate = newEventDate;
    let eventTime = newEventTime;
    let eventEndTime = newEventEndTime;
    let conflictNote: string | undefined = undefined;
    let syncStatus: 'synced' | 'local' | 'conflict_resolved' = 'synced';

    if (conflictAnalysis.hasConflict) {
      conflictNote = `Conflicto detectado originalmente con ${conflictAnalysis.conflictingEvents[0]?.title || 'evento existente'}.`;
      syncStatus = 'conflict_resolved';
    }

    onAddEvent({
      title: newEventTitle.trim(),
      date: eventDate,
      time: eventTime,
      endTime: eventEndTime,
      location: newEventLocation.trim() || 'Virtual / VVC LIAM CORE Hub',
      description: newEventDescription.trim() || undefined,
      category: newEventCategory,
      recurrence: newEventRecurrence,
      attendees: attendeesList.length > 0 ? attendeesList : undefined,
      source: 'vvc_liam',
      syncStatus,
      conflictNote,
      isAutomated: true,
    });

    setNewEventTitle('');
    setNewEventAttendees('');
    setNewEventDescription('');
  };

  // Auto-resolve conflict by adopting suggested slot
  const handleAutoResolveConflict = (slot: { date: string; time: string; endTime: string }) => {
    setNewEventDate(slot.date);
    setNewEventTime(slot.time);
    setNewEventEndTime(slot.endTime);
  };

  // Import external .ICS file (Google Calendar, Outlook, Apple Calendar)
  const handleImportICSFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const providerGuess: 'google' | 'outlook' | 'apple' = content.includes('Apple Inc')
        ? 'apple'
        : content.includes('Microsoft')
        ? 'outlook'
        : 'google';

      const parsed = parseICSFeed(content, providerGuess);
      if (parsed.length === 0) {
        setImportStatusMessage('No se encontraron eventos válidos en el archivo .ics seleccionado.');
        setTimeout(() => setImportStatusMessage(null), 3500);
        return;
      }

      if (onBatchAddEvents) {
        onBatchAddEvents(parsed);
      } else {
        parsed.forEach((ev) => onAddEvent(ev));
      }

      setImportStatusMessage(`✓ ${parsed.length} eventos importados exitosamente desde ${providerGuess.toUpperCase()} Calendar.`);
      setTimeout(() => setImportStatusMessage(null), 4500);
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Test Webhook Dispatch
  const handleTestWebhook = async () => {
    setTestWebhookStatus('Enviando...');
    const sampleTask = tasks[0] || {
      id: 'demo-task',
      title: 'Prueba de Integración VVC LIAM CORE Webhook',
      dueDate: new Date().toISOString().split('T')[0],
      timeDue: '12:00',
      priority: 'alta',
      category: 'sistema',
      isCompleted: false,
      recurrence: 'none',
      subtasks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const res = await dispatchTaskWebhook(thirdPartyWebhookUrl, 'created', sampleTask);
    if (res.success) {
      setTestWebhookStatus('¡Webhook enviado con éxito! (Status 200)');
    } else {
      setTestWebhookStatus(`Error: ${res.error}`);
    }
    setTimeout(() => setTestWebhookStatus(null), 3500);
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filterPriority === 'pending') return !t.isCompleted;
    if (filterPriority === 'completed') return t.isCompleted;
    if (filterPriority === 'critica') return t.priority === 'critica';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl bg-[#080b12] border border-[#1e2638] rounded-2xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2638]">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-[#00f0ff]" />
            <h3 className="font-mono text-sm font-bold text-white tracking-wider">
              Gestor Avanzado de Tareas, Recordatorios & Calendario
            </h3>
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
              <ShieldCheck className="w-3 h-3" />
              Exportación iCal · sync parcial
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadICSFile(events, tasks)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#131929] hover:bg-[#1a233b] border border-[#1e2638] text-slate-200 text-xs font-mono transition-colors"
              title="Descargar archivo .ics compatible con Google Calendar, Apple y Outlook"
            >
              <Download className="w-3.5 h-3.5 text-[#00f0ff]" />
              <span className="hidden sm:inline">Exportar .ics</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#121622] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 my-3 p-1 bg-[#0d121f] rounded-lg border border-[#1e2638]">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'tasks'
                ? 'bg-[#00f0ff] text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Tareas & Recordatorios ({tasks.filter((t) => !t.isCompleted).length})</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'calendar'
                ? 'bg-[#b026ff] text-white shadow-[0_0_10px_rgba(176,38,255,0.4)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Agenda Local ({events.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('google');
              if (googleEvents.length === 0 && currentUser) {
                fetchGoogleEvents();
              }
            }}
            className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'google'
                ? 'bg-emerald-400 text-black shadow-[0_0_10px_rgba(52,211,153,0.4)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Google Calendar (API)</span>
          </button>

          <button
            onClick={() => setActiveTab('integrations')}
            className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'integrations'
                ? 'bg-[#ff2a5f] text-white shadow-[0_0_10px_rgba(255,42,95,0.4)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Exportar & Webhooks</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 font-mono text-xs">
          {/* TAB 1: TAREAS Y RECORDATORIOS AVANZADOS */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              {/* Creator Card */}
              <form onSubmit={handleCreateTask} className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-white font-semibold">
                  <span className="text-[#00f0ff] flex items-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    Creación Automatizada de Tarea o Recordatorio
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Sincronización en Tiempo Real
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Título de la tarea o recordatorio..."
                    className="sm:col-span-2 bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />

                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />

                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Prioridad:</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as any)}
                      className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none"
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="critica">Crítica (Notificación Inmediata)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Categoría:</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none"
                    >
                      <option value="trabajo">Trabajo</option>
                      <option value="personal">Personal</option>
                      <option value="urgente">Urgente</option>
                      <option value="proyecto">Proyecto</option>
                      <option value="sistema">Sistema</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Recurrencia:</label>
                    <select
                      value={newRecurrence}
                      onChange={(e) => setNewRecurrence(e.target.value as any)}
                      className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none"
                    >
                      <option value="none">Una vez (Sin recurrencia)</option>
                      <option value="daily">Diaria (Todos los días)</option>
                      <option value="weekdays">Días laborables (Lun - Vie)</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensual</option>
                    </select>
                  </div>
                </div>

                {/* Subtasks inputs */}
                <div>
                  <div className="flex gap-2 mb-1.5">
                    <input
                      type="text"
                      value={subtaskInput}
                      onChange={(e) => setSubtaskInput(e.target.value)}
                      placeholder="Añadir subtarea opcional (ej: Preparar diapositivas)..."
                      className="flex-1 bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-3 py-1 text-xs text-slate-100 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTempSubtask();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddTempSubtask}
                      className="px-3 py-1 rounded bg-[#131929] hover:bg-[#1c2438] text-slate-200 border border-[#1e2638] text-xs font-mono"
                    >
                      + Subtarea
                    </button>
                  </div>

                  {tempSubtasks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tempSubtasks.map((st, idx) => (
                        <span
                          key={idx}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#121826] border border-[#1e2638] text-[11px] text-slate-300"
                        >
                          <span>{st}</span>
                          <button
                            type="button"
                            onClick={() => setTempSubtasks(tempSubtasks.filter((_, i) => i !== idx))}
                            className="text-slate-500 hover:text-red-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cloud & 3rd-Party Sync Toggles */}
                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#1e2638] gap-2">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncGoogle}
                        onChange={(e) => setSyncGoogle(e.target.checked)}
                        className="accent-[#00f0ff] rounded"
                      />
                      <span>Google Calendar Sync</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncNotion}
                        onChange={(e) => setSyncNotion(e.target.checked)}
                        className="accent-[#b026ff] rounded"
                      />
                      <span>Notion DB</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!newTitle.trim()}
                    className="px-4 py-1.5 rounded bg-[#00f0ff] hover:bg-[#00d4e3] text-black font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(0,240,255,0.4)] disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Guardar & Programar</span>
                  </button>
                </div>
              </form>

              {/* Filter Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setFilterPriority('all')}
                    className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                      filterPriority === 'all'
                        ? 'bg-[#1e2638] text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Todas ({tasks.length})
                  </button>
                  <button
                    onClick={() => setFilterPriority('pending')}
                    className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                      filterPriority === 'pending'
                        ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-semibold border border-[#00f0ff]/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Pendientes ({tasks.filter((t) => !t.isCompleted).length})
                  </button>
                  <button
                    onClick={() => setFilterPriority('critica')}
                    className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                      filterPriority === 'critica'
                        ? 'bg-[#ff2a5f]/20 text-[#ff2a5f] font-semibold border border-[#ff2a5f]/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Críticas ({tasks.filter((t) => t.priority === 'critica').length})
                  </button>
                  <button
                    onClick={() => setFilterPriority('completed')}
                    className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                      filterPriority === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Completadas ({tasks.filter((t) => t.isCompleted).length})
                  </button>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-2">
                {filteredTasks.length === 0 ? (
                  <div className="p-8 text-center bg-[#0b0e17] rounded-xl border border-[#1e2638] text-slate-500">
                    No hay tareas en esta vista. Puedes dictar por voz "Crear tarea urgente revisar presupuesto para mañana a las 10:00".
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        task.isCompleted
                          ? 'bg-[#0a0d14]/60 border-[#1e2638] opacity-60'
                          : task.priority === 'critica'
                          ? 'bg-[#0e070c] border-[#ff2a5f]/50 shadow-[0_0_15px_rgba(255,42,95,0.15)]'
                          : 'bg-[#0b0e17] border-[#1e2638] hover:border-[#00f0ff]/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Checkbox & Details */}
                        <div className="flex items-start gap-3 flex-1">
                          <button
                            onClick={() => onToggleTask(task.id)}
                            className={`w-5 h-5 rounded mt-0.5 flex items-center justify-center border transition-all shrink-0 ${
                              task.isCompleted
                                ? 'bg-emerald-500 border-emerald-500 text-black'
                                : 'border-slate-500 hover:border-[#00f0ff]'
                            }`}
                          >
                            {task.isCompleted && <Check className="w-3.5 h-3.5" />}
                          </button>

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`font-semibold text-white text-sm ${
                                  task.isCompleted ? 'line-through text-slate-500' : ''
                                }`}
                              >
                                {task.title}
                              </span>

                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${
                                  task.priority === 'critica'
                                    ? 'bg-[#ff2a5f]/20 text-[#ff2a5f] border border-[#ff2a5f]/40 font-bold'
                                    : task.priority === 'alta'
                                    ? 'bg-amber-400/20 text-amber-400'
                                    : 'bg-slate-700/40 text-slate-300'
                                }`}
                              >
                                {task.priority}
                              </span>

                              <span className="text-[10px] bg-[#141a29] px-2 py-0.5 rounded text-slate-400 uppercase">
                                {task.category}
                              </span>

                              {task.recurrence !== 'none' && (
                                <span className="flex items-center gap-1 text-[10px] text-[#00f0ff] bg-[#00f0ff]/10 px-1.5 py-0.5 rounded border border-[#00f0ff]/20">
                                  <Repeat className="w-2.5 h-2.5" />
                                  {task.recurrence}
                                </span>
                              )}
                            </div>

                            {/* Date, Time & Third party badges */}
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1 text-[#00f0ff]">
                                <Clock className="w-3 h-3" />
                                {task.dueDate} · {task.timeDue}
                              </span>

                              {task.calendarEventId ? (
                                <span className="flex items-center gap-1 text-[#b026ff]">
                                  <LinkIcon className="w-2.5 h-2.5" />
                                  Vinculado al Calendario
                                </span>
                              ) : (
                                <button
                                  onClick={() => onConvertTaskToEvent(task)}
                                  className="text-[10px] text-slate-400 hover:text-[#b026ff] hover:underline flex items-center gap-1"
                                >
                                  + Añadir a Calendario
                                </button>
                              )}

                              {task.syncedToThirdParty?.googleCalendar && (
                                <span className="text-[9px] text-emerald-400">Google Sync</span>
                              )}
                              {task.syncedToThirdParty?.notion && (
                                <span className="text-[9px] text-blue-400">Notion</span>
                              )}
                            </div>

                            {/* Subtasks checklist if any */}
                            {task.subtasks && task.subtasks.length > 0 && (
                              <div className="pt-2 pl-1 space-y-1">
                                {task.subtasks.map((st) => (
                                  <div
                                    key={st.id}
                                    onClick={() => {
                                      const updatedSt = task.subtasks.map((item) =>
                                        item.id === st.id ? { ...item, completed: !item.completed } : item
                                      );
                                      onUpdateTask(task.id, { subtasks: updatedSt });
                                    }}
                                    className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer hover:text-white"
                                  >
                                    <div
                                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                                        st.completed
                                          ? 'bg-emerald-500/80 border-emerald-500 text-black'
                                          : 'border-slate-600'
                                      }`}
                                    >
                                      {st.completed && <Check className="w-2.5 h-2.5" />}
                                    </div>
                                    <span className={st.completed ? 'line-through text-slate-500' : ''}>
                                      {st.title}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingTask(task)}
                            className="p-1.5 rounded hover:bg-[#131929] text-slate-400 hover:text-[#00f0ff] transition-colors"
                            title="Modificar tarea"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteTask(task.id)}
                            className="p-1.5 rounded hover:bg-[#131929] text-slate-400 hover:text-red-400 transition-colors"
                            title="Eliminar tarea"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CALENDARIO DE EVENTOS & AGENDA AVANZADA */}
          {activeTab === 'calendar' && (
            <div className="space-y-4">
              {/* Top Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#0b0e17] border border-[#1e2638]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#00f0ff]" />
                    Sincronización Bidireccional:
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    Google · Outlook · Apple Calendar
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Hidden File Input for ICS Import */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportICSFile}
                    accept=".ics,text/calendar"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141a29] hover:bg-[#1a233b] border border-[#00f0ff]/40 text-[#00f0ff] text-xs font-semibold transition-colors"
                    title="Importa eventos desde un archivo .ics generado en Google, Outlook o Apple Calendar"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    <span>Importar .ICS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadICSFile(events, tasks)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#131929] hover:bg-[#1a233b] border border-[#1e2638] text-slate-200 text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Exportar .ICS Completo</span>
                  </button>
                </div>
              </div>

              {importStatusMessage && (
                <div className="p-2.5 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] text-xs flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00f0ff]" />
                  <span>{importStatusMessage}</span>
                </div>
              )}

              {/* Complex Event Creator Form */}
              <form onSubmit={handleCreateEvent} className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-white font-semibold">
                  <span className="text-[#b026ff] flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4" />
                    Programación Avanzada de Cita o Reunión Compleja
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    RFC 5545 Multi-Provider
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="Título de la reunión o evento..."
                    className="sm:col-span-2 bg-[#06080d] border border-[#1e2638] focus:border-[#b026ff] rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />

                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="bg-[#06080d] border border-[#1e2638] focus:border-[#b026ff] rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />

                  <div className="flex gap-1">
                    <input
                      type="time"
                      value={newEventTime}
                      onChange={(e) => setNewEventTime(e.target.value)}
                      title="Hora de Inicio"
                      className="w-1/2 bg-[#06080d] border border-[#1e2638] focus:border-[#b026ff] rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                    <input
                      type="time"
                      value={newEventEndTime}
                      onChange={(e) => setNewEventEndTime(e.target.value)}
                      title="Hora de Fin"
                      className="w-1/2 bg-[#06080d] border border-[#1e2638] focus:border-[#b026ff] rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Additional Complex Event Options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    placeholder="Ubicación (ej: Sala de Conferencias o Enlace)..."
                    className="bg-[#06080d] border border-[#1e2638] focus:border-[#b026ff] rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />

                  <input
                    type="text"
                    value={newEventAttendees}
                    onChange={(e) => setNewEventAttendees(e.target.value)}
                    placeholder="Asistentes (correos separados por comas)..."
                    className="bg-[#06080d] border border-[#1e2638] focus:border-[#b026ff] rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />

                  <div className="flex gap-2">
                    <select
                      value={newEventCategory}
                      onChange={(e) => setNewEventCategory(e.target.value as any)}
                      className="w-1/2 bg-[#06080d] border border-[#1e2638] focus:border-[#b026ff] rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="reunion">Reunión</option>
                      <option value="tarea">Tarea</option>
                      <option value="llamada">Llamada</option>
                      <option value="personal">Personal</option>
                      <option value="sistema">Sistema</option>
                    </select>

                    <select
                      value={newEventRecurrence}
                      onChange={(e) => setNewEventRecurrence(e.target.value as any)}
                      className="w-1/2 bg-[#06080d] border border-[#1e2638] focus:border-[#b026ff] rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="none">Puntual</option>
                      <option value="daily">Diaria</option>
                      <option value="weekdays">Laborables</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensual</option>
                    </select>
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  placeholder="Notas adicionales, temario o descripción del evento..."
                  className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#b026ff] rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none resize-none"
                />

                {/* LIVE SCHEDULING CONFLICT DETECTION & RESOLUTION WARNING */}
                {conflictAnalysis.hasConflict && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{conflictAnalysis.message}</span>
                    </div>

                    {conflictAnalysis.suggestedSlots.length > 0 && (
                      <div className="pt-1 border-t border-amber-500/20">
                        <span className="text-[11px] text-slate-300 block mb-1">
                          Horarios alternativos sin solapamiento calculados:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {conflictAnalysis.suggestedSlots.map((slot, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleAutoResolveConflict(slot)}
                              className="px-2.5 py-1 rounded bg-[#0b0e17] border border-amber-500/50 hover:bg-amber-500/20 text-amber-200 text-[11px] flex items-center gap-1 transition-colors"
                            >
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>{slot.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={!newEventTitle.trim()}
                    className="px-5 py-2 rounded-lg bg-[#b026ff] hover:bg-[#9b15ea] text-white font-semibold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(176,38,255,0.4)] disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Guardar Cita en Agenda</span>
                  </button>
                </div>
              </form>

              {/* Combined Agenda List with Provider Actions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300 font-semibold px-1">
                  <span>Agenda Completa ({events.length} citas programadas)</span>
                  <span className="text-[11px] text-slate-400">
                    Sincronización multi-proveedor con 1-clic
                  </span>
                </div>

                {events.length === 0 ? (
                  <div className="p-8 text-center bg-[#0b0e17] rounded-xl border border-[#1e2638] text-slate-500">
                    No hay eventos programados en el calendario. Dicta por voz "Nuevo evento reunión mañana a las 11:00" para programar.
                  </div>
                ) : (
                  events.map((event) => {
                    const isConflictResolved = event.syncStatus === 'conflict_resolved' || Boolean(event.conflictNote);
                    const googleUrl = generateGoogleCalendarUrl(event);
                    const outlookUrl = generateOutlookCalendarUrl(event);

                    const handleDownloadApple = () => {
                      const icsContent = generateAppleCalendarICS(event);
                      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}_apple.ics`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    };

                    return (
                      <div
                        key={event.id}
                        className={`p-3.5 rounded-xl bg-[#0b0e17] border ${
                          isConflictResolved
                            ? 'border-amber-500/40 hover:border-amber-500'
                            : 'border-[#1e2638] hover:border-[#b026ff]/50'
                        } flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-lg bg-[#131929] border border-[#b026ff]/30 flex flex-col items-center justify-center text-center shrink-0">
                            <span className="text-[9px] text-[#b026ff] uppercase font-bold">
                              {new Date(event.date).toLocaleDateString('es-ES', { month: 'short' })}
                            </span>
                            <span className="text-sm font-bold text-white leading-none">
                              {event.date.split('-')[2] || '01'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-100 text-sm">
                                {event.title}
                              </span>

                              {/* Source Badge */}
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                                  event.source === 'google'
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                    : event.source === 'outlook'
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                                    : event.source === 'apple'
                                    ? 'bg-slate-400/20 text-slate-200 border border-slate-400/40'
                                    : 'bg-[#b026ff]/20 text-[#b026ff] border border-[#b026ff]/40'
                                }`}
                              >
                                {event.source === 'vvc_liam' || event.source === 'vvc_liam_core' || !event.source
                                  ? 'VVC LIAM CORE'
                                  : event.source.toUpperCase()}
                              </span>

                              {/* Conflict Resolved Note */}
                              {isConflictResolved && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                                  <Clock className="w-2.5 h-2.5" />
                                  Conflicto Resuelto
                                </span>
                              )}

                              {event.recurrence && event.recurrence !== 'none' && (
                                <span className="text-[9px] bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Repeat className="w-2.5 h-2.5" />
                                  {event.recurrence}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                              <span className="text-[#00f0ff] font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {event.time} {event.endTime ? ` - ${event.endTime}` : ''}
                              </span>
                              {event.location && <span>· {event.location}</span>}
                              {event.attendees && event.attendees.length > 0 && (
                                <span className="text-slate-300 flex items-center gap-1">
                                  <Users className="w-3 h-3 text-[#b026ff]" />
                                  {event.attendees.length} {event.attendees.length === 1 ? 'asistente' : 'asistentes'}
                                </span>
                              )}
                            </div>

                            {event.conflictNote && (
                              <p className="text-[10px] text-amber-300/90 italic">
                                {event.conflictNote}
                              </p>
                            )}

                            {event.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-1">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 1-Click Multi-provider Sync Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <a
                            href={googleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-[#141a29] hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                            title="Agendar en Google Calendar"
                          >
                            <CalendarIcon className="w-3 h-3" />
                            <span>Google</span>
                          </a>

                          <a
                            href={outlookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-[#141a29] hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                            title="Agendar en Microsoft Outlook"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Outlook</span>
                          </a>

                          <button
                            type="button"
                            onClick={handleDownloadApple}
                            className="p-1.5 rounded-lg bg-[#141a29] hover:bg-slate-700 text-slate-200 border border-slate-600/40 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                            title="Descargar evento para Apple Calendar (.ics)"
                          >
                            <Download className="w-3 h-3" />
                            <span>Apple</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteEvent(event.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-[#141a29] transition-colors ml-1"
                            title="Eliminar cita"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: GOOGLE CALENDAR EN VIVO (API V3) */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              {/* Google Status Header */}
              <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarIcon className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-bold text-white text-xs">
                      Google Calendar (API v3 Sincronización en Directo)
                    </h4>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                      {currentUser ? 'CUENTA VINCULADA' : 'REQUIERE INICIO DE SESIÓN'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    Consulta, agenda y gestiona eventos en tiempo real directamente en tu calendario principal de Google.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {currentUser ? (
                    <button
                      type="button"
                      onClick={fetchGoogleEvents}
                      disabled={isLoadingGoogle}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGoogle ? 'animate-spin' : ''}`} />
                      <span>Actualizar Eventos</span>
                    </button>
                  ) : onSignInGoogle ? (
                    <button
                      type="button"
                      onClick={onSignInGoogle}
                      className="px-3 py-1.5 rounded-lg bg-[#00f0ff] hover:bg-[#00c8d7] text-black text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                    >
                      Acceder con Google
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Status messages */}
              {googleError && (
                <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{googleError}</span>
                </div>
              )}
              {googleSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{googleSuccess}</span>
                </div>
              )}

              {/* Direct Event Creation in Google Calendar */}
              {currentUser && (
                <form
                  onSubmit={handleCreateGoogleDirectEvent}
                  className="bg-[#0b0e17] border border-emerald-500/30 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <h5 className="font-bold text-white text-xs">Agendar Directamente en Google Calendar</h5>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Título del evento en Google..."
                      value={gDirectTitle}
                      onChange={(e) => setGDirectTitle(e.target.value)}
                      required
                      className="sm:col-span-2 bg-[#06080d] border border-[#1e2638] focus:border-emerald-400 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <input
                      type="date"
                      value={gDirectDate}
                      onChange={(e) => setGDirectDate(e.target.value)}
                      required
                      className="bg-[#06080d] border border-[#1e2638] focus:border-emerald-400 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <div className="flex gap-1">
                      <input
                        type="time"
                        value={gDirectTime}
                        onChange={(e) => setGDirectTime(e.target.value)}
                        required
                        className="w-1/2 bg-[#06080d] border border-[#1e2638] focus:border-emerald-400 rounded px-1.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <input
                        type="time"
                        value={gDirectEndTime}
                        onChange={(e) => setGDirectEndTime(e.target.value)}
                        required
                        className="w-1/2 bg-[#06080d] border border-[#1e2638] focus:border-emerald-400 rounded px-1.5 py-1.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Descripción u orden del día opcional..."
                      value={gDirectDesc}
                      onChange={(e) => setGDirectDesc(e.target.value)}
                      className="flex-1 bg-[#06080d] border border-[#1e2638] focus:border-emerald-400 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isLoadingGoogle}
                      className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shrink-0 transition-colors shadow-[0_0_10px_rgba(52,211,153,0.3)]"
                    >
                      {isLoadingGoogle ? 'Guardando...' : 'Crear en Google'}
                    </button>
                  </div>
                </form>
              )}

              {/* List of Live Google Calendar Events */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Eventos próximos en tu Google Calendar ({googleEvents.length})</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Sincronización segura v3
                  </span>
                </div>

                {googleEvents.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 border border-dashed border-[#1e2638] rounded-xl">
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-400" />
                    <p>No hay eventos cargados de Google Calendar</p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      {currentUser
                        ? 'Presiona "Actualizar Eventos" para consultar tu agenda en la nube.'
                        : 'Inicia sesión con Google para acceder a tus eventos.'}
                    </p>
                  </div>
                ) : (
                  googleEvents.map((gev) => (
                    <div
                      key={gev.id}
                      className="p-3 rounded-xl bg-[#0b0e17] border border-[#1e2638] hover:border-emerald-500/40 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs truncate">{gev.summary}</span>
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            Google Cloud
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                          <span className="text-cyan-400">
                            {gev.start.dateTime
                              ? new Date(gev.start.dateTime).toLocaleString([], {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : gev.start.date || 'Todo el día'}
                          </span>
                          {gev.location && <span className="text-slate-500 truncate">📍 {gev.location}</span>}
                        </div>
                        {gev.description && (
                          <p className="text-[10px] text-slate-500 mt-1 truncate">{gev.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {gev.htmlLink && (
                          <a
                            href={gev.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-[#141a29] hover:bg-[#1a233b] text-cyan-400 border border-[#1e2638] text-[10px] font-semibold flex items-center gap-1"
                            title="Ver en Google Calendar"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Abrir</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => setGoogleEventToDelete(gev)}
                          className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-[#141a29] transition-colors"
                          title="Eliminar evento de Google Calendar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: INTEGRACIONES CLOUD & TERCEROS */}
          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Share2 className="w-4 h-4 text-[#ff2a5f]" />
                  <h4 className="font-bold text-white text-xs">
                    Integración con Aplicaciones de Terceros & Webhooks
                  </h4>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  VVC LIAM CORE permite enviar eventos en tiempo real hacia Google Calendar, Notion, Todoist, Slack, Discord o cualquier servidor mediante Webhook HTTPS con cifrado seguro.
                </p>
              </div>

              {/* Integrations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Google Calendar / Workspace */}
                <div className="p-4 rounded-xl bg-[#0b0e17] border border-[#1e2638] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                        <CalendarIcon className="w-4 h-4 text-[#00f0ff]" />
                        Google Calendar
                      </span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        CONECTADO
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Exportación de calendario estándar RFC 5545 compatible con Google Calendar, Apple Calendar y Microsoft Outlook.
                    </p>
                  </div>
                  <button
                    onClick={() => downloadICSFile(events, tasks)}
                    className="w-full py-2 rounded bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar .ics para Google Calendar</span>
                  </button>
                </div>

                {/* 2. Notion Workspace */}
                <div className="p-4 rounded-xl bg-[#0b0e17] border border-[#1e2638] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-[#b026ff]" />
                        Notion Workspace
                      </span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        ACTIVO
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Mapeo bidireccional de tareas, niveles de urgencia y subtareas hacia bases de datos de Notion.
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 bg-[#07090e] p-2 rounded border border-[#1e2638]">
                    Base de Datos: [VVC LIAM CORE Primary Tasks Hub]
                  </div>
                </div>

                {/* 3. Todoist Cloud */}
                <div className="p-4 rounded-xl bg-[#0b0e17] border border-[#1e2638] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                        <ListChecks className="w-4 h-4 text-red-400" />
                        Todoist Real-Time Task Flow
                      </span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        SINCRONIZADO
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Sincronización de prioridades P1, P2 y recordatorios vocales directos con la bandeja de entrada de Todoist.
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 bg-[#07090e] p-2 rounded border border-[#1e2638]">
                    Bandeja: Proyecto [Operaciones Inmediatas]
                  </div>
                </div>

                {/* 4. Slack / Custom Webhooks */}
                <div className="p-4 rounded-xl bg-[#0b0e17] border border-[#1e2638] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                        <Share2 className="w-4 h-4 text-[#ff2a5f]" />
                        Slack / Custom Webhooks
                      </span>
                      <span className="text-[10px] text-[#00f0ff] bg-[#00f0ff]/10 px-2 py-0.5 rounded border border-[#00f0ff]/30">
                        CONFIGURABLE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2">
                      Dispara un webhook HTTP POST con el payload JSON cada vez que se cree o venza una tarea.
                    </p>
                    <input
                      type="url"
                      value={thirdPartyWebhookUrl}
                      onChange={(e) => onUpdateWebhookUrl(e.target.value)}
                      placeholder="https://hooks.slack.com/services/... o Zapier"
                      className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#ff2a5f] rounded px-2.5 py-1 text-[11px] text-slate-100 focus:outline-none mb-2"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTestWebhook}
                      className="flex-1 py-1.5 rounded bg-[#ff2a5f]/15 hover:bg-[#ff2a5f]/25 text-[#ff2a5f] border border-[#ff2a5f]/40 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Probar Disparo Webhook</span>
                    </button>
                  </div>
                  {testWebhookStatus && (
                    <div className="text-[10px] text-[#00f0ff] mt-1.5 animate-fade-in text-center">
                      {testWebhookStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Inline Task Modification Modal */}
        {editingTask && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-[#0a0e1a] border border-[#00f0ff] rounded-2xl p-5 shadow-[0_0_40px_rgba(0,240,255,0.25)] space-y-4">
              <div className="flex items-center justify-between border-b border-[#1e2638] pb-3">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-[#00f0ff]" />
                  Modificar Tarea / Recordatorio
                </span>
                <button
                  onClick={() => setEditingTask(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Título:</label>
                  <input
                    type="text"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Fecha:</label>
                    <input
                      type="date"
                      value={editingTask.dueDate}
                      onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                      className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Hora de Notificación:</label>
                    <input
                      type="time"
                      value={editingTask.timeDue}
                      onChange={(e) => setEditingTask({ ...editingTask, timeDue: e.target.value })}
                      className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Prioridad:</label>
                    <select
                      value={editingTask.priority}
                      onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as any })}
                      className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="critica">Crítica</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Recurrencia:</label>
                    <select
                      value={editingTask.recurrence}
                      onChange={(e) => setEditingTask({ ...editingTask, recurrence: e.target.value as any })}
                      className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="none">Sin recurrencia</option>
                      <option value="daily">Diaria</option>
                      <option value="weekdays">Días laborables</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensual</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e2638]">
                <button
                  onClick={() => setEditingTask(null)}
                  className="px-3 py-1.5 rounded bg-[#131929] hover:bg-[#1a233b] text-slate-300 text-xs font-mono"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    onUpdateTask(editingTask.id, {
                      title: editingTask.title,
                      dueDate: editingTask.dueDate,
                      timeDue: editingTask.timeDue,
                      priority: editingTask.priority,
                      recurrence: editingTask.recurrence,
                    });
                    setEditingTask(null);
                  }}
                  className="px-4 py-1.5 rounded bg-[#00f0ff] text-black font-semibold text-xs font-mono shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                >
                  Guardar Modificación
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Explicit confirmation modal for deleting Google Calendar events */}
        {googleEventToDelete && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0b0e17] border border-red-500/50 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-[0_0_30px_rgba(255,42,95,0.3)]">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <h4 className="font-bold text-white text-sm">¿Eliminar evento de Google Calendar?</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente el evento{' '}
                <strong className="text-white">"{googleEventToDelete.summary}"</strong> de tu calendario de Google?
                Esta acción no se puede deshacer.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGoogleEventToDelete(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#141a29] hover:bg-[#1a233b] text-slate-300 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteGoogleEvent}
                  disabled={isLoadingGoogle}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                >
                  {isLoadingGoogle ? 'Eliminando...' : 'Eliminar de Google'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
