import React, { useState } from 'react';
import { 
  Cpu, 
  Sparkles, 
  Bot, 
  Plus, 
  Key, 
  Globe, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Check, 
  ExternalLink,
  Zap,
  SlidersHorizontal,
  ChevronDown,
  Lock
} from 'lucide-react';
import type { AgentProfile, ModelType } from '../types';
import { AVAILABLE_MODELS } from '../types';
import { SecretsService } from '../services/secretsService';

interface ModelAgentControlBarProps {
  currentModel: ModelType;
  onSelectModel: (model: ModelType) => void;
  activeAgentId: string;
  agents: AgentProfile[];
  onSelectAgent: (agentId: string) => void;
  onOpenAddAgent: () => void;
  onOpenAllAgents: () => void;
  onNotify?: (message: string) => void;
}

export const ModelAgentControlBar: React.FC<ModelAgentControlBarProps> = ({
  currentModel,
  onSelectModel,
  activeAgentId,
  agents,
  onSelectAgent,
  onOpenAddAgent,
  onOpenAllAgents,
  onNotify,
}) => {
  // Active Tab for credentials & details drawer (or can be collapsed)
  const [activeTab, setActiveTab] = useState<'nvidia' | 'gemini' | 'cloud' | 'rt-lite' | 'agents' | null>(null);

  // Manual API Key inputs state
  const [nvidiaKeyInput, setNvidiaKeyInput] = useState(() => SecretsService.getSecret('nvidia_api_key'));
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => SecretsService.getSecret('gemini_api_key'));
  const [cloudEndpointInput, setCloudEndpointInput] = useState(() => SecretsService.getSecret('custom_endpoint') || 'https://api.groq.com/openai/v1/chat/completions');
  const [cloudTokenInput, setCloudTokenInput] = useState(() => SecretsService.getSecret('custom_api_key'));
  const [cloudModelInput, setCloudModelInput] = useState(() => SecretsService.getSecret('custom_model') || 'llama-3.3-70b-versatile');

  // Show/Hide password toggles
  const [showNvidiaKey, setShowNvidiaKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showCloudToken, setShowCloudToken] = useState(false);

  // Saved confirmation animations
  const [savedNvidia, setSavedNvidia] = useState(false);
  const [savedGemini, setSavedGemini] = useState(false);
  const [savedCloud, setSavedCloud] = useState(false);

  // Selected sub-models in selects
  const nvidiaModels = AVAILABLE_MODELS.filter((m) => m.category === 'NVIDIA NIM');
  const geminiModels = AVAILABLE_MODELS.filter((m) => m.category === 'Google Gemini');
  const rtLiteModels = AVAILABLE_MODELS.filter((m) => m.domain === 'offline_device');

  const [selectedNvidiaModel, setSelectedNvidiaModel] = useState<ModelType>(() => {
    return currentModel.startsWith('qwen') || currentModel.startsWith('meta') || currentModel.startsWith('deepseek') || currentModel.startsWith('mistral') || currentModel.startsWith('nvidia')
      ? currentModel
      : 'qwen/qwen2.5-coder-32b-instruct';
  });

  const [selectedGeminiModel, setSelectedGeminiModel] = useState<ModelType>(() => {
    return currentModel.startsWith('google/') ? currentModel : 'google/gemini-2.5-flash';
  });

  const [selectedRtLiteModel, setSelectedRtLiteModel] = useState<ModelType>(() => {
    return currentModel.startsWith('rt-lite') || currentModel === 'direct-no-ai' ? currentModel : 'rt-lite-hardware';
  });

  // Current model category detection
  const isNvidiaActive = nvidiaModels.some((m) => m.id === currentModel);
  const isGeminiActive = geminiModels.some((m) => m.id === currentModel);
  const isCloudActive = currentModel === 'custom-llm';
  const isRtLiteActive = rtLiteModels.some((m) => m.id === currentModel);

  const activeAgent = agents.find((a) => a.id === activeAgentId);

  // Handlers to save API Keys
  const handleSaveNvidiaKey = () => {
    SecretsService.setSecret('nvidia_api_key', nvidiaKeyInput.trim());
    setSavedNvidia(true);
    setTimeout(() => setSavedNvidia(false), 2000);
    onNotify?.('API Key de NVIDIA NIM guardada correctamente.');
  };

  const handleSaveGeminiKey = () => {
    SecretsService.setSecret('gemini_api_key', geminiKeyInput.trim());
    setSavedGemini(true);
    setTimeout(() => setSavedGemini(false), 2000);
    onNotify?.('API Key de Google Gemini guardada correctamente.');
  };

  const handleSaveCloudConfig = () => {
    SecretsService.setSecret('custom_endpoint', cloudEndpointInput.trim());
    SecretsService.setSecret('custom_api_key', cloudTokenInput.trim());
    SecretsService.setSecret('custom_model', cloudModelInput.trim());
    setSavedCloud(true);
    setTimeout(() => setSavedCloud(false), 2000);
    onNotify?.('Endpoint y Token del modelo Cloud guardados.');
  };

  return (
    <section className="w-full bg-[#0a0d16]/95 border-b border-[#1c2438] px-3 sm:px-6 py-2.5 transition-all text-slate-200">
      <div className="max-w-7xl mx-auto flex flex-col gap-2.5">
        
        {/* TOP ROW: Quick Selectors Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          
          {/* Group 1: Model Selection Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            
            {/* 1. NVIDIA NIM LLMs */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all ${
              isNvidiaActive 
                ? 'bg-[#00FF66]/10 border-[#00FF66]/50 shadow-[0_0_10px_rgba(0,255,102,0.15)]' 
                : 'bg-[#101524] border-slate-800 hover:border-slate-700'
            }`}>
              <div className="flex items-center gap-1 text-[#00FF66] font-semibold">
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">NVIDIA:</span>
              </div>
              <select
                value={isNvidiaActive ? currentModel : selectedNvidiaModel}
                onChange={(e) => {
                  const val = e.target.value as ModelType;
                  setSelectedNvidiaModel(val);
                  onSelectModel(val);
                }}
                className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer max-w-[130px] sm:max-w-[180px] truncate"
                title="Lista desplegable de modelos LLM NVIDIA"
              >
                {nvidiaModels.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0b0f19] text-slate-200">
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'nvidia' ? null : 'nvidia')}
                className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                  SecretsService.hasSecret('nvidia_api_key') ? 'text-[#00FF66]' : 'text-amber-400 animate-pulse'
                }`}
                title="Introducir o editar API Key de NVIDIA manualmente"
              >
                <Key className="w-3 h-3" />
              </button>
            </div>

            {/* 2. Google Gemini Models */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all ${
              isGeminiActive 
                ? 'bg-[#38bdf8]/10 border-[#38bdf8]/50 shadow-[0_0_10px_rgba(56,189,248,0.15)]' 
                : 'bg-[#101524] border-slate-800 hover:border-slate-700'
            }`}>
              <div className="flex items-center gap-1 text-[#38bdf8] font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Gemini:</span>
              </div>
              <select
                value={isGeminiActive ? currentModel : selectedGeminiModel}
                onChange={(e) => {
                  const val = e.target.value as ModelType;
                  setSelectedGeminiModel(val);
                  onSelectModel(val);
                }}
                className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer max-w-[120px] sm:max-w-[160px] truncate"
                title="Lista desplegable de modelos Google Gemini"
              >
                {geminiModels.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0b0f19] text-slate-200">
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'gemini' ? null : 'gemini')}
                className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                  SecretsService.hasSecret('gemini_api_key') ? 'text-[#38bdf8]' : 'text-amber-400 animate-pulse'
                }`}
                title="Introducir o editar API Key de Google Gemini manualmente"
              >
                <Key className="w-3 h-3" />
              </button>
            </div>

            {/* 3. RT-LITE Bajo Demanda */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all ${
              isRtLiteActive 
                ? 'bg-purple-950/30 border-purple-500/60 shadow-[0_0_10px_rgba(168,85,247,0.15)]' 
                : 'bg-[#101524] border-slate-800 hover:border-slate-700'
            }`}>
              <div className="flex items-center gap-1 text-purple-400 font-semibold">
                <Cpu className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">RT-Lite (Bajo Demanda):</span>
              </div>
              <select
                value={isRtLiteActive ? currentModel : selectedRtLiteModel}
                onChange={(e) => {
                  const val = e.target.value as ModelType;
                  setSelectedRtLiteModel(val);
                  onSelectModel(val);
                }}
                className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer max-w-[130px] sm:max-w-[170px] truncate"
                title="Modelos On-Device RT-Lite bajo demanda (100% locales, sin API Key)"
              >
                {rtLiteModels.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0b0f19] text-slate-200">
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'rt-lite' ? null : 'rt-lite')}
                className="p-1 rounded text-purple-400 hover:bg-slate-800 transition-colors"
                title="Detalles de RT-Lite On-Device"
              >
                <ShieldCheck className="w-3 h-3" />
              </button>
            </div>

            {/* 4. Custom Cloud Endpoint Button */}
            <button
              type="button"
              onClick={() => {
                if (currentModel !== 'custom-llm') {
                  onSelectModel('custom-llm');
                }
                setActiveTab(activeTab === 'cloud' ? null : 'cloud');
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-mono transition-all ${
                isCloudActive
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'bg-[#101524] border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
              title="Configurar Endpoint de Modelo en la Nube y Token"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>Cloud Custom</span>
              {SecretsService.hasSecret('custom_api_key') && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block ml-0.5" />
              )}
            </button>
          </div>

          {/* Group 2: Agent Selection Dropdown & Add Agent Button */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all ${
              activeAgent 
                ? 'bg-[#00f0ff]/10 border-[#00f0ff]/50 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.15)]' 
                : 'bg-[#101524] border-slate-800 text-slate-400'
            }`}>
              <Bot className={`w-3.5 h-3.5 ${activeAgent ? 'text-[#00f0ff]' : 'text-slate-500'}`} />
              <span className="font-semibold hidden sm:inline">Agente:</span>
              <select
                value={activeAgentId}
                onChange={(e) => onSelectAgent(e.target.value)}
                className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer max-w-[130px] sm:max-w-[180px] truncate"
                title="Lista desplegable de agentes especializados"
              >
                <option value="" className="bg-[#0b0f19] text-slate-400">
                  Ninguno (Modo Neutro)
                </option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id} className="bg-[#0b0f19] text-slate-200">
                    {ag.name} ({ag.role.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>

            {/* Direct "+ Agregar Agente" Button */}
            <button
              type="button"
              onClick={onOpenAddAgent}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 border border-[#00f0ff]/50 text-[#00f0ff] hover:text-white font-mono text-xs font-semibold transition-all cursor-pointer shadow-sm"
              title="Agregar nuevo agente o importar desde JSON"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Agente</span>
            </button>
          </div>

        </div>

        {/* ACTIVE DRAWER: Manual API Key Inputs & Cloud Endpoint Configuration */}
        {activeTab && (
          <div className="mt-1 pt-2 border-t border-slate-800 animate-fadeIn">
            
            {/* TAB: NVIDIA API Key Manual Input */}
            {activeTab === 'nvidia' && (
              <div className="bg-[#0e1320] border border-[#00FF66]/30 rounded-lg p-3 flex flex-col md:flex-row items-center gap-3">
                <div className="flex items-center gap-2 text-[#00FF66] shrink-0 font-semibold text-xs">
                  <Zap className="w-4 h-4" />
                  <span>NVIDIA NIM API Key:</span>
                </div>
                <div className="relative flex-1 w-full">
                  <input
                    type={showNvidiaKey ? 'text' : 'password'}
                    value={nvidiaKeyInput}
                    onChange={(e) => setNvidiaKeyInput(e.target.value)}
                    placeholder="nvapi-..."
                    className="w-full bg-[#080b12] border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00FF66] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNvidiaKey(!showNvidiaKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    title={showNvidiaKey ? 'Ocultar' : 'Mostrar'}
                  >
                    {showNvidiaKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSaveNvidiaKey}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#00FF66]/20 border border-[#00FF66] text-[#00FF66] hover:bg-[#00FF66]/30 text-xs font-mono font-semibold transition-colors"
                  >
                    {savedNvidia ? <Check className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{savedNvidia ? '¡Guardada!' : 'Guardar Clave'}</span>
                  </button>
                  <a
                    href="https://build.nvidia.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-slate-400 hover:text-slate-200 underline flex items-center gap-0.5"
                  >
                    <span>Obtener Key</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setActiveTab(null)}
                    className="text-xs text-slate-500 hover:text-slate-300 ml-1 px-1.5 py-1"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* TAB: Google Gemini API Key Manual Input */}
            {activeTab === 'gemini' && (
              <div className="bg-[#0e1320] border border-[#38bdf8]/30 rounded-lg p-3 flex flex-col md:flex-row items-center gap-3">
                <div className="flex items-center gap-2 text-[#38bdf8] shrink-0 font-semibold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>Google Gemini API Key:</span>
                </div>
                <div className="relative flex-1 w-full">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-[#080b12] border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#38bdf8] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    title={showGeminiKey ? 'Ocultar' : 'Mostrar'}
                  >
                    {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSaveGeminiKey}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#38bdf8]/20 border border-[#38bdf8] text-[#38bdf8] hover:bg-[#38bdf8]/30 text-xs font-mono font-semibold transition-colors"
                  >
                    {savedGemini ? <Check className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{savedGemini ? '¡Guardada!' : 'Guardar Clave'}</span>
                  </button>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-slate-400 hover:text-slate-200 underline flex items-center gap-0.5"
                  >
                    <span>Obtener Key</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setActiveTab(null)}
                    className="text-xs text-slate-500 hover:text-slate-300 ml-1 px-1.5 py-1"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* TAB: Cloud Custom Model Endpoint & Authentication Token */}
            {activeTab === 'cloud' && (
              <div className="bg-[#0e1320] border border-amber-500/40 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between text-xs text-amber-400 font-semibold">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <span>Modelo que se ejecuta en la nube (Endpoint & Token de autenticación)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab(null)}
                    className="text-slate-500 hover:text-slate-300 text-xs"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Endpoint URL Field */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-mono">
                      Endpoint URL en la Nube
                    </label>
                    <input
                      type="text"
                      value={cloudEndpointInput}
                      onChange={(e) => setCloudEndpointInput(e.target.value)}
                      placeholder="https://api.openai.com/v1/chat/completions"
                      className="w-full bg-[#080b12] border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Auth Token Field */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-mono">
                      Token de Autenticación / Bearer
                    </label>
                    <div className="relative">
                      <input
                        type={showCloudToken ? 'text' : 'password'}
                        value={cloudTokenInput}
                        onChange={(e) => setCloudTokenInput(e.target.value)}
                        placeholder="sk-... / gsk_..."
                        className="w-full bg-[#080b12] border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400 pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCloudToken(!showCloudToken)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        title={showCloudToken ? 'Ocultar' : 'Mostrar'}
                      >
                        {showCloudToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Model ID Field */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-mono">
                      Nombre / ID del Modelo Cloud
                    </label>
                    <input
                      type="text"
                      value={cloudModelInput}
                      onChange={(e) => setCloudModelInput(e.target.value)}
                      placeholder="llama-3.3-70b-versatile"
                      className="w-full bg-[#080b12] border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400 font-mono">
                    Compatible con cualquier servidor OpenAI (Groq, Together, vLLM, Ollama remoto, etc.).
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleSaveCloudConfig();
                        onSelectModel('custom-llm');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/20 border border-amber-500 text-amber-300 hover:bg-amber-500/30 text-xs font-mono font-semibold transition-colors"
                    >
                      {savedCloud ? <Check className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      <span>{savedCloud ? '¡Configuración Guardada!' : 'Guardar y Usar Modelo Cloud'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: RT-Lite On-Demand Information */}
            {activeTab === 'rt-lite' && (
              <div className="bg-[#0e1320] border border-purple-500/40 rounded-lg p-3 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                <div className="space-y-1 text-slate-300 font-mono">
                  <div className="flex items-center gap-2 text-purple-400 font-semibold">
                    <Cpu className="w-4 h-4" />
                    <span>Modelos RT-LITE On-Device (Bajo Demanda)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Se ejecutan 100% de forma local en tu navegador. Cero peticiones de red para hardware, llamadas de teléfono, agenda determinista y criptografía AES-GCM-256.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectModel(selectedRtLiteModel);
                      onNotify?.(`Motor RT-Lite "${selectedRtLiteModel}" activado bajo demanda.`);
                    }}
                    className="px-3 py-1.5 rounded bg-purple-600/30 border border-purple-500 text-purple-200 hover:bg-purple-600/50 text-xs font-mono font-semibold transition-colors"
                  >
                    Activar Este Módulo RT-Lite
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab(null)}
                    className="text-xs text-slate-500 hover:text-slate-300 ml-1 px-1.5 py-1"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </section>
  );
};
