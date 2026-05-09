import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { FolderOpen, Save, TerminalSquare } from 'lucide-react';
import { ActivityFeed } from './components/feedback/ActivityFeed';
import { restoreSession, startSessionAutoSave } from './services/session-persistence';
import { logActivity } from './state/activity-store';
import { ShellLayout } from './components/layout/ShellLayout';
import { ModeSwitcher } from './components/mode/ModeSwitcher';
import { AetherForgeLogo } from './components/brand/AetherForgeLogo';
import { SidebarLayout } from './components/sidebar/SidebarLayout';
import { CommandPalette } from './components/command/CommandPalette';
import { StatusBar } from './components/status/StatusBar';
import { ModalHost } from './components/feedback/ModalHost';
import { ToastViewport } from './components/feedback/ToastViewport';
import { CodeEditorPanel } from './editor/CodeEditorPanel';
import { CanvasPropertiesPanel } from './canvas/CanvasPropertiesPanel';
import { CanvasWiringPanel } from './canvas/CanvasWiringPanel';
import { VisualCanvasPanel } from './canvas/VisualCanvasPanel';
import { APICanvasPanel } from './backend/api/APICanvasPanel';
import { APIPropertiesPanel } from './backend/api/APIPropertiesPanel';
import { DBCanvasPanel } from './backend/db/DBCanvasPanel';
import { DBPropertiesPanel } from './backend/db/DBPropertiesPanel';
import { FullStackGeneratorPanel } from './backend/FullStackGeneratorPanel';
import { TerminalPanel } from './terminal/TerminalPanel';
import { AIAgentsPanel } from './ai/AIAgentsPanel';
import { useAppStore } from './state/app-store';
import { useCanvasStore } from './canvas/store';
import { useSettingsStore } from './state/settings-store';
import { scanAndLoadPlugins } from './plugins/loader';
import { hasBridgeCapability } from './runtime/bridge';

const ExportPanel = lazy(() => import('./export/ExportPanel'));
const WebPreviewPanel = lazy(() => import('./preview/WebPreviewPanel'));
const SettingsPanel = lazy(() => import('./settings/SettingsPanel'));
const MarketplacePanel = lazy(() => import('./plugins/marketplace/MarketplacePanel'));

const LazyFallback = () => (
  <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading…</div>
);
const SPLIT_FOCUS_KEY = 'aetherforge.split.focus';
type SplitFocusMode = 'code' | 'canvas' | 'balanced';
type InspectorTabMode = 'properties' | 'wiring';
const INSPECTOR_TAB_KEY = 'aetherforge.inspector.tab';
const FOCUS_NODE_EVENT = 'aetherforge:focus-node';

function getInitialSplitFocus(): SplitFocusMode {
  try {
    const saved = localStorage.getItem(SPLIT_FOCUS_KEY);
    return saved === 'code' || saved === 'canvas' || saved === 'balanced' ? saved : 'balanced';
  } catch {
    return 'balanced';
  }
}

function getInitialInspectorTab(): InspectorTabMode {
  try {
    const saved = localStorage.getItem(INSPECTOR_TAB_KEY);
    return saved === 'wiring' || saved === 'properties' ? saved : 'properties';
  } catch {
    return 'properties';
  }
}

export default function App(): ReactElement {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const workspacePath = useAppStore((state) => state.workspacePath);
  const terminalVisible = useAppStore((state) => state.terminalVisible);
  const sidebarActiveTab = useAppStore((state) => state.sidebarActiveTab);
  const setSidebarTab = useAppStore((state) => state.setSidebarTab);
  const openWorkspaceFolder = useAppStore((state) => state.openWorkspaceFolder);
  const saveActiveTab = useAppStore((state) => state.saveActiveTab);
  const setCommandPalette = useAppStore((state) => state.setCommandPalette);
  const toggleTerminal = useAppStore((state) => state.toggleTerminal);
  const canvasUndo = useCanvasStore((s) => s.undo);
  const canvasRedo = useCanvasStore((s) => s.redo);
  const snapshotRecovery = useCanvasStore((s) => s.snapshotRecovery);
  const autoSaveEnabled = useSettingsStore((s) => s.autoSaveEnabled);
  const autoSaveIntervalMs = useSettingsStore((s) => s.autoSaveIntervalMs);
  const [pingMessage, setPingMessage] = useState('Connecting to Electron runtime...');
  const [splitFocus, setSplitFocus] = useState<SplitFocusMode>(() => getInitialSplitFocus());
  const [inspectorTab, setInspectorTab] = useState<InspectorTabMode>(() => getInitialInspectorTab());
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SPLIT_FOCUS_KEY, splitFocus);
    } catch {
      // Ignore persistence errors and keep UX functional.
    }
  }, [splitFocus]);

  useEffect(() => {
    try {
      localStorage.setItem(INSPECTOR_TAB_KEY, inspectorTab);
    } catch {
      // Ignore persistence errors and keep UX functional.
    }
  }, [inspectorTab]);

  useEffect(() => {
    const onFocusNode = (): void => {
      setInspectorTab('properties');
    };

    window.addEventListener(FOCUS_NODE_EVENT, onFocusNode);
    return () => {
      window.removeEventListener(FOCUS_NODE_EVENT, onFocusNode);
    };
  }, []);

  // Load plugins on mount
  useEffect(() => {
    if (!hasBridgeCapability('pluginAvailable')) {
      return;
    }
    void scanAndLoadPlugins();
  }, []);

  // Restore the previous session and start auto-persisting future state changes.
  useEffect(() => {
    void restoreSession()
      .then(() => logActivity('system', 'Session restored', { severity: 'info' }))
      .catch(() => {
        // Best effort
      });
    const stopAutoSave = startSessionAutoSave();
    return () => {
      stopAutoSave();
    };
  }, []);

  // Update events
  useEffect(() => {
    if (!window.electronAPI?.onUpdateEvent) return;
    return window.electronAPI.onUpdateEvent((event) => {
      switch (event.kind) {
        case 'available':
          logActivity('system', `Update available: ${event.info.version}`, { severity: 'info' });
          break;
        case 'downloaded':
          logActivity('system', `Update downloaded: ${event.info.version}. Restart to install.`, {
            severity: 'success'
          });
          break;
        case 'error':
          logActivity('system', 'Update error', { severity: 'error', detail: event.error });
          break;
        default:
          break;
      }
    });
  }, []);

  // Auto-save + crash-recovery snapshot
  useEffect(() => {
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    if (!autoSaveEnabled) return;
    autoSaveRef.current = setInterval(() => {
      void saveActiveTab();
      snapshotRecovery();
    }, autoSaveIntervalMs);
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [autoSaveEnabled, autoSaveIntervalMs, saveActiveTab, snapshotRecovery]);

  useEffect(() => {
    if (!hasBridgeCapability('pingAvailable')) {
      setPingMessage('Runtime bridge unavailable');
      return;
    }

    window.electronAPI
      .ping()
      .then((response) => {
        setPingMessage(`${response.message} at ${new Date(response.timestamp).toLocaleTimeString()}`);
      })
      .catch(() => {
        setPingMessage('Runtime bridge unavailable');
      });
  }, []);

  const handleUndo = useCallback(() => canvasUndo(), [canvasUndo]);
  const handleRedo = useCallback(() => canvasRedo(), [canvasRedo]);

  useEffect(() => {
    const handleShortcuts = (event: KeyboardEvent): void => {
      const commandOrCtrl = event.metaKey || event.ctrlKey;
      if (!commandOrCtrl) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (key === 'e' && event.shiftKey) {
        event.preventDefault();
        void setMode('marketplace');
        return;
      }

      if (key === 's') {
        event.preventDefault();
        void saveActiveTab();
        return;
      }

      if (key === 'o') {
        event.preventDefault();
        void openWorkspaceFolder();
        return;
      }

      if (key === 'j') {
        event.preventDefault();
        toggleTerminal();
        return;
      }

      if (mode === 'split' && key === '1') {
        event.preventDefault();
        setSplitFocus('code');
        return;
      }

      if (mode === 'split' && key === '2') {
        event.preventDefault();
        setSplitFocus('canvas');
        return;
      }

      if (mode === 'split' && key === '\\') {
        event.preventDefault();
        setSplitFocus((current) => (current === 'balanced' ? 'code' : 'balanced'));
        return;
      }

      if (key !== 'p') {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        setCommandPalette(true, 'command');
        return;
      }
      setCommandPalette(true, 'quick-open');
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => {
      window.removeEventListener('keydown', handleShortcuts);
    };
  }, [
    handleRedo,
    handleUndo,
    mode,
    openWorkspaceFolder,
    saveActiveTab,
    setCommandPalette,
    setMode,
    toggleTerminal
  ]);

  const splitColumns =
    splitFocus === 'code' ? '1.32fr 0.68fr' : splitFocus === 'canvas' ? '0.68fr 1.32fr' : '1fr 1fr';

  const workspaceLabel = workspacePath ? workspacePath.replace(/\\/g, '/').split('/').pop() : 'No workspace';

  const mainPane =
    mode === 'code' ? (
      <CodeEditorPanel />
    ) : mode === 'visual' ? (
      <VisualCanvasPanel />
    ) : mode === 'split' ? (
      <div className="relative grid h-full gap-2 p-2" style={{ gridTemplateColumns: splitColumns }}>
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-md border border-white/10 bg-black/55 p-1 text-[11px] backdrop-blur-sm">
          <button
            type="button"
            className={`rounded px-2 py-1 ${splitFocus === 'code' ? 'bg-cyan-500/25 text-cyan-100' : 'text-foreground/70 hover:bg-white/10'}`}
            title="Focus code pane (Cmd/Ctrl+1)"
            onClick={() => setSplitFocus('code')}
          >
            Code
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 ${splitFocus === 'balanced' ? 'bg-indigo-500/25 text-indigo-100' : 'text-foreground/70 hover:bg-white/10'}`}
            title="Balance panes (Cmd/Ctrl+\\)"
            onClick={() => setSplitFocus('balanced')}
          >
            50/50
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 ${splitFocus === 'canvas' ? 'bg-violet-500/25 text-violet-100' : 'text-foreground/70 hover:bg-white/10'}`}
            title="Focus canvas pane (Cmd/Ctrl+2)"
            onClick={() => setSplitFocus('canvas')}
          >
            Canvas
          </button>
        </div>
        <div
          className={`min-w-0 overflow-hidden rounded-lg border bg-black/15 transition ${splitFocus === 'canvas' ? 'border-cyan-400/10 opacity-85' : 'border-cyan-400/30'}`}
          onMouseDown={() => setSplitFocus('code')}
        >
          <CodeEditorPanel />
        </div>
        <div
          className={`min-w-0 overflow-hidden rounded-lg border bg-black/15 transition ${splitFocus === 'code' ? 'border-indigo-400/10 opacity-85' : 'border-indigo-400/30'}`}
          onMouseDown={() => setSplitFocus('canvas')}
        >
          <VisualCanvasPanel />
        </div>
      </div>
    ) : mode === 'api-visual' ? (
      <APICanvasPanel />
    ) : mode === 'db-visual' ? (
      <DBCanvasPanel />
    ) : mode === 'preview' ? (
      <Suspense fallback={<LazyFallback />}>
        <WebPreviewPanel />
      </Suspense>
    ) : mode === 'export' ? (
      <Suspense fallback={<LazyFallback />}>
        <ExportPanel />
      </Suspense>
    ) : mode === 'marketplace' ? (
      <Suspense fallback={<LazyFallback />}>
        <MarketplacePanel />
      </Suspense>
    ) : (
      <Suspense fallback={<LazyFallback />}>
        <SettingsPanel />
      </Suspense>
    );

  const rightPane =
    mode === 'visual' || mode === 'split' ? (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b border-white/10 p-2">
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${
              inspectorTab === 'properties'
                ? 'bg-cyan-500/25 text-cyan-100'
                : 'text-foreground/70 hover:bg-white/10'
            }`}
            onClick={() => setInspectorTab('properties')}
          >
            Properties
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${
              inspectorTab === 'wiring'
                ? 'bg-fuchsia-500/25 text-fuchsia-100'
                : 'text-foreground/70 hover:bg-white/10'
            }`}
            onClick={() => setInspectorTab('wiring')}
          >
            Wiring
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {inspectorTab === 'properties' ? <CanvasPropertiesPanel /> : <CanvasWiringPanel />}
        </div>
      </div>
    ) : mode === 'api-visual' ? (
      <div className="flex h-full flex-col gap-2 p-2">
        <div className="min-h-0 flex-1 rounded-md border border-white/10 bg-black/20">
          <APIPropertiesPanel />
        </div>
        <FullStackGeneratorPanel />
      </div>
    ) : mode === 'db-visual' ? (
      <div className="flex h-full flex-col gap-2 p-2">
        <div className="min-h-0 flex-1 rounded-md border border-white/10 bg-black/20">
          <DBPropertiesPanel />
        </div>
        <FullStackGeneratorPanel />
      </div>
    ) : mode === 'preview' || mode === 'export' || mode === 'settings' || mode === 'marketplace' ? null : (
      <AIAgentsPanel />
    );

  return (
    <>
      <ShellLayout
        headerLeft={
          <div className="flex items-center gap-3">
            <AetherForgeLogo />
            <div className="hidden md:block">
              <p className="text-muted-foreground text-xs">{workspaceLabel}</p>
            </div>
          </div>
        }
        headerCenter={<ModeSwitcher />}
        headerRight={
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="text-foreground/80 rounded-md px-2 py-1 text-xs hover:bg-white/10"
              onClick={() => {
                void openWorkspaceFolder();
              }}
            >
              <FolderOpen className="mr-1 inline h-3.5 w-3.5" />
              Open Folder
            </button>
            <button
              type="button"
              className="text-foreground/80 rounded-md px-2 py-1 text-xs hover:bg-white/10"
              onClick={() => {
                void saveActiveTab();
              }}
            >
              <Save className="mr-1 inline h-3.5 w-3.5" />
              Save
            </button>
            <button
              type="button"
              className="text-foreground/80 rounded-md px-2 py-1 text-xs hover:bg-white/10"
              onClick={() => toggleTerminal()}
            >
              <TerminalSquare className="mr-1 inline h-3.5 w-3.5" />
              Terminal
            </button>
            <p className="text-muted-foreground ml-2 text-xs">{pingMessage}</p>
          </div>
        }
        leftRail={<SidebarLayout activeTab={sidebarActiveTab} onTabChange={setSidebarTab} />}
        mainPane={mainPane}
        bottomPane={
          terminalVisible ? (
            <TerminalPanel />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              Terminal hidden
            </div>
          )
        }
        rightPane={rightPane}
        bottomRightPane={<ActivityFeed />}
        statusBar={<StatusBar />}
      />

      <CommandPalette />
      <ModalHost />
      <ToastViewport />
    </>
  );
}
