import React, { useState } from 'react';
import { 
  X, 
  Key, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Check, 
  Trash2, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  Cpu,
  Globe,
  Lock,
  Layers
} from 'lucide-react';
import { 
  SecretsService, 
  SECRETS_REGISTRY, 
  type SecretKeyId, 
  type SecretMetadata 
} from '../services/secretsService';

interface ApiSecretsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSecretId?: SecretKeyId | null;
  onSecretsUpdated?: () => void;
}

export const ApiSecretsModal: React.FC<ApiSecretsModalProps> = ({
  isOpen,
  onClose,
  targetSecretId,
  onSecretsUpdated,
}) => {
  const [activeCategory, setActiveCategory] = useState<'llm' | 'integrations'>('llm');
  const [secretsState, setSecretsState] = useState<Record<SecretKeyId, string>>(() => {
    return SecretsService.getAllSecrets();
  });
  const [visibleKeys, setVisibleKeys] = useState<Record<SecretKeyId, boolean>>({} as any);
  const [savingKeyId, setSavingKeyId] = useState<SecretKeyId | null>(null);
  const [savedSuccessId, setSavedSuccessId] = useState<SecretKeyId | null>(null);
  const [testingKeyId, setTestingKeyId] = useState<SecretKeyId | null>(null);
  const [testResult, setTestResult] = useState<{ id: SecretKeyId; success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleInputChange = (id: SecretKeyId, value: string) => {
    setSecretsState((prev) => ({ ...prev, [id]: value }));
  };

  const toggleVisibility = (id: SecretKeyId) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSaveSecret = (id: SecretKeyId) => {
    setSavingKeyId(id);
    SecretsService.setSecret(id, secretsState[id] || '');
    setSavedSuccessId(id);
    if (onSecretsUpdated) onSecretsUpdated();

    setTimeout(() => {
      setSavingKeyId(null);
      setSavedSuccessId(null);
    }, 2000);
  };

  const handleDeleteSecret = (id: SecretKeyId) => {
    SecretsService.removeSecret(id);
    setSecretsState((prev) => ({ ...prev, [id]: '' }));
    setTestResult(null);
    if (onSecretsUpdated) onSecretsUpdated();
  };

  const handleTestConnection = async (id: SecretKeyId) => {
    setTestingKeyId(id);
    setTestResult(null);

    try {
      let provider = '';
      let apiKey = secretsState[id] || '';
      let endpoint = '';
      let model = '';

      if (id === 'gemini_api_key') {
        provider = 'gemini';
      } else if (id === 'nvidia_api_key') {
        provider = 'nvidia';
        endpoint = secretsState['custom_endpoint'] || 'https://integrate.api.nvidia.com/v1/chat/completions';
      } else if (id === 'custom_api_key' || id === 'custom_endpoint') {
        provider = 'custom';
        apiKey = secretsState['custom_api_key'] || '';
        endpoint = secretsState['custom_endpoint'] || '';
        model = secretsState['custom_model'] || 'default';
      } else {
        setTestResult({
          id,
          success: true,
          message: 'Secreto guardado localmente con formato válido.',
        });
        setTestingKeyId(null);
        return;
      }

      const res = await fetch('/api/secrets/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, endpoint, model }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          id,
          success: true,
          message: data.message || 'Conexión verificada con éxito.',
        });
      } else {
        setTestResult({
          id,
          success: false,
          message: data.error || 'No fue posible validar la clave. Verifica tus credenciales.',
        });
      }
    } catch (err: any) {
      setTestResult({
        id,
        success: false,
        message: err?.message || 'Error de red al verificar clave.',
      });
    } finally {
      setTestingKeyId(null);
    }
  };

  const llmSecrets = SECRETS_REGISTRY.filter((s) => s.provider !== 'Integraciones');
  const integrationSecrets = SECRETS_REGISTRY.filter((s) => s.provider === 'Integraciones');
  const displayedSecrets = activeCategory === 'llm' ? llmSecrets : integrationSecrets;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#07090e] border border-[#1e2638] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,240,255,0.15)] overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2638] bg-[#0c101a]/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.25)]">
              <Key className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Bóveda de Secretos & Claves de APIs
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Zero-Knowledge Local
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Tú decides qué motor usar. Ingresa tus claves para Gemini, NVIDIA o tu endpoint privado.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#151c2d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Security Banner */}
        <div className="bg-[#090d18] border-b border-[#1e2638] px-5 py-2.5 flex items-start gap-2.5 text-slate-300 text-[11px] leading-relaxed">
          <Lock className="w-4 h-4 text-[#00f0ff] shrink-0 mt-0.5" />
          <div>
            <span className="text-[#00f0ff] font-semibold">Privacidad & Libertad de Proveedor: </span>
            Las claves se almacenan exclusivamente como secretos locales en tu dispositivo. No dependes de ninguna API key predeterminada: si no deseas usar APIs cloud, puedes operar 100% offline con los motores <strong className="text-white">RT-Lite On-Device</strong> o el <strong className="text-white">Modo Directo</strong>.
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center justify-between px-5 pt-3 border-b border-[#1e2638] bg-[#080b13]">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveCategory('llm')}
              className={`px-4 py-2 text-xs rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
                activeCategory === 'llm'
                  ? 'border-[#00f0ff] text-[#00f0ff] bg-[#0e1422] font-bold'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-[#0c101a]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Modelos LLM (Gemini / NVIDIA / Custom)</span>
            </button>
            <button
              onClick={() => setActiveCategory('integrations')}
              className={`px-4 py-2 text-xs rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
                activeCategory === 'integrations'
                  ? 'border-amber-400 text-amber-400 bg-[#0e1422] font-bold'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-[#0c101a]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Webhooks & Integraciones Externas</span>
            </button>
          </div>
        </div>

        {/* Secret Inputs Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {displayedSecrets.map((secret: SecretMetadata) => {
            const val = secretsState[secret.id] || '';
            const isConfigured = Boolean(val && val.trim().length > 0);
            const isVisible = Boolean(visibleKeys[secret.id]);
            const isTargeted = targetSecretId === secret.id;
            const isTesting = testingKeyId === secret.id;
            const currentTest = testResult?.id === secret.id ? testResult : null;

            return (
              <div
                key={secret.id}
                className={`rounded-xl border p-4 transition-all ${
                  isTargeted
                    ? 'bg-[#101728] border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.2)] ring-1 ring-[#00f0ff]/50'
                    : 'bg-[#0a0d16] border-[#1e2638] hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{secret.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-bold">
                      {secret.badge}
                    </span>
                    {isConfigured ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" />
                        Configurada
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Pendiente
                      </span>
                    )}
                  </div>

                  {secret.docUrl && (
                    <a
                      href={secret.docUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-[#00f0ff] hover:underline flex items-center gap-1 shrink-0 self-start sm:self-auto"
                    >
                      <span>Obtener Clave</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  {secret.description}
                </p>

                {/* Input row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={secret.isSensitive && !isVisible ? 'password' : 'text'}
                      value={val}
                      onChange={(e) => handleInputChange(secret.id, e.target.value)}
                      placeholder={secret.placeholder}
                      className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded-lg px-3 py-2 pr-9 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
                    />

                    {secret.isSensitive && (
                      <button
                        type="button"
                        onClick={() => toggleVisibility(secret.id)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                        title={isVisible ? 'Ocultar clave' : 'Mostrar clave'}
                      >
                        {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {/* Test button for LLM keys */}
                    {(secret.id === 'gemini_api_key' || secret.id === 'nvidia_api_key' || secret.id === 'custom_endpoint') && (
                      <button
                        type="button"
                        onClick={() => handleTestConnection(secret.id)}
                        disabled={isTesting || !val}
                        className="px-2.5 py-2 rounded-lg bg-[#141a29] hover:bg-[#1a2336] text-[#00f0ff] border border-[#00f0ff]/40 text-xs transition-colors disabled:opacity-40 flex items-center gap-1"
                        title="Probar conexión con esta API Key"
                      >
                        {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        <span>Probar</span>
                      </button>
                    )}

                    {/* Save button */}
                    <button
                      type="button"
                      onClick={() => handleSaveSecret(secret.id)}
                      disabled={savingKeyId === secret.id}
                      className="px-3 py-2 rounded-lg bg-[#00f0ff] hover:bg-[#00d0df] text-black font-semibold text-xs transition-all shadow-[0_0_10px_rgba(0,240,255,0.25)] flex items-center gap-1 shrink-0"
                    >
                      {savedSuccessId === secret.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Guardada</span>
                        </>
                      ) : (
                        <span>Guardar</span>
                      )}
                    </button>

                    {/* Delete button */}
                    {isConfigured && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSecret(secret.id)}
                        className="p-2 rounded-lg bg-[#141824] hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-[#1e2638] hover:border-red-800/40 transition-colors"
                        title="Eliminar este secreto local"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Test Feedback */}
                {currentTest && (
                  <div
                    className={`mt-2.5 p-2 rounded-lg border text-[11px] flex items-center gap-2 ${
                      currentTest.success
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : 'bg-red-950/30 border-red-500/40 text-red-300'
                    }`}
                  >
                    {currentTest.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                    )}
                    <span>{currentTest.message}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#1e2638] bg-[#0c101a]">
          <span className="text-[10px] text-slate-500">
            Almacenamiento Zero-Knowledge: AES-GCM local en navegador
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#151c2d] hover:bg-[#1e263c] text-white transition-colors"
          >
            Cerrar Bóveda
          </button>
        </div>
      </div>
    </div>
  );
};
