import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  Cloud,
  CloudOff,
  Cpu,
  Database,
  PlugZap,
  RefreshCw,
  ServerCog,
  TerminalSquare,
  WandSparkles
} from 'lucide-react';
import { useAIStore } from '@/renderer/ai/store';
import { useAccountStore } from '@/renderer/auth/account-store';
import { useAppStore } from '@/renderer/state/app-store';
import { usePluginRegistry } from '@/renderer/plugins/registry';
import { getBridgeDiagnostics } from '@/renderer/runtime/bridge';
import { getRagIndexSummary, onRagIndexChanged } from '@/renderer/ai/rag/indexer';
import { getSyncStatus, onSyncStatusChanged } from '@/renderer/sync/sync-engine';

function Dot({ ok }: { ok: boolean }): ReactElement {
  return (
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
  );
}

function useRagSummary(): { workspaces: number; chunks: number } {
  const [summary, setSummary] = useState(() => getRagIndexSummary());
  useEffect(() => onRagIndexChanged(() => setSummary(getRagIndexSummary())), []);
  return summary;
}

function useSyncStatus(): ReturnType<typeof getSyncStatus> {
  const [s, setS] = useState(() => getSyncStatus());
  useEffect(() => onSyncStatusChanged(setS), []);
  return s;
}

export function RuntimeDiagnostics(): ReactElement {
  const aiProvider = useAIStore((state) => state.settings.provider);
  const plugins = usePluginRegistry((state) => state.plugins);
  const loadedPlugins = plugins.filter((p) => p.status === 'loaded').length;
  const session = useAccountStore((s) => s.session);
  const setMode = useAppStore((s) => s.setMode);
  const ragSummary = useRagSummary();
  const sync = useSyncStatus();

  const diagnostics = useMemo(() => getBridgeDiagnostics(), []);
  const devUrl = typeof window !== 'undefined' ? window.location.origin : 'n/a';

  const cloudLabel = session ? `cloud:${session.userId.slice(0, 6)}` : 'cloud:offline';
  const syncLabel =
    sync.state === 'pushing'
      ? `sync:${sync.pending || 1}…`
      : sync.state === 'queued'
        ? `sync:queued ${sync.pending}`
        : sync.state === 'error'
          ? 'sync:error'
          : sync.state === 'ok'
            ? 'sync:ok'
            : session
              ? 'sync:idle'
              : 'sync:offline';

  return (
    <div className="text-muted-foreground flex items-center gap-3 text-[10px]">
      <span className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5">
        <PlugZap className="h-3 w-3" />
        <Dot ok={diagnostics.bridgeAvailable} />
        bridge
      </span>
      <span className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5">
        <TerminalSquare className="h-3 w-3" />
        <Dot ok={diagnostics.terminalAvailable} />
        term
      </span>
      <span className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5">
        <ServerCog className="h-3 w-3" />
        <Dot ok={diagnostics.scaffoldAvailable && diagnostics.exportAvailable} />
        backend
      </span>
      <button
        type="button"
        onClick={() => setMode('settings')}
        title={session ? 'Signed in to AetherForge Cloud' : 'Click to sign in'}
        className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 hover:bg-white/5"
      >
        {session ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
        <Dot ok={Boolean(session)} />
        {cloudLabel}
      </button>
      <span
        title={sync.message ?? syncLabel}
        className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5"
      >
        <RefreshCw className={`h-3 w-3 ${sync.state === 'pushing' ? 'animate-spin' : ''}`} />
        {syncLabel}
      </span>
      <span
        title={`RAG index: ${ragSummary.chunks} chunks across ${ragSummary.workspaces} workspace(s)`}
        className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5"
      >
        <Database className="h-3 w-3" />
        rag:{ragSummary.chunks}
      </span>
      <span className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5">
        <WandSparkles className="h-3 w-3" />
        ai:{aiProvider}
      </span>
      <span className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5">
        <Cpu className="h-3 w-3" />
        plugins:{loadedPlugins}/{plugins.length}
      </span>
      <span className="hidden max-w-[220px] truncate md:inline">{devUrl}</span>
    </div>
  );
}
