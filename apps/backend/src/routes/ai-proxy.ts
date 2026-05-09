import type { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuthPreHandler } from '../auth.js';
import { recordAudit } from '../audit.js';
import { getPrisma } from '../db.js';
import { enqueueUsage } from '../queues.js';

type ChatMessage = { role: string; content: string };

function estimateCostUsd(provider: string, tokensIn: number, tokensOut: number): number {
  const r = provider.includes('anthropic') ? 3 : provider.includes('google') ? 0.5 : 1;
  return Number((((tokensIn + tokensOut) / 1_000_000) * r).toFixed(6));
}

async function persistUsage(
  req: { log: { warn: (o: unknown, m: string) => void } },
  userId: string,
  feature: string,
  tokensIn: number,
  tokensOut: number,
  costUsd: number
): Promise<void> {
  void enqueueUsage({ userId, feature, tokensIn, tokensOut, costUsd });
  const prisma = await getPrisma();
  if (!prisma) return;
  try {
    await prisma.usageRow.create({
      data: {
        userId,
        feature,
        tokensIn,
        tokensOut,
        costUsd
      }
    });
  } catch (err) {
    req.log.warn({ err }, 'usageRow.create failed');
  }
}

async function callOpenAI(model: string, messages: ChatMessage[]) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false as const, reason: 'no_key' };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages })
  });
  const text = await res.text();
  let tokensIn = 0;
  let tokensOut = 0;
  try {
    const json = JSON.parse(text) as { usage?: { prompt_tokens?: number; completion_tokens?: number } };
    tokensIn = json.usage?.prompt_tokens ?? 0;
    tokensOut = json.usage?.completion_tokens ?? 0;
  } catch {
    // ignore parse
  }
  return { ok: res.ok, status: res.status, text, tokensIn, tokensOut };
}

async function callAnthropic(model: string, messages: ChatMessage[]) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false as const, reason: 'no_key' };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, max_tokens: 4096, messages })
  });
  const text = await res.text();
  let tokensIn = 0;
  let tokensOut = 0;
  try {
    const json = JSON.parse(text) as { usage?: { input_tokens?: number; output_tokens?: number } };
    tokensIn = json.usage?.input_tokens ?? 0;
    tokensOut = json.usage?.output_tokens ?? 0;
  } catch {
    // ignore
  }
  return { ok: res.ok, status: res.status, text, tokensIn, tokensOut };
}

async function callGemini(model: string, messages: ChatMessage[]) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) return { ok: false as const, reason: 'no_key' };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents })
  });
  const text = await res.text();
  let tokensIn = 0;
  let tokensOut = 0;
  try {
    const json = JSON.parse(text) as {
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    tokensIn = json.usageMetadata?.promptTokenCount ?? 0;
    tokensOut = json.usageMetadata?.candidatesTokenCount ?? 0;
  } catch {
    // ignore
  }
  return { ok: res.ok, status: res.status, text, tokensIn, tokensOut };
}

export async function registerAiProxyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/ai/proxy/usage', { preHandler: requireAuthPreHandler }, async (req) => {
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

  app.post('/v1/ai/proxy/chat', { preHandler: requireAuthPreHandler }, async (req, reply: FastifyReply) => {
    const body = (req.body ?? {}) as {
      provider?: string;
      model?: string;
      messages?: ChatMessage[];
    };
    const provider = (body.provider ?? 'openai').toLowerCase();
    const model = body.model ?? 'gpt-4o-mini';
    const messages = Array.isArray(body.messages) ? body.messages : [];

    let text = '';
    let tokensIn = 0;
    let tokensOut = 0;
    let missingKey = false;

    if (
      provider === 'openai' ||
      provider === 'groq' ||
      provider === 'mistral' ||
      provider === 'openrouter' ||
      provider === 'grok'
    ) {
      const r = await callOpenAI(model, messages);
      if ('reason' in r) {
        missingKey = true;
      } else {
        text = r.text;
        tokensIn = r.tokensIn;
        tokensOut = r.tokensOut;
        if (!r.ok) {
          reply.code(r.status >= 400 && r.status < 600 ? r.status : 502).send({
            ok: false,
            error: 'upstream_error',
            detail: r.text.slice(0, 500)
          });
          return;
        }
      }
    } else if (provider === 'claude' || provider === 'anthropic') {
      const r = await callAnthropic(model, messages);
      if ('reason' in r) {
        missingKey = true;
      } else {
        text = r.text;
        tokensIn = r.tokensIn;
        tokensOut = r.tokensOut;
        if (!r.ok) {
          reply.code(502).send({ ok: false, error: 'upstream_error', detail: r.text.slice(0, 500) });
          return;
        }
      }
    } else if (provider === 'gemini' || provider === 'google') {
      const r = await callGemini(model, messages);
      if ('reason' in r) {
        missingKey = true;
      } else {
        text = r.text;
        tokensIn = r.tokensIn;
        tokensOut = r.tokensOut;
        if (!r.ok) {
          reply.code(502).send({ ok: false, error: 'upstream_error', detail: r.text.slice(0, 500) });
          return;
        }
      }
    } else {
      reply.code(503).send({ ok: false, error: 'provider_not_configured', detail: provider });
      return;
    }

    if (missingKey) {
      reply.code(503).send({ ok: false, error: 'provider_not_configured' });
      return;
    }

    reply.code(200).header('Content-Type', 'application/json').send(text);

    if (req.userId) {
      const costUsd = estimateCostUsd(provider, tokensIn, tokensOut);
      await persistUsage(req, req.userId, 'ai.proxy.chat', tokensIn, tokensOut, costUsd);
    }

    await recordAudit({
      userId: req.userId,
      action: 'ai.proxy.chat',
      metadata: {
        provider,
        model,
        messages: messages.length
      }
    });
  });
}
