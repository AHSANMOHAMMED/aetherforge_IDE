import { useEffect, useMemo, useRef, type DragEvent, type ReactElement } from 'react';
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from '@/renderer/state/app-store';
import { useToastStore } from '@/renderer/state/toast-store';
import { APIComponentPalette } from './APIComponentPalette';
import { APIToolbar } from './APIToolbar';
import { useApiStore } from './store';
import {
  API_OPENAPI_VIRTUAL_NAME,
  API_OPENAPI_VIRTUAL_PATH,
  API_VIRTUAL_NAME,
  API_VIRTUAL_PATH,
  generateApiCode,
  generateOpenApi,
  parseApiCode,
  validateApiNodes
} from './sync';
import type { APIComponentType } from './types';

function APICanvasInner(): ReactElement {
  const reactFlow = useReactFlow();

  const nodes = useApiStore((state) => state.nodes);
  const edges = useApiStore((state) => state.edges);
  const onNodesChange = useApiStore((state) => state.onNodesChange);
  const onEdgesChange = useApiStore((state) => state.onEdgesChange);
  const onConnect = useApiStore((state) => state.onConnect);
  const addNodeFromPalette = useApiStore((state) => state.addNodeFromPalette);
  const setNodesFromSerialized = useApiStore((state) => state.setNodesFromSerialized);

  const ensureApiTabs = useAppStore((state) => state.ensureApiTabs);
  const upsertVirtualTabContent = useAppStore((state) => state.upsertVirtualTabContent);
  const openTabs = useAppStore((state) => state.openTabs);
  const pushToast = useToastStore((state) => state.pushToast);

  const apiTab = openTabs.find((tab) => tab.path === API_VIRTUAL_PATH) ?? null;
  const lastGeneratedCode = useRef('');
  const lastValidationSignature = useRef('');

  const fitViewOptions = useMemo(() => ({ padding: 0.15 }), []);

  useEffect(() => {
    ensureApiTabs();
  }, [ensureApiTabs]);

  useEffect(() => {
    const validation = validateApiNodes(nodes);
    const signature = `${validation.errors.join('|')}::${validation.warnings.join('|')}`;

    if (signature !== lastValidationSignature.current && signature.trim().length > 0) {
      lastValidationSignature.current = signature;
      const lines = [...validation.errors, ...validation.warnings].slice(0, 3);
      pushToast({
        level: validation.errors.length > 0 ? 'error' : 'info',
        title: validation.errors.length > 0 ? 'API validation issues detected' : 'API validation warnings',
        description: lines.join(' | '),
        durationMs: validation.errors.length > 0 ? 3600 : 2600
      });
    } else if (signature !== lastValidationSignature.current) {
      lastValidationSignature.current = signature;
    }

    if (validation.errors.length > 0) {
      return;
    }

    const apiCode = generateApiCode(nodes);
    const openapiCode = generateOpenApi(nodes);
    if (apiCode === lastGeneratedCode.current) {
      return;
    }

    lastGeneratedCode.current = apiCode;
    upsertVirtualTabContent(API_VIRTUAL_PATH, API_VIRTUAL_NAME, apiCode);
    upsertVirtualTabContent(API_OPENAPI_VIRTUAL_PATH, API_OPENAPI_VIRTUAL_NAME, openapiCode);
  }, [nodes, pushToast, upsertVirtualTabContent]);

  useEffect(() => {
    if (!apiTab) {
      return;
    }

    if (apiTab.content === lastGeneratedCode.current) {
      return;
    }

    const parsed = parseApiCode(apiTab.content);
    if (!parsed) {
      return;
    }

    setNodesFromSerialized(parsed);
  }, [apiTab, setNodesFromSerialized]);

  const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const componentType = event.dataTransfer.getData(
      'application/aetherforge-api-component'
    ) as APIComponentType;
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
      <APIToolbar />
      <div className="flex h-full min-h-0" onDragOver={onDragOver} onDrop={onDrop}>
        <APIComponentPalette />

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
      </div>
    </div>
  );
}

export function APICanvasPanel(): ReactElement {
  return (
    <ReactFlowProvider>
      <APICanvasInner />
    </ReactFlowProvider>
  );
}
