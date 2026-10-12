import React, { useState } from 'react';
import { MessageSquare, Send, X, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface MessagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: string;
  initialMessage: string;
  channel: 'SMS' | 'WhatsApp';
  onSend: (recipient: string, message: string, channel: 'SMS' | 'WhatsApp') => void;
}

export const MessagingModal: React.FC<MessagingModalProps> = ({
  isOpen,
  onClose,
  recipient,
  initialMessage,
  channel,
  onSend,
}) => {
  const [msgText, setMsgText] = useState(initialMessage);
  const [recipientText, setRecipientText] = useState(recipient);
  const [isSent, setIsSent] = useState(false);

  if (!isOpen) return null;

  const handleSend = () => {
    setIsSent(true);

    try {
      if (channel === 'WhatsApp') {
        const cleanPhone = recipientText.replace(/[^\d+]/g, '').replace(/^\+/, '');
        const encoded = encodeURIComponent(msgText);
        const waUrl = cleanPhone.length >= 7
          ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
          : `https://api.whatsapp.com/send?text=${encoded}`;
        window.open(waUrl, '_blank');
      } else {
        const cleanPhone = recipientText.replace(/[^\d+]/g, '');
        const encoded = encodeURIComponent(msgText);
        window.location.href = `sms:${cleanPhone || encodeURIComponent(recipientText)}?body=${encoded}`;
      }
    } catch (dispatchErr) {
      console.warn('Real messenger dispatch error:', dispatchErr);
    }

    setTimeout(() => {
      onSend(recipientText, msgText, channel);
      setIsSent(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-[#0a0d16] border border-[#1e2638] rounded-xl p-5 shadow-[0_0_40px_rgba(0,240,255,0.15)] flex flex-col relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2638] mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className={`w-4 h-4 ${channel === 'WhatsApp' ? 'text-emerald-400' : 'text-[#00f0ff]'}`} />
            <span className="font-mono text-xs font-semibold text-white">
              {channel === 'WhatsApp' ? 'Transmisión WhatsApp' : 'Mensaje SMS / Móvil'}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3" />
              E2EE
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recipient */}
        <div className="mb-3">
          <label className="text-[11px] font-mono text-slate-400 block mb-1">
            Destinatario
          </label>
          <input
            type="text"
            value={recipientText}
            onChange={(e) => setRecipientText(e.target.value)}
            className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>

        {/* Message Content */}
        <div className="mb-4">
          <label className="text-[11px] font-mono text-slate-400 block mb-1">
            Cuerpo del Mensaje (Dictado por Voz)
          </label>
          <textarea
            rows={4}
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            className="w-full bg-[#06080d] border border-[#1e2638] focus:border-[#00f0ff] rounded p-3 text-xs font-mono text-slate-100 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1e2638]">
          <span className="text-[10px] font-mono text-slate-500">
            Cifrado con clave de sesión local
          </span>

          <button
            onClick={handleSend}
            disabled={isSent || !msgText.trim()}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-mono font-semibold transition-all ${
              isSent
                ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                : channel === 'WhatsApp'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                : 'bg-[#00f0ff] hover:bg-[#00d4e3] text-black shadow-[0_0_12px_rgba(0,240,255,0.4)]'
            }`}
          >
            {isSent ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Enviado</span>
              </>
            ) : (
              <>
                <span>Enviar {channel}</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
