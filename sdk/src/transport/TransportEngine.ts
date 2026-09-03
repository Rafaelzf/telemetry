// Stay under the ~64KB per-origin limit navigator.sendBeacon enforces.
const SEND_BEACON_SAFE_LIMIT_BYTES = 60_000;

export class TransportEngine {
  constructor(private readonly endpoint: string) {}

  send(events: unknown[], opts: { beacon?: boolean } = {}): void {
    if (events.length === 0) return;
    const body = JSON.stringify(events);

    if (opts.beacon && this.trySendBeacon(body)) return;

    void this.sendViaFetch(body);
  }

  private trySendBeacon(body: string): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false;
    if (byteLength(body) > SEND_BEACON_SAFE_LIMIT_BYTES) return false;

    try {
      // Sent as a plain string (not a Blob) so the browser defaults the
      // content-type to text/plain, matching the backend's sendBeacon parser.
      return navigator.sendBeacon(this.endpoint, body);
    } catch {
      return false;
    }
  }

  private async sendViaFetch(body: string): Promise<void> {
    if (typeof fetch !== 'function') return;
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      });
    } catch {
      // Best-effort delivery; dropped batches are not retried to avoid unbounded growth.
    }
  }
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
  return value.length;
}
