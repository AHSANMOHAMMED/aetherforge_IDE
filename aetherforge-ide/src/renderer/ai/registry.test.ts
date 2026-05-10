import { describe, expect, it } from 'vitest';
import { AI_PROVIDER_IDS, getProvider, isAIProviderId } from './registry';

describe('ai registry', () => {
  it('exposes 12 providers', () => {
    expect(AI_PROVIDER_IDS.length).toBe(12);
  });

  it.each([
    'openai',
    'claude',
    'gemini',
    'kimi',
    'copilot',
    'codex',
    'chatgpt',
    'groq',
    'mistral',
    'openrouter',
    'grok',
    'ollama'
  ] as const)('getProvider(%s) returns a descriptor', (id) => {
    const p = getProvider(id);
    expect(p).toBeDefined();
    expect(p?.id).toBe(id);
    expect(p?.family).toBeTruthy();
    expect(isAIProviderId(id)).toBe(true);
  });

  it('rejects unknown ids', () => {
    expect(getProvider('not-a-provider')).toBeUndefined();
    expect(isAIProviderId('not-a-provider')).toBe(false);
  });
});
