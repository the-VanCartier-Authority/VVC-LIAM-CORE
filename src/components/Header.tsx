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
  Palette
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

interface HeaderProps {
  currentModel: ModelType;
  onSelectModel: (model: ModelType) => void;
  currentCloudIntegration: CloudServiceIntegrationType;
  onSelectCloudIntegration: (ci: CloudServiceIntegrationType) => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  onOpenSettings: () => void;
  onOpenCalendar: () => void;
  onOpenVault: () => void;
  onOpenDeviceControls: () => void;
  onOpenGmail: () => void;
  onOpenPicker: () => void;
  onOpenMaps: () => void;
  currentUser: User | null;
  onSignInGoogle: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  pendingTasksCount: number;
  onOpenInstallModal: () => void;
  currentTheme: ThemeColorId;
  onSelectTheme: (theme: ThemeColorId) => void;
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
  onOpenVault,
  onOpenDeviceControls,
  onOpenGmail,
  onOpenPicker,
  onOpenMaps,
  currentUser,
  onSignInGoogle,
  isMuted,
  onToggleMute,
  pendingTasksCount,
  onOpenInstallModal,
  currentTheme,
  onSelectTheme,
}) => {
  const currentModelInfo = AVAILABLE_MODELS.find((m) => m.id === currentModel) || AVAILABLE_MODELS[0];
  const currentCloudInfo = CLOUD_INTEGRATIONS.find((c) => c.id === currentCloudIntegration) || CLOUD_INTEGRATIONS[0];
  const currentThemeInfo = THEME_SCHEMES.find((t) => t.id === currentTheme) || THEME_SCHEMES[0];

  return (
    <header className="w-full bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Wordmark Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex items-center justify-center w-8 h-8 rounded bg-[var(--bg-card)] border border-[var(--primary-accent)]/40 shadow-[0_0_12px_var(--accent-glow)]">
            <span className="text-[var(--primary-accent)] font-bold text-xs font-mono tracking-widest">VC</span>
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--primary-accent)] animate-ping" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-base font-bold tracking-wider text-[var(--text-primary)] font-mono flex items-center gap-2">
              VVC-ACIA
              <span className="text-[10px] uppercase tracking-widest text-[var(--primary-accent)] bg-[var(--tag-bg)] px-1.5 py-0.5 rounded border border-[var(--primary-accent)]/30 hidden sm:inline-block">
                OS·{currentThemeInfo.name.split(' ')[0]}
              </span>
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation & Quick Hub Links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          {/* Model Selector Dropdown in Nav */}
          <div className="relative group">
            <button
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono rounded bg-[#0a0d14] border border-[#1e2638] hover:border-[#b026ff]/50 text-slate-200 transition-colors"
              title="Alternar entre modelos NVIDIA Build y RT-Lite On-Device"
            >
              <Cpu className="w-3.5 h-3.5 text-[#b026ff]" />
              <span className="truncate max-w-[120px] lg:max-w-[180px]">
                {currentModelInfo.name}
              </span>
              <span className="text-[9px] text-[#00f0ff] font-mono border border-[#00f0ff]/30 px-1 rounded">
                {currentModel === 'rt-lite-local' ? 'OFFLINE' : 'NVIDIA'}
              </span>
            </button>

            {/* Quick dropdown hover menu */}
            <div className="absolute left-0 mt-1 w-72 bg-[#090c14] border border-[#1e2638] rounded-md shadow-2xl p-2 hidden group-hover:block z-50">
              <div className="text-[10px] text-slate-400 font-mono uppercase px-2 py-1 border-b border-[#1e2638] mb-1">
                Seleccionar Motor Neuronal
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {AVAILABLE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onSelectModel(m.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono transition-all flex flex-col ${
                      currentModel === m.id
                        ? 'bg-[#b026ff]/20 text-[#00f0ff] border border-[#b026ff]/40'
                        : 'text-slate-300 hover:bg-[#121724] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate">{m.name}</span>
                      <span className="text-[9px] text-slate-400 opacity-80">{m.category}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 truncate">{m.bestFor}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cloud Service Integration Indicator Button */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded bg-[#0a0d14] border border-[#1e2638] hover:border-[#00f0ff]/40 text-slate-300 transition-colors"
            title={`Integración Cloud: ${currentCloudInfo.name}`}
          >
            <Cloud className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span className="truncate max-w-[110px] lg:max-w-[150px]">
              {currentCloudInfo.provider}
            </span>
          </button>

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

          {/* E2EE Encrypted Vault Link */}
          <button
            onClick={onOpenVault}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-[#00f0ff] hover:bg-[#0f141f] rounded transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-[#ff2a5f]" />
            <span>Bóveda E2EE</span>
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
          {/* Install App / APK Button */}
          <button
            onClick={onOpenInstallModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono bg-[#00f0ff]/15 border border-[#00f0ff]/50 hover:bg-[#00f0ff]/25 text-[#00f0ff] font-bold transition-all shadow-[0_0_10px_rgba(0,240,255,0.25)]"
            title="Instalar como App en Android / Generar APK"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Instalar App / APK</span>
          </button>

          {/* Offline Mode Switch */}
          <button
            onClick={onToggleOffline}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono border transition-all ${
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
            className={`p-2 rounded text-xs font-mono border transition-all ${
              isMuted
                ? 'bg-[#ff2a5f]/20 border-[#ff2a5f] text-[#ff2a5f]'
                : 'bg-[#0a0d14] border-[#1e2638] text-slate-300 hover:text-[#00f0ff]'
            }`}
            title={isMuted ? 'Voz silenciada' : 'Voz activa (Kokoro)'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-[#00f0ff]" />}
          </button>

          {/* Quick Theme Selector Dropdown */}
          <div className="relative group">
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-accent)]/60 text-[var(--text-primary)] transition-all shadow-sm cursor-pointer"
              title="Cambiar esquema de color de la interfaz (Variables CSS)"
            >
              <Palette className="w-3.5 h-3.5 text-[var(--primary-accent)]" />
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0 shadow-sm"
                style={{ backgroundColor: currentThemeInfo.primaryColor }}
              />
              <span className="hidden xl:inline truncate max-w-[90px] font-semibold">
                {currentThemeInfo.name.split(' ')[0]}
              </span>
            </button>

            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-1 w-64 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-2 hidden group-hover:block group-focus-within:block z-50 animate-fade-in">
              <div className="text-[10px] text-[var(--text-secondary)] font-mono uppercase px-2 py-1 border-b border-[var(--border-subtle)] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Palette className="w-3 h-3 text-[var(--primary-accent)]" />
                  <span>Esquema de Color CSS</span>
                </span>
                <span className="text-[9px] text-[var(--primary-accent)] font-bold">6 TEMAS</span>
              </div>
              <div className="space-y-1">
                {THEME_SCHEMES.map((scheme) => {
                  const isSelected = currentTheme === scheme.id;
                  return (
                    <button
                      key={scheme.id}
                      type="button"
                      onClick={() => onSelectTheme(scheme.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--tag-bg)] text-[var(--primary-accent)] border border-[var(--primary-accent)]/40 shadow-sm'
                          : 'text-slate-300 hover:bg-[var(--bg-card)] hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-3 h-3 rounded-full border border-white/20 shrink-0 shadow-sm"
                          style={{ backgroundColor: scheme.primaryColor }}
                        />
                        <div className="flex flex-col truncate">
                          <span className="font-semibold truncate text-[11px]">{scheme.name}</span>
                          <span className="text-[9px] text-slate-400 truncate opacity-80">{scheme.tagline}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] text-[var(--primary-accent)] font-bold ml-1.5 shrink-0">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-accent)] text-slate-100 hover:text-[var(--primary-accent)] transition-all shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-[var(--primary-accent)]" />
            <span className="hidden sm:inline">Configuración</span>
          </button>
        </div>
      </div>
    </header>
  );
};
