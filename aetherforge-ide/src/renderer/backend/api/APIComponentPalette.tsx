import type { DragEvent, ReactElement } from 'react';
import { Boxes, Database, Route, ShieldCheck } from 'lucide-react';
import { API_PALETTE } from './library';
import type { APIComponentType } from './types';

const iconByType: Record<APIComponentType, ReactElement> = {
  endpoint: <Route className="h-4 w-4" />,
  middleware: <ShieldCheck className="h-4 w-4" />,
  service: <Boxes className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />
};

export function APIComponentPalette(): ReactElement {
  const onDragStart = (event: DragEvent<HTMLButtonElement>, type: APIComponentType): void => {
    event.dataTransfer.setData('application/aetherforge-api-component', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="h-full w-[240px] border-r border-white/10 bg-black/20 p-2">
      <p className="text-muted-foreground mb-2 px-1 text-xs uppercase tracking-wide">API Components</p>
      <div className="space-y-1">
        {API_PALETTE.map((item) => (
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
