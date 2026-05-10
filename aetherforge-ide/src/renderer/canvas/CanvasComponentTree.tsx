import { useMemo, type ReactElement } from 'react';
import { useCanvasStore } from './store';
import type { CanvasNode } from './types';

export function CanvasComponentTree(): ReactElement {
  const nodes = useCanvasStore((s) => s.nodes);
  const reparent = useCanvasStore((s) => s.reparent);
  const selectNodeById = useCanvasStore((s) => s.selectNodeById);

  const roots = useMemo(
    () => nodes.filter((n) => !n.parentId).sort((a, b) => a.id.localeCompare(b.id)),
    [nodes]
  );

  const renderSubtree = (node: CanvasNode, depth: number): ReactElement => {
    const children = nodes.filter((n) => n.parentId === node.id).sort((a, b) => a.id.localeCompare(b.id));
    const parentOptions = nodes.filter((n) => n.id !== node.id);

    return (
      <div key={node.id} className="border-b border-white/5 py-1 text-[11px]">
        <div className="flex items-center gap-2" style={{ paddingLeft: depth * 10 }}>
          <button
            type="button"
            className="truncate text-left text-cyan-100 hover:underline"
            onClick={() => selectNodeById(node.id)}
          >
            {node.data.label}
          </button>
          <span className="text-muted-foreground shrink-0">{node.data.componentType}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1" style={{ paddingLeft: depth * 10 + 4 }}>
          <span className="text-muted-foreground">Parent:</span>
          <select
            className="max-w-[140px] rounded border border-white/10 bg-slate-900 px-1 py-0.5 text-[10px]"
            value={node.parentId ?? ''}
            onChange={(e) => reparent(node.id, e.target.value || null)}
          >
            <option value="">(root)</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.data.label}
              </option>
            ))}
          </select>
        </div>
        {children.map((c) => renderSubtree(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-white/10 bg-black/30">
      <div className="border-b border-white/10 px-2 py-1 text-[11px] font-medium text-slate-200">
        Component tree
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {roots.length === 0 ? (
          <p className="text-muted-foreground px-2 py-2 text-[11px]">No nodes — drag from palette.</p>
        ) : (
          roots.map((r) => renderSubtree(r, 0))
        )}
      </div>
    </div>
  );
}
