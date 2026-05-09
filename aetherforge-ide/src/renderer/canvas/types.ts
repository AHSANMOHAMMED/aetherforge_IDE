import type { Edge, Node } from '@xyflow/react';

export type CanvasComponentType =
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
  | 'navbar';

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
  props: CanvasNodeProps;
};
