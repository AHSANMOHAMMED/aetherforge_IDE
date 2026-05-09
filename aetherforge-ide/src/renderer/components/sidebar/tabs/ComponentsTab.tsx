import { Search, Plus } from 'lucide-react';
import { useState, type ReactElement } from 'react';

const COMPONENT_CATEGORIES = {
  layout: {
    name: 'Layout',
    components: ['container', 'card', 'navbar', 'modal']
  },
  forms: {
    name: 'Forms',
    components: ['button', 'input', 'select', 'checkbox', 'switch']
  },
  data: {
    name: 'Data Display',
    components: ['text', 'badge', 'alert']
  },
  navigation: {
    name: 'Navigation',
    components: ['navbar', 'button']
  },
  media: {
    name: 'Media',
    components: ['image']
  }
};

export function ComponentsTab(): ReactElement {
  const [search, setSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('layout');

  const filteredCategories = Object.entries(COMPONENT_CATEGORIES).reduce<
    Record<string, { name: string; components: string[] }>
  >((acc, [key, cat]) => {
    if (search.trim() === '') {
      acc[key] = cat;
    } else {
      const filtered = cat.components.filter((comp) => comp.toLowerCase().includes(search.toLowerCase()));
      if (filtered.length > 0) {
        acc[key] = { ...cat, components: filtered };
      }
    }
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Search */}
      <div className="border-b border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-md bg-white/5 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <input
            type="text"
            placeholder="Search components…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Components List */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(filteredCategories).map(([categoryKey, category]) => (
          <div key={categoryKey} className="border-b border-white/5">
            <button
              onClick={() => setExpandedCategory(expandedCategory === categoryKey ? null : categoryKey)}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/5"
            >
              <span className={`transition ${expandedCategory === categoryKey ? 'rotate-90' : ''}`}>▶</span>
              {category.name}
            </button>

            {expandedCategory === categoryKey && (
              <div className="bg-black/20 py-1">
                {category.components.map((comp) => (
                  <div
                    key={comp}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('application/aetherforge-component', comp);
                    }}
                    className="group mx-2 my-1 flex cursor-move items-center justify-between rounded bg-white/5 px-2 py-1.5 transition-colors hover:bg-white/10"
                  >
                    <span className="text-xs capitalize text-slate-300">{comp}</span>
                    <button className="opacity-0 transition group-hover:opacity-100">
                      <Plus className="h-3 w-3 text-cyan-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
