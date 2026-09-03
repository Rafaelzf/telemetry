import { safeTry } from '../core/utils.js';
import type { TelemetryEvent } from '../core/types.js';
import type { TransportEngine } from './TransportEngine.js';

export interface BatchQueueOptions {
  maxBatchSize: number;
  flushIntervalMs: number;
  sampleRate: number;
  transport: TransportEngine;
}

export class BatchQueueManager {
  private queue: TelemetryEvent[] = [];
  private readonly intervalId: ReturnType<typeof setInterval> | null;
  private readonly onBeforeUnload = () => this.flush({ beacon: true });
  private readonly onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') this.flush({ beacon: true });
  };

  constructor(private readonly options: BatchQueueOptions) {
    this.intervalId =
      typeof window !== 'undefined' ? setInterval(() => this.flush(), options.flushIntervalMs) : null;

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.onBeforeUnload);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  push(event: TelemetryEvent): void {
    safeTry(() => {
      if (Math.random() >= this.options.sampleRate) return;
      this.queue.push(event);
      if (this.queue.length >= this.options.maxBatchSize) this.flush();
    }, 'BatchQueueManager.push');
  }

  flush(opts: { beacon?: boolean } = {}): void {
    safeTry(() => {
      if (this.queue.length === 0) return;
      const batch = this.queue;
      this.queue = [];
      this.options.transport.send(batch, opts);
    }, 'BatchQueueManager.flush');
  }

  destroy(): void {
    if (this.intervalId !== null) clearInterval(this.intervalId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.onBeforeUnload);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.queue = [];
  }
}
