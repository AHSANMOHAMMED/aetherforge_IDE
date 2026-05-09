import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { awaitDeviceFlow, pollDeviceFlow, startDeviceFlow } from './device-flow';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useRealTimers();
});

describe('device-flow client', () => {
  it('startDeviceFlow posts to /v1/auth/device/start', async () => {
    const response = {
      deviceCode: 'd',
      userCode: 'U',
      verificationUrl: 'http://x/verify',
      verificationUrlComplete: 'http://x/verify?code=U',
      expiresIn: 600,
      interval: 5
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response
    } as Response);
    const result = await startDeviceFlow();
    expect(result).toEqual(response);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/auth/device/start'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({})
      })
    );
  });

  it('pollDeviceFlow returns ok when token present', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, token: 'tok', userId: 'u-1' })
    } as Response);
    const result = await pollDeviceFlow('device-code');
    expect(result).toEqual({ ok: true, token: 'tok', userId: 'u-1' });
  });

  it('pollDeviceFlow returns error status when pending', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, status: 'authorization_pending' })
    } as Response);
    const result = await pollDeviceFlow('device-code');
    expect(result).toEqual({ ok: false, error: 'authorization_pending' });
  });

  it('awaitDeviceFlow resolves with token after polling', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls < 2) {
        return { ok: true, json: async () => ({ ok: false, status: 'authorization_pending' }) } as Response;
      }
      return { ok: true, json: async () => ({ ok: true, token: 't', userId: 'u' }) } as Response;
    });
    const result = await awaitDeviceFlow({
      deviceCode: 'd',
      userCode: 'U',
      verificationUrl: '',
      verificationUrlComplete: '',
      expiresIn: 60,
      interval: 0
    });
    expect(result).toEqual({ ok: true, token: 't', userId: 'u' });
  });

  it('awaitDeviceFlow returns cancelled when aborted', async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, status: 'authorization_pending' })
    } as Response);
    const promise = awaitDeviceFlow(
      {
        deviceCode: 'd',
        userCode: 'U',
        verificationUrl: '',
        verificationUrlComplete: '',
        expiresIn: 60,
        interval: 0
      },
      controller.signal
    );
    controller.abort();
    const result = await promise;
    expect(result.ok).toBe(false);
  });
});
