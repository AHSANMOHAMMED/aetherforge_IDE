import { useEffect, useMemo, useState } from 'react';
import { Download, Package, Power, PowerOff, Search, Trash2 } from 'lucide-react';
import { CATALOG, type CatalogEntry } from './catalog';
import { fetchRemoteIndex, mergeCatalogs } from './remote-index';
import { usePluginRegistry } from '../registry';
import { useToastStore } from '../../state/toast-store';
import { scanAndLoadPlugins } from '../loader';

type Tab = 'all' | 'installed';

export default function MarketplacePanel() {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [remote, setRemote] = useState<CatalogEntry[]>([]);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const entries = await fetchRemoteIndex(undefined, controller.signal);
      if (entries.length > 0) {
        setRemote(entries);
      }
    })();
    return () => controller.abort();
  }, []);

  const catalog = useMemo(() => mergeCatalogs(CATALOG, remote), [remote]);
  const [selected, setSelected] = useState<CatalogEntry | null>(CATALOG[0] ?? null);

  const plugins = usePluginRegistry((s) => s.plugins);
  const setPluginEnabled = usePluginRegistry((s) => s.setPluginEnabled);
  const removePlugin = usePluginRegistry((s) => s.removePlugin);
  const pushToast = useToastStore((s) => s.pushToast);

  const installedIds = new Set(plugins.map((p) => p.manifest.id));

  const filtered = catalog.filter((e) => {
    if (tab === 'installed' && !installedIds.has(e.id)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.tags.some((t) => t.includes(q))
    );
  });

  async function handleInstallFromPath() {
    const result = await window.electronAPI.openWorkspaceDialog();
    if (result.canceled || !result.path) return;

    setInstalling(true);
    try {
      const res = await window.electronAPI.pluginInstallFromPath({ sourcePath: result.path });
      if (res.ok) {
        pushToast({ level: 'success', title: `Plugin installed: ${res.id ?? ''}` });
        await scanAndLoadPlugins();
      } else {
        pushToast({ level: 'error', title: 'Install failed', description: res.error });
      }
    } finally {
      setInstalling(false);
    }
  }

  async function handleUninstall(id: string) {
    const res = await window.electronAPI.pluginUninstall({ id });
    if (res.ok) {
      removePlugin(id);
      pushToast({ level: 'success', title: `Plugin uninstalled: ${id}` });
    } else {
      pushToast({ level: 'error', title: 'Uninstall failed', description: res.error });
    }
  }

  const selectedPlugin = plugins.find((p) => p.manifest.id === selected?.id);
  const isInstalled = selected ? installedIds.has(selected.id) : false;

  return (
    <div className="flex h-full overflow-hidden text-slate-200">
      {/* Sidebar */}
      <div className="flex w-72 shrink-0 flex-col border-r border-white/10">
        {/* Header */}
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Extensions Marketplace</h2>
        </div>

        {/* Search */}
        <div className="border-b border-white/10 px-3 py-2">
          <div className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input
              type="text"
              placeholder="Search extensions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {(['all', 'installed'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === t ? 'border-b-2 border-cyan-400 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'all' ? 'All' : `Installed (${plugins.length})`}
            </button>
          ))}
        </div>

        {/* Extension list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">No extensions found.</p>
          ) : (
            filtered.map((entry) => {
              const installed = installedIds.has(entry.id);
              const record = plugins.find((p) => p.manifest.id === entry.id);
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelected(entry)}
                  className={`flex w-full flex-col gap-0.5 border-b border-white/5 px-4 py-3 text-left transition-colors ${
                    selected?.id === entry.id ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-100">{entry.name}</span>
                    {installed && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${record?.enabled ? 'bg-emerald-400' : 'bg-slate-500'}`}
                      />
                    )}
                  </div>
                  <span className="line-clamp-1 text-xs text-slate-400">{entry.description}</span>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{entry.author}</span>
                    <span>·</span>
                    <span>v{entry.version}</span>
                    <span>·</span>
                    <span>{entry.downloads.toLocaleString()} ↓</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Install from path */}
        <div className="border-t border-white/10 p-3">
          <button
            onClick={handleInstallFromPath}
            disabled={installing}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-white/5 py-2 text-xs text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            {installing ? 'Installing…' : 'Install from Path…'}
          </button>
        </div>
      </div>

      {/* Detail pane */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {selected ? (
          <div className="flex max-w-2xl flex-col gap-5 p-6">
            {/* Title row */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20">
                <Package className="h-7 w-7 text-cyan-400" />
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-slate-100">{selected.name}</h1>
                <p className="mt-0.5 text-xs text-slate-400">
                  {selected.author} · v{selected.version}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {selected.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                {isInstalled && selectedPlugin ? (
                  <>
                    <button
                      onClick={() => setPluginEnabled(selected.id, !selectedPlugin.enabled)}
                      title={selectedPlugin.enabled ? 'Disable' : 'Enable'}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                        selectedPlugin.enabled
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                      }`}
                    >
                      {selectedPlugin.enabled ? (
                        <>
                          <PowerOff className="h-3.5 w-3.5" /> Disable
                        </>
                      ) : (
                        <>
                          <Power className="h-3.5 w-3.5" /> Enable
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleUninstall(selected.id)}
                      className="flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 transition-colors hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Uninstall
                    </button>
                  </>
                ) : (
                  <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
                    {selected.bundled ? 'Bundled' : 'Not installed'}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Description
              </h3>
              <p className="text-sm leading-relaxed text-slate-300">{selected.description}</p>
            </div>

            {/* Contributes */}
            {selected.contributes.commands?.length || selected.contributes.languages?.length ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Contributes
                </h3>
                {selected.contributes.commands && selected.contributes.commands.length > 0 && (
                  <div className="mb-2">
                    <p className="mb-1 text-xs text-slate-500">Commands</p>
                    <div className="flex flex-col gap-1">
                      {selected.contributes.commands.map((cmd) => (
                        <span
                          key={cmd}
                          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-cyan-300"
                        >
                          {cmd}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selected.contributes.languages && selected.contributes.languages.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-slate-500">Languages</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.contributes.languages.map((lang) => (
                        <span
                          key={lang}
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Runtime status */}
            {selectedPlugin && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Runtime Status
                </h3>
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                    selectedPlugin.status === 'loaded'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : selectedPlugin.status === 'error'
                        ? 'border-red-500/30 bg-red-500/10 text-red-300'
                        : 'border-white/10 bg-white/5 text-slate-400'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      selectedPlugin.status === 'loaded'
                        ? 'bg-emerald-400'
                        : selectedPlugin.status === 'error'
                          ? 'bg-red-400'
                          : 'bg-slate-500'
                    }`}
                  />
                  <span className="capitalize">{selectedPlugin.status}</span>
                  {selectedPlugin.error && (
                    <span className="ml-1 text-red-400">— {selectedPlugin.error}</span>
                  )}
                </div>
              </div>
            )}

            {/* Downloads stat */}
            <div className="border-t border-white/10 pt-4">
              <p className="text-xs text-slate-500">{selected.downloads.toLocaleString()} installs</p>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Select an extension to view details.
          </div>
        )}
      </div>
    </div>
  );
}
