import { writeOAuthBundle } from '../credentials';

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomVerifier(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return b64url(a.buffer);
}

function randomState(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return b64url(a.buffer);
}

async function sha256base64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return b64url(digest);
}

function waitLoopback(expectedState: string, timeoutMs: number): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    if (!window.electronAPI?.onOAuthLoopbackResult) {
      reject(new Error('OAuth loopback is only available in the desktop app.'));
      return;
    }
    const timer = window.setTimeout(() => {
      unsub();
      void window.electronAPI?.oauthStopLoopback?.();
      reject(new Error('OAuth timed out waiting for browser redirect.'));
    }, timeoutMs);
    const unsub = window.electronAPI.onOAuthLoopbackResult((p) => {
      if (p.state === expectedState && p.code) {
        window.clearTimeout(timer);
        unsub();
        resolve(p);
      }
    });
  });
}

/**
 * PKCE sign-in for OpenAI-account-backed providers (`chatgpt`, `codex`).
 * Set `VITE_OPENAI_OAUTH_CLIENT_ID` to a real OAuth client; otherwise this is a no-op stub.
 */
export async function signInOpenAiPkce(targetProvider: 'chatgpt' | 'codex'): Promise<void> {
  const clientId =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_OAUTH_CLIENT_ID) ||
    'app-placeholder-openai-oauth-client';

  if (clientId === 'app-placeholder-openai-oauth-client') {
    throw new Error(
      'Set VITE_OPENAI_OAUTH_CLIENT_ID to your OpenAI OAuth client id to enable ChatGPT / Codex sign-in.'
    );
  }

  const codeVerifier = randomVerifier();
  const codeChallenge = await sha256base64url(codeVerifier);
  const state = randomState();

  const start = await window.electronAPI!.oauthStartLoopback({ expectedState: state });
  if (!start.ok) {
    throw new Error(start.error ?? 'Failed to start OAuth loopback');
  }

  const redirectUri = start.redirectUri;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email offline_access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  const authUrl = `https://auth.openai.com/oauth/authorize?${params.toString()}`;
  await window.electronAPI!.openExternalUrl(authUrl);

  const { code } = await waitLoopback(state, 10 * 60_000);

  const tokenRes = await fetch('https://api.openai.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier
    }).toString()
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`OpenAI token exchange failed: ${err.slice(0, 300)}`);
  }

  const data = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error('OpenAI token response missing access_token.');
  }

  await writeOAuthBundle(targetProvider, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    login: targetProvider
  });

  await window.electronAPI!.oauthStopLoopback();
}
