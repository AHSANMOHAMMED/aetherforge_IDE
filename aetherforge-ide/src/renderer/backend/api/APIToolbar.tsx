import type { ReactElement } from 'react';
import {
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  FileCode2,
  Grid3X3,
  Trash2
} from 'lucide-react';
import { useApiStore } from './store';

export function APIToolbar(): ReactElement {
  const autoLayout = useApiStore((state) => state.autoLayout);
  const alignSelected = useApiStore((state) => state.alignSelected);
  const deleteSelected = useApiStore((state) => state.deleteSelected);

  return (
    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs hover:bg-white/10"
          onClick={() => autoLayout()}
        >
          <Grid3X3 className="mr-1 inline h-3.5 w-3.5" />
          Auto Layout
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs hover:bg-white/10"
          onClick={() => alignSelected('center-x')}
        >
          <AlignHorizontalJustifyCenter className="mr-1 inline h-3.5 w-3.5" />
          Align X
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs hover:bg-white/10"
          onClick={() => alignSelected('center-y')}
        >
          <AlignVerticalJustifyCenter className="mr-1 inline h-3.5 w-3.5" />
          Align Y
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs text-red-200 hover:bg-red-500/20"
          onClick={() => deleteSelected()}
        >
          <Trash2 className="mr-1 inline h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      <span className="text-xs text-cyan-100">
        <FileCode2 className="mr-1 inline h-3.5 w-3.5" />
        Express + OpenAPI Sync
      </span>
    </div>
  );
}
