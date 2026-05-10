export type SidebarTab =
  | 'explorer'
  | 'search'
  | 'git'
  | 'components'
  | 'pages'
  | 'styles'
  | 'ai'
  | 'ai-cost'
  | 'extensions'
  | 'problems'
  | 'debug';

export type SidebarTabDefinition = {
  id: SidebarTab;
  label: string;
  icon: string;
  badge?: number;
};

export const SIDEBAR_TABS: SidebarTabDefinition[] = [
  { id: 'explorer', label: 'Explorer', icon: '📁' },
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'git', label: 'Source Control', icon: '🌿' },
  { id: 'components', label: 'Components', icon: '🧩' },
  { id: 'pages', label: 'Pages', icon: '📄' },
  { id: 'styles', label: 'Styles', icon: '🎨' },
  { id: 'ai', label: 'AI', icon: '🤖' },
  { id: 'ai-cost', label: 'AI Cost', icon: '💹' },
  { id: 'extensions', label: 'Extensions', icon: '🔌' },
  { id: 'problems', label: 'Problems', icon: '⚠️' },
  { id: 'debug', label: 'Run & Debug', icon: '🐞' }
];
