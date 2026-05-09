import { Plus, Trash2, Eye } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { usePagesStore } from '@/renderer/state/pages-store';

export function PagesTab(): ReactElement {
  const pages = usePagesStore((state) => state.pages);
  const activePageId = usePagesStore((state) => state.activePageId);
  const addPageToStore = usePagesStore((state) => state.addPage);
  const removePage = usePagesStore((state) => state.removePage);
  const setActivePage = usePagesStore((state) => state.setActivePage);
  const [newPageName, setNewPageName] = useState('');

  const addPage = () => {
    if (!newPageName.trim()) {
      return;
    }
    addPageToStore(newPageName);
    setNewPageName('');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Add Page */}
      <div className="flex gap-2 border-b border-white/10 p-3">
        <input
          type="text"
          placeholder="New page…"
          value={newPageName}
          onChange={(e) => setNewPageName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPage()}
          className="flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-300 outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
        />
        <button
          onClick={addPage}
          className="rounded-md bg-cyan-500/20 px-2 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-y-auto">
        {pages.map((page) => (
          <div
            key={page.id}
            className={`group flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2 transition-colors ${
              activePageId === page.id ? 'bg-cyan-500/10' : 'hover:bg-white/5'
            }`}
          >
            <button type="button" onClick={() => setActivePage(page.id)} className="min-w-0 flex-1 text-left">
              <div className="text-xs font-medium text-slate-300">{page.name}</div>
              <div className="text-[10px] text-slate-500">{page.path}</div>
            </button>
            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                title="Preview"
                onClick={() => setActivePage(page.id)}
                className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-cyan-300"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button
                title="Delete"
                onClick={() => removePage(page.id)}
                disabled={pages.length <= 1}
                className="rounded p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {pages.length === 0 && (
          <div className="flex h-full items-center justify-center p-4 text-center">
            <div className="text-slate-400">
              <p className="text-xs">No pages yet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
