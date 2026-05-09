# ADR 0003: Electron host architecture

- **Status**: Accepted
- **Date**: 2026-05-09

## Context

`electron/main.ts` had grown to ~1100 lines mixing: window lifecycle, file/git/terminal/secrets/plugins/AI/scaffold/export. Hard to test, hard to reason about, and the terminal was `exec`-based (no PTY).

## Decision

Split the main process into **service modules** with a single `IpcRouter` registering them:

```
electron/
  main.ts           (window + bootstrap)
  ipc-router.ts     (zod validation + routing)
  services/
    fs.service.ts
    workspace.service.ts
    git.service.ts
    terminal.service.ts (node-pty)
    secrets.service.ts
    plugin.service.ts
    ai-proxy.service.ts (V3)
    update.service.ts
    telemetry.service.ts
```

Long-running things (PTY, watcher, LSP, DAP) live in dedicated child processes spawned by their service.

## Consequences

- Each service is independently testable.
- Adding a new IPC channel = add a schema + a service method, nothing else.
- The renderer never talks directly to subsystems; everything goes through the router.
