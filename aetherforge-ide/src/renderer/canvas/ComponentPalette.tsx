import type { DragEvent, ReactElement } from 'react';
import {
  AlertCircle,
  Bell,
  Box,
  CheckSquare,
  ChevronDown,
  Image as ImageIcon,
  LayoutPanelLeft,
  Layers,
  MessageSquare,
  RectangleHorizontal,
  SlidersHorizontal,
  Tag,
  Type
} from 'lucide-react';
import { CANVAS_PALETTE } from './library';
import type { CanvasComponentType } from './types';

const iconByType: Record<CanvasComponentType, ReactElement> = {
  button: <RectangleHorizontal className="h-4 w-4" />,
  container: <LayoutPanelLeft className="h-4 w-4" />,
  text: <Type className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  card: <Box className="h-4 w-4" />,
  input: <MessageSquare className="h-4 w-4" />,
  select: <ChevronDown className="h-4 w-4" />,
  checkbox: <CheckSquare className="h-4 w-4" />,
  switch: <SlidersHorizontal className="h-4 w-4" />,
  badge: <Tag className="h-4 w-4" />,
  alert: <AlertCircle className="h-4 w-4" />,
  modal: <Layers className="h-4 w-4" />,
  navbar: <Bell className="h-4 w-4" />
};

export function ComponentPalette(): ReactElement {
  const onDragStart = (event: DragEvent<HTMLButtonElement>, type: CanvasComponentType): void => {
    event.dataTransfer.setData('application/aetherforge-component', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="h-full w-[220px] border-r border-white/10 bg-black/20 p-2">
      <p className="text-muted-foreground mb-2 px-1 text-xs uppercase tracking-wide">Components</p>
      <div className="space-y-1">
        {CANVAS_PALETTE.map((item) => (
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
