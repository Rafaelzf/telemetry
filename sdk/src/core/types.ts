export type Environment = 'development' | 'staging' | 'production';

export type EventType = 'error' | 'performance' | 'behavior' | 'custom';

export interface SDKConfig {
  endpoint: string;
  appId: string;
  environment: Environment;
  release?: string;
  /** Max events buffered before an automatic flush. Default: 10. */
  maxBatchSize?: number;
  /** Interval between timed flushes, in ms. Default: 5000. */
  flushIntervalMs?: number;
  /** Fraction of events kept, 0 to 1. Default: 1 (no sampling). */
  sampleRate?: number;
}

export interface ResolvedSDKConfig extends SDKConfig {
  maxBatchSize: number;
  flushIntervalMs: number;
  sampleRate: number;
}

export interface BaseTelemetryPayload {
  eventId: string;
  appId: string;
  timestamp: number;
  environment: Environment;
  release?: string;
  url: string;
  userAgent: string;
}

// Kept in sync with back/src/schemas/telemetry.schema.ts's ErrorCategorySchema.
export type ErrorCategory = 'JS_RUNTIME' | 'UNHANDLED_PROMISE' | 'RESOURCE' | 'HTTP_API' | 'REACT_RENDER' | 'UNKNOWN';

export interface ErrorEventPayload extends BaseTelemetryPayload {
  type: 'error';
  errorDetails: {
    category: ErrorCategory;
    message: string;
    stackTrace?: string;
    source?: string;
  };
}

// Kept in sync with back/src/schemas/telemetry.schema.ts's PerformanceMetricNameSchema.
export type PerformanceMetricName = 'LCP' | 'FCP' | 'CLS' | 'INP' | 'TTFB' | 'HTTP_LATENCY' | (string & {});

export interface PerformanceEventPayload extends BaseTelemetryPayload {
  type: 'performance';
  metrics: {
    metricName: PerformanceMetricName;
    value: number;
  };
}

export interface BehaviorEventPayload extends BaseTelemetryPayload {
  type: 'behavior';
  action: string;
  payload?: Record<string, unknown>;
}

export interface CustomEventPayload extends BaseTelemetryPayload {
  type: 'custom';
  name: string;
  payload?: Record<string, unknown>;
}

export type TelemetryEvent = ErrorEventPayload | PerformanceEventPayload | BehaviorEventPayload | CustomEventPayload;
