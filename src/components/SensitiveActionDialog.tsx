import React, { useEffect, useRef } from 'react';

export function SensitiveActionDialog({ summary, onConfirm, onCancel }: {
  summary: string; onConfirm: () => void; onCancel: () => void;
}) {
  const root = useRef<HTMLDivElement>(null), cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus(); return () => previous?.focus();
  }, []);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85">
    <div ref={root} role="dialog" aria-modal="true" aria-labelledby="sensitive-action-title"
      className="max-w-md w-full rounded-xl border border-amber-500/40 bg-[#080b12] p-5 text-slate-200"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
        if (event.key === 'Tab') {
          const buttons = root.current?.querySelectorAll<HTMLButtonElement>('button');
          if (!buttons?.length) return;
          if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
          else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
        }
      }}>
      <h2 id="sensitive-action-title" className="font-semibold text-amber-300">Confirmar acción sensible</h2>
      <p className="my-3 text-sm">{summary}</p>
      <p className="text-xs text-slate-400">Confirmación de un solo uso, válida durante 60 segundos. Cambiar de cuenta, datos u orden la invalida.</p>
      <div className="mt-4 flex justify-end gap-3">
        <button ref={cancel} className="px-3 py-2 rounded border border-slate-600" onClick={onCancel}>Cancelar</button>
        <button className="px-3 py-2 rounded bg-amber-300 text-black" onClick={onConfirm}>Confirmar</button>
      </div>
    </div>
  </div>;
}
