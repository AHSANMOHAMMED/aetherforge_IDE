import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition
} from '@xyflow/react';
import { create } from 'zustand';
import { autoLayoutGrid, alignNodes, type AlignDirection } from './layout';
import { elkOrGrid } from './layout-elk';
import { getPaletteItem } from './library';
import type { CanvasComponentType, CanvasEdge, CanvasNode, CanvasSerializableNode } from './types';
import type { CodegenTarget } from './codegen/index';
import { usePagesStore } from '@/renderer/state/pages-store';

type CanvasStore = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeIds: string[];
  previewMode: boolean;
  codegenTarget: CodegenTarget;
  snapToGrid: boolean;
  gridSize: number;
  blueprintMode: boolean;
  setCodegenTarget: (target: CodegenTarget) => void;
  setSnapToGrid: (on: boolean) => void;
  setGridSize: (n: number) => void;
  setBlueprintMode: (on: boolean) => void;
  past: CanvasNode[][];
  future: CanvasNode[][];
  clipboard: CanvasNode[];
  setNodesFromSerialized: (nodes: CanvasSerializableNode[]) => void;
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNodeFromPalette: (componentType: CanvasComponentType, position: XYPosition) => void;
  updateSelectedNode: (props: Partial<CanvasNode['data']['props']>, label?: string) => void;
  updateNodePropsById: (
    nodeId: string,
    props: Partial<CanvasNode['data']['props']>,
    options?: { recordHistory?: boolean }
  ) => void;
  updateNodePropsBatch: (
    nodeIds: string[],
    props: Partial<CanvasNode['data']['props']>,
    options?: { recordHistory?: boolean }
  ) => void;
  selectNodeById: (nodeId: string) => void;
  deleteSelected: () => void;
  autoLayout: () => void;
  autoLayoutElk: () => Promise<void>;
  alignSelected: (direction: AlignDirection) => void;
  setPreviewMode: (preview: boolean) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  snapshotRecovery: () => void;
  getRecoverySnapshot: () => CanvasSerializableNode[] | null;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  reparent: (nodeId: string, newParentId: string | null) => void;
  alignmentGuides: { vx: number[]; hy: number[] } | null;
  clearAlignmentGuides: () => void;
};

function estimateNodeSize(n: CanvasNode): { w: number; h: number } {
  const p = n.data.props;
  const { componentType } = n.data;
  const w = p.width ?? (componentType === 'image' ? 120 : componentType === 'button' ? 100 : 160);
  const h = p.height ?? (componentType === 'image' ? 80 : 44);
  return { w, h };
}

function nodeBounds(n: CanvasNode): { l: number; r: number; t: number; b: number; cx: number; cy: number } {
  const { w, h } = estimateNodeSize(n);
  const x = n.position.x;
  const y = n.position.y;
  return { l: x, r: x + w, t: y, b: y + h, cx: x + w / 2, cy: y + h / 2 };
}

const ALIGN_PX = 6;

function computeAlignmentGuides(moving: CanvasNode, others: CanvasNode[]): { vx: number[]; hy: number[] } {
  const m = nodeBounds(moving);
  const vx = new Set<number>();
  const hy = new Set<number>();

  for (const o of others) {
    if (o.id === moving.id) continue;
    const b = nodeBounds(o);

    const tryVx = (a: number, c: number) => {
      if (Math.abs(a - c) < ALIGN_PX) {
        vx.add(c);
      }
    };
    const tryHy = (a: number, c: number) => {
      if (Math.abs(a - c) < ALIGN_PX) {
        hy.add(c);
      }
    };

    tryVx(m.l, b.l);
    tryVx(m.l, b.r);
    tryVx(m.l, b.cx);
    tryVx(m.r, b.l);
    tryVx(m.r, b.r);
    tryVx(m.r, b.cx);
    tryVx(m.cx, b.l);
    tryVx(m.cx, b.r);
    tryVx(m.cx, b.cx);

    tryHy(m.t, b.t);
    tryHy(m.t, b.b);
    tryHy(m.t, b.cy);
    tryHy(m.b, b.t);
    tryHy(m.b, b.b);
    tryHy(m.b, b.cy);
    tryHy(m.cy, b.t);
    tryHy(m.cy, b.b);
    tryHy(m.cy, b.cy);
  }

  return {
    vx: [...vx].slice(0, 12),
    hy: [...hy].slice(0, 12)
  };
}

function nextNodeId(componentType: CanvasComponentType): string {
  return `${componentType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  previewMode: false,
  codegenTarget: 'react',
  snapToGrid: true,
  gridSize: 8,
  blueprintMode: false,
  past: [],
  future: [],
  clipboard: [],
  alignmentGuides: null,

  clearAlignmentGuides: () => set({ alignmentGuides: null }),
  pushHistory: () => {
    set((state) => ({
      past: [...state.past.slice(-49), state.nodes],
      future: []
    }));
  },

  undo: () => {
    const { past, nodes } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1]!;
    set((state) => ({
      nodes: previous,
      past: state.past.slice(0, -1),
      future: [nodes, ...state.future.slice(0, 49)]
    }));
  },

  redo: () => {
    const { future, nodes } = get();
    if (future.length === 0) return;
    const next = future[0]!;
    set((state) => ({
      nodes: next,
      future: state.future.slice(1),
      past: [...state.past.slice(-49), nodes]
    }));
  },

  snapshotRecovery: () => {
    const { nodes } = get();
    try {
      const serialized: CanvasSerializableNode[] = nodes.map((n) => ({
        id: n.id,
        componentType: n.data.componentType,
        label: n.data.label,
        x: n.position.x,
        y: n.position.y,
        parentId: n.parentId,
        props: n.data.props
      }));
      localStorage.setItem('aetherforge-canvas-recovery', JSON.stringify(serialized));
    } catch {
      /* ignore storage errors */
    }
  },

  getRecoverySnapshot: () => {
    try {
      const raw = localStorage.getItem('aetherforge-canvas-recovery');
      if (!raw) return null;
      return JSON.parse(raw) as CanvasSerializableNode[];
    } catch {
      return null;
    }
  },

  setNodesFromSerialized: (serializedNodes) => {
    const activePageId = usePagesStore.getState().activePageId;
    const nodes: CanvasNode[] = serializedNodes.map((item) => ({
      id: item.id,
      type: 'default',
      position: { x: item.x, y: item.y },
      parentId: item.parentId,
      extent: item.parentId ? ('parent' as const) : undefined,
      data: {
        label: item.label,
        componentType: item.componentType,
        props: {
          ...item.props,
          pageId: item.props.pageId ?? activePageId
        }
      }
    }));

    set({ nodes, selectedNodeIds: [], past: [], future: [] });
  },

  onNodesChange: (changes) => {
    const snapToGrid = get().snapToGrid;
    const gridSize = get().gridSize;
    const processed = snapToGrid
      ? changes.map((ch) => {
          if (ch.type === 'position' && ch.position) {
            return {
              ...ch,
              position: {
                x: Math.round(ch.position.x / gridSize) * gridSize,
                y: Math.round(ch.position.y / gridSize) * gridSize
              }
            };
          }
          return ch;
        })
      : changes;
    const updatedNodes = applyNodeChanges(processed, get().nodes);
    const selectedNodeIds = updatedNodes.filter((node) => node.selected).map((node) => node.id);
    const dragging = updatedNodes.filter((n) => n.dragging);
    let alignmentGuides: { vx: number[]; hy: number[] } | null = null;
    if (dragging.length > 0) {
      const mover = dragging[0]!;
      const others = updatedNodes.filter((n) => n.id !== mover.id);
      const g = computeAlignmentGuides(mover, others);
      if (g.vx.length > 0 || g.hy.length > 0) {
        alignmentGuides = g;
      }
    }
    set({ nodes: updatedNodes, selectedNodeIds, alignmentGuides });
  },

  onEdgesChange: (changes) => {
    const updatedEdges = applyEdgeChanges(changes, get().edges);
    set({ edges: updatedEdges });
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) {
      return;
    }

    const nextEdges = addEdge(
      {
        ...connection,
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      },
      get().edges
    );

    set({ edges: nextEdges });
  },

  addNodeFromPalette: (componentType, position) => {
    get().pushHistory();
    const item = getPaletteItem(componentType);
    const activePageId = usePagesStore.getState().activePageId;
    const { selectedNodeIds, nodes } = get();
    const layoutParents = new Set<CanvasComponentType>([
      'frame',
      'row',
      'column',
      'stack',
      'grid',
      'container'
    ]);
    const parent = nodes.find(
      (n) => selectedNodeIds.includes(n.id) && layoutParents.has(n.data.componentType)
    );
    const node: CanvasNode = {
      id: nextNodeId(componentType),
      type: 'default',
      position,
      selected: false,
      parentId: parent?.id,
      extent: parent ? ('parent' as const) : undefined,
      data: {
        label: item.label,
        componentType,
        props: item.defaultProps
      }
    };

    node.data.props = {
      ...node.data.props,
      pageId: activePageId,
      onClickAction: componentType === 'button' ? 'none' : undefined
    };

    set((state) => ({
      nodes: [...state.nodes, node],
      selectedNodeIds: [node.id]
    }));
  },

  updateSelectedNode: (props, label) => {
    get().pushHistory();
    const selectedNodeId = get().selectedNodeIds[0];
    if (!selectedNodeId) {
      return;
    }

    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id !== selectedNodeId) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            label: label ?? node.data.label,
            props: {
              ...node.data.props,
              ...props
            }
          }
        };
      })
    }));
  },

  updateNodePropsById: (nodeId, props, options) => {
    if (!nodeId) {
      return;
    }

    if (options?.recordHistory !== false) {
      get().pushHistory();
    }

    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            props: {
              ...node.data.props,
              ...props
            }
          }
        };
      })
    }));
  },

  updateNodePropsBatch: (nodeIds, props, options) => {
    if (!nodeIds.length) {
      return;
    }

    const targetIds = new Set(nodeIds);
    if (options?.recordHistory !== false) {
      get().pushHistory();
    }

    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (!targetIds.has(node.id)) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            props: {
              ...node.data.props,
              ...props
            }
          }
        };
      })
    }));
  },

  selectNodeById: (nodeId) => {
    if (!nodeId) {
      return;
    }

    set((state) => {
      const exists = state.nodes.some((node) => node.id === nodeId);
      if (!exists) {
        return state;
      }

      return {
        nodes: state.nodes.map((node) => ({
          ...node,
          selected: node.id === nodeId
        })),
        selectedNodeIds: [nodeId]
      };
    });
  },

  deleteSelected: () => {
    get().pushHistory();
    const selected = new Set(get().selectedNodeIds);
    if (selected.size === 0) {
      return;
    }

    set((state) => ({
      nodes: state.nodes.filter((node) => !selected.has(node.id)),
      edges: state.edges.filter((edge) => !selected.has(edge.source) && !selected.has(edge.target)),
      selectedNodeIds: []
    }));
  },

  autoLayout: () => {
    set((state) => ({
      nodes: autoLayoutGrid(state.nodes)
    }));
  },

  autoLayoutElk: async () => {
    get().pushHistory();
    const { nodes, edges } = get();
    const next = await elkOrGrid(nodes, edges);
    set({ nodes: next });
  },

  alignSelected: (direction) => {
    set((state) => ({
      nodes: alignNodes(state.nodes, state.selectedNodeIds, direction)
    }));
  },

  setPreviewMode: (preview) => set({ previewMode: preview }),
  setCodegenTarget: (codegenTarget) => set({ codegenTarget }),
  setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
  setGridSize: (gridSize) => set({ gridSize: Math.max(4, Math.min(64, gridSize)) }),
  setBlueprintMode: (blueprintMode) => set({ blueprintMode }),
  duplicateSelected: () => {
    const selected = get().nodes.filter((n) => get().selectedNodeIds.includes(n.id));
    if (selected.length === 0) return;
    get().pushHistory();
    const OFFSET = 24;
    const dupes: CanvasNode[] = selected.map((n) => ({
      ...n,
      id: nextNodeId(n.data.componentType),
      position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
      selected: true
    }));
    // Deselect originals
    set((state) => ({
      nodes: [...state.nodes.map((n) => ({ ...n, selected: false })), ...dupes],
      selectedNodeIds: dupes.map((d) => d.id)
    }));
  },

  copySelected: () => {
    const selected = get().nodes.filter((n) => get().selectedNodeIds.includes(n.id));
    if (selected.length === 0) return;
    set({ clipboard: selected });
  },

  pasteClipboard: () => {
    const { clipboard } = get();
    if (clipboard.length === 0) return;
    get().pushHistory();
    const OFFSET = 32;
    const pasted: CanvasNode[] = clipboard.map((n) => ({
      ...n,
      id: nextNodeId(n.data.componentType),
      position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
      selected: true
    }));
    set((state) => ({
      nodes: [...state.nodes.map((n) => ({ ...n, selected: false })), ...pasted],
      selectedNodeIds: pasted.map((p) => p.id)
    }));
  },

  reparent: (nodeId, newParentId) => {
    const { nodes } = get();
    const isDescendant = (root: string, target: string): boolean => {
      const children = nodes.filter((n) => n.parentId === root);
      for (const c of children) {
        if (c.id === target) return true;
        if (isDescendant(c.id, target)) return true;
      }
      return false;
    };
    if (newParentId && (newParentId === nodeId || isDescendant(nodeId, newParentId))) {
      return;
    }
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              parentId: newParentId ?? undefined,
              extent: newParentId ? ('parent' as const) : undefined
            }
          : n
      )
    }));
  }
}));
