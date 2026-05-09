# `@aetherforge/backend` (V3 scaffold)

Fastify + Prisma cloud API. **Not production yet.** Routes in `src/index.ts` are intentionally light so the CI build stays green without `DATABASE_URL`.

## Run locally

```bash
cd apps/backend
DATABASE_URL=postgres://... npm run prisma:migrate
npm run dev
```

## Endpoints

- `GET /health` — service identity
- `GET /v1/openapi.json` — used by `packages/sdk` codegen (run `openapi-typescript` against this)
- `GET /v1/ai/proxy/usage` — usage summary stub
- `GET /v1/billing/plans` — Stripe-backed plans stub
- `POST /v1/sync/manifest` — workspace diff sync entrypoint
- `GET /v1/org/:orgId/policy` — air-gap, provider, model, plugin allowlists

## Database

Schema in `prisma/schema.prisma`. Models: `Org`, `User`, `Membership`, `Workspace`, `SyncBlob`, `AiRun`, `UsageRow`, `ApiKey`, `OrgPolicy`, `AuditLog`.

## Next steps

1. Wire each endpoint to a Prisma-backed handler.
2. Add **better-auth** (or Clerk/WorkOS) for OAuth/SSO/SAML.
3. Mount Stripe webhook handler at `/v1/billing/webhook`.
4. Generate the SDK from `/v1/openapi.json` into `packages/sdk/src/generated.ts`.
