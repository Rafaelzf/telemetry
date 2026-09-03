import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('*'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  UPSTASH_REDIS_REST_URL: z.string().min(1, 'UPSTASH_REDIS_REST_URL is required'),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required'),
  MAX_PAYLOAD_BYTES: z.coerce.number().int().positive().default(1_048_576),
  BATCH_MAX_EVENTS: z.coerce.number().int().positive().default(500),
  // Each concurrent poll loop hits Redis roughly (1000 / QUEUE_POLL_INTERVAL_MS) times/sec even when
  // the queue is empty. Upstash's free Redis plan caps at 10,000 requests/day, so these defaults are
  // tuned to stay well under that at idle (1 loop x every 60s ~= 1,440 req/day) rather than for low
  // latency. Raise QUEUE_CONCURRENCY / lower QUEUE_POLL_INTERVAL_MS only on a paid Redis plan.
  QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(1),
  QUEUE_MAX_SIZE: z.coerce.number().int().positive().default(10_000),
  QUEUE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  INGEST_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  INGEST_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  METRICS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30)
});

function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();

export const corsOrigins = env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
