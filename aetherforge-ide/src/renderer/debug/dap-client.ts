import { useDebugStore, type StackFrame, type Variable } from './dap-store';
import type { LaunchConfiguration } from './launch-config';

type DapMessage = {
  seq?: number;
  type?: 'request' | 'response' | 'event';
  command?: string;
  request_seq?: number;
  success?: boolean;
  body?: Record<string, unknown> & {
    threadId?: number;
    threads?: Array<{ id: number; name: string }>;
    stackFrames?: Array<{
      id: number;
      name: string;
      source?: { path?: string };
      line: number;
      column?: number;
    }>;
    scopes?: Array<{ name: string; variablesReference: number; expensive?: boolean }>;
    variables?: Array<{ name: string; value: string; type?: string; variablesReference: number }>;
  };
  event?: string;
};

let nextSeq = 100;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (err: unknown) => void }>();
let detach: (() => void) | null = null;
let currentSessionId: string | null = null;

function isElectronApiAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.dapLaunch);
}

function sendRequest<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!currentSessionId || !isElectronApiAvailable()) {
    return Promise.reject(new Error('DAP session not initialized'));
  }
  const seq = nextSeq++;
  const promise = new Promise<T>((resolve, reject) => {
    pending.set(seq, { resolve: resolve as (value: unknown) => void, reject });
  });
  void window.electronAPI.dapSend({
    sessionId: currentSessionId,
    message: { seq, type: 'request', command, arguments: args }
  });
  return promise;
}

async function applyBreakpointsForFile(file: string): Promise<void> {
  const breakpoints = useDebugStore
    .getState()
    .breakpoints.filter((bp) => bp.file === file && bp.enabled)
    .map((bp) => ({ line: bp.line }));
  try {
    await sendRequest('setBreakpoints', {
      source: { path: file },
      breakpoints
    });
  } catch {
    // Adapter may not support setBreakpoints for some sources; ignore.
  }
}

async function applyAllBreakpoints(): Promise<void> {
  const files = new Set(useDebugStore.getState().breakpoints.map((bp) => bp.file));
  for (const file of files) {
    await applyBreakpointsForFile(file);
  }
}

async function refreshStack(threadId: number): Promise<void> {
  const stackResponse = await sendRequest<{ stackFrames?: StackFrame[] }>('stackTrace', {
    threadId,
    startFrame: 0,
    levels: 64
  });
  const frames = stackResponse?.stackFrames ?? [];
  useDebugStore.getState().setStack(frames, threadId);
  if (frames.length === 0) {
    useDebugStore.getState().setScopes([]);
    return;
  }
  await loadScopesAndVars(frames[0].id);
}

async function loadScopesAndVars(frameId: number): Promise<void> {
  const scopesResponse = await sendRequest<{
    scopes?: Array<{ name: string; variablesReference: number; expensive?: boolean }>;
  }>('scopes', { frameId });
  const scopes = scopesResponse?.scopes ?? [];
  useDebugStore.getState().setScopes(scopes);
  for (const scope of scopes) {
    if (scope.expensive) continue;
    try {
      const varsResponse = await sendRequest<{ variables?: Variable[] }>('variables', {
        variablesReference: scope.variablesReference
      });
      useDebugStore.getState().setVariables(scope.variablesReference, varsResponse?.variables ?? []);
    } catch {
      // ignore
    }
  }
}

function handleEvent(message: DapMessage): void {
  const store = useDebugStore.getState();
  if (message.event === 'stopped' && message.body?.threadId) {
    store.setStatus('paused');
    void refreshStack(message.body.threadId);
  } else if (message.event === 'continued') {
    store.setStatus('running');
  } else if (message.event === 'terminated' || message.event === 'exited') {
    store.setStatus('terminated');
  } else if (message.event === 'initialized') {
    void (async () => {
      await applyAllBreakpoints();
      try {
        await sendRequest('configurationDone', {});
      } catch {
        // some adapters don't require this
      }
      store.setStatus('running');
    })();
  } else if (message.event === 'output') {
    // Output events could be wired into a debug REPL; surface to status for now.
    const body = message.body as { category?: string; output?: string } | undefined;
    if (body?.output) {
      store.setStatus(store.status === 'paused' ? 'paused' : 'running', body.output);
    }
  }
}

function handleResponse(message: DapMessage): void {
  if (typeof message.request_seq !== 'number') return;
  const handler = pending.get(message.request_seq);
  if (!handler) return;
  pending.delete(message.request_seq);
  if (message.success === false) {
    handler.reject(
      new Error((message.body as { error?: { format?: string } })?.error?.format ?? 'DAP error')
    );
  } else {
    handler.resolve(message.body ?? {});
  }
}

function ensureListener(): void {
  if (detach || !isElectronApiAvailable()) return;
  detach = window.electronAPI.onDapEvent((payload) => {
    if (payload.sessionId !== currentSessionId) return;
    const message = payload.message as DapMessage | undefined;
    if (!message) return;
    if (message.type === 'response') {
      handleResponse(message);
      return;
    }
    if (message.type === 'event') {
      handleEvent(message);
    }
  });
}

export async function startDebugSession(
  workspacePath: string,
  configuration: LaunchConfiguration
): Promise<{ ok: boolean; error?: string }> {
  if (!isElectronApiAvailable()) {
    return { ok: false, error: 'Electron DAP API unavailable' };
  }
  const store = useDebugStore.getState();
  store.setStatus('launching');
  ensureListener();

  try {
    const result = await window.electronAPI.dapLaunch({
      workspacePath,
      type: configuration.type,
      request: configuration.request,
      configuration: { ...configuration }
    });

    if (!result.ok || !result.sessionId) {
      store.setStatus('error', result.error);
      return { ok: false, error: result.error };
    }

    currentSessionId = result.sessionId;
    store.setSession(result.sessionId);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to launch debug session';
    store.setStatus('error', message);
    return { ok: false, error: message };
  }
}

export async function continueDebug(): Promise<void> {
  const threadId = useDebugStore.getState().threadId ?? 1;
  await sendRequest('continue', { threadId });
  useDebugStore.getState().setStatus('running');
}

export async function stepOver(): Promise<void> {
  const threadId = useDebugStore.getState().threadId ?? 1;
  await sendRequest('next', { threadId });
}

export async function stepIn(): Promise<void> {
  const threadId = useDebugStore.getState().threadId ?? 1;
  await sendRequest('stepIn', { threadId });
}

export async function stepOut(): Promise<void> {
  const threadId = useDebugStore.getState().threadId ?? 1;
  await sendRequest('stepOut', { threadId });
}

export async function pauseDebug(): Promise<void> {
  const threadId = useDebugStore.getState().threadId ?? 1;
  await sendRequest('pause', { threadId });
}

export async function disconnectDebug(): Promise<void> {
  if (!currentSessionId || !isElectronApiAvailable()) {
    useDebugStore.getState().reset();
    return;
  }
  try {
    await sendRequest('disconnect', { terminateDebuggee: true });
  } catch {
    // ignore
  }
  await window.electronAPI.dapTerminate(currentSessionId);
  currentSessionId = null;
  detach?.();
  detach = null;
  pending.clear();
  useDebugStore.getState().reset();
}

export async function syncBreakpointsForFile(file: string): Promise<void> {
  if (!currentSessionId) return;
  await applyBreakpointsForFile(file);
}

export async function selectFrame(frameId: number): Promise<void> {
  useDebugStore.getState().selectFrame(frameId);
  if (!currentSessionId) return;
  await loadScopesAndVars(frameId);
}
