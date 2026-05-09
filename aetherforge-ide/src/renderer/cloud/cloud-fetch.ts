import { useAccountStore } from '@/renderer/auth/account-store';

export function getCloudApiBaseUrl(): string {
  const env = (import.meta as unknown as { env?: { VITE_AETHERFORGE_API_URL?: string } }).env;
  return env?.VITE_AETHERFORGE_API_URL ?? 'http://localhost:8787';
}

/** Attaches `Authorization: Bearer <session>` for signed-in cloud calls. */
export async function cloudFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? undefined);
  const token = useAccountStore.getState().session?.token;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
}
