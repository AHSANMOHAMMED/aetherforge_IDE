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
import { getApiPaletteItem } from './library';
import type { APIComponentType, APIEdge, APINode, APISerializableNode } from './types';
import { createGraphHistory } from '@/renderer/canvas/use-graph-history';

const RECOVERY_KEY = 'aetherforge.api-canvas.recovery.v1';
const apiHistory = createGraphHistory<APINode, APIEdge>(60);

export type APIAlignDirection = 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y';

type APIStore = {
  nodes: APINode[];
  edges: APIEdge[];
  selectedNodeIds: string[];
  setNodesFromSerialized: (nodes: APISerializableNode[]) => void;
  onNodesChange: (changes: NodeChange<APINode>[]) => void;
  onEdgesChange: (changes: EdgeChange<APIEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNodeFromPalette: (componentType: APIComponentType, position: XYPosition) => void;
  updateSelectedNode: (props: Partial<APINode['data']['props']>, label?: string) => void;
  deleteSelected: () => void;
  autoLayout: () => void;
  alignSelected: (direction: APIAlignDirection) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  snapshotRecovery: () => void;
  getRecoverySnapshot: () => { nodes: APINode[]; edges: APIEdge[] } | null;
};

function nextNodeId(componentType: APIComponentType): string {
  return `${componentType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function autoLayout(nodes: APINode[]): APINode[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const gapX = 280;
  const gapY = 170;

  return nodes.map((node, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      ...node,
      position: {
        x: 80 + column * gapX,
        y: 90 + row * gapY
      }
    };
  });
}

function alignNodes(nodes: APINode[], selectedIds: string[], direction: APIAlignDirection): APINode[] {
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

export const useApiStore = create<APIStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeIds: [],

  setNodesFromSerialized: (serializedNodes) => {
    const nodes: APINode[] = serializedNodes.map((item) => ({
      id: item.id,
      type: 'default',
      position: { x: item.x, y: item.y },
      data: {
        label: item.label,
        componentType: item.componentType,
        props: item.props
      }
    }));

    apiHistory.clear();
    set({ nodes, edges: [], selectedNodeIds: [] });
  },

  pushHistory: () => {
    const { nodes, edges } = get();
    apiHistory.push(nodes, edges);
  },

  undo: () => {
    const snap = apiHistory.undo({ nodes: get().nodes, edges: get().edges });
    if (!snap) return;
    set({ nodes: snap.nodes, edges: snap.edges, selectedNodeIds: [] });
  },

  redo: () => {
    const snap = apiHistory.redo({ nodes: get().nodes, edges: get().edges });
    if (!snap) return;
    set({ nodes: snap.nodes, edges: snap.edges, selectedNodeIds: [] });
  },

  snapshotRecovery: () => {
    try {
      const payload = JSON.stringify({ nodes: get().nodes, edges: get().edges, at: Date.now() });
      localStorage.setItem(RECOVERY_KEY, payload);
    } catch {
      // ignore
    }
  },

  getRecoverySnapshot: () => {
    try {
      const raw = localStorage.getItem(RECOVERY_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { nodes: APINode[]; edges: APIEdge[] };
      return { nodes: parsed.nodes, edges: parsed.edges };
    } catch {
      return null;
    }
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

    get().pushHistory();

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
    const item = getApiPaletteItem(componentType);
    const node: APINode = {
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

    set((state) => ({
      nodes: [...state.nodes, node],
      selectedNodeIds: [node.id]
    }));
  },

  updateSelectedNode: (props, label) => {
    const selectedNodeId = get().selectedNodeIds[0];
    if (!selectedNodeId) {
      return;
    }

    get().pushHistory();

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

  deleteSelected: () => {
    const selected = new Set(get().selectedNodeIds);
    if (selected.size === 0) {
      return;
    }

    get().pushHistory();

    set((state) => ({
      nodes: state.nodes.filter((node) => !selected.has(node.id)),
      edges: state.edges.filter((edge) => !selected.has(edge.source) && !selected.has(edge.target)),
      selectedNodeIds: []
    }));
  },

  autoLayout: () => {
    get().pushHistory();
    set((state) => ({
      nodes: autoLayout(state.nodes)
    }));
  },

  alignSelected: (direction) => {
    get().pushHistory();
    set((state) => ({
      nodes: alignNodes(state.nodes, state.selectedNodeIds, direction)
    }));
  }
}));
