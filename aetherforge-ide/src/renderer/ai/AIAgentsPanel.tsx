import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { Bot, CircleStop, SendHorizontal, Settings2, Trash2 } from 'lucide-react';
import { useAIStore } from './store';
import { getProvider } from './registry';
import { AIProviderModal } from './AIProviderModal';
import { AIRunHistory } from './AIRunHistory';

const EXAMPLE_PROMPTS = [
  'Analyze URL https://vercel.com and replicate the hero UI on the visual canvas.',
  'Read src/renderer/App.tsx and propose a refactor plan.',
  'Run `npm run typecheck` and summarize errors.',
  'Write src/renderer/components/ui/Badge.tsx with size and tone variants.',
  'Generate backend code from the API visual graph.',
  'Scaffold a full-stack project named crm-studio using FastAPI + Supabase.'
];

const TOOL_LABELS = {
  write_file: 'Write Files',
  run_terminal: 'Run Terminal Commands',
  analyze_url_replicate_ui: 'Analyze URL and Replicate UI',
  apply_canvas_layout: 'Apply Canvas Layout',
  apply_api_layout: 'Apply API Layout',
  apply_db_layout: 'Apply DB Layout',
  generate_backend_code: 'Generate Backend Code',
  scaffold_fullstack_project: 'Scaffold Full-Stack Project'
} as const;

export function AIAgentsPanel(): ReactElement {
  const messages = useAIStore((state) => state.messages);
  const runs = useAIStore((state) => state.runs);
  const activeRunId = useAIStore((state) => state.activeRunId);
  const streamingAssistantDraft = useAIStore((state) => state.streamingAssistantDraft);
  const initialize = useAIStore((state) => state.initialize);
  const settings = useAIStore((state) => state.settings);
  const permissionAuditLog = useAIStore((state) => state.permissionAuditLog);
  const sendMessage = useAIStore((state) => state.sendMessage);
  const cancelActiveRun = useAIStore((state) => state.cancelActiveRun);
  const clearHistory = useAIStore((state) => state.clearHistory);

  const [draft, setDraft] = useState('');
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const toggleRunExpanded = (id: string): void => {
    setExpandedRunId((current) => (current === id ? null : id));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (draft.trim().length === 0) {
      return;
    }

    const current = draft;
    setDraft('');
    void sendMessage(current);
  };

  const providerLabel = getProvider(settings.provider)?.label ?? settings.provider;

  return (
    <div className="flex h-full flex-col border-l border-white/10 bg-slate-950/50">
      <AIProviderModal open={providerModalOpen} onOpenChange={setProviderModalOpen} />

      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <p className="text-foreground text-sm font-semibold">AI Agents</p>
          <p className="text-muted-foreground text-xs">Planner → Coder → Reviewer</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground rounded-md p-1.5 hover:bg-white/10"
            onClick={() => setProviderModalOpen(true)}
            title="Manage AI providers"
            aria-label="Manage AI providers"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground rounded-md p-1.5 hover:bg-white/10"
            onClick={() => clearHistory()}
            title="Clear history"
            aria-label="Clear history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-white/10 px-3 py-2">
        <button
          type="button"
          className="text-foreground w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-left text-xs hover:bg-white/10"
          onClick={() => setProviderModalOpen(true)}
        >
          <span className="text-muted-foreground">Active: </span>
          <span className="font-medium">{providerLabel}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-muted-foreground">{settings.model}</span>
          <span className="text-muted-foreground float-right">Manage…</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-foreground text-xs font-medium">Example prompts</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-left text-xs text-cyan-100 hover:bg-cyan-500/20"
                  onClick={() => setDraft(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-lg border p-3 ${
              message.role === 'user'
                ? 'border-cyan-500/30 bg-cyan-500/10'
                : message.role === 'assistant'
                  ? 'border-emerald-500/25 bg-emerald-500/10'
                  : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
              <Bot className="h-3.5 w-3.5" />
              <span>{message.role}</span>
              <span>•</span>
              <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
            <pre className="text-foreground whitespace-pre-wrap text-xs">{message.content}</pre>
          </div>
        ))}

        {activeRunId && streamingAssistantDraft ? (
          <div className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs text-emerald-200">
              <Bot className="h-3.5 w-3.5" />
              <span>assistant</span>
              <span>•</span>
              <span>streaming...</span>
            </div>
            <pre className="text-foreground whitespace-pre-wrap text-xs">{streamingAssistantDraft}</pre>
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/10 p-3">
        <AIRunHistory
          runs={runs}
          activeRunId={activeRunId}
          expandedRunId={expandedRunId}
          onToggleRun={toggleRunExpanded}
        />

        <div className="mb-2 rounded-md border border-white/10 bg-white/5 p-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Permission Audit</span>
            <span className="text-muted-foreground text-[10px]">{permissionAuditLog.length} events</span>
          </div>
          <div className="max-h-24 space-y-1 overflow-y-auto">
            {permissionAuditLog.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                className="text-foreground/90 rounded border border-white/10 px-2 py-1 text-[11px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{TOOL_LABELS[entry.tool]}</span>
                  <span
                    className={`uppercase ${
                      entry.decision === 'deny-prompt'
                        ? 'text-red-300'
                        : entry.decision === 'allow-prompt'
                          ? 'text-cyan-200'
                          : 'text-emerald-300'
                    }`}
                  >
                    {entry.decision}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[10px]">
                  <span>{entry.policy}</span>
                  <span>•</span>
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
            {permissionAuditLog.length === 0 ? (
              <p className="text-muted-foreground text-[11px]">No permission events yet.</p>
            ) : null}
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-2">
          <textarea
            id="sidebar-panel-ai"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            className="text-foreground w-full resize-none rounded-md border border-white/10 bg-slate-900 p-2 text-xs focus:border-cyan-400/50 focus:outline-none"
            placeholder="Ask agents to edit code, run commands, analyze URLs, or update the visual canvas. Reference files inline with @path/to/file."
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={Boolean(activeRunId)}
              className="inline-flex items-center gap-1 rounded-md bg-cyan-500/30 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SendHorizontal className="h-3.5 w-3.5" />
              Send
            </button>
            <button
              type="button"
              disabled={!activeRunId}
              className="inline-flex items-center gap-1 rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => cancelActiveRun()}
            >
              <CircleStop className="h-3.5 w-3.5" />
              Cancel Run
            </button>
            <span className="text-muted-foreground text-[11px]">
              {providerLabel} · {settings.model}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
