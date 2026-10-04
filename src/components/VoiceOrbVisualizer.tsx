import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, ShieldCheck, Radio, Sparkles } from 'lucide-react';

interface VoiceOrbVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  currentTranscript: string;
  onToggleListening: () => void;
  statusLabel: string;
  activeModelName: string;
  isOffline: boolean;
}

export const VoiceOrbVisualizer: React.FC<VoiceOrbVisualizerProps> = ({
  isListening,
  isSpeaking,
  isProcessing,
  currentTranscript,
  onToggleListening,
  statusLabel,
  activeModelName,
  isOffline,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      phase += 0.05;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Determine colors based on active state
      let primaryColor = '#00f0ff'; // Neon blue
      let secondaryColor = '#b026ff'; // Neon violet
      let glowColor = 'rgba(0, 240, 255, 0.4)';

      if (isSpeaking) {
        primaryColor = '#b026ff';
        secondaryColor = '#00f0ff';
        glowColor = 'rgba(176, 38, 255, 0.5)';
      } else if (isProcessing) {
        primaryColor = '#ff2a5f';
        secondaryColor = '#b026ff';
        glowColor = 'rgba(255, 42, 95, 0.5)';
      } else if (isListening) {
        primaryColor = '#00f0ff';
        secondaryColor = '#38bdf8';
        glowColor = 'rgba(0, 240, 255, 0.6)';
      }

      // 1. Draw outer ambient holographic grid circles
      ctx.save();
      ctx.lineWidth = 1;
      for (let r = 85; r <= 140; r += 20) {
        ctx.strokeStyle = 'rgba(30, 38, 56, 0.4)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2. Draw cybernetic orbital ticks
      const numTicks = 36;
      for (let i = 0; i < numTicks; i++) {
        const angle = (i * (Math.PI * 2)) / numTicks + phase * 0.2;
        const innerR = 125;
        const outerR = i % 3 === 0 ? 134 : 129;
        ctx.strokeStyle = i % 4 === 0 ? primaryColor : 'rgba(100, 116, 139, 0.3)';
        ctx.lineWidth = i % 4 === 0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * innerR, centerY + Math.sin(angle) * innerR);
        ctx.lineTo(centerX + Math.cos(angle) * outerR, centerY + Math.sin(angle) * outerR);
        ctx.stroke();
      }

      // 3. Dynamic Waveform Ring
      const wavePoints = 64;
      const baseRadius = 80;
      const amplitude = isListening ? 18 : isSpeaking ? 14 : isProcessing ? 8 : 3;

      ctx.beginPath();
      for (let i = 0; i <= wavePoints; i++) {
        const theta = (i / wavePoints) * Math.PI * 2;
        // Harmonic wave oscillation
        const wave =
          Math.sin(theta * 6 + phase * 3) * amplitude * 0.6 +
          Math.cos(theta * 3 - phase * 2) * amplitude * 0.4;
        const r = baseRadius + wave;
        const x = centerX + Math.cos(theta) * r;
        const y = centerY + Math.sin(theta) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.shadowBlur = isListening || isSpeaking ? 15 : 6;
      ctx.shadowColor = glowColor;
      ctx.stroke();

      // 4. Inner secondary neon wave (counter-rotating)
      ctx.beginPath();
      for (let i = 0; i <= wavePoints; i++) {
        const theta = (i / wavePoints) * Math.PI * 2;
        const wave = Math.sin(theta * 4 - phase * 2.5) * (amplitude * 0.4);
        const r = baseRadius - 12 + wave;
        const x = centerX + Math.cos(theta) * r;
        const y = centerY + Math.sin(theta) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = secondaryColor;
      ctx.stroke();

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening, isSpeaking, isProcessing]);

  return (
    <div className="relative flex flex-col items-center justify-center py-6 px-4">
      {/* Background radial gradient spotlight */}
      <div className="absolute w-72 h-72 rounded-full bg-[#00f0ff]/5 blur-3xl pointer-events-none -z-10" />

      {/* Interactive Visualizer Sphere Container */}
      <div className="relative flex items-center justify-center w-80 h-80">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="absolute inset-0 pointer-events-none"
        />

        {/* Center Interactive Orb Button */}
        <button
          onClick={onToggleListening}
          aria-label={isListening ? 'Detener escucha' : 'Activar micrófono para hablar'}
          className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 focus:outline-none cursor-pointer ${
            isListening
              ? 'bg-[#00f0ff]/20 border-2 border-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.7)] scale-105'
              : isSpeaking
              ? 'bg-[#b026ff]/20 border-2 border-[#b026ff] shadow-[0_0_30px_rgba(176,38,255,0.7)]'
              : isProcessing
              ? 'bg-[#ff2a5f]/20 border-2 border-[#ff2a5f] shadow-[0_0_25px_rgba(255,42,95,0.6)] animate-pulse'
              : 'bg-[#0a0d14] border border-[#1e2638] hover:border-[#00f0ff]/60 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:scale-105'
          }`}
        >
          {/* Animated Core Icon */}
          <div className="relative">
            {isSpeaking ? (
              <Volume2 className="w-8 h-8 text-[#b026ff] animate-bounce" />
            ) : isListening ? (
              <Mic className="w-8 h-8 text-[#00f0ff] animate-pulse" />
            ) : isProcessing ? (
              <Radio className="w-8 h-8 text-[#ff2a5f] animate-spin" />
            ) : (
              <MicOff className="w-8 h-8 text-slate-400 group-hover:text-[#00f0ff]" />
            )}
          </div>

          <span className="text-[10px] font-mono tracking-widest font-semibold mt-1 uppercase text-slate-200">
            {isListening ? 'ESCUDRIÑANDO' : isSpeaking ? 'HABLANDO' : isProcessing ? 'CALCULANDO' : 'ACTIVAR'}
          </span>
        </button>
      </div>

      {/* Dynamic Status Badges & Live Transcript */}
      <div className="flex flex-col items-center gap-2 max-w-xl text-center mt-1">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0a0d14] border border-[#1e2638] text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                isListening
                  ? 'bg-[#00f0ff] shadow-[0_0_8px_#00f0ff] animate-ping'
                  : isSpeaking
                  ? 'bg-[#b026ff] shadow-[0_0_8px_#b026ff]'
                  : isProcessing
                  ? 'bg-[#ff2a5f] shadow-[0_0_8px_#ff2a5f]'
                  : 'bg-slate-500'
              }`}
            />
            {statusLabel}
          </span>

          <span className="px-2 py-1 rounded bg-[#0a0d14] border border-[#1e2638] text-[#00f0ff] text-[11px] truncate max-w-[200px]">
            {isOffline ? 'RT-Lite Local' : activeModelName}
          </span>

          <span className="flex items-center gap-1 px-2 py-1 rounded bg-[#0a0d14] border border-[#1e2638] text-emerald-400 text-[11px]">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            E2EE
          </span>
        </div>

        {/* Real-time speech transcript caption */}
        {currentTranscript && (
          <div className="w-full bg-[#0a0d14]/90 border border-[#00f0ff]/30 rounded px-4 py-2 text-xs font-mono text-[#00f0ff] tracking-wide animate-fade-in shadow-[0_0_15px_rgba(0,240,255,0.15)] flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#00f0ff] shrink-0 animate-pulse" />
            <span className="italic">"{currentTranscript}"</span>
          </div>
        )}
      </div>
    </div>
  );
};
