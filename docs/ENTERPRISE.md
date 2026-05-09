# Enterprise readiness (V3)

## SSO / SAML / OIDC

Recommended providers: **better-auth**, **WorkOS**, or **Clerk** for managed SAML/OIDC. The `apps/backend` Fastify
service should mount the auth plugin first; protected routes call `request.user.orgId` to scope queries.

## Org policy engine

`OrgPolicy` (Prisma) holds:

- `airGap: boolean` — gate marketplace, sync, telemetry, and cloud AI providers.
- `providerAllow / modelAllow / pluginAllow: string[]` — UI surfaces only items in the allowlist (empty = allow all).

The renderer caches the policy in `policy-store.ts` and exposes a `PolicyPanel` to admins. Air-gap toggling is wired
through `window.__AETHERFORGE_AIRGAP__` so the marketplace remote-index and sync client short-circuit network
calls.

## Reference customer onboarding

1. Provision dedicated `Org` row, assign admin `User` via SSO claim.
2. Set `OrgPolicy.airGap = true` if customer requires it.
3. Self-host `apps/backend` in their VPC; point IDE clients at the resulting URL via `AETHERFORGE_BACKEND_URL`.
4. Bundle their internal marketplace mirror at `https://<their-host>/marketplace/index.json` and set
   `AETHERFORGE_MARKETPLACE_URL`.
5. Run quarterly access review using the `AuditLog` exports.
