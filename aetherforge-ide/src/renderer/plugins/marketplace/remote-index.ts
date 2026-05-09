import type { CatalogEntry } from './catalog';

type RemoteEntry = {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description?: string;
  dist?: { url: string; integrity?: string };
  engines?: Record<string, string>;
};

type RemoteIndex = {
  schema: number;
  updatedAt: string;
  extensions: RemoteEntry[];
};

const DEFAULT_REMOTE_INDEX_URL = 'https://marketplace.aetherforge.dev/index.json';

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

function toCatalogEntry(remote: RemoteEntry): CatalogEntry {
  return {
    id: remote.id,
    name: remote.name,
    description: remote.description ?? '',
    author: remote.publisher,
    version: remote.version,
    tags: [],
    downloads: 0,
    bundled: false,
    contributes: {}
  };
}

/** Fetch a public marketplace index. Returns [] in air-gap mode or on error. */
export async function fetchRemoteIndex(
  url = DEFAULT_REMOTE_INDEX_URL,
  signal?: AbortSignal
): Promise<CatalogEntry[]> {
  if (isAirGap()) {
    return [];
  }

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as RemoteIndex;
    if (!data || !Array.isArray(data.extensions)) {
      return [];
    }
    return data.extensions.map(toCatalogEntry);
  } catch {
    return [];
  }
}

/** Deduplicate by id; bundled / local catalog entries win on conflict. */
export function mergeCatalogs(local: CatalogEntry[], remote: CatalogEntry[]): CatalogEntry[] {
  const seen = new Set(local.map((entry) => entry.id));
  const merged = [...local];
  for (const entry of remote) {
    if (!seen.has(entry.id)) {
      merged.push(entry);
      seen.add(entry.id);
    }
  }
  return merged;
}
