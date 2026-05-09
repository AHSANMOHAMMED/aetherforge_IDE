# V3 implementation notes (sync, AI proxy, ops, enterprise)

These items are **partially scaffolded** in-repo; production rollout needs infra (Neon Postgres, Upstash Redis, Cloudflare R2, Stripe, IdP).

## Project sync (`v3-sync`)

- **Target model:** workspace watcher → diff batches → signed uploads to object storage (R2) with LWW metadata for conflict resolution; optional org-scoped encryption envelope.
- **Client hooks:** extend `workspace.service` IPC with `sync:pushSession` / `sync:pullSession` once auth exists (`apps/backend`).
- **E2EE mode:** derive workspace key from org passphrase (KDF) — document UX in settings; do not log raw passphrases.

## AI proxy + billing (`v3-aiproxy`)

- **Backend stubs:** `GET /v1/ai/proxy/usage`, `GET /v1/billing/plans` in `apps/backend`.
- **Next steps:** Stripe customer + subscription webhooks; persist usage rows keyed by org/user/run; audit log table with immutable append.

## Ops (`v3-ops`)

- **Sentry:** main/renderer already honor `SENTRY_DSN`; add same env to `apps/backend` Fastify `Sentry.init` when packaging server.
- **Releases:** see `docs/RELEASE.md` for desktop channels; backend should use staged deploy (canary % on load balancer) and synthetic checks on `/health`.

## Enterprise (`v3-enterprise`)

- **SSO:** better-auth / WorkOS / Clerk — pick one IdP integration; expose `GET /v1/org/:id/policy` returning provider allowlists and model caps.
- **Air-gap:** env `AETHERFORGE_AIRGAP=1` to disable cloud marketplace + telemetry + remote sync; bundle marketplace index from `packages/marketplace-index`.
