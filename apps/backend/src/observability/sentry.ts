/**
 * Backend Sentry — optional; respects AETHERFORGE_AIRGAP=1.
 */

import type { FastifyInstance } from 'fastify';

export async function initBackendSentry(): Promise<void> {
  if (process.env.AETHERFORGE_AIRGAP === '1') return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import(/* @vite-ignore */ '@sentry/node');
    Sentry.init({ dsn, tracesSampleRate: 0.1 });
  } catch (err) {
    console.warn('[backend] Sentry init skipped.', (err as Error).message);
  }
}

export async function registerSentryErrorHook(app: FastifyInstance): Promise<void> {
  if (process.env.AETHERFORGE_AIRGAP === '1' || !process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import(/* @vite-ignore */ '@sentry/node');
    app.addHook('onError', async (_req, _reply, error) => {
      Sentry.captureException(error);
    });
  } catch {
    // ignore
  }
}
