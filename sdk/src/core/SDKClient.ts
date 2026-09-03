import { resolveConfig } from './Config.js';
import { safeTry } from './utils.js';
import type { ResolvedSDKConfig, SDKConfig, TelemetryEvent } from './types.js';
import { BehaviorTracker } from '../trackers/BehaviorTracker.js';
import { ErrorTracker, type CaptureExceptionDetails } from '../trackers/ErrorTracker.js';
import { PerfTracker } from '../trackers/PerfTracker.js';
import { BatchQueueManager } from '../transport/BatchQueueManager.js';
import { TransportEngine } from '../transport/TransportEngine.js';

class SDKClientImpl {
  private config: ResolvedSDKConfig | null = null;
  private queue: BatchQueueManager | null = null;
  private errorTracker: ErrorTracker | null = null;
  private perfTracker: PerfTracker | null = null;
  private behaviorTracker: BehaviorTracker | null = null;
  private initialized = false;

  /** Singleton entry point. Subsequent calls are ignored (with a console warning). */
  init(config: SDKConfig): void {
    if (this.initialized) {
      if (typeof console !== 'undefined') console.warn('[telemetry-sdk] init() called more than once; ignoring');
      return;
    }

    safeTry(() => {
      const resolved = resolveConfig(config);
      this.config = resolved;

      const transport = new TransportEngine(resolved.endpoint);
      this.queue = new BatchQueueManager({
        maxBatchSize: resolved.maxBatchSize,
        flushIntervalMs: resolved.flushIntervalMs,
        sampleRate: resolved.sampleRate,
        transport
      });

      const emit = (event: TelemetryEvent) => this.queue?.push(event);
      this.errorTracker = new ErrorTracker(resolved, emit);
      this.perfTracker = new PerfTracker(resolved, emit);
      this.behaviorTracker = new BehaviorTracker(resolved, emit);

      this.errorTracker.start();
      this.perfTracker.start();
      this.behaviorTracker.start();

      this.initialized = true;
    }, 'SDKClient.init');
  }

  /** Dispatches a custom behavior event (RF-08). */
  trackEvent(name: string, payload?: Record<string, unknown>): void {
    safeTry(() => this.behaviorTracker?.trackCustomEvent(name, payload), 'SDKClient.trackEvent');
  }

  /** Dispatches a PAGE_VIEW behavior event. Used internally and by the React usePageTracking() hook. */
  trackPageView(url?: string): void {
    safeTry(() => this.behaviorTracker?.trackPageView(url), 'SDKClient.trackPageView');
  }

  /** Manually reports an exception. Used internally and by the React MonitoringErrorBoundary. */
  captureException(error: unknown, details?: CaptureExceptionDetails): void {
    safeTry(() => this.errorTracker?.captureException(error, details), 'SDKClient.captureException');
  }

  getConfig(): Readonly<SDKConfig> | null {
    return this.config;
  }

  /** Tears the singleton down. Exposed for tests; not part of the public API surface. */
  reset(): void {
    this.queue?.destroy();
    this.errorTracker?.stop();
    this.perfTracker?.stop();
    this.behaviorTracker?.stop();
    this.config = null;
    this.queue = null;
    this.errorTracker = null;
    this.perfTracker = null;
    this.behaviorTracker = null;
    this.initialized = false;
  }
}

export const SDKClient = new SDKClientImpl();
