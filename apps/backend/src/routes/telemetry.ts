import type { FastifyInstance } from 'fastify';
import { recordAudit } from '../audit.js';

/**
 * Front door for renderer-side telemetry events. The desktop client may pipe events through here
 * when an org policy disallows direct PostHog/Sentry connections (air-gap or compliance).
 */
export async function registerTelemetryRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/telemetry/event', async (req) => {
    const body = (req.body ?? {}) as { event?: string; properties?: Record<string, unknown> };
    if (!body.event) {
      return { ok: false, error: 'event required' };
    }
    await recordAudit({
      userId: req.userId,
      action: `telemetry.${body.event}`,
      metadata: body.properties
    });
    return { ok: true };
  });
}
