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
  Trash2
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

  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col flex-1 pb-4">
      {/* Console Frame */}
      <div className="bg-[#07090e] border border-[#1e2638] rounded-lg overflow-hidden shadow-2xl flex flex-col h-[380px] sm:h-[440px]">
        {/* Terminal Header Bar */}
        <div className="bg-[#0b0e17] px-4 py-2.5 border-b border-[#1e2638] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff2a5f] opacity-80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 opacity-80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 opacity-80" />
            </div>
            <div className="h-3 w-[1px] bg-[#1e2638] mx-1" />
            <span className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[#00f0ff]" />
              <span className="text-[#00f0ff]">vvc-acia</span>@obsidian-core:~$
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline flex items-center gap-1">
              <Cpu className="w-3 h-3 text-[#b026ff]" />
              {activeModelName}
            </span>

            <button
              onClick={onClearConsole}
              className="p-1 text-slate-400 hover:text-red-400 transition-colors"
              title="Limpiar registro de consola"
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
                className={`p-3 rounded transition-all ${
                  msg.sender === 'user'
                    ? 'bg-[#0f1422] border-l-2 border-[#00f0ff]'
                    : msg.sender === 'assistant'
                    ? 'bg-[#0a0d14] border-l-2 border-[#b026ff]'
                    : 'bg-[#121622]/60 border-l-2 border-emerald-400'
                }`}
              >
                {/* Meta row */}
                <div className="flex items-center justify-between mb-1.5 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold tracking-wide uppercase ${
                        msg.sender === 'user'
                          ? 'text-[#00f0ff]'
                          : msg.sender === 'assistant'
                          ? 'text-[#b026ff]'
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
                      <span className="text-[10px] text-slate-400 bg-[#141a29] px-1.5 py-0.5 rounded border border-[#1e2638]">
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
                        className="text-slate-400 hover:text-[#00f0ff] p-0.5 transition-colors"
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
                  <div className="mt-2 pt-2 border-t border-[#1e2638]/60 flex items-center gap-2 text-[11px] text-[#00f0ff]">
                    <span className="px-1.5 py-0.2 bg-[#00f0ff]/10 rounded border border-[#00f0ff]/30 uppercase text-[9px] font-mono">
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
            <div className="p-2.5 rounded bg-[#0a0d14] border-l-2 border-[#ff2a5f] flex items-center gap-2 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-[#ff2a5f] animate-ping" />
              <span className="text-[#ff2a5f] font-mono text-xs">
                [NVIDIA NIM / RT-LITE] Procesando inferencia y control de hardware...
              </span>
            </div>
          )}
        </div>

        {/* Input Bar Form */}
        <form onSubmit={handleSubmit} className="bg-[#0b0e17] p-2.5 border-t border-[#1e2638] flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <span className="absolute left-3 text-slate-500 font-mono text-xs pointer-events-none">
              &gt;
            </span>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe o dicta un comando (ej: Llamar a Alex, Poner alarma 8:00, Brillo al 70%)..."
              className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded pl-7 pr-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Quick Mic toggle inside console */}
          <button
            type="button"
            onClick={onToggleListening}
            className={`p-2 rounded border transition-all ${
              isListening
                ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff] animate-pulse shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                : 'bg-[#0f141f] border-[#1e2638] text-slate-300 hover:text-[#00f0ff] hover:border-[#00f0ff]/40'
            }`}
            title={isListening ? 'Micrófono activo' : 'Activar micrófono'}
          >
            {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          {/* Send text button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="px-3.5 py-2 rounded bg-[#00f0ff] hover:bg-[#00d0df] text-black font-semibold text-xs font-mono flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_12px_rgba(0,240,255,0.4)]"
          >
            <span>Ejecutar</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
