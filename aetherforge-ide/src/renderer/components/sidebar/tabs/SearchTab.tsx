import { useCallback, useState, type ReactElement } from 'react';
import { FileSearch, Loader2 } from 'lucide-react';
import { useAppStore } from '@/renderer/state/app-store';
import { hasBridgeCapability } from '@/renderer/runtime/bridge';
import type { SearchHit } from '@/common/ipc';

export function SearchTab(): ReactElement {
  const workspacePath = useAppStore((s) => s.workspacePath);
  const openFile = useAppStore((s) => s.openFile);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);

  const available = hasBridgeCapability('searchAvailable');

  const run = useCallback(async () => {
    if (!workspacePath || !query.trim() || !available) return;
    setBusy(true);
    try {
      const result = await window.electronAPI.searchInFiles({
        workspacePath,
        query: query.trim(),
        caseSensitive,
        isRegex,
        maxResults: 1000
      });
      if (result.ok) {
        setHits(result.hits);
        setTruncated(result.truncated);
      } else {
        setHits([]);
      }
    } finally {
      setBusy(false);
    }
  }, [available, caseSensitive, isRegex, query, workspacePath]);

  if (!workspacePath) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Open a workspace to search
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="border-border/40 flex flex-col gap-1 border-b p-2">
        <div className="flex items-center gap-1">
          <FileSearch size={14} className="text-muted-foreground" />
          <input
            type="search"
            placeholder="Search in files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void run();
            }}
            className="border-border/40 bg-background/60 focus-visible:outline-primary flex-1 rounded-md border px-2 py-1 text-xs focus-visible:outline focus-visible:outline-1"
          />
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-[10px]">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />{' '}
            Case
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} /> Regex
          </label>
          {busy && <Loader2 size={10} className="ml-auto animate-spin" />}
        </div>
      </div>
      <ol className="flex-1 overflow-y-auto p-1 text-xs">
        {truncated && (
          <li className="px-2 py-1 text-amber-400">Result limit reached. Refine your query for more.</li>
        )}
        {hits.map((h, i) => (
          <li key={`${h.path}:${h.line}:${i}`}>
            <button
              type="button"
              onClick={() => void openFile(h.path)}
              className="hover:bg-secondary/40 flex w-full items-start gap-2 rounded px-2 py-1 text-left"
              aria-label={`Open ${h.path} at line ${h.line}`}
            >
              <span className="text-muted-foreground w-12 shrink-0 truncate text-[10px]">
                {h.line}:{h.column}
              </span>
              <span className="min-w-0 flex-1">
                <div className="text-foreground/90 truncate">{h.preview}</div>
                <div className="text-muted-foreground truncate text-[10px]">{h.path}</div>
              </span>
            </button>
          </li>
        ))}
        {hits.length === 0 && !busy && query && (
          <li className="text-muted-foreground px-2 py-3 text-center">No results</li>
        )}
      </ol>
    </div>
  );
}
