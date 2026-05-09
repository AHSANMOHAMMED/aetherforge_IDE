import { useMemo, type ReactElement } from 'react';
import { Brain, Code2, MessageSquare } from 'lucide-react';
import { buildTraceTree, groupStepsByWave, stepDurationMs } from './trace-tree';
import type { AgentExecutionStep, AgentRole } from './types';

const ROLE_ICON: Record<AgentRole, ReactElement> = {
  planner: <Brain className="h-3.5 w-3.5 text-cyan-300" />,
  coder: <Code2 className="h-3.5 w-3.5 text-emerald-300" />,
  reviewer: <MessageSquare className="h-3.5 w-3.5 text-amber-300" />
};

const STATUS_COLOR: Record<AgentExecutionStep['status'], string> = {
  running: 'text-cyan-200',
  completed: 'text-emerald-300',
  failed: 'text-red-300'
};

function formatDuration(ms: number | undefined): string {
  if (typeof ms !== 'number') {
    return '–';
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function StepRow({ step }: { step: AgentExecutionStep }): ReactElement {
  const duration = stepDurationMs(step);
  return (
    <div className="rounded border border-white/10 bg-slate-950/40 px-2 py-1 text-[11px]">
      <div className="flex items-center gap-2">
        {ROLE_ICON[step.role]}
        <span className="text-foreground truncate font-medium">{step.title}</span>
        <span className={`ml-auto uppercase ${STATUS_COLOR[step.status]}`}>{step.status}</span>
      </div>
      <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[10px]">
        <span>{step.role}</span>
        {step.tool ? (
          <>
            <span>•</span>
            <span className="text-foreground/80 rounded bg-white/10 px-1">{step.tool}</span>
          </>
        ) : null}
        <span>•</span>
        <span>{formatDuration(duration)}</span>
      </div>
      {step.detail ? (
        <pre className="text-foreground/80 mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-[10px]">
          {step.detail}
        </pre>
      ) : null}
    </div>
  );
}

export function AgentTraceTree({ steps }: { steps: AgentExecutionStep[] }): ReactElement | null {
  const tree = useMemo(() => buildTraceTree(steps), [steps]);
  const waveGroups = useMemo(() => groupStepsByWave(steps), [steps]);

  if (tree.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {tree.map((root, rootIdx) => {
        const reviewerSteps = root.children.filter((child) => child.step.role === 'reviewer');
        const coderSteps = root.children
          .filter((child) => child.step.role === 'coder')
          .map((child) => child.step);
        const groups = rootIdx === 0 ? waveGroups : groupStepsByWave(coderSteps);

        return (
          <div key={root.step.id} className="rounded-md border border-white/10 bg-white/5 p-2">
            <StepRow step={root.step} />
            {groups.length > 0 ? (
              <div className="mt-2 space-y-2 border-l border-white/10 pl-2">
                {groups.map((group) => (
                  <div key={group.wave} className="space-y-1">
                    <div className="text-muted-foreground text-[10px] uppercase">
                      {group.wave >= 0 ? `Wave ${group.wave + 1}` : 'Sequential'} · {group.steps.length}{' '}
                      call(s)
                    </div>
                    {group.steps.map((step) => (
                      <StepRow key={step.id} step={step} />
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
            {reviewerSteps.length > 0 ? (
              <div className="mt-2 space-y-1 border-l border-white/10 pl-2">
                {reviewerSteps.map((child) => (
                  <StepRow key={child.step.id} step={child.step} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
