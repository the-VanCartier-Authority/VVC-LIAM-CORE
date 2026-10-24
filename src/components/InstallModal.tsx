import React, { useState } from 'react';
import { 
  Download, 
  Smartphone, 
  X, 
  Check, 
  Copy, 
  ExternalLink, 
  ShieldCheck, 
  Terminal, 
  Layers, 
  ArrowRight 
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isAndroid, isIOS, install } = usePWAInstall();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [activeTab, setActiveTab] = useState<'pwa' | 'apk' | 'ios'>('pwa');

  if (!isOpen) return null;

  const handleCopyManifest = async () => {
    try {
      const res = await fetch('/manifest.json');
      const data = await res.json();
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedManifest(true);
      setTimeout(() => setCopiedManifest(false), 2500);
    } catch {
      // Fallback
    }
  };

  const capacitorCommands = `# 1. Instalar Capacitor para Android / Desktop en el proyecto
npm install @capacitor/core @capacitor/android
npx cap init "VVC LIAM CORE" com.vvcliam.core --web-dir dist

# 2. Compilar y sincronizar assets web
npm run build
npx cap add android
npx cap sync

# 3. Abrir el proyecto Android (no genera binarios de escritorio)
npx cap open android
# En Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)`;

  const handleCopy = () => {
    navigator.clipboard.writeText(capacitorCommands);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleTriggerInstall = async () => {
    const success = await install();
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-[#080b12] border border-[#1e2638] rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2638]">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[#00f0ff]" />
            <h3 className="font-mono text-sm sm:text-base font-bold text-white tracking-wider">
              Instalación PWA & guía de empaquetado
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#121622] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 my-3 p-1 bg-[#0d121f] rounded-lg border border-[#1e2638]">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-medium transition-all ${
              activeTab === 'pwa'
                ? 'bg-[#00f0ff] text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            1. Instalación Directa (PWA / WebAPK)
          </button>

          <button
            onClick={() => setActiveTab('apk')}
            className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-medium transition-all ${
              activeTab === 'apk'
                ? 'bg-[#b026ff] text-white shadow-[0_0_10px_rgba(176,38,255,0.4)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            2. Guía Android (sin APK incluido)
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-1.5 px-3 rounded text-xs font-mono font-medium transition-all ${
              activeTab === 'ios'
                ? 'bg-[#ff2a5f] text-white shadow-[0_0_10px_rgba(255,42,95,0.4)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            3. iPhone / iPad
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 font-mono text-xs">
          {/* TAB 1: PWA DIRECTA (WEBAPK) */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Instalación Automática WebAPK en Android
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    RECOMENDADO
                  </span>
                </div>

                <p className="text-slate-300 leading-relaxed text-xs">
                  Chrome o Edge pueden ofrecer la instalación de esta <strong>PWA</strong>. El formato y la disponibilidad dependen del navegador; este repositorio no incluye un APK o binario nativo verificado.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-400">
                  <div className="p-2.5 rounded bg-[#07090e] border border-[#1e2638]">
                    <span className="text-[#00f0ff] font-bold block mb-0.5">Icono PWA</span>
                    El navegador puede añadir el acceso a la pantalla de inicio.
                  </div>
                  <div className="p-2.5 rounded bg-[#07090e] border border-[#1e2638]">
                    <span className="text-[#b026ff] font-bold block mb-0.5">Pantalla Completa</span>
                    Modo standalone sin barra de URL ni marcos de navegador.
                  </div>
                  <div className="p-2.5 rounded bg-[#07090e] border border-[#1e2638]">
                    <span className="text-emerald-400 font-bold block mb-0.5">Offline parcial</span>
                    Funciones locales con caché; voz y arranque en frío sin garantía.
                  </div>
                </div>

                {/* Install Button Trigger */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  {isInstalled ? (
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <Check className="w-4 h-4" />
                      <span>¡VVC LIAM CORE ya está instalada en tu dispositivo!</span>
                    </div>
                  ) : isInstallable ? (
                    <button
                      onClick={handleTriggerInstall}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#00f0ff] hover:bg-[#00d0df] text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                    >
                      <Download className="w-4 h-4" />
                      <span>Instalar en el Celular Ahora</span>
                    </button>
                  ) : (
                    <div className="text-slate-400 text-xs">
                      En tu celular Android: Abre el menú de Chrome (los 3 puntos ⋮) y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong>.
                    </div>
                  )}

                  <span className="text-[10px] text-slate-500">
                    URL: {window.location.origin}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMPILAR APK BINARIO NATIVO (.APK) */}
          {activeTab === 'apk' && (
            <div className="space-y-4">
              <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-xs flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-[#b026ff]" />
                    Generar archivo binario APK (.apk) instalable
                  </span>
                  <span className="text-[10px] text-[#b026ff] bg-[#b026ff]/10 px-2 py-0.5 rounded border border-[#b026ff]/30">
                    ANDROID STUDIO / CAPACITOR
                  </span>
                </div>

                <p className="text-slate-300 leading-relaxed text-xs">
                  Si requieres un archivo binario <code>.apk</code> para distribuirlo manualmente o publicarlo en Google Play Store, puedes empaquetarlo con <strong>Capacitor</strong> o con <strong>PWABuilder</strong> (herramienta oficial de Microsoft):
                </p>

                {/* Option A: Direct WebAPK Install vs PWABuilder */}
                <div className="p-3.5 rounded-xl bg-[#07090e] border border-[#1e2638] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#00FF66] animate-pulse"></span>
                      Opción A: Instalación Directa (Sin PWABuilder ni pasos complejos)
                    </span>
                    <span className="text-[10px] text-[#00FF66] bg-[#00FF66]/10 px-2 py-0.5 rounded border border-[#00FF66]/30 font-bold">
                      RECOMENDADO
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    No necesitas usar herramientas externas como PWABuilder. Puedes instalar la aplicación directamente en cualquier teléfono:
                  </p>
                  <div className="p-2.5 rounded bg-[#101524] border border-[#1e2638] space-y-1.5 text-[11px] text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="text-[#00FF66] font-bold">1.</span>
                      <span>Abre la app en <strong>Google Chrome</strong> en tu celular Android.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#00FF66] font-bold">2.</span>
                      <span>Toca los <strong>tres puntos ⋮</strong> de Chrome (arriba a la derecha).</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#00FF66] font-bold">3.</span>
                      <span>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong>.</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    El navegador puede instalar la PWA con el icono oficial y modo standalone; no equivale a una aplicación nativa verificada.
                  </p>
                </div>

                {/* Option B: PWABuilder Manifest Helper */}
                <div className="p-3.5 rounded-xl bg-[#07090e] border border-[#1e2638] space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-bold text-white text-xs">
                      ¿Por qué PWABuilder pide tantos campos?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyManifest}
                        className="text-[#00FF66] hover:bg-[#00FF66]/10 px-2 py-1 rounded border border-[#00FF66]/30 flex items-center gap-1 text-[11px] font-bold transition-all"
                      >
                        {copiedManifest ? <Check className="w-3 h-3 text-[#00FF66]" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedManifest ? '¡JSON Copiado!' : 'Copiar JSON Listo (27 campos)'}</span>
                      </button>
                      <a
                        href="/manifest.json"
                        download="manifest.json"
                        className="text-[#00f0ff] hover:bg-[#00f0ff]/10 px-2 py-1 rounded border border-[#00f0ff]/30 flex items-center gap-1 text-[11px] font-bold transition-all"
                      >
                        <span>Descargar</span>
                        <Download className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    PWABuilder te muestra esa pantalla porque el robot de Microsoft no puede saltar la verificación de seguridad de Google Cloud Run (<code>cookie_check</code>) y agota su tiempo de espera.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>No necesitas llenar nada manualmente:</strong> Pulsa <strong>"Copiar JSON Listo"</strong> y pégalo directamente en PWABuilder (en <em>"Edit Your Manifest"</em>), o aún más fácil: <strong>usa la Opción A para instalar la app directamente desde Chrome en tu celular sin usar PWABuilder</strong>.
                  </p>
                </div>

                {/* Option B: Capacitor CLI */}
                <div className="p-3 rounded bg-[#07090e] border border-[#1e2638] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">Opción B: Compilación con Capacitor CLI</span>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-[#131929] hover:bg-[#1c2438] text-slate-300 text-[11px]"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode ? 'Copiado' : 'Copiar Comandos'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-[#050608] rounded border border-[#1e2638] text-slate-300 text-[10px] overflow-x-auto">
                    {capacitorCommands}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: IOS SAFARI */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-3">
                <span className="text-white font-bold text-xs flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-[#ff2a5f]" />
                  Instalación en iPhone / iPad (iOS Safari)
                </span>

                <p className="text-slate-300 leading-relaxed text-xs">
                  En iOS, Apple no admite la instalación de archivos <code>.apk</code> (los cuales son exclusivos de Android), pero sí permite instalar esta app de forma idéntica a una app de la App Store:
                </p>

                <div className="p-3 rounded bg-[#07090e] border border-[#1e2638] space-y-2 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#1e2638] flex items-center justify-center font-bold text-white text-[10px] shrink-0">1</span>
                    <span>Abre este enlace en el navegador <strong>Safari</strong> de tu iPhone o iPad.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#1e2638] flex items-center justify-center font-bold text-white text-[10px] shrink-0">2</span>
                    <span>Toca el botón <strong>Compartir</strong> (icono de cuadrado con una flecha hacia arriba) en la barra inferior.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#1e2638] flex items-center justify-center font-bold text-white text-[10px] shrink-0">3</span>
                    <span>Desplázate hacia abajo y selecciona <strong>"Añadir a la pantalla de inicio"</strong>.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
