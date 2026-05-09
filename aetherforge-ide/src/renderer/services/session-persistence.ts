import localforage from 'localforage';
import { useAppStore } from '@/renderer/state/app-store';
import { syncWorkspaceFilesystemWatcher } from '@/renderer/services/workspace-watch';

/**
 * Session persistence: workspace path, open tabs, active tab, mode, sidebar.
 *
 * Stored in IndexedDB via localforage so it survives across launches and we
 * don't blow out localStorage with file content. Tab CONTENT is not persisted
 * (we re-read from disk on open) — only metadata.
 */

const KEY = 'aetherforge.session.v1';

type PersistedSession = {
  workspacePath: string | null;
  openTabPaths: string[];
  activeTabId: string | null;
  mode: string;
  sidebarActiveTab: string;
};

let restoring = false;

export async function restoreSession(): Promise<void> {
  if (restoring) return;
  restoring = true;
  try {
    const stored = (await localforage.getItem<PersistedSession>(KEY)) ?? null;
    if (!stored) return;
    const store = useAppStore.getState();

    if (stored.workspacePath) {
      store.setMode(stored.mode as never);
      // Re-open the workspace (the call also re-reads the tree).
      // openWorkspaceFolder dialog is not what we want; we directly mimic the open behaviour:
      const { openFile, refreshWorkspaceTree } = useAppStore.getState();
      useAppStore.setState({ workspacePath: stored.workspacePath });
      try {
        await refreshWorkspaceTree();
        await syncWorkspaceFilesystemWatcher(null, stored.workspacePath);
      } catch {
        // workspace gone? clear
        useAppStore.setState({ workspacePath: null, fileTree: [] });
        return;
      }
      for (const tabPath of stored.openTabPaths) {
        if (tabPath.startsWith('virtual://')) continue; // virtual tabs are recomputed by canvas effects
        try {
          await openFile(tabPath);
        } catch {
          // file may have moved; skip
        }
      }
      if (stored.activeTabId) {
        const exists = useAppStore.getState().openTabs.some((t) => t.id === stored.activeTabId);
        if (exists) {
          useAppStore.setState({ activeTabId: stored.activeTabId });
        }
      }
    }
  } finally {
    restoring = false;
  }
}

export function startSessionAutoSave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const s = useAppStore.getState();
      const value: PersistedSession = {
        workspacePath: s.workspacePath,
        openTabPaths: s.openTabs.map((t) => t.path),
        activeTabId: s.activeTabId,
        mode: s.mode,
        sidebarActiveTab: s.sidebarActiveTab
      };
      void localforage.setItem(KEY, value);
    }, 800);
  };
  const unsub = useAppStore.subscribe(persist);
  return () => {
    unsub();
    if (timer) clearTimeout(timer);
  };
}
