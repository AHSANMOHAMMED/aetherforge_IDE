import type { CanvasNode } from './types';

export type AlignDirection = 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y';

export function autoLayoutGrid(nodes: CanvasNode[]): CanvasNode[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const gapX = 220;
  const gapY = 160;

  return nodes.map((node, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      ...node,
      position: {
        x: 80 + column * gapX,
        y: 80 + row * gapY
      }
    };
  });
}

export function alignNodes(
  nodes: CanvasNode[],
  selectedIds: string[],
  direction: AlignDirection
): CanvasNode[] {
  if (selectedIds.length < 2) {
    return nodes;
  }

  const selected = nodes.filter((node) => selectedIds.includes(node.id));
  const selectedX = selected.map((node) => node.position.x);
  const selectedY = selected.map((node) => node.position.y);

  const minX = Math.min(...selectedX);
  const maxX = Math.max(...selectedX);
  const minY = Math.min(...selectedY);
  const maxY = Math.max(...selectedY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return nodes.map((node) => {
    if (!selectedIds.includes(node.id)) {
      return node;
    }

    if (direction === 'left') {
      return { ...node, position: { ...node.position, x: minX } };
    }
    if (direction === 'right') {
      return { ...node, position: { ...node.position, x: maxX } };
    }
    if (direction === 'top') {
      return { ...node, position: { ...node.position, y: minY } };
    }
    if (direction === 'bottom') {
      return { ...node, position: { ...node.position, y: maxY } };
    }
    if (direction === 'center-x') {
      return { ...node, position: { ...node.position, x: centerX } };
    }

    return { ...node, position: { ...node.position, y: centerY } };
  });
}
