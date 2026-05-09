import { AccountPanel } from '../auth/AccountPanel';
import { PolicyPanel } from '../components/settings/PolicyPanel';
import { useSettingsStore, type PluginExecutionHost } from '../state/settings-store';

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];
const AUTO_SAVE_OPTIONS = [
  { label: '15 seconds', ms: 15_000 },
  { label: '30 seconds', ms: 30_000 },
  { label: '1 minute', ms: 60_000 },
  { label: '5 minutes', ms: 300_000 }
];

export default function SettingsPanel() {
  const settings = useSettingsStore();

  return (
    <div className="flex h-full max-w-xl flex-col gap-6 overflow-y-auto p-6 text-slate-200">
      <div>
        <h2 className="mb-1 text-xl font-semibold text-slate-100">Project Settings</h2>
        <p className="text-sm text-slate-400">Preferences are persisted across sessions.</p>
      </div>

      {/* Font size */}
      <section className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Editor font size — <span className="text-slate-200">{settings.fontSize}px</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {FONT_SIZES.map((sz) => (
            <button
              key={sz}
              onClick={() => settings.setFontSize(sz)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                settings.fontSize === sz
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {sz}px
            </button>
          ))}
        </div>
        <input
          type="range"
          min={10}
          max={24}
          value={settings.fontSize}
          onChange={(e) => settings.setFontSize(Number(e.target.value))}
          className="mt-1 accent-cyan-500"
        />
      </section>

      {/* Auto-save */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Auto-save</label>
          <button
            onClick={() => settings.setAutoSaveEnabled(!settings.autoSaveEnabled)}
            className={`relative h-5 w-10 rounded-full transition-colors ${settings.autoSaveEnabled ? 'bg-cyan-600' : 'bg-slate-600'}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${settings.autoSaveEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>
        {settings.autoSaveEnabled && (
          <div className="flex flex-wrap gap-2">
            {AUTO_SAVE_OPTIONS.map((o) => (
              <button
                key={o.ms}
                onClick={() => settings.setAutoSaveIntervalMs(o.ms)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  settings.autoSaveIntervalMs === o.ms
                    ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Theme */}
      <section className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Theme</label>
        <div className="flex gap-2">
          {(['dark', 'midnight', 'light', 'hc-dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => settings.setTheme(t)}
              className={`rounded-md border px-4 py-1.5 text-sm capitalize transition-colors ${
                settings.theme === t
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Plugin execution
        </label>
        <p className="text-xs text-slate-500">
          Web Worker keeps full IDE API. Utility process isolates bundle code; API is stubbed until the bridge
          ships.
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'worker' as const, label: 'Web Worker (default)' },
              { id: 'utility' as const, label: 'Utility process (experimental)' }
            ] satisfies Array<{ id: PluginExecutionHost; label: string }>
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => settings.setPluginExecutionHost(o.id)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                settings.pluginExecutionHost === o.id
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Account</label>
        <AccountPanel />
      </section>

      <section className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Enterprise policy
        </label>
        <PolicyPanel />
      </section>

      <button
        onClick={settings.resetDefaults}
        className="mt-auto w-fit rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/20"
      >
        Reset to defaults
      </button>
    </div>
  );
}
