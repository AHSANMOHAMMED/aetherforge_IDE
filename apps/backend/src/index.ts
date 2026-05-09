import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerAuth } from './auth.js';
import { closePrisma } from './db.js';
import { registerAiProxyRoutes } from './routes/ai-proxy.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBillingRoutes } from './routes/billing.js';
import { registerOrgRoutes } from './routes/org.js';
import { registerSyncRoutes } from './routes/sync.js';
import { registerTelemetryRoutes } from './routes/telemetry.js';

const port = Number(process.env.PORT ?? 8787);
const VERSION = '0.0.1';
const SERVICE = 'aetherforge-backend';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await registerAuth(app);

app.get('/health', async () => ({ ok: true, service: SERVICE, version: VERSION }));

app.get('/v1/openapi.json', async () => ({
  openapi: '3.1.0',
  info: { title: 'AetherForge API', version: VERSION },
  servers: [{ url: `http://localhost:${port}` }],
  paths: {
    '/health': {
      get: { operationId: 'health', responses: { '200': { description: 'OK' } } }
    },
    '/v1/ai/proxy/usage': {
      get: { operationId: 'aiProxyUsage', responses: { '200': { description: 'Usage summary' } } }
    },
    '/v1/ai/proxy/chat': {
      post: { operationId: 'aiProxyChat', responses: { '200': { description: 'Chat completion' } } }
    },
    '/v1/auth/device/start': {
      post: { operationId: 'authDeviceStart', responses: { '200': { description: 'Device flow started' } } }
    },
    '/v1/auth/device/poll': {
      post: { operationId: 'authDevicePoll', responses: { '200': { description: 'Token poll' } } }
    },
    '/v1/auth/device/approve': {
      post: { operationId: 'authDeviceApprove', responses: { '200': { description: 'User code approved' } } }
    },
    '/v1/billing/plans': {
      get: { operationId: 'billingPlans', responses: { '200': { description: 'Plans' } } }
    },
    '/v1/billing/checkout-session': {
      post: { operationId: 'billingCheckout', responses: { '200': { description: 'Stripe checkout URL' } } }
    },
    '/v1/billing/webhook': {
      post: { operationId: 'billingWebhook', responses: { '200': { description: 'Webhook receipt' } } }
    },
    '/v1/sync/manifest': {
      post: { operationId: 'syncManifest', responses: { '200': { description: 'Manifest accepted' } } }
    },
    '/v1/sync/conflicts': {
      post: { operationId: 'syncConflicts', responses: { '200': { description: 'Conflict list' } } }
    },
    '/v1/org/{orgId}/policy': {
      get: { operationId: 'orgPolicy', responses: { '200': { description: 'Policy' } } },
      put: { operationId: 'orgPolicyUpdate', responses: { '200': { description: 'Updated' } } }
    },
    '/v1/telemetry/event': {
      post: { operationId: 'telemetryEvent', responses: { '200': { description: 'Recorded' } } }
    }
  }
}));

await registerAiProxyRoutes(app);
await registerAuthRoutes(app);
await registerBillingRoutes(app);
await registerSyncRoutes(app);
await registerOrgRoutes(app);
await registerTelemetryRoutes(app);

const closeOnSignal = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await closePrisma();
  process.exit(0);
};
process.once('SIGINT', () => void closeOnSignal('SIGINT'));
process.once('SIGTERM', () => void closeOnSignal('SIGTERM'));

await app.listen({ port, host: '0.0.0.0' });
