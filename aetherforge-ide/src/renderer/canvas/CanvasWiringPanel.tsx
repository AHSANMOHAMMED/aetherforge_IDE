import { ArrowRight, Link2, Sparkles } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { requestLLM } from '@/renderer/ai/providers';
import { useAIStore } from '@/renderer/ai/store';
import { usePagesStore } from '@/renderer/state/pages-store';
import { useCanvasStore } from './store';

const FOCUS_NODE_EVENT = 'aetherforge:focus-node';

type ButtonNode = {
  id: string;
  label: string;
  pageId?: string;
  onClickAction?: 'none' | 'navigate' | 'custom';
  targetPageId?: string;
  onClickPrompt?: string;
  onClickHandlerCode?: string;
};

type WiringIssue = {
  severity: 'error' | 'warning';
  message: string;
};

function getWiringIssues(node: ButtonNode, pages: Array<{ id: string; name: string }>): WiringIssue[] {
  const issues: WiringIssue[] = [];
  const pageExists = (id?: string): boolean => Boolean(id && pages.some((page) => page.id === id));

  if (!pageExists(node.pageId)) {
    issues.push({ severity: 'error', message: 'Source page is missing or invalid.' });
  }

  if ((node.onClickAction ?? 'none') === 'navigate') {
    if (!node.targetPageId) {
      issues.push({ severity: 'error', message: 'Navigation action needs a target page.' });
    } else if (!pageExists(node.targetPageId)) {
      issues.push({ severity: 'error', message: 'Target page no longer exists.' });
    }
  }

  if ((node.onClickAction ?? 'none') === 'custom') {
    if (!(node.onClickPrompt ?? '').trim()) {
      issues.push({ severity: 'warning', message: 'Custom action has no prompt yet.' });
    }
    if (!(node.onClickHandlerCode ?? '').trim()) {
      issues.push({ severity: 'warning', message: 'Custom handler has not been generated.' });
    }
  }

  return issues;
}

function describeTarget(node: ButtonNode, getPageName: (id?: string) => string): string {
  if ((node.onClickAction ?? 'none') === 'navigate') {
    return `Page: ${getPageName(node.targetPageId)}`;
  }
  if ((node.onClickAction ?? 'none') === 'custom') {
    return node.onClickHandlerCode?.trim() ? 'Custom function handler' : 'Custom handler not generated';
  }
  return 'No action';
}

export function CanvasWiringPanel(): ReactElement {
  const nodes = useCanvasStore((state) => state.nodes);
  const updateNodePropsById = useCanvasStore((state) => state.updateNodePropsById);
  const updateNodePropsBatch = useCanvasStore((state) => state.updateNodePropsBatch);
  const selectNodeById = useCanvasStore((state) => state.selectNodeById);
  const pages = usePagesStore((state) => state.pages);
  const activePageId = usePagesStore((state) => state.activePageId);
  const aiSettings = useAIStore((state) => state.settings);
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null);
  const [bulkScope, setBulkScope] = useState<'active-page' | 'all'>('active-page');
  const [bulkTargetPageId, setBulkTargetPageId] = useState<string>('');

  const buttons = useMemo<ButtonNode[]>(
    () =>
      nodes
        .filter((node) => node.data.componentType === 'button')
        .map((node) => ({
          id: node.id,
          label: node.data.label,
          pageId: node.data.props.pageId,
          onClickAction: node.data.props.onClickAction,
          targetPageId: node.data.props.targetPageId,
          onClickPrompt: node.data.props.onClickPrompt,
          onClickHandlerCode: node.data.props.onClickHandlerCode
        })),
    [nodes]
  );

  const getPageName = (id?: string): string => {
    if (!id) {
      return 'Unassigned';
    }
    return pages.find((page) => page.id === id)?.name ?? 'Unknown';
  };

  const scopedButtons = useMemo(() => {
    if (bulkScope === 'all') {
      return buttons;
    }
    return buttons.filter((node) => (node.pageId ?? activePageId) === activePageId);
  }, [activePageId, bulkScope, buttons]);

  const effectiveBulkTargetPageId = bulkTargetPageId || pages[0]?.id || '';

  const generateOnClickHandler = async (node: ButtonNode): Promise<void> => {
    const prompt = node.onClickPrompt?.trim();
    if (!prompt) {
      return;
    }

    setGeneratingNodeId(node.id);
    try {
      const controller = new AbortController();
      const response = await requestLLM({
        settings: aiSettings,
        signal: controller.signal,
        systemPrompt: [
          'You generate JavaScript event handler code for UI buttons.',
          'Return ONLY JavaScript statements for a function body.',
          'Use only browser-safe APIs and avoid imports.',
          'Prefer concise code.'
        ].join('\n'),
        userPrompt: prompt
      });

      const cleaned = response
        .replace(/^```(?:javascript|js)?/i, '')
        .replace(/```$/i, '')
        .trim();

      updateNodePropsById(node.id, {
        onClickAction: 'custom',
        onClickHandlerCode: cleaned
      });
    } catch {
      // No-op. Provider layer already has fallback behavior.
    } finally {
      setGeneratingNodeId(null);
    }
  };

  if (buttons.length === 0) {
    return (
      <div className="text-muted-foreground p-3 text-sm">
        <p className="text-foreground mb-1 font-medium">Wiring</p>
        <p>Add button components on the canvas to wire navigation and handler actions.</p>
      </div>
    );
  }

  const totalIssues = buttons.reduce((count, node) => count + getWiringIssues(node, pages).length, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden p-3">
      <div className="mb-3">
        <p className="text-foreground text-sm font-semibold">Wiring Graph</p>
        <p className="text-muted-foreground text-xs">
          Link button onClick actions to page navigation or custom logic.
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400">
          {totalIssues > 0
            ? `${totalIssues} wiring issue${totalIssues === 1 ? '' : 's'} detected`
            : 'No wiring issues detected'}
        </p>
      </div>

      <div className="mb-3 rounded border border-white/10 bg-black/20 p-2">
        <p className="mb-1 text-[10px] font-semibold text-slate-300">Bulk Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-slate-400">
            Scope
            <select
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-slate-200"
              value={bulkScope}
              onChange={(event) => setBulkScope(event.target.value as 'active-page' | 'all')}
            >
              <option value="active-page">Active Page Buttons</option>
              <option value="all">All Buttons</option>
            </select>
          </label>
          <label className="text-[10px] text-slate-400">
            Navigate Target
            <select
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-slate-200"
              value={effectiveBulkTargetPageId}
              onChange={(event) => setBulkTargetPageId(event.target.value)}
            >
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            className="rounded border border-cyan-400/35 bg-cyan-500/15 px-2 py-1 text-[10px] text-cyan-100 disabled:opacity-40"
            disabled={scopedButtons.length === 0 || !effectiveBulkTargetPageId}
            onClick={() =>
              updateNodePropsBatch(
                scopedButtons.map((node) => node.id),
                {
                  onClickAction: 'navigate',
                  targetPageId: effectiveBulkTargetPageId
                }
              )
            }
          >
            Set Navigate
          </button>
          <button
            type="button"
            className="rounded border border-fuchsia-400/35 bg-fuchsia-500/15 px-2 py-1 text-[10px] text-fuchsia-100 disabled:opacity-40"
            disabled={scopedButtons.length === 0}
            onClick={() =>
              updateNodePropsBatch(
                scopedButtons.map((node) => node.id),
                {
                  onClickAction: 'custom'
                }
              )
            }
          >
            Set Custom
          </button>
          <button
            type="button"
            className="rounded border border-slate-400/35 bg-slate-500/10 px-2 py-1 text-[10px] text-slate-200 disabled:opacity-40"
            disabled={scopedButtons.length === 0}
            onClick={() =>
              updateNodePropsBatch(
                scopedButtons.map((node) => node.id),
                {
                  onClickAction: 'none',
                  targetPageId: undefined
                }
              )
            }
          >
            Clear Actions
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">{scopedButtons.length} button(s) in scope</p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {buttons.map((node) => {
          const issues = getWiringIssues(node, pages);
          const errorCount = issues.filter((issue) => issue.severity === 'error').length;
          const warningCount = issues.length - errorCount;

          return (
            <div key={node.id} className="rounded-md border border-white/10 bg-black/25 p-2">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-200">Button</span>
                <span className="truncate text-xs font-medium text-slate-200">{node.label}</span>
                <button
                  type="button"
                  className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/10"
                  onClick={() => {
                    selectNodeById(node.id);
                    window.dispatchEvent(new CustomEvent(FOCUS_NODE_EVENT, { detail: { nodeId: node.id } }));
                  }}
                >
                  Select
                </button>
                {errorCount > 0 ? (
                  <span className="rounded border border-rose-400/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-200">
                    {errorCount} error{errorCount === 1 ? '' : 's'}
                  </span>
                ) : null}
                {warningCount > 0 ? (
                  <span className="rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-200">
                    {warningCount} warning{warningCount === 1 ? '' : 's'}
                  </span>
                ) : null}
                <span className="ml-auto text-[10px] text-slate-500">{getPageName(node.pageId)}</span>
              </div>

              {issues.length > 0 ? (
                <div className="mb-2 space-y-1 rounded border border-white/10 bg-black/20 p-1.5">
                  {issues.map((issue, index) => (
                    <p
                      key={`${node.id}-issue-${index}`}
                      className={`text-[10px] ${issue.severity === 'error' ? 'text-rose-200' : 'text-amber-200'}`}
                    >
                      {issue.severity === 'error' ? 'Error: ' : 'Warning: '}
                      {issue.message}
                    </p>
                  ))}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-slate-400">
                  Source Page
                  <select
                    className="mt-1 w-full rounded border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-slate-200"
                    value={node.pageId ?? pages[0]?.id ?? ''}
                    onChange={(event) =>
                      updateNodePropsById(node.id, {
                        pageId: event.target.value
                      })
                    }
                  >
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[10px] text-slate-400">
                  onClick Action
                  <select
                    className="mt-1 w-full rounded border border-white/10 bg-black/30 px-1.5 py-1 text-xs text-slate-200"
                    value={node.onClickAction ?? 'none'}
                    onChange={(event) =>
                      updateNodePropsById(node.id, {
                        onClickAction: event.target.value as 'none' | 'navigate' | 'custom'
                      })
                    }
                  >
                    <option value="none">None</option>
                    <option value="navigate">Navigate</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
              </div>

              {(node.onClickAction ?? 'none') === 'navigate' ? (
                <div className="mt-2 rounded border border-cyan-500/20 bg-cyan-500/5 p-2">
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-cyan-200">
                    <Link2 className="h-3 w-3" />
                    Navigation Link
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-300">
                    <span>{getPageName(node.pageId)}</span>
                    <ArrowRight className="h-3 w-3 text-cyan-300" />
                    <select
                      className="rounded border border-white/10 bg-black/30 px-1 py-0.5 text-[10px] text-slate-200"
                      value={node.targetPageId ?? pages[0]?.id ?? ''}
                      onChange={(event) =>
                        updateNodePropsById(node.id, {
                          targetPageId: event.target.value
                        })
                      }
                    >
                      {pages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {(node.onClickAction ?? 'none') === 'custom' ? (
                <div className="mt-2 rounded border border-fuchsia-500/20 bg-fuchsia-500/5 p-2">
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-fuchsia-200">
                    <Sparkles className="h-3 w-3" />
                    Function Handler
                  </div>
                  <p className="text-[10px] text-slate-300">{describeTarget(node, getPageName)}</p>
                  <textarea
                    className="mt-1 min-h-[56px] w-full rounded border border-white/10 bg-black/30 px-1.5 py-1 text-[10px] text-slate-200"
                    value={node.onClickPrompt ?? ''}
                    onChange={(event) =>
                      updateNodePropsById(
                        node.id,
                        {
                          onClickPrompt: event.target.value
                        },
                        { recordHistory: false }
                      )
                    }
                    placeholder="Describe what this button should do"
                  />
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center rounded border border-fuchsia-400/40 bg-fuchsia-500/15 px-2 py-1 text-[10px] font-medium text-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={generatingNodeId === node.id || !(node.onClickPrompt ?? '').trim()}
                    onClick={() => {
                      void generateOnClickHandler(node);
                    }}
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    {generatingNodeId === node.id ? 'Generating...' : 'Generate Handler'}
                  </button>
                  {node.onClickHandlerCode?.trim() ? (
                    <pre className="mt-1 max-h-20 overflow-auto rounded border border-white/10 bg-black/40 p-1 text-[10px] text-slate-200">
                      {node.onClickHandlerCode}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
