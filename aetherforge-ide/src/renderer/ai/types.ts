import type { AIProviderId } from './registry';

export type { AIProviderId, AuthMethod, ProviderDescriptor, ProviderFamily } from './registry';
export { AI_PROVIDER_IDS, getProvider, isAIProviderId, PROVIDERS } from './registry';

export type AgentRole = 'planner' | 'coder' | 'reviewer';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
};

export type AgentToolName =
  | 'read_file'
  | 'write_file'
  | 'run_terminal'
  | 'analyze_url_replicate_ui'
  | 'apply_canvas_layout'
  | 'apply_api_layout'
  | 'apply_db_layout'
  | 'generate_backend_code'
  | 'scaffold_fullstack_project';

export type GuardedToolName =
  | 'write_file'
  | 'run_terminal'
  | 'analyze_url_replicate_ui'
  | 'apply_canvas_layout'
  | 'apply_api_layout'
  | 'apply_db_layout'
  | 'generate_backend_code'
  | 'scaffold_fullstack_project';

export type ToolPermissionPolicy = 'always-ask' | 'allow-session' | 'allow-always';

export type ToolPermissionDecision = 'allow-auto' | 'allow-prompt' | 'deny-prompt';

export type ToolPermissionAuditEntry = {
  id: string;
  tool: GuardedToolName;
  policy: ToolPermissionPolicy;
  decision: ToolPermissionDecision;
  summary: string;
  timestamp: number;
};

export type AgentToolCall = {
  tool: AgentToolName;
  reason?: string;
  input: Record<string, unknown>;
  /** Optional parallel group key. Calls sharing a key run concurrently within a wave. */
  parallelGroup?: string;
};

export type AgentToolResult = {
  tool: AgentToolName;
  ok: boolean;
  output: string;
};

export type ProviderSettings = {
  provider: AIProviderId;
  model: string;
  apiKey: string;
  baseUrl?: string;
};

export type AgentExecutionStep = {
  id: string;
  role: AgentRole;
  status: 'running' | 'completed' | 'failed';
  title: string;
  detail: string;
  startedAt: number;
  completedAt?: number;
  /** Parent step id for tree-shaped trace rendering. */
  parentId?: string;
  /** Optional execution wave index for parallel tool calls. */
  wave?: number;
  /** Optional tool name surfaced for trace UI when this step represents a tool execution. */
  tool?: AgentToolName;
};

export type TokenUsageEstimate = {
  plannerInput: number;
  plannerOutput: number;
  reviewerInput: number;
  reviewerOutput: number;
  costUsdRough?: number;
};

export type AgentRun = {
  id: string;
  prompt: string;
  status: 'running' | 'completed' | 'canceled' | 'failed';
  provider: AIProviderId;
  createdAt: number;
  completedAt?: number;
  steps: AgentExecutionStep[];
  response?: string;
  error?: string;
  usageEstimate?: TokenUsageEstimate;
};

export type OrchestrationResult = {
  response: string;
  steps: AgentExecutionStep[];
  usageEstimate?: TokenUsageEstimate;
};

export type PlannerPayload = {
  objective: string;
  actions: AgentToolCall[];
};
