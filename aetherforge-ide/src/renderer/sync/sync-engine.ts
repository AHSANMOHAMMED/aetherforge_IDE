import type { WorkspaceEvent } from '@/common/ipc';
import { getCloudApiBaseUrl } from '@/renderer/cloud/cloud-fetch';
import { useAccountStore } from '@/renderer/auth/account-store';
import { confirmSyncBlob, pushManifest, type SyncFileEntry } from '@/renderer/sync/sync-client';

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|html|yml|yaml)$/i;
const MAX_BYTES = 512_000;

let started = false;
const dirtyPaths = new Set<string>();
let lastWorkspace: string | null = null;

type SyncStatus = {
  state: 'idle' | 'queued' | 'pushing' | 'ok' | 'error';
  pending: number;
  lastPushedAt: number | null;
  message?: string;
};
let status: SyncStatus = { state: 'idle', pending: 0, lastPushedAt: null };
const statusListeners = new Set<(s: SyncStatus) => void>();
function setStatus(next: Partial<SyncStatus>): void {
  status = { ...status, ...next };
  for (const fn of statusListeners) {
    try {
      fn(status);
    } catch {
      // ignore listener errors
    }
  }
}
export function getSyncStatus(): SyncStatus {
  return status;
}
export function onSyncStatusChanged(fn: (s: SyncStatus) => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

async function sha256Text(text: string): Promise<{ sha256: string; bytes: number }> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { sha256: hex, bytes: enc.byteLength };
}

async function buildEntries(workspacePath: string, paths: string[]): Promise<SyncFileEntry[]> {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!api?.readFile) return [];
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
  const ws = norm(workspacePath);
  const relOf = (abs: string): string => {
    const ap = norm(abs);
    return ap.startsWith(`${ws}/`) ? ap.slice(ws.length + 1) : abs;
  };
  const out: SyncFileEntry[] = [];
  for (const filePath of paths) {
    if (!TEXT_EXT.test(filePath)) continue;
    try {
      const { content } = await api.readFile(filePath);
      if (typeof content !== 'string' || content.length > MAX_BYTES) continue;
      const { sha256, bytes } = await sha256Text(content);
      out.push({ path: relOf(filePath), sha256, bytes });
    } catch {
      // skip
    }
  }
  return out;
}

async function flushWorkspace(workspacePath: string): Promise<void> {
  if (dirtyPaths.size === 0) return;
  const session = useAccountStore.getState().session;
  if (!session) {
    setStatus({ state: 'idle', message: 'Sign in to enable sync' });
    return;
  }
  const airgap = (window as unknown as { __AETHERFORGE_AIRGAP__?: boolean }).__AETHERFORGE_AIRGAP__;
  if (airgap) {
    setStatus({ state: 'idle', message: 'Air-gap mode' });
    return;
  }

  const copy = [...dirtyPaths];
  dirtyPaths.clear();
  setStatus({ state: 'pushing', pending: copy.length, message: undefined });
  const files = await buildEntries(workspacePath, copy);
  if (files.length === 0) {
    setStatus({ state: 'idle', pending: dirtyPaths.size });
    return;
  }

  const baseUrl = getCloudApiBaseUrl();
  const workspaceId = workspacePath;
  let manifest: Awaited<ReturnType<typeof pushManifest>>;
  try {
    manifest = await pushManifest(baseUrl, workspaceId, files);
  } catch (error) {
    setStatus({ state: 'error', message: error instanceof Error ? error.message : 'Push failed' });
    return;
  }
  if (!manifest.ok || !manifest.uploadUrls) {
    setStatus({ state: 'error', message: 'Manifest rejected' });
    return;
  }

  const api = window.electronAPI!;
  let confirmed = 0;
  for (const slot of manifest.uploadUrls) {
    const row = slot as { url?: string; path?: string };
    const url = row.url ?? '';
    const rel = row.path ?? '';
    if (!url || !rel) continue;
    const fullPath = rel.startsWith('/') || rel.includes(':') ? rel : `${workspacePath}/${rel}`;
    try {
      const { content } = await api.readFile(fullPath);
      if (typeof content !== 'string') continue;
      const put = await fetch(url, { method: 'PUT', body: content });
      if (!put.ok) continue;
      const { sha256, bytes } = await sha256Text(content);
      await confirmSyncBlob(baseUrl, { workspaceId, path: rel, sha256, bytes });
      confirmed += 1;
    } catch {
      // ignore per-file failures
    }
  }
  setStatus({
    state: 'ok',
    pending: dirtyPaths.size,
    lastPushedAt: Date.now(),
    message: `${confirmed} file${confirmed === 1 ? '' : 's'} pushed`
  });
}

function onWorkspaceEvent(ev: WorkspaceEvent): void {
  const { workspacePath, kind, path: filePath } = ev;
  if (!workspacePath || !filePath) return;
  lastWorkspace = workspacePath;
  if (kind === 'add' || kind === 'change') {
    dirtyPaths.add(filePath);
    setStatus({ state: 'queued', pending: dirtyPaths.size });
  }
  if (kind === 'unlink' || kind === 'unlinkDir') {
    dirtyPaths.delete(filePath);
    setStatus({ pending: dirtyPaths.size });
  }
}

export function startCloudSyncEngine(): void {
  if (started) return;
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!api?.onWorkspaceEvent) return;
  started = true;
  api.onWorkspaceEvent(onWorkspaceEvent);
  setInterval(() => {
    const ws = lastWorkspace;
    if (ws) void flushWorkspace(ws);
  }, 5000);
}
