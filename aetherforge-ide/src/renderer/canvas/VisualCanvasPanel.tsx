import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactElement } from 'react';
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from '@/renderer/state/app-store';
import { CanvasPreview } from './CanvasPreview';
import { ComponentPalette } from './ComponentPalette';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasLayersPanel } from './CanvasLayersPanel';
import { useCanvasStore } from './store';
import { CANVAS_VIRTUAL_PATH, generateCanvasCode, parseCanvasCode } from './sync';
import type { CanvasComponentType } from './types';
import { usePagesStore } from '@/renderer/state/pages-store';

const FOCUS_NODE_EVENT = 'aetherforge:focus-node';

function VisualCanvasInner(): ReactElement {
  const reactFlow = useReactFlow();

  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const previewMode = useCanvasStore((state) => state.previewMode);
  const [showLayers, setShowLayers] = useState(false);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const addNodeFromPalette = useCanvasStore((state) => state.addNodeFromPalette);
  const setNodesFromSerialized = useCanvasStore((state) => state.setNodesFromSerialized);
  const pages = usePagesStore((state) => state.pages);
  const copySelected = useCanvasStore((state) => state.copySelected);
  const pasteClipboard = useCanvasStore((state) => state.pasteClipboard);
  const duplicateSelected = useCanvasStore((state) => state.duplicateSelected);

  const ensureCanvasTab = useAppStore((state) => state.ensureCanvasTab);
  const upsertVirtualTabContent = useAppStore((state) => state.upsertVirtualTabContent);
  const openTabs = useAppStore((state) => state.openTabs);

  const canvasTab = openTabs.find((tab) => tab.path === CANVAS_VIRTUAL_PATH) ?? null;
  const lastGeneratedCode = useRef('');

  const fitViewOptions = useMemo(() => ({ padding: 0.15 }), []);

  // Canvas-scoped keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'c') {
        copySelected();
      } else if (e.key === 'v') {
        pasteClipboard();
      } else if (e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [copySelected, pasteClipboard, duplicateSelected]);

  useEffect(() => {
    ensureCanvasTab();
  }, [ensureCanvasTab]);

  useEffect(() => {
    const code = generateCanvasCode(nodes, pages);
    if (code === lastGeneratedCode.current) {
      return;
    }

    lastGeneratedCode.current = code;
    upsertVirtualTabContent(CANVAS_VIRTUAL_PATH, 'visual-builder.tsx', code);
  }, [nodes, pages, upsertVirtualTabContent]);

  useEffect(() => {
    if (!canvasTab) {
      return;
    }

    if (canvasTab.content === lastGeneratedCode.current) {
      return;
    }

    const parsed = parseCanvasCode(canvasTab.content);
    if (!parsed) {
      return;
    }

    setNodesFromSerialized(parsed);
  }, [canvasTab, setNodesFromSerialized]);

  useEffect(() => {
    const onFocusNode = (event: Event): void => {
      const detail = (event as CustomEvent<{ nodeId?: string }>).detail;
      const nodeId = detail?.nodeId;
      if (!nodeId) {
        return;
      }

      const node = useCanvasStore.getState().nodes.find((candidate) => candidate.id === nodeId);
      if (!node) {
        return;
      }

      reactFlow.setCenter(node.position.x, node.position.y, { zoom: 1.1, duration: 320 });
    };

    window.addEventListener(FOCUS_NODE_EVENT, onFocusNode);
    return () => {
      window.removeEventListener(FOCUS_NODE_EVENT, onFocusNode);
    };
  }, [reactFlow]);

  const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const componentType = event.dataTransfer.getData(
      'application/aetherforge-component'
    ) as CanvasComponentType;
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
      <CanvasToolbar showLayers={showLayers} onToggleLayers={() => setShowLayers((v) => !v)} />
      <div className="flex h-full min-h-0" onDragOver={onDragOver} onDrop={onDrop}>
        <ComponentPalette />

        <div className="relative h-full min-h-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
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

        {previewMode ? (
          <div className="h-full w-[420px] border-l border-white/10 bg-black/20 p-2">
            <CanvasPreview />
          </div>
        ) : null}

        {showLayers && !previewMode ? (
          <div className="h-full w-[200px] border-l border-white/10 bg-black/20">
            <CanvasLayersPanel />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function VisualCanvasPanel(): ReactElement {
  return (
    <ReactFlowProvider>
      <VisualCanvasInner />
    </ReactFlowProvider>
  );
}
