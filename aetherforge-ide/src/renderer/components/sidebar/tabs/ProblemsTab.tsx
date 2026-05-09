import { type ReactElement } from 'react';
import { AlertCircle } from 'lucide-react';
import { useProblemsStore } from '@/renderer/state/problems-store';

export function ProblemsTab(): ReactElement {
  const problems = useProblemsStore((s) => s.problems);

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="border-border/40 flex items-center justify-between border-b px-3 py-2">
        <span className="text-muted-foreground font-medium">Problems</span>
        <span className="text-muted-foreground text-xs">{problems.length}</span>
      </div>
      <ol className="flex-1 overflow-y-auto p-1 text-xs">
        {problems.length === 0 && (
          <li className="text-muted-foreground flex items-center justify-center gap-1 py-4">
            <AlertCircle size={12} /> No problems detected
          </li>
        )}
        {problems.map((p) => (
          <li key={p.id} className="hover:bg-secondary/30 flex items-start gap-2 rounded px-2 py-1.5">
            <AlertCircle
              size={12}
              className={
                p.severity === 'error'
                  ? 'mt-0.5 text-rose-400'
                  : p.severity === 'warning'
                    ? 'mt-0.5 text-amber-400'
                    : 'mt-0.5 text-cyan-400'
              }
            />
            <div className="min-w-0 flex-1">
              <div className="text-foreground/90 truncate">{p.message}</div>
              <div className="text-muted-foreground truncate text-[10px]">
                {p.file}:{p.line}:{p.column} ({p.source ?? 'aetherforge'})
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
