import React from 'react';
import { 
  ShieldCheck, 
  Wifi, 
  WifiOff, 
  Sliders, 
  Cpu, 
  Calendar, 
  Lock, 
  Volume2, 
  VolumeX,
  Smartphone,
  Cloud,
  Mail,
  Compass,
  FolderOpen,
  User as UserIcon,
  Palette,
  FileText,
  Bot,
  Activity,
  HelpCircle,
  Key
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { 
  AVAILABLE_MODELS, 
  CLOUD_INTEGRATIONS, 
  THEME_SCHEMES,
  type ModelType, 
  type CloudServiceIntegrationType,
  type ThemeColorId
} from '../types';
import { VvcLiamLogo } from './VvcLiamLogo';

interface HeaderProps {
  currentModel: ModelType;
  onSelectModel: (model: ModelType) => void;
  currentCloudIntegration: CloudServiceIntegrationType;
  onSelectCloudIntegration: (ci: CloudServiceIntegrationType) => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  onOpenSettings: () => void;
  onOpenCalendar: () => void;
  onOpenDocs: () => void;
  onOpenAgents?: () => void;
  onOpenTelemetry?: () => void;
  activeAgentName?: string;
  onOpenVault: () => void;
  onOpenDeviceControls: () => void;
  onOpenGmail: () => void;
  onOpenPicker: () => void;
  onOpenMaps: () => void;
  onOpenContacts?: () => void;
  currentUser: User | null;
  onSignInGoogle: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  pendingTasksCount: number;
  onOpenInstallModal?: () => void;
  currentTheme?: ThemeColorId;
  onSelectTheme?: (theme: ThemeColorId) => void;
  onOpenHelp?: () => void;
  onOpenSecrets?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentModel,
  onSelectModel,
  currentCloudIntegration,
  onSelectCloudIntegration,
  isOffline,
  onToggleOffline,
  onOpenSettings,
  onOpenCalendar,
  onOpenDocs,
  onOpenAgents,
  onOpenTelemetry,
  activeAgentName,
  onOpenVault,
  onOpenDeviceControls,
  onOpenGmail,
  onOpenPicker,
  onOpenMaps,
  onOpenContacts,
  currentUser,
  onSignInGoogle,
  isMuted,
  onToggleMute,
  pendingTasksCount,
}) => {

  return (
    <header className="w-full bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Official VVC LIAM CORE Brand Emblem & Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <VvcLiamLogo variant="compact" size="sm" showTagline={true} />
        </div>

        {/* Zone 2: Navigation & Quick Hub Links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          {/* Real-time D3.js Telemetry & VAOS Button */}
          {onOpenTelemetry && (
            <button
              onClick={onOpenTelemetry}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded bg-[#120B1C] border border-[#261833] hover:border-[#00FF66]/50 text-[#00FF66] transition-all shadow-[0_0_12px_rgba(0,255,102,0.12)] cursor-pointer"
              title="Panel de Telemetría D3.js en tiempo real y Orquestador VAOS (Latencia, Tokens/seg, Batería)"
            >
              <Activity className="w-3.5 h-3.5 text-[#00FF66] animate-pulse" />
              <span className="font-bold">Telemetría (D3)</span>
            </button>
          )}

          {/* Calendar & Tasks Link */}
          <button
            onClick={onOpenCalendar}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-[#00f0ff] hover:bg-[#0f141f] rounded transition-colors relative"
          >
            <Calendar className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span>Agenda & Tareas</span>
            {pendingTasksCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#00f0ff] text-black text-[9px] font-bold">
                {pendingTasksCount}
              </span>
            )}
          </button>

          {/* Document & Spreadsheet Studio Link with PDF Export */}
          <button
            onClick={onOpenDocs}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-emerald-400 hover:bg-[#0f141f] rounded transition-colors"
            title="Estudio de Documentos de Texto y Hojas de Cálculo con exportación a PDF"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Docs & PDF</span>
          </button>

          {/* E2EE Encrypted Vault Link */}
          <button
            onClick={onOpenVault}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-[#00f0ff] hover:bg-[#0f141f] rounded transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-[#ff2a5f]" />
            <span>Bóveda experimental</span>
          </button>

          {/* Gmail Workspace Link */}
          <button
            onClick={onOpenGmail}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-red-400 hover:bg-[#0f141f] rounded transition-colors"
            title="Abrir Gmail Workspace"
          >
            <Mail className="w-3.5 h-3.5 text-red-400" />
            <span>Gmail</span>
          </button>

          {/* Google Picker & Drive Link */}
          <button
            onClick={onOpenPicker}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-blue-400 hover:bg-[#0f141f] rounded transition-colors"
            title="Abrir Google Picker para explorar Google Drive"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Picker Drive</span>
          </button>

          {/* Google Maps Radar Link */}
          <button
            onClick={onOpenMaps}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-cyan-400 hover:bg-[#0f141f] rounded transition-colors"
            title="Abrir Google Maps"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Google Maps</span>
          </button>

          {/* Device Controls Phone Hub */}
          <button
            onClick={onOpenDeviceControls}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-[#b026ff] hover:bg-[#0f141f] rounded transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#b026ff]" />
            <span>Teléfono</span>
          </button>

          {/* Google Contacts People Link */}
          {onOpenContacts && (
            <button
              onClick={onOpenContacts}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-amber-400 hover:bg-[#0f141f] rounded transition-colors"
              title="Abrir Google Contacts (People API)"
            >
              <UserIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Contactos</span>
            </button>
          )}
        </nav>

        {/* Zone 3: Primary Actions and Hardware Toggles */}
        <div className="flex items-center gap-2">
          {/* Google Workspace Account Pill */}
          {currentUser ? (
            <button
              onClick={onOpenGmail}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono bg-[#0d121c] border border-cyan-500/40 text-cyan-300 hover:border-cyan-400 transition-colors"
              title="Cuenta de Google conectada"
            >
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="" className="w-4 h-4 rounded-full" />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span className="max-w-[100px] truncate">{currentUser.email?.split('@')[0]}</span>
            </button>
          ) : (
            <button
              onClick={onSignInGoogle}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono bg-white text-gray-900 hover:bg-gray-100 font-bold transition-all shadow-sm"
              title="Conectar Google Workspace (Gmail & Drive)"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>Google</span>
            </button>
          )}
          {/* Offline Mode Switch */}
          <button
            onClick={onToggleOffline}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
              isOffline
                ? 'bg-[#ff2a5f]/20 border-[#ff2a5f] text-[#ff2a5f] shadow-[0_0_10px_rgba(255,42,95,0.3)]'
                : 'bg-[#0a0d14] border-[#1e2638] text-slate-300 hover:border-[#00f0ff]/40'
            }`}
            title={isOffline ? 'Modo Offline Forzado (RT-Lite Activo)' : 'Conectado a la Red'}
          >
            {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5 text-[#00f0ff]" />}
            <span className="hidden sm:inline">{isOffline ? 'OFFLINE' : 'ONLINE'}</span>
          </button>

          {/* Mute Voice Feedback */}
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
              isMuted
                ? 'bg-[#ff2a5f]/20 border-[#ff2a5f] text-[#ff2a5f]'
                : 'bg-[#0a0d14] border-[#1e2638] text-slate-300 hover:text-[#00f0ff]'
            }`}
            title={isMuted ? 'Voz silenciada' : 'Voz activa (Edge/Gemini/navegador)'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-[#00f0ff]" />}
          </button>

          {/* Single Unified Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-[var(--primary-accent)]/15 border border-[var(--primary-accent)]/60 hover:bg-[var(--primary-accent)]/25 text-[var(--primary-accent)] font-bold transition-all shadow-[0_0_12px_rgba(0,240,255,0.2)] cursor-pointer"
            title="Centro Unificado de Configuración (Modelos, Claves API, Voz, Temas, PWA y Ayuda)"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configuración</span>
          </button>
        </div>
      </div>
    </header>
  );
};
