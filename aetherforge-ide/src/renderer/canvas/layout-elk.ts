import type { CanvasEdge, CanvasNode } from './types';
import { autoLayoutGrid } from './layout';

/**
 * ELK layered graph layout for the visual canvas. Falls back to the grid
 * layout when ELK cannot run (SSR, bundle split failure, etc.).
 */
export async function tryElkLayout(nodes: CanvasNode[], edges: CanvasEdge[]): Promise<CanvasNode[] | null> {
  if (nodes.length === 0) return nodes;
  try {
    const ELK = (await import('elkjs')).default;
    const elk = new ELK();
    const graph = {
      id: 'root',
      layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT' },
      children: nodes.map((n) => ({
        id: n.id,
        width: 220,
        height: 100
      })),
      edges: edges.map((e, i) => ({
        id: e.id ?? `e-${i}`,
        sources: [e.source],
        targets: [e.target]
      }))
    };
    const laidOut = await elk.layout(graph);
    const posById = new Map<string, { x: number; y: number }>();
    for (const c of laidOut.children ?? []) {
      if (c.id && typeof c.x === 'number' && typeof c.y === 'number') {
        posById.set(c.id, { x: c.x, y: c.y });
      }
    }
    return nodes.map((n) => {
      const p = posById.get(n.id);
      if (!p) return n;
      return { ...n, position: { x: p.x, y: p.y } };
    });
  } catch {
    return null;
  }
}

export async function elkOrGrid(nodes: CanvasNode[], edges: CanvasEdge[]): Promise<CanvasNode[]> {
  const elk = await tryElkLayout(nodes, edges);
  return elk ?? autoLayoutGrid(nodes);
}
