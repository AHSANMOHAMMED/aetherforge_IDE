import type { CanvasComponentType, CanvasNodeProps } from './types';

export type CanvasPaletteItem = {
  type: CanvasComponentType;
  label: string;
  description: string;
  defaultProps: CanvasNodeProps;
};

export const CANVAS_PALETTE: CanvasPaletteItem[] = [
  {
    type: 'button',
    label: 'Button',
    description: 'Clickable action button',
    defaultProps: {
      text: 'Click Me',
      className: 'rounded-md bg-cyan-500 px-3 py-2 text-white'
    }
  },
  {
    type: 'container',
    label: 'Container',
    description: 'Generic layout block',
    defaultProps: {
      className: 'rounded-lg border border-slate-500/40 bg-slate-800/70',
      width: 240,
      height: 140,
      padding: 12
    }
  },
  {
    type: 'text',
    label: 'Text',
    description: 'Typography element',
    defaultProps: {
      text: 'Heading Text',
      className: 'text-base font-medium text-slate-100'
    }
  },
  {
    type: 'image',
    label: 'Image',
    description: 'Image with source URL',
    defaultProps: {
      src: 'https://picsum.photos/420/240',
      width: 220,
      height: 120,
      className: 'rounded-md object-cover'
    }
  },
  {
    type: 'card',
    label: 'Card',
    description: 'Card style component',
    defaultProps: {
      text: 'Card Title',
      className: 'rounded-lg border border-slate-500/30 bg-slate-900/90 p-4'
    }
  },
  {
    type: 'input',
    label: 'Input',
    description: 'Text input field',
    defaultProps: {
      placeholder: 'Enter text…',
      className: 'rounded-md border border-slate-500/40 bg-slate-800 px-3 py-2 text-sm text-slate-100',
      width: 200,
      height: 38
    }
  },
  {
    type: 'select',
    label: 'Select',
    description: 'Dropdown select',
    defaultProps: {
      text: 'Option 1',
      className: 'rounded-md border border-slate-500/40 bg-slate-800 px-3 py-2 text-sm text-slate-100',
      width: 180,
      height: 38
    }
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    description: 'Toggle checkbox',
    defaultProps: {
      text: 'Check me',
      checked: false,
      className: 'flex items-center gap-2 text-sm text-slate-100'
    }
  },
  {
    type: 'switch',
    label: 'Switch',
    description: 'Toggle switch',
    defaultProps: {
      text: 'Enable',
      checked: false,
      className: 'flex items-center gap-2 text-sm text-slate-100'
    }
  },
  {
    type: 'badge',
    label: 'Badge',
    description: 'Small status badge',
    defaultProps: {
      text: 'Badge',
      variant: 'default',
      className:
        'inline-flex items-center rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-medium text-cyan-300'
    }
  },
  {
    type: 'alert',
    label: 'Alert',
    description: 'Notification alert box',
    defaultProps: {
      text: 'Alert message here',
      variant: 'info',
      className: 'rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200',
      width: 280,
      height: 60
    }
  },
  {
    type: 'modal',
    label: 'Modal',
    description: 'Dialog/modal overlay',
    defaultProps: {
      text: 'Modal Title',
      className: 'rounded-xl border border-white/10 bg-slate-900 shadow-2xl',
      width: 380,
      height: 220,
      padding: 24
    }
  },
  {
    type: 'navbar',
    label: 'Navbar',
    description: 'Navigation bar',
    defaultProps: {
      text: 'My App',
      className:
        'flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/90 px-4 py-3',
      width: 480,
      height: 56
    }
  }
];

export function getPaletteItem(type: CanvasComponentType): CanvasPaletteItem {
  const item = CANVAS_PALETTE.find((candidate) => candidate.type === type);
  if (!item) {
    throw new Error(`Unknown canvas component type: ${type}`);
  }
  return item;
}
