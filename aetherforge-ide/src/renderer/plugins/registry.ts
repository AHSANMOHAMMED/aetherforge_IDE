import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PluginRecord, RegisteredCommand, RegisteredView } from './types';

type PersistedPlugin = { id: string; enabled: boolean };

interface PluginRegistryState {
  plugins: PluginRecord[];
  commands: RegisteredCommand[];
  views: RegisteredView[];

  // Plugin lifecycle
  addPlugin: (record: PluginRecord) => void;
  setPluginStatus: (id: string, status: PluginRecord['status'], error?: string) => void;
  setPluginEnabled: (id: string, enabled: boolean) => void;
  removePlugin: (id: string) => void;
  isEnabled: (id: string) => boolean;

  // Contribution registration
  registerCommand: (cmd: RegisteredCommand) => void;
  registerView: (view: RegisteredView) => void;
  unregisterPlugin: (pluginId: string) => void;
}

interface PersistedState {
  _pluginPrefs: PersistedPlugin[];
}

// We only persist the enabled/disabled preference per plugin id
export const usePluginRegistry = create<PluginRegistryState & PersistedState>()(
  persist(
    (set, get) => ({
      plugins: [],
      commands: [],
      views: [],
      _pluginPrefs: [],

      addPlugin: (record) => {
        const prefs = get()._pluginPrefs;
        const pref = prefs.find((p) => p.id === record.manifest.id);
        const enabled = pref !== undefined ? pref.enabled : record.enabled;
        set((state) => ({
          plugins: [
            ...state.plugins.filter((p) => p.manifest.id !== record.manifest.id),
            { ...record, enabled }
          ]
        }));
      },

      setPluginStatus: (id, status, error) => {
        set((state) => ({
          plugins: state.plugins.map((p) => (p.manifest.id === id ? { ...p, status, error } : p))
        }));
      },

      setPluginEnabled: (id, enabled) => {
        set((state) => ({
          plugins: state.plugins.map((p) => (p.manifest.id === id ? { ...p, enabled } : p)),
          _pluginPrefs: [...state._pluginPrefs.filter((p) => p.id !== id), { id, enabled }]
        }));
      },

      removePlugin: (id) => {
        set((state) => ({
          plugins: state.plugins.filter((p) => p.manifest.id !== id),
          commands: state.commands.filter((c) => c.pluginId !== id),
          views: state.views.filter((v) => v.pluginId !== id),
          _pluginPrefs: state._pluginPrefs.filter((p) => p.id !== id)
        }));
      },

      isEnabled: (id) => {
        const plugin = get().plugins.find((p) => p.manifest.id === id);
        return plugin?.enabled ?? true;
      },

      registerCommand: (cmd) => {
        set((state) => ({
          commands: [...state.commands.filter((c) => !(c.id === cmd.id && c.pluginId === cmd.pluginId)), cmd]
        }));
      },

      registerView: (view) => {
        set((state) => ({
          views: [...state.views.filter((v) => !(v.id === view.id && v.pluginId === view.pluginId)), view]
        }));
      },

      unregisterPlugin: (pluginId) => {
        set((state) => ({
          commands: state.commands.filter((c) => c.pluginId !== pluginId),
          views: state.views.filter((v) => v.pluginId !== pluginId)
        }));
      }
    }),
    {
      name: 'aetherforge-plugin-registry',
      partialize: (state) => ({ _pluginPrefs: state._pluginPrefs })
    }
  )
);
