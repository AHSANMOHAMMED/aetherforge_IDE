import type { FastifyInstance, FastifyReply } from 'fastify';
import { requireAuthPreHandler } from '../auth.js';
import { recordAudit } from '../audit.js';
import { getPrisma } from '../db.js';
import { enqueueUsage } from '../queues.js';

type ChatMessage = { role: string; content: string };

function estimateCostUsd(provider: string, tokensIn: number, tokensOut: number): number {
  const r =
    provider.includes('anthropic') || provider === 'claude'
      ? 3
      : provider.includes('google') || provider === 'gemini'
        ? 0.5
        : 1;
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

type UpstreamKind = 'openai-chat' | 'anthropic' | 'gemini-generate';

type UpstreamSpec = { url: string; env: string; kind: UpstreamKind };

const UPSTREAM: Record<string, UpstreamSpec> = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', env: 'OPENAI_API_KEY', kind: 'openai-chat' },
  chatgpt: { url: 'https://api.openai.com/v1/chat/completions', env: 'OPENAI_API_KEY', kind: 'openai-chat' },
  codex: { url: 'https://api.openai.com/v1/chat/completions', env: 'OPENAI_API_KEY', kind: 'openai-chat' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', env: 'GROQ_API_KEY', kind: 'openai-chat' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', env: 'MISTRAL_API_KEY', kind: 'openai-chat' },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    env: 'OPENROUTER_API_KEY',
    kind: 'openai-chat'
  },
  grok: { url: 'https://api.x.ai/v1/chat/completions', env: 'XAI_API_KEY', kind: 'openai-chat' },
  kimi: { url: 'https://api.moonshot.cn/v1/chat/completions', env: 'MOONSHOT_API_KEY', kind: 'openai-chat' },
  copilot: {
    url: 'https://api.githubcopilot.com/chat/completions',
    env: 'COPILOT_API_KEY',
    kind: 'openai-chat'
  },
  claude: { url: 'https://api.anthropic.com/v1/messages', env: 'ANTHROPIC_API_KEY', kind: 'anthropic' },
  anthropic: { url: 'https://api.anthropic.com/v1/messages', env: 'ANTHROPIC_API_KEY', kind: 'anthropic' },
  gemini: { url: '__gemini__', env: 'GOOGLE_API_KEY', kind: 'gemini-generate' },
  google: { url: '__gemini__', env: 'GOOGLE_API_KEY', kind: 'gemini-generate' }
};

const MODEL_FALLBACK: Record<string, string[]> = {
  openai: ['gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
  chatgpt: ['gpt-4o-mini', 'gpt-4o'],
  codex: ['gpt-4.1', 'o4-mini'],
  claude: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
  anthropic: ['claude-3-5-sonnet-latest'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  google: ['gemini-2.0-flash'],
  groq: ['llama-3.3-70b-versatile'],
  mistral: ['mistral-small-latest'],
  openrouter: ['openai/gpt-4o-mini'],
  grok: ['grok-2-latest'],
  kimi: ['moonshot-v1-8k', 'moonshot-v1-32k'],
  copilot: ['gpt-4o']
};

function resolveKey(spec: UpstreamSpec): string | undefined {
  const v = process.env[spec.env];
  if (v) return v;
  if (spec.env === 'MOONSHOT_API_KEY') {
    return process.env.KIMI_API_KEY;
  }
  return undefined;
}

async function callOpenAIChat(
  spec: UpstreamSpec,
  model: string,
  messages: ChatMessage[],
  stream: boolean
): Promise<Response> {
  const key = resolveKey(spec);
  if (!key) {
    return new Response(null, { status: 503 });
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
  if (spec.url.includes('openrouter')) {
    headers['HTTP-Referer'] = 'https://github.com/aetherforge/aetherforge-ide';
    headers['X-Title'] = 'AetherForge IDE';
  }
  if (spec.url.includes('githubcopilot')) {
    headers['Editor-Version'] = 'AetherForge/1.0.0';
    headers['Copilot-Integration-Id'] = 'vscode-chat';
    headers['User-Agent'] = 'AetherForge-IDE/1.0';
  }
  return fetch(spec.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, temperature: 0.2, stream })
  });
}

async function callAnthropicHttp(
  spec: UpstreamSpec,
  model: string,
  messages: ChatMessage[],
  stream: boolean
): Promise<Response> {
  const key = resolveKey(spec);
  if (!key) {
    return new Response(null, { status: 503 });
  }
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const rest = messages.filter((m) => m.role !== 'system');
  return fetch(spec.url, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      stream,
      messages: rest.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    })
  });
}

async function callGeminiHttp(model: string, messages: ChatMessage[]): Promise<Response> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) {
    return new Response(null, { status: 503 });
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents })
  });
}

function parseOpenAIUsage(text: string): { tokensIn: number; tokensOut: number } {
  try {
    const json = JSON.parse(text) as { usage?: { prompt_tokens?: number; completion_tokens?: number } };
    return { tokensIn: json.usage?.prompt_tokens ?? 0, tokensOut: json.usage?.completion_tokens ?? 0 };
  } catch {
    return { tokensIn: 0, tokensOut: 0 };
  }
}

export async function registerAiProxyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/ai/proxy/models', { preHandler: requireAuthPreHandler }, async (req) => {
    const q = (req.query as { provider?: string }).provider?.toLowerCase() ?? 'openai';
    const models = MODEL_FALLBACK[q] ?? MODEL_FALLBACK.openai ?? [];
    return { models };
  });

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
      stream?: boolean;
    };
    const provider = (body.provider ?? 'openai').toLowerCase();
    const model = body.model ?? 'gpt-4o-mini';
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const wantsStream =
      Boolean(body.stream) || String(req.headers.accept ?? '').includes('text/event-stream');

    const spec = UPSTREAM[provider];
    if (!spec) {
      reply.code(503).send({ ok: false, error: 'provider_not_configured', detail: provider });
      return;
    }

    if (spec.kind === 'gemini-generate') {
      const res = await callGeminiHttp(model, messages);
      const text = await res.text();
      if (!res.ok) {
        reply.code(502).send({ ok: false, error: 'upstream_error', detail: text.slice(0, 500) });
        return;
      }
      reply.code(200).header('Content-Type', 'application/json').send(text);
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
      if (req.userId) {
        const costUsd = estimateCostUsd(provider, tokensIn, tokensOut);
        await persistUsage(req, req.userId, 'ai.proxy.chat', tokensIn, tokensOut, costUsd);
      }
      await recordAudit({
        userId: req.userId,
        action: 'ai.proxy.chat',
        metadata: { provider, model, messages: messages.length, stream: false }
      });
      return;
    }

    if (spec.kind === 'anthropic') {
      const res = await callAnthropicHttp(spec, model, messages, wantsStream);
      if (res.status === 503) {
        reply.code(503).send({ ok: false, error: 'provider_not_configured' });
        return;
      }
      if (wantsStream && res.ok && res.body) {
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        });
        const reader = res.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            reply.raw.write(Buffer.from(value));
          }
        } finally {
          reply.raw.end();
        }
        if (req.userId) {
          await persistUsage(req, req.userId, 'ai.proxy.chat', 0, 0, 0);
        }
        await recordAudit({
          userId: req.userId,
          action: 'ai.proxy.chat',
          metadata: { provider, model, messages: messages.length, stream: true }
        });
        return;
      }
      const text = await res.text();
      if (!res.ok) {
        reply.code(502).send({ ok: false, error: 'upstream_error', detail: text.slice(0, 500) });
        return;
      }
      reply.code(200).header('Content-Type', 'application/json').send(text);
      let tokensIn = 0;
      let tokensOut = 0;
      try {
        const json = JSON.parse(text) as { usage?: { input_tokens?: number; output_tokens?: number } };
        tokensIn = json.usage?.input_tokens ?? 0;
        tokensOut = json.usage?.output_tokens ?? 0;
      } catch {
        // ignore
      }
      if (req.userId) {
        const costUsd = estimateCostUsd(provider, tokensIn, tokensOut);
        await persistUsage(req, req.userId, 'ai.proxy.chat', tokensIn, tokensOut, costUsd);
      }
      await recordAudit({
        userId: req.userId,
        action: 'ai.proxy.chat',
        metadata: { provider, model, messages: messages.length, stream: false }
      });
      return;
    }

    const res = await callOpenAIChat(spec, model, messages, wantsStream);
    if (res.status === 503) {
      reply.code(503).send({ ok: false, error: 'provider_not_configured' });
      return;
    }

    if (wantsStream && res.ok && res.body) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      const reader = res.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(Buffer.from(value));
        }
      } finally {
        reply.raw.end();
      }
      if (req.userId) {
        await persistUsage(req, req.userId, 'ai.proxy.chat', 0, 0, 0);
      }
      await recordAudit({
        userId: req.userId,
        action: 'ai.proxy.chat',
        metadata: { provider, model, messages: messages.length, stream: true }
      });
      return;
    }

    const text = await res.text();
    if (!res.ok) {
      reply.code(res.status >= 400 && res.status < 600 ? res.status : 502).send({
        ok: false,
        error: 'upstream_error',
        detail: text.slice(0, 500)
      });
      return;
    }
    const { tokensIn, tokensOut } = parseOpenAIUsage(text);
    reply.code(200).header('Content-Type', 'application/json').send(text);
    if (req.userId) {
      const costUsd = estimateCostUsd(provider, tokensIn, tokensOut);
      await persistUsage(req, req.userId, 'ai.proxy.chat', tokensIn, tokensOut, costUsd);
    }
    await recordAudit({
      userId: req.userId,
      action: 'ai.proxy.chat',
      metadata: { provider, model, messages: messages.length, stream: false }
    });
  });
}
