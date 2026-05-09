import type { ReactElement } from 'react';
import { useDbStore } from './store';

const RELATION_ACTIONS = ['NoAction', 'Cascade', 'Restrict', 'SetNull', 'SetDefault'] as const;
const RELATION_CARDINALITY = ['one-to-many', 'one-to-one'] as const;

export function DBPropertiesPanel(): ReactElement {
  const nodes = useDbStore((state) => state.nodes);
  const edges = useDbStore((state) => state.edges);
  const selectedNodeIds = useDbStore((state) => state.selectedNodeIds);
  const selectedEdgeIds = useDbStore((state) => state.selectedEdgeIds);
  const updateSelectedNode = useDbStore((state) => state.updateSelectedNode);
  const updateSelectedEdge = useDbStore((state) => state.updateSelectedEdge);

  const selectedNode = nodes.find((node) => node.id === selectedNodeIds[0]);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeIds[0]);

  if (!selectedNode && selectedEdge) {
    return (
      <div className="flex h-full flex-col gap-3 p-3">
        <div>
          <p className="text-foreground text-sm font-semibold">Relation Properties</p>
          <p className="text-muted-foreground text-xs">
            {selectedEdge.source}
            {' -> '}
            {selectedEdge.target}
          </p>
        </div>

        <label className="text-muted-foreground text-xs">
          Relation Name
          <input
            className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
            value={selectedEdge.data?.relationName ?? ''}
            onChange={(event) => updateSelectedEdge({ relationName: event.target.value })}
            placeholder="user_profile"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-muted-foreground text-xs">
            Source Field
            <input
              className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
              value={selectedEdge.data?.sourceField ?? ''}
              onChange={(event) => updateSelectedEdge({ sourceField: event.target.value })}
              placeholder="id"
            />
          </label>

          <label className="text-muted-foreground text-xs">
            Target Field
            <input
              className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
              value={selectedEdge.data?.targetField ?? ''}
              onChange={(event) => updateSelectedEdge({ targetField: event.target.value })}
              placeholder="id"
            />
          </label>
        </div>

        <label className="text-muted-foreground inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={Boolean(selectedEdge.data?.required)}
            onChange={(event) => updateSelectedEdge({ required: event.target.checked })}
          />
          Required relation
        </label>

        <label className="text-muted-foreground text-xs">
          Cardinality
          <select
            className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
            value={selectedEdge.data?.cardinality ?? 'one-to-many'}
            onChange={(event) =>
              updateSelectedEdge({ cardinality: event.target.value as (typeof RELATION_CARDINALITY)[number] })
            }
          >
            {RELATION_CARDINALITY.map((cardinality) => (
              <option key={cardinality} value={cardinality}>
                {cardinality}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-muted-foreground text-xs">
            On Delete
            <select
              className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
              value={selectedEdge.data?.onDelete ?? 'NoAction'}
              onChange={(event) =>
                updateSelectedEdge({ onDelete: event.target.value as (typeof RELATION_ACTIONS)[number] })
              }
            >
              {RELATION_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>

          <label className="text-muted-foreground text-xs">
            On Update
            <select
              className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
              value={selectedEdge.data?.onUpdate ?? 'NoAction'}
              onChange={(event) =>
                updateSelectedEdge({ onUpdate: event.target.value as (typeof RELATION_ACTIONS)[number] })
              }
            >
              {RELATION_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    );
  }

  if (!selectedNode) {
    return (
      <div className="text-muted-foreground p-3 text-sm">
        <p className="text-foreground mb-1 font-medium">Database Properties</p>
        <p>Select a table or view to edit schema details.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div>
        <p className="text-foreground text-sm font-semibold">Database Properties</p>
        <p className="text-muted-foreground text-xs">
          {selectedNode.data.componentType} · {selectedNode.id}
        </p>
      </div>

      <label className="text-muted-foreground text-xs">
        Label
        <input
          className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
          value={selectedNode.data.label}
          onChange={(event) => updateSelectedNode({}, event.target.value)}
        />
      </label>

      <label className="text-muted-foreground text-xs">
        Table / View Name
        <input
          className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
          value={selectedNode.data.props.tableName ?? ''}
          onChange={(event) => updateSelectedNode({ tableName: event.target.value })}
        />
      </label>

      <label className="text-muted-foreground text-xs">
        Columns (one per line)
        <textarea
          className="text-foreground mt-1 min-h-[140px] w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
          value={selectedNode.data.props.columns ?? ''}
          onChange={(event) => updateSelectedNode({ columns: event.target.value })}
          placeholder={'id String @id\nemail String @unique'}
        />
      </label>

      <label className="text-muted-foreground text-xs">
        Primary Key
        <input
          className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
          value={selectedNode.data.props.primaryKey ?? ''}
          onChange={(event) => updateSelectedNode({ primaryKey: event.target.value })}
          placeholder="id"
        />
      </label>
    </div>
  );
}
