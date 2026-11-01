import React, { useState, useEffect } from 'react';
import { 
  X, 
  Cpu, 
  Volume2, 
  Key, 
  Globe, 
  Moon, 
  Cloud, 
  Check, 
  ExternalLink, 
  Play, 
  Sparkles,
  Sliders,
  ShieldCheck,
  Bell,
  Share2,
  Calendar,
  Layers,
  Palette,
  Radio,
  Smartphone,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle
} from 'lucide-react';
import { 
  AVAILABLE_MODELS, 
  KOKORO_VOICES, 
  CLOUD_INTEGRATIONS,
  THEME_SCHEMES,
  type ModelType, 
  type KokoroVoiceId,
  type CloudServiceIntegrationType,
  type ThemeColorId
} from '../types';
import { speakKokoro } from '../utils/speech';
import { NOTIFICATIONS_DISABLED_MESSAGE } from '../shared/notificationPolicy';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: ModelType;
  onSelectModel: (m: ModelType) => void;
  currentCloudIntegration: CloudServiceIntegrationType;
  onSelectCloudIntegration: (ci: CloudServiceIntegrationType) => void;
  nvidiaApiKey: string;
  onUpdateNvidiaApiKey: (key: string) => void;
  customEndpoint: string;
  onUpdateCustomEndpoint: (url: string) => void;
  thirdPartyWebhookUrl: string;
  onUpdateThirdPartyWebhookUrl: (url: string) => void;
  selectedVoiceId: KokoroVoiceId;
  onSelectVoiceId: (id: KokoroVoiceId) => void;
  pitchModifier: number;
  onUpdatePitch: (p: number) => void;
  rateModifier: number;
  onUpdateRate: (r: number) => void;
  autoDarkMode: boolean;
  onToggleAutoDarkMode: () => void;
  cloudSyncEnabled: boolean;
  onToggleCloudSync: () => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  currentTheme: ThemeColorId;
  onSelectTheme: (theme: ThemeColorId) => void;
  geminiApiKey?: string;
  onUpdateGeminiApiKey?: (key: string) => void;
  onOpenSecrets?: () => void;
  onOpenHelp?: () => void;
  onOpenInstallModal?: () => void;
  initialSection?: 'all' | 'models' | 'keys' | 'voice' | 'themes' | 'push' | 'help';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentModel,
  onSelectModel,
  currentCloudIntegration,
  onSelectCloudIntegration,
  nvidiaApiKey,
  onUpdateNvidiaApiKey,
  customEndpoint,
  onUpdateCustomEndpoint,
  thirdPartyWebhookUrl,
  onUpdateThirdPartyWebhookUrl,
  selectedVoiceId,
  onSelectVoiceId,
  pitchModifier,
  onUpdatePitch,
  rateModifier,
  onUpdateRate,
  autoDarkMode,
  onToggleAutoDarkMode,
  cloudSyncEnabled,
  onToggleCloudSync,
  isOffline,
  onToggleOffline,
  currentTheme,
  onSelectTheme,
  geminiApiKey,
  onUpdateGeminiApiKey,
  onOpenSecrets,
  onOpenHelp,
  onOpenInstallModal,
  initialSection = 'all',
}) => {
  const [activeSection, setActiveSection] = useState<'all' | 'models' | 'keys' | 'voice' | 'themes' | 'push' | 'help'>(initialSection);

  useEffect(() => {
    if (isOpen && initialSection) {
      setActiveSection(initialSection);
    }
  }, [isOpen, initialSection]);
  const [apiKeyInput, setApiKeyInput] = useState(nvidiaApiKey);
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => geminiApiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('vvc_secret_gemini_api_key') || '' : ''));
  const [endpointInput, setEndpointInput] = useState(customEndpoint || 'https://integrate.api.nvidia.com/v1/chat/completions');
  const [webhookInput, setWebhookInput] = useState(thirdPartyWebhookUrl);
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  if (!isOpen) return null;

  const handleSaveKeys = () => {
    onUpdateNvidiaApiKey(apiKeyInput.trim());
    if (onUpdateGeminiApiKey) {
      onUpdateGeminiApiKey(geminiKeyInput.trim());
    } else {
      localStorage.setItem('vvc_secret_gemini_api_key', geminiKeyInput.trim());
    }
    onUpdateCustomEndpoint(endpointInput.trim());
    onUpdateThirdPartyWebhookUrl(webhookInput.trim());
    setIsKeySaved(true);
    setTimeout(() => setIsKeySaved(false), 2500);
  };

  const handleTestKokoroVoice = () => {
    setIsTestingVoice(true);
    const voice = KOKORO_VOICES.find((v) => v.id === selectedVoiceId) || KOKORO_VOICES[0];
    speakKokoro(voice.samplePhrase, selectedVoiceId, {
      pitchModifier,
      rateModifier,
      onEnd: () => setIsTestingVoice(false),
    });
  };

  const currentVoiceObj = KOKORO_VOICES.find((v) => v.id === selectedVoiceId) || KOKORO_VOICES[0];
  const currentModelObj = AVAILABLE_MODELS.find((m) => m.id === currentModel) || AVAILABLE_MODELS[0];
  const currentCloudObj = CLOUD_INTEGRATIONS.find((c) => c.id === currentCloudIntegration) || CLOUD_INTEGRATIONS[0];

  // Combined preset options
  const handlePresetSelect = (comboKey: string) => {
    const [modelPart, cloudPart] = comboKey.split('||');
    if (modelPart) onSelectModel(modelPart as ModelType);
    if (cloudPart) onSelectCloudIntegration(cloudPart as CloudServiceIntegrationType);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-[#080b12] border border-[#1e2638] rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2638]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#00f0ff]" />
            <h3 className="font-mono text-sm font-bold text-white tracking-wider">
              VVC LIAM CORE // Centro de Configuración Global
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#121622] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Unified Navigation Tabs Bar */}
        <div className="flex items-center gap-1 overflow-x-auto py-2.5 border-b border-[#1e2638] text-[11px] font-mono shrink-0 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveSection('all')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'all'
                ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-bold border border-[#00f0ff]/50 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            📋 Ver Todo
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('models')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'models'
                ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-bold border border-[#00f0ff]/50 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            ⚙️ Modelos & Cloud
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('keys')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'keys'
                ? 'bg-[#ff2a5f]/20 text-[#ff2a5f] font-bold border border-[#ff2a5f]/50 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            🔑 Claves & Secretos
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('voice')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'voice'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/50 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            🔊 Voz Kokoro (TTS)
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('themes')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'themes'
                ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/50 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            🎨 Temas & Color
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('push')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'push'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/50 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            🔔 Notificaciones Push
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('help')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'help'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/50 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            ❓ Ayuda & Atajos
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1 font-mono text-xs">
          {/* SECTION 1: SELECCIÓN DE MODELO Y SERVICIOS CLOUD */}
          {(activeSection === 'all' || activeSection === 'models') && (
          <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-[#b026ff]" />
                Arquitectura de IA & Integración Cloud
              </span>
              <span className="text-[10px] text-[#00f0ff] bg-[#00f0ff]/10 px-2 py-0.5 rounded border border-[#00f0ff]/30">
                Configuración Rápida
              </span>
            </div>

            {/* UNIFIED DROPDOWN PRESET */}
            <div>
              <label className="text-[11px] text-slate-300 block mb-1.5 font-bold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#00f0ff]" />
                Lista Desplegable Combinada (Modelo IA + Servicio Cloud):
              </label>
              <select
                value={`${currentModel}||${currentCloudIntegration}`}
                onChange={(e) => handlePresetSelect(e.target.value)}
                className="w-full bg-[#06080d] border border-[#00f0ff]/60 focus:border-[#00f0ff] rounded p-2.5 text-xs text-[#00f0ff] font-semibold focus:outline-none"
              >
                <optgroup label="Entorno On-Device (RT-Lite)">
                  <option value="rt-lite-local||local_only">
                    RT-Lite On-Device + Modo Local Autónomo (100% Offline / Privacidad Absoluta)
                  </option>
                  <option value="rt-lite-local||google_calendar">
                    RT-Lite On-Device + Google Calendar & Tasks Cloud Sync
                  </option>
                  <option value="rt-lite-local||notion_workspace">
                    RT-Lite On-Device + Notion Workspace Live DB
                  </option>
                </optgroup>

                <optgroup label="Modelos Avanzados NVIDIA Build + Integraciones Cloud">
                  <option value="qwen/qwen2.5-coder-32b-instruct||notion_workspace">
                    Qwen 2.5 Coder 32B + Notion Workspace (Ingeniería de Software & Arquitectura)
                  </option>
                  <option value="mistralai/codestral-22b-instruct-v0.1||slack_webhooks">
                    Codestral 22B + Slack Dev Alerts (Pruebas Unitarias & FIM)
                  </option>
                  <option value="z-ai/glm-5-3||enterprise_hybrid">
                    GLM-5.3 Flagship (Full Engine) + Suite Empresarial Híbrida (Máximo Razonamiento)
                  </option>
                  <option value="z-ai/glm-5-3-flash||slack_webhooks">
                    GLM-5.3 Flash (Lite Edition) + Slack Webhooks (Baja Latencia & Voz)
                  </option>
                  <option value="deepseek-ai/deepseek-r1||notion_workspace">
                    DeepSeek R1 + Notion Live DB (Cadena de Pensamiento CoT)
                  </option>
                  <option value="nvidia/nemotron-3.5-lightning-30b-a3b||google_calendar">
                    Nemotron 3.5 Lightning 30B + Google Calendar & Tasks (Recomendado VAOS)
                  </option>
                  <option value="meta/llama-3.2-11b-vision-instruct||google_calendar">
                    Llama 3.2 11B Vision Fast + Google Calendar (Voz Ultrarrápida &lt;1s)
                  </option>
                  <option value="nvidia/nemotron-3-ultra-550b-a55b||enterprise_hybrid">
                    Nemotron 3 Ultra 550B + Multi-Cloud Enterprise Sync
                  </option>
                  <option value="google/gemma-4-31b-it||google_calendar">
                    Gemma 4 31B IT + Google Workspace Cloud Sync
                  </option>
                </optgroup>
              </select>
            </div>

            {/* SEPARATE DROPDOWN 1: AI MODEL */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                1. Selección Individual de Modelo Neuronal ({AVAILABLE_MODELS.length} Modelos Disponibles):
              </label>
              <select
                value={currentModel}
                onChange={(e) => onSelectModel(e.target.value as ModelType)}
                className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded p-2 text-xs text-slate-100 focus:outline-none"
              >
                <optgroup label="💻 Especialistas en Código & Programación (NVIDIA NIM)">
                  {AVAILABLE_MODELS.filter((m) => m.domain === 'coding').map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.bestFor}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🧠 Razonamiento Profundo & Flagship (NVIDIA NIM)">
                  {AVAILABLE_MODELS.filter((m) => m.domain === 'flagship_reasoning').map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.bestFor}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="⚡ Ultra-Baja Latencia & Voz Rápida (NVIDIA NIM)">
                  {AVAILABLE_MODELS.filter((m) => m.domain === 'fast_voice').map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.bestFor}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="👁️ Multimodal, Visión & Agentes VAOS">
                  {AVAILABLE_MODELS.filter((m) => m.domain === 'agents_tools' || m.domain === 'multimodal').map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.bestFor}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🛡️ Motores Locales RT-Lite (100% Offline / Cero Latencia)">
                  {AVAILABLE_MODELS.filter((m) => m.domain === 'offline_device').map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.bestFor}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* SEPARATE DROPDOWN 2: CLOUD SERVICE INTEGRATION */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                2. Selección de Integración con Servicios en la Nube:
              </label>
              <select
                value={currentCloudIntegration}
                onChange={(e) => onSelectCloudIntegration(e.target.value as CloudServiceIntegrationType)}
                className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#b026ff] rounded p-2 text-xs text-slate-100 focus:outline-none"
              >
                {CLOUD_INTEGRATIONS.map((ci) => (
                  <option key={ci.id} value={ci.id}>
                    {ci.name} ({ci.provider}) · {ci.badge}
                  </option>
                ))}
              </select>
            </div>

            {/* Active Integration Summary Card */}
            <div className="p-3 rounded-lg bg-[#07090e] border border-[#1e2638] text-[11px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#00f0ff] font-semibold">{currentModelObj.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2638] text-slate-300 font-mono">
                  {currentModelObj.tier} · {currentModelObj.contextWindow || '128K'}
                </span>
              </div>
              <p className="text-slate-300">{currentModelObj.description}</p>
              <div className="flex items-center justify-between pt-1 border-t border-[#1e2638] text-[10px]">
                <span className="text-emerald-400">Servicio Cloud Activo: {currentCloudObj.name}</span>
                <span className="text-slate-400">{currentCloudObj.badge}</span>
              </div>
            </div>
          </div>
          )}

          {/* SECTION 2: ESQUEMA DE COLOR DE LA INTERFAZ (VARIABLES CSS) */}
          {(activeSection === 'all' || activeSection === 'themes') && (
          <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-[#00f0ff]" />
                Esquema de Color de la Interfaz (Variables CSS)
              </span>
              <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30 font-mono">
                {THEME_SCHEMES.find((t) => t.id === currentTheme)?.name.split(' ')[0]}
              </span>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed">
              Personaliza el entorno visual del sistema mediante variables CSS dinámicas. Modifica la paleta cromática, orbe de voz, terminal y resplandores en tiempo real.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {THEME_SCHEMES.map((scheme) => {
                const isSelected = currentTheme === scheme.id;
                return (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => onSelectTheme(scheme.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                        : 'border-[#1e2638] bg-[#07090e] hover:border-slate-600 hover:bg-[#0c101a]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono font-bold text-slate-100 flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-white/20 shrink-0 shadow-sm"
                          style={{ backgroundColor: scheme.primaryColor }}
                        />
                        <span>{scheme.name}</span>
                      </span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          ACTIVO
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 leading-tight mb-2.5">
                      {scheme.tagline}
                    </p>

                    {/* Color Swatch Strip */}
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-800/60">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-4 h-4 rounded-md border border-white/10 shadow-sm"
                          style={{ backgroundColor: scheme.primaryColor }}
                          title={`Primario: ${scheme.primaryColor}`}
                        />
                        <div
                          className="w-4 h-4 rounded-md border border-white/10 shadow-sm"
                          style={{ backgroundColor: scheme.secondaryColor }}
                          title={`Secundario: ${scheme.secondaryColor}`}
                        />
                        <div
                          className="w-4 h-4 rounded-md border border-white/10 shadow-sm"
                          style={{ backgroundColor: scheme.bgColor }}
                          title={`Fondo: ${scheme.bgColor}`}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        {scheme.primaryColor}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* Notification delivery is unavailable; PWA installation is independent. */}
          {(activeSection === 'all' || activeSection === 'push') && (
            <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-4" data-notifications-enabled="false">
              <span className="text-xs font-semibold text-white">Notificaciones deshabilitadas</span>
              <p className="text-slate-400 text-xs leading-relaxed">{NOTIFICATIONS_DISABLED_MESSAGE}</p>
              <p className="text-slate-400 text-xs leading-relaxed">
                Los permisos y suscripciones anteriores se conservan. Las instalaciones anteriores necesitan recibir y activar la actualización del Service Worker.
              </p>
              {onOpenInstallModal && (
                <button type="button" onClick={onOpenInstallModal}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/50 text-xs font-semibold">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Instalar App en Android / Generar APK</span>
                </button>
              )}
            </div>
          )}

          {/* SECTION 4: KOKORO VOICE ENGINE CONFIGURATION */}
          {(activeSection === 'all' || activeSection === 'voice') && (
          <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-[#00f0ff]" />
                Motor de Voz Realista Kokoro (TTS en Español)
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                Studio Neural & Fallback Local
              </span>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed">
              VVC LIAM CORE implementa síntesis neural de alta fidelidad en español con entonación natural (Álvaro, Elvira, Camila, Lucas, Mateo, Sofía) respaldado por motor Edge-TTS y compatibilidad on-device Web Speech API calibrada para funcionamiento sin conexión.
            </p>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1.5">
                Perfil de Voz Kokoro:
              </label>
              <select
                value={selectedVoiceId}
                onChange={(e) => onSelectVoiceId(e.target.value as KokoroVoiceId)}
                className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded p-2 text-xs text-slate-100 focus:outline-none"
              >
                {KOKORO_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.language} - {v.gender}) · {v.style}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <span>Tono / Pitch Kokoro</span>
                  <span className="text-[#00f0ff] tabular-nums">{(pitchModifier * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.4}
                  step={0.05}
                  value={pitchModifier}
                  onChange={(e) => onUpdatePitch(parseFloat(e.target.value))}
                  className="w-full accent-[#00f0ff] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <span>Velocidad de Habla</span>
                  <span className="text-[#00f0ff] tabular-nums">{(rateModifier * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.5}
                  step={0.05}
                  value={rateModifier}
                  onChange={(e) => onUpdateRate(parseFloat(e.target.value))}
                  className="w-full accent-[#00f0ff] cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1e2638]">
              <span className="text-[10px] text-slate-400 italic truncate max-w-xs">
                "{currentVoiceObj.samplePhrase}"
              </span>
              <button
                type="button"
                onClick={handleTestKokoroVoice}
                disabled={isTestingVoice}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 text-xs transition-colors shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isTestingVoice ? 'Reproduciendo...' : 'Probar Voz'}</span>
              </button>
            </div>
          </div>
          )}

          {/* SECTION 5: CREDENCIALES & CLAVES SECRETAS DE APIS */}
          {(activeSection === 'all' || activeSection === 'keys') && (
          <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Key className="w-4 h-4 text-[#ff2a5f]" />
                Credenciales de Modelos & Secretos de APIs
              </span>
              {onOpenSecrets && (
                <button
                  type="button"
                  onClick={onOpenSecrets}
                  className="text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded font-semibold flex items-center gap-1"
                >
                  <Key className="w-2.5 h-2.5" />
                  <span>Bóveda Completa de Secretos</span>
                </button>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-400">
                  Google Gemini API Key:
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-[#00f0ff] hover:underline flex items-center gap-1"
                >
                  <span>Obtener Gemini Key</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="password"
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#38bdf8] rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-400">
                  NVIDIA NIM API Key:
                </label>
                <a
                  href="https://build.nvidia.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-[#00f0ff] hover:underline flex items-center gap-1"
                >
                  <span>Obtener NVIDIA Key</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="nvapi-..."
                className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#ff2a5f] rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Endpoint Base URL (NVIDIA / Custom LLM):
              </label>
              <input
                type="text"
                value={endpointInput}
                onChange={(e) => setEndpointInput(e.target.value)}
                placeholder="https://integrate.api.nvidia.com/v1/chat/completions"
                className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                URL de Webhook para Servicios Terceros (Slack / Zapier / Notion):
              </label>
              <input
                type="url"
                value={webhookInput}
                onChange={(e) => setWebhookInput(e.target.value)}
                placeholder="https://hooks.slack.com/services/... o webhook endpoint"
                className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#b026ff] rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSaveKeys}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#00f0ff] hover:bg-[#00d0df] text-black font-semibold text-xs transition-all shadow-[0_0_10px_rgba(0,240,255,0.3)]"
              >
                {isKeySaved ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{isKeySaved ? 'Guardado Exitosamente' : 'Guardar Configuración'}</span>
              </button>
            </div>
          </div>
          )}

          {/* SECTION 6: PANTALLA & SINCRONIZACION */}
          {(activeSection === 'all' || activeSection === 'models') && (
          <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-3">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Moon className="w-4 h-4 text-[#00f0ff]" />
              Pantalla & Sincronización en la Nube
            </span>

            <div className="flex items-center justify-between p-2 rounded bg-[#07090e] border border-[#1e2638]">
              <div>
                <div className="text-xs text-slate-200">Modo Oscuro Automático</div>
                <div className="text-[10px] text-slate-400">
                  Reduce la fatiga visual adaptando el contraste según la hora del sistema.
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleAutoDarkMode}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
                  autoDarkMode ? 'bg-[#00f0ff]' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-black transition-transform ${
                    autoDarkMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#07090e] border border-[#1e2638]">
              <div>
                <div className="text-xs text-slate-200">Sincronización en la Nube en Tiempo Real</div>
                <div className="text-[10px] text-slate-400">
                  Sincroniza agenda, recordatorios y estado entre dispositivos mediante túnel cifrado.
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleCloudSync}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
                  cloudSyncEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-black transition-transform ${
                    cloudSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-[#07090e] border border-[#1e2638]">
              <div>
                <div className="text-xs text-slate-200">Forzar Modo Offline</div>
                <div className="text-[10px] text-slate-400">
                  Desconecta de la red y delega todo el control al motor RT-Lite Local.
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleOffline}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
                  isOffline ? 'bg-[#ff2a5f]' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    isOffline ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
          )}

          {/* SECTION 7: CENTRO DE AYUDA, ATAJOS Y DIRECTIVAS */}
          {(activeSection === 'all' || activeSection === 'help') && (
            <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  Atajos de Voz & Directivas Operativas
                </span>
                {onOpenHelp && (
                  <button
                    type="button"
                    onClick={onOpenHelp}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Abrir Centro de Ayuda Completo</span>
                  </button>
                )}
              </div>

              <p className="text-slate-400 text-xs leading-relaxed">
                VVC LIAM CORE opera por voz y texto sin fricción. A continuación se presentan los comandos clave más utilizados:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-[#07090e] border border-slate-800">
                  <div className="text-[#00f0ff] font-bold">"Llamar a [Contacto]"</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Ejecuta llamada de voz directa con control de altavoz.</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#07090e] border border-slate-800">
                  <div className="text-emerald-400 font-bold">"Encender / Apagar Linterna"</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Controla la antorcha física de la cámara o pantalla.</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#07090e] border border-slate-800">
                  <div className="text-purple-400 font-bold">"Poner alarma a las [HH:MM]"</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Programa alarma con timbre cyber acústico.</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#07090e] border border-slate-800">
                  <div className="text-amber-400 font-bold">"Crear reunión [Título] a las [HH:MM]"</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Inserta evento en la agenda y detecta conflictos.</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#07090e] border border-slate-800">
                  <div className="text-cyan-400 font-bold">"Activar agente [Vladimir / Valentina / Victoria]"</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Bifurca directivas especializadas del agente.</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#07090e] border border-slate-800">
                  <div className="text-rose-400 font-bold">"Guardar nota secreta / Bóveda"</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Cifra en AES-GCM-256 en la bóveda de seguridad.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
