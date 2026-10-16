import React, { useState } from 'react';
import { 
  Phone, 
  PhoneOff, 
  Smartphone, 
  MessageSquare,
  Copy,
  Check,
  Grid,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import type { ActiveCall } from '../types';

interface PhoneActionModalProps {
  call: ActiveCall;
  onEndCall: () => void;
  onToggleMute?: () => void;
  onToggleSpeaker?: () => void;
}

export const PhoneActionModal: React.FC<PhoneActionModalProps> = ({
  call,
  onEndCall,
}) => {
  const [showKeypad, setShowKeypad] = useState(false);
  const [enteredDigits, setEnteredDigits] = useState('');
  const [copied, setCopied] = useState(false);

  if (!call.inCall) return null;

  const rawPhone = call.phoneNumber || '';
  const cleanPhone = rawPhone.replace(/[^\d+]/g, '');
  const dialerUri = enteredDigits ? `tel:${cleanPhone},${enteredDigits}` : `tel:${cleanPhone}`;
  const whatsappUri = `https://api.whatsapp.com/send?phone=${cleanPhone.replace(/^\+/, '')}`;

  const handleDigit = (digit: string) => {
    setEnteredDigits((prev) => prev + digit);
  };

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(cleanPhone || rawPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDirectDial = () => {
    try {
      window.location.href = dialerUri;
    } catch (e) {
      console.warn('Direct dial dispatch notice:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
      <div className="w-full max-w-sm bg-[#080b12] border border-[#1e2638] rounded-2xl p-6 shadow-[0_0_50px_rgba(0,240,255,0.2)] flex flex-col items-center relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#00f0ff]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Real Phone Protocol Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs mb-5">
          <Smartphone className="w-3.5 h-3.5" />
          <span>Marcador Móvil Directo (Protocolo tel:)</span>
        </div>

        {/* Caller Avatar */}
        <div className="relative mb-3">
          <div className="w-20 h-20 rounded-full bg-[#0e1424] border-2 border-[#00f0ff] flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.4)]">
            <Phone className="w-9 h-9 text-[#00f0ff] animate-pulse" />
          </div>
        </div>

        {/* Contact Name & Phone */}
        <h3 className="text-lg font-bold text-white tracking-wide text-center">
          {call.contactName}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-300">{rawPhone}</span>
          <button
            onClick={handleCopyPhone}
            className="p-1 text-slate-400 hover:text-white rounded"
            title="Copiar número"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Primary Action: Direct Device Phone Call */}
        <div className="mt-5 w-full space-y-2.5">
          <a
            href={dialerUri}
            onClick={handleDirectDial}
            className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]"
          >
            <Phone className="w-4 h-4 fill-current" />
            <span>Llamar Ahora con Marcador del Teléfono</span>
          </a>

          {/* Secondary Action: WhatsApp */}
          <a
            href={whatsappUri}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 px-3 rounded-xl bg-[#0f1523] border border-[#1e2638] hover:border-emerald-500/40 text-slate-200 hover:text-white text-xs flex items-center justify-center gap-2 transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Contactar vía WhatsApp</span>
          </a>
        </div>

        {/* Keypad Toggle Button */}
        <div className="w-full mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setShowKeypad(!showKeypad)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 py-1 px-2.5 rounded bg-cyan-950/40 border border-cyan-800/40"
          >
            <Grid className="w-3 h-3" />
            <span>{showKeypad ? 'Ocultar teclado DTMF' : 'Abrir teclado / extensión'}</span>
          </button>
        </div>

        {/* DTMF Keypad */}
        {showKeypad && (
          <div className="w-full mt-3 p-3 bg-[#0d121f] rounded-xl border border-[#1e2638] text-center animate-fade-in">
            <div className="text-xs text-white mb-2 h-5 tracking-widest font-mono flex items-center justify-between px-2">
              <span>Extensión: {enteredDigits || '—'}</span>
              {enteredDigits && (
                <button
                  type="button"
                  onClick={() => setEnteredDigits('')}
                  className="text-[10px] text-slate-400 hover:text-white"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className="py-1.5 rounded bg-[#141b2e] hover:bg-[#1a233b] text-slate-200 text-xs border border-[#1e2638] transition-colors"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Close Button */}
        <div className="mt-5 w-full pt-3 border-t border-[#1e2638] flex items-center justify-center">
          <button
            type="button"
            onClick={onEndCall}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff2a5f]/20 hover:bg-[#ff2a5f]/30 border border-[#ff2a5f]/50 text-[#ff2a5f] text-xs font-semibold transition-all"
            title="Cerrar marcador"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Cerrar Marcador</span>
          </button>
        </div>
      </div>
    </div>
  );
};
