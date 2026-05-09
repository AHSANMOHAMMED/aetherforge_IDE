import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemeVariant = 'light' | 'dark' | 'midnight' | 'hc-dark' | 'system';
export type ThemeResolved = Exclude<ThemeVariant, 'system'>;
export type EditorTheme = 'aetherforge-dark' | 'aetherforge-light' | 'vs-dark' | 'vs' | 'hc-black';

export type AISettingsState = {
  airGap: boolean;
  costGuardUsd: number; // hard stop above this per-run
};

export type PluginExecutionHost = 'worker' | 'utility';

interface SettingsState {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  autoSaveIntervalMs: number;
  autoSaveEnabled: boolean;
  formatOnSave: boolean;
  trimTrailingWhitespace: boolean;
  insertFinalNewline: boolean;
  theme: ThemeVariant;
  editorTheme: EditorTheme;
  ai: AISettingsState;
  telemetryEnabled: boolean;
  showMinimap: boolean;
  showLineNumbers: boolean;
  reducedMotion: boolean;
  /** `worker`: full PluginAPI via Comlink in renderer worker. `utility`: isolated process with stub API (experimental). */
  pluginExecutionHost: PluginExecutionHost;

  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setTabSize: (size: number) => void;
  setWordWrap: (wrap: boolean) => void;
  setAutoSaveIntervalMs: (ms: number) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setFormatOnSave: (v: boolean) => void;
  setTrimTrailingWhitespace: (v: boolean) => void;
  setInsertFinalNewline: (v: boolean) => void;
  setTheme: (theme: ThemeVariant) => void;
  setEditorTheme: (theme: EditorTheme) => void;
  setAi: (patch: Partial<AISettingsState>) => void;
  setTelemetryEnabled: (v: boolean) => void;
  setShowMinimap: (v: boolean) => void;
  setShowLineNumbers: (v: boolean) => void;
  setPluginExecutionHost: (host: PluginExecutionHost) => void;
  resetDefaults: () => void;
}

const DEFAULTS: Omit<
  SettingsState,
  | 'setFontSize'
  | 'setFontFamily'
  | 'setTabSize'
  | 'setWordWrap'
  | 'setAutoSaveIntervalMs'
  | 'setAutoSaveEnabled'
  | 'setFormatOnSave'
  | 'setTrimTrailingWhitespace'
  | 'setInsertFinalNewline'
  | 'setTheme'
  | 'setEditorTheme'
  | 'setAi'
  | 'setTelemetryEnabled'
  | 'setShowMinimap'
  | 'setShowLineNumbers'
  | 'setPluginExecutionHost'
  | 'resetDefaults'
> = {
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
  tabSize: 2,
  wordWrap: false,
  autoSaveIntervalMs: 30_000,
  autoSaveEnabled: true,
  formatOnSave: true,
  trimTrailingWhitespace: true,
  insertFinalNewline: true,
  theme: 'dark',
  editorTheme: 'aetherforge-dark',
  ai: {
    airGap: false,
    costGuardUsd: 1.0
  },
  telemetryEnabled: false,
  showMinimap: true,
  showLineNumbers: true,
  reducedMotion: false,
  pluginExecutionHost: 'worker'
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setFontSize: (size) => set({ fontSize: size }),
      setFontFamily: (family) => set({ fontFamily: family }),
      setTabSize: (size) => set({ tabSize: size }),
      setWordWrap: (wrap) => set({ wordWrap: wrap }),
      setAutoSaveIntervalMs: (ms) => set({ autoSaveIntervalMs: ms }),
      setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
      setFormatOnSave: (v) => set({ formatOnSave: v }),
      setTrimTrailingWhitespace: (v) => set({ trimTrailingWhitespace: v }),
      setInsertFinalNewline: (v) => set({ insertFinalNewline: v }),
      setTheme: (theme) => set({ theme }),
      setEditorTheme: (theme) => set({ editorTheme: theme }),
      setAi: (patch) => set((state) => ({ ai: { ...state.ai, ...patch } })),
      setTelemetryEnabled: (v) => set({ telemetryEnabled: v }),
      setShowMinimap: (v) => set({ showMinimap: v }),
      setShowLineNumbers: (v) => set({ showLineNumbers: v }),
      setPluginExecutionHost: (pluginExecutionHost) => set({ pluginExecutionHost }),
      resetDefaults: () => set({ ...DEFAULTS })
    }),
    {
      name: 'aetherforge-settings',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      migrate: (persisted: unknown, fromVersion: number) => {
        const state = (persisted ?? {}) as Partial<SettingsState>;
        if (fromVersion < 2) {
          // V1→V2: theme variants normalize, add new defaults
          const themeMap: Record<string, ThemeVariant> = {
            dark: 'dark',
            darker: 'midnight',
            light: 'light',
            system: 'system'
          };
          state.theme = themeMap[String(state.theme)] ?? 'dark';
        }
        if (fromVersion < 3) {
          state.pluginExecutionHost = state.pluginExecutionHost ?? 'worker';
        }
        return { ...DEFAULTS, ...state };
      }
    }
  )
);

export function resolveTheme(theme: ThemeVariant): ThemeResolved {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Apply theme tokens to <html data-theme="..."> and listen for `system`
 * changes. Should be called once at app boot from `main.tsx`.
 */
export function bindThemeToDocument(): () => void {
  const apply = () => {
    const theme = useSettingsStore.getState().theme;
    document.documentElement.dataset.theme = resolveTheme(theme);
  };
  apply();
  const unsub = useSettingsStore.subscribe(apply);
  const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: light)') : null;
  const onMq = () => apply();
  mq?.addEventListener('change', onMq);
  return () => {
    unsub();
    mq?.removeEventListener('change', onMq);
  };
}
