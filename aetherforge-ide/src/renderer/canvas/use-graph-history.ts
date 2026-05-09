export type GraphSnapshot<TNode, TEdge> = {
  nodes: TNode[];
  edges: TEdge[];
};

/**
 * Shared undo/redo for React Flow graphs (nodes + edges).
 * Visual canvas historically tracked nodes only; API/DB canvases now share
 * the same primitive so history is consistent across pillars.
 */
export function createGraphHistory<TNode, TEdge>(limit = 50) {
  let past: GraphSnapshot<TNode, TEdge>[] = [];
  let future: GraphSnapshot<TNode, TEdge>[] = [];

  const snapshot = (nodes: TNode[], edges: TEdge[]): GraphSnapshot<TNode, TEdge> => ({
    nodes: structuredClone(nodes),
    edges: structuredClone(edges)
  });

  return {
    push(nodes: TNode[], edges: TEdge[]) {
      past = [...past.slice(-(limit - 1)), snapshot(nodes, edges)];
      future = [];
    },
    undo(current: GraphSnapshot<TNode, TEdge>): GraphSnapshot<TNode, TEdge> | null {
      if (past.length === 0) return null;
      const prev = past[past.length - 1]!;
      past = past.slice(0, -1);
      future = [snapshot(current.nodes, current.edges), ...future.slice(0, limit - 1)];
      return prev;
    },
    redo(current: GraphSnapshot<TNode, TEdge>): GraphSnapshot<TNode, TEdge> | null {
      if (future.length === 0) return null;
      const next = future[0]!;
      future = future.slice(1);
      past = [...past.slice(-(limit - 1)), snapshot(current.nodes, current.edges)];
      return next;
    },
    clear() {
      past = [];
      future = [];
    },
    peekPast(): GraphSnapshot<TNode, TEdge> | null {
      return past.length ? past[past.length - 1]! : null;
    }
  };
}
