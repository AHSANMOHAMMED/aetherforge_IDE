import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';

type Bounds = { x: number; y: number; width: number; height: number };

function readBounds(el: HTMLElement): Bounds {
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(r.left),
    y: Math.round(r.top),
    width: Math.max(1, Math.round(r.width)),
    height: Math.max(1, Math.round(r.height))
  };
}

/**
 * Starts the workspace dev server (Vite or npm), then embeds it via main-process
 * `WebContentsView` using `previewAttachView` / `previewSetBounds`.
 */
export function LivePreviewPanel({ workspacePath }: { workspacePath: string | null }): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  const syncBounds = useCallback(async (): Promise<void> => {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
    const el = hostRef.current;
    if (!api?.previewSetBounds || !el) return;
    await api.previewSetBounds({ bounds: readBounds(el) });
  }, []);

  // Start/stop dev server with workspace lifecycle
  useEffect(() => {
    if (!workspacePath) {
      setPreviewUrl(null);
      setStatus('idle');
      setMessage('Open a workspace to start a live preview.');
      return;
    }

    const api = window.electronAPI;
    if (
      !api?.previewStart ||
      !api.previewAttachView ||
      !api.previewSetBounds ||
      !api.previewDetachView ||
      !api.previewStop
    ) {
      setPreviewUrl(null);
      setStatus('error');
      setMessage('Live preview is only available in the Electron app.');
      return;
    }

    let cancelled = false;
    setStatus('starting');
    setMessage('Starting dev server…');
    setPreviewUrl(null);

    void (async () => {
      const start = await api.previewStart({ workspacePath, mode: 'vite' });
      if (cancelled) return;
      if (!start.ok || !start.url) {
        setStatus('error');
        setMessage(start.error ?? 'Preview failed to start.');
        return;
      }
      setPreviewUrl(start.url);
      setStatus('running');
      setMessage(start.url);
    })();

    return () => {
      cancelled = true;
      void api.previewDetachView();
      void api.previewStop(workspacePath);
      setPreviewUrl(null);
    };
  }, [workspacePath]);

  // Attach WebContentsView + keep bounds in sync when URL and host are ready
  useLayoutEffect(() => {
    if (!previewUrl || !workspacePath) return;
    const api = window.electronAPI;
    if (!api?.previewAttachView || !api.previewSetBounds) return;

    const el = hostRef.current;
    if (!el) return;

    let cancelled = false;

    const attachOnce = async (): Promise<void> => {
      if (cancelled) return;
      await api.previewAttachView({ url: previewUrl, bounds: readBounds(el) });
    };

    void attachOnce();

    const ro = new ResizeObserver(() => {
      void syncBounds();
    });
    ro.observe(el);

    const onWin = (): void => {
      void syncBounds();
    };
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);

    return () => {
      cancelled = true;
      ro.disconnect();
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [previewUrl, workspacePath, syncBounds]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden text-slate-200">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-slate-900/70 px-3 py-2 text-xs">
        <span className="text-slate-400">Live</span>
        <span className="truncate text-cyan-200/90">{message || '—'}</span>
        {status === 'starting' ? (
          <span className="ml-auto animate-pulse text-slate-500">Starting…</span>
        ) : null}
        {status === 'running' ? (
          <button
            type="button"
            className="ml-auto rounded border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 hover:bg-white/10"
            onClick={() => void syncBounds()}
          >
            Sync bounds
          </button>
        ) : null}
      </div>
      {!workspacePath ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">{message}</div>
      ) : (
        <div
          ref={hostRef}
          className="relative min-h-[320px] flex-1 bg-[#070d1a]"
          data-testid="live-preview-host"
        >
          {status === 'error' ? (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-300">
              {message}
            </div>
          ) : (
            <p className="pointer-events-none absolute left-2 top-2 z-10 max-w-[90%] rounded bg-black/50 px-2 py-1 text-[10px] text-slate-500">
              Preview renders in the native overlay above this region. Resize the window or click &quot;Sync
              bounds&quot; if misaligned.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
