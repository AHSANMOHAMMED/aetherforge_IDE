import { describe, expect, it } from 'vitest';
import { apiKeySecretKey, oauthSecretKey, LEGACY_API_KEY_SECRET } from './credentials';

describe('credentials key helpers', () => {
  it('namespaces API keys per provider', () => {
    expect(apiKeySecretKey('openai')).toBe('aetherforge.ai.key.openai');
    expect(apiKeySecretKey('copilot')).toBe('aetherforge.ai.key.copilot');
  });

  it('namespaces OAuth bundles per provider', () => {
    expect(oauthSecretKey('github')).toBe('aetherforge.ai.oauth.github');
  });

  it('keeps legacy constant stable for migration', () => {
    expect(LEGACY_API_KEY_SECRET).toBe('aetherforge.ai.apiKey');
  });
});
