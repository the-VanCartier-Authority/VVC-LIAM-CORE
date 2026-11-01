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
  CheckCircle2,
  Palette,
  Bell,
  FileText,
  Table,
  Bot
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
    label: '⚡ Telemetría D3 (VAOS)',
    command: 'Abrir telemetría y rendimiento VAOS',
    icon: <Bot className="w-3 h-3 text-[#00FF66]" />,
    category: 'sync',
  },
  {
    label: '❓ Centro de Ayuda & Atajos',
    command: 'Abrir centro de ayuda',
    icon: <Bot className="w-3 h-3 text-amber-400" />,
    category: 'sync',
  },
  {
    label: '🛡️ Vladimir OSINT Recon',
    command: 'Vladimir ejecutar análisis OSINT y reconocimiento táctico',
    icon: <Bot className="w-3 h-3 text-[#8A2BFF]" />,
    category: 'sync',
  },
  {
    label: '🤖 Matriz de Agentes',
    command: 'Abrir matriz de agentes especializados',
    icon: <Bot className="w-3 h-3 text-[#D4AF37]" />,
    category: 'sync',
  },
  {
    label: '📅 Resolver Conflictos',
    command: 'Comprobar y resolver conflictos en el calendario',
    icon: <Calendar className="w-3 h-3 text-[#00f0ff]" />,
    category: 'calendar',
  },
  {
    label: '📄 Generar Documento PDF',
    command: 'Generar documento de texto sobre Informe de Operaciones y exportar a PDF',
    icon: <FileText className="w-3 h-3 text-emerald-400" />,
    category: 'sync',
  },
  {
    label: '📊 Hoja de Cálculo Presupuesto',
    command: 'Crear hoja de cálculo de Presupuesto y Recursos',
    icon: <Table className="w-3 h-3 text-amber-400" />,
    category: 'sync',
  },
  {
    label: '🍏 Sync Apple Calendar',
    command: 'Sincronizar con Apple Calendar y exportar iCal',
    icon: <Calendar className="w-3 h-3 text-purple-400" />,
    category: 'calendar',
  },
  {
    label: '📧 Sync Outlook Calendar',
    command: 'Sincronizar con Outlook Calendar',
    icon: <Calendar className="w-3 h-3 text-blue-400" />,
    category: 'calendar',
  },
  {
    label: '🎨 Amber Terminal',
    command: 'Cambiar tema a Amber Terminal',
    icon: <Palette className="w-3 h-3 text-amber-400" />,
    category: 'device',
  },
  {
    label: '🟢 Emerald Matrix',
    command: 'Cambiar tema a Emerald Matrix',
    icon: <Palette className="w-3 h-3 text-emerald-400" />,
    category: 'device',
  },
  {
    label: '💠 Obsidian Cyan',
    command: 'Cambiar tema a Obsidian Cyan',
    icon: <Palette className="w-3 h-3 text-cyan-400" />,
    category: 'device',
  },
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
    label: '👥 Google Contacts',
    command: 'Abrir contactos',
    icon: <Bot className="w-3 h-3 text-amber-400" />,
    category: 'sync',
  },
  {
    label: '📝 Google Docs Cloud',
    command: 'Abrir Google Docs',
    icon: <FileText className="w-3 h-3 text-emerald-400" />,
    category: 'sync',
  },
  {
    label: '🔥 Firebase Firestore',
    command: 'Verificar sincronización con Firebase',
    icon: <Share2 className="w-3 h-3 text-orange-400" />,
    category: 'sync',
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
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-accent)] shadow-[0_0_6px_var(--accent-glow)]" />
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-accent)]/50 hover:bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs font-mono whitespace-nowrap transition-all hover:scale-102 hover:shadow-[0_0_10px_var(--accent-glow)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
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
