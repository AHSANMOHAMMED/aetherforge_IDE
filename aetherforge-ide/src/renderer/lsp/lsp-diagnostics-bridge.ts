import { useProblemsStore } from '@/renderer/state/problems-store';
import type { ProblemEntry, ProblemSeverity } from '@/renderer/state/problems-store';

function mapSeverity(severity: number | undefined): ProblemSeverity {
  switch (severity) {
    case 1:
      return 'error';
    case 2:
      return 'warning';
    case 3:
      return 'info';
    case 4:
      return 'hint';
    default:
      return 'info';
  }
}

function uriToPath(uri: string): string {
  if (uri.startsWith('file:')) {
    try {
      const u = new URL(uri);
      return decodeURIComponent(u.pathname);
    } catch {
      return uri;
    }
  }
  return uri;
}

type PublishDiagnosticsParams = {
  uri: string;
  diagnostics: Array<{
    range: { start: { line: number; character: number } };
    message: string;
    severity?: number;
    source?: string;
  }>;
};

function handleMessage(message: unknown): void {
  if (!message || typeof message !== 'object') {
    return;
  }
  const m = message as { method?: string; params?: unknown };
  if (m.method !== 'textDocument/publishDiagnostics' || !m.params) {
    return;
  }
  const params = m.params as PublishDiagnosticsParams;
  const file = uriToPath(params.uri);
  const replaceForFile = useProblemsStore.getState().replaceForFile;

  const entries: ProblemEntry[] = (params.diagnostics ?? []).map((d, i) => ({
    id: `${file}:${d.range?.start?.line ?? 0}:${i}`,
    file,
    line: (d.range?.start?.line ?? 0) + 1,
    column: (d.range?.start?.character ?? 0) + 1,
    message: d.message ?? '',
    severity: mapSeverity(d.severity),
    source: d.source ?? 'lsp'
  }));

  replaceForFile(file, entries);
}

export function registerLspDiagnosticsBridge(): () => void {
  const api = window.electronAPI;
  if (!api?.onLspMessage) {
    return () => {};
  }

  return api.onLspMessage((payload) => {
    try {
      handleMessage(payload.message);
    } catch {
      // ignore malformed LSP payloads
    }
  });
}
