import React from 'react';

interface VvcLiamCoreLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export const VvcLiamCoreLogo: React.FC<VvcLiamCoreLogoProps> = ({
  size = 'md',
  showText = true,
  showSubtitle = true,
  className = '',
}) => {
  const sizeMap = {
    sm: { icon: 28, text: 'text-xs', sub: 'text-[9px]', gap: 'gap-2' },
    md: { icon: 36, text: 'text-sm sm:text-base', sub: 'text-[10px]', gap: 'gap-2.5' },
    lg: { icon: 48, text: 'text-lg sm:text-xl', sub: 'text-xs', gap: 'gap-3' },
    xl: { icon: 64, text: 'text-2xl sm:text-3xl', sub: 'text-sm', gap: 'gap-4' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center ${currentSize.gap} select-none ${className}`}>
      {/* Cybernetic Liam Core Emblem */}
      <div 
        className="relative shrink-0 flex items-center justify-center rounded-lg transition-transform hover:scale-105"
        style={{ width: currentSize.icon, height: currentSize.icon }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-[0_0_12px_var(--accent-glow)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="vvcGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary-accent, #00f0ff)" />
              <stop offset="100%" stopColor="var(--secondary-accent, #b026ff)" />
            </linearGradient>
            <linearGradient id="vvcGradGold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffaa00" />
              <stop offset="100%" stopColor="#ff2a5f" />
            </linearGradient>
            <radialGradient id="vvcCorePulse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--primary-accent, #00f0ff)" stopOpacity="0.8" />
              <stop offset="60%" stopColor="var(--secondary-accent, #b026ff)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Outer Octagonal Frame */}
          <polygon
            points="50,4 88,20 96,62 70,94 30,94 4,62 12,20"
            fill="#080c16"
            stroke="url(#vvcGradPrimary)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Cyber Ticks and Circuit Nodes */}
          <line x1="50" y1="4" x2="50" y2="14" stroke="var(--primary-accent, #00f0ff)" strokeWidth="2" strokeLinecap="round" />
          <line x1="96" y1="62" x2="86" y2="62" stroke="var(--primary-accent, #00f0ff)" strokeWidth="2" strokeLinecap="round" />
          <line x1="4" y1="62" x2="14" y2="62" stroke="var(--primary-accent, #00f0ff)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="50" cy="50" r="28" fill="url(#vvcCorePulse)" />

          {/* Inner Hex Prism */}
          <polygon
            points="50,22 75,36 75,64 50,78 25,64 25,36"
            fill="#05070d"
            stroke="var(--border-subtle, #1e2638)"
            strokeWidth="1.5"
          />

          {/* Stylized Cyber "V" Monogram with LIAM Center Apex */}
          <path
            d="M32 36 L50 70 L68 36 L59 36 L50 56 L41 36 Z"
            fill="url(#vvcGradPrimary)"
          />
          
          {/* Liam Core Central Prism Crystal */}
          <polygon
            points="50,40 56,50 50,60 44,50"
            fill="url(#vvcGradGold)"
          />

          {/* Orbiting Quantum Indicator */}
          <circle cx="70" cy="30" r="2.5" fill="var(--primary-accent, #00f0ff)" className="animate-ping" />
        </svg>

        {/* Outer Corner Glow Accent */}
        <div 
          className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'var(--primary-accent)' }}
        />
      </div>

      {/* Typography Unit */}
      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          <div className="flex items-center gap-1.5">
            <span className={`font-mono font-black tracking-wider text-[var(--text-primary)] ${currentSize.text} drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]`}>
              VVC <span className="text-[var(--primary-accent)]">LIAM</span> CORE
            </span>
          </div>

          {showSubtitle && (
            <div className="flex items-center gap-1.5">
              <span className={`font-mono tracking-widest text-slate-400 uppercase ${currentSize.sub}`}>
                NEURAL OS · OBSIDIAN
              </span>
              <span className="w-1 h-1 rounded-full bg-[var(--primary-accent)] animate-pulse" />
              <span className="text-[8px] font-mono text-[var(--primary-accent)] px-1 py-0.2 bg-[var(--tag-bg)] border border-[var(--primary-accent)]/30 rounded">
                v2.4
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
