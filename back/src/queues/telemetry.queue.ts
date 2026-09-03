import { env } from '../config/env.js';
import { restRedis } from '../config/redis-rest.js';
import type { TelemetryBatch } from '../schemas/telemetry.schema.js';
import { processTelemetryQueueBatch } from '../workers/telemetry.worker.js';

const QUEUE_KEY = 'telemetry:queue:jobs';

/** Bounds how long a single Redis round-trip may take before we treat it as unavailable, rather than hanging the request. */
const REDIS_OP_TIMEOUT_MS = 3_000;

/**
 * How long a getStats() result is reused before re-querying Redis. Render's own health-check
 * probe hits /health (and therefore getStats) roughly every 5s; without this, that alone adds
 * ~17k LLEN calls/day against Upstash's 10k/day free-tier cap, on top of the poll loop's own usage.
 */
const STATS_CACHE_TTL_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), REDIS_OP_TIMEOUT_MS))]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Redis-list-backed queue over Upstash's REST API (HTTPS/443), instead of BullMQ
 * over a persistent TCP connection (rediss://, port 6379). Some networks silently
 * block/reset outbound TCP 6379 via deep packet inspection while HTTPS stays open
 * (see SSD.md §7), so this keeps ingestion working in more environments.
 *
 * REST has no blocking pop or pub/sub, so consumers poll the list instead of
 * subscribing to job events — `QUEUE_CONCURRENCY` poll loops run concurrently,
 * each polling every `QUEUE_POLL_INTERVAL_MS` when the list is empty.
 */
class TelemetryQueue {
  private stopped = false;
  private inFlight = 0;
  private processed = 0;
  private failed = 0;
  private dropped = 0;
  private statsCache: { value: QueueStats; expiresAt: number } | null = null;

  constructor() {
    for (let i = 0; i < env.QUEUE_CONCURRENCY; i++) {
      void this.pollLoop();
    }
  }

  async addBatch(batch: TelemetryBatch): Promise<{ queued: boolean }> {
    const length = await withTimeout(restRedis.llen(QUEUE_KEY), -1);
    if (length === -1 || length >= env.QUEUE_MAX_SIZE) {
      this.dropped += 1;
      return { queued: false };
    }

    const added = await withTimeout(
      restRedis.rpush(QUEUE_KEY, batch).then(() => true),
      false
    );
    if (!added) this.dropped += 1;
    return { queued: added };
  }

  private async pollLoop(): Promise<void> {
    while (!this.stopped) {
      let batch: TelemetryBatch | null = null;
      try {
        batch = await withTimeout(restRedis.lpop<TelemetryBatch>(QUEUE_KEY), null);
      } catch (error) {
        console.error('[telemetry.queue] poll failed', error);
      }

      if (!batch) {
        await sleep(env.QUEUE_POLL_INTERVAL_MS);
        continue;
      }

      this.inFlight += 1;
      try {
        await processTelemetryQueueBatch(batch);
        this.processed += 1;
      } catch (error) {
        this.failed += 1;
        console.error('[telemetry.queue] failed to process batch', error);
      } finally {
        this.inFlight -= 1;
      }
    }
  }

  /** Cached per STATS_CACHE_TTL_MS — called on every /health request, which Render's own uptime probe hits every ~5s. */
  async getStats(): Promise<QueueStats> {
    if (this.statsCache && Date.now() < this.statsCache.expiresAt) {
      return this.statsCache.value;
    }

    const stats = await this.fetchStats();
    this.statsCache = { value: stats, expiresAt: Date.now() + STATS_CACHE_TTL_MS };
    return stats;
  }

  private async fetchStats() {
    const length = await withTimeout(restRedis.llen(QUEUE_KEY), null);
    if (length === null) {
      return { pendingBatches: null, inFlight: this.inFlight, processed: this.processed, failed: this.failed, dropped: this.dropped, redisReachable: false };
    }

    return {
      pendingBatches: length,
      inFlight: this.inFlight,
      processed: this.processed,
      failed: this.failed,
      dropped: this.dropped,
      redisReachable: true
    };
  }

  /** Stops polling for new jobs and waits for in-flight ones to finish, up to timeoutMs. */
  async waitForDrain(timeoutMs: number): Promise<void> {
    this.stopped = true;
    const deadline = Date.now() + timeoutMs;
    while (this.inFlight > 0 && Date.now() < deadline) {
      await sleep(50);
    }
  }
}

type QueueStats = Awaited<ReturnType<TelemetryQueue['fetchStats']>>;

export const queueProducer = new TelemetryQueue();
