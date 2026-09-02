import { Ratelimit } from '@upstash/ratelimit';
import { env } from '../config/env.js';
import { restRedis } from '../config/redis-rest.js';

export const ingestRateLimit = new Ratelimit({
  redis: restRedis,
  limiter: Ratelimit.slidingWindow(env.INGEST_RATE_LIMIT_MAX, `${env.INGEST_RATE_LIMIT_WINDOW_SECONDS} s`),
  prefix: 'telemetry:ratelimit:ingest'
});
