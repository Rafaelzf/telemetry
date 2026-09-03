import { createBaseFields, safeTry } from '../core/utils.js';
import type { ErrorEventPayload, PerformanceEventPayload, ResolvedSDKConfig, TelemetryEvent } from '../core/types.js';

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

const OBSERVED_ENTRY_TYPES = ['largest-contentful-paint', 'first-input', 'layout-shift', 'paint'] as const;

export class PerfTracker {
  private observer: PerformanceObserver | null = null;
  private originalFetch: typeof window.fetch | null = null;
  private clsValue = 0;

  constructor(
    private readonly config: ResolvedSDKConfig,
    private readonly emit: (event: TelemetryEvent) => void
  ) {}

  start(): void {
    if (typeof window === 'undefined') return;
    safeTry(() => this.observeWebVitals(), 'PerfTracker.observeWebVitals');
    safeTry(() => this.patchFetch(), 'PerfTracker.patchFetch');
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.originalFetch && typeof window !== 'undefined') {
      window.fetch = this.originalFetch;
      this.originalFetch = null;
    }
  }

  private observeWebVitals(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    this.observer = new PerformanceObserver((list) => {
      safeTry(() => {
        for (const entry of list.getEntries()) this.handlePerformanceEntry(entry);
      }, 'PerfTracker.handlePerformanceEntry');
    });

    for (const type of OBSERVED_ENTRY_TYPES) {
      try {
        this.observer.observe({ type, buffered: true });
      } catch {
        // entry type unsupported in this browser; skip it
      }
    }
  }

  private handlePerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'paint':
        if (entry.name === 'first-contentful-paint') this.reportMetric('FCP', entry.startTime);
        break;
      case 'largest-contentful-paint':
        this.reportMetric('LCP', entry.startTime);
        break;
      case 'first-input': {
        // Approximates INP using the first-input entry (input delay + processing
        // time of the first interaction), not the full Event Timing API.
        const firstInput = entry as PerformanceEventTiming;
        this.reportMetric('INP', firstInput.processingStart - firstInput.startTime);
        break;
      }
      case 'layout-shift': {
        const shift = entry as LayoutShiftEntry;
        if (!shift.hadRecentInput) {
          this.clsValue += shift.value;
          this.reportMetric('CLS', this.clsValue);
        }
        break;
      }
    }
  }

  private reportMetric(metricName: PerformanceEventPayload['metrics']['metricName'], value: number): void {
    const payload: PerformanceEventPayload = {
      ...createBaseFields(this.config),
      type: 'performance',
      metrics: { metricName, value }
    };
    this.emit(payload);
  }

  private patchFetch(): void {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    const originalFetch = window.fetch.bind(window);
    this.originalFetch = originalFetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const start = performance.now();
      const requestUrl = describeRequestUrl(args[0]);

      try {
        const response = await originalFetch(...args);
        safeTry(() => {
          this.reportMetric('HTTP_LATENCY', performance.now() - start);
          if (response.status >= 400) this.reportHttpError(requestUrl, response.status);
        }, 'PerfTracker.fetch.onResolve');
        return response;
      } catch (error) {
        safeTry(() => {
          this.reportMetric('HTTP_LATENCY', performance.now() - start);
          this.reportHttpError(requestUrl, undefined, error);
        }, 'PerfTracker.fetch.onReject');
        throw error;
      }
    };
  }

  private reportHttpError(url: string, statusCode?: number, error?: unknown): void {
    const message =
      statusCode !== undefined
        ? `HTTP ${statusCode} - ${url}`
        : `Network error - ${url}: ${error instanceof Error ? error.message : String(error)}`;

    const payload: ErrorEventPayload = {
      ...createBaseFields(this.config),
      type: 'error',
      errorDetails: { category: 'HTTP_API', message }
    };
    this.emit(payload);
  }
}

function describeRequestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}
