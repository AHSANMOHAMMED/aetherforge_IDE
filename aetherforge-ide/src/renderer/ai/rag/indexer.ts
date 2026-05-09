import type { WorkspaceEvent } from '@/common/ipc';
import type { EmbeddedChunk } from './embeddings';
import { embedDocuments, searchEmbeddings } from './embeddings';

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|html)$/i;
const MAX_BYTES = 120_000;

/** In-memory embedding index keyed by workspace root path. */
const workspaceIndex = new Map<string, EmbeddedChunk[]>();

let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const pendingPaths = new Map<string, Set<string>>();

function relativePath(workspacePath: string, absolutePath: string): string | null {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
  const ws = norm(workspacePath);
  const ap = norm(absolutePath);
  if (!ap.startsWith(ws + '/') && ap !== ws) return null;
  return ap.slice(ws.length + 1);
}

function replaceChunksForSource(
  index: EmbeddedChunk[],
  source: string,
  newChunks: EmbeddedChunk[]
): EmbeddedChunk[] {
  const kept = index.filter((c) => c.source !== source);
  return [...kept, ...newChunks];
}

async function indexFile(workspacePath: string, filePath: string): Promise<void> {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!api?.readFile) return;
  const rel = relativePath(workspacePath, filePath);
  if (!rel || !TEXT_EXT.test(rel)) return;
  try {
    const { content } = await api.readFile(filePath);
    if (typeof content !== 'string' || content.length > MAX_BYTES) return;
    const chunks = await embedDocuments([{ id: rel, source: filePath, text: content }]);
    const prev = workspaceIndex.get(workspacePath) ?? [];
    workspaceIndex.set(workspacePath, replaceChunksForSource(prev, filePath, chunks));
  } catch {
    // ignore read/embed failures for transient files
  }
}

function removeFile(workspacePath: string, filePath: string): void {
  const prev = workspaceIndex.get(workspacePath);
  if (!prev) return;
  workspaceIndex.set(
    workspacePath,
    prev.filter((c) => c.source !== filePath)
  );
}

function flushQueue(): void {
  debounceTimer = null;
  void (async () => {
    for (const [ws, paths] of pendingPaths.entries()) {
      const copy = [...paths];
      paths.clear();
      for (const p of copy) {
        await indexFile(ws, p);
      }
    }
    pendingPaths.clear();
  })();
}

function scheduleIndex(workspacePath: string, filePath: string): void {
  let set = pendingPaths.get(workspacePath);
  if (!set) {
    set = new Set();
    pendingPaths.set(workspacePath, set);
  }
  set.add(filePath);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushQueue, 800);
}

function handleEvent(ev: WorkspaceEvent): void {
  const { workspacePath, kind, path: filePath } = ev;
  if (!workspacePath || !filePath) return;
  if (kind === 'unlink' || kind === 'unlinkDir') {
    removeFile(workspacePath, filePath);
    return;
  }
  if (kind === 'add' || kind === 'change') {
    scheduleIndex(workspacePath, filePath);
  }
}

/**
 * Subscribe to workspace watcher events and maintain an in-memory embedding index.
 */
export function startRagIndexer(): void {
  if (started) return;
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!api?.onWorkspaceEvent) return;
  started = true;
  api.onWorkspaceEvent(handleEvent);
}

/** Top snippets from the live index to prepend when the user did not use @mentions. */
export async function getRagAugmentationBlock(
  workspacePath: string | null,
  query: string
): Promise<string | null> {
  if (!workspacePath) return null;
  const index = workspaceIndex.get(workspacePath) ?? [];
  if (index.length === 0 || !query.trim()) return null;
  const hits = await searchEmbeddings(query.slice(0, 2000), index, 3);
  if (hits.length === 0) return null;
  const lines = hits.map((h) => `### ${h.source}\n${h.text.slice(0, 1200)}`);
  return ['## Related workspace files (semantic index)', ...lines].join('\n\n');
}
