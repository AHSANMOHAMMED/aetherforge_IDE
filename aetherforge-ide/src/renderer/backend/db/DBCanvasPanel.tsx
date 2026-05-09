import { useEffect, useMemo, useRef, type DragEvent, type ReactElement } from 'react';
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from '@/renderer/state/app-store';
import { useToastStore } from '@/renderer/state/toast-store';
import { DBComponentPalette } from './DBComponentPalette';
import { DBRelationEdge } from './DBRelationEdge';
import { DBToolbar } from './DBToolbar';
import { useDbStore } from './store';
import {
  DB_PRISMA_VIRTUAL_NAME,
  DB_PRISMA_VIRTUAL_PATH,
  DB_SUPABASE_VIRTUAL_NAME,
  DB_SUPABASE_VIRTUAL_PATH,
  generatePrismaSchema,
  generateSupabaseSql,
  parseDbGraph,
  validateDbGraphState
} from './sync';
import type { DBComponentType } from './types';

function DBCanvasInner(): ReactElement {
  const reactFlow = useReactFlow();

  const nodes = useDbStore((state) => state.nodes);
  const edges = useDbStore((state) => state.edges);
  const onNodesChange = useDbStore((state) => state.onNodesChange);
  const onEdgesChange = useDbStore((state) => state.onEdgesChange);
  const onConnect = useDbStore((state) => state.onConnect);
  const addNodeFromPalette = useDbStore((state) => state.addNodeFromPalette);
  const setGraphFromSerialized = useDbStore((state) => state.setGraphFromSerialized);

  const ensureDbTabs = useAppStore((state) => state.ensureDbTabs);
  const upsertVirtualTabContent = useAppStore((state) => state.upsertVirtualTabContent);
  const openTabs = useAppStore((state) => state.openTabs);
  const pushToast = useToastStore((state) => state.pushToast);

  const prismaTab = openTabs.find((tab) => tab.path === DB_PRISMA_VIRTUAL_PATH) ?? null;
  const lastGeneratedCode = useRef('');
  const lastValidationSignature = useRef('');

  const fitViewOptions = useMemo(() => ({ padding: 0.15 }), []);
  const edgeTypes = useMemo(() => ({ relation: DBRelationEdge }), []);

  useEffect(() => {
    ensureDbTabs();
  }, [ensureDbTabs]);

  useEffect(() => {
    const validation = validateDbGraphState(nodes, edges);
    const signature = `${validation.errors.join('|')}::${validation.warnings.join('|')}`;
    if (signature !== lastValidationSignature.current && signature.trim().length > 0) {
      lastValidationSignature.current = signature;
      const lines = [...validation.errors, ...validation.warnings].slice(0, 3);
      pushToast({
        level: validation.errors.length > 0 ? 'error' : 'info',
        title: validation.errors.length > 0 ? 'DB validation issues detected' : 'DB validation warnings',
        description: lines.join(' | '),
        durationMs: validation.errors.length > 0 ? 3600 : 2600
      });
    }

    const prismaCode = generatePrismaSchema(nodes, edges);
    const supabaseSql = generateSupabaseSql(nodes, edges);
    if (prismaCode === lastGeneratedCode.current) {
      return;
    }

    lastGeneratedCode.current = prismaCode;
    upsertVirtualTabContent(DB_PRISMA_VIRTUAL_PATH, DB_PRISMA_VIRTUAL_NAME, prismaCode);
    upsertVirtualTabContent(DB_SUPABASE_VIRTUAL_PATH, DB_SUPABASE_VIRTUAL_NAME, supabaseSql);
  }, [edges, nodes, pushToast, upsertVirtualTabContent]);

  useEffect(() => {
    if (!prismaTab) {
      return;
    }

    if (prismaTab.content === lastGeneratedCode.current) {
      return;
    }

    const parsed = parseDbGraph(prismaTab.content);
    if (!parsed) {
      return;
    }

    setGraphFromSerialized(parsed.nodes, parsed.edges);
  }, [prismaTab, setGraphFromSerialized]);

  const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const componentType = event.dataTransfer.getData(
      'application/aetherforge-db-component'
    ) as DBComponentType;
    if (!componentType) {
      return;
    }

    const position = reactFlow.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });

    addNodeFromPalette(componentType, position);
  };

  return (
    <div className="flex h-full flex-col">
      <DBToolbar />
      <div className="flex h-full min-h-0" onDragOver={onDragOver} onDrop={onDrop}>
        <DBComponentPalette />

        <div className="relative h-full min-h-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={fitViewOptions}
            selectionOnDrag
            selectNodesOnDrag
            multiSelectionKeyCode={['Meta', 'Control']}
          >
            <Background color="rgba(255,255,255,0.08)" gap={18} />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export function DBCanvasPanel(): ReactElement {
  return (
    <ReactFlowProvider>
      <DBCanvasInner />
    </ReactFlowProvider>
  );
}
