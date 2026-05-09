import type { FastifyInstance } from 'fastify';
import { requireAuthPreHandler } from '../auth.js';
import { recordAudit } from '../audit.js';
import { createCheckoutSession, verifyStripeSignature } from '../stripe.js';
import { getPrisma } from '../db.js';

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

  app.post('/v1/billing/checkout-session', { preHandler: requireAuthPreHandler }, async (req) => {
    const body = (req.body ?? {}) as { plan?: Plan['id']; successUrl?: string; cancelUrl?: string };
    const plan = PLANS.find((p) => p.id === body.plan);
    if (!plan) {
      return { ok: false, error: 'Unknown plan' };
    }
    const userId = req.userId!;
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
        const ev = event as { type?: string; data?: { object?: Record<string, unknown> } };
        const prisma = await getPrisma();
        const type = ev.type ?? 'unknown';

        if (prisma?.subscription && ev.data?.object) {
          const obj = ev.data.object;
          try {
            if (type === 'checkout.session.completed') {
              const customerId = typeof obj.customer === 'string' ? obj.customer : null;
              const subId =
                typeof obj.subscription === 'string'
                  ? obj.subscription
                  : typeof obj.subscription === 'object' && obj.subscription && 'id' in obj.subscription
                    ? String((obj.subscription as { id: string }).id)
                    : null;
              const clientRef = typeof obj.client_reference_id === 'string' ? obj.client_reference_id : null;
              if (clientRef && subId) {
                await prisma.subscription.upsert({
                  where: { stripeSubscriptionId: subId },
                  create: {
                    userId: clientRef,
                    stripeCustomerId: customerId ?? undefined,
                    stripeSubscriptionId: subId,
                    plan:
                      typeof obj.metadata === 'object' && obj.metadata && 'plan' in obj.metadata
                        ? String((obj.metadata as { plan?: string }).plan ?? 'pro')
                        : 'pro',
                    status: 'active'
                  },
                  update: {
                    stripeCustomerId: customerId ?? undefined,
                    status: 'active'
                  }
                });
                if (customerId && prisma.user) {
                  await prisma.user.update({
                    where: { id: clientRef },
                    data: { stripeCustomerId: customerId }
                  });
                }
              }
              if (prisma.usageRow) {
                await prisma.usageRow.create({
                  data: {
                    userId:
                      (typeof obj.client_reference_id === 'string' && obj.client_reference_id) || 'anonymous',
                    feature: 'billing.checkout.completed',
                    tokensIn: 0,
                    tokensOut: 0,
                    costUsd: 0
                  }
                });
              }
            } else if (type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
              const subId = typeof obj.id === 'string' ? obj.id : null;
              const status = typeof obj.status === 'string' ? obj.status : 'unknown';
              if (subId) {
                await prisma.subscription.update({
                  where: { stripeSubscriptionId: subId },
                  data: { status: type.endsWith('deleted') ? 'canceled' : status }
                });
              }
            } else if (type === 'invoice.payment_succeeded' || type === 'invoice.payment_failed') {
              const subId =
                typeof obj.subscription === 'string'
                  ? obj.subscription
                  : obj.subscription &&
                      typeof obj.subscription === 'object' &&
                      'id' in (obj.subscription as object)
                    ? String((obj.subscription as { id: string }).id)
                    : null;
              if (subId) {
                await prisma.subscription.update({
                  where: { stripeSubscriptionId: subId },
                  data: { status: type.endsWith('failed') ? 'past_due' : 'active' }
                });
              }
            }
          } catch (err) {
            req.log.warn({ err }, 'stripe webhook prisma branch failed');
          }
        }

        await recordAudit({
          action: 'billing.webhook.received',
          metadata: { type }
        });
        return { ok: true, processed: true };
      }
    }
    void reply;
    return { ok: true, processed: false, note: 'Signature missing or invalid; ignored.' };
  });
}
