import { type ReactElement } from 'react';
import { useActivityStore, type ActivityKind, type ActivitySeverity } from '@/renderer/state/activity-store';
import {
  AlertTriangle,
  Bot,
  Boxes,
  CheckCircle2,
  FileText,
  GitBranch,
  Hammer,
  Info,
  Terminal as TerminalIcon,
  Trash2,
  XCircle
} from 'lucide-react';

const KIND_ICON: Record<ActivityKind, ReactElement> = {
  file: <FileText size={12} />,
  git: <GitBranch size={12} />,
  ai: <Bot size={12} />,
  terminal: <TerminalIcon size={12} />,
  plugin: <Boxes size={12} />,
  build: <Hammer size={12} />,
  system: <Info size={12} />
};

const SEVERITY_ICON: Record<ActivitySeverity, ReactElement> = {
  info: <Info size={12} className="text-muted-foreground" />,
  success: <CheckCircle2 size={12} className="text-emerald-400" />,
  warning: <AlertTriangle size={12} className="text-amber-400" />,
  error: <XCircle size={12} className="text-rose-400" />
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.round(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`;
  return `${Math.round(diff / 86_400_000)}d`;
}

export function ActivityFeed(): ReactElement {
  const entries = useActivityStore((s) => s.entries);
  const clear = useActivityStore((s) => s.clear);

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="border-border/40 flex items-center justify-between border-b px-3 py-2">
        <span className="text-muted-foreground font-medium">Activity</span>
        <button
          type="button"
          onClick={clear}
          aria-label="Clear activity feed"
          disabled={entries.length === 0}
          className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground rounded p-1 disabled:opacity-30"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {entries.length === 0 && (
        <div className="text-muted-foreground/70 flex flex-1 items-center justify-center">
          No activity yet
        </div>
      )}
      <ol className="flex-1 overflow-y-auto p-1">
        {entries.map((e) => (
          <li
            key={e.id}
            className="hover:bg-secondary/30 group flex items-start gap-2 rounded-md px-2 py-1.5 transition"
          >
            <span className="mt-0.5">{SEVERITY_ICON[e.severity]}</span>
            <span className="text-muted-foreground mt-0.5">{KIND_ICON[e.kind]}</span>
            <div className="min-w-0 flex-1">
              <div className="text-foreground/90 truncate">{e.message}</div>
              {e.detail && <div className="text-muted-foreground truncate text-[10px]">{e.detail}</div>}
            </div>
            <span className="text-muted-foreground/70 text-[10px]">{relativeTime(e.timestamp)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
