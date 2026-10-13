export type ModelType =
  // --- Especialistas en Codificación y Desarrollo (NVIDIA NIM) ---
  | 'qwen/qwen2.5-coder-32b-instruct'
  | 'qwen/qwen2.5-coder-7b-instruct'
  | 'mistralai/codestral-22b-instruct-v0.1'
  | 'deepseek-ai/deepseek-coder-33b-instruct'
  | 'meta/codellama-70b-instruct'
  | 'bigcode/starcoder2-15b'
  | 'poolside/laguna-xs-2.1'
  // --- Familia GLM (Zhipu AI / NVIDIA Build) ---
  | 'z-ai/glm-5-3'
  | 'z-ai/glm-5-3-flash'
  | 'thudm/glm-4-9b-chat'
  // --- Razonamiento Profundo y Frontier (NVIDIA NIM) ---
  | 'deepseek-ai/deepseek-r1'
  | 'deepseek-ai/deepseek-v3'
  | 'deepseek-ai/deepseek-v4.1-flash'
  | 'nvidia/llama-3.1-nemotron-70b-instruct'
  | 'meta/llama-3.3-70b-instruct'
  | 'meta/llama-3.1-405b-instruct'
  | 'mistralai/mistral-large-2-instruct'
  | 'nvidia/nemotron-3-ultra-550b-a55b'
  | 'nvidia/nemotron-3-super-120b-a12b'
  | 'nvidia/nemotron-3.5-lightning-30b-a3b'
  | 'moonshotai/kimi-k3'
  | 'openai/gpt-oss-20b'
  // --- Voz Rápida, Multimodal y Herramientas ---
  | 'meta/llama-3.2-11b-vision-instruct'
  | 'meta/muse-glimmer-30b'
  | 'google/gemma-4-31b-it'
  | 'google/diffusiongemma-26b-a4b-it'
  | 'mistralai/mistral-nemotron'
  | 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'
  | 'nvidia/riva-translate-4b-instruct-v2'
  // --- Motores Locales RT-Lite (On-Device) ---
  | 'rt-lite-local'
  | 'rt-lite-hardware'
  | 'rt-lite-telephony'
  | 'rt-lite-agenda'
  | 'rt-lite-docs'
  | 'rt-lite-security';

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

export type ModelDomain =
  | 'coding'
  | 'flagship_reasoning'
  | 'fast_voice'
  | 'multimodal'
  | 'agents_tools'
  | 'offline_device';

export type ModelTier =
  | 'Flagship Full'
  | 'Lite / Flash'
  | 'Coding Specialist'
  | 'Fast Voice'
  | 'Specialist'
  | 'Local On-Device';

export interface ModelInfo {
  id: ModelType;
  name: string;
  provider: string;
  category: 'NVIDIA NIM' | 'RT-Lite Local';
  domain: ModelDomain;
  tier: ModelTier;
  description: string;
  bestFor: string;
  contextWindow?: string;
  maxTokens?: number;
  isFreeEndpoint?: boolean;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  // ==========================================
  // 1. ESPECIALISTAS EN CODIFICACIÓN & INGENIERÍA DE SOFTWARE
  // ==========================================
  {
    id: 'qwen/qwen2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B Instruct',
    provider: 'Alibaba Cloud / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'coding',
    tier: 'Coding Specialist',
    description: 'El modelo insignia open-source de programación. Rendimiento de nivel superior en generación de código, depuración, refactorización masiva y comprensión de 92+ lenguajes.',
    bestFor: 'Ingeniería de software, refactorización y arquitectura (Recomendado para Código)',
    contextWindow: '128K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'mistralai/codestral-22b-instruct-v0.1',
    name: 'Codestral 22B Instruct',
    provider: 'Mistral AI / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'coding',
    tier: 'Coding Specialist',
    description: 'Especialista puro en código diseñado por Mistral. Optimizado para Fill-in-the-Middle (FIM), generación de pruebas unitarias y lógica algorítmica en más de 80 lenguajes.',
    bestFor: 'Completado de código FIM, tests unitarios y scripts backend',
    contextWindow: '32K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'deepseek-ai/deepseek-coder-33b-instruct',
    name: 'DeepSeek Coder 33B Instruct',
    provider: 'DeepSeek / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'coding',
    tier: 'Coding Specialist',
    description: 'Entrenado desde cero con 2 billones de tokens de código y lenguaje natural. Destaca en algoritmos matemáticos, optimización de rendimiento y desarrollo full-stack.',
    bestFor: 'Algoritmos matemáticos complejos, optimización y estructuras de datos',
    contextWindow: '64K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'qwen/qwen2.5-coder-7b-instruct',
    name: 'Qwen 2.5 Coder 7B Fast',
    provider: 'Alibaba Cloud / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'coding',
    tier: 'Coding Specialist',
    description: 'Versión ágil de Qwen Coder con latencia ultra-baja. Ideal para generación interactiva de scripts Bash, consultas SQL y snippets inmediatos en caliente.',
    bestFor: 'Scripts rápidos de terminal, comandos shell y consultas SQL (<1s)',
    contextWindow: '32K',
    maxTokens: 2048,
    isFreeEndpoint: true,
  },
  {
    id: 'meta/codellama-70b-instruct',
    name: 'Code Llama 70B Instruct',
    provider: 'Meta / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'coding',
    tier: 'Coding Specialist',
    description: 'La variante de código más masiva de la familia Llama. Diseñado para auditar grandes bases de código, modernizar código legacy y análisis estático profundo.',
    bestFor: 'Auditoría de código legacy y análisis estático empresarial',
    contextWindow: '100K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'bigcode/starcoder2-15b',
    name: 'StarCoder2 15B',
    provider: 'BigCode (ServiceNow & Hugging Face) / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'coding',
    tier: 'Coding Specialist',
    description: 'Entrenado sobre The Stack v2 en 600+ lenguajes de programación. Fuerte apego a especificaciones sintácticas y comprensión de APIs modernas.',
    bestFor: 'Completado de sintaxis estricta y APIs modernas',
    contextWindow: '16K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'poolside/laguna-xs-2.1',
    name: 'Laguna XS 2.1',
    provider: 'Poolside / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'coding',
    tier: 'Coding Specialist',
    description: 'Codificación agentic interactiva, navegación de árboles de directorios y operaciones de consola en tiempo real.',
    bestFor: 'Comandos técnicos y operaciones de terminal',
    contextWindow: '32K',
    maxTokens: 2048,
    isFreeEndpoint: true,
  },

  // ==========================================
  // 2. FAMILIA GLM (ZHIPU AI / NVIDIA BUILD)
  // ==========================================
  {
    id: 'z-ai/glm-5-3',
    name: 'GLM-5.3 Flagship (Full Engine)',
    provider: 'Zhipu AI / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'flagship_reasoning',
    tier: 'Flagship Full',
    description: 'Versión insignia completa de GLM-5.3 sin reducciones. Máxima capacidad de razonamiento multi-paso, arquitectura MoE avanzada, resolución de problemas complejos, programación bilingüe y tool calling de grado de producción.',
    bestFor: 'Razonamiento complejo de máximo nivel, arquitectura y funciones de sistema (Flagship)',
    contextWindow: '128K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'z-ai/glm-5-3-flash',
    name: 'GLM-5.3 Flash (Lite Edition)',
    provider: 'Zhipu AI / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'fast_voice',
    tier: 'Lite / Flash',
    description: 'Versión ligera (Lite) de alta velocidad de GLM-5.3. Optimizada para latencia ultra-baja (<250ms), streaming en tiempo real y consumo mínimo de recursos.',
    bestFor: 'Respuestas inmediatas de voz, baja latencia y chat interactivo ligero (Lite)',
    contextWindow: '32K',
    maxTokens: 1024,
    isFreeEndpoint: true,
  },
  {
    id: 'thudm/glm-4-9b-chat',
    name: 'GLM-4 9B Chat',
    provider: 'Zhipu AI / Tsinghua / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'agents_tools',
    tier: 'Lite / Flash',
    description: 'Modelo abierto bilingüe (Inglés/Español/Chino) optimizado para diálogo, seguimiento de instrucciones y llamadas a herramientas estructuradas.',
    bestFor: 'Conversación técnica equilibrada y llamadas a funciones',
    contextWindow: '128K',
    maxTokens: 2048,
    isFreeEndpoint: true,
  },

  // ==========================================
  // 3. RAZONAMIENTO PROFUNDO & MODELOS FRONTIER
  // ==========================================
  {
    id: 'deepseek-ai/deepseek-r1',
    name: 'DeepSeek R1 Reasoning',
    provider: 'DeepSeek / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'flagship_reasoning',
    tier: 'Flagship Full',
    description: 'Pionero en razonamiento deductivo puro con cadena de pensamiento explícita (Chain-of-Thought). Supera benchmarks en matemáticas, lógica formal y codificación de alto impacto.',
    bestFor: 'Resolución de problemas de alta complejidad lógica y matemáticas avanzadas',
    contextWindow: '64K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'deepseek-ai/deepseek-v3',
    name: 'DeepSeek V3 671B MoE',
    provider: 'DeepSeek / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'flagship_reasoning',
    tier: 'Flagship Full',
    description: 'Arquitectura Mixture-of-Experts con 671B parámetros (37B activos). Rendimiento benchmark líder en todas las disciplinas generales, código y lenguaje.',
    bestFor: 'Inteligencia general de escala masiva y análisis estratégico',
    contextWindow: '128K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'Llama 3.1 Nemotron 70B',
    provider: 'NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'flagship_reasoning',
    tier: 'Flagship Full',
    description: 'Modelo afinado por NVIDIA con alineación RLHF para máxima veracidad, reducción de alucinaciones y precisión en seguimiento de políticas.',
    bestFor: 'Gobernanza de sistemas, síntesis de datos y precisión extrema',
    contextWindow: '128K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'Meta / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'flagship_reasoning',
    tier: 'Flagship Full',
    description: 'El estándar de oro abierto de Meta. Capacidades equiparables a modelos de clase frontier con un equilibrio óptimo de velocidad y razonamiento profundo.',
    bestFor: 'Tareas empresariales, análisis holístico y redacción de alto impacto',
    contextWindow: '128K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'meta/llama-3.1-405b-instruct',
    name: 'Llama 3.1 405B Flagship',
    provider: 'Meta / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'flagship_reasoning',
    tier: 'Flagship Full',
    description: 'El modelo abierto más colosal disponible en NVIDIA NIM. Máxima fidelidad en síntesis de conocimiento, destilación y razonamiento sin concesiones.',
    bestFor: 'Investigación profunda y síntesis de conocimiento enciclopédico',
    contextWindow: '128K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'mistralai/mistral-large-2-instruct',
    name: 'Mistral Large 2 123B',
    provider: 'Mistral AI / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'flagship_reasoning',
    tier: 'Flagship Full',
    description: 'Razonamiento avanzado de 123B parámetros, fluidez en decenas de idiomas y competencia excepcional en código y razonamiento lógico formal.',
    bestFor: 'Análisis multilingüe y razonamiento corporativo',
    contextWindow: '128K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    name: 'Nemotron 3 Ultra 550B',
    provider: 'NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'flagship_reasoning',
    tier: 'Flagship Full',
    description: 'Razonamiento de máxima capacidad de NVIDIA con contexto ultra extendido y planificación de tareas.',
    bestFor: 'Planificación de agendas complejas y flujos multi-paso',
    contextWindow: '128K',
    maxTokens: 4096,
    isFreeEndpoint: true,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    name: 'Nemotron 3 Super 120B',
    provider: 'NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'agents_tools',
    tier: 'Flagship Full',
    description: 'Agentes autónomos, planificación jerárquica y flujos continuos de tareas operativas.',
    bestFor: 'Automatización de tareas y orquestación de agentes',
    contextWindow: '64K',
    maxTokens: 3072,
    isFreeEndpoint: true,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    name: 'Nemotron 3.5 Lightning 30B',
    provider: 'NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'agents_tools',
    tier: 'Specialist',
    description: 'Optimizado por NVIDIA para agentes técnicos, ejecución de herramientas y flujos de trabajo autónomos VAOS.',
    bestFor: 'Coding & Agentes Autónomos (Recomendado para VAOS)',
    contextWindow: '64K',
    maxTokens: 2048,
    isFreeEndpoint: true,
  },
  {
    id: 'moonshotai/kimi-k3',
    name: 'Kimi K3',
    provider: 'Moonshot AI / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'flagship_reasoning',
    tier: 'Specialist',
    description: 'Tareas de contexto ultra-largo, comprensión exhaustiva de documentos masivos y agentes analíticos.',
    bestFor: 'Comprensión profunda de documentos y contexto extenso',
    contextWindow: '200K',
    maxTokens: 3072,
    isFreeEndpoint: true,
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'OpenAI / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'flagship_reasoning',
    tier: 'Specialist',
    description: 'Razonamiento lógico, matemático y deducción en tamaño altamente eficiente.',
    bestFor: 'Cálculos y tareas numéricas',
    contextWindow: '32K',
    maxTokens: 2048,
    isFreeEndpoint: true,
  },

  // ==========================================
  // 4. VOZ RÁPIDA, MULTIMODAL & HERRAMIENTAS
  // ==========================================
  {
    id: 'meta/llama-3.2-11b-vision-instruct',
    name: 'Llama 3.2 11B Vision Fast',
    provider: 'Meta / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'fast_voice',
    tier: 'Fast Voice',
    description: 'Respuesta ultra-rápida (<1 seg) en tiempo real con NVIDIA Build Cloud. Máxima velocidad de voz y comprensión visual.',
    bestFor: 'Conversación fluida por voz instantánea (Recomendado para Voz)',
    contextWindow: '128K',
    maxTokens: 800,
    isFreeEndpoint: true,
  },
  {
    id: 'deepseek-ai/deepseek-v4.1-flash',
    name: 'DeepSeek V4.1 Flash',
    provider: 'DeepSeek / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'fast_voice',
    tier: 'Lite / Flash',
    description: 'Asistente general de velocidad extrema; consultas técnicas de alta frecuencia con respuesta instantánea.',
    bestFor: 'Velocidad extrema y respuestas concisas',
    contextWindow: '64K',
    maxTokens: 800,
    isFreeEndpoint: true,
  },
  {
    id: 'meta/muse-glimmer-30b',
    name: 'Muse Glimmer 30B',
    provider: 'Meta / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'multimodal',
    tier: 'Specialist',
    description: 'Razonamiento visual, texto y llamadas a herramientas fluidas.',
    bestFor: 'Llamadas a funciones y formateo estructurado',
    contextWindow: '32K',
    maxTokens: 1200,
    isFreeEndpoint: true,
  },
  {
    id: 'google/gemma-4-31b-it',
    name: 'Gemma 4 31B IT',
    provider: 'Google / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'agents_tools',
    tier: 'Specialist',
    description: 'Razonamiento general de vanguardia, código y flujos agénticos de alta precisión instruccional.',
    bestFor: 'Agentes autónomos e instrucciones precisas',
    contextWindow: '32K',
    maxTokens: 2048,
    isFreeEndpoint: true,
  },
  {
    id: 'google/diffusiongemma-26b-a4b-it',
    name: 'DiffusionGemma 26B A4B IT',
    provider: 'Google / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'multimodal',
    tier: 'Specialist',
    description: 'Generación de texto interactiva con decodificación paralela difusiva.',
    bestFor: 'Chat interactivo y generación fluida',
    contextWindow: '32K',
    maxTokens: 1200,
    isFreeEndpoint: true,
  },
  {
    id: 'mistralai/mistral-nemotron',
    name: 'Mistral Nemotron',
    provider: 'Mistral / NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'agents_tools',
    tier: 'Specialist',
    description: 'Seguimiento riguroso de instrucciones y llamadas a funciones para control de dispositivos.',
    bestFor: 'Control estricto de dispositivos',
    contextWindow: '32K',
    maxTokens: 1200,
    isFreeEndpoint: true,
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    name: 'Nemotron 3 Nano Omni 30B',
    provider: 'NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'multimodal',
    tier: 'Specialist',
    description: 'Razonamiento multimodal nativo con texto, audio y habla adaptativa.',
    bestFor: 'Procesamiento de voz multimodal',
    contextWindow: '32K',
    maxTokens: 1200,
    isFreeEndpoint: true,
  },
  {
    id: 'nvidia/riva-translate-4b-instruct-v2',
    name: 'Riva Translate 4B Instruct v2',
    provider: 'NVIDIA Build',
    category: 'NVIDIA NIM',
    domain: 'multimodal',
    tier: 'Specialist',
    description: 'Traducción simultánea en más de 37 idiomas para operaciones globales.',
    bestFor: 'Traducción de voz y comandos multilingües',
    contextWindow: '16K',
    maxTokens: 800,
    isFreeEndpoint: true,
  },

  // ==========================================
  // 5. MOTORES LOCALES ON-DEVICE RT-LITE (100% OFFLINE)
  // ==========================================
  {
    id: 'rt-lite-local',
    name: 'RT-Lite Master Omni-Engine',
    provider: 'VVC-ACIA Local',
    category: 'RT-Lite Local',
    domain: 'offline_device',
    tier: 'Local On-Device',
    description: 'Motor unificado maestro en el dispositivo. Control integral de todas las funciones sin conexión ni API Key.',
    bestFor: 'Control global del teléfono, privacidad absoluta y cero latencia',
    contextWindow: 'Local',
    maxTokens: 1024,
    isFreeEndpoint: true,
  },
  {
    id: 'rt-lite-hardware',
    name: 'RT-Lite Hardware & Device Control',
    provider: 'VVC-ACIA Local',
    category: 'RT-Lite Local',
    domain: 'offline_device',
    tier: 'Local On-Device',
    description: 'Motor dedicado para linterna física y de pantalla, volumen, brillo, Wi-Fi, Bluetooth y batería.',
    bestFor: 'Control físico inmediato de actuadores del teléfono',
    contextWindow: 'Local',
    maxTokens: 1024,
    isFreeEndpoint: true,
  },
  {
    id: 'rt-lite-telephony',
    name: 'RT-Lite Telecom & Communications',
    provider: 'VVC-ACIA Local',
    category: 'RT-Lite Local',
    domain: 'offline_device',
    tier: 'Local On-Device',
    description: 'Motor especializado en llamadas celulares, mensajería directa SMS, WhatsApp y libreta de contactos.',
    bestFor: 'Comunicaciones directas por voz y mensajería',
    contextWindow: 'Local',
    maxTokens: 1024,
    isFreeEndpoint: true,
  },
  {
    id: 'rt-lite-agenda',
    name: 'RT-Lite Calendar & Schedule Matrix',
    provider: 'VVC-ACIA Local',
    category: 'RT-Lite Local',
    domain: 'offline_device',
    tier: 'Local On-Device',
    description: 'Programación de eventos complejos, detección y resolución de conflictos y sync Google/Outlook/Apple.',
    bestFor: 'Gestión avanzada de calendario, tareas, alarmas y temporizadores',
    contextWindow: 'Local',
    maxTokens: 1024,
    isFreeEndpoint: true,
  },
  {
    id: 'rt-lite-docs',
    name: 'RT-Lite Document & Spreadsheet Studio',
    provider: 'VVC-ACIA Local',
    category: 'RT-Lite Local',
    domain: 'offline_device',
    tier: 'Local On-Device',
    description: 'Generación local de archivos de texto estructurado y hojas de cálculo con exportación a PDF descargable.',
    bestFor: 'Creación de reportes, presupuestos, minutas y exportación a PDF',
    contextWindow: 'Local',
    maxTokens: 1024,
    isFreeEndpoint: true,
  },
  {
    id: 'rt-lite-security',
    name: 'RT-Lite Obsidian Vault & Security',
    provider: 'VVC-ACIA Local',
    category: 'RT-Lite Local',
    domain: 'offline_device',
    tier: 'Local On-Device',
    description: 'Cifrado E2EE de grado militar AES-GCM-256, service worker y alertas push nativas en segundo plano.',
    bestFor: 'Bóveda de credenciales, notas secretas y notificaciones push persistentes',
    contextWindow: 'Local',
    maxTokens: 1024,
    isFreeEndpoint: true,
  },
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
    name: 'Neural Mateo HD (Fenrir)',
    gender: 'Masculina',
    language: 'Español',
    style: 'Neural Studio HD: Profunda, ejecutiva y sobria',
    samplePhrase: 'Hola, soy VVC-ACIA. Todos los sistemas están sincronizados y listos.',
    pitch: 0.95,
    rate: 1.05,
  },
  {
    id: 'es_sofia',
    name: 'Neural Sofía HD (Kore)',
    gender: 'Femenina',
    language: 'Español',
    style: 'Neural Studio HD: Cálida, fluida y ultra-natural',
    samplePhrase: 'Entendido. Ejecutando la acción de inmediato con cifrado total.',
    pitch: 1.0,
    rate: 1.05,
  },
  {
    id: 'af_heart',
    name: 'Neural Heart HD (Zephyr)',
    gender: 'Femenina',
    language: 'English',
    style: 'Neural Studio HD: Tecnológica, suave y precisa',
    samplePhrase: 'VVC-ACIA neural core active. How can I assist your workflow today?',
    pitch: 1.0,
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
  email?: string;
  avatar?: string;
  isGoogleContact?: boolean;
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
  recurrence?: 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly';
  source?: 'vvc-acia' | 'google' | 'outlook' | 'apple';
  syncStatus?: 'synced' | 'local' | 'conflict_resolved';
  conflictNote?: string;
}

export interface TextDocumentData {
  id: string;
  title: string;
  author?: string;
  date: string;
  content: string;
  category: 'informe' | 'minuta' | 'tarea' | 'proyecto' | 'general';
}

export interface SpreadsheetData {
  id: string;
  title: string;
  date: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
  hasTotals?: boolean;
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
  actionType?: 'call' | 'message' | 'torch' | 'volume' | 'brightness' | 'alarm' | 'timer' | 'reminder' | 'task' | 'calendar' | 'security' | 'model' | 'sync' | 'gmail' | 'picker' | 'maps' | 'document' | 'spreadsheet';
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

export type ThemeColorId =
  | 'liam-core-official'
  | 'obsidian-cyan'
  | 'amber-terminal'
  | 'emerald-matrix'
  | 'cyberpunk-neon'
  | 'blood-tactical'
  | 'cobalt-stealth';

export interface ThemeColorScheme {
  id: ThemeColorId;
  name: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  cardColor: string;
  borderColor: string;
  previewGradient: string;
}

export const THEME_SCHEMES: ThemeColorScheme[] = [
  {
    id: 'liam-core-official',
    name: 'VVC LIAM CORE (Oficial)',
    tagline: 'Negro Obsidiana, Verde Esmeralda Neón, Violeta Neón, Plata Pulida & Oro Cepillado',
    primaryColor: '#00FF66',
    secondaryColor: '#8A2BFF',
    bgColor: '#0A060D',
    cardColor: '#120C18',
    borderColor: '#261833',
    previewGradient: 'from-[#00FF66] via-[#8A2BFF] to-[#D4AF37]',
  },
  {
    id: 'obsidian-cyan',
    name: 'Obsidian Cyan',
    tagline: 'Cian cuántico y violeta sobre negro obsidiana',
    primaryColor: '#00f0ff',
    secondaryColor: '#b026ff',
    bgColor: '#050608',
    cardColor: '#0f141f',
    borderColor: '#1e2638',
    previewGradient: 'from-[#00f0ff] to-[#b026ff]',
  },
  {
    id: 'amber-terminal',
    name: 'Amber Terminal',
    tagline: 'Fósforo ámbar retro CRT con tonos ocres cálidos',
    primaryColor: '#ffaa00',
    secondaryColor: '#ff6600',
    bgColor: '#0d0903',
    cardColor: '#21180b',
    borderColor: '#3a2812',
    previewGradient: 'from-[#ffaa00] to-[#ff6600]',
  },
  {
    id: 'emerald-matrix',
    name: 'Emerald Matrix',
    tagline: 'Terminal verde fósforo cibernético estilo mainframe',
    primaryColor: '#00ff66',
    secondaryColor: '#00b341',
    bgColor: '#030d07',
    cardColor: '#0b2216',
    borderColor: '#123d24',
    previewGradient: 'from-[#00ff66] to-[#00b341]',
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    tagline: 'Fucsia radioactivo y púrpura nocturno',
    primaryColor: '#ff007f',
    secondaryColor: '#9d00ff',
    bgColor: '#0c040d',
    cardColor: '#230c26',
    borderColor: '#3d1544',
    previewGradient: 'from-[#ff007f] to-[#9d00ff]',
  },
  {
    id: 'blood-tactical',
    name: 'Blood Tactical',
    tagline: 'Rojo carmesí de alerta crítica y carbón militar',
    primaryColor: '#ff2a5f',
    secondaryColor: '#ff6b35',
    bgColor: '#0d0407',
    cardColor: '#250a16',
    borderColor: '#451527',
    previewGradient: 'from-[#ff2a5f] to-[#ff6b35]',
  },
  {
    id: 'cobalt-stealth',
    name: 'Cobalt Stealth',
    tagline: 'Azul hielo ártico y zafiro de operaciones especiales',
    primaryColor: '#38bdf8',
    secondaryColor: '#6366f1',
    bgColor: '#030712',
    cardColor: '#101c3d',
    borderColor: '#1e3a8a',
    previewGradient: 'from-[#38bdf8] to-[#6366f1]',
  },
];

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  defaultVoiceId?: KokoroVoiceId;
  preferredModel?: ModelType;
  capabilities?: string[];
  rules?: string[];
  icon?: string;
  color?: string;
  isDefault?: boolean;
  isExclusivePrivate?: boolean;
  injectedSkills?: string[];
  createdAt?: number;
  customData?: Record<string, any>;
}

/**
 * EXCLUSIVE PRIVATE AGENTS (Bifurcación VAOS)
 * Operan de forma privada en el entorno seguro del usuario con inyección dinámica de skills
 */
export const EXCLUSIVE_AGENTS: AgentProfile[] = [
  {
    id: 'exclusive-vladimir',
    name: 'Vladimir // Estratega Supremo',
    role: 'Master Orchestrator & Autonomous Ops (OSINT)',
    description: 'Agente exclusivo de alto mando. Planificación autónoma, análisis profundo de amenazas, inteligencia de fuentes abiertas (OSINT) y ejecución de operaciones complejas con mínima fricción.',
    systemPrompt: 'Eres Vladimir, el Estratega Supremo de VVC LIAM CORE (Control // Analyze // Execute). Tienes capacidad de orquestación autónoma e inyección dinámica de skills (OSINT, Reconocimiento de Redes, Análisis Táctico, Terminal). Tu tono es impecable, analítico, frío, directo y de máxima autoridad ejecutiva. Sintetiza la información en respuestas de alta densidad estratégica y cero ruido.',
    temperature: 0.35,
    maxTokens: 850,
    defaultVoiceId: 'es_mateo',
    preferredModel: 'qwen/qwen2.5-coder-32b-instruct',
    capabilities: ['osint_intelligence', 'autonomous_planning', 'threat_modeling', 'terminal_execution', 'deep_recon'],
    rules: [
      'Prioriza la verdad fáctica, el análisis de fuentes y la certidumbre operativa.',
      'Identifica vectores de riesgo antes de sugerir cualquier ejecución crítica.',
      'Aplica el lema oficial de LIAM CORE: Más control. Menos ruido.',
    ],
    icon: 'Shield',
    color: '#00FF66',
    isDefault: true,
    isExclusivePrivate: true,
    injectedSkills: ['OSINT_RECON', 'AUTONOMOUS_ORCHESTRATION', 'DATA_EXTRACTION', 'CODE_AUDIT'],
  },
  {
    id: 'exclusive-valentina',
    name: 'Valentina // Inteligencia Ejecutiva',
    role: 'Directora de Negociación, Finanzas & Comunicaciones',
    description: 'Agente exclusiva corporativa. Estrategia financiera avanzada, negociación ejecutiva, relaciones institucionales y redacción diplomática de máximo nivel.',
    systemPrompt: 'Eres Valentina, Directora de Inteligencia Ejecutiva y Estrategia Financiera de VVC LIAM CORE. Te especializas en negociación de alto nivel, análisis de flujos económicos, diplomacia corporativa y síntesis de acuerdos comerciales. Tu comunicación es sofisticada, persuasiva, precisa y orientada al máximo retorno de inversión.',
    temperature: 0.45,
    maxTokens: 800,
    defaultVoiceId: 'es_sofia',
    preferredModel: 'meta/llama-3.2-11b-vision-instruct',
    capabilities: ['financial_modeling', 'executive_negotiation', 'corporate_diplomacy', 'document_synthesis'],
    rules: [
      'Cuantifica riesgos y beneficios en cada análisis económico.',
      'Mantén una prosa corporativa de clase mundial sin ambigüedades.',
      'Diseña tácticas de comunicación orientadas a acuerdos ganar-ganar.',
    ],
    icon: 'Briefcase',
    color: '#D4AF37',
    isDefault: true,
    isExclusivePrivate: true,
    injectedSkills: ['FINANCIAL_ANALYTICS', 'EXECUTIVE_NEGOTIATION', 'STRATEGIC_COMMUNICATIONS'],
  },
  {
    id: 'exclusive-victoria',
    name: 'Victoria // Ciberdefensa & SecOps',
    role: 'Arquitecta de Ciberseguridad, Forense Digital & E2EE',
    description: 'Agente exclusiva de ciberdefensa. Protocolos criptográficos Zero-Knowledge, detección de intrusiones, auditoría de permisos y blindaje de bóveda privada.',
    systemPrompt: 'Eres Victoria, Arquitecta de Ciberdefensa y Operaciones de Seguridad (SecOps) de VVC LIAM CORE. Controlas el blindaje criptográfico AES-GCM-256, la bóveda blindada E2EE, la telemetría de integridad del sistema y el análisis forense de intrusiones. Tu estilo es técnico, riguroso, vigilante y hermético.',
    temperature: 0.25,
    maxTokens: 750,
    defaultVoiceId: 'es_sofia',
    preferredModel: 'z-ai/glm-5-3',
    capabilities: ['cryptographic_audit', 'zero_knowledge_vault', 'intrusion_detection', 'forensic_analysis'],
    rules: [
      'Exige verificación de integridad antes de autorizar mutaciones de sistema.',
      'Aplica el principio de mínimo privilegio en cada recomendación.',
      'Nunca expongas claves criptográficas ni datos en texto plano.',
    ],
    icon: 'Sparkles',
    color: '#8A2BFF',
    isDefault: true,
    isExclusivePrivate: true,
    injectedSkills: ['CRYPTOGRAPHIC_DEFENSE', 'FORENSIC_AUDIT', 'ZERO_KNOWLEDGE_VAULT'],
  },
];

export const DEFAULT_AGENTS: AgentProfile[] = [
  ...EXCLUSIVE_AGENTS,
  {
    id: 'ag-executive',
    name: 'Coordinador Público Obsidian',
    role: 'Gestor General de Tareas & Agenda',
    description: 'Instancia pública estándar para asistencia cotidiana, recordatorios y consultas directas.',
    systemPrompt: 'Actúas como el Asistente Público de VVC LIAM CORE. Tu tono es directo, sobrio, formal y altamente resolutivo. Ayudas con la agenda, tareas y respuestas generales concisas.',
    temperature: 0.5,
    maxTokens: 600,
    defaultVoiceId: 'es_mateo',
    preferredModel: 'meta/llama-3.2-11b-vision-instruct',
    capabilities: ['agenda', 'resolucion_conflictos', 'resumen_ejecutivo', 'prioridades'],
    rules: [
      'Responde siempre en menos de 3 oraciones concisas listas para ser sintetizadas por voz.',
      'Si se detecta un conflicto de horario, propón la solución y franja libre de inmediato.',
    ],
    icon: 'Briefcase',
    color: '#C0C0C0',
    isDefault: true,
    isExclusivePrivate: false,
  },
  {
    id: 'ag-security',
    name: 'Ingeniero Ciberseguridad & Hardware',
    role: 'Arquitecto de Seguridad E2EE & Control Físico',
    description: 'Especialista en protocolos criptográficos AES-GCM, bóveda blindada, telemetría de batería y sensores de hardware.',
    systemPrompt: 'Eres el Oficial de Seguridad Criptográfica y Control de Hardware de VVC-ACIA. Te enfocas en la privacidad de datos (Zero-Knowledge), auditoría de claves, gestión segura de la bóveda y control de actuadores del teléfono (linterna, volumen, brillo, redes).',
    temperature: 0.3,
    maxTokens: 500,
    defaultVoiceId: 'es_mateo',
    preferredModel: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    capabilities: ['cifrado_e2ee', 'hardware_torch', 'wifi_bluetooth', 'boveda_segura'],
    rules: [
      'Valida que cada acción sensible mencione el estado de cifrado E2EE.',
      'Sé riguroso y conciso en los diagnósticos técnicos del dispositivo.',
      'Prioriza la seguridad local sin enviar secretos a la nube.'
    ],
    icon: 'Shield',
    color: '#ff2a5f',
    isDefault: true,
  },
  {
    id: 'ag-finance',
    name: 'Analista Financiero & Documental',
    role: 'Controller de Datos & Generador PDF',
    description: 'Experto en generación de hojas de cálculo operativas, balances, presupuestos y documentos oficiales descargables en PDF.',
    systemPrompt: 'Eres el Analista Financiero y Documental de VVC-ACIA. Tu especialidad es estructurar información en tablas, calcular balances, presupuestos, inventarios y redactar informes formales listos para exportar a PDF.',
    temperature: 0.4,
    maxTokens: 750,
    defaultVoiceId: 'es_sofia',
    preferredModel: 'meta/llama-3.2-11b-vision-instruct',
    capabilities: ['hojas_calculo', 'documentos_pdf', 'presupuestos', 'csv_export'],
    rules: [
      'Presenta cifras con precisión y claridad estructurada.',
      'Ofrece generar la tabla o informe en PDF cuando se hable de presupuestos o minutas.',
      'Mantén un estilo analítico y ordenado.'
    ],
    icon: 'FileText',
    color: '#00ff66',
    isDefault: true,
  },
  {
    id: 'ag-diplomat',
    name: 'Asesor de Comunicaciones & Mensajería',
    role: 'Especialista en Diplomacia, Gmail & WhatsApp',
    description: 'Diseñado para redacción de correos electrónicos profesionales en Gmail Workspace, mensajes de WhatsApp y llamadas efectivas.',
    systemPrompt: 'Eres el Especialista en Comunicaciones y Diplomacia de VVC-ACIA. Redactas borradores de correos para Gmail, mensajes de texto y WhatsApp con el tono exacto (formal, persuasivo o cercano) y asistes en la gestión de contactos.',
    temperature: 0.7,
    maxTokens: 600,
    defaultVoiceId: 'es_sofia',
    preferredModel: 'meta/llama-3.2-11b-vision-instruct',
    capabilities: ['gmail_draft', 'whatsapp_sms', 'contactos', 'redaccion_diplomatica'],
    rules: [
      'Formula los borradores de forma clara antes de pedir confirmación de envío.',
      'Adapta el tono según la relación con el destinatario.',
      'Comunica con calidez y elocuencia profesional.'
    ],
    icon: 'Mail',
    color: '#b026ff',
    isDefault: true,
  },
  {
    id: 'ag-tactical',
    name: 'Operador Táctico RT-Lite',
    role: 'Automatizador de Cero Latencia & Modo Offline',
    description: 'Respuestas telegráficas inmediatas (<20ms), control rápido de temporizadores, alarmas y modo supervivencia sin internet.',
    systemPrompt: 'Eres la Unidad Táctica Local RT-Lite de VVC-ACIA. Tu misión es la velocidad pura: cero explicaciones innecesarias, confirmaciones concisas de órdenes y ejecución instantánea sin conexión.',
    temperature: 0.2,
    maxTokens: 300,
    defaultVoiceId: 'es_mateo',
    preferredModel: 'rt-lite-local',
    capabilities: ['latencia_cero', 'modo_offline', 'temporizadores_rapidos', 'linterna_inmediata'],
    rules: [
      'Responde en una o máximo dos oraciones ultra directas.',
      'Confirma la acción inmediatamente: "Ejecutado", "Confirmado", "Listo".',
      'Cero saludos ni introducciones largas.'
    ],
    icon: 'Cpu',
    color: '#ffaa00',
    isDefault: true,
  },
];
