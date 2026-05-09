# AetherForge IDE — release & auto-update

## Channels

Packaged builds use **electron-updater** with GitHub releases (`electron-builder` `publish` config in `aetherforge-ide/package.json`).

Set the update channel before launch (packaged app only):

| `AF_UPDATE_CHANNEL` | Behaviour                                                                          |
| ------------------- | ---------------------------------------------------------------------------------- |
| `stable` (default)  | `autoUpdater.channel = latest` — follows normal GitHub `latest` feed.              |
| `beta`              | Subscribes to the beta prerelease channel (GitHub assets / feed must expose beta). |
| `nightly`           | Subscribes to the nightly prerelease channel.                                      |

Example:

```bash
export AF_UPDATE_CHANNEL=beta
open -a "AetherForge IDE"
```

Prerelease feeds must be produced by your release pipeline (e.g. separate GitHub pre-releases or `electron-builder` channel-specific `latest-*.yml` assets).

## CI & signing

- **PR / main:** `.github/workflows/ci.yml` — lint, typecheck, unit tests with coverage, Playwright smoke (built renderer via `vite preview`), and a dry-run `electron-builder` package per OS.
- **Tags `v*`:** `.github/workflows/release.yml` — build and `electron-builder --publish always`. Configure repo secrets:
  - macOS: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
  - Windows: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`

`notarize.teamId` in `package.json` must match your real Apple Developer Team ID for production notarization.

## Coverage

Unit tests run with `vitest run --coverage`. Thresholds apply to the AI utility modules listed in `vitest.config.ts` (`usage.ts`, `text-diff.ts`). Expand `coverage.include` as more modules gain tests.
