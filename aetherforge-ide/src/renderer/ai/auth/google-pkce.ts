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

function waitLoopback(expectedState: string, timeoutMs: number): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    if (!window.electronAPI?.onOAuthLoopbackResult) {
      reject(new Error('OAuth loopback is only available in the desktop app.'));
      return;
    }
    const timer = window.setTimeout(() => {
      unsub();
      void window.electronAPI?.oauthStopLoopback?.();
      reject(new Error('Google OAuth timed out.'));
    }, timeoutMs);
    const unsub = window.electronAPI.onOAuthLoopbackResult((p) => {
      if (p.state === expectedState && p.code) {
        window.clearTimeout(timer);
        unsub();
        resolve({ code: p.code });
      }
    });
  });
}

/**
 * Installed-app style Google OAuth for Gemini API access tokens.
 * Configure `VITE_GOOGLE_OAUTH_CLIENT_ID` in the renderer env.
 */
export async function signInGoogleGemini(): Promise<void> {
  const clientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_OAUTH_CLIENT_ID) || '';

  if (!clientId) {
    throw new Error('Set VITE_GOOGLE_OAUTH_CLIENT_ID to enable Google sign-in for Gemini.');
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
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/generative-language.retriever',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent'
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  await window.electronAPI!.openExternalUrl(authUrl);

  const { code } = await waitLoopback(state, 10 * 60_000);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier
    }).toString()
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${err.slice(0, 300)}`);
  }

  const data = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error('Google token response missing access_token.');
  }

  await writeOAuthBundle('gemini', {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    login: 'google-gemini'
  });

  await window.electronAPI!.oauthStopLoopback();
}
