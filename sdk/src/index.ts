import { SDKClient } from './core/SDKClient.js';
import type { SDKConfig } from './core/types.js';

export function init(config: SDKConfig): void {
  SDKClient.init(config);
}

export function trackEvent(name: string, payload?: Record<string, unknown>): void {
  SDKClient.trackEvent(name, payload);
}

export function captureException(error: unknown): void {
  SDKClient.captureException(error);
}

export { SDKClient };

export type {
  BehaviorEventPayload,
  CustomEventPayload,
  Environment,
  ErrorCategory,
  ErrorEventPayload,
  EventType,
  PerformanceEventPayload,
  PerformanceMetricName,
  SDKConfig,
  TelemetryEvent
} from './core/types.js';
