import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { Plus, Trash2, X } from 'lucide-react';
import { useAppStore } from '@/renderer/state/app-store';
import { useSettingsStore } from '@/renderer/state/settings-store';
import { logActivity } from '@/renderer/state/activity-store';
import { hasBridgeCapability } from '@/renderer/runtime/bridge';

type TerminalSession = {
  id: string;
  name: string;
  pid: number;
  shell: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  containerEl: HTMLDivElement;
};

const THEME = {
  background: '#05070d',
  foreground: '#c8d2e3',
  cursor: '#06b6d4',
  selectionBackground: '#06b6d430',
  black: '#0d1117',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#6272a4',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#44475a',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff'
};

export function TerminalPanel(): ReactElement {
  const workspacePath = useAppStore((s) => s.workspacePath);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sessionsRef = useRef<Map<string, TerminalSession>>(new Map());
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const ptyAvailable = hasBridgeCapability('ptyAvailable');

  const createSession = useCallback(async () => {
    if (!hostRef.current) return;
    if (!ptyAvailable) {
      logActivity('terminal', 'PTY backend unavailable in this build', { severity: 'warning' });
      return;
    }
    const result = await window.electronAPI.terminalCreate({
      cwd: workspacePath ?? undefined,
      cols: 100,
      rows: 30
    });
    if (!result.ok || !result.id) {
      logActivity('terminal', 'Could not start terminal', { severity: 'error', detail: result.error });
      return;
    }

    const containerEl = document.createElement('div');
    containerEl.style.height = '100%';
    containerEl.style.width = '100%';
    containerEl.dataset.aetherforgeTerminal = 'true';
    hostRef.current.appendChild(containerEl);

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily,
      theme: THEME,
      allowProposedApi: true,
      scrollback: 5000
    });
    const fitAddon = new FitAddon();
    const webLinks = new WebLinksAddon();
    const search = new SearchAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinks);
    terminal.loadAddon(search);
    terminal.open(containerEl);
    fitAddon.fit();

    terminal.onData((data) => {
      void window.electronAPI.terminalWrite({ id: result.id!, data });
    });
    terminal.onResize(({ cols, rows }) => {
      void window.electronAPI.terminalResize({ id: result.id!, cols, rows });
    });

    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    });
    observer.observe(containerEl);

    const session: TerminalSession = {
      id: result.id!,
      name: `${result.shell?.split('/').pop() ?? 'shell'} ${sessionsRef.current.size + 1}`,
      pid: result.pid ?? -1,
      shell: result.shell ?? '',
      terminal,
      fitAddon,
      containerEl
    };
    sessionsRef.current.set(session.id, session);
    setSessions(Array.from(sessionsRef.current.values()).map((s) => ({ id: s.id, name: s.name })));
    setActiveId(session.id);
    logActivity('terminal', `Started ${session.name} (pid ${session.pid})`, { severity: 'success' });
  }, [fontFamily, fontSize, ptyAvailable, workspacePath]);

  const disposeSession = useCallback((id: string) => {
    const s = sessionsRef.current.get(id);
    if (!s) return;
    void window.electronAPI.terminalDispose({ id });
    s.terminal.dispose();
    s.containerEl.remove();
    sessionsRef.current.delete(id);
    setSessions(Array.from(sessionsRef.current.values()).map((x) => ({ id: x.id, name: x.name })));
    setActiveId((cur) => (cur === id ? (sessionsRef.current.keys().next().value ?? null) : cur));
  }, []);

  // Bind data + exit listeners once
  useEffect(() => {
    if (!ptyAvailable) return;
    const offData = window.electronAPI.onTerminalData(({ id, chunk }) => {
      const s = sessionsRef.current.get(id);
      s?.terminal.write(chunk);
    });
    const offExit = window.electronAPI.onTerminalExit(({ id, exitCode }) => {
      const s = sessionsRef.current.get(id);
      s?.terminal.writeln(`\r\n\x1b[2mProcess exited with code ${exitCode}\x1b[0m`);
      sessionsRef.current.delete(id);
      setSessions(Array.from(sessionsRef.current.values()).map((x) => ({ id: x.id, name: x.name })));
      setActiveId((cur) => (cur === id ? (sessionsRef.current.keys().next().value ?? null) : cur));
    });
    return () => {
      offData();
      offExit();
    };
  }, [ptyAvailable]);

  // Auto-create initial session when host appears
  useEffect(() => {
    if (sessions.length === 0 && hostRef.current && ptyAvailable) {
      void createSession();
    }
  }, [createSession, ptyAvailable, sessions.length]);

  // Toggle which terminal is visible
  useEffect(() => {
    for (const s of sessionsRef.current.values()) {
      s.containerEl.style.display = s.id === activeId ? 'block' : 'none';
      if (s.id === activeId) {
        try {
          s.fitAddon.fit();
          s.terminal.focus();
        } catch {
          // ignore
        }
      }
    }
  }, [activeId]);

  // Cleanup all on unmount
  useEffect(() => {
    const map = sessionsRef.current;
    return () => {
      const snapshot = Array.from(map.values());
      for (const s of snapshot) {
        void window.electronAPI?.terminalDispose({ id: s.id });
        s.terminal.dispose();
      }
      map.clear();
    };
  }, []);

  return (
    <div className="border-border/40 bg-card/40 flex h-full w-full flex-col rounded-xl border">
      <div className="border-border/30 flex items-center gap-1 border-b px-2 py-1">
        {sessions.map((s) => (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => setActiveId(s.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setActiveId(s.id);
            }}
            className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs ${
              s.id === activeId
                ? 'bg-primary/20 text-foreground'
                : 'text-muted-foreground hover:bg-secondary/40'
            }`}
            aria-label={`Terminal ${s.name}`}
          >
            <span>{s.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                disposeSession(s.id);
              }}
              aria-label={`Close ${s.name}`}
              className="ml-1 rounded p-0.5 opacity-60 hover:opacity-100"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={createSession}
          aria-label="New terminal"
          className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground ml-1 rounded p-1"
        >
          <Plus size={14} />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const s = activeId ? sessionsRef.current.get(activeId) : null;
              s?.terminal.clear();
            }}
            aria-label="Clear terminal"
            className="text-muted-foreground hover:bg-secondary/40 hover:text-foreground rounded p-1"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div ref={hostRef} className="relative h-full w-full p-2" />
      {!ptyAvailable && (
        <div className="bg-background/80 text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
          Terminal requires the desktop runtime.
        </div>
      )}
    </div>
  );
}
