import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  HelpCircle,
  Mic,
  Bot,
  Calendar,
  FileText,
  Mail,
  FolderOpen,
  Compass,
  Smartphone,
  ShieldCheck,
  Terminal,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Sparkles,
  Cpu,
  Database,
  Key,
  Activity,
  Layers,
  Volume2,
  Users,
  Flame,
  Palette
} from 'lucide-react';

export interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteVoiceCommand?: (command: string) => void;
}

interface FaqItem {
  id: string;
  category: 'general' | 'agents' | 'workspace' | 'device' | 'security' | 'offline';
  question: string;
  answer: string;
  tags: string[];
}

interface VoiceShortcut {
  id: string;
  phrase: string;
  category: 'calls_messages' | 'calendar_tasks' | 'workspace' | 'agents' | 'device' | 'appearance';
  description: string;
  actionOutput: string;
}

interface SystemFeature {
  id: string;
  icon: React.ReactNode;
  title: string;
  category: string;
  summary: string;
  specs: string[];
  status: 'Activo' | 'Cloud' | 'E2EE' | 'Local';
}

const FAQ_ITEMS: FaqItem[] = [
  {"id": "faq-1", "category": "general", "question": "¿Qué implementa VVC LIAM CORE?", "answer": "Aplicación web con conversación, parser RT-Lite y generación de texto mediante proveedores configurados. VAOS clasifica solicitudes y mantiene tareas de generación en memoria; no dispone de herramientas autónomas para ejecutar acciones externas.", "tags": ["general"]},
  {"id": "faq-2", "category": "agents", "question": "¿Qué representan los perfiles Vladimir, Valentina y Victoria?", "answer": "Son perfiles de instrucciones y preferencias de modelo. Sus nombres y roles definen la personalidad, no prueban ejecución de herramientas, memoria cifrada por agente ni aislamiento especial adicional.", "tags": ["agents"]},
  {"id": "faq-3", "category": "workspace", "question": "¿Qué cobertura tiene Google Workspace?", "answer": "Hay adaptadores parciales para Gmail, Calendar, Drive/Docs y Contacts. Requieren sesión, permisos y acciones explícitas. No hay implementación de Sheets, Slides, Tasks o Meet como APIs. La integración real y el ciclo de renovación de permisos siguen pendientes de validación.", "tags": ["workspace"]},
  {"id": "faq-4", "category": "workspace", "question": "¿Qué límites tiene Firestore?", "answer": "El cliente contiene sincronización parcial y reglas fuente por UID. La reconciliación de cambios y borrados es incompleta y no se ha verificado el despliegue de las reglas. No debe asumirse sincronización completa o recuperación garantizada.", "tags": ["workspace"]},
  {"id": "faq-5", "category": "security", "question": "¿Qué protección tiene la bóveda actual?", "answer": "La utilidad usa AES-GCM y PBKDF2 en el navegador, pero la bóveda actual tiene contraseña predeterminada y datos sólo en memoria. No ofrece todavía custodia segura ni recuperación probada. Las claves API se guardan aparte en texto; el chat no tiene E2EE.", "tags": ["security"]},
  {"id": "faq-6", "category": "device", "question": "¿Qué control del dispositivo está disponible?", "answer": "La linterna depende de permisos y compatibilidad de la cámara, con alternativa de pantalla. El volumen afecta al audio de la aplicación. Wi-Fi, Bluetooth y brillo son estados visuales, sin control general del sistema. Telefonía y mensajes usan enlaces a otras aplicaciones.", "tags": ["device"]},
  {"id": "faq-7", "category": "offline", "question": "¿Qué funciona sin conexión?", "answer": "Se verificó la interfaz con caché previamente cargada y acciones locales básicas. No se garantiza arranque en frío ni voz offline. STT/TTS dependen del navegador/proveedor y las alarmas no tienen todavía un scheduler persistente.", "tags": ["offline"]},
  {"id": "faq-8", "category": "general", "question": "¿Hay aplicaciones nativas listas para distribuir?", "answer": "La entrega actual es web/PWA. Los scripts de plataforma generan web, sin APK/IPA ni binario de escritorio firmados y verificados. La instalación PWA depende del navegador; no equivale a una aplicación nativa certificada.", "tags": ["general"]}
];

const VOICE_SHORTCUTS: VoiceShortcut[] = [
  // LLAMADAS Y MENSAJES
  {
    id: 'cmd-1',
    phrase: 'Llamar a Carlos Méndez',
    category: 'calls_messages',
    description: 'Inicia el marcador telefónico o llamada táctica al contacto registrado.',
    actionOutput: 'Despliega PhoneActionModal y genera enlace tel: oficial.',
  },
  {
    id: 'cmd-2',
    phrase: 'Enviar mensaje a María diciendo Llegaré en 15 minutos',
    category: 'calls_messages',
    description: 'Abre el modal de mensajería con el destinatario y texto precargado por SMS o WhatsApp.',
    actionOutput: 'Abre MessagingModal con selección de canal y texto listo.',
  },
  {
    id: 'cmd-3',
    phrase: 'Abrir contactos',
    category: 'calls_messages',
    description: 'Despliega el directorio sincronizado con Google Contacts (People API v1).',
    actionOutput: 'Abre GoogleContactsModal con opción de importación y búsqueda.',
  },

  // CALENDARIO Y TAREAS
  {
    id: 'cmd-4',
    phrase: 'Crear tarea urgente revisar balance financiero para mañana a las 11:00',
    category: 'calendar_tasks',
    description: 'Registra una tarea con prioridad alta o crítica y fecha programada.',
    actionOutput: 'Añade la tarea a la base local y la sincroniza con Firebase Firestore.',
  },
  {
    id: 'cmd-5',
    phrase: 'Completar tarea balance financiero',
    category: 'calendar_tasks',
    description: 'Busca por similitud de texto y marca la tarea como realizada inmediatamente.',
    actionOutput: 'Actualiza estado a completada con timestamp y confirmación sonora.',
  },
  {
    id: 'cmd-6',
    phrase: 'Agendar reunión de estrategia con equipo mañana a las 15:00 hasta las 16:30',
    category: 'calendar_tasks',
    description: 'Crea un evento con detección automática de conflictos y cálculo de duración.',
    actionOutput: 'Inserta en calendario y ofrece sincronización con Google Calendar.',
  },
  {
    id: 'cmd-7',
    phrase: 'Exportar agenda a iCal',
    category: 'calendar_tasks',
    description: 'Genera y descarga un archivo .ics universal compatible con Google, Apple y Outlook.',
    actionOutput: 'Descarga instantánea de archivo .ICS estructurado.',
  },

  // GOOGLE WORKSPACE & CLOUD
  {
    id: 'cmd-8',
    phrase: 'Abrir Gmail',
    category: 'workspace',
    description: 'Abre el visor y redactor oficial de correos de Google Workspace.',
    actionOutput: 'Despliega GmailModal con bandeja de entrada e historial de hilos.',
  },
  {
    id: 'cmd-9',
    phrase: 'Enviar correo a soporte@vvc.io con asunto Reporte Semanal',
    category: 'workspace',
    description: 'Prepara un borrador en Gmail con el destinatario y asunto especificados.',
    actionOutput: 'Abre redactor de Gmail con borrador estructurado.',
  },
  {
    id: 'cmd-10',
    phrase: 'Abrir Google Picker',
    category: 'workspace',
    description: 'Lanza el explorador modal de archivos alojados en tu Google Drive.',
    actionOutput: 'Invoca Google Drive Picker API v3 con selección interactiva.',
  },
  {
    id: 'cmd-11',
    phrase: 'Generar documento de texto sobre Auditoría y exportar a PDF',
    category: 'workspace',
    description: 'Abre el estudio de documentos con plantilla corporativa y exportador PDF nativo.',
    actionOutput: 'Abre DocumentSpreadsheetModal en modo Documento con descarga PDF.',
  },
  {
    id: 'cmd-12',
    phrase: 'Abrir Google Docs',
    category: 'workspace',
    description: 'Accede a la pestaña de documentos en la nube vinculada a Google Drive.',
    actionOutput: 'Muestra lista de Docs recientes con opción de lectura y exportación.',
  },
  {
    id: 'cmd-13',
    phrase: 'Verificar sincronización con Firebase',
    category: 'workspace',
    description: 'Ejecuta un sondeo de conectividad contra Firebase Firestore v12.',
    actionOutput: 'Verifica persistencia en la nube y suscripciones reactivas.',
  },

  // AGENTES Y TELEMETRÍA
  {
    id: 'cmd-14',
    phrase: 'Vladimir ejecutar análisis OSINT y reconocimiento táctico',
    category: 'agents',
    description: 'Activa las directivas operativas especializadas del agente Vladimir.',
    actionOutput: 'Selecciona agente, aplica modelo preferido y usa el proveedor de voz disponible.',
  },
  {
    id: 'cmd-15',
    phrase: 'Abrir matriz de agentes especializados',
    category: 'agents',
    description: 'Despliega el panel de configuración, bloques JSON e importación de agentes.',
    actionOutput: 'Abre AgentsModal con perfiles ejecutivos y públicos.',
  },
  {
    id: 'cmd-16',
    phrase: 'Abrir telemetría y rendimiento VAOS',
    category: 'agents',
    description: 'Despliega el panel de gráficos interactivos D3.js en tiempo real.',
    actionOutput: 'Abre TelemetryPanel con latencia, tokens/segundo y métricas.',
  },

  // HARDWARE Y DISPOSITIVO
  {
    id: 'cmd-17',
    phrase: 'Encender linterna',
    category: 'device',
    description: 'Activa la linterna física LED del dispositivo o pantalla blanca de alta luminosidad.',
    actionOutput: 'Conmuta MediaTrack torch nativo o abre ScreenTorchModal.',
  },
  {
    id: 'cmd-18',
    phrase: 'Subir volumen / Bajar volumen / Silenciar',
    category: 'device',
    description: 'Ajusta los niveles de volumen de la síntesis de voz o activa modo silencio.',
    actionOutput: 'Modifica el estado de audio y actualiza los indicadores visuales.',
  },
  {
    id: 'cmd-19',
    phrase: 'Alarma para las 07:30',
    category: 'device',
    description: 'Programa una alarma despertadora en el sistema horario del dispositivo.',
    actionOutput: 'Registra alarma con sonido cibernético y notificación.',
  },
  {
    id: 'cmd-20',
    phrase: 'Temporizador de 15 minutos',
    category: 'device',
    description: 'Inicia una cuenta regresiva visual y sonora en tiempo real.',
    actionOutput: 'Inicia temporizador con alerta al finalizar.',
  },

  // APARIENCIA Y TEMAS
  {
    id: 'cmd-21',
    phrase: 'Cambiar tema a Emerald Matrix',
    category: 'appearance',
    description: 'Aplica la paleta de estilo hacker terminal verde esmeralda con variables CSS.',
    actionOutput: 'Actualiza dinámicamente colores de fondo, bordes y acentos.',
  },
  {
    id: 'cmd-22',
    phrase: 'Cambiar tema a Obsidian Cyan',
    category: 'appearance',
    description: 'Restaura el esquema de color cian holográfico cyberpunk predeterminado.',
    actionOutput: 'Aplica tema Obsidian Cyan en toda la interfaz.',
  },
  {
    id: 'cmd-23',
    phrase: 'Cambiar tema a Amber Terminal',
    category: 'appearance',
    description: 'Aplica el esquema de color ámbar monocromático retro-futurista.',
    actionOutput: 'Aplica tema Amber Terminal en toda la interfaz.',
  },
];

const SYSTEM_FEATURES: SystemFeature[] = [
  {
    id: 'feat-1',
    icon: <Bot className="w-4 h-4 text-cyan-400" />,
    title: 'Orquestador VAOS & Matriz de Agentes',
    category: 'Núcleo Operativo',
    summary: 'Arquitectura de doble motor con Policy Engine para separar agentes privados (Vladimir, Valentina, Victoria) de agentes abiertos configurables con bloques JSON.',
    specs: ['Directivas YAML/JSON', 'Memoria de Contexto Aislada', 'Inferencia Multi-Modelo (Gemini / NVIDIA / DeepSeek)'],
    status: 'Activo',
  },
  {
    id: 'feat-2',
    icon: <Mail className="w-4 h-4 text-red-400" />,
    title: 'Adaptadores Google parciales',
    category: 'Productividad Cloud',
    summary: 'Adaptadores presentes para Gmail, Picker, Calendar, Docs y Contacts; cobertura y permisos parciales, sin certificación de extremo a extremo.',
    specs: ['OAuth 2.0 Client-Side', 'Protección contra borrado accidental', 'Lectura y escritura en tiempo real'],
    status: 'Cloud',
  },
  {
    id: 'feat-3',
    icon: <Database className="w-4 h-4 text-amber-400" />,
    title: 'Firebase Firestore en Tiempo Real',
    category: 'Almacenamiento Cloud',
    summary: 'Base de datos NoSQL reactiva para sincronizar perfiles, preferencias, tareas y citas de calendario de forma instantánea entre todos tus dispositivos.',
    specs: ['Reglas ABAC de acceso por UID', 'Suscripciones reactivas onSnapshot', 'Caché y fallback local'],
    status: 'Cloud',
  },
  {
    id: 'feat-4',
    icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
    title: 'Bóveda local experimental',
    category: 'Privacidad local',
    summary: 'Utilidad AES-GCM/PBKDF2. Contraseña predeterminada, persistencia y recuperación seguras pendientes.',
    specs: ['Web Crypto API nativa', '100,000 iteraciones SHA-256', 'Custodia segura pendiente'],
    status: 'Local',
  },
  {
    id: 'feat-5',
    icon: <Activity className="w-4 h-4 text-emerald-400" />,
    title: 'Telemetría D3.js en Vivo',
    category: 'Diagnóstico & Métricas',
    summary: 'Gráficos de routing/proceso, contadores con procedencia y batería cuando la API del navegador está disponible.',
    specs: ['Gráficos SVG D3 reactivos', 'Valores no disponibles indicados como N/D', 'Historial temporal de eventos'],
    status: 'Local',
  },
  {
    id: 'feat-6',
    icon: <FileText className="w-4 h-4 text-blue-400" />,
    title: 'Estudio de Documentos & Hojas de Cálculo',
    category: 'Generación Documental',
    summary: 'Editor de documentos estructurados (.txt, .md) y tablas de cálculo con motor de generación directa a PDF con membrete corporativo y descarga CSV.',
    specs: ['Generador PDF vectorial jsPDF', 'Cálculo de totales', 'Adaptador Docs parcial'],
    status: 'Local',
  },
  {
    id: 'feat-7',
    icon: <Smartphone className="w-4 h-4 text-purple-400" />,
    title: 'Hardware Phone Hub & Modo Offline',
    category: 'Control de Dispositivo',
    summary: 'Acciones sujetas a APIs y permisos del navegador; temporizadores y recordatorios con limitaciones de ciclo de vida. Wi-Fi/BT son estados visuales.',
    specs: ['Cámara Torch API', 'Web Speech; Edge/Gemini como proveedores de voz', 'Service Worker PWA Offline'],
    status: 'Local',
  },
  {
    id: 'feat-8',
    icon: <Palette className="w-4 h-4 text-pink-400" />,
    title: 'Motor de Temas con Variables CSS',
    category: 'Personalización Visual',
    summary: '6 esquemas de color de alta fidelidad (Obsidian Cyan, Amber Terminal, Emerald Matrix, Cyberpunk Neon, Blood Tactical, Cobalt Stealth) aplicados al vuelo.',
    specs: ['Variables CSS globales', 'Persistencia en localStorage', 'Sincronización en perfil Firestore'],
    status: 'Local',
  },
];

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({
  isOpen,
  onClose,
  onExecuteVoiceCommand,
}) => {
  const [activeTab, setActiveTab] = useState<'faqs' | 'voice' | 'system'>('faqs');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<string>('all');
  const [selectedVoiceCategory, setSelectedVoiceCategory] = useState<string>('all');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-1');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    return FAQ_ITEMS.filter((item) => {
      const matchesCategory = selectedFaqCategory === 'all' || item.category === selectedFaqCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCategory;
      const matchesSearch =
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedFaqCategory]);

  // Filtered Voice Shortcuts
  const filteredShortcuts = useMemo(() => {
    return VOICE_SHORTCUTS.filter((item) => {
      const matchesCategory = selectedVoiceCategory === 'all' || item.category === selectedVoiceCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCategory;
      const matchesSearch =
        item.phrase.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.actionOutput.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedVoiceCategory]);

  // Filtered System Features
  const filteredFeatures = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return SYSTEM_FEATURES;
    return SYSTEM_FEATURES.filter(
      (feat) =>
        feat.title.toLowerCase().includes(q) ||
        feat.category.toLowerCase().includes(q) ||
        feat.summary.toLowerCase().includes(q) ||
        feat.specs.some((s) => s.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const handleCopyPhrase = (phrase: string, id: string) => {
    navigator.clipboard.writeText(phrase);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunPhrase = (phrase: string) => {
    if (onExecuteVoiceCommand) {
      onExecuteVoiceCommand(phrase);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
      <div className="w-full max-w-4xl bg-[#070a12] border border-[#1e2638] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-xs text-slate-100">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2638] bg-[#0c101a]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--primary-accent)]/40 shadow-[0_0_12px_rgba(0,240,255,0.25)]">
              <HelpCircle className="w-4 h-4 text-[var(--primary-accent)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wider">
                  Centro de Ayuda & Guía Operativa
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--primary-accent)]/10 border border-[var(--primary-accent)]/30 text-[var(--primary-accent)] font-semibold">
                  VVC LIAM CORE // v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Documentación interactiva, catálogo de atajos de voz y especificaciones del sistema.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#141a29] transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Search Bar */}
        <div className="px-6 pt-4 pb-2 bg-[#090d16] border-b border-[#1e2638]/70">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar en preguntas frecuentes, comandos de voz o módulos del sistema..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#05080e] border border-[#1e2638] focus:border-[var(--primary-accent)] rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 bg-[#080b12] border-b border-[#1e2638]">
          <button
            onClick={() => setActiveTab('faqs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-semibold text-xs transition-colors ${
              activeTab === 'faqs'
                ? 'bg-[#0f1422] text-[var(--primary-accent)] border-t-2 border-[var(--primary-accent)] shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-[#0c101a]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Preguntas Frecuentes ({filteredFaqs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-semibold text-xs transition-colors ${
              activeTab === 'voice'
                ? 'bg-[#0f1422] text-amber-400 border-t-2 border-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-[#0c101a]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Atajos de Voz ({filteredShortcuts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-semibold text-xs transition-colors ${
              activeTab === 'system'
                ? 'bg-[#0f1422] text-emerald-400 border-t-2 border-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-[#0c101a]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Funciones del Sistema ({filteredFeatures.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* TAB 1: FAQS */}
          {activeTab === 'faqs' && (
            <div className="space-y-4">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[#1e2638]/50">
                <span className="text-[11px] text-slate-400 mr-2">Categoría:</span>
                {[
                  { id: 'all', label: 'Todas' },
                  { id: 'general', label: 'General & VAOS' },
                  { id: 'agents', label: 'Agentes Exclusivos' },
                  { id: 'workspace', label: 'Google Workspace' },
                  { id: 'security', label: 'Privacidad y límites' },
                  { id: 'device', label: 'Dispositivo & Hardware' },
                  { id: 'offline', label: 'Modo Offline' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedFaqCategory(cat.id)}
                    className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                      selectedFaqCategory === cat.id
                        ? 'bg-[var(--primary-accent)]/20 text-[var(--primary-accent)] border border-[var(--primary-accent)]/40 font-semibold'
                        : 'bg-[#0e1320] text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Accordion List */}
              <div className="space-y-2.5">
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 border border-dashed border-[#1e2638] rounded-xl">
                    <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p>No se encontraron preguntas que coincidan con tu búsqueda.</p>
                    <p className="text-[10px] text-slate-600 mt-1">Prueba con otros términos o limpia el filtro.</p>
                  </div>
                ) : (
                  filteredFaqs.map((faq) => {
                    const isExpanded = expandedFaqId === faq.id;
                    return (
                      <div
                        key={faq.id}
                        className={`border rounded-xl transition-all overflow-hidden ${
                          isExpanded
                            ? 'bg-[#0b0f1a] border-[var(--primary-accent)]/50 shadow-[0_0_15px_rgba(0,240,255,0.08)]'
                            : 'bg-[#080c15] border-[#1e2638] hover:border-slate-600'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                          className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-accent)] shrink-0" />
                            <span className="font-bold text-white text-xs tracking-wide">
                              {faq.question}
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[var(--primary-accent)] shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 text-slate-300 leading-relaxed text-xs border-t border-[#1e2638]/40 animate-fade-in">
                            <p className="mb-3">{faq.answer}</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {faq.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[9px] px-2 py-0.5 rounded bg-[#131929] text-slate-400 border border-[#1e2638]"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: VOICE SHORTCUTS */}
          {activeTab === 'voice' && (
            <div className="space-y-4">
              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[#1e2638]/50">
                <span className="text-[11px] text-slate-400 mr-2">Grupo:</span>
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'calls_messages', label: 'Llamadas & Contactos' },
                  { id: 'calendar_tasks', label: 'Agenda & Tareas' },
                  { id: 'workspace', label: 'Google Workspace' },
                  { id: 'agents', label: 'Agentes & Telemetría' },
                  { id: 'device', label: 'Hardware & Alarma' },
                  { id: 'appearance', label: 'Temas Visuales' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedVoiceCategory(cat.id)}
                    className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                      selectedVoiceCategory === cat.id
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-semibold'
                        : 'bg-[#0e1320] text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Instructions Tip */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 shrink-0 text-amber-400" />
                  <span className="text-[11px]">
                    Puedes pulsar el <strong>Orbe Central</strong> o usar el atajo del teclado para dictar cualquiera de estas frases con lenguaje natural.
                  </span>
                </div>
              </div>

              {/* Shortcuts Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredShortcuts.length === 0 ? (
                  <div className="col-span-2 text-center py-12 text-slate-500 border border-dashed border-[#1e2638] rounded-xl">
                    <Mic className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-400" />
                    <p>No se encontraron atajos de voz que coincidan con la búsqueda.</p>
                  </div>
                ) : (
                  filteredShortcuts.map((sc) => (
                    <div
                      key={sc.id}
                      className="p-3.5 rounded-xl bg-[#090d16] border border-[#1e2638] hover:border-amber-500/40 flex flex-col justify-between gap-3 transition-colors group"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                            <Terminal className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-white group-hover:text-amber-300 transition-colors">
                              "{sc.phrase}"
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          {sc.description}
                        </p>
                        <div className="text-[10px] text-cyan-400/90 bg-[#060910] p-1.5 rounded border border-[#1e2638]">
                          ↳ {sc.actionOutput}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#1e2638]/40">
                        <button
                          type="button"
                          onClick={() => handleCopyPhrase(sc.phrase, sc.id)}
                          className="px-2.5 py-1 rounded bg-[#131929] hover:bg-[#1a233b] text-slate-300 hover:text-white text-[10px] flex items-center gap-1 transition-colors"
                          title="Copiar frase al portapapeles"
                        >
                          {copiedId === sc.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>

                        {onExecuteVoiceCommand && (
                          <button
                            type="button"
                            onClick={() => handleRunPhrase(sc.phrase)}
                            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-semibold flex items-center gap-1 transition-colors shadow-sm"
                            title="Ejecutar comando en la consola de comandos ahora"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Probar comando</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SYSTEM FEATURES */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredFeatures.map((feat) => (
                  <div
                    key={feat.id}
                    className="p-4 rounded-xl bg-[#090d16] border border-[#1e2638] hover:border-emerald-500/40 transition-colors flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-[#111726] border border-[#1e2638]">
                            {feat.icon}
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-xs">{feat.title}</h3>
                            <span className="text-[10px] text-slate-400">{feat.category}</span>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] px-2 py-0.5 rounded font-bold border ${
                            feat.status === 'Activo'
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                              : feat.status === 'Cloud'
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : feat.status === 'E2EE'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          }`}
                        >
                          {feat.status}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {feat.summary}
                      </p>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-[#1e2638]/50">
                      <span className="text-[10px] text-slate-400 font-semibold block">Capacidades Clave:</span>
                      <ul className="space-y-1">
                        {feat.specs.map((spec, i) => (
                          <li key={i} className="text-[10px] text-slate-300 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" />
                            <span>{spec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#0a0d16] border-t border-[#1e2638] flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>VVC LIAM CORE // Documentación certificada y segura</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--primary-accent)] hover:bg-[var(--primary-accent)]/90 text-black font-bold text-xs transition-colors shadow-[0_0_12px_rgba(0,240,255,0.25)]"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
