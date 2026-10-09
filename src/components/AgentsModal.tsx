import React, { useState, useRef } from 'react';
import { 
  X, 
  Bot, 
  Plus, 
  Trash2, 
  Download, 
  Upload, 
  Check, 
  Sparkles, 
  Code, 
  FileJson, 
  Copy, 
  CheckCheck, 
  Briefcase, 
  Shield, 
  FileText, 
  Mail, 
  Cpu, 
  Activity, 
  Sliders, 
  RefreshCw,
  Terminal,
  AlertCircle
} from 'lucide-react';
import type { AgentProfile, KokoroVoiceId, ModelType } from '../types';
import { DEFAULT_AGENTS, AVAILABLE_MODELS, KOKORO_VOICES } from '../types';

interface AgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentProfile[];
  activeAgentId: string;
  onSelectAgent: (agentId: string) => void;
  onAddAgent: (newAgent: AgentProfile, activateImmediately?: boolean) => void;
  onAddAgents?: (newAgents: AgentProfile[], activateFirst?: boolean) => void;
  onUpdateAgent: (updatedAgent: AgentProfile) => void;
  onDeleteAgent: (agentId: string) => void;
  onResetAgents: () => void;
  onNotify?: (message: string) => void;
}

const TEMPLATE_SAMPLE_JSON = `{
  "name": "Especialista en Investigación & Análisis",
  "role": "Investigador Científico & Síntesis de Inteligencia",
  "description": "Capaz de analizar datos técnicos profundos, desglosar hipótesis y emitir reportes estructurados.",
  "systemPrompt": "Eres el Agente de Investigación Avanzada de VVC-ACIA. Proporcionas análisis exhaustivos con citas técnicas, rigor metodológico y síntesis clara orientada a la toma de decisiones.",
  "temperature": 0.35,
  "maxTokens": 900,
  "defaultVoiceId": "es_sofia",
  "preferredModel": "meta/llama-3.2-11b-vision-instruct",
  "capabilities": ["investigacion_tecnica", "analisis_datos", "documentacion", "sintesis"],
  "rules": [
    "Prioriza la precisión fáctica y metodológica en cada respuesta.",
    "Estructura las conclusiones en puntos accionables.",
    "Mantén una prosa analítica, sobria y profesional."
  ],
  "icon": "Sparkles",
  "color": "#38bdf8"
}`;

const TEMPLATE_SAMPLE_LIST_JSON = `[
  {
    "name": "Especialista en Investigación & Análisis",
    "role": "Investigador Científico & Síntesis",
    "description": "Capaz de analizar datos técnicos profundos y emitir reportes estructurados.",
    "systemPrompt": "Eres el Agente de Investigación Avanzada de VVC-ACIA. Proporcionas análisis exhaustivos con citas técnicas, rigor metodológico y síntesis clara orientada a la toma de decisiones.",
    "temperature": 0.35,
    "maxTokens": 900,
    "defaultVoiceId": "es_sofia",
    "preferredModel": "meta/llama-3.2-11b-vision-instruct",
    "capabilities": ["investigacion_tecnica", "analisis_datos", "documentacion"],
    "rules": [
      "Prioriza la precisión fáctica y metodológica en cada respuesta.",
      "Estructura las conclusiones en puntos accionables."
    ],
    "icon": "Sparkles",
    "color": "#38bdf8"
  },
  {
    "name": "Ingeniero Cloud & DevOps",
    "role": "Especialista en Infraestructura y Linux",
    "description": "Experto en Docker, Kubernetes, automatización y despliegue continuo.",
    "systemPrompt": "Eres el Agente DevOps & Cloud de VVC-ACIA. Diagnosticas fallos de servidores, diseñas arquitecturas CI/CD y generas comandos de terminal seguros y exactos.",
    "temperature": 0.25,
    "maxTokens": 1000,
    "defaultVoiceId": "es_mateo",
    "preferredModel": "meta/llama-3.2-11b-vision-instruct",
    "capabilities": ["docker", "kubernetes", "linux", "ci_cd"],
    "rules": [
      "Proporciona comandos de terminal probados, seguros y comentados.",
      "Identifica riesgos de despliegue antes de recomendar cambios de producción."
    ],
    "icon": "Cpu",
    "color": "#10b981"
  }
]`;

export const AgentsModal: React.FC<AgentsModalProps> = ({
  isOpen,
  onClose,
  agents,
  activeAgentId,
  onSelectAgent,
  onAddAgent,
  onAddAgents,
  onUpdateAgent,
  onDeleteAgent,
  onResetAgents,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'inspect'>('list');
  const [jsonInput, setJsonInput] = useState(TEMPLATE_SAMPLE_JSON);
  const [inspectingAgent, setInspectingAgent] = useState<AgentProfile | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const activeAgent = agents.find((a) => a.id === activeAgentId) || agents[0];

  // Helper to render icon
  const renderAgentIcon = (iconName?: string, color = '#00f0ff') => {
    switch (iconName) {
      case 'Briefcase': return <Briefcase className="w-5 h-5" style={{ color }} />;
      case 'Shield': return <Shield className="w-5 h-5" style={{ color }} />;
      case 'FileText': return <FileText className="w-5 h-5" style={{ color }} />;
      case 'Mail': return <Mail className="w-5 h-5" style={{ color }} />;
      case 'Cpu': return <Cpu className="w-5 h-5" style={{ color }} />;
      case 'Sparkles': return <Sparkles className="w-5 h-5" style={{ color }} />;
      case 'Activity': return <Activity className="w-5 h-5" style={{ color }} />;
      default: return <Bot className="w-5 h-5" style={{ color }} />;
    }
  };

  // Format / Beautify JSON
  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setValidationError(null);
    } catch (e: any) {
      setValidationError(`Error de sintaxis JSON: ${e.message}`);
    }
  };

  // Load Template (Single Agent)
  const handleLoadTemplate = () => {
    setJsonInput(TEMPLATE_SAMPLE_JSON);
    setValidationError(null);
  };

  // Load Template (List / Array of Agents)
  const handleLoadListTemplate = () => {
    setJsonInput(TEMPLATE_SAMPLE_LIST_JSON);
    setValidationError(null);
  };

  // Validate and submit JSON Agent(s) (supports single object or array list)
  const handleSubmitJsonAgent = (activate = true) => {
    try {
      setValidationError(null);
      const parsed = JSON.parse(jsonInput);

      // Support Array / List of Agents: [ { ... }, { ... } ]
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) {
          throw new Error('La lista JSON de agentes está vacía.');
        }

        const validAgents: AgentProfile[] = [];
        parsed.forEach((item, idx) => {
          if (!item.name || typeof item.name !== 'string') {
            throw new Error(`El agente en la posición ${idx + 1} no incluye un campo "name" válido.`);
          }
          if (!item.systemPrompt || typeof item.systemPrompt !== 'string') {
            throw new Error(`El agente "${item.name}" no incluye el campo "systemPrompt" obligatorio.`);
          }

          const generatedId = item.id || `ag-custom-${Date.now()}-${idx}`;
          validAgents.push({
            id: generatedId,
            name: item.name.trim(),
            role: (item.role && String(item.role).trim()) || 'Especialista Personalizado',
            description: (item.description && String(item.description).trim()) || 'Agente importado por especificación JSON.',
            systemPrompt: item.systemPrompt.trim(),
            temperature: typeof item.temperature === 'number' ? Math.max(0, Math.min(1.5, item.temperature)) : 0.6,
            maxTokens: typeof item.maxTokens === 'number' ? Math.max(100, Math.min(4000, item.maxTokens)) : 800,
            defaultVoiceId: item.defaultVoiceId || 'es_mateo',
            preferredModel: item.preferredModel || 'meta/llama-3.2-11b-vision-instruct',
            capabilities: Array.isArray(item.capabilities) ? item.capabilities : ['personalizado'],
            rules: Array.isArray(item.rules) ? item.rules : [],
            icon: item.icon || 'Sparkles',
            color: item.color || '#00f0ff',
            isDefault: false,
            createdAt: Date.now(),
            customData: item.customData || {},
          });
        });

        if (onAddAgents) {
          onAddAgents(validAgents, activate);
        } else {
          validAgents.forEach((ag, idx) => onAddAgent(ag, activate && idx === 0));
        }

        setStatusMessage(`✓ ${validAgents.length} agentes añadidos exitosamente desde la lista JSON.`);
        setTimeout(() => setStatusMessage(null), 3500);
        setActiveTab('list');

        if (onNotify) {
          onNotify(`${validAgents.length} agentes integrados a la Matriz de Agentes.`);
        }
        return;
      }

      // Single Agent Object
      if (!parsed.name || typeof parsed.name !== 'string') {
        throw new Error('El campo "name" es obligatorio y debe ser texto.');
      }
      if (!parsed.systemPrompt || typeof parsed.systemPrompt !== 'string') {
        throw new Error('El campo "systemPrompt" es obligatorio para definir las instrucciones del LLM.');
      }

      const generatedId = parsed.id || `ag-custom-${Date.now()}`;
      const newAgent: AgentProfile = {
        id: generatedId,
        name: parsed.name.trim(),
        role: (parsed.role && String(parsed.role).trim()) || 'Especialista Personalizado',
        description: (parsed.description && String(parsed.description).trim()) || 'Agente importado por especificación JSON.',
        systemPrompt: parsed.systemPrompt.trim(),
        temperature: typeof parsed.temperature === 'number' ? Math.max(0, Math.min(1.5, parsed.temperature)) : 0.6,
        maxTokens: typeof parsed.maxTokens === 'number' ? Math.max(100, Math.min(4000, parsed.maxTokens)) : 800,
        defaultVoiceId: parsed.defaultVoiceId || 'es_mateo',
        preferredModel: parsed.preferredModel || 'meta/llama-3.2-11b-vision-instruct',
        capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities : ['personalizado'],
        rules: Array.isArray(parsed.rules) ? parsed.rules : [],
        icon: parsed.icon || 'Sparkles',
        color: parsed.color || '#00f0ff',
        isDefault: false,
        createdAt: Date.now(),
        customData: parsed.customData || {},
      };

      onAddAgent(newAgent, activate);
      setStatusMessage(`✓ Agente "${newAgent.name}" añadido exitosamente.`);
      setTimeout(() => setStatusMessage(null), 3000);
      setActiveTab('list');

      if (onNotify) {
        onNotify(`Agente "${newAgent.name}" integrado y activado en el LLM.`);
      }
    } catch (e: any) {
      setValidationError(e.message || 'Error validando código JSON.');
    }
  };

  // Handle File Upload (.json)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawContent = event.target?.result as string;
        if (!rawContent) return;

        const parsed = JSON.parse(rawContent);

        // Check if file is a single agent or a list of agents
        if (Array.isArray(parsed)) {
          const importedList: AgentProfile[] = [];
          parsed.forEach((item, idx) => {
            if (item.name && item.systemPrompt) {
              importedList.push({
                id: item.id || `ag-import-${Date.now()}-${idx}`,
                name: item.name,
                role: item.role || 'Agente Importado',
                description: item.description || '',
                systemPrompt: item.systemPrompt,
                temperature: item.temperature ?? 0.6,
                maxTokens: item.maxTokens ?? 800,
                defaultVoiceId: item.defaultVoiceId || 'es_mateo',
                preferredModel: item.preferredModel || 'meta/llama-3.2-11b-vision-instruct',
                capabilities: item.capabilities || [],
                rules: item.rules || [],
                icon: item.icon || 'Bot',
                color: item.color || '#00f0ff',
                isDefault: false,
                createdAt: Date.now(),
              });
            }
          });

          if (importedList.length === 0) {
            throw new Error('El archivo no contiene agentes válidos con "name" y "systemPrompt".');
          }

          if (onAddAgents) {
            onAddAgents(importedList, true);
          } else {
            importedList.forEach((ag, idx) => onAddAgent(ag, idx === 0));
          }

          setStatusMessage(`✓ ${importedList.length} agentes importados del archivo ${file.name}.`);
          setTimeout(() => setStatusMessage(null), 3500);
          setActiveTab('list');
          return;
        }

        // Single Agent
        setJsonInput(JSON.stringify(parsed, null, 2));
        setActiveTab('add');
        setStatusMessage(`✓ Archivo "${file.name}" cargado en el editor. Revisa y haz clic en Guardar.`);
        setTimeout(() => setStatusMessage(null), 3500);
      } catch (err: any) {
        setValidationError(`Error leyendo archivo JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Export Single Agent to .json
  const handleExportAgent = (agent: AgentProfile) => {
    const dataStr = JSON.stringify(agent, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = agent.name.toLowerCase().replace(/[^a-z0-9]/gi, '_');
    link.download = `agente_${safeName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatusMessage(`✓ Agente "${agent.name}" descargado en .json.`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Export All Agents
  const handleExportAllAgents = () => {
    const dataStr = JSON.stringify(agents, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vvc_acia_agentes_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatusMessage(`✓ Respaldo de ${agents.length} agentes exportado con éxito.`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Copy JSON to clipboard
  const handleCopyJson = (agent: AgentProfile) => {
    navigator.clipboard.writeText(JSON.stringify(agent, null, 2));
    setCopiedId(agent.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#07090e] border border-[#1e2638] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(0,240,255,0.15)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2638] bg-[#0c101a]/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00f0ff]/15 border border-[#00f0ff]/40 flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.25)]">
              <Bot className="w-5 h-5 text-[#00f0ff]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide font-mono">
                  Matriz de Agentes Especializados
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff]">
                  {agents.length} AGENTES
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Agente Activo: <span className="text-[#00f0ff] font-semibold">{activeAgent?.name}</span> ({activeAgent?.role})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#151c2d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-5 pt-3 border-b border-[#1e2638] bg-[#090d16]">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 text-xs font-mono rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
                activeTab === 'list'
                  ? 'border-[#00f0ff] text-[#00f0ff] bg-[#0e1422] font-bold'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-[#0c101a]'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Lista de Agentes ({agents.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('add');
                setValidationError(null);
              }}
              className={`px-4 py-2 text-xs font-mono rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
                activeTab === 'add'
                  ? 'border-[#00f0ff] text-[#00f0ff] bg-[#0e1422] font-bold'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-[#0c101a]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar / Importar JSON</span>
            </button>
            {inspectingAgent && (
              <button
                onClick={() => setActiveTab('inspect')}
                className={`px-4 py-2 text-xs font-mono rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
                  activeTab === 'inspect'
                    ? 'border-[#b026ff] text-[#b026ff] bg-[#0e1422] font-bold'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-[#0c101a]'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Inspeccionar: {inspectingAgent.name.split(' ')[0]}</span>
              </button>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={handleExportAllAgents}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded bg-[#101625] border border-[#1e2638] text-slate-300 hover:text-[#00f0ff] hover:border-[#00f0ff]/40 transition-colors"
              title="Descargar todos los agentes en formato .json"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">Exportar Todo (.json)</span>
            </button>
            <label className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/20 cursor-pointer transition-colors">
              <Upload className="w-3 h-3" />
              <span className="hidden sm:inline">Cargar .json</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-5 py-2 text-xs font-mono text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: LISTA DE AGENTES */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-3.5 text-xs font-mono text-slate-300 flex items-center justify-between">
                <div>
                  <span className="text-white font-bold">¿Cómo opera el Agente en el LLM?</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Al activar un agente, sus especificaciones (System Prompt, reglas de comportamiento, temperatura y perfil) se inyectan automáticamente en cada consulta al LLM.
                  </p>
                </div>
                <button
                  onClick={onResetAgents}
                  className="px-2.5 py-1.5 text-[10px] font-mono rounded bg-[#161c2c] border border-slate-700 hover:border-amber-500/60 text-slate-400 hover:text-amber-300 transition-colors"
                  title="Restaurar agentes predeterminados de fábrica"
                >
                  Restaurar Originales
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {agents.map((agent) => {
                  const isActive = agent.id === activeAgentId;
                  const agentColor = agent.color || '#00f0ff';

                  return (
                    <div
                      key={agent.id}
                      className={`rounded-xl border p-4 transition-all relative flex flex-col justify-between ${
                        isActive
                          ? 'bg-[#0f172a]/90 border-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.2)] ring-1 ring-[#00f0ff]/50'
                          : 'bg-[#0a0d16] border-[#1e2638] hover:border-slate-600'
                      }`}
                    >
                      <div>
                        {/* Top Card Row */}
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm shrink-0"
                              style={{
                                backgroundColor: `${agentColor}15`,
                                borderColor: `${agentColor}40`,
                              }}
                            >
                              {renderAgentIcon(agent.icon, agentColor)}
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-white font-mono flex items-center gap-1.5">
                                {agent.name}
                                {isActive && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#00f0ff] text-black font-extrabold uppercase">
                                    ACTIVO
                                  </span>
                                )}
                              </h3>
                              <p className="text-[11px] font-mono text-slate-400">
                                {agent.role}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setInspectingAgent(agent);
                                setActiveTab('inspect');
                              }}
                              className="p-1.5 text-slate-400 hover:text-[#00f0ff] hover:bg-[#161d2d] rounded transition-colors"
                              title="Ver especificación JSON completa"
                            >
                              <Code className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleExportAgent(agent)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-[#161d2d] rounded transition-colors"
                              title="Exportar archivo .json"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopyJson(agent)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-[#161d2d] rounded transition-colors"
                              title="Copiar código JSON al portapapeles"
                            >
                              {copiedId === agent.id ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            {!agent.isDefault && (
                              <button
                                onClick={() => onDeleteAgent(agent.id)}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-[#161d2d] rounded transition-colors"
                                title="Eliminar este agente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-300 font-mono line-clamp-2 mb-3">
                          {agent.description}
                        </p>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-3 font-mono text-[10px]">
                          <span className="px-2 py-0.5 rounded bg-[#131929] border border-[#1e2638] text-slate-300">
                            Temp: {agent.temperature ?? 0.6}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#131929] border border-[#1e2638] text-slate-300">
                            Voz: {agent.defaultVoiceId || 'es_mateo'}
                          </span>
                          {agent.rules && agent.rules.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-[#131929] border border-[#1e2638] text-cyan-300">
                              {agent.rules.length} Reglas
                            </span>
                          )}
                          {agent.capabilities?.map((cap, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-[#131929] border border-[#1e2638] text-slate-400"
                            >
                              #{cap}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Activation Button */}
                      <button
                        onClick={() => onSelectAgent(agent.id)}
                        disabled={isActive}
                        className={`w-full py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isActive
                            ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 cursor-default'
                            : 'bg-[#121929] hover:bg-[#00f0ff]/20 text-slate-200 hover:text-[#00f0ff] border border-[#1e2638] hover:border-[#00f0ff]/40'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#00f0ff]" />
                            <span>Agente Activo en el LLM</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Activar este Agente</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: AGREGAR / IMPORTAR AGENTE POR CÓDIGO JSON O ARCHIVO */}
          {activeTab === 'add' && (
            <div className="space-y-4 font-mono text-xs">
              {/* Instructions banner */}
              <div className="bg-[#0b0f19] border border-[#1e2638] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <FileJson className="w-4 h-4 text-[#00f0ff]" />
                    <span>Editor de Especificación JSON del Agente</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleLoadTemplate}
                      className="px-2.5 py-1 text-[11px] rounded bg-[#121727] border border-[#1e2638] hover:border-[#00f0ff]/50 text-slate-300 hover:text-white transition-colors"
                    >
                      Plantilla (1 Agente)
                    </button>
                    <button
                      onClick={handleLoadListTemplate}
                      className="px-2.5 py-1 text-[11px] rounded bg-[#121727] border border-[#1e2638] hover:border-emerald-500/50 text-emerald-300 hover:text-white transition-colors"
                    >
                      Plantilla Lista [Array]
                    </button>
                    <button
                      onClick={handleFormatJson}
                      className="px-2.5 py-1 text-[11px] rounded bg-[#121727] border border-[#1e2638] hover:border-[#00f0ff]/50 text-[#00f0ff] transition-colors"
                    >
                      Formatear JSON
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Pega el bloque JSON de tu agente o una lista en formato array <code className="text-emerald-400">[&#123;...&#125;, &#123;...&#125;]</code>, o carga un archivo <code className="text-[#00f0ff]">.json</code>. Campos requeridos: <code className="text-amber-400">"name"</code> y <code className="text-amber-400">"systemPrompt"</code>.
                </p>
              </div>

              {/* JSON Textarea Editor */}
              <div className="relative">
                <textarea
                  value={jsonInput}
                  onChange={(e) => {
                    setJsonInput(e.target.value);
                    setValidationError(null);
                  }}
                  rows={14}
                  className="w-full bg-[#05070c] border border-[#1e2638] focus:border-[#00f0ff] rounded-xl p-4 text-xs font-mono text-cyan-300 leading-relaxed outline-none shadow-inner resize-y"
                  placeholder="Pega el bloque JSON del agente aquí..."
                />
              </div>

              {/* Validation Error Message */}
              {validationError && (
                <div className="bg-red-950/80 border border-red-500/50 rounded-xl p-3 text-red-300 flex items-start gap-2.5 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error de validación JSON:</span>
                    <p className="text-[11px] mt-0.5">{validationError}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <label className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#121727] border border-[#1e2638] hover:border-cyan-500/50 text-slate-300 hover:text-white cursor-pointer transition-colors text-xs">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span>Cargar desde archivo .json</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>

                <div className="w-full sm:w-auto flex items-center gap-2">
                  <button
                    onClick={() => handleSubmitJsonAgent(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#121727] border border-[#1e2638] hover:border-slate-500 text-slate-300 text-xs font-bold transition-all"
                  >
                    Guardar en Lista
                  </button>
                  <button
                    onClick={() => handleSubmitJsonAgent(true)}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#00f0ff] hover:bg-[#00f0ff]/90 text-black text-xs font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)] flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Guardar y Activar Inmediatamente</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INSPECCIONAR ESPECIFICACIÓN JSON */}
          {activeTab === 'inspect' && inspectingAgent && (
            <div className="space-y-4 font-mono text-xs">
              <div className="bg-[#0b0f19] border border-[#1e2638] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    {renderAgentIcon(inspectingAgent.icon, inspectingAgent.color)}
                    <span>{inspectingAgent.name}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Especificación JSON activa que gobierna el comportamiento del LLM.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyJson(inspectingAgent)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#121727] border border-[#1e2638] text-slate-300 hover:text-white transition-colors"
                  >
                    {copiedId === inspectingAgent.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copiar JSON</span>
                  </button>
                  <button
                    onClick={() => handleExportAgent(inspectingAgent)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00f0ff]/15 border border-[#00f0ff]/40 text-[#00f0ff] hover:bg-[#00f0ff]/25 transition-colors font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar .json</span>
                  </button>
                </div>
              </div>

              <pre className="bg-[#05070c] border border-[#1e2638] rounded-xl p-4 text-xs font-mono text-cyan-300 overflow-x-auto max-h-[50vh]">
                {JSON.stringify(inspectingAgent, null, 2)}
              </pre>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setJsonInput(JSON.stringify(inspectingAgent, null, 2));
                    setActiveTab('add');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#121727] border border-[#1e2638] hover:border-slate-500 text-slate-300"
                >
                  Duplicar / Editar en Editor
                </button>
                <button
                  onClick={() => {
                    onSelectAgent(inspectingAgent.id);
                    setActiveTab('list');
                  }}
                  className="px-5 py-2 rounded-xl bg-[#00f0ff] text-black font-bold"
                >
                  Activar este Agente en LLM
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
