# Status, monitoring, and audit (V3)

## Sentry coverage

| Component                | Init                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| Electron main            | `electron/main.ts` reads `SENTRY_DSN` from env                                |
| Renderer                 | TODO — add `@sentry/electron/renderer` init in `src/renderer/main.tsx`        |
| Backend (`apps/backend`) | TODO — add `@sentry/node` init in `src/index.ts` reading `SENTRY_DSN_BACKEND` |

## Status page

Recommend a static page hosted on Cloudflare Pages or BetterStack. Endpoints to monitor:

- `GET /health` (backend Fastify)
- `GET /v1/openapi.json`
- Marketplace index (`https://marketplace.aetherforge.dev/index.json`)

Run synthetic checks every 60s; trigger pager on consecutive failures > 3.

## Audit logs (SOC2-ready)

Backend persists to `AuditLog` (Prisma model). Fields:

- `id` — cuid primary key
- `orgId` / `userId` — actor identifiers
- `action` — string (e.g. `org.policy.updated`, `ai.run.completed`, `sync.upload`)
- `metadata` — JSON, store request ID + diff summary
- `createdAt` — indexed on `[orgId, createdAt]`

Append-only invariant enforced at the application layer (no DELETE statements).

## Staged rollouts

`.github/workflows/release.yml` publishes signed installers via `electron-builder`. For staged rollouts:

1. Tag a prerelease (`v1.2.0-beta.1`) and let `AF_UPDATE_CHANNEL=beta` pick it up.
2. Promote to stable by retagging `v1.2.0` or republishing `latest.yml` to the stable channel.
