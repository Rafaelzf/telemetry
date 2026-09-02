import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/database/connection.js', () => ({
  db: vi.fn(),
  checkDatabaseConnection: vi.fn(async () => true),
  closeDatabaseConnection: vi.fn(async () => {})
}));

vi.mock('../src/queues/telemetry.queue.js', () => ({
  queueProducer: {
    addBatch: vi.fn(async () => ({ queued: true })),
    getStats: vi.fn(() => ({ pendingBatches: 0, inFlight: 0, processed: 0, failed: 0, dropped: 0 })),
    waitForDrain: vi.fn(async () => {})
  }
}));

vi.mock('../src/config/redis.js', () => ({
  redis: {},
  closeRedisConnection: vi.fn(async () => {})
}));

const { buildServer } = await import('../src/app.js');

describe('GET /api/v1/metrics/errors', () => {
  const app = buildServer();
  afterAll(async () => {
    await app.close();
  });

  it('requires an appId query parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/metrics/errors' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/metrics/performance', () => {
  const app = buildServer();
  afterAll(async () => {
    await app.close();
  });

  it('requires an appId query parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/metrics/performance' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/health', () => {
  const app = buildServer();
  afterAll(async () => {
    await app.close();
  });

  it('reports ok when the database check succeeds', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});
