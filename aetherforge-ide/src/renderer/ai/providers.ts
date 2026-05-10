import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProviderId, ProviderSettings } from './types';
import { getProvider, PROVIDERS } from './registry';
import { useSettingsStore } from '@/renderer/state/settings-store';
import { useAccountStore } from '@/renderer/auth/account-store';
import { cloudFetch, getCloudApiBaseUrl } from '@/renderer/cloud/cloud-fetch';

type LLMRequest = {
  settings: ProviderSettings;
  systemPrompt: string;
  userPrompt: string;
  signal: AbortSignal;
  onToken?: (chunk: string) => void;
};

const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json'
};

export const PROVIDER_DEFAULT_MODEL = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p.defaultModel])
) as Record<AIProviderId, string>;

async function parseResponseText(response: Response): Promise<string> {
  const data = (await response.json()) as Record<string, unknown>;

  if (Array.isArray(data.content) && data.content.length > 0) {
    const first = data.content[0] as { text?: string };
    if (typeof first?.text === 'string') {
      return first.text;
    }
  }

  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const firstChoice = data.choices[0] as { message?: { content?: string } };
    if (typeof firstChoice.message?.content === 'string') {
      return firstChoice.message.content;
    }
  }

  if (typeof data.response === 'string') {
    return data.response;
  }

  return JSON.stringify(data, null, 2);
}

async function requestOpenAICompatible(
  request: LLMRequest,
  endpoint: string,
  extraHeaders?: Record<string, string>
): Promise<string> {
  if (request.onToken) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        Authorization: `Bearer ${request.settings.apiKey}`,
        ...extraHeaders
      },
      body: JSON.stringify({
        model: request.settings.model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt }
        ],
        stream: true,
        temperature: 0.2
      }),
      signal: request.signal
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Provider request failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    if (!response.body) {
      throw new Error('Provider response stream is unavailable.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) {
          continue;
        }

        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          continue;
        }

        try {
          const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (typeof chunk === 'string' && chunk.length > 0) {
            fullText += chunk;
            request.onToken(chunk);
          }
        } catch {
          // Ignore partial frames and keep streaming.
        }
      }
    }

    return fullText;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${request.settings.apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({
      model: request.settings.model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt }
      ],
      temperature: 0.2
    }),
    signal: request.signal
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Provider request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return parseResponseText(response);
}

async function requestCopilot(request: LLMRequest): Promise<string> {
  const meta = getProvider('copilot');
  const endpoint =
    request.settings.baseUrl ?? meta?.endpoint ?? 'https://api.githubcopilot.com/chat/completions';
  return requestOpenAICompatible(request, endpoint, {
    'Editor-Version': 'AetherForge/1.0.0',
    'Copilot-Integration-Id': 'vscode-chat',
    'User-Agent': 'AetherForge-IDE/1.0'
  });
}

async function requestAnthropic(request: LLMRequest): Promise<string> {
  if (request.onToken) {
    const response = await fetch(request.settings.baseUrl ?? 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'x-api-key': request.settings.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: request.settings.model,
        max_tokens: 2048,
        system: request.systemPrompt,
        stream: true,
        messages: [{ role: 'user', content: request.userPrompt }]
      }),
      signal: request.signal
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Provider request failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    if (!response.body) {
      throw new Error('Provider response stream is unavailable.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) {
          continue;
        }

        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') {
          continue;
        }

        try {
          const parsed = JSON.parse(payload) as {
            type?: string;
            delta?: { text?: string };
            content_block?: { text?: string };
          };
          const chunk = parsed.delta?.text ?? parsed.content_block?.text;
          if (typeof chunk === 'string' && chunk.length > 0) {
            fullText += chunk;
            request.onToken(chunk);
          }
        } catch {
          // Ignore parse errors for partial streaming lines.
        }
      }
    }

    return fullText;
  }

  const response = await fetch(request.settings.baseUrl ?? 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      ...DEFAULT_HEADERS,
      'x-api-key': request.settings.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: request.settings.model,
      max_tokens: 2048,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userPrompt }]
    }),
    signal: request.signal
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Provider request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return parseResponseText(response);
}

async function requestOllama(request: LLMRequest): Promise<string> {
  if (request.onToken) {
    const response = await fetch(request.settings.baseUrl ?? 'http://localhost:11434/api/chat', {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({
        model: request.settings.model,
        stream: true,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt }
        ]
      }),
      signal: request.signal
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Provider request failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    if (!response.body) {
      throw new Error('Provider response stream is unavailable.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }

        try {
          const parsed = JSON.parse(line) as { message?: { content?: string } };
          const chunk = parsed.message?.content;
          if (typeof chunk === 'string' && chunk.length > 0) {
            fullText += chunk;
            request.onToken(chunk);
          }
        } catch {
          // Ignore invalid JSON line fragments.
        }
      }
    }

    return fullText;
  }

  const response = await fetch(request.settings.baseUrl ?? 'http://localhost:11434/api/chat', {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      model: request.settings.model,
      stream: false,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt }
      ]
    }),
    signal: request.signal
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Provider request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return parseResponseText(response);
}

async function requestGemini(request: LLMRequest): Promise<string> {
  const genAI = new GoogleGenerativeAI(request.settings.apiKey);
  const modelName = request.settings.model.replace(/^models\//, '');
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: request.systemPrompt
  });

  if (request.onToken) {
    const streamResult = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }]
    });
    let fullText = '';
    for await (const chunk of streamResult.stream) {
      const t = chunk.text();
      if (t) {
        fullText += t;
        request.onToken(t);
      }
    }
    return fullText;
  }

  const res = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }]
  });
  return res.response.text();
}

function isRetryableProviderError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false;
  }
  const m = error instanceof Error ? error.message : String(error);
  return (
    /\((429|502|503|504|529)\)/.test(m) ||
    /429|503|502|504|529|rate limit|timeout|ECONNRESET|Failed to fetch|network/i.test(m)
  );
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function withCloudRetries<T>(signal: AbortSignal, fn: () => Promise<T>): Promise<T> {
  const maxAttempts = 4;
  let last: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (attempt === maxAttempts - 1 || !isRetryableProviderError(e)) {
        throw e;
      }
      const base = 700 * 2 ** attempt;
      await sleep(Math.min(base, 10_000), signal);
    }
  }
  throw last;
}

async function dispatchLLM(request: LLMRequest): Promise<string> {
  const meta = getProvider(request.settings.provider);
  if (!meta) {
    throw new Error(`Unknown AI provider: ${request.settings.provider}`);
  }

  const endpoint = request.settings.baseUrl ?? meta.endpoint;

  switch (meta.family) {
    case 'copilot':
      return requestCopilot(request);
    case 'anthropic':
      return requestAnthropic(request);
    case 'gemini':
      return requestGemini(request);
    case 'ollama':
      return requestOllama(request);
    case 'openai-compatible': {
      const url = endpoint ?? 'https://api.openai.com/v1/chat/completions';
      const extra =
        meta.id === 'openrouter'
          ? {
              'HTTP-Referer': 'https://github.com/aetherforge/aetherforge-ide',
              'X-Title': 'AetherForge IDE'
            }
          : undefined;
      return requestOpenAICompatible(request, url, extra);
    }
    default:
      throw new Error(`Unsupported provider family for ${meta.id}`);
  }
}

async function parseCloudJsonAssistant(text: string): Promise<string> {
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (Array.isArray(data.choices) && data.choices.length > 0) {
      const firstChoice = data.choices[0] as { message?: { content?: string } };
      if (typeof firstChoice.message?.content === 'string') {
        return firstChoice.message.content;
      }
    }
    return text;
  } catch {
    return text;
  }
}

async function requestLLMViaCloud(request: LLMRequest): Promise<string> {
  const url = new URL('/v1/ai/proxy/chat', getCloudApiBaseUrl());
  const meta = getProvider(request.settings.provider);
  const stream =
    Boolean(request.onToken) &&
    meta != null &&
    (meta.family === 'openai-compatible' || meta.family === 'copilot');

  const res = await cloudFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(stream ? { Accept: 'text/event-stream' } : {})
    },
    body: JSON.stringify({
      provider: request.settings.provider,
      model: request.settings.model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt }
      ],
      stream
    }),
    signal: request.signal
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Cloud proxy failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  if (stream && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    let fullText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (typeof chunk === 'string' && chunk.length > 0) {
            fullText += chunk;
            request.onToken?.(chunk);
          }
        } catch {
          // ignore
        }
      }
    }
    return fullText;
  }

  const text = await res.text();
  const out = await parseCloudJsonAssistant(text);
  request.onToken?.(out);
  return out;
}

function fallbackResponse(prompt: string): string {
  return [
    'Provider key is not configured. Running local fallback mode.',
    'Objective:',
    prompt,
    'Suggested actions:',
    '- Read relevant files',
    '- Apply safe incremental edits',
    '- Run typecheck/build before finalizing'
  ].join('\n');
}

export async function requestLLM(request: LLMRequest): Promise<string> {
  const { provider, apiKey } = request.settings;
  const routeViaCloud = useSettingsStore.getState().ai.routeViaCloud;
  const session = useAccountStore.getState().session;
  if (routeViaCloud && session && provider !== 'ollama') {
    const execCloud = () => requestLLMViaCloud(request);
    return withCloudRetries(request.signal, execCloud);
  }

  if (provider !== 'ollama' && apiKey.trim().length === 0) {
    const fallback = fallbackResponse(request.userPrompt);
    request.onToken?.(fallback);
    return fallback;
  }

  const exec = () => dispatchLLM(request);

  if (provider === 'ollama') {
    return exec();
  }

  return withCloudRetries(request.signal, exec);
}
