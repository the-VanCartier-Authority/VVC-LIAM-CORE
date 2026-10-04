import React from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  X, 
  Volume2, 
  Calendar,
  AlertTriangle 
} from 'lucide-react';
import type { ActiveNotificationAlert } from '../types';

interface RealTimeAlertToastProps {
  alerts: ActiveNotificationAlert[];
  onComplete: (taskId: string) => void;
  onSnooze: (taskId: string, minutes: number) => void;
  onDismiss: (alertId: string) => void;
  onOpenCalendar: () => void;
}

export const RealTimeAlertToast: React.FC<RealTimeAlertToastProps> = ({
  alerts,
  onComplete,
  onSnooze,
  onDismiss,
  onOpenCalendar,
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`pointer-events-auto p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all animate-bounce-short ${
            alert.priority === 'critica'
              ? 'bg-[#0f070b]/95 border-[#ff2a5f] shadow-[0_0_30px_rgba(255,42,95,0.4)]'
              : alert.priority === 'alta'
              ? 'bg-[#0f0d07]/95 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.3)]'
              : 'bg-[#070b14]/95 border-[#00f0ff] shadow-[0_0_25px_rgba(0,240,255,0.3)]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-lg ${
                  alert.priority === 'critica'
                    ? 'bg-[#ff2a5f]/20 text-[#ff2a5f]'
                    : alert.priority === 'alta'
                    ? 'bg-amber-400/20 text-amber-400'
                    : 'bg-[#00f0ff]/20 text-[#00f0ff]'
                }`}
              >
                <Bell className="w-4 h-4 animate-bounce" />
              </div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Recordatorio en Tiempo Real
              </span>
            </div>

            <button
              onClick={() => onDismiss(alert.id)}
              className="text-slate-400 hover:text-white p-1 transition-colors"
              title="Descartar alerta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title & Metadata */}
          <div className="mb-3">
            <h4 className="text-sm font-mono font-bold text-white leading-snug">
              {alert.title}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-slate-300">
              <span className="flex items-center gap-1 text-[#00f0ff]">
                <Clock className="w-3 h-3" />
                {alert.timeDue}
              </span>
              <span>·</span>
              <span
                className={`uppercase font-semibold ${
                  alert.priority === 'critica'
                    ? 'text-[#ff2a5f]'
                    : alert.priority === 'alta'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                Prioridad {alert.priority}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#1e2638]">
            <button
              onClick={() => {
                onComplete(alert.taskId);
                onDismiss(alert.id);
              }}
              className="flex-1 py-1.5 px-2.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-mono font-semibold flex items-center justify-center gap-1 transition-all shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Hecho</span>
            </button>

            <button
              onClick={() => {
                onSnooze(alert.taskId, 10);
                onDismiss(alert.id);
              }}
              className="py-1.5 px-2.5 rounded bg-[#131929] hover:bg-[#1c2438] text-slate-200 border border-[#1e2638] text-[11px] font-mono transition-colors"
              title="Posponer 10 minutos"
            >
              +10m
            </button>

            <button
              onClick={() => {
                onOpenCalendar();
                onDismiss(alert.id);
              }}
              className="py-1.5 px-2.5 rounded bg-[#131929] hover:bg-[#1c2438] text-[#00f0ff] border border-[#1e2638] text-[11px] font-mono transition-colors"
              title="Ver en Agenda"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
