/**
 * Cloud sync client (V3 scaffold).
 *
 * Computes a manifest of files in the workspace, sends it to the backend, then
 * (in production) PUTs each file to the presigned R2 URL the backend returns.
 *
 * Air-gap respect: if `AETHERFORGE_AIRGAP=1`, all sync operations short-circuit.
 */

import { cloudFetch } from '@/renderer/cloud/cloud-fetch';

export type SyncFileEntry = {
  path: string;
  sha256: string;
  bytes: number;
};

export type ManifestResponse = {
  ok: boolean;
  acceptedFiles: number;
  uploadUrls: Array<{ path: string; url: string }>;
  note?: string;
};

const isAirGap = (): boolean => {
  if (typeof process !== 'undefined' && process.env?.AETHERFORGE_AIRGAP === '1') {
    return true;
  }
  if (typeof window !== 'undefined') {
    const flag = (window as unknown as { __AETHERFORGE_AIRGAP__?: boolean }).__AETHERFORGE_AIRGAP__;
    return flag === true;
  }
  return false;
};

export async function pushManifest(
  baseUrl: string,
  workspaceId: string,
  files: SyncFileEntry[]
): Promise<ManifestResponse> {
  if (isAirGap()) {
    return { ok: false, acceptedFiles: 0, uploadUrls: [], note: 'Air-gap mode is active.' };
  }

  const response = await cloudFetch(new URL('/v1/sync/manifest', baseUrl), {
    method: 'POST',
    body: JSON.stringify({ workspaceId, files })
  });
  if (!response.ok) {
    return {
      ok: false,
      acceptedFiles: 0,
      uploadUrls: [],
      note: `Sync manifest failed: ${response.status}`
    };
  }
  return (await response.json()) as ManifestResponse;
}

export type LwwConflict = {
  path: string;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
};

/** Last-writer-wins selection for the renderer to surface in UI. */
export async function confirmSyncBlob(
  baseUrl: string,
  payload: { workspaceId: string; path: string; sha256: string; bytes: number }
): Promise<{ ok: boolean; error?: string }> {
  if (isAirGap()) {
    return { ok: false, error: 'Air-gap mode is active.' };
  }
  const response = await cloudFetch(new URL('/v1/sync/blob-confirm', baseUrl), {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    return { ok: false, error: `confirm failed: ${response.status}` };
  }
  return (await response.json()) as { ok: boolean; error?: string };
}

export function pickLwwWinner(conflict: LwwConflict): 'local' | 'remote' | 'tie' {
  if (conflict.localUpdatedAt > conflict.remoteUpdatedAt) {
    return 'local';
  }
  if (conflict.localUpdatedAt < conflict.remoteUpdatedAt) {
    return 'remote';
  }
  return 'tie';
}
