import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorTracker } from '../src/trackers/ErrorTracker.js';
import type { ResolvedSDKConfig, TelemetryEvent } from '../src/core/types.js';

const config: ResolvedSDKConfig = {
  endpoint: 'https://example.com/api/v1/telemetry',
  appId: 'test-app',
  environment: 'development',
  maxBatchSize: 10,
  flushIntervalMs: 5000,
  sampleRate: 1
};

describe('ErrorTracker', () => {
  let emit: ReturnType<typeof vi.fn>;
  let tracker: ErrorTracker;

  beforeEach(() => {
    emit = vi.fn();
    tracker = new ErrorTracker(config, emit as (event: TelemetryEvent) => void);
    tracker.start();
  });

  afterEach(() => {
    tracker.stop();
  });

  it('captures uncaught runtime errors dispatched on window', () => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'boom', error: new Error('boom') }));

    expect(emit).toHaveBeenCalledTimes(1);
    const event = emit.mock.calls[0]![0];
    expect(event.type).toBe('error');
    expect(event.errorDetails.category).toBe('JS_RUNTIME');
    expect(event.errorDetails.message).toBe('boom');
  });

  it('captures unhandled promise rejections', () => {
    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', { value: new Error('rejected') });
    window.dispatchEvent(event);

    expect(emit).toHaveBeenCalledTimes(1);
    const payload = emit.mock.calls[0]![0];
    expect(payload.errorDetails.category).toBe('UNHANDLED_PROMISE');
    expect(payload.errorDetails.message).toBe('rejected');
  });

  it('captures manual exceptions via captureException, tagging the category and component stack', () => {
    tracker.captureException(new Error('manual'), { category: 'REACT_RENDER', componentStack: 'in Foo' });

    expect(emit).toHaveBeenCalledTimes(1);
    const payload = emit.mock.calls[0]![0];
    expect(payload.errorDetails.category).toBe('REACT_RENDER');
    expect(payload.errorDetails.stackTrace).toContain('in Foo');
  });

  it('stops listening after stop() is called', () => {
    tracker.stop();
    window.dispatchEvent(new ErrorEvent('error', { message: 'ignored' }));
    expect(emit).not.toHaveBeenCalled();
  });
});
