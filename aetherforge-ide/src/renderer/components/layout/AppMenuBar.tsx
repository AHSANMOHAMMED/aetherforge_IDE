import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactElement } from 'react';
import { useAppStore } from '@/renderer/state/app-store';
import { useCanvasStore } from '@/renderer/canvas/store';

const triggerClass =
  'rounded px-2 py-1 text-xs text-foreground/90 hover:bg-white/10 data-[state=open]:bg-white/10 outline-none';

const itemClass =
  'flex cursor-default select-none items-center rounded px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-white/10';

export function AppMenuBar(): ReactElement {
  const openWorkspace = useAppStore((s) => s.openWorkspaceFolder);
  const saveActiveTab = useAppStore((s) => s.saveActiveTab);
  const setCommandPalette = useAppStore((s) => s.setCommandPalette);
  const setMode = useAppStore((s) => s.setMode);
  const toggleTerminal = useAppStore((s) => s.toggleTerminal);
  const canvasUndo = useCanvasStore((s) => s.undo);
  const canvasRedo = useCanvasStore((s) => s.redo);
  const setPreviewMode = useCanvasStore((s) => s.setPreviewMode);
  const setSnapToGrid = useCanvasStore((s) => s.setSnapToGrid);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);

  return (
    <div className="flex items-center gap-0.5">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className={triggerClass}>File</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={4}
            className="border-border bg-popover text-popover-foreground z-[300] min-w-[11rem] rounded-md border p-1 shadow-md"
          >
            <DropdownMenu.Item
              className={itemClass}
              onSelect={() => {
                void openWorkspace();
              }}
            >
              Open Folder…
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={itemClass}
              onSelect={() => {
                void saveActiveTab();
              }}
            >
              Save
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="bg-border my-1 h-px" />
            <DropdownMenu.Item className={itemClass} onSelect={() => setCommandPalette(true, 'command')}>
              Command Palette…
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger className={triggerClass}>Edit</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={4}
            className="border-border bg-popover text-popover-foreground z-[300] min-w-[11rem] rounded-md border p-1 shadow-md"
          >
            <DropdownMenu.Item className={itemClass} onSelect={() => canvasUndo()}>
              Canvas Undo
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => canvasRedo()}>
              Canvas Redo
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger className={triggerClass}>View</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={4}
            className="border-border bg-popover text-popover-foreground z-[300] min-w-[11rem] rounded-md border p-1 shadow-md"
          >
            <DropdownMenu.Item className={itemClass} onSelect={() => setMode('visual')}>
              Visual Canvas
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => setMode('preview')}>
              Runtime Preview
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => toggleTerminal()}>
              Toggle Terminal
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="bg-border my-1 h-px" />
            <DropdownMenu.Item className={itemClass} onSelect={() => setSnapToGrid(!snapToGrid)}>
              {snapToGrid ? 'Disable canvas snap' : 'Enable canvas snap'}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger className={triggerClass}>Canvas</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={4}
            className="border-border bg-popover text-popover-foreground z-[300] min-w-[12rem] rounded-md border p-1 shadow-md"
          >
            <DropdownMenu.Item className={itemClass} onSelect={() => setMode('visual')}>
              Open Visual Editor
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => setPreviewMode(true)}>
              Show live canvas preview
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemClass} onSelect={() => setPreviewMode(false)}>
              Hide live canvas preview
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
