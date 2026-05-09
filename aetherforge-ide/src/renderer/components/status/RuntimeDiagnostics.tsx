import { useMemo, type ReactElement } from 'react';
import { Cpu, PlugZap, ServerCog, TerminalSquare, WandSparkles } from 'lucide-react';
import { useAIStore } from '@/renderer/ai/store';
import { usePluginRegistry } from '@/renderer/plugins/registry';
import { getBridgeDiagnostics } from '@/renderer/runtime/bridge';

function Dot({ ok }: { ok: boolean }): ReactElement {
  return (
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
  );
}

export function RuntimeDiagnostics(): ReactElement {
  const aiProvider = useAIStore((state) => state.settings.provider);
  const plugins = usePluginRegistry((state) => state.plugins);
  const loadedPlugins = plugins.filter((p) => p.status === 'loaded').length;

  const diagnostics = useMemo(() => getBridgeDiagnostics(), []);
  const devUrl = typeof window !== 'undefined' ? window.location.origin : 'n/a';

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
