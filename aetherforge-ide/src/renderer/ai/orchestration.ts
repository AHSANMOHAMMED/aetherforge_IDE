import { planWaves, type ToolDagNode } from './dag';
import { requestLLM } from './providers';
import { ALLOWED_AGENT_TOOLS } from './tool-schemas';
import { planWithNativeTools, type ProviderUsage } from './tool-calling';
import { executeAgentTool } from './tools';
import { estimateCostUsdRough, estimateRoughTokens } from './usage';
import type {
  AgentExecutionStep,
  AgentToolCall,
  AgentToolName,
  AgentToolResult,
  OrchestrationResult,
  PlannerPayload,
  ProviderSettings,
  TokenUsageEstimate
} from './types';

type OrchestrationInput = {
  prompt: string;
  settings: ProviderSettings;
  signal: AbortSignal;
  onReviewerChunk?: (chunk: string) => void;
};

function createStep(
  role: AgentExecutionStep['role'],
  title: string,
  detail: string,
  options: { parentId?: string; tool?: AgentToolName; wave?: number } = {}
): AgentExecutionStep {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    status: 'running',
    title,
    detail,
    startedAt: Date.now(),
    parentId: options.parentId,
    tool: options.tool,
    wave: options.wave
  };
}

function completeStep(step: AgentExecutionStep, detail: string): AgentExecutionStep {
  return {
    ...step,
    status: 'completed',
    detail,
    completedAt: Date.now()
  };
}

function failStep(step: AgentExecutionStep, detail: string): AgentExecutionStep {
  return {
    ...step,
    status: 'failed',
    detail,
    completedAt: Date.now()
  };
}

function extractJson(text: string): string | null {
  const block = text.match(/```json\s*([\s\S]*?)```/i);
  if (block?.[1]) {
    return block[1].trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  return text.slice(firstBrace, lastBrace + 1);
}

function fallbackPlanner(prompt: string): PlannerPayload {
  const lower = prompt.toLowerCase();

  if (lower.includes('scaffold') || lower.includes('full-stack') || lower.includes('fullstack')) {
    const backend = lower.includes('fastapi') ? 'fastapi' : 'express';
    const database =
      lower.includes('prisma') && !lower.includes('supabase')
        ? 'prisma'
        : lower.includes('supabase') && !lower.includes('prisma')
          ? 'supabase'
          : 'both';

    return {
      objective: prompt,
      actions: [
        {
          tool: 'scaffold_fullstack_project',
          reason: 'User asked for full-stack project generation.',
          input: {
            projectName: 'aetherforge-generated-app',
            backend,
            database,
            overwrite: false
          }
        }
      ]
    };
  }

  if (lower.includes('api layout') || lower.includes('endpoint graph')) {
    return {
      objective: prompt,
      actions: [
        {
          tool: 'generate_backend_code',
          reason: 'User requested backend/API generation based on visual builder.',
          input: {}
        }
      ]
    };
  }

  const urlMatch = prompt.match(/https?:\/\/[^\s)]+/i);
  if (urlMatch) {
    return {
      objective: prompt,
      actions: [
        {
          tool: 'analyze_url_replicate_ui',
          reason: 'The user asked for URL analysis or UI replication.',
          input: { url: urlMatch[0] }
        }
      ]
    };
  }

  const terminalMatch = prompt.match(/(?:run|execute)\s+`([^`]+)`/i);
  if (terminalMatch?.[1]) {
    return {
      objective: prompt,
      actions: [
        {
          tool: 'run_terminal',
          reason: 'Requested command execution.',
          input: { command: terminalMatch[1] }
        }
      ]
    };
  }

  return {
    objective: prompt,
    actions: []
  };
}

function parsePlannerPayload(text: string, fallbackPrompt: string): PlannerPayload {
  const json = extractJson(text);
  if (!json) {
    return fallbackPlanner(fallbackPrompt);
  }

  try {
    const parsed = JSON.parse(json) as Partial<PlannerPayload>;
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.filter((action): action is AgentToolCall => {
          if (!action || typeof action !== 'object') {
            return false;
          }
          const candidate = action as Partial<AgentToolCall>;
          if (
            typeof candidate.tool !== 'string' ||
            typeof candidate.input !== 'object' ||
            candidate.input === null
          ) {
            return false;
          }
          return ALLOWED_AGENT_TOOLS.has(candidate.tool as AgentToolName);
        })
      : [];

    return {
      objective: parsed.objective && typeof parsed.objective === 'string' ? parsed.objective : fallbackPrompt,
      actions
    };
  } catch {
    return fallbackPlanner(fallbackPrompt);
  }
}

const PLANNER_SYSTEM = [
  'You are Planner Agent for AetherForge IDE.',
  'Decide which workspace tools to call to satisfy the user request.',
  'Prefer the smallest set of tools that achieves the goal.',
  'When provider-native function calling is available, emit tool calls. Otherwise, return strict JSON only:',
  '{"objective":"...","actions":[{"tool":"read_file|write_file|run_terminal|analyze_url_replicate_ui|apply_canvas_layout|apply_api_layout|apply_db_layout|generate_backend_code|scaffold_fullstack_project","reason":"...","input":{}}]}',
  'Only include tools that are truly needed.'
].join('\n');

type ResolvedPlan = {
  plan: PlannerPayload;
  rawText: string;
  providerUsage?: ProviderUsage;
};

async function resolvePlan(input: OrchestrationInput): Promise<ResolvedPlan> {
  if (input.settings.apiKey.trim().length > 0 && input.settings.provider !== 'ollama') {
    try {
      const native = await planWithNativeTools({
        settings: input.settings,
        systemPrompt: PLANNER_SYSTEM,
        userPrompt: input.prompt,
        signal: input.signal
      });

      if (native && native.actions.length > 0) {
        return {
          plan: { objective: native.objective, actions: native.actions },
          rawText: native.rawText,
          providerUsage: native.usage
        };
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      // Fall through to JSON-text planner; surface the cause via rawText for the trace.
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[orchestration] native tool calling failed, falling back to JSON planner:', message);
    }
  }

  const text = await requestLLM({
    settings: input.settings,
    signal: input.signal,
    systemPrompt: PLANNER_SYSTEM,
    userPrompt: input.prompt
  });

  return {
    plan: parsePlannerPayload(text, input.prompt),
    rawText: text
  };
}

export async function runOrchestration(input: OrchestrationInput): Promise<OrchestrationResult> {
  const steps: AgentExecutionStep[] = [];

  const plannerStep = createStep('planner', 'Plan task', 'Generating multi-agent plan with tool calls.');
  steps.push(plannerStep);

  try {
    const { plan, rawText: plannerReply, providerUsage: plannerUsage } = await resolvePlan(input);
    const normalizedPlan: PlannerPayload = {
      ...plan,
      actions: plan.actions.slice(0, 8)
    };

    const plannerInTok =
      plannerUsage?.inputTokens ?? estimateRoughTokens(`${PLANNER_SYSTEM}\n${input.prompt}`);
    const plannerOutTok = plannerUsage?.outputTokens ?? estimateRoughTokens(plannerReply);

    steps[0] = completeStep(plannerStep, `Planned ${normalizedPlan.actions.length} tool action(s).`);

    const toolResults: AgentToolResult[] = [];
    const dagNodes: ToolDagNode[] = normalizedPlan.actions.map((action) => ({ ...action }));
    const waves = dagNodes.length > 0 ? planWaves(dagNodes) : [];

    for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
      if (input.signal.aborted) {
        throw new DOMException('Canceled', 'AbortError');
      }

      const wave = waves[waveIdx];
      const waveSteps = wave.map((nodeIdx) => {
        const action = normalizedPlan.actions[nodeIdx];
        const step = createStep(
          'coder',
          `Execute tool: ${action.tool}`,
          action.reason ?? 'Executing planned action.',
          {
            tool: action.tool,
            wave: waveIdx
          }
        );
        steps.push(step);
        return { step, action };
      });

      const settled = await Promise.allSettled(
        waveSteps.map(({ action }) => executeAgentTool(action, input.signal))
      );

      settled.forEach((outcome, i) => {
        const { step } = waveSteps[i];
        const idx = steps.findIndex((candidate) => candidate.id === step.id);
        if (outcome.status === 'fulfilled') {
          toolResults.push(outcome.value);
          if (idx >= 0) {
            steps[idx] = completeStep(
              step,
              `${outcome.value.ok ? 'Success' : 'Failed'}: ${outcome.value.output.slice(0, 280)}`
            );
          }
        } else {
          const reason = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
          if (idx >= 0) {
            steps[idx] = failStep(step, reason || 'Tool execution failed');
          }
        }
      });
    }

    const reviewerStep = createStep('reviewer', 'Review outcomes', 'Summarizing execution and next actions.');
    steps.push(reviewerStep);

    const reviewerPrompt = [
      `User request:\n${input.prompt}`,
      `Planned objective:\n${normalizedPlan.objective}`,
      `Tool results:\n${JSON.stringify(toolResults, null, 2)}`,
      'Provide a concise implementation summary and mention any failed actions with recovery guidance.'
    ].join('\n\n');

    const reviewerSystem = 'You are Reviewer Agent. Produce clear actionable summary.';
    const reviewerReply = await requestLLM({
      settings: input.settings,
      signal: input.signal,
      systemPrompt: reviewerSystem,
      userPrompt: reviewerPrompt,
      onToken: input.onReviewerChunk
    });

    const reviewerInTok = estimateRoughTokens(`${reviewerSystem}\n${reviewerPrompt}`);
    const reviewerOutTok = estimateRoughTokens(reviewerReply);

    const totalIn = plannerInTok + reviewerInTok;
    const totalOut = plannerOutTok + reviewerOutTok;
    const costUsdRough = estimateCostUsdRough(input.settings.provider, totalIn, totalOut);

    const usageEstimate: TokenUsageEstimate = {
      plannerInput: plannerInTok,
      plannerOutput: plannerOutTok,
      reviewerInput: reviewerInTok,
      reviewerOutput: reviewerOutTok,
      costUsdRough
    };

    steps[steps.length - 1] = completeStep(reviewerStep, 'Review completed.');

    return {
      response: reviewerReply,
      steps,
      usageEstimate
    };
  } catch (error) {
    const lastIndex = steps.length - 1;
    if (lastIndex >= 0) {
      steps[lastIndex] = failStep(
        steps[lastIndex],
        error instanceof Error ? error.message : 'Orchestration failed'
      );
    }

    throw Object.assign(new Error(error instanceof Error ? error.message : 'Orchestration failed'), {
      steps
    });
  }
}
