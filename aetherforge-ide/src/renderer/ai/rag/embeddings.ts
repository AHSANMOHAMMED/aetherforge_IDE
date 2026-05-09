const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const TOKEN_BUDGET = 256;

type EmbeddingFn = (text: string, options: Record<string, unknown>) => Promise<{ data: Float32Array }>;

let embedder: EmbeddingFn | null = null;
let pending: Promise<EmbeddingFn> | null = null;

async function loadEmbedder(): Promise<EmbeddingFn> {
  if (embedder) {
    return embedder;
  }
  if (!pending) {
    pending = (async () => {
      const transformers = (await import(
        /* @vite-ignore */ '@xenova/transformers'
      )) as typeof import('@xenova/transformers');
      transformers.env.allowLocalModels = true;
      transformers.env.allowRemoteModels = true;
      transformers.env.useBrowserCache = true;
      const fn = (await transformers.pipeline('feature-extraction', MODEL_ID)) as unknown as EmbeddingFn;
      embedder = fn;
      return fn;
    })();
  }
  return pending;
}

function chunkText(text: string, max = TOKEN_BUDGET * 4): string[] {
  if (text.length <= max) {
    return [text];
  }
  const out: string[] = [];
  for (let i = 0; i < text.length; i += max) {
    out.push(text.slice(i, i + max));
  }
  return out;
}

export type EmbeddedChunk = {
  id: string;
  source: string;
  text: string;
  embedding: Float32Array;
};

export async function embedDocuments(
  docs: Array<{ id: string; source: string; text: string }>
): Promise<EmbeddedChunk[]> {
  const fn = await loadEmbedder();
  const chunks: EmbeddedChunk[] = [];
  for (const doc of docs) {
    const parts = chunkText(doc.text);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const result = await fn(part, { pooling: 'mean', normalize: true });
      chunks.push({
        id: parts.length === 1 ? doc.id : `${doc.id}#${i}`,
        source: doc.source,
        text: part,
        embedding: result.data
      });
    }
  }
  return chunks;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) {
    return 0;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function searchEmbeddings(
  query: string,
  index: EmbeddedChunk[],
  topK = 5
): Promise<EmbeddedChunk[]> {
  if (index.length === 0) {
    return [];
  }
  const fn = await loadEmbedder();
  const queryVec = await fn(query, { pooling: 'mean', normalize: true });
  return index
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryVec.data, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry) => entry.chunk);
}
