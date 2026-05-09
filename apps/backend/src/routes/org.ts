import type { FastifyInstance } from 'fastify';
import { requireAuthPreHandler } from '../auth.js';
import { recordAudit } from '../audit.js';
import { getPrisma } from '../db.js';

type OrgPolicy = {
  orgId: string;
  airGap: boolean;
  providerAllow: string[];
  modelAllow: string[];
  pluginAllow: string[];
};

const DEFAULT_POLICY: Omit<OrgPolicy, 'orgId'> = {
  airGap: false,
  providerAllow: ['openai', 'claude', 'ollama'],
  modelAllow: [],
  pluginAllow: []
};

const memoryPolicies = new Map<string, OrgPolicy>();

function parseList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function fromRecord(record: unknown): OrgPolicy | null {
  if (!record || typeof record !== 'object') return null;
  const r = record as Record<string, unknown>;
  if (typeof r.orgId !== 'string') return null;
  return {
    orgId: r.orgId,
    airGap: Boolean(r.airGap),
    providerAllow: parseList(r.providerAllow, DEFAULT_POLICY.providerAllow),
    modelAllow: parseList(r.modelAllow, DEFAULT_POLICY.modelAllow),
    pluginAllow: parseList(r.pluginAllow, DEFAULT_POLICY.pluginAllow)
  };
}

export async function registerOrgRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/org/:orgId/policy', { preHandler: requireAuthPreHandler }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const prisma = await getPrisma();
    if (prisma) {
      try {
        const record = await prisma.orgPolicy.findUnique({ where: { orgId } });
        const parsed = fromRecord(record);
        if (parsed) return parsed;
      } catch (err) {
        req.log.warn({ err }, 'orgPolicy.findUnique failed');
      }
    }
    return memoryPolicies.get(orgId) ?? { ...DEFAULT_POLICY, orgId };
  });

  app.put('/v1/org/:orgId/policy', { preHandler: requireAuthPreHandler }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const body = (req.body ?? {}) as Partial<OrgPolicy>;
    const policy: OrgPolicy = {
      orgId,
      airGap: Boolean(body.airGap ?? DEFAULT_POLICY.airGap),
      providerAllow: body.providerAllow ?? DEFAULT_POLICY.providerAllow,
      modelAllow: body.modelAllow ?? DEFAULT_POLICY.modelAllow,
      pluginAllow: body.pluginAllow ?? DEFAULT_POLICY.pluginAllow
    };

    const prisma = await getPrisma();
    if (prisma) {
      try {
        await prisma.orgPolicy.upsert({
          where: { orgId },
          create: {
            orgId,
            airGap: policy.airGap,
            providerAllow: JSON.stringify(policy.providerAllow),
            modelAllow: JSON.stringify(policy.modelAllow),
            pluginAllow: JSON.stringify(policy.pluginAllow)
          },
          update: {
            airGap: policy.airGap,
            providerAllow: JSON.stringify(policy.providerAllow),
            modelAllow: JSON.stringify(policy.modelAllow),
            pluginAllow: JSON.stringify(policy.pluginAllow)
          }
        });
      } catch (err) {
        req.log.warn({ err }, 'orgPolicy.upsert failed; using memory store');
        memoryPolicies.set(orgId, policy);
      }
    } else {
      memoryPolicies.set(orgId, policy);
    }

    await recordAudit({
      userId: req.userId,
      orgId,
      action: 'org.policy.updated',
      resourceType: 'org',
      resourceId: orgId,
      metadata: { airGap: policy.airGap }
    });

    return { ok: true, policy };
  });
}
