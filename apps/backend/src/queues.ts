/**
 * Lazy BullMQ usage queue — heavy attribution off the request path when Redis is configured.
 */

export type UsageQueuePayload = {
  userId: string;
  feature: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

let usageQueue: { add: (name: string, data: UsageQueuePayload) => Promise<unknown> } | null | undefined;

export async function getUsageQueue(): Promise<{
  add: (name: string, data: UsageQueuePayload) => Promise<unknown>;
} | null> {
  if (usageQueue !== undefined) {
    return usageQueue;
  }
  const url = process.env.REDIS_URL;
  if (!url) {
    usageQueue = null;
    return usageQueue;
  }
  try {
    const { Queue } = await import(/* @vite-ignore */ 'bullmq');
    const connection = { url };
    usageQueue = new Queue<UsageQueuePayload>('usage', { connection }) as unknown as {
      add: (name: string, data: UsageQueuePayload) => Promise<unknown>;
    };
    return usageQueue;
  } catch (err) {
    console.warn('[backend] BullMQ unavailable; usage stays inline.', (err as Error).message);
    usageQueue = null;
    return usageQueue;
  }
}

export async function enqueueUsage(payload: UsageQueuePayload): Promise<void> {
  const q = await getUsageQueue();
  if (!q) return;
  await q.add('record', payload);
}
