import React, { useEffect, useState } from 'react';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  User, 
  Grid 
} from 'lucide-react';
import type { ActiveCall } from '../types';

interface PhoneActionModalProps {
  call: ActiveCall;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
}

export const PhoneActionModal: React.FC<PhoneActionModalProps> = ({
  call,
  onEndCall,
  onToggleMute,
  onToggleSpeaker,
}) => {
  const [duration, setDuration] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [enteredDigits, setEnteredDigits] = useState('');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (call.inCall && call.state === 'connected') {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(timer);
  }, [call.inCall, call.state]);

  if (!call.inCall) return null;

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const handleDigit = (digit: string) => {
    setEnteredDigits((prev) => prev + digit);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-[#080b12] border border-[#1e2638] rounded-2xl p-6 shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col items-center relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#00f0ff]/10 rounded-full blur-3xl pointer-events-none" />

        {/* E2EE Call Security Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-6">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Llamada Cifrada E2EE (TLS-SRTP)</span>
        </div>

        {/* Caller Avatar */}
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-full bg-[#0e1424] border-2 border-[#00f0ff] flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.4)]">
            <User className="w-12 h-12 text-[#00f0ff]" />
          </div>
          {call.state === 'connected' && (
            <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#080b12] flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            </span>
          )}
        </div>

        {/* Contact Name & Phone */}
        <h3 className="text-xl font-bold font-mono text-white tracking-wide text-center">
          {call.contactName}
        </h3>
        <p className="text-xs font-mono text-slate-400 mt-1">
          {call.phoneNumber}
        </p>

        {/* Call State / Duration */}
        <div className="mt-3 text-sm font-mono text-[#00f0ff] tracking-widest tabular-nums">
          {call.state === 'calling' ? (
            <span className="animate-pulse">LLAMANDO...</span>
          ) : (
            <span>{formatDuration(duration)}</span>
          )}
        </div>

        {/* Real Native Dialer Integration */}
        <div className="mt-4 w-full">
          <a
            href={`tel:${call.phoneNumber.replace(/[^\d+]/g, '')}`}
            className="w-full py-2 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 text-xs font-mono font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
            onClick={(e) => {
              // Ensure we don't break if phone protocol is blocked
              try {
                window.location.href = `tel:${call.phoneNumber.replace(/[^\d+]/g, '')}`;
              } catch {}
            }}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Abrir Marcador Telefónico Real (Llamada Celular)</span>
          </a>
        </div>

        {/* Keypad if active */}
        {showKeypad && (
          <div className="w-full mt-4 p-3 bg-[#0d121f] rounded-xl border border-[#1e2638] text-center animate-fade-in">
            <div className="text-sm font-mono text-white mb-2 h-6 tracking-widest">
              {enteredDigits || 'Pulsa un dígito'}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDigit(d)}
                  className="py-2 rounded bg-[#141b2e] hover:bg-[#1a233b] text-slate-200 font-mono text-sm border border-[#1e2638] transition-colors"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* In-Call Actions */}
        <div className="grid grid-cols-3 gap-4 w-full mt-6 mb-6">
          {/* Mute */}
          <button
            onClick={onToggleMute}
            className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${
              call.isMuted
                ? 'bg-[#ff2a5f]/20 border-[#ff2a5f] text-[#ff2a5f]'
                : 'bg-[#0f1422] border-[#1e2638] text-slate-300 hover:text-white'
            }`}
          >
            {call.isMuted ? <MicOff className="w-5 h-5 mb-1" /> : <Mic className="w-5 h-5 mb-1" />}
            <span className="text-[10px] font-mono">{call.isMuted ? 'Silenciado' : 'Silenciar'}</span>
          </button>

          {/* Keypad */}
          <button
            onClick={() => setShowKeypad(!showKeypad)}
            className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${
              showKeypad
                ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-[#00f0ff]'
                : 'bg-[#0f1422] border-[#1e2638] text-slate-300 hover:text-white'
            }`}
          >
            <Grid className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-mono">Teclado</span>
          </button>

          {/* Speaker */}
          <button
            onClick={onToggleSpeaker}
            className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${
              call.isSpeaker
                ? 'bg-[#b026ff]/20 border-[#b026ff] text-[#b026ff]'
                : 'bg-[#0f1422] border-[#1e2638] text-slate-300 hover:text-white'
            }`}
          >
            {call.isSpeaker ? <Volume2 className="w-5 h-5 mb-1" /> : <VolumeX className="w-5 h-5 mb-1" />}
            <span className="text-[10px] font-mono">{call.isSpeaker ? 'Altavoz ON' : 'Altavoz'}</span>
          </button>
        </div>

        {/* End Call Button */}
        <button
          onClick={onEndCall}
          className="w-16 h-16 rounded-full bg-[#ff2a5f] hover:bg-[#ff154d] text-white flex items-center justify-center shadow-[0_0_25px_rgba(255,42,95,0.6)] hover:scale-105 transition-all cursor-pointer"
          title="Finalizar llamada"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};
