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
import { usePagesStore } from '@/renderer/state/pages-store';

type CanvasStore = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeIds: string[];
  previewMode: boolean;
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
};

function nextNodeId(componentType: CanvasComponentType): string {
  return `${componentType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  previewMode: false,
  past: [],
  future: [],
  clipboard: [],

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
    const updatedNodes = applyNodeChanges(changes, get().nodes);
    const selectedNodeIds = updatedNodes.filter((node) => node.selected).map((node) => node.id);
    set({ nodes: updatedNodes, selectedNodeIds });
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
    const node: CanvasNode = {
      id: nextNodeId(componentType),
      type: 'default',
      position,
      selected: false,
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
  }
}));
