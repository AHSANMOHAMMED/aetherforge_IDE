export type AuthMethod = 'api-key' | 'oauth-device' | 'oauth-pkce' | 'cli-bridge';

export type ProviderFamily = 'openai-compatible' | 'anthropic' | 'gemini' | 'ollama' | 'copilot';

export type ProviderDescriptor = {
  id: string;
  label: string;
  authMethods: AuthMethod[];
  defaultModel: string;
  endpoint?: string;
  family: ProviderFamily;
  signupUrl?: string;
  capabilities: { stream: boolean; tools: boolean; vision: boolean };
};

const cap = { stream: true, tools: true, vision: true } as const;
const capNoVision = { stream: true, tools: true, vision: false } as const;

function desc<const I extends string>(
  id: I,
  label: string,
  family: ProviderFamily,
  authMethods: AuthMethod[],
  defaultModel: string,
  rest: Partial<Omit<ProviderDescriptor, 'id' | 'label' | 'family' | 'authMethods' | 'defaultModel'>>
): ProviderDescriptor & { readonly id: I } {
  return {
    id,
    label,
    family,
    authMethods,
    defaultModel,
    capabilities: rest.capabilities ?? cap,
    endpoint: rest.endpoint,
    signupUrl: rest.signupUrl
  };
}

/** Canonical provider catalog (12). */
export const PROVIDERS = [
  desc('openai', 'OpenAI', 'openai-compatible', ['api-key', 'oauth-pkce'], 'gpt-4.1-mini', {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    signupUrl: 'https://platform.openai.com/api-keys',
    capabilities: capNoVision
  }),
  desc('chatgpt', 'ChatGPT (OpenAI account)', 'openai-compatible', ['oauth-pkce', 'api-key'], 'gpt-4o-mini', {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    signupUrl: 'https://chat.openai.com',
    capabilities: capNoVision
  }),
  desc('codex', 'OpenAI Codex', 'openai-compatible', ['oauth-pkce', 'api-key'], 'gpt-4.1', {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    signupUrl: 'https://platform.openai.com/docs/guides/codex',
    capabilities: capNoVision
  }),
  desc('claude', 'Anthropic Claude', 'anthropic', ['api-key'], 'claude-3-5-sonnet-latest', {
    signupUrl: 'https://console.anthropic.com/settings/keys',
    capabilities: capNoVision
  }),
  desc('gemini', 'Google Gemini', 'gemini', ['api-key', 'oauth-pkce'], 'gemini-2.0-flash', {
    signupUrl: 'https://aistudio.google.com/apikey',
    capabilities: cap
  }),
  desc('kimi', 'Kimi (Moonshot)', 'openai-compatible', ['api-key'], 'moonshot-v1-8k', {
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    signupUrl: 'https://platform.moonshot.cn/console/api-keys',
    capabilities: capNoVision
  }),
  desc('copilot', 'GitHub Copilot', 'copilot', ['oauth-device', 'api-key'], 'gpt-4o', {
    endpoint: 'https://api.githubcopilot.com/chat/completions',
    signupUrl: 'https://github.com/settings/copilot',
    capabilities: capNoVision
  }),
  desc('grok', 'xAI Grok', 'openai-compatible', ['api-key'], 'grok-2-latest', {
    endpoint: 'https://api.x.ai/v1/chat/completions',
    signupUrl: 'https://console.x.ai/',
    capabilities: capNoVision
  }),
  desc('groq', 'Groq', 'openai-compatible', ['api-key'], 'llama-3.3-70b-versatile', {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    signupUrl: 'https://console.groq.com/keys',
    capabilities: capNoVision
  }),
  desc('mistral', 'Mistral', 'openai-compatible', ['api-key'], 'mistral-small-latest', {
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    signupUrl: 'https://console.mistral.ai/api-keys/',
    capabilities: capNoVision
  }),
  desc('openrouter', 'OpenRouter', 'openai-compatible', ['api-key'], 'openai/gpt-4o-mini', {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    signupUrl: 'https://openrouter.ai/keys',
    capabilities: capNoVision
  }),
  desc('ollama', 'Ollama (local)', 'ollama', [] as AuthMethod[], 'llama3.1:8b', {
    endpoint: 'http://localhost:11434/api/chat',
    signupUrl: 'https://ollama.com/download',
    capabilities: { stream: true, tools: false, vision: false }
  })
] as const satisfies readonly ProviderDescriptor[];

export type AIProviderId = (typeof PROVIDERS)[number]['id'];

export const AI_PROVIDER_IDS = PROVIDERS.map((p) => p.id) as readonly AIProviderId[];

const byId = new Map<string, ProviderDescriptor>(PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: string): ProviderDescriptor | undefined {
  return byId.get(id);
}

export function isAIProviderId(value: string): value is AIProviderId {
  return byId.has(value);
}

export function defaultModelFor(id: string): string {
  return getProvider(id)?.defaultModel ?? 'gpt-4o-mini';
}
