export type { paths, components } from './generated/api.js';

export type HealthResponse = { ok: boolean; service: string; version: string };
export type DeviceFlowStart = {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  verificationUrlComplete: string;
  expiresIn: number;
  interval: number;
};
export type DeviceFlowPoll =
  | { ok: true; token: string; userId: string }
  | { ok: false; status?: string; error?: string };
export type Plan = {
  id: 'free' | 'pro' | 'team' | 'enterprise';
  monthlyUsd: number | null;
  includedTokens: number | null;
  seats?: number;
  contact?: string;
};
export type CheckoutSession = { ok: boolean; url: string; sessionId?: string; stub?: boolean };
export type ManifestFile = { path: string; sha256: string; bytes: number };
export type ManifestResponse = {
  ok: boolean;
  acceptedFiles: number;
  uploadUrls: Array<{ path: string; url: string; method: 'PUT'; expiresAt: number; stub: boolean }>;
};

export class AetherForgeClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token?: string
  ) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  async fetchHealth(): Promise<HealthResponse> {
    return fetchHealth(this.baseUrl);
  }

  async startDeviceFlow(): Promise<DeviceFlowStart> {
    const res = await fetch(new URL('/v1/auth/device/start', this.baseUrl), {
      method: 'POST',
      headers: this.headers()
    });
    if (!res.ok) throw new Error(`device flow start failed: ${res.status}`);
    return (await res.json()) as DeviceFlowStart;
  }

  async pollDeviceFlow(deviceCode: string): Promise<DeviceFlowPoll> {
    const res = await fetch(new URL('/v1/auth/device/poll', this.baseUrl), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ deviceCode })
    });
    return (await res.json()) as DeviceFlowPoll;
  }

  async listPlans(): Promise<{ plans: Plan[] }> {
    const res = await fetch(new URL('/v1/billing/plans', this.baseUrl), { headers: this.headers() });
    return (await res.json()) as { plans: Plan[] };
  }

  async createCheckoutSession(plan: Plan['id']): Promise<CheckoutSession> {
    const res = await fetch(new URL('/v1/billing/checkout-session', this.baseUrl), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ plan })
    });
    return (await res.json()) as CheckoutSession;
  }

  async submitManifest(workspaceId: string, files: ManifestFile[]): Promise<ManifestResponse> {
    const res = await fetch(new URL('/v1/sync/manifest', this.baseUrl), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ workspaceId, files })
    });
    return (await res.json()) as ManifestResponse;
  }
}

export async function fetchHealth(baseUrl: string): Promise<HealthResponse> {
  const res = await fetch(new URL('/health', baseUrl));
  if (!res.ok) {
    throw new Error(`health failed: ${res.status}`);
  }
  return (await res.json()) as HealthResponse;
}
