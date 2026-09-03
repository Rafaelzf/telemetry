import { describe, expect, it, vi } from 'vitest';
import { BatchQueueManager } from '../src/transport/BatchQueueManager.js';
import type { TelemetryEvent } from '../src/core/types.js';
import type { TransportEngine } from '../src/transport/TransportEngine.js';

function makeEvent(id: number): TelemetryEvent {
  return {
    eventId: String(id),
    appId: 'test-app',
    timestamp: Date.now(),
    environment: 'development',
    url: 'https://example.com',
    userAgent: 'vitest',
    type: 'custom',
    name: 'unit-test-event'
  };
}

function makeMockTransport() {
  const send = vi.fn();
  return { send, transport: { send } as unknown as TransportEngine };
}

describe('BatchQueueManager', () => {
  it('flushes automatically once maxBatchSize is reached', () => {
    const { send, transport } = makeMockTransport();
    const queue = new BatchQueueManager({ maxBatchSize: 3, flushIntervalMs: 60_000, sampleRate: 1, transport });

    queue.push(makeEvent(1));
    queue.push(makeEvent(2));
    expect(send).not.toHaveBeenCalled();

    queue.push(makeEvent(3));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toHaveLength(3);

    queue.destroy();
  });

  it('drops events when sampleRate is 0', () => {
    const { send, transport } = makeMockTransport();
    const queue = new BatchQueueManager({ maxBatchSize: 1, flushIntervalMs: 60_000, sampleRate: 0, transport });

    queue.push(makeEvent(1));
    expect(send).not.toHaveBeenCalled();

    queue.destroy();
  });

  it('flush() is a no-op when the queue is empty', () => {
    const { send, transport } = makeMockTransport();
    const queue = new BatchQueueManager({ maxBatchSize: 5, flushIntervalMs: 60_000, sampleRate: 1, transport });

    queue.flush();
    expect(send).not.toHaveBeenCalled();

    queue.destroy();
  });
});
