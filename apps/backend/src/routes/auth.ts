import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { recordAudit } from '../audit.js';

/**
 * Lightweight OAuth-style **device flow** for the desktop app.
 *
 * The desktop client calls `/v1/auth/device/start` and receives a `verificationUrl` plus a
 * `userCode` it shows the human. The user opens the verification URL in a browser, signs in, and
 * approves the code via `/v1/auth/device/approve`. The desktop then polls `/v1/auth/device/poll`
 * until it gets a token.
 *
 * State is in-memory; production swaps this for Redis. The route surface is what the desktop
 * client integrates against, so the persistence backend is implementation detail.
 */

type DeviceState = {
  deviceCode: string;
  userCode: string;
  userId: string | null;
  createdAt: number;
  expiresAt: number;
  approvedToken: string | null;
};

const states = new Map<string, DeviceState>();
const codeLookup = new Map<string, string>();
const TTL_MS = 10 * 60 * 1000;

function generateUserCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

function generateDeviceCode(): string {
  return randomBytes(24).toString('base64url');
}

function purgeExpired(): void {
  const now = Date.now();
  for (const [code, state] of states.entries()) {
    if (state.expiresAt <= now) {
      states.delete(code);
      codeLookup.delete(state.userCode);
    }
  }
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/auth/device/start', async (req) => {
    purgeExpired();
    const deviceCode = generateDeviceCode();
    const userCode = generateUserCode();
    const state: DeviceState = {
      deviceCode,
      userCode,
      userId: null,
      createdAt: Date.now(),
      expiresAt: Date.now() + TTL_MS,
      approvedToken: null
    };
    states.set(deviceCode, state);
    codeLookup.set(userCode, deviceCode);
    const baseUrl = `${req.protocol}://${req.headers.host ?? 'localhost'}`;
    return {
      deviceCode,
      userCode,
      verificationUrl: `${baseUrl}/v1/auth/device/verify`,
      verificationUrlComplete: `${baseUrl}/v1/auth/device/verify?code=${userCode}`,
      expiresIn: Math.floor(TTL_MS / 1000),
      interval: 5
    };
  });

  app.post('/v1/auth/device/approve', async (req, reply) => {
    const body = (req.body ?? {}) as { userCode?: string; userId?: string };
    if (!body.userCode || !body.userId) {
      reply.code(400);
      return { ok: false, error: 'userCode and userId required' };
    }
    const deviceCode = codeLookup.get(body.userCode.toUpperCase());
    if (!deviceCode) {
      reply.code(404);
      return { ok: false, error: 'Unknown or expired code' };
    }
    const state = states.get(deviceCode);
    if (!state) {
      reply.code(404);
      return { ok: false, error: 'State expired' };
    }
    state.userId = body.userId;
    state.approvedToken = randomBytes(32).toString('base64url');
    await recordAudit({
      userId: body.userId,
      action: 'auth.device.approved',
      metadata: { userCode: body.userCode }
    });
    return { ok: true };
  });

  app.post('/v1/auth/device/poll', async (req, reply) => {
    const body = (req.body ?? {}) as { deviceCode?: string };
    if (!body.deviceCode) {
      reply.code(400);
      return { ok: false, error: 'deviceCode required' };
    }
    const state = states.get(body.deviceCode);
    if (!state) {
      reply.code(404);
      return { ok: false, error: 'expired' };
    }
    if (!state.approvedToken) {
      return { ok: false, status: 'authorization_pending' };
    }
    const token = state.approvedToken;
    const userId = state.userId;
    states.delete(body.deviceCode);
    codeLookup.delete(state.userCode);
    return { ok: true, token, userId };
  });
}
