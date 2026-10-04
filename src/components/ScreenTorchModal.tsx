import React, { useState, useEffect } from 'react';
import { Flashlight, X, Zap, AlertTriangle } from 'lucide-react';

interface ScreenTorchModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTorchActive: boolean;
}

export const ScreenTorchModal: React.FC<ScreenTorchModalProps> = ({
  isOpen,
  onClose,
  isTorchActive,
}) => {
  const [mode, setMode] = useState<'constant' | 'strobe' | 'sos'>('constant');
  const [strobeState, setStrobeState] = useState(true);

  // Strobe & SOS light timer
  useEffect(() => {
    if (!isOpen) return;

    let interval: NodeJS.Timeout;
    if (mode === 'strobe') {
      interval = setInterval(() => {
        setStrobeState((prev) => !prev);
      }, 100);
    } else if (mode === 'sos') {
      interval = setInterval(() => {
        setStrobeState((prev) => !prev);
      }, 300);
    } else {
      setStrobeState(true);
    }

    return () => clearInterval(interval);
  }, [isOpen, mode]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 transition-colors duration-100 ${
        strobeState ? 'bg-white text-black' : 'bg-black text-white'
      }`}
    >
      {/* Top Bar Controls */}
      <div className="w-full flex items-center justify-between max-w-lg z-10">
        <div className="flex items-center gap-2">
          <Flashlight className="w-5 h-5 text-amber-500" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider">
            Linterna de Emergencia // {mode.toUpperCase()}
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 transition-colors shadow-lg"
          title="Apagar Linterna"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Center Luminescence Icon */}
      <div className="flex flex-col items-center justify-center my-auto z-10 text-center">
        <div className="w-32 h-32 rounded-full bg-amber-400/30 border-4 border-amber-400 flex items-center justify-center shadow-[0_0_80px_rgba(251,191,36,0.8)] animate-pulse mb-4">
          <Zap className="w-16 h-16 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold font-mono">
          Luz Blanca de Alta Intensidad
        </h2>
        <p className="text-xs font-mono opacity-80 mt-1 max-w-xs">
          Emisión de fotones a pantalla completa optimizada para rescate u oscuridad total.
        </p>
      </div>

      {/* Mode Selectors */}
      <div className="flex items-center gap-3 z-10">
        <button
          onClick={() => setMode('constant')}
          className={`px-4 py-2 rounded-full font-mono text-xs font-semibold transition-all shadow-md ${
            mode === 'constant'
              ? 'bg-neutral-900 text-white'
              : 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300'
          }`}
        >
          Luz Fija
        </button>

        <button
          onClick={() => setMode('strobe')}
          className={`px-4 py-2 rounded-full font-mono text-xs font-semibold transition-all shadow-md ${
            mode === 'strobe'
              ? 'bg-amber-500 text-black'
              : 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300'
          }`}
        >
          Estroboscópica
        </button>

        <button
          onClick={() => setMode('sos')}
          className={`px-4 py-2 rounded-full font-mono text-xs font-semibold transition-all shadow-md flex items-center gap-1 ${
            mode === 'sos'
              ? 'bg-[#ff2a5f] text-white'
              : 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>S.O.S.</span>
        </button>
      </div>
    </div>
  );
};
