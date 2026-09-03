import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/queues/telemetry.queue.js', () => ({
  queueProducer: {
    addBatch: vi.fn(async () => ({ queued: true })),
    getStats: vi.fn(() => ({ pendingBatches: 0, inFlight: 0, processed: 0, failed: 0, dropped: 0 })),
    waitForDrain: vi.fn(async () => {})
  }
}));

vi.mock('../src/database/connection.js', () => ({
  db: vi.fn(),
  checkDatabaseConnection: vi.fn(async () => true),
  closeDatabaseConnection: vi.fn(async () => {})
}));

vi.mock('../src/lib/rate-limit.js', () => ({
  ingestRateLimit: {
    limit: vi.fn(async () => ({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60_000 }))
  }
}));

const { buildServer } = await import('../src/app.js');
const { queueProducer } = await import('../src/queues/telemetry.queue.js');

function makeErrorEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: '11111111-1111-4111-8111-111111111111',
    appId: 'my-app',
    timestamp: Date.now(),
    environment: 'production',
    url: 'https://example.com/page',
    userAgent: 'vitest-agent',
    type: 'error',
    errorDetails: { category: 'JS_RUNTIME', message: 'boom' },
    ...overrides
  };
}

describe('POST /api/v1/telemetry', () => {
  const app = buildServer();

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a valid batch sent as application/json and responds 202 immediately', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      payload: [makeErrorEvent()],
      headers: { 'content-type': 'application/json' }
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ status: 'queued', accepted: 1, rejected: 0 });
    expect(queueProducer.addBatch).toHaveBeenCalledTimes(1);
  });

  it('accepts a batch sent as text/plain, mirroring navigator.sendBeacon', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      payload: JSON.stringify([makeErrorEvent({ eventId: '22222222-2222-4222-8222-222222222222' })]),
      headers: { 'content-type': 'text/plain' }
    });

    expect(res.statusCode).toBe(202);
    expect(res.json().accepted).toBe(1);
  });

  it('discards corrupted items but keeps valid ones from the same batch', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      payload: [makeErrorEvent({ eventId: '33333333-3333-4333-8333-333333333333' }), { garbage: true }],
      headers: { 'content-type': 'application/json' }
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toMatchObject({ accepted: 1, rejected: 1 });
  });

  it('rejects with 400 when every item in the batch is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      payload: [{ garbage: true }],
      headers: { 'content-type': 'application/json' }
    });

    expect(res.statusCode).toBe(400);
    expect(queueProducer.addBatch).not.toHaveBeenCalled();
  });

  it('rejects an empty array', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      payload: [],
      headers: { 'content-type': 'application/json' }
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects a batch larger than BATCH_MAX_EVENTS', async () => {
    const oversizedBatch = Array.from({ length: 501 }, (_, i) =>
      makeErrorEvent({ eventId: `44444444-4444-4444-8444-4444444444${String(i).padStart(2, '0')}`.slice(0, 36) })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry',
      payload: oversizedBatch,
      headers: { 'content-type': 'application/json' }
    });

    expect(res.statusCode).toBe(400);
  });
});
