import { env } from '../config/env.js';
import { restRedis } from '../config/redis-rest.js';

/** Cache-aside helper: returns the cached value for `key`, or computes and stores it via `fetcher`. */
export async function withCache<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = env.METRICS_CACHE_TTL_SECONDS): Promise<T> {
  const cached = await restRedis.get<T>(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  await restRedis.set(key, fresh, { ex: ttlSeconds });
  return fresh;
}
