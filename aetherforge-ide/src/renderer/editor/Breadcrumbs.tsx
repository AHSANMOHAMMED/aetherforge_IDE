import { ChevronRight } from 'lucide-react';
import { type ReactElement } from 'react';
import { useAppStore } from '@/renderer/state/app-store';

function relativeSegments(filePath: string, workspacePath: string | null): string[] {
  const norm = filePath.replace(/\\/g, '/');
  const base = workspacePath ? workspacePath.replace(/\\/g, '/') : '';
  const rel = base && norm.startsWith(base) ? norm.slice(base.length + 1) : norm;
  return rel.split('/').filter(Boolean);
}

export function Breadcrumbs(): ReactElement | null {
  const activeTabId = useAppStore((s) => s.activeTabId);
  const openTabs = useAppStore((s) => s.openTabs);
  const workspacePath = useAppStore((s) => s.workspacePath);

  const tab = openTabs.find((t) => t.id === activeTabId);
  if (!tab || tab.path.startsWith('virtual://')) return null;

  const segments = relativeSegments(tab.path, workspacePath);
  return (
    <nav
      aria-label="Breadcrumbs"
      className="border-border/40 text-muted-foreground flex items-center gap-0.5 border-b px-3 py-1 text-[11px]"
    >
      {segments.map((seg, i) => (
        <span key={`${seg}-${i}`} className="flex items-center gap-0.5">
          <span className={i === segments.length - 1 ? 'text-foreground' : ''}>{seg}</span>
          {i < segments.length - 1 && <ChevronRight size={11} aria-hidden="true" />}
        </span>
      ))}
    </nav>
  );
}
