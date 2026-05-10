import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type ReactElement
} from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  ViewportPortal
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useAppStore } from '@/renderer/state/app-store';
import { CanvasPreview } from './CanvasPreview';
import { CanvasComponentTree } from './CanvasComponentTree';
import { CanvasPropertiesPanel } from './CanvasPropertiesPanel';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasLayersPanel } from './CanvasLayersPanel';
import { useCanvasStore } from './store';
import { CANVAS_VIRTUAL_PATH, generateCanvasCode, parseCanvasCode } from './sync';
import { CODEGEN_TARGETS, emitForTarget, type CodegenTarget } from './codegen/index';
import type { CanvasComponentType } from './types';
import { usePagesStore } from '@/renderer/state/pages-store';
import { forwardRendererTelemetry } from '@/renderer/telemetry/telemetry-client';

const FOCUS_NODE_EVENT = 'aetherforge:focus-node';

/** Renders inside `<ReactFlow>` — uses viewport hooks. */
function CanvasAlignmentGuides(): ReactElement | null {
  const guides = useCanvasStore((s) => s.alignmentGuides);
  const { zoom } = useViewport();
  if (!guides || (guides.vx.length === 0 && guides.hy.length === 0)) {
    return null;
  }
  const sw = 1 / zoom;
  return (
    <ViewportPortal>
      <svg
        className="pointer-events-none"
        style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
      >
        {guides.vx.map((x) => (
          <line
            key={`v-${x}`}
            x1={x}
            x2={x}
            y1={-100000}
            y2={100000}
            stroke="#22d3ee"
            strokeOpacity={0.45}
            strokeWidth={sw}
          />
        ))}
        {guides.hy.map((y) => (
          <line
            key={`h-${y}`}
            y1={y}
            y2={y}
            x1={-100000}
            x2={100000}
            stroke="#22d3ee"
            strokeOpacity={0.45}
            strokeWidth={sw}
          />
        ))}
      </svg>
    </ViewportPortal>
  );
}

function VisualCanvasInner(): ReactElement {
  const reactFlow = useReactFlow();

  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const previewMode = useCanvasStore((state) => state.previewMode);
  const codegenTarget = useCanvasStore((state) => state.codegenTarget);
  const setCodegenTarget = useCanvasStore((state) => state.setCodegenTarget);
  const snapToGrid = useCanvasStore((state) => state.snapToGrid);
  const setSnapToGrid = useCanvasStore((state) => state.setSnapToGrid);
  const blueprintMode = useCanvasStore((state) => state.blueprintMode);
  const setBlueprintMode = useCanvasStore((state) => state.setBlueprintMode);
  const pushHistory = useCanvasStore((state) => state.pushHistory);
  const [showLayers, setShowLayers] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const addNodeFromPalette = useCanvasStore((state) => state.addNodeFromPalette);
  const setNodesFromSerialized = useCanvasStore((state) => state.setNodesFromSerialized);
  const pages = usePagesStore((state) => state.pages);
  const copySelected = useCanvasStore((state) => state.copySelected);
  const pasteClipboard = useCanvasStore((state) => state.pasteClipboard);
  const duplicateSelected = useCanvasStore((state) => state.duplicateSelected);
  const deleteSelected = useCanvasStore((state) => state.deleteSelected);
  const selectNodeById = useCanvasStore((state) => state.selectNodeById);
  const clearAlignmentGuides = useCanvasStore((state) => state.clearAlignmentGuides);

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
    for (const t of CODEGEN_TARGETS) {
      const art = emitForTarget(t, nodes, pages);
      upsertVirtualTabContent(art.path, art.name, art.content);
    }
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
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/20 px-2 py-1 text-[11px]">
        <label className="text-muted-foreground flex items-center gap-1">
          Target
          <select
            className="text-foreground rounded border border-white/10 bg-slate-900 px-1 py-0.5"
            value={codegenTarget}
            onChange={(e) => {
              const v = e.target.value as CodegenTarget;
              setCodegenTarget(v);
              void forwardRendererTelemetry('canvas.target.switched', { target: v });
            }}
          >
            {CODEGEN_TARGETS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-muted-foreground flex items-center gap-1">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => {
              setSnapToGrid(e.target.checked);
              void forwardRendererTelemetry('canvas.snap.toggled', { on: e.target.checked });
            }}
          />
          Snap
        </label>
        <label className="text-muted-foreground flex items-center gap-1">
          <input
            type="checkbox"
            checked={blueprintMode}
            onChange={(e) => setBlueprintMode(e.target.checked)}
          />
          Blueprint
        </label>
      </div>
      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal" autoSaveId="aetherforge.canvas.shell.v2">
          <Panel defaultSize={previewMode ? 62 : 70} minSize={40} className="min-h-0">
            <div
              className={`relative h-full min-h-0 ${blueprintMode ? 'opacity-90 contrast-125' : ''}`}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeContextMenu={(e, node) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
                }}
                onPaneClick={() => setCtxMenu(null)}
                onNodeDragStop={() => {
                  clearAlignmentGuides();
                  pushHistory();
                }}
                fitView
                fitViewOptions={fitViewOptions}
                selectionOnDrag
                selectNodesOnDrag
                multiSelectionKeyCode={['Meta', 'Control']}
              >
                <Background color="rgba(255,255,255,0.08)" gap={18} />
                <CanvasAlignmentGuides />
                <MiniMap pannable zoomable />
                <Controls />
              </ReactFlow>
            </div>
          </Panel>
          <PanelResizeHandle className="w-1 bg-white/10 hover:bg-cyan-500/40" />
          <Panel defaultSize={previewMode ? 38 : 30} minSize={22} className="min-h-0">
            <PanelGroup direction="vertical" autoSaveId="aetherforge.canvas.right.v2">
              <Panel defaultSize={32} minSize={16} className="min-h-0">
                <CanvasComponentTree />
              </Panel>
              <PanelResizeHandle className="h-1 bg-white/10 hover:bg-cyan-500/40" />
              <Panel
                defaultSize={48}
                minSize={20}
                className="flex min-h-0 flex-col overflow-hidden border-t border-white/5 bg-slate-950/80"
              >
                <p className="text-muted-foreground shrink-0 border-b border-white/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide">
                  Attributes
                </p>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <CanvasPropertiesPanel />
                </div>
              </Panel>
              <PanelResizeHandle className="h-1 bg-white/10 hover:bg-cyan-500/40" />
              <Panel defaultSize={20} minSize={12} className="min-h-0">
                {previewMode ? (
                  <CanvasPreview />
                ) : showLayers ? (
                  <CanvasLayersPanel />
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center px-2 text-center text-[11px]">
                    Toggle Live Preview or Layers from toolbar
                  </div>
                )}
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
      {ctxMenu ? (
        <div
          className="border-border bg-popover text-popover-foreground fixed z-[200] min-w-[168px] rounded-md border py-1 text-xs shadow-md"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          role="menu"
          onClick={(e: MouseEvent) => e.stopPropagation()}
          onContextMenu={(e: MouseEvent) => e.preventDefault()}
        >
          <button
            type="button"
            className="hover:bg-muted block w-full px-3 py-1.5 text-left"
            onClick={() => {
              selectNodeById(ctxMenu.nodeId);
              duplicateSelected();
              void forwardRendererTelemetry('canvas.context.duplicate', { nodeId: ctxMenu.nodeId });
              setCtxMenu(null);
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="hover:bg-muted block w-full px-3 py-1.5 text-left"
            onClick={() => {
              selectNodeById(ctxMenu.nodeId);
              copySelected();
              void forwardRendererTelemetry('canvas.context.copy', { nodeId: ctxMenu.nodeId });
              setCtxMenu(null);
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className="hover:bg-destructive/15 text-destructive block w-full px-3 py-1.5 text-left"
            onClick={() => {
              selectNodeById(ctxMenu.nodeId);
              deleteSelected();
              void forwardRendererTelemetry('canvas.context.delete', { nodeId: ctxMenu.nodeId });
              setCtxMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
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
