import { GoogleGenerativeAI } from '@google/generative-ai';
import { ALLOWED_AGENT_TOOLS, toAnthropicTools, toGeminiTools, toOpenAITools } from './tool-schemas';
import type { AgentToolCall, AgentToolName, ProviderSettings } from './types';

export type ProviderUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export type PlannerResult = {
  objective: string;
  actions: AgentToolCall[];
  rawText: string;
  usage?: ProviderUsage;
  /** When true, the provider returned no native tool calls and the caller should fall back to JSON parsing. */
  fallback: boolean;
};

type ToolCallingInput = {
  settings: ProviderSettings;
  systemPrompt: string;
  userPrompt: string;
  signal: AbortSignal;
};

const OPENAI_COMPATIBLE_PROVIDERS: ReadonlySet<string> = new Set([
  'openai',
  'chatgpt',
  'codex',
  'grok',
  'groq',
  'mistral',
  'openrouter',
  'kimi',
  'copilot'
]);

function safeParse(json: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(json) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function endpointForOpenAICompatible(provider: string, baseUrl?: string): string {
  if (baseUrl) {
    return baseUrl;
  }
  switch (provider) {
    case 'openai':
    case 'chatgpt':
    case 'codex':
      return 'https://api.openai.com/v1/chat/completions';
    case 'grok':
      return 'https://api.x.ai/v1/chat/completions';
    case 'groq':
      return 'https://api.groq.com/openai/v1/chat/completions';
    case 'mistral':
      return 'https://api.mistral.ai/v1/chat/completions';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions';
    case 'kimi':
      return 'https://api.moonshot.cn/v1/chat/completions';
    case 'copilot':
      return 'https://api.githubcopilot.com/chat/completions';
    default:
      return 'https://api.openai.com/v1/chat/completions';
  }
}

function extraHeadersFor(provider: string): Record<string, string> {
  if (provider === 'openrouter') {
    return {
      'HTTP-Referer': 'https://github.com/aetherforge/aetherforge-ide',
      'X-Title': 'AetherForge IDE'
    };
  }
  if (provider === 'copilot') {
    return {
      'Editor-Version': 'AetherForge/1.0.0',
      'Copilot-Integration-Id': 'vscode-chat',
      'User-Agent': 'AetherForge-IDE/1.0'
    };
  }
  return {};
}

async function planWithOpenAITools(input: ToolCallingInput): Promise<PlannerResult> {
  const endpoint = endpointForOpenAICompatible(input.settings.provider, input.settings.baseUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.settings.apiKey}`,
      ...extraHeadersFor(input.settings.provider)
    },
    body: JSON.stringify({
      model: input.settings.model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt }
      ],
      tools: toOpenAITools(),
      tool_choice: 'auto'
    }),
    signal: input.signal
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Planner request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          type?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const message = data.choices?.[0]?.message;
  const calls = message?.tool_calls ?? [];
  const actions: AgentToolCall[] = [];

  for (const call of calls) {
    const name = call.function?.name as AgentToolName | undefined;
    if (!name || !ALLOWED_AGENT_TOOLS.has(name)) {
      continue;
    }
    const args = call.function?.arguments ? safeParse(call.function.arguments) : {};
    actions.push({
      tool: name,
      input: args ?? {},
      reason: 'Tool requested by provider via native function calling.'
    });
  }

  return {
    objective: input.userPrompt,
    actions,
    rawText: typeof message?.content === 'string' ? message.content : '',
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens
    },
    fallback: actions.length === 0
  };
}

async function planWithAnthropicTools(input: ToolCallingInput): Promise<PlannerResult> {
  const baseUrl = input.settings.baseUrl ?? 'https://api.anthropic.com/v1/messages';
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': input.settings.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: input.settings.model,
      max_tokens: 2048,
      system: input.systemPrompt,
      messages: [{ role: 'user', content: input.userPrompt }],
      tools: toAnthropicTools()
    }),
    signal: input.signal
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Planner request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: Array<
      { type: 'text'; text?: string } | { type: 'tool_use'; name?: string; input?: Record<string, unknown> }
    >;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const actions: AgentToolCall[] = [];
  let rawText = '';

  for (const block of data.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string') {
      rawText += block.text;
    } else if (block.type === 'tool_use') {
      const name = block.name as AgentToolName | undefined;
      if (!name || !ALLOWED_AGENT_TOOLS.has(name)) {
        continue;
      }
      actions.push({
        tool: name,
        input: (block.input ?? {}) as Record<string, unknown>,
        reason: 'Tool requested by provider via native tool_use.'
      });
    }
  }

  return {
    objective: input.userPrompt,
    actions,
    rawText,
    usage: {
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens
    },
    fallback: actions.length === 0
  };
}

async function planWithGeminiTools(input: ToolCallingInput): Promise<PlannerResult> {
  const genAI = new GoogleGenerativeAI(input.settings.apiKey);
  const modelName = input.settings.model.replace(/^models\//, '');
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: input.systemPrompt,
    // The @google/generative-ai SDK expects an internal SchemaType enum; the JSON schemas we hand it
    // are wire-compatible, so we cast to satisfy its narrower TypeScript signature.
    tools: toGeminiTools() as unknown as Parameters<typeof genAI.getGenerativeModel>[0]['tools']
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }]
  });
  const response = result.response;
  const candidate = response.candidates?.[0];

  const actions: AgentToolCall[] = [];
  let rawText = '';

  for (const part of candidate?.content?.parts ?? []) {
    const fnCall = (part as { functionCall?: { name?: string; args?: Record<string, unknown> } })
      .functionCall;
    if (fnCall?.name) {
      const name = fnCall.name as AgentToolName;
      if (!ALLOWED_AGENT_TOOLS.has(name)) {
        continue;
      }
      actions.push({
        tool: name,
        input: fnCall.args ?? {},
        reason: 'Tool requested by provider via Gemini function calling.'
      });
      continue;
    }
    if (typeof (part as { text?: string }).text === 'string') {
      rawText += (part as { text?: string }).text;
    }
  }

  const usageMetadata = (
    response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }
  ).usageMetadata;

  return {
    objective: input.userPrompt,
    actions,
    rawText,
    usage: {
      inputTokens: usageMetadata?.promptTokenCount,
      outputTokens: usageMetadata?.candidatesTokenCount
    },
    fallback: actions.length === 0
  };
}

/**
 * Try provider-native tool calling. Returns `fallback: true` (and an empty actions list) when the
 * provider returned only text — the caller should run the JSON-extraction planner as a backup.
 * Throws on transport / auth errors; the caller already wraps these with retry logic.
 */
export async function planWithNativeTools(input: ToolCallingInput): Promise<PlannerResult | null> {
  const provider = input.settings.provider;
  if (OPENAI_COMPATIBLE_PROVIDERS.has(provider)) {
    return planWithOpenAITools(input);
  }
  if (provider === 'claude') {
    return planWithAnthropicTools(input);
  }
  if (provider === 'gemini') {
    return planWithGeminiTools(input);
  }
  return null;
}
