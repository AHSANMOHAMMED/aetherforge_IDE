# ADR 0001: Monorepo structure (npm workspaces + Turborepo)

- **Status**: Accepted
- **Date**: 2026-05-09
- **Deciders**: AetherForge core team

## Context

The repository began as a single Electron application (`aetherforge-ide/`). The product roadmap requires:

- A shared design system (`packages/ui`).
- Reusable AI orchestration / canvas / plugin SDK packages.
- An optional hosted backend (`apps/backend`) introduced in V3.
- A typed SDK consumed by both desktop and backend.

## Decision

Adopt **npm workspaces** at the repository root with **Turborepo** for task orchestration.

```
aetherforge/
  apps/
    desktop/       (existing aetherforge-ide is the desktop workspace)
    backend/       (V3)
  packages/
    ui/
    ai-core/
    canvas-core/
    plugin-sdk/
    sdk/
```

`aetherforge-ide` remains in its current path as a workspace member to avoid disruptive moves; new packages live under `packages/*` and `apps/*`.

## Why npm workspaces (not pnpm)

The existing project uses `npm`. Migrating mid-flight has risk and minimal upside for our scale (≤10 packages). `npm@10` workspaces are sufficient.

## Why Turborepo

Cache-aware task running, remote cache support, simple `turbo.json` per repo. No DX cost over plain npm scripts.

## Consequences

- Positive: incremental refactor path, shared lockfile, atomic CI.
- Negative: slightly larger root `node_modules` due to hoisting; requires discipline on `peerDependencies`.

## Follow-ups

- Add `packages/*` packages incrementally as code is extracted.
- Migrate to **pnpm** if/when total install size becomes a problem.
