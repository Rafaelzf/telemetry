import { z } from 'zod';

const BaseEventFields = {
  eventId: z.uuid(),
  appId: z.string().min(1).max(64),
  timestamp: z.number().finite().positive(),
  environment: z.enum(['development', 'staging', 'production']),
  release: z.string().max(64).optional(),
  url: z.url(),
  userAgent: z.string().max(1024)
};

export const ErrorCategorySchema = z.enum([
  'JS_RUNTIME',
  'UNHANDLED_PROMISE',
  'RESOURCE',
  'HTTP_API',
  'REACT_RENDER',
  'UNKNOWN'
]);

export const ErrorEventSchema = z.object({
  ...BaseEventFields,
  type: z.literal('error'),
  errorDetails: z.object({
    category: ErrorCategorySchema.default('UNKNOWN'),
    message: z.string().min(1).max(2000),
    stackTrace: z.string().max(8000).optional(),
    source: z.string().max(2000).optional()
  })
});

export const PerformanceMetricNameSchema = z.union([
  z.enum(['LCP', 'FCP', 'CLS', 'INP', 'TTFB', 'HTTP_LATENCY']),
  z.string().min(1).max(32)
]);

export const PerformanceEventSchema = z.object({
  ...BaseEventFields,
  type: z.literal('performance'),
  metrics: z.object({
    metricName: PerformanceMetricNameSchema,
    value: z.number().finite()
  })
});

export const BehaviorEventSchema = z.object({
  ...BaseEventFields,
  type: z.literal('behavior'),
  action: z.string().min(1).max(128),
  payload: z.record(z.string(), z.unknown()).optional()
});

export const CustomEventSchema = z.object({
  ...BaseEventFields,
  type: z.literal('custom'),
  name: z.string().min(1).max(128),
  payload: z.record(z.string(), z.unknown()).optional()
});

export const TelemetryEventSchema = z.discriminatedUnion('type', [
  ErrorEventSchema,
  PerformanceEventSchema,
  BehaviorEventSchema,
  CustomEventSchema
]);

export const TelemetryBatchSchema = z.array(TelemetryEventSchema).min(1);

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type PerformanceEvent = z.infer<typeof PerformanceEventSchema>;
export type BehaviorEvent = z.infer<typeof BehaviorEventSchema>;
export type CustomEvent = z.infer<typeof CustomEventSchema>;
export type TelemetryBatch = TelemetryEvent[];
