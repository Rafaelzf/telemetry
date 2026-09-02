process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/telemetry_test';
process.env.REDIS_URL ??= 'rediss://default:test@localhost:6379';
process.env.UPSTASH_REDIS_REST_URL ??= 'https://localhost';
process.env.UPSTASH_REDIS_REST_TOKEN ??= 'test-token';
process.env.CORS_ORIGIN ??= '*';
