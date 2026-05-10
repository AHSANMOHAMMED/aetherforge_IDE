import type { Edge, Node } from '@xyflow/react';

export type CanvasComponentType =
  | 'frame'
  | 'row'
  | 'column'
  | 'stack'
  | 'grid'
  | 'button'
  | 'container'
  | 'text'
  | 'image'
  | 'card'
  | 'input'
  | 'select'
  | 'checkbox'
  | 'switch'
  | 'badge'
  | 'alert'
  | 'modal'
  | 'navbar'
  | 'fab'
  | 'appbar'
  | 'bottomnav'
  | 'chip'
  | 'radio'
  | 'slider'
  | 'progress'
  | 'imageview'
  | 'videoview'
  | 'list';

export type CanvasNodeProps = {
  text?: string;
  src?: string;
  className?: string;
  backgroundColor?: string;
  padding?: number;
  width?: number;
  height?: number;
  placeholder?: string;
  checked?: boolean;
  variant?: string;
  href?: string;
  pageId?: string;
  onClickAction?: 'none' | 'navigate' | 'custom';
  targetPageId?: string;
  onClickPrompt?: string;
  onClickHandlerCode?: string;
  /** Accessible name override for preview / codegen. */
  ariaLabel?: string;
  /** Slider / progress lower bound. */
  min?: number;
  /** Slider / progress upper bound. */
  max?: number;
  /** Slider / progress current value. */
  value?: number;
  /** List / select / chip group items. */
  items?: string[];
  /** Lucide / Material icon hint for icon-bearing components. */
  iconName?: string;
};

export type CanvasNodeData = {
  label: string;
  componentType: CanvasComponentType;
  props: CanvasNodeProps;
};

export type CanvasNode = Node<CanvasNodeData>;
export type CanvasEdge = Edge;

export type CanvasSerializableNode = {
  id: string;
  componentType: CanvasComponentType;
  label: string;
  x: number;
  y: number;
  /** React Flow parent id for nested layout. */
  parentId?: string;
  props: CanvasNodeProps;
};
