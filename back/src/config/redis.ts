import { Redis } from 'ioredis';
import { env } from './env.js';

/**
 * Shared Upstash Redis connection, reused across BullMQ queues/workers and
 * plain cache/rate-limit commands. maxRetriesPerRequest: null is required by
 * BullMQ workers (https://docs.bullmq.io/bull/patterns/persistent-connections)
 * and is harmless for regular GET/SET usage.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

redis.on('error', (error: Error) => {
  console.error('[redis] connection error', error);
});

export async function closeRedisConnection(): Promise<void> {
  await redis.quit();
}
