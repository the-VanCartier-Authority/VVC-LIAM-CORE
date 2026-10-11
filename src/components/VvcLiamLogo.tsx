import React from 'react';

export type LogoVariant = 'full' | 'badge' | 'monogram' | 'compact' | 'micro';

interface VvcLiamLogoProps {
  variant?: LogoVariant;
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
}

export const VvcLiamLogo: React.FC<VvcLiamLogoProps> = ({
  variant = 'full',
  size = 'md',
  showTagline = true,
  className = '',
}) => {
  // Determine pixel size for the emblem
  const emblemSize = typeof size === 'number' 
    ? size 
    : size === 'sm' 
      ? 36 
      : size === 'md' 
        ? 48 
        : size === 'lg' 
          ? 72 
          : 96;

  // Render SVG Emblem
  const renderEmblem = (dim: number) => (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform duration-300 hover:scale-[1.03]"
    >
      <defs>
        {/* Metallic Brushed Gold Gradient */}
        <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE885" />
          <stop offset="25%" stopColor="#D4AF37" />
          <stop offset="50%" stopColor="#997C1E" />
          <stop offset="75%" stopColor="#E5C158" />
          <stop offset="100%" stopColor="#806512" />
        </linearGradient>

        {/* Polished Silver Metallic Gradient */}
        <linearGradient id="logoSilver" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="30%" stopColor="#E0E0E0" />
          <stop offset="60%" stopColor="#A8A8A8" />
          <stop offset="85%" stopColor="#C0C0C0" />
          <stop offset="100%" stopColor="#707070" />
        </linearGradient>

        {/* Neon Emerald Gradient */}
        <linearGradient id="logoEmerald" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#66FF99" />
          <stop offset="50%" stopColor="#00FF66" />
          <stop offset="100%" stopColor="#009933" />
        </linearGradient>

        {/* Deep Obsidian Radial Gradient */}
        <radialGradient id="logoObsidian" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#140C1A" />
          <stop offset="65%" stopColor="#0A060D" />
          <stop offset="100%" stopColor="#050307" />
        </radialGradient>

        {/* Emerald Glow */}
        <filter id="logoEmeraldGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComponentTransfer in="blur" result="boost">
            <feFuncA type="linear" slope="1.8" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="boost" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer Squircle Container with Gold Border */}
      <rect
        x="24"
        y="24"
        width="464"
        height="464"
        rx="104"
        fill="url(#logoObsidian)"
        stroke="url(#logoGold)"
        strokeWidth="14"
      />
      <rect
        x="38"
        y="38"
        width="436"
        height="436"
        rx="90"
        fill="none"
        stroke="url(#logoGold)"
        strokeWidth="3"
        opacity="0.75"
      />

      {/* Concentric Silver Track */}
      <circle cx="256" cy="256" r="186" fill="#0C0710" stroke="url(#logoSilver)" strokeWidth="7" />
      <circle cx="256" cy="256" r="176" fill="none" stroke="#000000" strokeWidth="4" opacity="0.6" />

      {/* Neon Emerald Glowing Power Ring */}
      <circle
        cx="256"
        cy="256"
        r="162"
        fill="none"
        stroke="url(#logoEmerald)"
        strokeWidth="6"
        filter="url(#logoEmeraldGlow)"
        opacity="0.95"
      />
      <circle cx="256" cy="256" r="152" fill="#09050C" stroke="#1F1528" strokeWidth="2" />

      {/* Ticks */}
      <g stroke="#C0C0C0" strokeWidth="3" opacity="0.6" strokeLinecap="round">
        <line x1="256" y1="98" x2="256" y2="108" />
        <line x1="256" y1="404" x2="256" y2="414" />
        <line x1="98" y1="256" x2="108" y2="256" />
        <line x1="404" y1="256" x2="414" y2="256" />
      </g>

      {/* Outer Polished Silver Chevron Wings (Outer 'V') */}
      <path
        d="M128 172 L198 172 L256 348 L314 172 L384 172 L278 392 L234 392 Z"
        fill="url(#logoSilver)"
        stroke="#4A4A4A"
        strokeWidth="2"
      />
      <path d="M128 172 L198 172 L256 348 L234 348 Z" fill="#E6E6E6" opacity="0.4" />
      <path d="M384 172 L314 172 L256 348 L278 348 Z" fill="#999999" opacity="0.4" />

      {/* Inner Brushed Gold Chevron & Shield */}
      <path
        d="M206 206 L244 206 L256 314 L268 206 L306 206 L272 344 L240 344 Z"
        fill="url(#logoGold)"
        stroke="#7A6016"
        strokeWidth="2"
      />
      <path d="M256 220 L256 332" stroke="#FFF5B8" strokeWidth="3" strokeLinecap="round" />

      {/* Radiant Emerald Gem Diamond */}
      <polygon
        points="256,128 274,188 256,224 238,188"
        fill="url(#logoEmerald)"
        filter="url(#logoEmeraldGlow)"
        stroke="#B3FFCC"
        strokeWidth="2"
      />
      <polygon points="256,140 268,188 256,212 244,188" fill="#FFFFFF" opacity="0.6" />
    </svg>
  );

  // Micro Mark (16-32px Favicon / Inline)
  if (variant === 'micro') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {renderEmblem(24)}
      </div>
    );
  }

  // Monogram (Favicon / Minimal)
  if (variant === 'monogram') {
    return (
      <div className={`inline-flex items-center gap-1.5 font-mono tracking-widest ${className}`}>
        <span className="text-[#8A2BFF] font-black text-sm drop-shadow-[0_0_8px_rgba(138,43,255,0.7)]">
          VVC
        </span>
        <span className="text-[#00FF66] font-bold text-xs tracking-wider">
          CORE
        </span>
      </div>
    );
  }

  // Badge Only (Square Icon)
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {renderEmblem(emblemSize)}
      </div>
    );
  }

  // Compact Header / Nav layout
  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-3 select-none ${className}`}>
        {renderEmblem(emblemSize)}
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-mono text-xs font-black tracking-[0.22em] text-[#8A2BFF] drop-shadow-[0_0_8px_rgba(138,43,255,0.6)]">
              VVC
            </span>
            <span className="font-mono text-[11px] font-extrabold tracking-[0.16em] text-[#00FF66] drop-shadow-[0_0_8px_rgba(0,255,102,0.5)]">
              LIAM CORE
            </span>
          </div>
          {showTagline && (
            <span className="font-mono text-[9px] tracking-[0.18em] text-[#C0C0C0]/70 mt-1 uppercase">
              Control // Analyze // Execute
            </span>
          )}
        </div>
      </div>
    );
  }

  // Full Master Brand Presentation (Matches Brand Board Hero)
  return (
    <div className={`flex flex-col items-center text-center select-none ${className}`}>
      {renderEmblem(emblemSize)}

      {/* VVC Violet Neon Monogram */}
      <div className="mt-3 font-mono font-black text-xl sm:text-2xl tracking-[0.28em] text-[#8A2BFF] drop-shadow-[0_0_14px_rgba(138,43,255,0.85)]">
        VVC
      </div>

      {/* Cyber Horizontal Circuit Line */}
      <div className="w-24 sm:w-32 h-[2px] bg-gradient-to-r from-transparent via-[#00FF66] to-transparent my-1.5 opacity-80" />

      {/* LIAM CORE Emerald Neon */}
      <div className="font-mono font-extrabold text-sm sm:text-base tracking-[0.24em] text-[#00FF66] drop-shadow-[0_0_12px_rgba(0,255,102,0.8)] uppercase">
        LIAM CORE
      </div>

      {/* Official Slogan: CONTROL // ANALYZE // EXECUTE */}
      {showTagline && (
        <div className="mt-1.5 font-mono text-[10px] sm:text-xs tracking-[0.2em] text-[#8A2BFF] font-semibold uppercase opacity-90">
          CONTROL <span className="text-[#00FF66]">//</span> ANALYZE <span className="text-[#00FF66]">//</span> EXECUTE
        </div>
      )}
    </div>
  );
};
