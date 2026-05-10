import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Shield, X } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useAIStore } from './store';
import { PROVIDER_DEFAULT_MODEL } from './providers';
import { PROVIDERS, getProvider, type AIProviderId } from './registry';
import type { GuardedToolName, ToolPermissionPolicy } from './types';
import { credentialStatusFor, useCredentialsStore, writeApiKey, type CredentialStatus } from './credentials';
import { useSettingsStore } from '@/renderer/state/settings-store';
import { signInGithubCopilot } from './auth/github-device';
import { signInOpenAiPkce } from './auth/openai-pkce';
import { signInGoogleGemini } from './auth/google-pkce';
import { openSignupUrl } from './auth/apikey-onboarding';
import { forwardRendererTelemetry } from '@/renderer/telemetry/telemetry-client';
import { cloudFetch, getCloudApiBaseUrl } from '@/renderer/cloud/cloud-fetch';
import { useAccountStore } from '@/renderer/auth/account-store';

const TOS_KEY = 'aetherforge.ai.oauth.tos.dismissed';

const FALLBACK_MODELS: Partial<Record<string, string[]>> = {
  openai: ['gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o4-mini'],
  chatgpt: ['gpt-4o-mini', 'gpt-4o'],
  codex: ['gpt-4.1', 'gpt-4o', 'o4-mini'],
  claude: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  kimi: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  copilot: ['gpt-4o', 'gpt-4'],
  grok: ['grok-2-latest'],
  groq: ['llama-3.3-70b-versatile'],
  mistral: ['mistral-small-latest'],
  openrouter: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet'],
  ollama: ['llama3.1:8b', 'mistral', 'phi3']
};

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

function statusLabel(s: CredentialStatus, hint?: string): string {
  switch (s) {
    case 'oauth-connected':
      return hint ? `Connected (${hint})` : 'Connected (OAuth)';
    case 'key-saved':
      return 'API key saved';
    case 'expired':
      return 'Session expired — reconnect';
    default:
      return 'Not configured';
  }
}

export type AIProviderModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AIProviderModal(props: AIProviderModalProps): ReactElement {
  const settings = useAIStore((s) => s.settings);
  const setSettings = useAIStore((s) => s.setSettings);
  const hydrateProviderSecrets = useAIStore((s) => s.hydrateProviderSecrets);
  const toolPolicies = useAIStore((s) => s.toolPolicies);
  const sessionToolGrants = useAIStore((s) => s.sessionToolGrants);
  const setToolPolicy = useAIStore((s) => s.setToolPolicy);
  const clearSessionToolGrants = useAIStore((s) => s.clearSessionToolGrants);

  const aiSettings = useSettingsStore((s) => s.ai);
  const setAi = useSettingsStore((s) => s.setAi);
  const credVersion = useCredentialsStore((s) => s.version);
  const bumpCreds = useCredentialsStore((s) => s.bump);

  const [tab, setTab] = useState<'providers' | 'policies'>('providers');
  const [tosHidden, setTosHidden] = useState(() => {
    try {
      return localStorage.getItem(TOS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [statusMap, setStatusMap] = useState<
    Record<string, { status: CredentialStatus; loginHint?: string }>
  >({});
  const [cloudModels, setCloudModels] = useState<Partial<Record<string, string[]>>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [keyDrafts, setKeyDrafts] = useState<Partial<Record<string, string>>>({});

  const refreshStatuses = useCallback(async () => {
    const next: Record<string, { status: CredentialStatus; loginHint?: string }> = {};
    for (const p of PROVIDERS) {
      next[p.id] = await credentialStatusFor(p.id);
    }
    setStatusMap(next);
  }, []);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    void refreshStatuses();
  }, [props.open, credVersion, refreshStatuses]);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    const session = useAccountStore.getState().session;
    if (!session) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Partial<Record<string, string[]>> = {};
      for (const p of PROVIDERS) {
        try {
          const url = new URL('/v1/ai/proxy/models', getCloudApiBaseUrl());
          url.searchParams.set('provider', p.id);
          const r = await cloudFetch(url, { method: 'GET' });
          if (!r.ok) {
            continue;
          }
          const j = (await r.json()) as { models?: string[] };
          if (Array.isArray(j.models) && j.models.length > 0) {
            next[p.id] = j.models;
          }
        } catch {
          // ignore
        }
      }
      if (!cancelled) {
        setCloudModels(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open]);

  const dismissTos = (): void => {
    try {
      localStorage.setItem(TOS_KEY, '1');
    } catch {
      // ignore
    }
    setTosHidden(true);
  };

  const onConnect = async (id: AIProviderId): Promise<void> => {
    setBusyId(id);
    try {
      if (id === 'copilot') {
        await signInGithubCopilot();
        await forwardRendererTelemetry('ai.provider.connected', { provider: id, method: 'oauth-device' });
      } else if (id === 'chatgpt') {
        await signInOpenAiPkce('chatgpt');
        await forwardRendererTelemetry('ai.provider.connected', { provider: id, method: 'oauth-pkce' });
      } else if (id === 'codex') {
        await signInOpenAiPkce('codex');
        await forwardRendererTelemetry('ai.provider.connected', { provider: id, method: 'oauth-pkce' });
      } else if (id === 'gemini') {
        await signInGoogleGemini();
        await forwardRendererTelemetry('ai.provider.connected', { provider: id, method: 'oauth-pkce' });
      }
      bumpCreds();
      await hydrateProviderSecrets(id);
    } catch (e) {
      console.error(e);
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const saveApiKey = async (id: AIProviderId): Promise<void> => {
    const v = keyDrafts[id] ?? '';
    await writeApiKey(id, v);
    bumpCreds();
    if (settings.provider === id) {
      await hydrateProviderSecrets(id);
    }
    await forwardRendererTelemetry('ai.provider.connected', { provider: id, method: 'api-key' });
  };

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(920px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-white/10 bg-slate-950 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <Dialog.Title className="text-foreground text-sm font-semibold">AI providers</Dialog.Title>
            <Dialog.Close
              type="button"
              className="text-muted-foreground hover:text-foreground rounded p-1 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="flex gap-2 border-b border-white/10 px-4 py-2">
            <button
              type="button"
              className={`rounded px-3 py-1 text-xs ${tab === 'providers' ? 'bg-cyan-500/20 text-cyan-100' : 'text-muted-foreground hover:bg-white/5'}`}
              onClick={() => setTab('providers')}
            >
              Providers
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded px-3 py-1 text-xs ${tab === 'policies' ? 'bg-cyan-500/20 text-cyan-100' : 'text-muted-foreground hover:bg-white/5'}`}
              onClick={() => setTab('policies')}
            >
              <Shield className="h-3 w-3" />
              Tool policies
            </button>
          </div>

          <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-4">
            {tab === 'providers' ? (
              <div className="space-y-4">
                {!tosHidden ? (
                  <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">Third-party OAuth notice</p>
                      <p className="mt-1 text-amber-100/90">
                        GitHub Copilot / OpenAI ChatGPT-account / Codex-style OAuth flows are not officially
                        supported for third-party apps and may violate provider Terms of Service or risk
                        account restrictions.
                      </p>
                      <button
                        type="button"
                        className="mt-2 rounded bg-amber-500/30 px-2 py-1 text-[11px] font-medium hover:bg-amber-500/40"
                        onClick={dismissTos}
                      >
                        I understand — hide this banner
                      </button>
                    </div>
                  </div>
                ) : null}

                <label className="text-muted-foreground flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={aiSettings.routeViaCloud}
                    onChange={(e) => setAi({ routeViaCloud: e.target.checked })}
                  />
                  Route chat via AetherForge cloud proxy when signed in (requires backend + session)
                </label>

                <label className="text-muted-foreground block text-xs">
                  Cost guard (USD per run, UI hint — enforcement wired in orchestration when set)
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    className="text-foreground mt-1 w-40 rounded border border-white/10 bg-slate-900 px-2 py-1"
                    value={aiSettings.costGuardUsd}
                    onChange={(e) => setAi({ costGuardUsd: Number(e.target.value) || 0 })}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  {PROVIDERS.map((p) => {
                    const st = statusMap[p.id]?.status ?? 'none';
                    const hint = statusMap[p.id]?.loginHint;
                    const models = cloudModels[p.id] ?? FALLBACK_MODELS[p.id] ?? [p.defaultModel];
                    const active = settings.provider === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-lg border p-3 ${active ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/10 bg-white/5'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-foreground text-sm font-medium">{p.label}</p>
                            <p className="text-muted-foreground mt-1 text-[11px]">{statusLabel(st, hint)}</p>
                          </div>
                          <label className="text-muted-foreground flex items-center gap-1 text-[11px]">
                            <input
                              type="radio"
                              name="active-provider"
                              checked={active}
                              onChange={() => {
                                setSettings({
                                  provider: p.id as AIProviderId,
                                  model: PROVIDER_DEFAULT_MODEL[p.id as AIProviderId]
                                });
                                void hydrateProviderSecrets(p.id as AIProviderId);
                              }}
                            />
                            Active
                          </label>
                        </div>

                        <label className="text-muted-foreground mt-2 block text-[11px]">
                          Model
                          <select
                            className="text-foreground mt-1 w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs"
                            value={active ? settings.model : p.defaultModel}
                            onChange={(e) => {
                              if (active) {
                                setSettings({ model: e.target.value });
                              }
                            }}
                            disabled={!active}
                          >
                            {models.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {p.authMethods.includes('api-key') && p.id !== 'ollama' ? (
                            <>
                              <input
                                type="password"
                                className="text-foreground min-w-[140px] flex-1 rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs"
                                placeholder="API key"
                                value={keyDrafts[p.id] ?? ''}
                                onChange={(e) =>
                                  setKeyDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                                }
                              />
                              <button
                                type="button"
                                className="rounded bg-white/10 px-2 py-1 text-[11px] hover:bg-white/15"
                                onClick={() => void saveApiKey(p.id as AIProviderId)}
                              >
                                Save key
                              </button>
                              {getProvider(p.id)?.signupUrl ? (
                                <button
                                  type="button"
                                  className="text-[11px] text-cyan-200 underline"
                                  onClick={() => openSignupUrl(p.id)}
                                >
                                  Get key
                                </button>
                              ) : null}
                            </>
                          ) : null}

                          {p.authMethods.includes('oauth-device') ? (
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              className="rounded bg-cyan-500/25 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-500/35 disabled:opacity-50"
                              onClick={() => void onConnect(p.id as AIProviderId)}
                            >
                              {busyId === p.id ? 'Working…' : 'Sign in (device)'}
                            </button>
                          ) : null}

                          {(p.id === 'chatgpt' || p.id === 'codex') &&
                          p.authMethods.includes('oauth-pkce') ? (
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              className="rounded bg-violet-500/25 px-2 py-1 text-[11px] text-violet-100 hover:bg-violet-500/35 disabled:opacity-50"
                              onClick={() => void onConnect(p.id as AIProviderId)}
                            >
                              {busyId === p.id ? 'Working…' : 'Sign in (browser)'}
                            </button>
                          ) : null}

                          {p.id === 'gemini' && p.authMethods.includes('oauth-pkce') ? (
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              className="rounded bg-violet-500/25 px-2 py-1 text-[11px] text-violet-100 hover:bg-violet-500/35 disabled:opacity-50"
                              onClick={() => void onConnect('gemini')}
                            >
                              {busyId === p.id ? 'Working…' : 'Google sign-in'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-white/10 bg-slate-900/50 p-3">
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
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
