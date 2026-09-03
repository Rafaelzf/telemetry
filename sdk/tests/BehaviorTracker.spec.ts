import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorTracker } from '../src/trackers/BehaviorTracker.js';
import type { ResolvedSDKConfig, TelemetryEvent } from '../src/core/types.js';

const config: ResolvedSDKConfig = {
  endpoint: 'https://example.com/api/v1/telemetry',
  appId: 'test-app',
  environment: 'development',
  maxBatchSize: 10,
  flushIntervalMs: 5000,
  sampleRate: 1
};

describe('BehaviorTracker', () => {
  let emit: ReturnType<typeof vi.fn>;
  let tracker: BehaviorTracker;

  beforeEach(() => {
    emit = vi.fn();
    tracker = new BehaviorTracker(config, emit as (event: TelemetryEvent) => void);
  });

  afterEach(() => {
    tracker.stop();
  });

  it('emits an initial PAGE_VIEW on start()', () => {
    tracker.start();
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]![0]).toMatchObject({ type: 'behavior', action: 'PAGE_VIEW' });
  });

  it('emits a PAGE_VIEW whenever history.pushState is called', () => {
    tracker.start();
    emit.mockClear();

    history.pushState({}, '', '/next-page');

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]![0]).toMatchObject({ type: 'behavior', action: 'PAGE_VIEW' });
  });

  it('emits a custom event with the given name and payload', () => {
    tracker.start();
    emit.mockClear();

    tracker.trackCustomEvent('button_click', { id: 'cta' });

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]![0]).toMatchObject({ type: 'custom', name: 'button_click', payload: { id: 'cta' } });
  });
});
