/**
 * Desktop OAuth device flow client.
 *
 * The renderer kicks off the flow via `startDeviceFlow`, which returns a `userCode` to display and
 * a `verificationUrl` to open. While the user authorizes in the browser the renderer polls
 * `pollDeviceFlow` until either a token is returned, the code expires, or the caller cancels via
 * the AbortSignal.
 */

export type DeviceFlowStart = {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  verificationUrlComplete: string;
  expiresIn: number;
  interval: number;
};

export type DeviceFlowResult = { ok: true; token: string; userId: string } | { ok: false; error: string };

function getBaseUrl(): string {
  const env = (import.meta as unknown as { env?: { VITE_AETHERFORGE_API_URL?: string } }).env;
  return env?.VITE_AETHERFORGE_API_URL ?? 'http://localhost:8787';
}

export async function startDeviceFlow(): Promise<DeviceFlowStart> {
  // Fastify rejects `Content-Type: application/json` with an empty body (FST_ERR_CTP_EMPTY_JSON_BODY).
  const res = await fetch(`${getBaseUrl()}/v1/auth/device/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) {
    throw new Error(`device flow start failed: ${res.status}`);
  }
  return (await res.json()) as DeviceFlowStart;
}

export async function pollDeviceFlow(deviceCode: string, signal?: AbortSignal): Promise<DeviceFlowResult> {
  const res = await fetch(`${getBaseUrl()}/v1/auth/device/poll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceCode }),
    signal
  });
  const data = (await res.json()) as
    | { ok: true; token: string; userId: string }
    | { ok: false; status?: 'authorization_pending'; error?: string };
  if ('token' in data && data.ok) {
    return { ok: true, token: data.token, userId: data.userId };
  }
  return { ok: false, error: data.error ?? data.status ?? 'pending' };
}

export async function awaitDeviceFlow(
  start: DeviceFlowStart,
  signal?: AbortSignal
): Promise<DeviceFlowResult> {
  const intervalMs = Math.max(1, start.interval) * 1000;
  const deadline = Date.now() + start.expiresIn * 1000;
  while (Date.now() < deadline) {
    if (signal?.aborted) return { ok: false, error: 'cancelled' };
    const result = await pollDeviceFlow(start.deviceCode, signal);
    if (result.ok) return result;
    if (result.error !== 'authorization_pending' && result.error !== 'pending') {
      return result;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, intervalMs);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
    });
  }
  return { ok: false, error: 'expired' };
}
