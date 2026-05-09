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
import { getDbPaletteItem } from './library';
import type { DBComponentType, DBEdge, DBNode, DBSerializableEdge, DBSerializableNode } from './types';
import { createGraphHistory } from '@/renderer/canvas/use-graph-history';

const RECOVERY_KEY = 'aetherforge.db-canvas.recovery.v1';
const dbHistory = createGraphHistory<DBNode, DBEdge>(60);

export type DBAlignDirection = 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y';

function formatEdgeLabel(data: DBEdge['data']): string {
  const relationName = data?.relationName?.trim() || 'FK';
  const cardinality = data?.cardinality === 'one-to-one' ? '1:1' : '1:N';
  const required = data?.required ? ' required' : '';
  return `${relationName} · ${cardinality}${required}`;
}

type DBStore = {
  nodes: DBNode[];
  edges: DBEdge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  setNodesFromSerialized: (nodes: DBSerializableNode[]) => void;
  setGraphFromSerialized: (nodes: DBSerializableNode[], edges: DBSerializableEdge[]) => void;
  onNodesChange: (changes: NodeChange<DBNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<DBEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNodeFromPalette: (componentType: DBComponentType, position: XYPosition) => void;
  updateSelectedNode: (props: Partial<DBNode['data']['props']>, label?: string) => void;
  updateSelectedEdge: (props: Partial<NonNullable<DBEdge['data']>>) => void;
  deleteSelected: () => void;
  autoLayout: () => void;
  alignSelected: (direction: DBAlignDirection) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  snapshotRecovery: () => void;
  getRecoverySnapshot: () => { nodes: DBNode[]; edges: DBEdge[] } | null;
};

function nextNodeId(componentType: DBComponentType): string {
  return `${componentType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function autoLayout(nodes: DBNode[]): DBNode[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const gapX = 280;
  const gapY = 220;

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

function alignNodes(nodes: DBNode[], selectedIds: string[], direction: DBAlignDirection): DBNode[] {
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

export const useDbStore = create<DBStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  selectedEdgeIds: [],

  pushHistory: () => {
    const { nodes, edges } = get();
    dbHistory.push(nodes, edges);
  },

  undo: () => {
    const snap = dbHistory.undo({ nodes: get().nodes, edges: get().edges });
    if (!snap) return;
    set({ nodes: snap.nodes, edges: snap.edges, selectedNodeIds: [], selectedEdgeIds: [] });
  },

  redo: () => {
    const snap = dbHistory.redo({ nodes: get().nodes, edges: get().edges });
    if (!snap) return;
    set({ nodes: snap.nodes, edges: snap.edges, selectedNodeIds: [], selectedEdgeIds: [] });
  },

  snapshotRecovery: () => {
    try {
      localStorage.setItem(
        RECOVERY_KEY,
        JSON.stringify({ nodes: get().nodes, edges: get().edges, at: Date.now() })
      );
    } catch {
      // ignore
    }
  },

  getRecoverySnapshot: () => {
    try {
      const raw = localStorage.getItem(RECOVERY_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { nodes: DBNode[]; edges: DBEdge[] };
      return { nodes: parsed.nodes, edges: parsed.edges };
    } catch {
      return null;
    }
  },

  setNodesFromSerialized: (serializedNodes) => {
    const nodes: DBNode[] = serializedNodes.map((item) => ({
      id: item.id,
      type: 'default',
      position: { x: item.x, y: item.y },
      data: {
        label: item.label,
        componentType: item.componentType,
        props: item.props
      }
    }));

    set({ nodes, selectedNodeIds: [], selectedEdgeIds: [] });
    dbHistory.clear();
  },

  setGraphFromSerialized: (serializedNodes, serializedEdges) => {
    const nodes: DBNode[] = serializedNodes.map((item) => ({
      id: item.id,
      type: 'default',
      position: { x: item.x, y: item.y },
      data: {
        label: item.label,
        componentType: item.componentType,
        props: item.props
      }
    }));

    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges: DBEdge[] = serializedEdges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        type: 'relation',
        source: edge.source,
        target: edge.target,
        label: formatEdgeLabel({
          relationName: edge.relationName,
          sourceField: edge.sourceField,
          targetField: edge.targetField,
          cardinality: edge.cardinality,
          required: edge.required,
          onDelete: edge.onDelete,
          onUpdate: edge.onUpdate
        }),
        data: {
          relationName: edge.relationName,
          sourceField: edge.sourceField,
          targetField: edge.targetField,
          cardinality: edge.cardinality,
          required: edge.required,
          onDelete: edge.onDelete,
          onUpdate: edge.onUpdate
        }
      }));

    set({ nodes, edges, selectedNodeIds: [], selectedEdgeIds: [] });
    dbHistory.clear();
  },

  onNodesChange: (changes) => {
    const updatedNodes = applyNodeChanges(changes, get().nodes);
    const selectedNodeIds = updatedNodes.filter((node) => node.selected).map((node) => node.id);
    set({ nodes: updatedNodes, selectedNodeIds });
  },

  onEdgesChange: (changes) => {
    const updatedEdges = applyEdgeChanges(changes, get().edges);
    const selectedEdgeIds = updatedEdges.filter((edge) => edge.selected).map((edge) => edge.id);
    set({ edges: updatedEdges, selectedEdgeIds });
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) {
      return;
    }

    get().pushHistory();

    const nextEdges = addEdge(
      {
        ...connection,
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'relation',
        data: {
          relationName: 'relation_name',
          sourceField: 'id',
          targetField: 'id',
          cardinality: 'one-to-many',
          required: false,
          onDelete: 'NoAction',
          onUpdate: 'NoAction'
        },
        label: formatEdgeLabel({
          relationName: 'relation_name',
          sourceField: 'id',
          targetField: 'id',
          cardinality: 'one-to-many',
          required: false,
          onDelete: 'NoAction',
          onUpdate: 'NoAction'
        })
      },
      get().edges
    );

    set({ edges: nextEdges });
  },

  addNodeFromPalette: (componentType, position) => {
    get().pushHistory();
    const item = getDbPaletteItem(componentType);
    const node: DBNode = {
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

  updateSelectedEdge: (props) => {
    const selectedEdgeId = get().selectedEdgeIds[0];
    if (!selectedEdgeId) {
      return;
    }

    get().pushHistory();

    set((state) => ({
      edges: state.edges.map((edge) => {
        if (edge.id !== selectedEdgeId) {
          return edge;
        }

        const nextData = {
          ...edge.data,
          ...props
        };

        return {
          ...edge,
          label: formatEdgeLabel(nextData),
          data: nextData
        };
      })
    }));
  },

  deleteSelected: () => {
    const selectedNodes = new Set(get().selectedNodeIds);
    const selectedEdges = new Set(get().selectedEdgeIds);
    if (selectedNodes.size === 0 && selectedEdges.size === 0) {
      return;
    }

    get().pushHistory();

    set((state) => ({
      nodes: state.nodes.filter((node) => !selectedNodes.has(node.id)),
      edges: state.edges.filter(
        (edge) =>
          !selectedEdges.has(edge.id) && !selectedNodes.has(edge.source) && !selectedNodes.has(edge.target)
      ),
      selectedNodeIds: [],
      selectedEdgeIds: []
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
