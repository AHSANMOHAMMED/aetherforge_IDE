import type { FastifyInstance } from 'fastify';
import { recordAudit } from '../audit.js';
import { createCheckoutSession, verifyStripeSignature } from '../stripe.js';

type Plan = {
  id: 'free' | 'pro' | 'team' | 'enterprise';
  monthlyUsd: number | null;
  includedTokens: number | null;
  seats?: number;
  contact?: string;
  priceId?: string;
};

const PLANS: Plan[] = [
  { id: 'free', monthlyUsd: 0, includedTokens: 100_000 },
  { id: 'pro', monthlyUsd: 20, includedTokens: 5_000_000, priceId: process.env.STRIPE_PRICE_PRO },
  {
    id: 'team',
    monthlyUsd: 60,
    includedTokens: 20_000_000,
    seats: 5,
    priceId: process.env.STRIPE_PRICE_TEAM
  },
  { id: 'enterprise', monthlyUsd: null, includedTokens: null, contact: 'sales@aetherforge.dev' }
];

export async function registerBillingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/billing/plans', async () => ({ plans: PLANS }));

  app.post('/v1/billing/checkout-session', async (req) => {
    const body = (req.body ?? {}) as { plan?: Plan['id']; successUrl?: string; cancelUrl?: string };
    const plan = PLANS.find((p) => p.id === body.plan);
    if (!plan) {
      return { ok: false, error: 'Unknown plan' };
    }
    const userId = req.userId ?? 'anonymous';
    const session = await createCheckoutSession({
      plan: plan.id,
      userId,
      successUrl: body.successUrl ?? 'aetherforge://billing/success',
      cancelUrl: body.cancelUrl ?? 'aetherforge://billing/cancel',
      priceId: plan.priceId
    });
    await recordAudit({
      userId,
      action: 'billing.checkout.created',
      resourceType: 'plan',
      resourceId: plan.id,
      metadata: { stub: session.stub }
    });
    return { ok: true, url: session.url, sessionId: session.id, stub: session.stub };
  });

  app.post('/v1/billing/webhook', async (req, reply) => {
    const signature = req.headers['stripe-signature'];
    const raw = (req.body ?? '') as string | Buffer;
    if (typeof signature === 'string') {
      const event = await verifyStripeSignature(raw, signature);
      if (event) {
        await recordAudit({
          action: 'billing.webhook.received',
          metadata: { type: (event as { type?: string }).type ?? 'unknown' }
        });
        return { ok: true, processed: true };
      }
    }
    void reply;
    return { ok: true, processed: false, note: 'Signature missing or invalid; ignored.' };
  });
}
