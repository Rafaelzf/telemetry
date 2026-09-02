process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/telemetry_test';
process.env.CORS_ORIGIN ??= '*';
