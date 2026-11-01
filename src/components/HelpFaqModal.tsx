import { NOTIFICATIONS_DISABLED_MESSAGE } from '../shared/notificationPolicy';
import React, { useState, useMemo } from 'react';
import {
  HelpCircle,
  Search,
  X,
  Keyboard,
  Mic,
  Calendar,
  FileText,
  Users,
  Shield,
  Cloud,
  Cpu,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Play,
  Copy,
  Check,
  Zap,
  Terminal,
  Activity,
  Phone,
  MessageSquare,
  Lock,
  Smartphone,
  ExternalLink,
  Flame,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';

interface HelpFaqModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand: (commandText: string) => void;
  onOpenAgents?: () => void;
  onOpenCalendar?: () => void;
  onOpenDocs?: () => void;
  onOpenContacts?: () => void;
  onOpenTelemetry?: () => void;
  onOpenVault?: () => void;
  onOpenSettings?: () => void;
}

interface ShortcutItem {
  keys: string[];
  action: string;
  category: 'navegacion' | 'comandos' | 'audio' | 'modales';
  description: string;
}

interface VoiceCommandExample {
  title: string;
  command: string;
  category: 'agenda' | 'docs' | 'contactos' | 'agentes' | 'dispositivo' | 'temas';
  purpose: string;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'workspace' | 'firebase' | 'ia' | 'seguridad' | 'offline';
  badge?: string;
}

const KEYBOARD_SHORTCUTS: ShortcutItem[] = [
  {
    keys: ['?', 'o', 'F1'],
    action: 'Abrir Centro de Ayuda & FAQ',
    category: 'navegacion',
    description: 'Despliega este manual interactivo de funciones, atajos y preguntas frecuentes.',
  },
  {
    keys: ['Ctrl', 'K'],
    action: 'Enfocar Consola de Comandos',
    category: 'comandos',
    description: 'Sitúa el cursor directamente en la caja de comandos del sistema.',
  },
  {
    keys: ['Esc'],
    action: 'Cerrar Modal Activo',
    category: 'modales',
    description: 'Cierra cualquier ventana emergente, panel lateral o menú desplegable.',
  },
  {
    keys: ['Alt', 'C'],
    action: 'Abrir Agenda & Calendario',
    category: 'navegacion',
    description: 'Acceso directo a la agenda, Google Calendar v3, tareas y resolución de conflictos.',
  },
  {
    keys: ['Alt', 'D'],
    action: 'Abrir Estudio Docs & PDF',
    category: 'navegacion',
    description: 'Accede al editor de documentos de texto, hojas de cálculo y Google Docs en la nube.',
  },
  {
    keys: ['Alt', 'U'],
    action: 'Abrir Directorio de Contactos',
    category: 'navegacion',
    description: 'Abre la libreta de contactos sincronizada con Google People API.',
  },
  {
    keys: ['Alt', 'A'],
    action: 'Abrir Matriz de Agentes',
    category: 'navegacion',
    description: 'Gestiona la orquestación VAOS de Vladimir, Valentina y Victoria.',
  },
  {
    keys: ['Alt', 'T'],
    action: 'Panel de Telemetría D3.js',
    category: 'navegacion',
    description: 'Visualiza latencia en milisegundos, tokens/seg y recursos del dispositivo.',
  },
  {
    keys: ['Alt', 'M'],
    action: 'Silenciar / Activar Voz',
    category: 'audio',
    description: 'Alterna instantáneamente la respuesta de síntesis vocal Kokoro TTS.',
  },
  {
    keys: ['Alt', 'O'],
    action: 'Alternar Modo Online / Offline',
    category: 'comandos',
    description: 'Fuerza la conmutación entre inferencia NVIDIA Cloud y motor local RT-Lite.',
  },
];

const VOICE_COMMANDS: VoiceCommandExample[] = [
  {
    title: 'Nueva Reunión en Google Calendar',
    command: 'Agendar reunión de arquitectura mañana a las 11:00 hasta las 12:30',
    category: 'agenda',
    purpose: 'Crea el evento, verifica solapamientos y lo prepara para Google Calendar.',
  },
  {
    title: 'Resolver Conflictos de Horario',
    command: 'Comprobar y resolver conflictos en el calendario',
    category: 'agenda',
    purpose: 'Ejecuta el algoritmo de optimización horaria y reubica solapamientos.',
  },
  {
    title: 'Crear Tarea con Prioridad',
    command: 'Crear tarea urgente revisar presupuesto para mañana a las 10:00',
    category: 'agenda',
    purpose: 'Añade una tarea crítica. Las notificaciones push y locales están deshabilitadas.',
  },
  {
    title: 'Posponer Recordatorio',
    command: 'Posponer recordatorio 10 minutos',
    category: 'agenda',
    purpose: 'Aplaza la alerta temporalmente reprogramando el temporizador nativo.',
  },
  {
    title: 'Generar Informe y Exportar a PDF',
    command: 'Generar documento de texto sobre Informe de Operaciones y exportar a PDF',
    category: 'docs',
    purpose: 'Abre el estudio de documentos y redacta el informe listo para descarga.',
  },
  {
    title: 'Crear Hoja de Cálculo',
    command: 'Crear hoja de cálculo de Presupuesto y Recursos',
    category: 'docs',
    purpose: 'Genera tabla con partidas, cálculo automático de balance y totales.',
  },
  {
    title: 'Abrir Google Docs en la Nube',
    command: 'Abrir Google Docs',
    category: 'docs',
    purpose: 'Explora y carga documentos directamente desde tu cuenta de Google Drive.',
  },
  {
    title: 'Llamar a un Contacto',
    command: 'Llamar a Carlos Méndez',
    category: 'contactos',
    purpose: 'Inicia el marcador táctico y establece la llamada con el contacto guardado.',
  },
  {
    title: 'Enviar Mensaje WhatsApp',
    command: 'WhatsApp a María: Llego en 15 minutos con los reportes de la reunión',
    category: 'contactos',
    purpose: 'Prepara el payload de mensajería cifrada listo para confirmación.',
  },
  {
    title: 'Abrir Directorio de Contactos',
    command: 'Abrir contactos',
    category: 'contactos',
    purpose: 'Despliega la libreta sincronizada con Google People API v1.',
  },
  {
    title: 'Activar Agente Vladimir (OSINT)',
    command: 'Vladimir ejecutar análisis OSINT y reconocimiento táctico',
    category: 'agentes',
    purpose: 'Conmuta la directiva operativa hacia ciberdefensa e investigación analítica.',
  },
  {
    title: 'Abrir Matriz de Agentes',
    command: 'Abrir matriz de agentes especializados',
    category: 'agentes',
    purpose: 'Despliega el configurador JSON y árbol de agentes autónomos.',
  },
  {
    title: 'Ver Telemetría D3.js',
    command: 'Abrir telemetría y rendimiento VAOS',
    category: 'agentes',
    purpose: 'Muestra gráficos en tiempo real con D3.js de carga de inferencia y batería.',
  },
  {
    title: 'Control de Hardware (Linterna)',
    command: 'Encender linterna',
    category: 'dispositivo',
    purpose: 'Activa la antorcha física de la cámara o el flash estroboscópico de pantalla.',
  },
  {
    title: 'Verificar Estado de Batería',
    command: 'Consultar nivel de batería',
    category: 'dispositivo',
    purpose: 'Informa por voz sobre el porcentaje y estado de carga del terminal.',
  },
  {
    title: 'Cambiar Tema Visual',
    command: 'Cambiar tema a Amber Terminal',
    category: 'temas',
    purpose: 'Modifica al instante las variables CSS del entorno a fósforo ámbar CRT.',
  },
  {
    title: 'Verificar Firebase Firestore',
    command: 'Verificar sincronización con Firebase',
    category: 'dispositivo',
    purpose: 'Comprueba el canal en tiempo real y persistencia en la nube.',
  },
];

const FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'offline',
    badge: 'Arquitectura',
    question: '¿Cómo funciona la aplicación si no tengo conexión a Internet o estoy en modo avión?',
    answer:
      'VVC LIAM CORE implementa una arquitectura híbrida de doble motor. Si la conexión se interrumpe o activas el botón OFFLINE, el sistema activa automáticamente el motor RT-Lite On-Device. Este motor ejecuta el analizador de intenciones en el navegador, permitiendo crear tareas, buscar contactos locales, operar la bóveda cifrada, calcular conflictos de agenda y usar síntesis de voz sin consumir datos ni depender de servidores externos.',
  },
  {
    id: 'faq-2',
    category: 'workspace',
    badge: 'Google Workspace',
    question: '¿Cómo se integran Google Calendar, Google Docs y Google Contacts?',
    answer:
      'La integración utiliza el estándar OAuth 2.0 de Google con ámbitos (scopes) granulares aprobados por ti. No se envían credenciales secretas a servidores externos; las peticiones a la API de Calendar (v3), Docs, Drive y People API (Contactos) se ejecutan directamente desde el cliente con tu token autorizado en memoria, garantizando privacidad absoluta.',
  },
  {
    id: 'faq-3',
    category: 'firebase',
    badge: 'Cloud Firestore',
    question: '¿Qué información se guarda en Firebase Firestore y cómo se protege?',
    answer:
      'Firestore almacena de forma persistente tus tareas, eventos de calendario y preferencias de perfil en la región us-east1. El acceso está blindado por reglas de seguridad de Firestore (firestore.rules) que aplican aislamiento estricto: únicamente tu usuario autenticado (request.auth.uid == userId) tiene permisos de lectura y escritura sobre su propia subcolección.',
  },
  {
    id: 'faq-4',
    category: 'workspace',
    badge: 'Multi-Plataforma',
    question: '¿Puedo sincronizar mis eventos con Outlook, Apple Calendar o Notion?',
    answer:
      'Sí. La Agenda genera enlaces directos para Microsoft Outlook Web y Google Calendar, y además cuenta con un generador de archivos estándar RFC 5545 iCalendar (.ics) compatible con Apple Calendar (macOS e iOS), Thunderbird y Notion Calendar. También puedes importar archivos .ics externos arrastrándolos directamente a la pestaña de exportación.',
  },
  {
    id: 'faq-5',
    category: 'ia',
    badge: 'VAOS Matrix',
    question: '¿Qué diferencias hay entre los 3 agentes exclusivos (Vladimir, Valentina, Victoria)?',
    answer:
      'Cada agente cuenta con un prompt de sistema especializado y parámetros de inferencia calibrados:\n• Vladimir (Ciberdefensa & OSINT): Orientado a investigación forense, análisis táctico, reconocimiento de datos y protección criptográfica.\n• Valentina (Legal & Compliance): Especializada en análisis normativo, contratos, términos de servicio y gobernanza algorítmica.\n• Victoria (Finanzas & Quant): Diseñada para presupuestos, proyecciones financieras, análisis de riesgo y estructuración de balances.',
  },
  {
    id: 'faq-6',
    category: 'general',
    badge: 'Documentos',
    question: '¿Cómo exporto mis documentos y hojas de cálculo a PDF?',
    answer:
      'En el modal "Docs & PDF", puedes generar informes ejecutivos o planillas de cálculo. Al pulsar el botón "Exportar a PDF", el motor compila el contenido con diseño tipográfico profesional de alta resolución, marcas de agua criptográficas y cálculo de totales, abriendo el diálogo de guardado/impresión nativo del sistema.',
  },
  {
    id: 'faq-7',
    category: 'seguridad',
    badge: 'E2EE Vault',
    question: '¿Qué tan segura es la Bóveda Cifrada E2EE?',
    answer:
      'Los elementos de la Bóveda (contraseñas, credenciales de API, notas de máxima seguridad) se cifran localmente mediante tu Frase Maestra. Si cierras la sesión o borras los datos del navegador, nadie puede descifrar los registros sin la frase maestra exacta.',
  },
  {
    id: 'faq-8',
    category: 'general',
    badge: 'Android / PWA',
    question: '¿Cómo instalo la aplicación como App nativa o APK en mi dispositivo móvil?',
    answer:
      'Pulsa el botón "Instalar App / APK" en la barra superior. La aplicación es una PWA (Progressive Web App) certificada con Service Worker. Puedes añadirla directamente a tu pantalla de inicio en Android o iOS, o compilar el paquete APK siguiendo la guía paso a paso incluida en el modal de instalación.',
  },
  {
    id: 'faq-9',
    category: 'ia',
    badge: 'NVIDIA Build',
    question: '¿Cómo configuro mi clave de API de NVIDIA o modelos personalizados?',
    answer:
      'Abre el modal de "Configuración" (icono de controles en el encabezado). En la sección "Parámetros de Inferencia", puedes ingresar tu API Key de NVIDIA para acceder a modelos de 70B+ parámetros, o definir un endpoint compatible con OpenAI/vLLM para servidores locales.',
  },
  {
    id: 'faq-10',
    category: 'workspace',
    badge: 'Push Notifications',
    question: '¿Cómo funcionan las alertas en segundo plano cuando la app está minimizada?',
    answer:
      NOTIFICATIONS_DISABLED_MESSAGE + ' La agenda y el cronómetro siguen disponibles; no se emiten avisos de tareas o temporizadores. Una instalación antigua sin actualizar puede conservar código anterior.',
  },
];

export const HelpFaqModal: React.FC<HelpFaqModalProps> = ({
  isOpen,
  onClose,
  onExecuteCommand,
  onOpenAgents,
  onOpenCalendar,
  onOpenDocs,
  onOpenContacts,
  onOpenTelemetry,
  onOpenVault,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'funciones' | 'atajos' | 'faqs' | 'arquitectura'>('funciones');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<string>('todas');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-1');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filtered Shortcuts
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return KEYBOARD_SHORTCUTS;
    const q = searchQuery.toLowerCase();
    return KEYBOARD_SHORTCUTS.filter(
      (s) =>
        s.action.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.keys.join(' ').toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Filtered Voice Commands
  const filteredVoiceCommands = useMemo(() => {
    if (!searchQuery.trim()) return VOICE_COMMANDS;
    const q = searchQuery.toLowerCase();
    return VOICE_COMMANDS.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.command.toLowerCase().includes(q) ||
        v.purpose.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    return FAQS.filter((f) => {
      const matchesCategory = selectedFaqCategory === 'todas' || f.category === selectedFaqCategory;
      if (!matchesCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        (f.badge && f.badge.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, selectedFaqCategory]);

  const handleCopyCommand = (cmd: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cmd);
    setCopiedCommand(cmd);
    setTimeout(() => setCopiedCommand(null), 2500);
  };

  const handleRunCommand = (cmd: string) => {
    onClose();
    onExecuteCommand(cmd);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="w-full max-w-5xl max-h-[92vh] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text-primary)]">
        {/* Header Zone */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--tag-bg)] border border-[var(--primary-accent)]/40 flex items-center justify-center text-[var(--primary-accent)] shadow-[0_0_15px_rgba(0,240,255,0.25)] shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide font-mono flex items-center gap-2">
                  <span>CENTRO DE AYUDA & GUÍA OPERATIVA</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--tag-bg)] text-[var(--primary-accent)] border border-[var(--primary-accent)]/30 font-mono font-semibold">
                    MANUAL VVC-LIAM
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Directorio integral de funciones, atajos de teclado, comandos de voz en lenguaje natural y preguntas frecuentes.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[var(--bg-card)] transition-colors border border-transparent hover:border-[var(--border-subtle)] cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Navigation Bar */}
        <div className="px-6 py-3 bg-[#080c14] border-b border-[var(--border-subtle)] flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Main Tab Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0d121e] border border-[#1e2638] w-full md:w-auto overflow-x-auto text-xs font-mono">
            <button
              onClick={() => setActiveTab('funciones')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'funciones'
                  ? 'bg-[var(--primary-accent)] text-black font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Funcionalidades ({10})</span>
            </button>

            <button
              onClick={() => setActiveTab('atajos')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'atajos'
                  ? 'bg-[var(--primary-accent)] text-black font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Atajos & Voz ({KEYBOARD_SHORTCUTS.length + VOICE_COMMANDS.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('faqs')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'faqs'
                  ? 'bg-[var(--primary-accent)] text-black font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Preguntas Frecuentes ({FAQS.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('arquitectura')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'arquitectura'
                  ? 'bg-[var(--primary-accent)] text-black font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Arquitectura VAOS</span>
            </button>
          </div>

          {/* Quick Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar función, atajo o FAQ..."
              className="w-full bg-[#0d121e] border border-[#1e2638] focus:border-[var(--primary-accent)] rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: FUNCIONALIDADES DEL SISTEMA */}
          {activeTab === 'funciones' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2638] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--primary-accent)]/10 text-[var(--primary-accent)] flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                      Resumen de Módulos Operativos Activos
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      VVC LIAM CORE orquesta 10 subsistemas integrados en tiempo real con persistencia en la nube y ejecución offline.
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid of Functional Modules */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Google Workspace Suite */}
                <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2638] hover:border-emerald-500/40 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-white font-mono">Google Workspace & Cloud</h4>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-semibold">
                      API v3 & People
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Sincronización en directo con <strong className="text-slate-200">Google Calendar</strong> (agenda eventos reales sin enlaces externos), <strong className="text-slate-200">Google Docs</strong> (lee y redacta documentos en Drive), <strong className="text-slate-200">Google Contacts</strong> (People API v1 con llamadas y mensajería directa), y explorador <strong className="text-slate-200">Drive Picker</strong>.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    {onOpenCalendar && (
                      <button
                        onClick={() => { onClose(); onOpenCalendar(); }}
                        className="text-[10px] font-mono font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Abrir Calendar</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    <span className="text-slate-600">·</span>
                    {onOpenDocs && (
                      <button
                        onClick={() => { onClose(); onOpenDocs(); }}
                        className="text-[10px] font-mono font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Abrir Docs</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    <span className="text-slate-600">·</span>
                    {onOpenContacts && (
                      <button
                        onClick={() => { onClose(); onOpenContacts(); }}
                        className="text-[10px] font-mono font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Abrir Contactos</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Firebase Firestore */}
                <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2638] hover:border-amber-500/40 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                        <Flame className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-white font-mono">Firebase Firestore en Tiempo Real</h4>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono font-semibold">
                      us-east1
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Almacenamiento persistente y reactivo para tus tareas, recordatorios programados, preferencias de interfaz y perfil. Respaldado por reglas de seguridad <code className="text-amber-300 font-mono text-[10px]">firestore.rules</code> que impiden el acceso no autorizado y aíslan los datos por usuario.
                  </p>
                  <div className="text-[10px] text-amber-400 font-mono flex items-center gap-1 pt-1">
                    <CheckCircle2 className="w-3 h-3 text-amber-400" />
                    <span>Sincronización bidireccional y persistencia offline activa</span>
                  </div>
                </div>

                {/* 3. Detección y Resolución de Conflictos */}
                <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2638] hover:border-cyan-500/40 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                        <Zap className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-white font-mono">Agenda Inteligente & Conflictos</h4>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono font-semibold">
                      RFC 5545
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Motor algorítmico que analiza solapamientos de horas antes de guardar cualquier cita. Calcula franjas libres consecutivas de 30/60 minutos y ofrece resolución automática en un solo clic, con exportación para Apple Calendar, Outlook y Google.
                  </p>
                  <div className="pt-1">
                    <button
                      onClick={() => handleRunCommand('Comprobar y resolver conflictos en el calendario')}
                      className="text-[10px] font-mono font-bold text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-2.5 h-2.5" />
                      <span>Diagnosticar agenda ahora</span>
                    </button>
                  </div>
                </div>

                {/* 4. Estudio de Documentos & Exportación PDF */}
                <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2638] hover:border-blue-500/40 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-white font-mono">Estudio de Documentos & PDF</h4>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-mono font-semibold">
                      PDF / CSV
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Generador de documentos de texto estructurados e informes de operaciones, junto con tablas de cálculo tipo hoja de presupuesto con cálculo dinámico de subtotales, totales y descarga instantánea a formato PDF o CSV.
                  </p>
                  <div className="pt-1">
                    {onOpenDocs && (
                      <button
                        onClick={() => { onClose(); onOpenDocs(); }}
                        className="text-[10px] font-mono font-bold text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Abrir Document Studio</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 5. Orquestador de Agentes VAOS */}
                <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2638] hover:border-purple-500/40 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                        <Users className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-white font-mono">Matriz de Agentes VAOS</h4>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 font-mono font-semibold">
                      JSON Custom
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Orquestación de agentes exclusivos: <strong className="text-purple-300">Vladimir</strong> (OSINT Recon), <strong className="text-purple-300">Valentina</strong> (Legal / Compliance) y <strong className="text-purple-300">Victoria</strong> (Finanzas / Quant). Permite importar y exportar agentes personalizados en formato JSON en tiempo real.
                  </p>
                  <div className="pt-1">
                    {onOpenAgents && (
                      <button
                        onClick={() => { onClose(); onOpenAgents(); }}
                        className="text-[10px] font-mono font-bold text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Gestionar Agentes</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 6. Telemetría D3.js en Tiempo Real */}
                <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2638] hover:border-[#00FF66]/40 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-[#00FF66]/10 text-[#00FF66]">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-white font-mono">Telemetría D3.js & Monitor VAOS</h4>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30 font-mono font-semibold">
                      Gráficos D3
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Panel interactivo con curvas de rendimiento en vivo: latencia de inferencia en milisegundos, tasa de tokens por segundo, consumo estimado y telemetría de hardware de la batería del dispositivo.
                  </p>
                  <div className="pt-1">
                    {onOpenTelemetry && (
                      <button
                        onClick={() => { onClose(); onOpenTelemetry(); }}
                        className="text-[10px] font-mono font-bold text-[#00FF66] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ver Telemetría en Vivo</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 7. Bóveda Cifrada E2EE */}
                <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2638] hover:border-red-500/40 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-white font-mono">Bóveda Cifrada E2EE</h4>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 font-mono font-semibold">
                      Frase Maestra
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Almacén hermético para claves privadas, tokens y credenciales sensibles con derivación criptográfica local. Ningún secreto sale descifrado a la red.
                  </p>
                  <div className="pt-1">
                    {onOpenVault && (
                      <button
                        onClick={() => { onClose(); onOpenVault(); }}
                        className="text-[10px] font-mono font-bold text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Abrir Bóveda E2EE</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 8. Telefonía Táctica & Mensajería */}
                <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2638] hover:border-yellow-500/40 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-white font-mono">Telefonía Táctica & Mensajería</h4>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 font-mono font-semibold">
                      Comunicaciones
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Marcación virtual de llamadas con temporizador, mute, altavoz y redacción rápida de mensajes por WhatsApp o SMS integrada directamente con comandos por voz en lenguaje natural.
                  </p>
                  <div className="pt-1">
                    <button
                      onClick={() => handleRunCommand('Llamar a Carlos Méndez')}
                      className="text-[10px] font-mono font-bold text-yellow-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-2.5 h-2.5" />
                      <span>Probar llamada virtual</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ATAJOS DE TECLADO & COMANDOS DE VOZ */}
          {activeTab === 'atajos' && (
            <div className="space-y-6">
              {/* Keyboard Shortcuts Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-[var(--primary-accent)]" />
                    <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                      Atajos de Teclado Físicos ({filteredShortcuts.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Pulsa '?' en cualquier momento para ver esta guía
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {filteredShortcuts.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#0a0e1a] border border-[#1e2638] flex items-center justify-between gap-3 font-mono text-xs hover:border-[var(--primary-accent)]/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-[12px]">{s.action}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{s.description}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="px-2 py-1 rounded bg-[#141b2c] border border-[#2b3956] text-[var(--primary-accent)] font-bold text-[10px] shadow-sm"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Voice & Natural Language Commands Section */}
              <div className="space-y-3 pt-4 border-t border-[#1e2638]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                      Catálogo de Comandos de Voz y Lenguaje Natural ({filteredVoiceCommands.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Haz clic en "Probar" para ejecutar cualquier comando de inmediato
                  </span>
                </div>

                <div className="space-y-2">
                  {filteredVoiceCommands.map((v, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#0a0e1a] border border-[#1e2638] hover:border-emerald-500/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{v.title}</span>
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold border border-slate-700">
                            {v.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1.5 truncate">
                          <Terminal className="w-3 h-3 shrink-0 opacity-70" />
                          <span className="truncate italic">"{v.command}"</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{v.purpose}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={(e) => handleCopyCommand(v.command, e)}
                          className="px-2 py-1 rounded bg-[#141b2c] hover:bg-slate-700 text-slate-300 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Copiar comando al portapapeles"
                        >
                          {copiedCommand === v.command ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRunCommand(v.command)}
                          className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Ejecutar este comando en el sistema"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Probar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PREGUNTAS FRECUENTES (FAQS) */}
          {activeTab === 'faqs' && (
            <div className="space-y-4">
              {/* Category Pills Filter */}
              <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[#1e2638] font-mono text-xs">
                {[
                  { id: 'todas', label: 'Todas las Categorías' },
                  { id: 'offline', label: 'Offline & Conectividad' },
                  { id: 'workspace', label: 'Google Workspace' },
                  { id: 'firebase', label: 'Firebase Firestore' },
                  { id: 'ia', label: 'Modelos & Agentes' },
                  { id: 'seguridad', label: 'Seguridad & Cifrado' },
                  { id: 'general', label: 'General & Apps' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedFaqCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      selectedFaqCategory === cat.id
                        ? 'bg-[var(--primary-accent)] text-black font-bold shadow-sm'
                        : 'bg-[#0d121e] text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* FAQ Accordions */}
              <div className="space-y-3 font-mono">
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 border border-dashed border-[#1e2638] rounded-xl">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="text-xs">No se encontraron preguntas que coincidan con la búsqueda.</p>
                    <button
                      onClick={() => { setSearchQuery(''); setSelectedFaqCategory('todas'); }}
                      className="mt-2 text-xs text-[var(--primary-accent)] underline cursor-pointer"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                ) : (
                  filteredFaqs.map((faq) => {
                    const isExpanded = expandedFaqId === faq.id;
                    return (
                      <div
                        key={faq.id}
                        className={`rounded-xl border transition-all overflow-hidden ${
                          isExpanded
                            ? 'bg-[#0a0f1d] border-[var(--primary-accent)]/50 shadow-[0_0_15px_rgba(0,240,255,0.08)]'
                            : 'bg-[#090d18] border-[#1e2638] hover:border-slate-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                          className="w-full p-4 text-left flex items-start justify-between gap-4 cursor-pointer"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="text-[10px] uppercase px-2 py-0.5 rounded font-bold bg-[#141b2c] text-[var(--primary-accent)] border border-[var(--primary-accent)]/30 shrink-0 mt-0.5">
                              {faq.badge || faq.category}
                            </span>
                            <span className="font-bold text-xs text-white leading-relaxed">
                              {faq.question}
                            </span>
                          </div>
                          <span className="p-1 rounded-lg text-slate-400 hover:text-white shrink-0 mt-0.5">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-[#1e2638]/60 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line animate-fade-in">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ARQUITECTURA VAOS */}
          {activeTab === 'arquitectura' && (
            <div className="space-y-6 font-mono text-xs">
              <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2638] space-y-2">
                <div className="flex items-center gap-2 text-[var(--primary-accent)] font-bold text-xs">
                  <Cpu className="w-4 h-4" />
                  <span>DIAGRAMA OPERATIVO DEL SISTEMA VAOS (VVC AUTONOMOUS OPERATING SYSTEM)</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Flujo de datos end-to-end con tolerancia a fallos de red y preservación estricta de la privacidad del usuario.
                </p>
              </div>

              {/* Architecture visual schema cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-[#090d18] border border-cyan-500/30 space-y-2">
                  <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                    1. Entradas Sensoriales
                  </div>
                  <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                    <li>Reconocimiento de Voz (Web Speech API)</li>
                    <li>Consola de Comandos Natural Language</li>
                    <li>Atajos de Teclado y Gestos</li>
                    <li>Chips de Acceso Táctico</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#090d18] border border-purple-500/30 space-y-2">
                  <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                    2. Enrutamiento Inteligente
                  </div>
                  <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                    <li>Parser Local RT-Lite Determinista</li>
                    <li>NVIDIA NIM Microservices (Online)</li>
                    <li>Conmutador Fallback On-Device</li>
                    <li>Matriz de Agentes Especializados</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#090d18] border border-emerald-500/30 space-y-2">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    3. Integraciones & Cloud
                  </div>
                  <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                    <li>Google Calendar API v3 (Direct)</li>
                    <li>Google Docs & Google Drive</li>
                    <li>Google Contacts (People API v1)</li>
                    <li>Firebase Firestore (us-east1)</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#090d18] border border-amber-500/30 space-y-2">
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    4. Salidas y Retroalimentación
                  </div>
                  <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                    <li>Síntesis Vocal Kokoro TTS Neural</li>
                    <li>Telemetría D3.js en Tiempo Real</li>
                    <li>Exportación RFC 5545 iCal & PDF</li>
                    <li>Notificaciones push y locales deshabilitadas</li>
                  </ul>
                </div>
              </div>

              {/* Quick links footer */}
              <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2638] flex flex-wrap items-center justify-between gap-3">
                <span className="text-slate-400 text-[11px]">
                  ¿Deseas personalizar las directivas del sistema o cambiar los parámetros de voz?
                </span>
                <div className="flex items-center gap-2">
                  {onOpenSettings && (
                    <button
                      onClick={() => { onClose(); onOpenSettings(); }}
                      className="px-3 py-1.5 rounded-lg bg-[var(--primary-accent)]/15 border border-[var(--primary-accent)]/40 hover:bg-[var(--primary-accent)]/25 text-[var(--primary-accent)] font-bold text-xs transition-colors cursor-pointer"
                    >
                      Abrir Configuración
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]/90 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3 text-slate-400">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                Esc
              </kbd>
              <span>para cerrar</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                ?
              </kbd>
              <span>para volver a abrir</span>
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[var(--primary-accent)] hover:bg-[var(--primary-accent)]/90 text-black font-bold text-xs transition-colors shadow-[0_0_10px_rgba(0,240,255,0.3)] cursor-pointer"
          >
            Entendido / Cerrar Guía
          </button>
        </div>
      </div>
    </div>
  );
};
