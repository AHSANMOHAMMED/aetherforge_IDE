# ADR 0002: Zod-validated IPC contracts

- **Status**: Accepted
- **Date**: 2026-05-09

## Context

`src/common/ipc.ts` declared TypeScript types for IPC payloads, but neither side validated runtime values. This let malformed payloads (or compromised plugins) reach FS / shell / git handlers in `electron/main.ts`.

## Decision

Every IPC channel publishes a **zod schema** for its payload and result. The preload bridge validates outbound payloads; the main-process handler validates inbound payloads and outbound results. Validation failures surface as structured `OperationResult` errors and are logged via `electron-log`.

Schemas live in `aetherforge-ide/src/common/ipc-schemas.ts` next to `ipc.ts`.

## Consequences

- Hard guarantee on IPC shape.
- Negligible runtime cost (≤1 ms / call for typical payloads).
- Schemas serve as the single source of truth for both sides.
