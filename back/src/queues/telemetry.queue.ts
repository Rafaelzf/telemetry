import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import type { TelemetryBatch } from '../schemas/telemetry.schema.js';
import { processTelemetryQueueBatch } from '../workers/telemetry.worker.js';

const QUEUE_NAME = 'telemetry-ingestion';

/** Bounds how long a single Redis round-trip may take before we treat it as unavailable, rather than hanging the request. */
const REDIS_OP_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), REDIS_OP_TIMEOUT_MS))]);
}

/**
 * BullMQ producer/consumer queue backed by Redis (Upstash), replacing the
 * single-instance in-memory queue so ingestion can scale across multiple
 * backend instances sharing the same job queue.
 */
class TelemetryQueue {
  private queue = new Queue<TelemetryBatch>(QUEUE_NAME, { connection: redis });
  private worker = new Worker<TelemetryBatch>(
    QUEUE_NAME,
    async (job: Job<TelemetryBatch>) => {
      await processTelemetryQueueBatch(job.data);
    },
    { connection: redis, concurrency: env.QUEUE_CONCURRENCY }
  );
  private dropped = 0;

  constructor() {
    this.worker.on('failed', (job, error) => {
      console.error('[telemetry.queue] failed to process batch', { jobId: job?.id, error });
    });
  }

  async addBatch(batch: TelemetryBatch): Promise<{ queued: boolean }> {
    const pending = await withTimeout(this.queue.getJobCountByTypes('waiting', 'active', 'delayed'), -1);
    if (pending === -1 || pending >= env.QUEUE_MAX_SIZE) {
      this.dropped += 1;
      return { queued: false };
    }

    const added = await withTimeout(
      this.queue.add('batch', batch, { removeOnComplete: true, removeOnFail: 1000 }).then(() => true),
      false
    );
    if (!added) this.dropped += 1;
    return { queued: added };
  }

  async getStats() {
    const counts = await withTimeout(this.queue.getJobCounts('waiting', 'active', 'completed', 'failed'), null);
    if (!counts) {
      return { pendingBatches: null, inFlight: null, processed: null, failed: null, dropped: this.dropped, redisReachable: false };
    }

    return {
      pendingBatches: counts.waiting,
      inFlight: counts.active,
      processed: counts.completed,
      failed: counts.failed,
      dropped: this.dropped,
      redisReachable: true
    };
  }

  /**
   * Stops the worker from picking up new jobs and waits for in-flight ones to
   * finish, up to timeoutMs. BullMQ's close() has no built-in timeout, so a
   * force-close is triggered if graceful close doesn't finish in time.
   */
  async waitForDrain(timeoutMs: number): Promise<void> {
    let closedGracefully = false;
    const closePromise = this.worker.close().then(() => {
      closedGracefully = true;
    });

    await Promise.race([closePromise, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
    if (!closedGracefully) {
      await this.worker.close(true);
    }
    await this.queue.close();
  }
}

export const queueProducer = new TelemetryQueue();
