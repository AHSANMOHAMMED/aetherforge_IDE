import type { DragEvent, ReactElement } from 'react';
import { Table2, View } from 'lucide-react';
import { DB_PALETTE } from './library';
import type { DBComponentType } from './types';

const iconByType: Record<DBComponentType, ReactElement> = {
  table: <Table2 className="h-4 w-4" />,
  view: <View className="h-4 w-4" />
};

export function DBComponentPalette(): ReactElement {
  const onDragStart = (event: DragEvent<HTMLButtonElement>, type: DBComponentType): void => {
    event.dataTransfer.setData('application/aetherforge-db-component', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="h-full w-[240px] border-r border-white/10 bg-black/20 p-2">
      <p className="text-muted-foreground mb-2 px-1 text-xs uppercase tracking-wide">Database Components</p>
      <div className="space-y-1">
        {DB_PALETTE.map((item) => (
          <button
            key={item.type}
            type="button"
            draggable
            onDragStart={(event) => onDragStart(event, item.type)}
            className="w-full rounded-md border border-white/10 bg-black/25 px-2 py-2 text-left transition hover:bg-white/10"
          >
            <div className="text-foreground mb-1 flex items-center gap-2 text-sm">
              {iconByType[item.type]}
              <span>{item.label}</span>
            </div>
            <p className="text-muted-foreground text-xs">{item.description}</p>
          </button>
        ))}
      </div>
    </aside>
  );
}
