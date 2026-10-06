import React from 'react';
import { 
  PhoneCall, 
  MessageSquare, 
  Flashlight, 
  Timer, 
  CheckSquare, 
  Sun, 
  ShieldCheck,
  Calendar,
  Share2,
  Clock,
  CheckCircle2
} from 'lucide-react';

interface QuickCommandChipsProps {
  onExecuteCommand: (commandText: string) => void;
  disabled?: boolean;
}

interface ChipItem {
  label: string;
  command: string;
  icon: React.ReactNode;
  category: 'task' | 'calendar' | 'phone' | 'device' | 'sync';
}

const CHIPS: ChipItem[] = [
  {
    label: '✉️ Abrir Gmail',
    command: 'Abrir Gmail',
    icon: <Calendar className="w-3 h-3 text-red-400" />,
    category: 'sync',
  },
  {
    label: '📁 Google Picker',
    command: 'Abrir Google Picker para seleccionar archivo',
    icon: <Share2 className="w-3 h-3 text-blue-400" />,
    category: 'sync',
  },
  {
    label: '🗺️ Google Maps',
    command: 'Abrir Google Maps',
    icon: <CheckSquare className="w-3 h-3 text-cyan-400" />,
    category: 'device',
  },
  {
    label: 'Nueva Tarea Urgente',
    command: 'Crear tarea urgente revisar presupuesto para mañana a las 10:00',
    icon: <CheckSquare className="w-3 h-3 text-[#ff2a5f]" />,
    category: 'task',
  },
  {
    label: 'Completar Tarea',
    command: 'Completar tarea telemetría NVIDIA',
    icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
    category: 'task',
  },
  {
    label: 'Posponer Recordatorio',
    command: 'Posponer recordatorio claves 10 minutos',
    icon: <Clock className="w-3 h-3 text-amber-400" />,
    category: 'task',
  },
  {
    label: 'Exportar a iCal (.ics)',
    command: 'Exportar agenda a iCal para Google Calendar',
    icon: <Calendar className="w-3 h-3 text-[#00f0ff]" />,
    category: 'calendar',
  },
  {
    label: 'Sync Google & Notion',
    command: 'Sincronizar calendario con Google Calendar y Notion',
    icon: <Share2 className="w-3 h-3 text-[#b026ff]" />,
    category: 'sync',
  },
  {
    label: 'Llamar a Carlos',
    command: 'Llamar a Carlos Méndez',
    icon: <PhoneCall className="w-3 h-3 text-[#00f0ff]" />,
    category: 'phone',
  },
  {
    label: 'WhatsApp a María',
    command: 'WhatsApp a María: Llego en 15 minutos con los reportes de la reunión',
    icon: <MessageSquare className="w-3 h-3 text-emerald-400" />,
    category: 'phone',
  },
  {
    label: 'Linterna',
    command: 'Encender linterna',
    icon: <Flashlight className="w-3 h-3 text-amber-400" />,
    category: 'device',
  },
  {
    label: 'Temporizador 3m',
    command: 'Temporizador de 3 minutos',
    icon: <Timer className="w-3 h-3 text-[#b026ff]" />,
    category: 'device',
  },
];

export const QuickCommandChips: React.FC<QuickCommandChipsProps> = ({
  onExecuteCommand,
  disabled = false,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff]" />
          Comandos Vocales de Tareas, Calendario & Teléfono
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          Haz clic o habla al micrófono
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CHIPS.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => onExecuteCommand(chip.command)}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0a0d14] border border-[#1e2638] hover:border-[#00f0ff]/50 hover:bg-[#0f141f] text-slate-200 text-xs font-mono whitespace-nowrap transition-all hover:scale-102 hover:shadow-[0_0_10px_rgba(0,240,255,0.2)] disabled:opacity-50 disabled:pointer-events-none"
            title={`Ejecutar: "${chip.command}"`}
          >
            {chip.icon}
            <span>{chip.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
