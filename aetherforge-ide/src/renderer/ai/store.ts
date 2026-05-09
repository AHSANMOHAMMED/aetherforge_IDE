import localforage from 'localforage';
import { create } from 'zustand';
import { runOrchestration } from './orchestration';
import { clearRuns as clearRunsSql, loadRuns as loadRunsSql, saveRun as saveRunSql } from './persistence';
import { PROVIDER_DEFAULT_MODEL } from './providers';
import { useAppStore } from '@/renderer/state/app-store';
import { getRagAugmentationBlock } from './rag/indexer';
import { formatMentionContext, parseMentions, stripMentions } from './rag/mention-parser';
import type {
  AgentRun,
  AIProviderId,
  ChatMessage,
  GuardedToolName,
  ProviderSettings,
  ToolPermissionAuditEntry,
  ToolPermissionDecision,
  ToolPermissionPolicy
} from './types';
import { AI_PROVIDER_IDS } from './types';

const SETTINGS_KEY = 'aetherforge.ai.settings';
const TOOL_POLICY_KEY = 'aetherforge.ai.toolPolicy';
const RUN_HISTORY_KEY = 'aetherforge.ai.runHistory.v1';
const MAX_PERSISTED_RUNS = 60;

function isAIProviderId(value: string): value is AIProviderId {
  return (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

async function loadPersistedRuns(): Promise<AgentRun[]> {
  try {
    const sqlRuns = await loadRunsSql(MAX_PERSISTED_RUNS);
    if (sqlRuns.length > 0) {
      return sqlRuns;
    }
  } catch {
    // fall back to localforage
  }
  try {
    const raw = await localforage.getItem<AgentRun[]>(RUN_HISTORY_KEY);
    return Array.isArray(raw) ? raw.slice(0, MAX_PERSISTED_RUNS) : [];
  } catch {
    return [];
  }
}

async function savePersistedRuns(runs: AgentRun[], modelHint?: string): Promise<void> {
  // Always mirror to localforage as a cache for non-Electron contexts and as a fallback.
  try {
    await localforage.setItem(RUN_HISTORY_KEY, runs.slice(0, MAX_PERSISTED_RUNS));
  } catch {
    // ignore persistence errors (private mode, quota, etc.)
  }
  try {
    const subset = runs.slice(0, MAX_PERSISTED_RUNS);
    for (const run of subset) {
      await saveRunSql(run, modelHint);
    }
  } catch {
    // ignore SQLite write errors; localforage already holds the canonical cache.
  }
}

type AIState = {
  messages: ChatMessage[];
  runs: AgentRun[];
  activeRunId: string | null;
  streamingAssistantDraft: string;
  initialized: boolean;
  settings: ProviderSettings;
  toolPolicies: Record<GuardedToolName, ToolPermissionPolicy>;
  sessionToolGrants: Record<GuardedToolName, boolean>;
  permissionAuditLog: ToolPermissionAuditEntry[];
  initialize: () => Promise<void>;
  setSettings: (partial: Partial<ProviderSettings>) => void;
  setToolPolicy: (tool: GuardedToolName, policy: ToolPermissionPolicy) => void;
  grantSessionTool: (tool: GuardedToolName) => void;
  clearSessionToolGrants: () => void;
  logToolPermissionDecision: (
    tool: GuardedToolName,
    policy: ToolPermissionPolicy,
    decision: ToolPermissionDecision,
    summary: string
  ) => void;
  sendMessage: (content: string) => Promise<void>;
  cancelActiveRun: () => void;
  clearHistory: () => void;
};

const controllers = new Map<string, AbortController>();

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadSettings(): ProviderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {
        provider: 'ollama',
        model: PROVIDER_DEFAULT_MODEL.ollama,
        apiKey: '',
        baseUrl: 'http://localhost:11434/api/chat'
      };
    }

    const parsed = JSON.parse(raw) as Partial<ProviderSettings>;
    const rawProvider = parsed.provider ?? 'ollama';
    const provider = isAIProviderId(String(rawProvider)) ? rawProvider : 'ollama';
    return {
      provider,
      model: parsed.model ?? PROVIDER_DEFAULT_MODEL[provider],
      apiKey: '',
      baseUrl: parsed.baseUrl
    };
  } catch {
    return {
      provider: 'ollama',
      model: PROVIDER_DEFAULT_MODEL.ollama,
      apiKey: '',
      baseUrl: 'http://localhost:11434/api/chat'
    };
  }
}

function saveSettings(settings: ProviderSettings): void {
  const { apiKey: _apiKey, ...persistable } = settings;
  void _apiKey;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(persistable));
}

const API_KEY_SECRET = 'aetherforge.ai.apiKey';

const DEFAULT_TOOL_POLICIES: Record<GuardedToolName, ToolPermissionPolicy> = {
  write_file: 'always-ask',
  run_terminal: 'always-ask',
  analyze_url_replicate_ui: 'always-ask',
  apply_canvas_layout: 'always-ask',
  apply_api_layout: 'always-ask',
  apply_db_layout: 'always-ask',
  generate_backend_code: 'always-ask',
  scaffold_fullstack_project: 'always-ask'
};

function isValidPolicy(policy: unknown): policy is ToolPermissionPolicy {
  return policy === 'always-ask' || policy === 'allow-session' || policy === 'allow-always';
}

function loadToolPolicies(): Record<GuardedToolName, ToolPermissionPolicy> {
  try {
    const raw = localStorage.getItem(TOOL_POLICY_KEY);
    if (!raw) {
      return DEFAULT_TOOL_POLICIES;
    }

    const parsed = JSON.parse(raw) as Partial<Record<GuardedToolName, ToolPermissionPolicy>>;
    return {
      write_file: isValidPolicy(parsed.write_file) ? parsed.write_file : DEFAULT_TOOL_POLICIES.write_file,
      run_terminal: isValidPolicy(parsed.run_terminal)
        ? parsed.run_terminal
        : DEFAULT_TOOL_POLICIES.run_terminal,
      analyze_url_replicate_ui: isValidPolicy(parsed.analyze_url_replicate_ui)
        ? parsed.analyze_url_replicate_ui
        : DEFAULT_TOOL_POLICIES.analyze_url_replicate_ui,
      apply_canvas_layout: isValidPolicy(parsed.apply_canvas_layout)
        ? parsed.apply_canvas_layout
        : DEFAULT_TOOL_POLICIES.apply_canvas_layout,
      apply_api_layout: isValidPolicy(parsed.apply_api_layout)
        ? parsed.apply_api_layout
        : DEFAULT_TOOL_POLICIES.apply_api_layout,
      apply_db_layout: isValidPolicy(parsed.apply_db_layout)
        ? parsed.apply_db_layout
        : DEFAULT_TOOL_POLICIES.apply_db_layout,
      generate_backend_code: isValidPolicy(parsed.generate_backend_code)
        ? parsed.generate_backend_code
        : DEFAULT_TOOL_POLICIES.generate_backend_code,
      scaffold_fullstack_project: isValidPolicy(parsed.scaffold_fullstack_project)
        ? parsed.scaffold_fullstack_project
        : DEFAULT_TOOL_POLICIES.scaffold_fullstack_project
    };
  } catch {
    return DEFAULT_TOOL_POLICIES;
  }
}

function saveToolPolicies(policies: Record<GuardedToolName, ToolPermissionPolicy>): void {
  localStorage.setItem(TOOL_POLICY_KEY, JSON.stringify(policies));
}

export const useAIStore = create<AIState>((set, get) => ({
  messages: [],
  runs: [],
  activeRunId: null,
  streamingAssistantDraft: '',
  initialized: false,
  settings: loadSettings(),
  toolPolicies: loadToolPolicies(),
  sessionToolGrants: {
    write_file: false,
    run_terminal: false,
    analyze_url_replicate_ui: false,
    apply_canvas_layout: false,
    apply_api_layout: false,
    apply_db_layout: false,
    generate_backend_code: false,
    scaffold_fullstack_project: false
  },
  permissionAuditLog: [],

  initialize: async () => {
    if (get().initialized) {
      return;
    }

    try {
      const [persistedRuns, secretResult] = await Promise.all([
        loadPersistedRuns(),
        window.electronAPI.getSecret({ key: API_KEY_SECRET })
      ]);
      set((state) => ({
        initialized: true,
        runs: persistedRuns.length > 0 ? persistedRuns : state.runs,
        settings: {
          ...state.settings,
          apiKey: secretResult.ok ? (secretResult.value ?? '') : ''
        }
      }));
    } catch {
      set({ initialized: true });
    }
  },

  setSettings: (partial) => {
    set((state) => {
      const provider = partial.provider ?? state.settings.provider;
      const next: ProviderSettings = {
        ...state.settings,
        ...partial,
        provider,
        model:
          partial.model ??
          (partial.provider && !partial.model
            ? PROVIDER_DEFAULT_MODEL[partial.provider]
            : state.settings.model)
      };
      saveSettings(next);

      if (partial.apiKey !== undefined) {
        if (partial.apiKey.trim().length > 0) {
          void window.electronAPI.setSecret({ key: API_KEY_SECRET, value: partial.apiKey });
        } else {
          void window.electronAPI.deleteSecret({ key: API_KEY_SECRET });
        }
      }

      return { settings: next };
    });
  },

  setToolPolicy: (tool, policy) => {
    set((state) => {
      const nextPolicies = {
        ...state.toolPolicies,
        [tool]: policy
      };
      saveToolPolicies(nextPolicies);

      return {
        toolPolicies: nextPolicies,
        sessionToolGrants:
          policy === 'allow-session'
            ? state.sessionToolGrants
            : {
                ...state.sessionToolGrants,
                [tool]: false
              }
      };
    });
  },

  grantSessionTool: (tool) => {
    set((state) => ({
      sessionToolGrants: {
        ...state.sessionToolGrants,
        [tool]: true
      }
    }));
  },

  clearSessionToolGrants: () => {
    set({
      sessionToolGrants: {
        write_file: false,
        run_terminal: false,
        analyze_url_replicate_ui: false,
        apply_canvas_layout: false,
        apply_api_layout: false,
        apply_db_layout: false,
        generate_backend_code: false,
        scaffold_fullstack_project: false
      }
    });
  },

  logToolPermissionDecision: (tool, policy, decision, summary) => {
    set((state) => ({
      permissionAuditLog: [
        {
          id: nextId('perm-audit'),
          tool,
          policy,
          decision,
          summary,
          timestamp: Date.now()
        },
        ...state.permissionAuditLog
      ].slice(0, 30)
    }));
  },

  sendMessage: async (content) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    const runId = nextId('run');
    const now = Date.now();
    const userMessage: ChatMessage = {
      id: nextId('msg-user'),
      role: 'user',
      content: trimmed,
      timestamp: now
    };

    const run: AgentRun = {
      id: runId,
      prompt: trimmed,
      status: 'running',
      provider: get().settings.provider,
      createdAt: now,
      steps: []
    };

    const controller = new AbortController();
    controllers.set(runId, controller);

    set((state) => ({
      messages: [...state.messages, userMessage],
      runs: [run, ...state.runs],
      activeRunId: runId,
      streamingAssistantDraft: ''
    }));

    const mentions = parseMentions(trimmed);
    const resolvedMentions: Array<{ path: string; content: string }> = [];
    if (mentions.length > 0 && typeof window !== 'undefined' && window.electronAPI?.readFile) {
      for (const mention of mentions) {
        try {
          const result = await window.electronAPI.readFile(mention.path);
          if (typeof result.content === 'string') {
            resolvedMentions.push({ path: mention.path, content: result.content });
          }
        } catch {
          // ignore unresolved mentions; the planner still sees the path string in the user prompt.
        }
      }
    }

    let ragBlock: string | null = null;
    if (mentions.length === 0) {
      const wsPath = useAppStore.getState().workspacePath;
      ragBlock = await getRagAugmentationBlock(wsPath, trimmed);
    }

    const promptWithContext = (() => {
      if (resolvedMentions.length > 0) {
        const stripped = stripMentions(trimmed) || trimmed;
        return [formatMentionContext(resolvedMentions), 'User request:', stripped]
          .filter(Boolean)
          .join('\n\n');
      }
      if (ragBlock) {
        return [ragBlock, 'User request:', trimmed].join('\n\n');
      }
      return trimmed;
    })();

    try {
      const result = await runOrchestration({
        prompt: promptWithContext,
        settings: get().settings,
        signal: controller.signal,
        onReviewerChunk: (chunk) => {
          if (!chunk) {
            return;
          }

          set((state) => {
            if (state.activeRunId !== runId) {
              return state;
            }
            return {
              streamingAssistantDraft: `${state.streamingAssistantDraft}${chunk}`
            };
          });
        }
      });

      const assistantMessage: ChatMessage = {
        id: nextId('msg-assistant'),
        role: 'assistant',
        content: result.response,
        timestamp: Date.now()
      };

      set((state) => {
        const nextRuns = state.runs.map((candidate) =>
          candidate.id === runId
            ? {
                ...candidate,
                status: 'completed' as const,
                completedAt: Date.now(),
                steps: result.steps,
                response: result.response,
                usageEstimate: result.usageEstimate
              }
            : candidate
        );
        void savePersistedRuns(nextRuns, get().settings.model);
        return {
          messages: [...state.messages, assistantMessage],
          runs: nextRuns,
          activeRunId: state.activeRunId === runId ? null : state.activeRunId,
          streamingAssistantDraft: state.activeRunId === runId ? '' : state.streamingAssistantDraft
        };
      });
    } catch (error) {
      const canceled = error instanceof DOMException && error.name === 'AbortError';
      const message = canceled
        ? 'Execution canceled by user.'
        : error instanceof Error
          ? error.message
          : 'Agent run failed.';

      const assistantMessage: ChatMessage = {
        id: nextId('msg-assistant'),
        role: 'assistant',
        content: canceled ? 'Run canceled.' : `Run failed: ${message}`,
        timestamp: Date.now()
      };

      const steps =
        typeof error === 'object' &&
        error !== null &&
        'steps' in error &&
        Array.isArray((error as { steps: unknown }).steps)
          ? ((error as { steps: AgentRun['steps'] }).steps ?? [])
          : [];

      set((state) => {
        const nextRuns = state.runs.map((candidate) =>
          candidate.id === runId
            ? {
                ...candidate,
                status: canceled ? ('canceled' as const) : ('failed' as const),
                completedAt: Date.now(),
                steps,
                error: message
              }
            : candidate
        );
        void savePersistedRuns(nextRuns, get().settings.model);
        return {
          messages: [...state.messages, assistantMessage],
          runs: nextRuns,
          activeRunId: state.activeRunId === runId ? null : state.activeRunId,
          streamingAssistantDraft: state.activeRunId === runId ? '' : state.streamingAssistantDraft
        };
      });
    } finally {
      controllers.delete(runId);
    }
  },

  cancelActiveRun: () => {
    const activeRunId = get().activeRunId;
    if (!activeRunId) {
      return;
    }

    const controller = controllers.get(activeRunId);
    controller?.abort();
  },

  clearHistory: () => {
    void localforage.removeItem(RUN_HISTORY_KEY);
    void clearRunsSql();
    set({ messages: [], runs: [] });
  }
}));
