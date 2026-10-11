import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, 
  Send, 
  Volume2, 
  Copy, 
  Check, 
  ShieldCheck, 
  Cpu, 
  Mic, 
  MicOff, 
  Sparkles,
  Trash2,
  HardDrive,
  Download,
  Bot
} from 'lucide-react';
import type { ConsoleMessage } from '../types';

interface CommandConsoleProps {
  messages: ConsoleMessage[];
  onSendMessage: (text: string) => void;
  onSpeakMessage: (text: string) => void;
  onClearConsole: () => void;
  isListening: boolean;
  onToggleListening: () => void;
  isProcessing: boolean;
  activeModelName: string;
  activeAgentName?: string;
  onOpenAgents?: () => void;
}

export const CommandConsole: React.FC<CommandConsoleProps> = ({
  messages,
  onSendMessage,
  onSpeakMessage,
  onClearConsole,
  isListening,
  onToggleListening,
  isProcessing,
  activeModelName,
  activeAgentName,
  onOpenAgents,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportChat = () => {
    if (messages.length === 0) return;
    const exportText = messages
      .map(
        (m) =>
          `[${m.timestamp}] ${m.sender.toUpperCase()} (${m.modelUsed || 'Sistema'}):\n${m.text}${
            m.actionDetails ? `\n-> Acción: ${m.actionDetails}` : ''
          }`
      )
      .join('\n\n----------------------------------------\n\n');

    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vvc-liam-core-historial-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col flex-1 pb-4">
      {/* Console Frame */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-2xl flex flex-col h-[380px] sm:h-[440px] transition-colors">
        {/* Terminal Header Bar */}
        <div className="bg-[var(--bg-surface)] px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff2a5f] opacity-80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 opacity-80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 opacity-80" />
            </div>
            <div className="h-3 w-[1px] bg-[var(--border-subtle)] mx-1" />
            <span className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[var(--primary-accent)]" />
              <span className="text-[var(--primary-accent)] font-bold">vvc-liam-core</span>@terminal:~$
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* On-device storage indicator badge */}
            <span
              className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.5 rounded shadow-sm"
              title="Historial persistente guardado localmente en este dispositivo"
            >
              <HardDrive className="w-2.5 h-2.5" />
              <span>DISCO LOCAL ON</span>
            </span>

            {/* Active Agent Badge */}
            {activeAgentName && (
              <button
                onClick={onOpenAgents}
                className="flex items-center gap-1 text-[10px] font-mono text-[#00f0ff] bg-[#00f0ff]/10 border border-[#00f0ff]/30 px-2 py-0.5 rounded hover:bg-[#00f0ff]/20 transition-all cursor-pointer shadow-sm"
                title="Agente activo gobernando las directivas del LLM. Clic para cambiar o editar especificación JSON."
              >
                <Bot className="w-3 h-3 text-[#00f0ff]" />
                <span className="truncate max-w-[110px] font-semibold">{activeAgentName}</span>
              </button>
            )}

            <span className="text-[11px] font-mono text-slate-400 hidden md:inline flex items-center gap-1">
              <Cpu className="w-3 h-3 text-[#b026ff]" />
              {activeModelName}
            </span>

            {/* Export log */}
            {messages.length > 0 && (
              <button
                onClick={handleExportChat}
                className="p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                title="Descargar historial de chat (.txt)"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onClearConsole}
              className="p-1 text-slate-400 hover:text-red-400 transition-colors"
              title="Limpiar registro de consola y memoria local"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Console Message Feed */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
              <Terminal className="w-8 h-8 text-slate-600" />
              <p>Consola iniciada. Dicta un comando o presiona los accesos rápidos.</p>
              <span className="text-[11px] text-[#00f0ff]/60">
                Ej: "Llamar a Carlos", "Encender linterna", "Poner alarma a las 07:00"
              </span>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg transition-all ${
                  msg.sender === 'user'
                    ? 'bg-[var(--bg-surface)] border-l-2 border-[var(--primary-accent)]'
                    : msg.sender === 'assistant'
                    ? 'bg-[var(--bg-obsidian)] border-l-2 border-[var(--secondary-accent)]'
                    : 'bg-[var(--bg-surface)]/70 border-l-2 border-emerald-400'
                }`}
              >
                {/* Meta row */}
                <div className="flex items-center justify-between mb-1.5 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold tracking-wide uppercase ${
                        msg.sender === 'user'
                          ? 'text-[var(--primary-accent)]'
                          : msg.sender === 'assistant'
                          ? 'text-[var(--secondary-accent)]'
                          : 'text-emerald-400'
                      }`}
                    >
                      {msg.sender === 'user'
                        ? '[USER_VOCAL]'
                        : msg.sender === 'assistant'
                        ? `[ACIA_VOICE]`
                        : '[KERNEL_SYS]'}
                    </span>

                    {msg.modelUsed && (
                      <span className="text-[10px] text-slate-400 bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                        {msg.modelUsed}
                      </span>
                    )}

                    {msg.isE2EE && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        E2EE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {msg.timestamp}
                    </span>

                    {msg.sender === 'assistant' && (
                      <button
                        onClick={() => onSpeakMessage(msg.text)}
                        className="text-slate-400 hover:text-[var(--primary-accent)] p-0.5 transition-colors"
                        title="Escuchar con motor Kokoro TTS"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="text-slate-400 hover:text-white p-0.5 transition-colors"
                      title="Copiar texto"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Message Body */}
                <div className="text-slate-200 leading-relaxed whitespace-pre-wrap font-sans sm:font-mono text-xs sm:text-[13px]">
                  {msg.text}
                </div>

                {/* Action details if triggered hardware control */}
                {msg.actionDetails && (
                  <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]/60 flex items-center gap-2 text-[11px] text-[var(--primary-accent)]">
                    <span className="px-1.5 py-0.2 bg-[var(--tag-bg)] rounded border border-[var(--primary-accent)]/30 uppercase text-[9px] font-mono">
                      ACCION DISPOSITIVO
                    </span>
                    <span className="truncate">{msg.actionDetails}</span>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="p-2.5 rounded bg-[var(--bg-surface)] border-l-2 border-[#ff2a5f] flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-[#ff2a5f] animate-ping" />
              <span className="text-[#ff2a5f] font-mono text-xs">
                [NVIDIA NIM / RT-LITE] Procesando inferencia y control de hardware...
              </span>
            </div>
          )}
        </div>

        {/* Input Bar Form */}
        <form onSubmit={handleSubmit} className="bg-[var(--bg-surface)] p-2.5 border-t border-[var(--border-subtle)] flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <span className="absolute left-3 text-slate-500 font-mono text-xs pointer-events-none">
              &gt;
            </span>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe o dicta un comando (ej: Llamar a Alex, Poner alarma 8:00, Cambiar tema a Amber)..."
              className="w-full bg-[var(--bg-obsidian)] border border-[var(--border-subtle)] focus:border-[var(--primary-accent)] rounded pl-7 pr-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder:text-slate-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Quick Mic toggle inside console */}
          <button
            type="button"
            onClick={onToggleListening}
            className={`p-2 rounded border transition-all cursor-pointer ${
              isListening
                ? 'bg-[var(--tag-bg)] border-[var(--primary-accent)] text-[var(--primary-accent)] animate-pulse shadow-[0_0_10px_var(--accent-glow)]'
                : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-slate-300 hover:text-[var(--primary-accent)] hover:border-[var(--primary-accent)]/40'
            }`}
            title={isListening ? 'Micrófono activo' : 'Activar micrófono'}
          >
            {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Send text button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="px-3.5 py-2 rounded bg-[var(--primary-accent)] text-black font-semibold text-xs font-mono flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_12px_var(--accent-glow)] cursor-pointer"
          >
            <span>Ejecutar</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
