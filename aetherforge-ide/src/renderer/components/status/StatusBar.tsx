import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useAppStore } from '@/renderer/state/app-store';
import { RuntimeDiagnostics } from './RuntimeDiagnostics';

function toRelativePath(absolutePath: string, workspacePath: string | null): string {
  if (!workspacePath) {
    return absolutePath;
  }

  const normalizedWorkspace = workspacePath.replace(/\\/g, '/');
  const normalizedPath = absolutePath.replace(/\\/g, '/');
  if (!normalizedPath.startsWith(normalizedWorkspace)) {
    return absolutePath;
  }
  return normalizedPath.slice(normalizedWorkspace.length + 1) || '/';
}

export function StatusBar(): ReactElement {
  const workspacePath = useAppStore((state) => state.workspacePath);
  const activeTabId = useAppStore((state) => state.activeTabId);
  const openTabs = useAppStore((state) => state.openTabs);
  const cursor = useAppStore((state) => state.cursor);
  const branch = useAppStore((state) => state.currentBranch);

  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, openTabs]
  );

  return (
    <div
      className="text-foreground/80 flex h-8 items-center justify-between border-t border-white/10 bg-black/30 px-3 text-xs"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-4 overflow-hidden">
        <span className="shrink-0">Branch: {branch}</span>
        <span className="truncate">
          {activeTab ? toRelativePath(activeTab.path, workspacePath) : 'No file selected'}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <RuntimeDiagnostics />
        <span>{activeTab?.language ?? 'plaintext'}</span>
        <span>{activeTab?.encoding ?? 'utf-8'}</span>
        <span>
          Ln {cursor.line}, Col {cursor.column}
        </span>
      </div>
    </div>
  );
}
