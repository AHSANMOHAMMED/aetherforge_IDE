import { lazy, Suspense, useMemo, type ReactElement } from 'react';
import {
  AlertCircle,
  Bot,
  Bug,
  FileSearch,
  Folder,
  GitBranch,
  Layout,
  Palette,
  Plug,
  Puzzle,
  Receipt
} from 'lucide-react';
import { SIDEBAR_TABS, type SidebarTab } from './types';
import { ExplorerTab } from './tabs/ExplorerTab';
import { ComponentsTab } from './tabs/ComponentsTab';
import { PagesTab } from './tabs/PagesTab';
import { StylesTab } from './tabs/StylesTab';
import { AITab } from './tabs/AITab';
import { AICostTab } from './tabs/AICostTab';
import { ExtensionsTab } from './tabs/ExtensionsTab';

const SearchTab = lazy(() => import('./tabs/SearchTab').then((m) => ({ default: m.SearchTab })));
const GitTab = lazy(() => import('./tabs/GitTab').then((m) => ({ default: m.GitTab })));
const ProblemsTab = lazy(() => import('./tabs/ProblemsTab').then((m) => ({ default: m.ProblemsTab })));
const DebugPanel = lazy(() => import('@/renderer/debug/DebugPanel').then((m) => ({ default: m.DebugPanel })));

const ICONS: Record<SidebarTab, ReactElement> = {
  explorer: <Folder size={16} />,
  search: <FileSearch size={16} />,
  git: <GitBranch size={16} />,
  components: <Puzzle size={16} />,
  pages: <Layout size={16} />,
  styles: <Palette size={16} />,
  ai: <Bot size={16} />,
  'ai-cost': <Receipt size={16} />,
  extensions: <Plug size={16} />,
  problems: <AlertCircle size={16} />,
  debug: <Bug size={16} />
};

export type SidebarLayoutProps = {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
};

const Fallback = () => (
  <div className="text-muted-foreground flex h-full items-center justify-center text-xs">Loading…</div>
);

export function SidebarLayout(props: SidebarLayoutProps): ReactElement {
  const content = useMemo(() => {
    switch (props.activeTab) {
      case 'explorer':
        return <ExplorerTab />;
      case 'search':
        return (
          <Suspense fallback={<Fallback />}>
            <SearchTab />
          </Suspense>
        );
      case 'git':
        return (
          <Suspense fallback={<Fallback />}>
            <GitTab />
          </Suspense>
        );
      case 'components':
        return <ComponentsTab />;
      case 'pages':
        return <PagesTab />;
      case 'styles':
        return <StylesTab />;
      case 'ai':
        return <AITab />;
      case 'ai-cost':
        return <AICostTab />;
      case 'extensions':
        return <ExtensionsTab />;
      case 'problems':
        return (
          <Suspense fallback={<Fallback />}>
            <ProblemsTab />
          </Suspense>
        );
      case 'debug':
        return (
          <Suspense fallback={<Fallback />}>
            <DebugPanel />
          </Suspense>
        );
      default:
        return <ExplorerTab />;
    }
  }, [props.activeTab]);

  return (
    <div className="flex h-full flex-col">
      <nav className="border-border/40 flex items-center gap-0 border-b" role="tablist" aria-label="Sidebar">
        {SIDEBAR_TABS.map((tab) => {
          const active = tab.id === props.activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`sidebar-panel-${tab.id}`}
              onClick={() => props.onTabChange(tab.id)}
              title={tab.label}
              className={`text-muted-foreground hover:text-foreground relative flex flex-1 items-center justify-center py-2 transition ${
                active ? 'text-foreground' : ''
              }`}
            >
              {ICONS[tab.id]}
              {active && (
                <span className="bg-primary absolute -bottom-px left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full" />
              )}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="bg-destructive text-destructive-foreground absolute right-1 top-1 flex h-3 min-w-3 items-center justify-center rounded-full px-1 text-[8px] font-semibold">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div role="tabpanel" id={`sidebar-panel-${props.activeTab}`} className="min-h-0 flex-1 overflow-hidden">
        {content}
      </div>
    </div>
  );
}
