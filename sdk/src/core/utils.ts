import type { BaseTelemetryPayload, ResolvedSDKConfig } from './types.js';

export function generateEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older browsers).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createBaseFields(config: ResolvedSDKConfig): BaseTelemetryPayload {
  return {
    eventId: generateEventId(),
    appId: config.appId,
    timestamp: Date.now(),
    environment: config.environment,
    release: config.release,
    url: typeof location !== 'undefined' ? location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
  };
}

/**
 * Runs `fn` and swallows any error, logging it instead — internal SDK
 * failures must never break the host application (NFR: error isolation).
 */
export function safeTry(fn: () => void, context: string): void {
  try {
    fn();
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.error(`[telemetry-sdk] internal error in ${context}`, error);
    }
  }
}
