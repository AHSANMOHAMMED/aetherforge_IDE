import type { FastifyInstance } from 'fastify';
import { recordAudit } from '../audit.js';
import { getPrisma } from '../db.js';

export async function registerAiProxyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/ai/proxy/usage', async (req) => {
    const prisma = await getPrisma();
    if (!prisma || !req.userId) {
      return {
        totalTokens: 0,
        totalCostUsd: 0,
        perProvider: [] as Array<{ provider: string; tokens: number; costUsd: number }>
      };
    }
    try {
      const aggregate = (await prisma.usageRow.aggregate({
        where: { userId: req.userId },
        _sum: { tokensIn: true, tokensOut: true, costUsd: true }
      })) as { _sum?: { tokensIn?: number; tokensOut?: number; costUsd?: number } };
      const sum = aggregate?._sum ?? {};
      return {
        totalTokens: (sum.tokensIn ?? 0) + (sum.tokensOut ?? 0),
        totalCostUsd: Number(sum.costUsd ?? 0),
        perProvider: []
      };
    } catch (err) {
      req.log.warn({ err }, 'usageRow aggregate failed');
      return { totalTokens: 0, totalCostUsd: 0, perProvider: [] };
    }
  });

  app.post('/v1/ai/proxy/chat', async (req) => {
    const body = (req.body ?? {}) as {
      provider?: string;
      model?: string;
      messages?: unknown[];
      tokensIn?: number;
      tokensOut?: number;
      costUsd?: number;
    };
    const prisma = await getPrisma();
    if (prisma && req.userId) {
      try {
        await prisma.usageRow.create({
          data: {
            userId: req.userId,
            feature: 'ai.proxy.chat',
            tokensIn: Number(body.tokensIn ?? 0),
            tokensOut: Number(body.tokensOut ?? 0),
            costUsd: Number(body.costUsd ?? 0)
          }
        });
      } catch (err) {
        req.log.warn({ err }, 'usageRow.create failed');
      }
    }
    await recordAudit({
      userId: req.userId,
      action: 'ai.proxy.chat',
      metadata: {
        provider: body.provider,
        model: body.model,
        messages: Array.isArray(body.messages) ? body.messages.length : 0
      }
    });
    return {
      ok: true,
      provider: body.provider ?? 'openai',
      model: body.model ?? 'gpt-4.1-mini',
      delivered: Array.isArray(body.messages) ? body.messages.length : 0
    };
  });
}
