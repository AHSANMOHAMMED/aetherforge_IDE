import { type ReactElement } from 'react';
import { useAppStore } from '@/renderer/state/app-store';
import { FileExplorer } from '@/renderer/components/explorer/FileExplorer';

export function ExplorerTab(): ReactElement {
  const workspacePath = useAppStore((state) => state.workspacePath);

  if (!workspacePath) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div className="text-slate-400">
          <p className="mb-2 text-sm font-medium">No workspace opened</p>
          <p className="text-xs text-slate-500">Open a folder to see files</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <FileExplorer />
    </div>
  );
}
