import type { ReactElement } from 'react';
import {
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  Clipboard,
  Copy,
  CopyPlus,
  Grid3X3,
  Layers,
  Trash2,
  WandSparkles
} from 'lucide-react';
import { useCanvasStore } from './store';

type Props = { showLayers?: boolean; onToggleLayers?: () => void };

export function CanvasToolbar({ showLayers, onToggleLayers }: Props): ReactElement {
  const autoLayout = useCanvasStore((state) => state.autoLayout);
  const alignSelected = useCanvasStore((state) => state.alignSelected);
  const deleteSelected = useCanvasStore((state) => state.deleteSelected);
  const previewMode = useCanvasStore((state) => state.previewMode);
  const setPreviewMode = useCanvasStore((state) => state.setPreviewMode);
  const copySelected = useCanvasStore((state) => state.copySelected);
  const pasteClipboard = useCanvasStore((state) => state.pasteClipboard);
  const duplicateSelected = useCanvasStore((state) => state.duplicateSelected);

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
        <div className="mx-1 h-4 w-px bg-white/10" />
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs hover:bg-white/10"
          title="Copy (Cmd+C)"
          onClick={() => copySelected()}
        >
          <Copy className="mr-1 inline h-3.5 w-3.5" />
          Copy
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs hover:bg-white/10"
          title="Paste (Cmd+V)"
          onClick={() => pasteClipboard()}
        >
          <Clipboard className="mr-1 inline h-3.5 w-3.5" />
          Paste
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs hover:bg-white/10"
          title="Duplicate (Cmd+D)"
          onClick={() => duplicateSelected()}
        >
          <CopyPlus className="mr-1 inline h-3.5 w-3.5" />
          Duplicate
        </button>
        <div className="mx-1 h-4 w-px bg-white/10" />
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

      <button
        type="button"
        className={`rounded-md px-2 py-1 text-xs ${previewMode ? 'bg-cyan-500/20 text-cyan-100' : 'hover:bg-white/10'}`}
        onClick={() => setPreviewMode(!previewMode)}
      >
        <WandSparkles className="mr-1 inline h-3.5 w-3.5" />
        {previewMode ? 'Hide Preview' : 'Live Preview'}
      </button>
      <button
        type="button"
        className={`rounded-md px-2 py-1 text-xs ${showLayers ? 'bg-indigo-500/20 text-indigo-200' : 'hover:bg-white/10'}`}
        onClick={onToggleLayers}
      >
        <Layers className="mr-1 inline h-3.5 w-3.5" />
        Layers
      </button>
    </div>
  );
}
