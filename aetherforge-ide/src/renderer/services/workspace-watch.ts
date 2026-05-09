import type { ElectronAPI } from '@/common/ipc';

function getApi(): ElectronAPI | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI ?? null;
}

/** Start/stop main-process chokidar watcher for workspace file events (RAG, sync, etc.). */
export async function syncWorkspaceFilesystemWatcher(
  previous: string | null,
  next: string | null
): Promise<void> {
  const api = getApi();
  if (!api?.watchWorkspace || !api?.unwatchWorkspace) return;
  if (previous && previous !== next) {
    await api.unwatchWorkspace({ workspacePath: previous }).catch(() => {});
  }
  if (next) {
    await api.watchWorkspace({ workspacePath: next }).catch(() => {});
  }
}
