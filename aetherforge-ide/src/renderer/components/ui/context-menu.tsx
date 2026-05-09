import { useEffect, type ReactElement } from 'react';
import { cn } from '@/renderer/lib/utils';

export type ContextMenuItem = {
  id: string;
  label: string;
  onSelect: () => void | Promise<void>;
  destructive?: boolean;
  disabled?: boolean;
};

type ContextMenuProps = {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

export function ContextMenu(props: ContextMenuProps): ReactElement | null {
  const { open, x, y, items, onClose } = props;

  useEffect(() => {
    if (!open) {
      return;
    }

    const close = (): void => onClose();
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', close);

    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', close);
    };
  }, [open, onClose, items]);

  if (!open) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div className="pointer-events-auto absolute" style={{ left: x, top: y }}>
        <div className="min-w-[220px] overflow-hidden rounded-lg border border-white/15 bg-[#0d1324] p-1 shadow-2xl">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              className={cn(
                'text-foreground/90 block w-full rounded px-3 py-2 text-left text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40',
                item.destructive && 'text-red-300 hover:bg-red-500/15'
              )}
              onClick={async () => {
                if (item.disabled) {
                  return;
                }
                await item.onSelect();
                onClose();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
