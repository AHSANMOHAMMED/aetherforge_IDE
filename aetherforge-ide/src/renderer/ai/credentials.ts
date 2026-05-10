import { create } from 'zustand';

/** Legacy single-slot secret (migrated to `aetherforge.ai.key.openai`). */
export const LEGACY_API_KEY_SECRET = 'aetherforge.ai.apiKey';

export function apiKeySecretKey(providerId: string): string {
  return `aetherforge.ai.key.${providerId}`;
}

export function oauthSecretKey(providerId: string): string {
  return `aetherforge.ai.oauth.${providerId}`;
}

export type OAuthBundle = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  login?: string;
};

export type CredentialStatus = 'none' | 'key-saved' | 'oauth-connected' | 'expired';

function hasElectronSecrets(): boolean {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  return Boolean(api && typeof api.getSecret === 'function' && typeof api.setSecret === 'function');
}

async function safeGetSecret(key: string): Promise<string | null> {
  if (!hasElectronSecrets()) {
    return null;
  }
  const r = await window.electronAPI.getSecret({ key });
  return r.ok ? (r.value ?? null) : null;
}

async function safeSetSecret(key: string, value: string): Promise<void> {
  if (!hasElectronSecrets()) {
    return;
  }
  await window.electronAPI.setSecret({ key, value });
}

async function safeDeleteSecret(key: string): Promise<void> {
  if (!hasElectronSecrets()) {
    return;
  }
  await window.electronAPI.deleteSecret({ key });
}

/** Read API key for a provider; migrates legacy global slot into OpenAI once. */
export async function readApiKey(providerId: string): Promise<string> {
  const direct = await safeGetSecret(apiKeySecretKey(providerId));
  if (direct?.trim()) {
    return direct.trim();
  }
  if (providerId === 'openai' || providerId === 'chatgpt' || providerId === 'codex') {
    const legacy = await safeGetSecret(LEGACY_API_KEY_SECRET);
    if (legacy?.trim()) {
      await safeSetSecret(apiKeySecretKey('openai'), legacy.trim());
      await safeDeleteSecret(LEGACY_API_KEY_SECRET);
      return legacy.trim();
    }
  }
  return '';
}

export async function writeApiKey(providerId: string, key: string): Promise<void> {
  const k = apiKeySecretKey(providerId);
  if (key.trim().length > 0) {
    await safeSetSecret(k, key.trim());
    if (providerId === 'openai' || providerId === 'chatgpt' || providerId === 'codex') {
      await safeDeleteSecret(LEGACY_API_KEY_SECRET);
    }
  } else {
    await safeDeleteSecret(k);
  }
}

export async function readOAuthBundle(providerId: string): Promise<OAuthBundle | null> {
  const raw = await safeGetSecret(oauthSecretKey(providerId));
  if (!raw?.trim()) {
    return null;
  }
  try {
    const v = JSON.parse(raw) as OAuthBundle;
    return v?.accessToken ? v : null;
  } catch {
    return null;
  }
}

export async function writeOAuthBundle(providerId: string, bundle: OAuthBundle | null): Promise<void> {
  const k = oauthSecretKey(providerId);
  if (!bundle?.accessToken) {
    await safeDeleteSecret(k);
    return;
  }
  await safeSetSecret(k, JSON.stringify(bundle));
}

export function oauthExpired(bundle: OAuthBundle | null): boolean {
  if (!bundle?.expiresAt) {
    return false;
  }
  return Date.now() > bundle.expiresAt - 60_000;
}

/** Prefer OAuth bearer when valid; otherwise API key. */
export async function resolveAuthToken(providerId: string): Promise<string> {
  const oauth = await readOAuthBundle(providerId);
  if (oauth?.accessToken && !oauthExpired(oauth)) {
    return oauth.accessToken;
  }
  return readApiKey(providerId);
}

export async function credentialStatusFor(providerId: string): Promise<{
  status: CredentialStatus;
  loginHint?: string;
}> {
  const oauth = await readOAuthBundle(providerId);
  const key = await readApiKey(providerId);
  if (oauth?.accessToken) {
    if (oauthExpired(oauth)) {
      return { status: 'expired', loginHint: oauth.login };
    }
    return { status: 'oauth-connected', loginHint: oauth.login };
  }
  if (key.trim().length > 0) {
    return { status: 'key-saved' };
  }
  return { status: 'none' };
}

type CredentialsStore = {
  version: number;
  bump: () => void;
  refreshAll: () => Promise<void>;
};

export const useCredentialsStore = create<CredentialsStore>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
  refreshAll: async () => {
    set((s) => ({ version: s.version + 1 }));
  }
}));

let refreshTimer: ReturnType<typeof setInterval> | null = null;

/** Poll OAuth expiry (e.g. Copilot ~30m) and bump credentials UI. */
export function startCredentialRefreshScheduler(): void {
  if (refreshTimer || typeof window === 'undefined') {
    return;
  }
  refreshTimer = setInterval(() => {
    void useCredentialsStore.getState().refreshAll();
  }, 60_000);
}
