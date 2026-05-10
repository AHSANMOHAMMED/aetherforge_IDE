/**
 * GitHub device flow + Copilot token exchange (best-effort; may break per GitHub TOS / API changes).
 * @see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */
import { writeOAuthBundle } from '../credentials';

const GITHUB_DEVICE_CLIENT_ID = 'Iv1.8a61f9b3e7933181';

export async function signInGithubCopilot(): Promise<void> {
  console.warn(
    '[AetherForge] GitHub Copilot device sign-in uses unofficial token exchange; may violate GitHub TOS.'
  );

  const start = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: GITHUB_DEVICE_CLIENT_ID,
      scope: 'read:user'
    }).toString()
  });

  if (!start.ok) {
    throw new Error(`GitHub device start failed: ${start.status}`);
  }

  const device = (await start.json()) as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    interval?: number;
    expires_in?: number;
  };

  if (!device.device_code || !device.verification_uri || !device.user_code) {
    throw new Error('GitHub device flow returned an unexpected payload.');
  }

  const verifyUrl = `${device.verification_uri}?user_code=${encodeURIComponent(device.user_code)}`;
  if (window.electronAPI?.openExternalUrl) {
    await window.electronAPI.openExternalUrl(verifyUrl);
  } else {
    window.open(verifyUrl, '_blank', 'noopener,noreferrer');
  }

  const intervalMs = Math.max(5000, (device.interval ?? 5) * 1000);
  const deadline = Date.now() + (device.expires_in ?? 900) * 1000;
  let accessToken = '';

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const tok = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: GITHUB_DEVICE_CLIENT_ID,
        device_code: device.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      }).toString()
    });
    const body = (await tok.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (body.access_token) {
      accessToken = body.access_token;
      break;
    }
    if (body.error === 'authorization_pending') {
      continue;
    }
    if (body.error === 'slow_down') {
      continue;
    }
    throw new Error(body.error_description ?? body.error ?? 'GitHub OAuth failed');
  }

  if (!accessToken) {
    throw new Error('GitHub device authorization timed out.');
  }

  const copilotRes = await fetch('https://api.github.com/copilot_internal/v2/token', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'AetherForge-IDE/1.0'
    }
  });

  if (!copilotRes.ok) {
    const t = await copilotRes.text();
    throw new Error(`Copilot token exchange failed (${copilotRes.status}): ${t.slice(0, 200)}`);
  }

  const copilot = (await copilotRes.json()) as {
    token?: string;
    access_token?: string;
    expires_at?: number;
    refresh_in?: number;
  };

  const jwt = copilot.token ?? copilot.access_token;
  if (!jwt) {
    throw new Error('Copilot token response missing token field.');
  }

  const expiresAt =
    typeof copilot.expires_at === 'number'
      ? copilot.expires_at < 2e12
        ? copilot.expires_at * 1000
        : copilot.expires_at
      : Date.now() + (copilot.refresh_in ?? 1800) * 1000;

  await writeOAuthBundle('copilot', {
    accessToken: jwt,
    refreshToken: accessToken,
    expiresAt,
    scope: 'copilot',
    login: 'github-copilot'
  });
}

export { openSignupUrl } from './apikey-onboarding';
