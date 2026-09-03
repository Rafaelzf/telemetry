import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransportEngine } from '../src/transport/TransportEngine.js';

const endpoint = 'https://example.com/api/v1/telemetry';

describe('TransportEngine', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 202 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses sendBeacon when available and within size limits', () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon });

    new TransportEngine(endpoint).send([{ a: 1 }], { beacon: true });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to fetch with keepalive when sendBeacon reports failure', () => {
    const sendBeacon = vi.fn(() => false);
    vi.stubGlobal('navigator', { sendBeacon });

    new TransportEngine(endpoint).send([{ a: 1 }], { beacon: true });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({ method: 'POST', keepalive: true }));
  });

  it('falls back to fetch when sendBeacon is unavailable', () => {
    vi.stubGlobal('navigator', {});

    new TransportEngine(endpoint).send([{ a: 1 }], { beacon: true });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not send anything for an empty batch', () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon });

    new TransportEngine(endpoint).send([], { beacon: true });

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
