import { readdir } from 'node:fs/promises';
import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import type { FileNode, WorkspaceEvent } from '@/common/ipc';

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-electron',
  'release',
  '.next',
  '.turbo',
  '.cache',
  '.parcel-cache',
  'target',
  '.venv',
  '__pycache__'
]);

const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db']);

function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

async function buildNodeTree(directoryPath: string): Promise<FileNode[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (IGNORED_FILES.has(entry.name)) {
      continue;
    }

    const nodePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      nodes.push({
        name: entry.name,
        path: nodePath,
        type: 'directory',
        children: await buildNodeTree(nodePath)
      });
      continue;
    }

    if (entry.isFile()) {
      nodes.push({ name: entry.name, path: nodePath, type: 'file' });
    }
  }

  return sortNodes(nodes);
}

export async function readWorkspaceTree(workspacePath: string): Promise<FileNode[]> {
  return buildNodeTree(workspacePath);
}

// ─── Watcher manager ─────────────────────────────────────────────────────────

type WatcherHandle = {
  watcher: FSWatcher;
  workspacePath: string;
  refCount: number;
};

const watchers = new Map<string, WatcherHandle>();

function ignoredGlobs(workspacePath: string): (string | RegExp)[] {
  return [
    /(^|[/\\])\../,
    `${workspacePath}/node_modules`,
    `${workspacePath}/**/node_modules/**`,
    `${workspacePath}/dist`,
    `${workspacePath}/dist-electron`,
    `${workspacePath}/release`,
    `${workspacePath}/.next`,
    `${workspacePath}/.turbo`,
    `${workspacePath}/.cache`,
    `${workspacePath}/target`,
    `${workspacePath}/.venv`
  ];
}

export function startWatcher(workspacePath: string, emit: (event: WorkspaceEvent) => void): void {
  const existing = watchers.get(workspacePath);
  if (existing) {
    existing.refCount += 1;
    return;
  }

  const watcher = chokidar.watch(workspacePath, {
    ignored: ignoredGlobs(workspacePath) as never,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 30 },
    persistent: true,
    depth: 24
  });

  watcher
    .on('add', (p) => emit({ workspacePath, kind: 'add', path: p }))
    .on('addDir', (p) => emit({ workspacePath, kind: 'addDir', path: p }))
    .on('change', (p) => emit({ workspacePath, kind: 'change', path: p }))
    .on('unlink', (p) => emit({ workspacePath, kind: 'unlink', path: p }))
    .on('unlinkDir', (p) => emit({ workspacePath, kind: 'unlinkDir', path: p }))
    .on('ready', () => emit({ workspacePath, kind: 'ready' }))
    .on('error', (err) =>
      emit({
        workspacePath,
        kind: 'error',
        error: err instanceof Error ? err.message : String(err)
      })
    );

  watchers.set(workspacePath, { watcher, workspacePath, refCount: 1 });
}

export async function stopWatcher(workspacePath: string): Promise<void> {
  const handle = watchers.get(workspacePath);
  if (!handle) return;
  handle.refCount -= 1;
  if (handle.refCount > 0) return;
  watchers.delete(workspacePath);
  try {
    await handle.watcher.close();
  } catch {
    // best effort
  }
}

export async function stopAllWatchers(): Promise<void> {
  const handles = Array.from(watchers.values());
  watchers.clear();
  await Promise.allSettled(handles.map((h) => h.watcher.close()));
}
