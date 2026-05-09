import { create } from 'zustand';

export type ToastLevel = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  level: ToastLevel;
  durationMs: number;
};

type ToastStore = {
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, 'id' | 'durationMs'> & { durationMs?: number }) => void;
  dismissToast: (id: string) => void;
};

function nextToastId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  pushToast: (toast) => {
    const id = nextToastId();
    const toastItem: ToastItem = {
      id,
      ...toast,
      durationMs: toast.durationMs ?? 2600
    };

    set((state) => ({ toasts: [...state.toasts, toastItem] }));

    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
    }, toastItem.durationMs);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }))
}));
