import type { AIProviderId } from './types';

/** Heuristic ~4 chars per token (English-ish code). */
export function estimateRoughTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Very rough blended $/1M tokens for UI only (not billing). */
const ROUGH_USD_PER_MILLION: Partial<Record<AIProviderId, { in: number; out: number }>> = {
  openai: { in: 2.5, out: 10 },
  chatgpt: { in: 2.5, out: 10 },
  codex: { in: 2.5, out: 10 },
  claude: { in: 3, out: 15 },
  grok: { in: 2, out: 10 },
  gemini: { in: 0.15, out: 0.6 },
  mistral: { in: 0.5, out: 1.5 },
  openrouter: { in: 1, out: 4 },
  groq: { in: 0.1, out: 0.3 },
  kimi: { in: 0.2, out: 0.2 },
  copilot: { in: 0, out: 0 },
  ollama: { in: 0, out: 0 }
};

export function estimateCostUsdRough(
  provider: AIProviderId | string,
  inputTokens: number,
  outputTokens: number
): number | undefined {
  const rates = ROUGH_USD_PER_MILLION[provider as AIProviderId];
  if (!rates || (rates.in === 0 && rates.out === 0)) {
    return undefined;
  }
  return (inputTokens / 1_000_000) * rates.in + (outputTokens / 1_000_000) * rates.out;
}
