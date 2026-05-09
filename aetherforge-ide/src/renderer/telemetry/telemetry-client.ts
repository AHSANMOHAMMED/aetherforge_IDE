import { useAccountStore } from '@/renderer/auth/account-store';
import { cloudFetch, getCloudApiBaseUrl } from '@/renderer/cloud/cloud-fetch';

/** Best-effort POST of activity-style telemetry to the cloud API when signed in. */
export async function maybeForwardActivityToTelemetry(
  kind: string,
  message: string,
  options?: { severity?: string; detail?: string }
): Promise<void> {
  if (typeof window === 'undefined') return;
  const airgap = (window as unknown as { __AETHERFORGE_AIRGAP__?: boolean }).__AETHERFORGE_AIRGAP__;
  if (airgap) return;
  const session = useAccountStore.getState().session;
  if (!session) return;
  const url = new URL('/v1/telemetry/event', getCloudApiBaseUrl());
  try {
    await cloudFetch(url, {
      method: 'POST',
      body: JSON.stringify({
        event: `activity.${kind}`,
        properties: { message, severity: options?.severity ?? 'info', detail: options?.detail }
      })
    });
  } catch {
    // ignore network failures
  }
}
