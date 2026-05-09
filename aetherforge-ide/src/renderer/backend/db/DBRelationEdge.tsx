import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { ReactElement } from 'react';
import type { DBEdgeData } from './types';

function formatCardinality(value: DBEdgeData['cardinality']): string {
  return value === 'one-to-one' ? '1:1' : '1:N';
}

export function DBRelationEdge(props: EdgeProps): ReactElement {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition
  });

  const data = (props.data ?? {}) as DBEdgeData;
  const relationName = data.relationName?.trim() || 'FK';
  const cardinality = formatCardinality(data.cardinality);
  const required = Boolean(data.required);

  const stroke = required ? 'rgba(34,197,94,0.9)' : 'rgba(56,189,248,0.85)';
  const dashArray = data.cardinality === 'one-to-one' ? undefined : '5 4';

  return (
    <>
      <BaseEdge path={edgePath} style={{ stroke, strokeWidth: 2.2, strokeDasharray: dashArray }} />
      <EdgeLabelRenderer>
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded border border-white/20 bg-slate-950/90 px-2 py-1 text-[10px] font-medium text-slate-100 shadow-sm"
          style={{
            left: labelX,
            top: labelY
          }}
        >
          <span>{relationName}</span>
          <span className="mx-1 text-cyan-300">{cardinality}</span>
          {required ? <span className="text-emerald-300">req</span> : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
