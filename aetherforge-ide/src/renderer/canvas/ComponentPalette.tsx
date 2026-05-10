import { useEffect, useMemo, useState, type DragEvent, type MouseEvent, type ReactElement } from 'react';
import { ChevronDown, ChevronRight, Clock, Plus, Search } from 'lucide-react';
import { CANVAS_PALETTE, isSupportedFor, type CanvasPaletteItem } from './library';
import type { CanvasComponentType } from './types';
import { useCanvasStore } from './store';
import { useAppStore } from '@/renderer/state/app-store';
import { renderPalettePreview } from './PalettePreview';
import type { CodegenTarget } from './codegen/index';

type Category = {
  id: CanvasPaletteItem['category'];
  name: string;
};

const CATEGORY_ORDER: readonly Category[] = [
  { id: 'mobile', name: 'Mobile' },
  { id: 'layout', name: 'Layout' },
  { id: 'forms', name: 'Forms' },
  { id: 'data', name: 'Data Display' },
  { id: 'navigation', name: 'Navigation' },
  { id: 'media', name: 'Media' }
];

const TARGET_BADGE: Record<CodegenTarget, string> = {
  react: 'React',
  'react-native': 'iOS',
  flutter: 'Material',
  'android-xml': 'Material 3'
};

const RECENTS_KEY = 'aetherforge.canvas.palette.recents';
const RECENTS_MAX = 6;

function loadRecents(): CanvasComponentType[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter((v): v is CanvasComponentType => typeof v === 'string');
    return valid.slice(0, RECENTS_MAX);
  } catch {
    return [];
  }
}

function persistRecents(values: CanvasComponentType[]): void {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(values.slice(0, RECENTS_MAX)));
  } catch {
    // ignore storage failures
  }
}

export type ComponentPaletteProps = {
  /** Show category accordions and search box. Defaults to `true`. */
  showCategories?: boolean;
  /** Show "Recent" section above categories. Defaults to `true`. */
  showRecent?: boolean;
};

export function ComponentPalette(props: ComponentPaletteProps = {}): ReactElement {
  const showCategories = props.showCategories ?? true;
  const showRecent = props.showRecent ?? true;

  const codegenTarget = useCanvasStore((s) => s.codegenTarget);
  const addNodeFromPalette = useCanvasStore((s) => s.addNodeFromPalette);
  const ensureCanvasTab = useAppStore((s) => s.ensureCanvasTab);
  const setMode = useAppStore((s) => s.setMode);
  const currentMode = useAppStore((s) => s.mode);

  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [recents, setRecents] = useState<CanvasComponentType[]>(() => loadRecents());

  useEffect(() => {
    persistRecents(recents);
  }, [recents]);

  const recordRecent = (type: CanvasComponentType): void => {
    setRecents((prev) => [type, ...prev.filter((t) => t !== type)].slice(0, RECENTS_MAX));
  };

  const onDragStart = (event: DragEvent<HTMLElement>, item: CanvasPaletteItem): void => {
    if (!isSupportedFor(item, codegenTarget)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('application/aetherforge-component', item.type);
    event.dataTransfer.effectAllowed = 'move';
    recordRecent(item.type);
  };

  const quickAdd = (event: MouseEvent, item: CanvasPaletteItem): void => {
    event.stopPropagation();
    if (!isSupportedFor(item, codegenTarget)) {
      return;
    }
    if (currentMode !== 'visual' && currentMode !== 'split') {
      ensureCanvasTab();
      setMode('visual');
    }
    const x = 80 + Math.random() * 160;
    const y = 80 + Math.random() * 160;
    addNodeFromPalette(item.type, { x, y });
    recordRecent(item.type);
  };

  const filteredByCategory = useMemo(() => {
    const q = search.trim().toLowerCase();
    const groups = new Map<string, CanvasPaletteItem[]>();
    for (const cat of CATEGORY_ORDER) groups.set(cat.id, []);
    for (const item of CANVAS_PALETTE) {
      if (
        q &&
        !item.label.toLowerCase().includes(q) &&
        !item.type.toLowerCase().includes(q) &&
        !item.description.toLowerCase().includes(q)
      ) {
        continue;
      }
      const list = groups.get(item.category);
      if (list) list.push(item);
    }
    return CATEGORY_ORDER.filter((c) => (groups.get(c.id) ?? []).length > 0).map((c) => ({
      ...c,
      items: groups.get(c.id) ?? []
    }));
  }, [search]);

  const recentItems = useMemo(
    () =>
      recents.map((t) => CANVAS_PALETTE.find((it) => it.type === t)).filter(Boolean) as CanvasPaletteItem[],
    [recents]
  );

  const recentVisible = showRecent && recentItems.length > 0 && !search.trim();

  const renderTile = (item: CanvasPaletteItem): ReactElement => {
    const supported = isSupportedFor(item, codegenTarget);
    return (
      <div
        key={`tile-${item.type}`}
        draggable={supported}
        onDragStart={(e) => onDragStart(e, item)}
        title={`${item.label} — ${item.description}${supported ? '' : ' (not available on ' + codegenTarget + ')'}`}
        role="button"
        tabIndex={0}
        aria-disabled={!supported}
        className={`group relative flex flex-col overflow-hidden rounded-md border border-white/10 bg-black/30 transition ${
          supported ? 'hover:border-cyan-400/40' : 'cursor-not-allowed opacity-50 grayscale'
        }`}
      >
        <div className="border-b border-white/5">{renderPalettePreview(item.type, codegenTarget)}</div>
        <div className="flex items-center gap-1 px-1.5 py-1">
          <span className="text-foreground truncate text-[11px]" title={item.label}>
            {item.label}
          </span>
          <button
            type="button"
            aria-label={`Add ${item.label} to canvas`}
            title={`Add ${item.label} to canvas`}
            disabled={!supported}
            onClick={(e: MouseEvent) => quickAdd(e, item)}
            className="text-muted-foreground/60 ml-auto rounded p-0.5 opacity-0 transition hover:bg-cyan-500/20 hover:text-cyan-200 focus:opacity-100 disabled:hover:bg-transparent group-hover:opacity-100"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {!supported && (
          <span className="absolute right-1 top-1 rounded bg-amber-500/30 px-1 text-[8px] font-semibold text-amber-100">
            N/A
          </span>
        )}
      </div>
    );
  };

  return (
    <aside className="flex h-full min-h-0 flex-col bg-black/20" aria-label="Component palette">
      <div className="border-b border-white/10 p-2">
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1">
          <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search components…"
            aria-label="Search components"
            className="text-foreground placeholder:text-muted-foreground/60 min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </div>
        <p className="text-muted-foreground/70 mt-1.5 px-1 text-[10px]">
          Theme: <span className="font-medium text-cyan-200/90">{TARGET_BADGE[codegenTarget]}</span>{' '}
          <span className="opacity-60">· previews update with target</span>
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {recentVisible ? (
          <section className="mb-3">
            <p className="text-muted-foreground mb-1 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide">
              <Clock className="h-3 w-3" /> Recent
            </p>
            <div className="grid grid-cols-2 gap-2">{recentItems.map((it) => renderTile(it))}</div>
          </section>
        ) : null}

        {!showCategories ? (
          <div className="grid grid-cols-2 gap-2">{CANVAS_PALETTE.map((item) => renderTile(item))}</div>
        ) : (
          filteredByCategory.map((cat) => {
            const isCollapsed = collapsed[cat.id] ?? false;
            return (
              <section key={cat.id} className="mb-3">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 rounded px-1 py-1 text-[10px] font-semibold uppercase tracking-wide"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [cat.id]: !(prev[cat.id] ?? false) }))}
                  aria-expanded={!isCollapsed}
                  aria-controls={`palette-cat-${cat.id}`}
                >
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {cat.name}
                  <span className="text-muted-foreground/50 ml-auto text-[10px] normal-case">
                    {cat.items.length}
                  </span>
                </button>
                {!isCollapsed ? (
                  <div id={`palette-cat-${cat.id}`} className="mt-1 grid grid-cols-2 gap-2">
                    {cat.items.map((it) => renderTile(it))}
                  </div>
                ) : null}
              </section>
            );
          })
        )}

        {showCategories && filteredByCategory.length === 0 ? (
          <p className="text-muted-foreground px-1 py-2 text-xs">No components match “{search}”.</p>
        ) : null}
      </div>
    </aside>
  );
}
