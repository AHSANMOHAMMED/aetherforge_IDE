import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Map, Palette, X } from 'lucide-react';
import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useAppStore } from '@/renderer/state/app-store';
import { ContextMenu, type ContextMenuItem } from '@/renderer/components/ui/context-menu';
import { useToastStore } from '@/renderer/state/toast-store';
import { useSettingsStore, type EditorTheme } from '@/renderer/state/settings-store';
import { Breadcrumbs } from '@/renderer/editor/Breadcrumbs';
import { attachActiveModel } from '@/renderer/lsp/lsp-monaco-client';
import { useDebugStore } from '@/renderer/debug/dap-store';
import { syncBreakpointsForFile } from '@/renderer/debug/dap-client';

const THEMES: { id: EditorTheme; label: string }[] = [
  { id: 'aetherforge-dark', label: 'AetherForge Dark' },
  { id: 'aetherforge-light', label: 'AetherForge Light' },
  { id: 'vs-dark', label: 'VS Dark' },
  { id: 'vs', label: 'VS Light' },
  { id: 'hc-black', label: 'High Contrast' }
];

function monacoThemeId(theme: EditorTheme): string {
  return theme;
}

export function CodeEditorPanel(): ReactElement {
  const workspacePath = useAppStore((state) => state.workspacePath);
  const openTabs = useAppStore((state) => state.openTabs);
  const activeTabId = useAppStore((state) => state.activeTabId);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const closeTab = useAppStore((state) => state.closeTab);
  const closeOtherTabs = useAppStore((state) => state.closeOtherTabs);
  const closeSavedTabs = useAppStore((state) => state.closeSavedTabs);
  const saveTab = useAppStore((state) => state.saveTab);
  const reorderTabs = useAppStore((state) => state.reorderTabs);
  const revealInFinder = useAppStore((state) => state.revealInFinder);
  const updateActiveTabContent = useAppStore((state) => state.updateActiveTabContent);
  const setCursor = useAppStore((state) => state.setCursor);
  const autoSaveEnabled = useSettingsStore((state) => state.autoSaveEnabled);
  const pushToast = useToastStore((state) => state.pushToast);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const tabSize = useSettingsStore((state) => state.tabSize);
  const wordWrap = useSettingsStore((state) => state.wordWrap);
  const showLineNumbers = useSettingsStore((state) => state.showLineNumbers);
  const showMinimapPref = useSettingsStore((state) => state.showMinimap);
  const setShowMinimap = useSettingsStore((state) => state.setShowMinimap);
  const editorTheme = useSettingsStore((state) => state.editorTheme);
  const setEditorTheme = useSettingsStore((state) => state.setEditorTheme);

  const dragIndexRef = useRef<number | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [menuState, setMenuState] = useState<{ open: boolean; x: number; y: number; tabId: string | null }>({
    open: false,
    x: 0,
    y: 0,
    tabId: null
  });

  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, openTabs]
  );
  const menuTab = useMemo(
    () => openTabs.find((tab) => tab.id === menuState.tabId) ?? null,
    [menuState.tabId, openTabs]
  );

  const menuItems = useMemo<ContextMenuItem[]>(() => {
    if (!menuTab) {
      return [];
    }

    return [
      {
        id: 'close',
        label: 'Close',
        onSelect: async () => {
          await closeTab(menuTab.id);
        }
      },
      {
        id: 'close-others',
        label: 'Close Others',
        onSelect: async () => {
          await closeOtherTabs(menuTab.id);
        }
      },
      {
        id: 'close-saved',
        label: 'Close Saved',
        onSelect: () => closeSavedTabs()
      },
      {
        id: 'copy-path',
        label: 'Copy Path',
        onSelect: async () => {
          await navigator.clipboard.writeText(menuTab.path);
          pushToast({
            level: 'info',
            title: 'Copied path to clipboard',
            description: menuTab.path,
            durationMs: 2200
          });
        }
      },
      {
        id: 'reveal-in-finder',
        label: 'Reveal in Finder',
        onSelect: async () => {
          await revealInFinder(menuTab.path);
        }
      },
      ...(menuTab.path.startsWith('virtual://') || !window.electronAPI?.gitBlame || !workspacePath
        ? []
        : [
            {
              id: 'git-blame',
              label: 'Git blame (file)',
              onSelect: async () => {
                const r = await window.electronAPI.gitBlame({
                  workspacePath,
                  path: menuTab.path
                });
                if (!r.ok) {
                  pushToast({
                    level: 'error',
                    title: 'Git blame failed',
                    description: r.error,
                    durationMs: 4000
                  });
                  return;
                }
                pushToast({
                  level: 'info',
                  title: `Blame: ${r.lines.length} lines`,
                  description: r.lines
                    .slice(0, 3)
                    .map((l) => `${l.line}: ${l.author}`)
                    .join(' | '),
                  durationMs: 5000
                });
              }
            } as ContextMenuItem
          ])
    ];
  }, [closeOtherTabs, closeSavedTabs, closeTab, menuTab, pushToast, revealInFinder, workspacePath]);

  const lineCount = useMemo(() => {
    if (!activeTab) {
      return 0;
    }
    return activeTab.content.split('\n').length;
  }, [activeTab]);

  const relativePath = useMemo(() => {
    if (!activeTab) {
      return 'No file selected';
    }
    if (!workspacePath) {
      return activeTab.path;
    }

    const normalizedWorkspace = workspacePath.replace(/\\/g, '/');
    const normalizedPath = activeTab.path.replace(/\\/g, '/');
    return normalizedPath.startsWith(normalizedWorkspace)
      ? normalizedPath.slice(normalizedWorkspace.length + 1)
      : activeTab.path;
  }, [activeTab, workspacePath]);

  const handleEditorMount = useCallback<OnMount>(
    (editor, monaco) => {
      editorRef.current = editor;
      const theme = monacoThemeId(useSettingsStore.getState().editorTheme);
      monaco.editor.setTheme(theme);

      const position = editor.getPosition();
      if (position) setCursor(position.lineNumber, position.column);
      editor.onDidChangeCursorPosition((e) => setCursor(e.position.lineNumber, e.position.column));

      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
        strict: false,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        allowJs: true,
        checkJs: false
      });
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        const tabId = useAppStore.getState().activeTabId;
        if (tabId) void useAppStore.getState().saveTab(tabId);
      });
    },
    [setCursor]
  );

  useEffect(() => {
    editorRef.current?.updateOptions({
      minimap: { enabled: showMinimapPref },
      fontSize,
      fontFamily,
      tabSize,
      wordWrap: wordWrap ? 'on' : 'off',
      lineNumbers: showLineNumbers ? 'on' : 'off'
    });
  }, [fontFamily, fontSize, showLineNumbers, showMinimapPref, tabSize, wordWrap]);

  useEffect(() => {
    monaco.editor.setTheme(monacoThemeId(editorTheme));
  }, [editorTheme]);

  useEffect(() => {
    if (!activeTab || !workspacePath) return;
    if (activeTab.path.startsWith('virtual://')) return;
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!model) return;
    void attachActiveModel(model, activeTab.language, workspacePath);
  }, [activeTab, workspacePath]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeTab) return;
    if (activeTab.path.startsWith('virtual://')) return;

    const filePath = activeTab.path;
    let decorations: string[] = [];

    const renderDecorations = (): void => {
      const breakpoints = useDebugStore.getState().breakpoints.filter((bp) => bp.file === filePath);
      decorations = editor.deltaDecorations(
        decorations,
        breakpoints.map((bp) => ({
          range: new monaco.Range(bp.line, 1, bp.line, 1),
          options: {
            isWholeLine: false,
            glyphMarginClassName: 'aetherforge-breakpoint',
            glyphMarginHoverMessage: { value: `Breakpoint at line ${bp.line}` }
          }
        }))
      );
    };

    renderDecorations();
    const unsubscribe = useDebugStore.subscribe((state, prev) => {
      if (state.breakpoints !== prev.breakpoints) {
        renderDecorations();
      }
    });

    const disposable = editor.onMouseDown((event) => {
      if (event.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
      const line = event.target.position?.lineNumber;
      if (!line) return;
      useDebugStore.getState().toggleBreakpoint(filePath, line);
      void syncBreakpointsForFile(filePath);
    });

    return () => {
      disposable.dispose();
      unsubscribe();
      decorations = editor.deltaDecorations(decorations, []);
    };
  }, [activeTab]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/10 px-1 py-1">
        {openTabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              draggable
              onContextMenu={(event) => {
                event.preventDefault();
                setMenuState({ open: true, x: event.clientX, y: event.clientY, tabId: tab.id });
              }}
              onDragStart={() => {
                dragIndexRef.current = index;
              }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={() => {
                const fromIndex = dragIndexRef.current;
                dragIndexRef.current = null;
                if (fromIndex === null) {
                  return;
                }
                reorderTabs(fromIndex, index);
              }}
              className={`group flex min-w-[180px] max-w-[260px] items-center gap-2 rounded-md border px-2 py-1 text-sm ${
                isActive
                  ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100'
                  : 'text-foreground/80 border-transparent bg-black/20 hover:bg-black/35'
              }`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => setActiveTab(tab.id)}
                onDoubleClick={() => {
                  void saveTab(tab.id);
                }}
              >
                {tab.name}
                {tab.isDirty ? ' *' : ''}
              </button>
              <button
                type="button"
                className="rounded p-0.5 opacity-60 transition hover:bg-white/10 group-hover:opacity-100"
                onClick={() => {
                  void closeTab(tab.id);
                }}
                title={`Close ${tab.name}`}
                aria-label={`Close ${tab.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="text-muted-foreground flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs">
        <p className="truncate">{relativePath}</p>
        <div className="flex items-center gap-4">
          <span>{lineCount} lines</span>
          {/* Minimap toggle */}
          <button
            type="button"
            className={`hover:text-foreground flex items-center gap-1 transition ${showMinimapPref ? 'text-cyan-400' : ''}`}
            onClick={() => {
              setShowMinimap(!showMinimapPref);
            }}
            title="Toggle Minimap"
          >
            <Map className="h-3 w-3" />
            Map
          </button>
          {/* Theme selector */}
          <div className="relative">
            <button
              type="button"
              className="hover:text-foreground flex items-center gap-1 transition"
              onClick={() => setThemeMenuOpen((v) => !v)}
            >
              <Palette className="h-3 w-3" />
              {THEMES.find((t) => t.id === editorTheme)?.label ?? 'Theme'}
            </button>
            {themeMenuOpen && (
              <div className="absolute bottom-6 right-0 z-50 min-w-[160px] rounded-lg border border-white/10 bg-[#0d1220] py-1 shadow-xl">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-white/10 ${editorTheme === t.id ? 'text-cyan-400' : ''}`}
                    onClick={() => {
                      setEditorTheme(t.id);
                      monaco.editor.setTheme(monacoThemeId(t.id));
                      setThemeMenuOpen(false);
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => {
              if (activeTabId) void closeOtherTabs(activeTabId);
            }}
          >
            Close Others
          </button>
          <button type="button" className="hover:text-foreground" onClick={() => closeSavedTabs()}>
            Close Saved
          </button>
          <span>{autoSaveEnabled ? 'Auto Save: On' : 'Auto Save: Off'}</span>
        </div>
      </div>

      <div className="h-full" data-monaco-editor>
        {!workspacePath ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Open a workspace folder to start editing.
          </div>
        ) : !activeTab ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Select a file from the explorer or use Cmd/Ctrl + P.
          </div>
        ) : (
          <>
            <Breadcrumbs />
            <Editor
              height="calc(100% - 28px)"
              path={activeTab.path}
              language={activeTab.language}
              value={activeTab.content}
              onChange={(value) => updateActiveTabContent(value ?? '')}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: showMinimapPref },
                fontSize,
                fontFamily,
                smoothScrolling: true,
                automaticLayout: true,
                wordWrap: wordWrap ? 'on' : 'off',
                tabSize,
                lineNumbers: showLineNumbers ? 'on' : 'off',
                bracketPairColorization: { enabled: true },
                renderLineHighlight: 'line',
                scrollBeyondLastLine: false,
                padding: { top: 8 },
                suggest: { preview: true },
                glyphMargin: true
              }}
              theme={monacoThemeId(editorTheme)}
            />
          </>
        )}
      </div>

      <ContextMenu
        open={menuState.open}
        x={menuState.x}
        y={menuState.y}
        items={menuItems}
        onClose={() => setMenuState({ open: false, x: 0, y: 0, tabId: null })}
      />
    </div>
  );
}
