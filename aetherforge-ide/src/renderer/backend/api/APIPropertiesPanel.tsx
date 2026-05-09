import type { ChangeEvent, ReactElement } from 'react';
import { useApiStore } from './store';
import type { APIHttpMethod } from './types';

const METHODS: APIHttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function boolFromCheckbox(event: ChangeEvent<HTMLInputElement>): boolean {
  return event.target.checked;
}

export function APIPropertiesPanel(): ReactElement {
  const nodes = useApiStore((state) => state.nodes);
  const selectedNodeIds = useApiStore((state) => state.selectedNodeIds);
  const updateSelectedNode = useApiStore((state) => state.updateSelectedNode);

  const selectedNode = nodes.find((node) => node.id === selectedNodeIds[0]);

  if (!selectedNode) {
    return (
      <div className="text-muted-foreground p-3 text-sm">
        <p className="text-foreground mb-1 font-medium">API Properties</p>
        <p>Select a node on the API canvas to edit endpoint and middleware properties.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div>
        <p className="text-foreground text-sm font-semibold">API Properties</p>
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

      {selectedNode.data.componentType === 'endpoint' ? (
        <>
          <label className="text-muted-foreground text-xs">
            HTTP Method
            <select
              className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
              value={selectedNode.data.props.method ?? 'GET'}
              onChange={(event) => updateSelectedNode({ method: event.target.value as APIHttpMethod })}
            >
              {METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>

          <label className="text-muted-foreground text-xs">
            Route Path
            <input
              className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
              value={selectedNode.data.props.path ?? ''}
              onChange={(event) => updateSelectedNode({ path: event.target.value })}
              placeholder="/api/resource"
            />
          </label>

          <label className="text-muted-foreground text-xs">
            Request Model
            <input
              className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
              value={selectedNode.data.props.requestModel ?? ''}
              onChange={(event) => updateSelectedNode({ requestModel: event.target.value })}
            />
          </label>

          <label className="text-muted-foreground text-xs">
            Response Model
            <input
              className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
              value={selectedNode.data.props.responseModel ?? ''}
              onChange={(event) => updateSelectedNode({ responseModel: event.target.value })}
            />
          </label>

          <label className="text-muted-foreground inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={Boolean(selectedNode.data.props.auth)}
              onChange={(event) => updateSelectedNode({ auth: boolFromCheckbox(event) })}
            />
            Require Authorization
          </label>
        </>
      ) : (
        <label className="text-muted-foreground text-xs">
          Description
          <textarea
            className="text-foreground mt-1 min-h-[100px] w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
            value={selectedNode.data.props.description ?? ''}
            onChange={(event) => updateSelectedNode({ description: event.target.value })}
          />
        </label>
      )}
    </div>
  );
}
