import { useState } from 'react';
import { useAppStore } from '../state/app-store';
import { useCanvasStore } from '../canvas/store';
import type { CanvasNode } from '../canvas/types';
import { LivePreviewPanel } from './LivePreviewPanel';

type DevicePreset = { label: string; width: number; height: number };

const DEVICE_PRESETS: DevicePreset[] = [
  { label: 'Phone', width: 375, height: 812 },
  { label: 'Tablet', width: 768, height: 1024 },
  { label: 'Desktop', width: 1280, height: 800 }
];

function nodeBackgroundColor(type: string): string {
  switch (type) {
    case 'button':
      return '#0e7490';
    case 'card':
      return '#1e293b';
    case 'image':
      return '#374151';
    default:
      return 'transparent';
  }
}

function nodeTextColor(type: string): string {
  switch (type) {
    case 'button':
      return '#fff';
    case 'card':
    case 'text':
      return '#f1f5f9';
    default:
      return '#94a3b8';
  }
}

function renderNode(node: CanvasNode, onClick: (id: string) => void, inspected: string | null) {
  const { componentType, label, props } = node.data;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: node.position.x,
    top: node.position.y,
    width: props.width ?? (componentType === 'image' ? 120 : componentType === 'button' ? 100 : undefined),
    height: props.height ?? (componentType === 'image' ? 80 : undefined),
    backgroundColor: props.backgroundColor ?? nodeBackgroundColor(componentType),
    padding: props.padding ?? (componentType !== 'text' ? 8 : undefined),
    color: nodeTextColor(componentType),
    fontSize: 13,
    borderRadius: componentType === 'card' || componentType === 'button' ? 6 : 0,
    border:
      inspected === node.id
        ? '2px solid #06b6d4'
        : componentType === 'card'
          ? '1px solid rgba(148,163,184,0.2)'
          : 'none',
    cursor: 'pointer',
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48
  };

  return (
    <div
      key={node.id}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node.id);
      }}
    >
      {componentType === 'image' ? (
        props.src ? (
          <img src={props.src} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: '#64748b', fontSize: 11 }}>[image]</span>
        )
      ) : (
        <span>{props.text ?? label}</span>
      )}
    </div>
  );
}

export default function WebPreviewPanel() {
  const nodes = useCanvasStore((s) => s.nodes);
  const workspacePath = useAppStore((s) => s.workspacePath);
  const [surface, setSurface] = useState<'canvas' | 'live' | 'split'>('canvas');
  const [device, setDevice] = useState<DevicePreset>(DEVICE_PRESETS[2]!);
  const [inspected, setInspected] = useState<string | null>(null);

  const inspectedNode = nodes.find((n) => n.id === inspected);

  const canvasStage = (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-[#070d1a] p-4 sm:p-8">
      <div
        style={{ width: device.width, height: device.height }}
        className="relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0B1220] shadow-2xl"
        onClick={() => setInspected(null)}
      >
        {nodes.map((node) => renderNode(node, setInspected, inspected))}
        {nodes.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Add components on the canvas to preview them here.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 overflow-hidden text-slate-200">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-slate-900/70 px-4 py-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setSurface('canvas')}
              className={`rounded px-3 py-1 text-xs ${surface === 'canvas' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:bg-white/10'}`}
            >
              Canvas
            </button>
            <button
              type="button"
              onClick={() => setSurface('live')}
              className={`rounded px-3 py-1 text-xs ${surface === 'live' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:bg-white/10'}`}
            >
              Live app
            </button>
            <button
              type="button"
              onClick={() => setSurface('split')}
              className={`rounded px-3 py-1 text-xs ${surface === 'split' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:bg-white/10'}`}
            >
              Side by side
            </button>
          </div>
          {surface === 'canvas' || surface === 'split' ? (
            <>
              <span className="mx-1 hidden h-4 w-px bg-white/10 sm:inline" aria-hidden />
              <span className="text-xs text-slate-400">Device</span>
              {DEVICE_PRESETS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setDevice(d)}
                  className={`rounded px-3 py-1 text-xs transition-colors ${
                    device.label === d.label
                      ? 'border border-cyan-500/40 bg-cyan-500/20 text-cyan-300'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {d.label} ({d.width}×{d.height})
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-500">
                {nodes.length} element{nodes.length !== 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <span className="ml-auto text-xs text-slate-500">Vite / npm dev server</span>
          )}
        </div>

        {surface === 'live' ? (
          <div className="min-h-0 flex-1">
            <LivePreviewPanel workspacePath={workspacePath} />
          </div>
        ) : surface === 'split' ? (
          <div className="flex min-h-0 flex-1 flex-row gap-0">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-white/10">{canvasStage}</div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <LivePreviewPanel workspacePath={workspacePath} />
            </div>
          </div>
        ) : (
          canvasStage
        )}
      </div>

      {surface === 'canvas' ? (
        <div className="flex w-64 shrink-0 flex-col border-l border-white/10 bg-slate-900/80">
          <div className="border-b border-white/10 px-4 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Inspector</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-xs text-slate-300">
            {inspectedNode ? (
              <div className="flex flex-col gap-3">
                <div>
                  <span className="text-slate-500">ID</span>
                  <p className="mt-0.5 break-all font-mono text-cyan-300">{inspectedNode.id}</p>
                </div>
                <div>
                  <span className="text-slate-500">Type</span>
                  <p className="mt-0.5 font-medium text-slate-200">{inspectedNode.data.componentType}</p>
                </div>
                <div>
                  <span className="text-slate-500">Label</span>
                  <p className="mt-0.5">{inspectedNode.data.label}</p>
                </div>
                <div>
                  <span className="text-slate-500">Position</span>
                  <p className="mt-0.5">
                    x: {Math.round(inspectedNode.position.x)}, y: {Math.round(inspectedNode.position.y)}
                  </p>
                </div>
                {Object.entries(inspectedNode.data.props).map(
                  ([k, v]) =>
                    v !== undefined && (
                      <div key={k}>
                        <span className="text-slate-500">{k}</span>
                        <p className="mt-0.5 break-all">{String(v)}</p>
                      </div>
                    )
                )}
              </div>
            ) : (
              <p className="text-slate-500">Click an element to inspect it.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
