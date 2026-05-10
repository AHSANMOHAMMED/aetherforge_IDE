import { ChevronDown, ChevronRight, Clock3 } from 'lucide-react';
import { useMemo, type ReactElement } from 'react';
import { AgentTraceTree } from './AgentTraceTree';
import type { AgentRun } from './types';

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export type AIRunHistoryProps = {
  runs: AgentRun[];
  activeRunId: string | null;
  expandedRunId: string | null;
  onToggleRun: (id: string) => void;
};

export function AIRunHistory(props: AIRunHistoryProps): ReactElement {
  const activeRun = useMemo(
    () => props.runs.find((run) => run.id === props.activeRunId) ?? null,
    [props.activeRunId, props.runs]
  );

  return (
    <div className="mb-2 rounded-md border border-white/10 bg-white/5 p-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Execution history</span>
        {activeRun ? <span className="text-cyan-200">running</span> : null}
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {props.runs.slice(0, 6).map((run) => {
          const expanded = props.expandedRunId === run.id;
          return (
            <div key={run.id} className="text-foreground/90 rounded border border-white/10 px-2 py-1 text-xs">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() => props.onToggleRun(run.id)}
                aria-expanded={expanded}
              >
                <span className="flex min-w-0 items-center gap-1">
                  {expanded ? (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate">{run.prompt}</span>
                </span>
                <span className="text-muted-foreground ml-2 text-[10px] uppercase">{run.status}</span>
              </button>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                <Clock3 className="h-3 w-3" />
                <span>{formatTime(run.createdAt)}</span>
                <span>•</span>
                <span>{run.steps.length} steps</span>
                {run.usageEstimate ? (
                  <>
                    <span>•</span>
                    <span title="Token totals come from provider usage when available, otherwise rough estimates.">
                      ~
                      {run.usageEstimate.plannerInput +
                        run.usageEstimate.plannerOutput +
                        run.usageEstimate.reviewerInput +
                        run.usageEstimate.reviewerOutput}{' '}
                      tok
                      {run.usageEstimate.costUsdRough != null
                        ? ` · ~$${run.usageEstimate.costUsdRough.toFixed(4)}`
                        : ''}
                    </span>
                  </>
                ) : null}
              </div>
              {expanded ? (
                <div className="mt-2">
                  <AgentTraceTree steps={run.steps} />
                </div>
              ) : null}
            </div>
          );
        })}
        {props.runs.length === 0 ? <p className="text-muted-foreground text-[11px]">No runs yet.</p> : null}
      </div>
    </div>
  );
}
