import React, { useState } from 'react';
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
  Palette
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
}) => {
  const [apiKeyInput, setApiKeyInput] = useState(nvidiaApiKey);
  const [endpointInput, setEndpointInput] = useState(customEndpoint || 'https://integrate.api.nvidia.com/v1/chat/completions');
  const [webhookInput, setWebhookInput] = useState(thirdPartyWebhookUrl);
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return 'Notification' in window ? Notification.permission : 'default';
  });

  if (!isOpen) return null;

  const handleSaveKeys = () => {
    onUpdateNvidiaApiKey(apiKeyInput.trim());
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

  const handleRequestPushNotifications = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        new Notification('VVC-ACIA // Notificaciones Activas', {
          body: 'Las alertas de tareas y recordatorios en tiempo real se mostrarán en tu sistema.',
          icon: '/favicon.ico',
        });
      }
    }
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
      <div className="w-full max-w-2xl bg-[#080b12] border border-[#1e2638] rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2638]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#00f0ff]" />
            <h3 className="font-mono text-sm font-bold text-white tracking-wider">
              Configuración de Modelos & Servicios en la Nube
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#121622] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1 font-mono text-xs">
          {/* SECTION 1: SELECCIÓN DE MODELO Y SERVICIOS CLOUD (DROPDOWNS) */}
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
                  <option value="nvidia/nemotron-3.5-lightning-30b-a3b||google_calendar">
                    Nemotron 3.5 Lightning 30B + Google Calendar & Tasks (Recomendado)
                  </option>
                  <option value="nvidia/nemotron-3.5-lightning-30b-a3b||notion_workspace">
                    Nemotron 3.5 Lightning 30B + Notion Workspace Live DB
                  </option>
                  <option value="nvidia/nemotron-3.5-lightning-30b-a3b||enterprise_hybrid">
                    Nemotron 3.5 Lightning 30B + Suite Empresarial Híbrida Multi-Cloud
                  </option>
                  <option value="deepseek-ai/deepseek-v4.1-flash||todoist_sync">
                    DeepSeek V4.1 Flash + Todoist Real-Time Task Flow
                  </option>
                  <option value="z-ai/glm-5-3||slack_webhooks">
                    GLM-5.3 + Slack Automated Alerts Webhooks
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
                1. Selección Individual de Modelo Neuronal (NVIDIA Build & RT-Lite):
              </label>
              <select
                value={currentModel}
                onChange={(e) => onSelectModel(e.target.value as ModelType)}
                className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded p-2 text-xs text-slate-100 focus:outline-none"
              >
                <optgroup label="Motor On-Device">
                  <option value="rt-lite-local">
                    RT-Lite On-Device (0ms latencia, 100% Offline, sin API Key)
                  </option>
                </optgroup>
                <optgroup label="Modelos NVIDIA Build NIM">
                  {AVAILABLE_MODELS.filter((m) => m.id !== 'rt-lite-local').map((m) => (
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
                <span className="text-slate-400">{currentModelObj.provider}</span>
              </div>
              <p className="text-slate-300">{currentModelObj.description}</p>
              <div className="flex items-center justify-between pt-1 border-t border-[#1e2638] text-[10px]">
                <span className="text-emerald-400">Servicio Cloud Activo: {currentCloudObj.name}</span>
                <span className="text-slate-400">{currentCloudObj.badge}</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: ESQUEMA DE COLOR DE LA INTERFAZ (VARIABLES CSS) */}
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

          {/* SECTION 3: NOTIFICACIONES EN TIEMPO REAL & WEB PUSH */}
          <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-400" />
                Notificaciones en Tiempo Real & Alertas del Sistema
              </span>
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                VVC-ACIA Watcher
              </span>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed">
              El asistente monitorea continuamente las tareas y recordatorios cada segundo, emitiendo tonos acústicos y anuncios vocales de Kokoro TTS cuando llega la hora programada.
            </p>

            <div className="flex items-center justify-between p-2.5 rounded bg-[#07090e] border border-[#1e2638]">
              <div>
                <div className="text-xs text-white">Notificaciones Web del Navegador (Push)</div>
                <div className="text-[10px] text-slate-400">
                  Estado actual: <span className="text-[#00f0ff] font-bold uppercase">{notificationPermission}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRequestPushNotifications}
                className="px-3 py-1.5 rounded bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 text-xs transition-colors"
              >
                {notificationPermission === 'granted' ? 'Permitidas ✓' : 'Solicitar Permiso'}
              </button>
            </div>
          </div>

          {/* SECTION 3: KOKORO VOICE ENGINE CONFIGURATION */}
          <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-[#00f0ff]" />
                Motor de Voz Realista Kokoro (TTS)
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                Kokoro Core Integrado
              </span>
            </div>

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

          {/* SECTION 4: CREDENCIALES & ENDPOINTS NVIDIA BUILD */}
          <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Key className="w-4 h-4 text-[#ff2a5f]" />
                Credenciales NVIDIA Build & Webhooks de Terceros
              </span>
              <a
                href="https://build.nvidia.com"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#00f0ff] hover:underline flex items-center gap-1"
              >
                <span>Obtener API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                NVIDIA API Key:
              </label>
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
                Endpoint Base URL:
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

          {/* SECTION 5: PANTALLA & SINCRONIZACION */}
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
        </div>
      </div>
    </div>
  );
};
