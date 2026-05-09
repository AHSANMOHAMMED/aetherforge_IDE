import * as Sentry from '@sentry/electron/renderer';

type ImportMetaEnvLite = {
  VITE_SENTRY_DSN?: string;
  VITE_APP_ENV?: string;
  DEV?: boolean;
};

let initialized = false;

/**
 * Initialize Sentry in the renderer process. Mirrors the main-process DSN guard so a missing DSN
 * silently no-ops in development. Honors the org policy `airGap` flag exposed via
 * `window.__AETHERFORGE_AIRGAP__` to avoid any network egress on locked-down deployments.
 */
export function initRendererSentry(): void {
  if (initialized) {
    return;
  }
  if (
    typeof window !== 'undefined' &&
    (window as { __AETHERFORGE_AIRGAP__?: boolean }).__AETHERFORGE_AIRGAP__
  ) {
    return;
  }

  const env = (import.meta as { env?: ImportMetaEnvLite }).env ?? {};
  const dsn = env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: env.VITE_APP_ENV ?? (env.DEV ? 'development' : 'production')
  });
  initialized = true;
}
