import { Redis } from '@upstash/redis';
import { env } from './env.js';

/**
 * Upstash Redis REST client (HTTPS, works where TCP/6379 is firewalled).
 * Used for cache and rate limiting; the ingestion queue uses the TCP client
 * in ./redis.ts instead, since BullMQ requires a persistent connection.
 */
export const restRedis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN
});
