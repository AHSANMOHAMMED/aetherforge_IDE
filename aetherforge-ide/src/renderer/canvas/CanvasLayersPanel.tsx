import type { ReactElement } from 'react';
import { Eye, EyeOff, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { useCanvasStore } from './store';

export function CanvasLayersPanel(): ReactElement {
  const nodes = useCanvasStore((state) => state.nodes);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);

  const selectNode = (id: string): void => {
    // Toggle selection by updating node
    useCanvasStore.setState((state) => ({
      nodes: state.nodes.map((n) => ({
        ...n,
        selected: n.id === id
      })),
      selectedNodeIds: [id]
    }));
  };

  const bringForward = (id: string): void => {
    useCanvasStore.setState((state) => {
      const idx = state.nodes.findIndex((n) => n.id === id);
      if (idx === -1 || idx === state.nodes.length - 1) return state;
      const next = [...state.nodes];
      [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
      return { nodes: next };
    });
  };

  const sendBackward = (id: string): void => {
    useCanvasStore.setState((state) => {
      const idx = state.nodes.findIndex((n) => n.id === id);
      if (idx <= 0) return state;
      const next = [...state.nodes];
      [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
      return { nodes: next };
    });
  };

  const toggleHidden = (id: string): void => {
    useCanvasStore.setState((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, hidden: !n.hidden } : n))
    }));
  };

  // Show in reverse order (top layer first)
  const reversedNodes = [...nodes].reverse();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
        <Layers className="text-muted-foreground h-3.5 w-3.5" />
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Layers</span>
        <span className="text-muted-foreground ml-auto text-xs">{nodes.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-1 py-1">
        {reversedNodes.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-center text-xs">
            No layers yet.
            <br />
            Add components to the canvas.
          </p>
        ) : (
          reversedNodes.map((node) => {
            const isSelected = selectedNodeIds.includes(node.id);
            const isHidden = !!node.hidden;
            return (
              <div
                key={node.id}
                className={`group mb-0.5 flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition ${
                  isSelected
                    ? 'border border-cyan-400/25 bg-cyan-500/15 text-cyan-100'
                    : 'text-foreground/80 border border-transparent hover:bg-white/5'
                } ${isHidden ? 'opacity-40' : ''}`}
                onClick={() => selectNode(node.id)}
              >
                {/* Type indicator dot */}
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: typeColor(node.data.componentType) }}
                />

                {/* Layer name */}
                <span className="min-w-0 flex-1 truncate">{node.data.label}</span>
                <span className="text-muted-foreground/50 shrink-0">{node.data.componentType}</span>

                {/* Controls */}
                <div className="ml-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-white/10"
                    title="Bring Forward"
                    onClick={(e) => {
                      e.stopPropagation();
                      bringForward(node.id);
                    }}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-white/10"
                    title="Send Backward"
                    onClick={(e) => {
                      e.stopPropagation();
                      sendBackward(node.id);
                    }}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-white/10"
                    title={isHidden ? 'Show' : 'Hide'}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHidden(node.id);
                    }}
                  >
                    {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function typeColor(type: string): string {
  const colors: Record<string, string> = {
    button: '#06b6d4',
    container: '#6366f1',
    text: '#f59e0b',
    image: '#10b981',
    card: '#8b5cf6',
    input: '#3b82f6',
    select: '#ec4899',
    checkbox: '#14b8a6',
    switch: '#f97316',
    badge: '#84cc16',
    alert: '#ef4444',
    modal: '#a78bfa',
    navbar: '#0ea5e9'
  };
  return colors[type] ?? '#64748b';
}
