import type { ReactElement } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore } from '@/renderer/state/toast-store';

function toneClasses(level: 'success' | 'error' | 'info'): string {
  if (level === 'success') {
    return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
  }
  if (level === 'error') {
    return 'border-red-400/35 bg-red-500/15 text-red-100';
  }
  return 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100';
}

function toneIcon(level: 'success' | 'error' | 'info'): ReactElement {
  if (level === 'success') {
    return <CheckCircle2 className="h-4 w-4" />;
  }
  if (level === 'error') {
    return <AlertTriangle className="h-4 w-4" />;
  }
  return <Info className="h-4 w-4" />;
}

export function ToastViewport(): ReactElement | null {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-[70] flex w-[360px] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-lg border px-3 py-2 shadow-xl backdrop-blur ${toneClasses(toast.level)}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5">{toneIcon(toast.level)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description ? <p className="mt-0.5 text-xs opacity-90">{toast.description}</p> : null}
            </div>
            <button
              type="button"
              title="Dismiss"
              aria-label="Dismiss"
              className="rounded p-1 hover:bg-white/10"
              onClick={() => dismissToast(toast.id)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
