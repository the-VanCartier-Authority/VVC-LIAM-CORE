export type ModelType =
  | 'nvidia/nemotron-3.5-lightning-30b-a3b'
  | 'deepseek-ai/deepseek-v4.1-flash'
  | 'z-ai/glm-5-3'
  | 'z-ai/glm-5-3-flash'
  | 'moonshotai/kimi-k3'
  | 'meta/muse-glimmer-30b'
  | 'poolside/laguna-xs-2.1'
  | 'nvidia/nemotron-3-ultra-550b-a55b'
  | 'google/diffusiongemma-26b-a4b-it'
  | 'google/gemma-4-31b-it'
  | 'nvidia/nemotron-3-super-120b-a12b'
  | 'openai/gpt-oss-20b'
  | 'mistralai/mistral-nemotron'
  | 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'
  | 'meta/llama-3.2-11b-vision-instruct'
  | 'nvidia/riva-translate-4b-instruct-v2'
  | 'rt-lite-local';

export type CloudServiceIntegrationType =
  | 'local_only'
  | 'google_calendar'
  | 'notion_workspace'
  | 'todoist_sync'
  | 'slack_webhooks'
  | 'enterprise_hybrid';

export interface CloudIntegrationInfo {
  id: CloudServiceIntegrationType;
  name: string;
  provider: string;
  description: string;
  badge: string;
  iconName: string;
  features: string[];
}

export const CLOUD_INTEGRATIONS: CloudIntegrationInfo[] = [
  {
    id: 'local_only',
    name: 'Modo Local Autónomo (Zero-Knowledge)',
    provider: 'VVC-ACIA Sandbox',
    description: 'Sin sincronización externa. Privacidad absoluta y cifrado en el navegador.',
    badge: 'MÁXIMA PRIVACIDAD',
    iconName: 'ShieldCheck',
    features: ['Almacenamiento AES-GCM-256', 'Cero telemetría', 'Funcionamiento 100% offline'],
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar & Tasks Cloud Sync',
    provider: 'Google Workspace',
    description: 'Sincronización bidireccional de agenda, exportación iCal (.ics) y recordatorios en tiempo real.',
    badge: 'CALENDARIO NATIVO',
    iconName: 'Calendar',
    features: ['Sincronización RFC 5545 iCal', 'Eventos con alarmas automáticas', 'Compatibilidad móvil'],
  },
  {
    id: 'notion_workspace',
    name: 'Notion Workspace Live Database',
    provider: 'Notion API',
    description: 'Automatización de tareas en bases de datos de Notion con prioridades y subelementos.',
    badge: 'GESTIÓN NOTION',
    iconName: 'FileText',
    features: ['Mapeo de propiedades', 'Subelementos automáticos', 'Registros sincronizados'],
  },
  {
    id: 'todoist_sync',
    name: 'Todoist Real-Time Task Flow',
    provider: 'Todoist Cloud',
    description: 'Integración continua con bandejas de entrada de Todoist y proyectos automatizados.',
    badge: 'TAREAS CLOUD',
    iconName: 'CheckSquare',
    features: ['Prioridades P1-P4 sincronizadas', 'Fechas de vencimiento dinámicas', 'Notificaciones instantáneas'],
  },
  {
    id: 'slack_webhooks',
    name: 'Slack / Discord Automated Webhooks',
    provider: 'Slack Cloud Service',
    description: 'Envío automático de alertas y recordatorios de tareas críticas a canales de comunicación.',
    badge: 'WEBHOOKS EN VIVO',
    iconName: 'Share2',
    features: ['Alertas a canales en tiempo real', 'Payloads JSON formateados', 'Registro de auditoría'],
  },
  {
    id: 'enterprise_hybrid',
    name: 'Suite Empresarial Híbrida (Google + Notion + E2EE)',
    provider: 'Multi-Cloud Relay',
    description: 'Integración simultánea en la nube con Google Calendar, Notion y Webhooks con cifrado de extremo a extremo.',
    badge: 'SUITE COMPLETA',
    iconName: 'Globe',
    features: ['Sincronización unificada', 'Cifrado E2EE antes de envío', 'Respaldo automático'],
  },
];

export interface ModelInfo {
  id: ModelType;
  name: string;
  provider: string;
  category: 'NVIDIA NIM' | 'RT-Lite Local';
  description: string;
  bestFor: string;
  isFreeEndpoint?: boolean;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    name: 'Nemotron 3.5 Lightning 30B',
    provider: 'NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Agentes especializados, instrucciones técnicas y flujos de trabajo con herramientas.',
    bestFor: 'Coding & Agentes (Recomendado para VVC-ACIA)',
    isFreeEndpoint: true,
  },
  {
    id: 'rt-lite-local',
    name: 'RT-Lite On-Device Engine',
    provider: 'VVC-ACIA Local',
    category: 'RT-Lite Local',
    description: 'Motor local en el dispositivo. Cero latencia, 100% privado, funciona sin internet ni API Key.',
    bestFor: 'Operaciones críticas, modo offline y control de hardware inmediato',
    isFreeEndpoint: true,
  },
  {
    id: 'deepseek-ai/deepseek-v4.1-flash',
    name: 'DeepSeek V4.1 Flash',
    provider: 'DeepSeek / NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Asistente general rápido; consultas técnicas de alta velocidad.',
    bestFor: 'Velocidad extrema y respuestas concisas',
    isFreeEndpoint: true,
  },
  {
    id: 'z-ai/glm-5-3',
    name: 'GLM-5.3',
    provider: 'Zhipu AI / NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Razonamiento complejo y uso de herramientas avanzadas.',
    bestFor: 'Razonamiento multi-paso y funciones del sistema',
    isFreeEndpoint: true,
  },
  {
    id: 'z-ai/glm-5-3-flash',
    name: 'GLM-5.3 Flash',
    provider: 'Zhipu AI / NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Razonamiento multimodal con perfil de menor latencia.',
    bestFor: 'Baja latencia y respuestas rápidas',
    isFreeEndpoint: true,
  },
  {
    id: 'moonshotai/kimi-k3',
    name: 'Kimi K3',
    provider: 'Moonshot AI / NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Tareas de razonamiento prolongado, agentes y contexto extenso.',
    bestFor: 'Comprensión profunda y análisis de tareas',
    isFreeEndpoint: true,
  },
  {
    id: 'meta/muse-glimmer-30b',
    name: 'Muse Glimmer 30B',
    provider: 'Meta / NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Razonamiento visual, texto y tool calling fluido.',
    bestFor: 'Llamadas a funciones y formateo estructurado',
    isFreeEndpoint: true,
  },
  {
    id: 'poolside/laguna-xs-2.1',
    name: 'Laguna XS 2.1',
    provider: 'Poolside / NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Codificación agentic y tareas de terminal.',
    bestFor: 'Comandos técnicos y operaciones de consola',
    isFreeEndpoint: true,
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    name: 'Nemotron 3 Ultra 550B',
    provider: 'NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Razonamiento de máxima capacidad, planificación y contexto ultra largo.',
    bestFor: 'Planificación de agendas y flujos complejos',
    isFreeEndpoint: true,
  },
  {
    id: 'google/diffusiongemma-26b-a4b-it',
    name: 'DiffusionGemma 26B A4B IT',
    provider: 'Google / NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Generación de texto interactiva con decodificación paralela.',
    bestFor: 'Chat interactivo y generación fluida',
    isFreeEndpoint: true,
  },
  {
    id: 'google/gemma-4-31b-it',
    name: 'Gemma 4 31B IT',
    provider: 'Google / NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Razonamiento general de vanguardia, código y flujos agentic.',
    bestFor: 'Agentes autónomos e instrucciones precisas',
    isFreeEndpoint: true,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    name: 'Nemotron 3 Super 120B',
    provider: 'NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Agentes, razonamiento, planificación y contexto extendido.',
    bestFor: 'Automatización de tareas',
    isFreeEndpoint: true,
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'OpenAI / NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Razonamiento matemático y lógica en tamaño balanceado.',
    bestFor: 'Cálculos y tareas numéricas',
    isFreeEndpoint: true,
  },
  {
    id: 'mistralai/mistral-nemotron',
    name: 'Mistral Nemotron',
    provider: 'Mistral / NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Seguimiento riguroso de instrucciones y llamadas a funciones.',
    bestFor: 'Control estricto de dispositivos',
    isFreeEndpoint: true,
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    name: 'Nemotron 3 Nano Omni 30B',
    provider: 'NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Razonamiento con texto, audio y habla adaptativa.',
    bestFor: 'Procesamiento de voz multimodal',
    isFreeEndpoint: true,
  },
  {
    id: 'nvidia/riva-translate-4b-instruct-v2',
    name: 'Riva Translate 4B Instruct v2',
    provider: 'NVIDIA',
    category: 'NVIDIA NIM',
    description: 'Traducción simultánea en más de 37 idiomas.',
    bestFor: 'Traducción de voz y comandos multilingües',
    isFreeEndpoint: true,
  }
];

export type KokoroVoiceId =
  | 'af_heart'
  | 'af_bella'
  | 'af_nicole'
  | 'am_adam'
  | 'am_michael'
  | 'bf_emma'
  | 'es_mateo'
  | 'es_sofia';

export interface KokoroVoice {
  id: KokoroVoiceId;
  name: string;
  gender: 'Femenina' | 'Masculina';
  language: 'Español' | 'English';
  style: string;
  samplePhrase: string;
  pitch: number;
  rate: number;
}

export const KOKORO_VOICES: KokoroVoice[] = [
  {
    id: 'es_mateo',
    name: 'Kokoro Mateo (ES)',
    gender: 'Masculina',
    language: 'Español',
    style: 'Español Neutro, sereno y profesional',
    samplePhrase: 'Hola, soy VVC-ACIA. Todos los sistemas están sincronizados y listos.',
    pitch: 0.95,
    rate: 1.05,
  },
  {
    id: 'es_sofia',
    name: 'Kokoro Sofía (ES)',
    gender: 'Femenina',
    language: 'Español',
    style: 'Español Cálido, articulado y empático',
    samplePhrase: 'Entendido. Ejecutando la acción de inmediato con cifrado total.',
    pitch: 1.15,
    rate: 1.05,
  },
  {
    id: 'af_heart',
    name: 'Kokoro Heart',
    gender: 'Femenina',
    language: 'English',
    style: 'Voz insignia, ultra-natural y fluida',
    samplePhrase: 'VVC-ACIA neural core active. How can I assist your workflow today?',
    pitch: 1.08,
    rate: 1.0,
  },
  {
    id: 'af_bella',
    name: 'Kokoro Bella',
    gender: 'Femenina',
    language: 'English',
    style: 'Dinámica, brillante y expresiva',
    samplePhrase: 'System diagnostics nominal. End-to-end encryption verified.',
    pitch: 1.12,
    rate: 1.05,
  },
  {
    id: 'af_nicole',
    name: 'Kokoro Nicole',
    gender: 'Femenina',
    language: 'English',
    style: 'Voz ejecutiva, directa y concisa',
    samplePhrase: 'Command executed successfully. Calendar updated in real time.',
    pitch: 1.02,
    rate: 1.08,
  },
  {
    id: 'am_adam',
    name: 'Kokoro Adam',
    gender: 'Masculina',
    language: 'English',
    style: 'Profunda, resonante y segura',
    samplePhrase: 'Obsidian terminal connected. Switching to RT-Lite low latency mode.',
    pitch: 0.9,
    rate: 1.0,
  },
  {
    id: 'am_michael',
    name: 'Kokoro Michael',
    gender: 'Masculina',
    language: 'English',
    style: 'Corporativo, nítido y equilibrado',
    samplePhrase: 'All device functions are within standard operating parameters.',
    pitch: 0.96,
    rate: 1.02,
  },
  {
    id: 'bf_emma',
    name: 'Kokoro Emma',
    gender: 'Femenina',
    language: 'English',
    style: 'Acento británico sofisticado',
    samplePhrase: 'Encryption keys generated. Your data remains completely private.',
    pitch: 1.05,
    rate: 0.98,
  }
];

export interface DeviceState {
  flashlight: boolean;
  brightness: number; // 10 to 100
  volume: number; // 0 to 100
  isMuted: boolean;
  wifi: boolean;
  bluetooth: boolean;
  batteryLevel: number; // 0 to 100
  isCharging: boolean;
  screenTorchActive: boolean;
  airplaneMode: boolean;
  dnd: boolean;
}

export interface ActiveCall {
  inCall: boolean;
  contactName: string;
  phoneNumber: string;
  durationSeconds: number;
  isMuted: boolean;
  isSpeaker: boolean;
  state: 'calling' | 'connected' | 'ended';
}

export interface PhoneContact {
  id: string;
  name: string;
  phone: string;
  relation?: string;
  favorite?: boolean;
}

export interface AlarmItem {
  id: string;
  time: string; // HH:mm
  label: string;
  enabled: boolean;
  days: string[];
}

export interface TimerItem {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isCompleted: boolean;
}

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  dueDate: string; // YYYY-MM-DD
  timeDue: string; // HH:mm
  priority: 'baja' | 'media' | 'alta' | 'critica';
  category: 'trabajo' | 'personal' | 'urgente' | 'sistema' | 'proyecto';
  isCompleted: boolean;
  completedAt?: number;
  recurrence: 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly';
  subtasks: SubtaskItem[];
  calendarEventId?: string;
  syncedToThirdParty?: {
    googleCalendar?: boolean;
    notion?: boolean;
    todoist?: boolean;
    slackWebhook?: boolean;
  };
  snoozedUntil?: string; // HH:mm
  createdAt: number;
  updatedAt: number;
}

// For backwards compatibility and quick references
export type ReminderItem = TaskItem;

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  description?: string;
  category?: 'reunion' | 'tarea' | 'llamada' | 'personal' | 'sistema';
  isAutomated?: boolean;
  linkedTaskId?: string;
  attendees?: string[];
  iCalUID?: string;
}

export interface ThirdPartyIntegrationSettings {
  googleCalendar: {
    connected: boolean;
    calendarId: string;
    autoSync: boolean;
  };
  notion: {
    connected: boolean;
    databaseId: string;
    autoSync: boolean;
  };
  todoist: {
    connected: boolean;
    projectId: string;
    autoSync: boolean;
  };
  slack: {
    connected: boolean;
    webhookUrl: string;
    channel: string;
    notifyOnTrigger: boolean;
  };
  customWebhook: {
    url: string;
    enabled: boolean;
  };
}

export interface EncryptedVaultItem {
  id: string;
  title: string;
  encryptedContent: string;
  iv: string;
  salt: string;
  updatedAt: number;
  category: 'nota' | 'clave' | 'contacto' | 'sistema';
}

export interface ConsoleMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  actionType?: 'call' | 'message' | 'torch' | 'volume' | 'brightness' | 'alarm' | 'timer' | 'reminder' | 'task' | 'calendar' | 'security' | 'model' | 'sync';
  actionDetails?: string;
  modelUsed?: string;
  isE2EE?: boolean;
}

export interface ActiveNotificationAlert {
  id: string;
  taskId: string;
  title: string;
  timeDue: string;
  priority: 'baja' | 'media' | 'alta' | 'critica';
  category: string;
  timestamp: number;
}
