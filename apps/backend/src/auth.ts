import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Minimal bearer-token auth used while we wait for `better-auth` integration.
 *
 * Tokens are simple opaque strings provided through `AETHERFORGE_API_TOKENS` (comma-separated). In
 * production this becomes the user-session token issued by `better-auth`. The middleware decorates
 * every request with `req.userId` and rejects unauthenticated requests on protected routes.
 */

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

function loadTokens(): Map<string, string> {
  const raw = process.env.AETHERFORGE_API_TOKENS ?? '';
  const out = new Map<string, string>();
  for (const pair of raw
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)) {
    const [token, userId] = pair.includes(':') ? pair.split(':', 2) : [pair, pair];
    out.set(token, userId);
  }
  return out;
}

/** Static env tokens + device-flow / session tokens registered at runtime. */
const envTokens = loadTokens();
const sessionTokens = new Map<string, string>();

export function registerSessionToken(token: string, userId: string): void {
  sessionTokens.set(token, userId);
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice('Bearer '.length).trim();
      const userId = envTokens.get(token) ?? sessionTokens.get(token);
      if (userId) {
        req.userId = userId;
      }
    }
    // We attach the userId when present; route-level guards decide whether to reject.
    void reply;
  });
}

export function requireAuth(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.userId) return true;
  reply.code(401).send({ ok: false, error: 'Authentication required' });
  return false;
}

/** Fastify `preHandler` that stops the chain when unauthenticated. */
export async function requireAuthPreHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!requireAuth(req, reply)) {
    return;
  }
}
