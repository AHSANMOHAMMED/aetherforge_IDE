import type { ReactElement } from 'react';
import { Blocks, Code2, Database, Eye, Layers2, PanelsTopLeft, Settings, Store, Upload } from 'lucide-react';
import { useAppStore } from '@/renderer/state/app-store';

export function ModeSwitcher(): ReactElement {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-cyan-400/20 bg-[linear-gradient(120deg,rgba(8,15,30,0.85),rgba(15,20,40,0.85))] p-1 shadow-[0_0_0_1px_rgba(103,232,249,0.08),0_16px_40px_rgba(0,0,0,0.35)]">
      <button
        type="button"
        onClick={() => setMode('code')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
          mode === 'code'
            ? 'bg-cyan-500/25 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]'
            : 'text-foreground/70 hover:text-foreground'
        }`}
      >
        <Code2 className="h-4 w-4" />
        Code
      </button>
      <button
        type="button"
        onClick={() => setMode('visual')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
          mode === 'visual' ? 'bg-blue-500/25 text-blue-100' : 'text-foreground/70 hover:text-foreground'
        }`}
      >
        <PanelsTopLeft className="h-4 w-4" />
        Visual
      </button>
      <button
        type="button"
        onClick={() => setMode('split')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
          mode === 'split' ? 'bg-indigo-500/25 text-indigo-100' : 'text-foreground/70 hover:text-foreground'
        }`}
      >
        <Layers2 className="h-4 w-4" />
        Split
      </button>
      <button
        type="button"
        onClick={() => setMode('api-visual')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
          mode === 'api-visual' || mode === 'db-visual'
            ? 'bg-emerald-500/25 text-emerald-100'
            : 'text-foreground/70 hover:text-foreground'
        }`}
        title="Backend mode"
      >
        <Blocks className="h-4 w-4" />
        Backend
      </button>
      <div className="mx-1 h-4 w-px bg-white/10" />
      <button
        type="button"
        onClick={() => setMode('db-visual')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
          mode === 'db-visual'
            ? 'bg-fuchsia-500/25 text-fuchsia-100'
            : 'text-foreground/70 hover:text-foreground'
        }`}
        title="Database Builder"
      >
        <Database className="h-4 w-4" />
        DB
      </button>
      <button
        type="button"
        onClick={() => setMode('preview')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
          mode === 'preview' ? 'bg-amber-500/25 text-amber-100' : 'text-foreground/70 hover:text-foreground'
        }`}
      >
        <Eye className="h-4 w-4" />
        Preview
      </button>
      <button
        type="button"
        onClick={() => setMode('export')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
          mode === 'export' ? 'bg-violet-500/25 text-violet-100' : 'text-foreground/70 hover:text-foreground'
        }`}
      >
        <Upload className="h-4 w-4" />
        Export
      </button>
      <button
        type="button"
        onClick={() => setMode('settings')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
          mode === 'settings' ? 'bg-slate-400/25 text-slate-100' : 'text-foreground/70 hover:text-foreground'
        }`}
      >
        <Settings className="h-4 w-4" />
        Settings
      </button>
      <button
        type="button"
        onClick={() => setMode('marketplace')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
          mode === 'marketplace' ? 'bg-rose-500/25 text-rose-100' : 'text-foreground/70 hover:text-foreground'
        }`}
      >
        <Store className="h-4 w-4" />
        Marketplace
      </button>
    </div>
  );
}
