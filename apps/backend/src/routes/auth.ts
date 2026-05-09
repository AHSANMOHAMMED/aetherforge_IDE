import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { recordAudit } from '../audit.js';
import { registerSessionToken } from '../auth.js';
import { getPrisma } from '../db.js';
import { getRedis } from '../redis.js';

/**
 * Lightweight OAuth-style **device flow** for the desktop app.
 *
 * State is stored in-memory, or in Redis when `REDIS_URL` is set (TTL-based expiry).
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
const ttlSec = Math.ceil(TTL_MS / 1000);

function generateUserCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

function generateDeviceCode(): string {
  return randomBytes(24).toString('base64url');
}

function purgeExpiredMemory(): void {
  const now = Date.now();
  for (const [code, state] of states.entries()) {
    if (state.expiresAt <= now) {
      states.delete(code);
      codeLookup.delete(state.userCode);
    }
  }
}

async function saveDeviceState(state: DeviceState): Promise<void> {
  const r = await getRedis();
  if (r) {
    await r.set(`af:df:dc:${state.deviceCode}`, JSON.stringify(state), 'EX', ttlSec);
    await r.set(`af:df:uc:${state.userCode}`, state.deviceCode, 'EX', ttlSec);
    return;
  }
  states.set(state.deviceCode, state);
  codeLookup.set(state.userCode, state.deviceCode);
}

async function loadDeviceState(deviceCode: string): Promise<DeviceState | null> {
  const r = await getRedis();
  if (r) {
    const raw = await r.get(`af:df:dc:${deviceCode}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DeviceState;
    } catch {
      return null;
    }
  }
  return states.get(deviceCode) ?? null;
}

async function resolveUserCode(userCode: string): Promise<string | null> {
  const uc = userCode.toUpperCase();
  const r = await getRedis();
  if (r) {
    return r.get(`af:df:uc:${uc}`);
  }
  return codeLookup.get(uc) ?? null;
}

async function persistApprovedState(state: DeviceState): Promise<void> {
  const r = await getRedis();
  if (r) {
    await r.set(`af:df:dc:${state.deviceCode}`, JSON.stringify(state), 'EX', ttlSec);
    return;
  }
  states.set(state.deviceCode, state);
}

async function deleteDeviceState(deviceCode: string, userCode: string): Promise<void> {
  const r = await getRedis();
  if (r) {
    await r.del(`af:df:dc:${deviceCode}`, `af:df:uc:${userCode}`);
    return;
  }
  states.delete(deviceCode);
  codeLookup.delete(userCode);
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/auth/device/start', async (req) => {
    purgeExpiredMemory();
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
    await saveDeviceState(state);
    const baseUrl = `${req.protocol}://${req.headers.host ?? 'localhost'}`;
    return {
      deviceCode,
      userCode,
      verificationUrl: `${baseUrl}/v1/auth/device/verify`,
      verificationUrlComplete: `${baseUrl}/v1/auth/device/verify?code=${userCode}`,
      expiresIn: ttlSec,
      interval: 5
    };
  });

  app.post('/v1/auth/device/approve', async (req, reply) => {
    const body = (req.body ?? {}) as { userCode?: string; userId?: string };
    if (!body.userCode || !body.userId) {
      reply.code(400);
      return { ok: false, error: 'userCode and userId required' };
    }
    const deviceCode = await resolveUserCode(body.userCode);
    if (!deviceCode) {
      reply.code(404);
      return { ok: false, error: 'Unknown or expired code' };
    }
    const state = await loadDeviceState(deviceCode);
    if (!state) {
      reply.code(404);
      return { ok: false, error: 'State expired' };
    }
    state.userId = body.userId;
    state.approvedToken = randomBytes(32).toString('base64url');
    registerSessionToken(state.approvedToken, body.userId);
    await persistApprovedState(state);

    const prisma = await getPrisma();
    if (prisma?.apiKey) {
      try {
        await prisma.apiKey.create({
          data: {
            userId: body.userId,
            hashed: createHash('sha256').update(state.approvedToken).digest('hex'),
            label: 'device-flow'
          }
        });
      } catch (err) {
        req.log.warn({ err }, 'apiKey.create skipped');
      }
    }

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
    const state = await loadDeviceState(body.deviceCode);
    if (!state) {
      reply.code(404);
      return { ok: false, error: 'expired' };
    }
    if (!state.approvedToken) {
      return { ok: false, status: 'authorization_pending' };
    }
    const token = state.approvedToken;
    const userId = state.userId;
    await deleteDeviceState(body.deviceCode, state.userCode);
    return { ok: true, token, userId };
  });
}
