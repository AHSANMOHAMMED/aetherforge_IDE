import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  CircleStop,
  Clock3,
  SendHorizontal,
  Settings2,
  Trash2
} from 'lucide-react';
import { AgentTraceTree } from './AgentTraceTree';
import { useAIStore } from './store';
import { PROVIDER_DEFAULT_MODEL } from './providers';
import type { AIProviderId, GuardedToolName, ToolPermissionPolicy } from './types';

const PROVIDER_LABELS: Record<AIProviderId, string> = {
  openai: 'OpenAI',
  claude: 'Anthropic Claude',
  grok: 'xAI Grok',
  gemini: 'Google Gemini',
  mistral: 'Mistral',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  ollama: 'Ollama (local)'
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

const EXAMPLE_PROMPTS = [
  'Analyze URL https://vercel.com and replicate the hero UI on the visual canvas.',
  'Read src/renderer/App.tsx and propose a refactor plan.',
  'Run `npm run typecheck` and summarize errors.',
  'Write src/renderer/components/ui/Badge.tsx with size and tone variants.',
  'Generate backend code from the API visual graph.',
  'Scaffold a full-stack project named crm-studio using FastAPI + Supabase.'
];

const TOOL_LABELS: Record<GuardedToolName, string> = {
  write_file: 'Write Files',
  run_terminal: 'Run Terminal Commands',
  analyze_url_replicate_ui: 'Analyze URL and Replicate UI',
  apply_canvas_layout: 'Apply Canvas Layout',
  apply_api_layout: 'Apply API Layout',
  apply_db_layout: 'Apply DB Layout',
  generate_backend_code: 'Generate Backend Code',
  scaffold_fullstack_project: 'Scaffold Full-Stack Project'
};

const POLICY_LABELS: Record<ToolPermissionPolicy, string> = {
  'always-ask': 'Always Ask',
  'allow-session': 'Allow Once per Session',
  'allow-always': 'Allow Always'
};

export function AIAgentsPanel(): ReactElement {
  const messages = useAIStore((state) => state.messages);
  const runs = useAIStore((state) => state.runs);
  const activeRunId = useAIStore((state) => state.activeRunId);
  const streamingAssistantDraft = useAIStore((state) => state.streamingAssistantDraft);
  const initialize = useAIStore((state) => state.initialize);
  const settings = useAIStore((state) => state.settings);
  const setSettings = useAIStore((state) => state.setSettings);
  const toolPolicies = useAIStore((state) => state.toolPolicies);
  const sessionToolGrants = useAIStore((state) => state.sessionToolGrants);
  const permissionAuditLog = useAIStore((state) => state.permissionAuditLog);
  const setToolPolicy = useAIStore((state) => state.setToolPolicy);
  const clearSessionToolGrants = useAIStore((state) => state.clearSessionToolGrants);
  const sendMessage = useAIStore((state) => state.sendMessage);
  const cancelActiveRun = useAIStore((state) => state.cancelActiveRun);
  const clearHistory = useAIStore((state) => state.clearHistory);

  const [draft, setDraft] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const activeRun = useMemo(() => runs.find((run) => run.id === activeRunId) ?? null, [activeRunId, runs]);

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

  return (
    <div className="flex h-full flex-col border-l border-white/10 bg-slate-950/50">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <p className="text-foreground text-sm font-semibold">AI Agents</p>
          <p className="text-muted-foreground text-xs">Planner → Coder → Reviewer</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground rounded-md p-1.5 hover:bg-white/10"
            onClick={() => setSettingsOpen((open) => !open)}
            title="Provider settings"
            aria-label="Provider settings"
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

      {settingsOpen ? (
        <div className="space-y-2 border-b border-white/10 bg-black/20 p-3">
          <label className="text-muted-foreground block text-xs">
            Provider
            <select
              className="text-foreground mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs"
              value={settings.provider}
              onChange={(event) => {
                const provider = event.target.value as AIProviderId;
                setSettings({ provider, model: PROVIDER_DEFAULT_MODEL[provider] });
              }}
            >
              {(Object.keys(PROVIDER_LABELS) as AIProviderId[]).map((provider) => (
                <option key={provider} value={provider}>
                  {PROVIDER_LABELS[provider]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-muted-foreground block text-xs">
            Model
            <input
              className="text-foreground mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs"
              value={settings.model}
              onChange={(event) => setSettings({ model: event.target.value })}
              placeholder="Model name"
            />
          </label>

          <label className="text-muted-foreground block text-xs">
            API Key
            <input
              type="password"
              className="text-foreground mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs"
              value={settings.apiKey}
              onChange={(event) => setSettings({ apiKey: event.target.value })}
              placeholder="Required for cloud providers"
            />
          </label>

          <label className="text-muted-foreground block text-xs">
            Base URL (optional override)
            <input
              className="text-foreground mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs"
              value={settings.baseUrl ?? ''}
              onChange={(event) => setSettings({ baseUrl: event.target.value || undefined })}
              placeholder="https://..."
            />
          </label>

          <div className="rounded-md border border-white/10 bg-slate-900/50 p-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-foreground text-xs font-medium">Tool Permissions</p>
              <button
                type="button"
                className="rounded px-2 py-1 text-[11px] text-cyan-200 hover:bg-white/10"
                onClick={() => clearSessionToolGrants()}
              >
                Reset Session Grants
              </button>
            </div>
            <div className="space-y-2">
              {(Object.keys(TOOL_LABELS) as GuardedToolName[]).map((tool) => (
                <label key={tool} className="text-muted-foreground block text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span>{TOOL_LABELS[tool]}</span>
                    {sessionToolGrants[tool] ? (
                      <span className="text-[10px] text-emerald-300">session granted</span>
                    ) : null}
                  </div>
                  <select
                    className="text-foreground w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs"
                    value={toolPolicies[tool]}
                    onChange={(event) => setToolPolicy(tool, event.target.value as ToolPermissionPolicy)}
                  >
                    {(Object.keys(POLICY_LABELS) as ToolPermissionPolicy[]).map((policy) => (
                      <option key={policy} value={policy}>
                        {POLICY_LABELS[policy]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}

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
              <span>{formatTime(message.timestamp)}</span>
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
        <div className="mb-2 rounded-md border border-white/10 bg-white/5 p-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Execution history</span>
            {activeRun ? <span className="text-cyan-200">running</span> : null}
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {runs.slice(0, 6).map((run) => {
              const expanded = expandedRunId === run.id;
              return (
                <div
                  key={run.id}
                  className="text-foreground/90 rounded border border-white/10 px-2 py-1 text-xs"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() => toggleRunExpanded(run.id)}
                    aria-expanded={expanded}
                  >
                    <span className="flex min-w-0 items-center gap-1">
                      {expanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      )}
                      <span className="truncate">{run.prompt}</span>
                    </span>
                    <span className="text-muted-foreground ml-2 text-[10px] uppercase">{run.status}</span>
                  </button>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                    <Clock3 className="h-3 w-3" />
                    <span>{formatTime(run.createdAt)}</span>
                    <span>•</span>
                    <span>{run.steps.length} steps</span>
                    {run.usageEstimate ? (
                      <>
                        <span>•</span>
                        <span title="Token totals come from provider usage when available, otherwise rough estimates.">
                          ~
                          {run.usageEstimate.plannerInput +
                            run.usageEstimate.plannerOutput +
                            run.usageEstimate.reviewerInput +
                            run.usageEstimate.reviewerOutput}{' '}
                          tok
                          {run.usageEstimate.costUsdRough != null
                            ? ` · ~$${run.usageEstimate.costUsdRough.toFixed(4)}`
                            : ''}
                        </span>
                      </>
                    ) : null}
                  </div>
                  {expanded ? (
                    <div className="mt-2">
                      <AgentTraceTree steps={run.steps} />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {runs.length === 0 ? <p className="text-muted-foreground text-[11px]">No runs yet.</p> : null}
          </div>
        </div>

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
                  <span>{formatTime(entry.timestamp)}</span>
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
              Provider: {PROVIDER_LABELS[settings.provider]} · {settings.model}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
