import React from 'react';
import { 
  X, 
  Sun, 
  Volume2, 
  VolumeX, 
  Wifi, 
  WifiOff, 
  Bluetooth, 
  BatteryCharging, 
  Battery, 
  Flashlight, 
  Phone, 
  MessageSquare, 
  Smartphone,
  ShieldCheck,
  Moon,
  Clock
} from 'lucide-react';
import type { DeviceState, PhoneContact } from '../types';

interface DeviceControlsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  deviceState: DeviceState;
  onUpdateState: (newState: Partial<DeviceState>) => void;
  contacts: PhoneContact[];
  onCallContact: (contact: PhoneContact) => void;
  onMessageContact: (contact: PhoneContact) => void;
  onToggleTorchModal: () => void;
}

export const DeviceControlsDrawer: React.FC<DeviceControlsDrawerProps> = ({
  isOpen,
  onClose,
  deviceState,
  onUpdateState,
  contacts,
  onCallContact,
  onMessageContact,
  onToggleTorchModal,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#07090e] border-l border-[#1e2638] h-full flex flex-col p-5 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2638] mb-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#00f0ff]" />
            <h3 className="font-mono text-sm font-bold text-white tracking-wider">
              Centro de Control del Teléfono
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#121622] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Battery & System Health Quick Glance */}
        <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-3.5 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              {deviceState.isCharging ? (
                <BatteryCharging className="w-5 h-5 animate-pulse" />
              ) : (
                <Battery className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="text-xs font-mono font-semibold text-white flex items-center gap-2">
                <span>{deviceState.batteryLevel}% Carga</span>
                {deviceState.isCharging && (
                  <span className="text-[10px] text-emerald-400">Cargando</span>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Salud óptima · Encriptación de hardware activa
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-mono text-[#00f0ff] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <span className="text-[9px] font-mono text-slate-500">Hora local</span>
          </div>
        </div>

        {/* Quick Toggles Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {/* Wi-Fi Toggle */}
          <button
            onClick={() => onUpdateState({ wifi: !deviceState.wifi })}
            className={`p-3 rounded-lg border flex items-center gap-2.5 transition-all ${
              deviceState.wifi
                ? 'bg-[#00f0ff]/10 border-[#00f0ff]/40 text-[#00f0ff]'
                : 'bg-[#0b0e17] border-[#1e2638] text-slate-400 hover:text-white'
            }`}
          >
            {deviceState.wifi ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <div className="text-left font-mono">
              <div className="text-xs font-semibold">Wi-Fi</div>
              <div className="text-[9px] opacity-75">{deviceState.wifi ? 'Conectado' : 'Apagado'}</div>
            </div>
          </button>

          {/* Bluetooth Toggle */}
          <button
            onClick={() => onUpdateState({ bluetooth: !deviceState.bluetooth })}
            className={`p-3 rounded-lg border flex items-center gap-2.5 transition-all ${
              deviceState.bluetooth
                ? 'bg-[#b026ff]/10 border-[#b026ff]/40 text-[#b026ff]'
                : 'bg-[#0b0e17] border-[#1e2638] text-slate-400 hover:text-white'
            }`}
          >
            <Bluetooth className="w-4 h-4" />
            <div className="text-left font-mono">
              <div className="text-xs font-semibold">Bluetooth</div>
              <div className="text-[9px] opacity-75">{deviceState.bluetooth ? 'Visible (BLE)' : 'Apagado'}</div>
            </div>
          </button>

          {/* Flashlight Screen Torch */}
          <button
            onClick={() => {
              onUpdateState({ flashlight: !deviceState.flashlight });
              onToggleTorchModal();
            }}
            className={`p-3 rounded-lg border flex items-center gap-2.5 transition-all ${
              deviceState.flashlight
                ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                : 'bg-[#0b0e17] border-[#1e2638] text-slate-400 hover:text-white'
            }`}
          >
            <Flashlight className="w-4 h-4 text-amber-400" />
            <div className="text-left font-mono">
              <div className="text-xs font-semibold">Linterna</div>
              <div className="text-[9px] opacity-75">{deviceState.flashlight ? 'Encendida' : 'Apagada'}</div>
            </div>
          </button>

          {/* Do Not Disturb Toggle */}
          <button
            onClick={() => onUpdateState({ dnd: !deviceState.dnd })}
            className={`p-3 rounded-lg border flex items-center gap-2.5 transition-all ${
              deviceState.dnd
                ? 'bg-[#ff2a5f]/10 border-[#ff2a5f]/40 text-[#ff2a5f]'
                : 'bg-[#0b0e17] border-[#1e2638] text-slate-400 hover:text-white'
            }`}
          >
            <Moon className="w-4 h-4" />
            <div className="text-left font-mono">
              <div className="text-xs font-semibold">No Molestar</div>
              <div className="text-[9px] opacity-75">{deviceState.dnd ? 'Activado' : 'Desactivado'}</div>
            </div>
          </button>
        </div>

        {/* Sliders: Brightness & Volume */}
        <div className="bg-[#0b0e17] border border-[#1e2638] rounded-xl p-4 space-y-4 mb-5">
          {/* Brightness */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-yellow-400" />
                Brillo de Pantalla
              </span>
              <span className="text-[#00f0ff] tabular-nums">{deviceState.brightness}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={deviceState.brightness}
              onChange={(e) => onUpdateState({ brightness: parseInt(e.target.value, 10) })}
              className="w-full accent-[#00f0ff] cursor-pointer"
            />
          </div>

          {/* Volume */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                {deviceState.isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-[#ff2a5f]" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-[#b026ff]" />
                )}
                Volumen Multimedia
              </span>
              <span className="text-[#b026ff] tabular-nums">
                {deviceState.isMuted ? 'MUTE (0%)' : `${deviceState.volume}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={deviceState.isMuted ? 0 : deviceState.volume}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdateState({ volume: val, isMuted: val === 0 });
              }}
              className="w-full accent-[#b026ff] cursor-pointer"
            />
          </div>
        </div>

        {/* Phone Contacts Directory (One-Click or Voice) */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#00f0ff]" />
              Contactos Rápidos
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Datos del navegador
            </span>
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-60 pr-1">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="bg-[#0b0e17] border border-[#1e2638] hover:border-[#00f0ff]/40 rounded-lg p-2.5 flex items-center justify-between transition-colors"
              >
                <div>
                  <div className="text-xs font-mono font-semibold text-white">
                    {contact.name}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {contact.phone} {contact.relation ? `· ${contact.relation}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={!contact.phone}
                    onClick={() => onCallContact(contact)}
                    className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-colors"
                    title={`Llamar a ${contact.name}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>

                  <button
                    disabled={!contact.phone}
                    onClick={() => onMessageContact(contact)}
                    className="p-1.5 rounded bg-[#00f0ff]/10 text-[#00f0ff] hover:bg-[#00f0ff] hover:text-black transition-colors"
                    title={`Enviar mensaje a ${contact.name}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Badge in Drawer */}
        <div className="mt-4 pt-3 border-t border-[#1e2638] flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            APIs del navegador; Wi-Fi, Bluetooth y brillo visuales
          </span>
          <span>vvc-os v2.4</span>
        </div>
      </div>
    </div>
  );
};
