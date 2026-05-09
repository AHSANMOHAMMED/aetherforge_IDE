import { create } from 'zustand';

export type ActivityKind = 'file' | 'git' | 'ai' | 'terminal' | 'plugin' | 'build' | 'system';
export type ActivitySeverity = 'info' | 'success' | 'warning' | 'error';

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  severity: ActivitySeverity;
  message: string;
  detail?: string;
  timestamp: number;
};

const MAX = 200;

interface ActivityState {
  entries: ActivityEntry[];
  push: (entry: Omit<ActivityEntry, 'id' | 'timestamp'>) => void;
  clear: () => void;
}

let counter = 0;

export const useActivityStore = create<ActivityState>((set) => ({
  entries: [],
  push: (entry) =>
    set((state) => ({
      entries: [
        { id: `act-${Date.now()}-${counter++}`, timestamp: Date.now(), ...entry },
        ...state.entries
      ].slice(0, MAX)
    })),
  clear: () => set({ entries: [] })
}));

export function logActivity(
  kind: ActivityKind,
  message: string,
  options?: { severity?: ActivitySeverity; detail?: string }
): void {
  useActivityStore.getState().push({
    kind,
    severity: options?.severity ?? 'info',
    message,
    detail: options?.detail
  });
  void import('@/renderer/telemetry/telemetry-client').then((m) =>
    m.maybeForwardActivityToTelemetry(kind, message, options)
  );
}
