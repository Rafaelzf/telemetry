import type { ResolvedSDKConfig, SDKConfig } from './types.js';

const DEFAULT_MAX_BATCH_SIZE = 10;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_SAMPLE_RATE = 1;

export function resolveConfig(config: SDKConfig): ResolvedSDKConfig {
  if (!config.endpoint) throw new Error('[telemetry-sdk] "endpoint" is required');
  if (!config.appId) throw new Error('[telemetry-sdk] "appId" is required');
  if (!config.environment) throw new Error('[telemetry-sdk] "environment" is required');

  const sampleRate = config.sampleRate ?? DEFAULT_SAMPLE_RATE;
  if (sampleRate < 0 || sampleRate > 1) {
    throw new Error('[telemetry-sdk] "sampleRate" must be between 0 and 1');
  }

  return {
    ...config,
    maxBatchSize: config.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE,
    flushIntervalMs: config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
    sampleRate
  };
}
