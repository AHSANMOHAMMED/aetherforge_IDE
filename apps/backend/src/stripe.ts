/**
 * Env-driven Stripe wrapper.
 *
 * If `STRIPE_SECRET_KEY` is set we lazily require the `stripe` package and create a Checkout
 * Session through the live API. When the key is missing we return a deterministic dummy URL so the
 * desktop app and integration tests can exercise the flow end-to-end without external credentials.
 */

type StripeModule = {
  default: new (key: string, opts?: Record<string, unknown>) => StripeInstance;
};

type StripeInstance = {
  checkout: {
    sessions: {
      create: (params: Record<string, unknown>) => Promise<{ url: string | null; id: string }>;
    };
  };
  webhooks: {
    constructEvent: (payload: string | Buffer, signature: string, secret: string) => unknown;
  };
};

let cached: StripeInstance | null | undefined;

async function getStripe(): Promise<StripeInstance | null> {
  if (cached !== undefined) {
    return cached;
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    cached = null;
    return cached;
  }
  try {
    const moduleId = 'stripe';
    const mod = (await import(/* @vite-ignore */ moduleId)) as unknown as StripeModule;
    cached = new mod.default(process.env.STRIPE_SECRET_KEY);
    return cached;
  } catch (err) {
    console.warn('[backend] stripe package unavailable; using stub URLs.', (err as Error).message);
    cached = null;
    return cached;
  }
}

export type CheckoutSessionInput = {
  plan: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  priceId?: string;
};

export type CheckoutSessionResult = {
  url: string;
  id?: string;
  stub: boolean;
};

export async function createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
  const stripe = await getStripe();
  if (!stripe) {
    return {
      url: `https://checkout.stripe.com/dummy?plan=${encodeURIComponent(input.plan)}&user=${encodeURIComponent(input.userId)}`,
      stub: true
    };
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.userId,
    line_items: input.priceId
      ? [{ price: input.priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: input.plan },
              unit_amount: 2000,
              recurring: { interval: 'month' }
            },
            quantity: 1
          }
        ]
  });
  return { url: session.url ?? '', id: session.id, stub: false };
}

export async function verifyStripeSignature(
  payload: string | Buffer,
  signature: string
): Promise<unknown | null> {
  const stripe = await getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return null;
  }
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return null;
  }
}
