import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Bug, ChevronRight, CircleStop, Play, Repeat, StepForward } from 'lucide-react';
import { useAppStore } from '@/renderer/state/app-store';
import { useDebugStore } from './dap-store';
import {
  continueDebug,
  disconnectDebug,
  selectFrame,
  startDebugSession,
  stepIn,
  stepOut,
  stepOver
} from './dap-client';
import { loadLaunchConfigurations, type LaunchConfiguration } from './launch-config';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Idle',
  launching: 'Launching…',
  running: 'Running',
  paused: 'Paused',
  terminated: 'Terminated',
  error: 'Error'
};

export function DebugPanel(): ReactElement {
  const workspacePath = useAppStore((state) => state.workspacePath);
  const status = useDebugStore((state) => state.status);
  const message = useDebugStore((state) => state.message);
  const stack = useDebugStore((state) => state.stack);
  const scopes = useDebugStore((state) => state.scopes);
  const variables = useDebugStore((state) => state.variables);
  const breakpoints = useDebugStore((state) => state.breakpoints);
  const selectedFrameId = useDebugStore((state) => state.selectedFrameId);

  const [configs, setConfigs] = useState<LaunchConfiguration[]>([]);
  const [selectedConfigName, setSelectedConfigName] = useState<string | null>(null);

  useEffect(() => {
    if (!workspacePath) {
      setConfigs([]);
      return;
    }
    void loadLaunchConfigurations(workspacePath).then((list) => {
      setConfigs(list);
      setSelectedConfigName(list[0]?.name ?? null);
    });
  }, [workspacePath]);

  const selectedConfig = useMemo(
    () => configs.find((config) => config.name === selectedConfigName) ?? null,
    [configs, selectedConfigName]
  );

  const onStart = async (): Promise<void> => {
    if (!workspacePath || !selectedConfig) return;
    await startDebugSession(workspacePath, selectedConfig);
  };

  return (
    <div className="flex h-full flex-col bg-slate-950/40">
      <div className="border-b border-white/10 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-amber-300" />
            <p className="text-foreground text-sm font-semibold">Run &amp; Debug</p>
          </div>
          <span className="text-muted-foreground text-[10px] uppercase">
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
        {message ? <p className="text-muted-foreground mt-1 truncate text-[10px]">{message}</p> : null}
      </div>

      <div className="space-y-2 border-b border-white/10 p-3">
        <label className="text-muted-foreground block text-[11px] uppercase tracking-wider">
          Configuration
          <select
            className="text-foreground mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs focus:border-cyan-400/50 focus:outline-none"
            value={selectedConfigName ?? ''}
            onChange={(event) => setSelectedConfigName(event.target.value || null)}
            disabled={configs.length === 0}
          >
            {configs.length === 0 ? <option value="">No launch.json found</option> : null}
            {configs.map((config) => (
              <option key={config.name} value={config.name}>
                {config.name} · {config.type}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!selectedConfig || status === 'running' || status === 'launching'}
            onClick={() => void onStart()}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="h-3.5 w-3.5" /> Start
          </button>
          <button
            type="button"
            disabled={status !== 'paused'}
            onClick={() => void continueDebug()}
            className="inline-flex items-center gap-1 rounded-md bg-cyan-500/20 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            title="Continue"
          >
            <Repeat className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={status !== 'paused'}
            onClick={() => void stepOver()}
            className="inline-flex items-center gap-1 rounded-md bg-cyan-500/20 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            title="Step over"
          >
            <StepForward className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={status !== 'paused'}
            onClick={() => void stepIn()}
            className="rounded-md bg-cyan-500/20 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            title="Step into"
          >
            ⤓
          </button>
          <button
            type="button"
            disabled={status !== 'paused'}
            onClick={() => void stepOut()}
            className="rounded-md bg-cyan-500/20 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            title="Step out"
          >
            ⤒
          </button>
          <button
            type="button"
            disabled={status === 'idle' || status === 'terminated'}
            onClick={() => void disconnectDebug()}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-100 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CircleStop className="h-3.5 w-3.5" /> Stop
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <section>
          <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">Call stack</p>
          {stack.length === 0 ? (
            <p className="text-muted-foreground text-[11px]">
              Not paused. Hit a breakpoint to inspect frames.
            </p>
          ) : (
            <ul className="space-y-1">
              {stack.map((frame) => {
                const active = frame.id === selectedFrameId;
                return (
                  <li key={frame.id}>
                    <button
                      type="button"
                      onClick={() => void selectFrame(frame.id)}
                      className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[11px] hover:bg-white/10 ${
                        active ? 'bg-cyan-500/15 text-cyan-100' : 'text-foreground/90'
                      }`}
                    >
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {frame.name} · {frame.source?.path ?? ''}:{frame.line}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">Variables</p>
          {scopes.length === 0 ? (
            <p className="text-muted-foreground text-[11px]">No scopes loaded.</p>
          ) : (
            scopes.map((scope) => (
              <div key={scope.variablesReference} className="mb-2">
                <p className="text-foreground text-[11px] font-medium">{scope.name}</p>
                {variables[scope.variablesReference]?.length ? (
                  <ul className="mt-1 space-y-0.5">
                    {variables[scope.variablesReference].map((variable) => (
                      <li
                        key={`${variable.name}-${variable.variablesReference}`}
                        className="text-foreground/90 flex items-baseline justify-between gap-2 rounded px-2 py-0.5 text-[11px] hover:bg-white/5"
                      >
                        <span className="truncate font-mono">{variable.name}</span>
                        <span className="text-muted-foreground truncate font-mono">{variable.value}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground mt-1 text-[10px]">
                    {scope.expensive ? 'Expensive scope; expand explicitly.' : 'Empty.'}
                  </p>
                )}
              </div>
            ))
          )}
        </section>

        <section>
          <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">Breakpoints</p>
          {breakpoints.length === 0 ? (
            <p className="text-muted-foreground text-[11px]">Click the editor gutter to add breakpoints.</p>
          ) : (
            <ul className="space-y-0.5">
              {breakpoints.map((bp) => (
                <li
                  key={`${bp.file}:${bp.line}`}
                  className="text-foreground/90 truncate rounded px-2 py-0.5 text-[11px]"
                >
                  {bp.file.split('/').pop()}:{bp.line}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
