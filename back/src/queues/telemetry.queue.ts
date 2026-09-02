import { env } from '../config/env.js';
import type { TelemetryBatch } from '../schemas/telemetry.schema.js';
import { processTelemetryQueueBatch } from '../workers/telemetry.worker.js';

/**
 * Single-instance, in-memory producer/consumer queue.
 * Matches the "fila em memória para instâncias únicas" option from the SDD.
 * Swap this module for a BullMQ/Redis-backed producer to scale beyond one instance
 * without touching the ingestion controller or the worker's batch-processing logic.
 */
class InMemoryTelemetryQueue {
  private pending: TelemetryBatch[] = [];
  private inFlight = 0;
  private processed = 0;
  private failed = 0;
  private dropped = 0;

  async addBatch(batch: TelemetryBatch): Promise<{ queued: boolean }> {
    if (this.pending.length >= env.QUEUE_MAX_SIZE) {
      this.dropped += 1;
      return { queued: false };
    }

    this.pending.push(batch);
    queueMicrotask(() => this.drain());
    return { queued: true };
  }

  getStats() {
    return {
      pendingBatches: this.pending.length,
      inFlight: this.inFlight,
      processed: this.processed,
      failed: this.failed,
      dropped: this.dropped
    };
  }

  private drain(): void {
    while (this.inFlight < env.QUEUE_CONCURRENCY && this.pending.length > 0) {
      const batch = this.pending.shift();
      if (!batch) break;
      this.inFlight += 1;

      processTelemetryQueueBatch(batch)
        .then(() => {
          this.processed += 1;
        })
        .catch((error: unknown) => {
          this.failed += 1;
          console.error('[telemetry.queue] failed to process batch', error);
        })
        .finally(() => {
          this.inFlight -= 1;
          if (this.pending.length > 0) this.drain();
        });
    }
  }

  /** Waits until the queue is fully drained, or the timeout elapses. Used for graceful shutdown. */
  async waitForDrain(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while ((this.pending.length > 0 || this.inFlight > 0) && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

export const queueProducer = new InMemoryTelemetryQueue();
