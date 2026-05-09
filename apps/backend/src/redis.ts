/**
 * Lazy Redis client for device-flow state and BullMQ (optional).
 */

type RedisClient = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: string, ttl: number) => Promise<unknown>;
  del: (...keys: string[]) => Promise<unknown>;
};

let redis: RedisClient | null | undefined;

export async function getRedis(): Promise<RedisClient | null> {
  if (redis !== undefined) {
    return redis;
  }
  const url = process.env.REDIS_URL;
  if (!url) {
    redis = null;
    return redis;
  }
  try {
    const { default: IoRedis } = await import(/* @vite-ignore */ 'ioredis');
    redis = new IoRedis(url) as unknown as RedisClient;
    return redis;
  } catch (err) {
    console.warn('[backend] Redis unavailable; falling back to in-memory stores.', (err as Error).message);
    redis = null;
    return redis;
  }
}
