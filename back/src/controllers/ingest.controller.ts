import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env.js';
import { ingestRateLimit } from '../lib/rate-limit.js';
import { queueProducer } from '../queues/telemetry.queue.js';
import { TelemetryEventSchema } from '../schemas/telemetry.schema.js';

const RawBatchSchema = z.array(z.unknown()).min(1, 'batch must contain at least one event').max(
  env.BATCH_MAX_EVENTS,
  `batch exceeds the maximum of ${env.BATCH_MAX_EVENTS} events`
);

export async function ingestTelemetryHandler(req: FastifyRequest, reply: FastifyReply) {
  const { success, limit, remaining, reset } = await ingestRateLimit.limit(req.ip);
  reply.header('X-RateLimit-Limit', limit).header('X-RateLimit-Remaining', remaining).header('X-RateLimit-Reset', reset);
  if (!success) {
    return reply.status(429).send({ error: 'Too many requests, slow down' });
  }

  let rawBody: unknown = req.body;

  // navigator.sendBeacon frequently delivers the payload as text/plain.
  if (typeof rawBody === 'string') {
    try {
      rawBody = JSON.parse(rawBody);
    } catch {
      return reply.status(400).send({ error: 'Payload is not valid JSON' });
    }
  }

  const rawBatch = RawBatchSchema.safeParse(rawBody);
  if (!rawBatch.success) {
    return reply.status(400).send({ error: 'Invalid telemetry payload structure' });
  }

  const accepted: z.infer<typeof TelemetryEventSchema>[] = [];
  let rejected = 0;

  for (const item of rawBatch.data) {
    const result = TelemetryEventSchema.safeParse(item);
    if (result.success) {
      accepted.push(result.data);
    } else {
      rejected += 1;
      req.log.debug({ issues: result.error.issues }, 'discarded corrupted telemetry event');
    }
  }

  if (accepted.length === 0) {
    return reply.status(400).send({ error: 'No valid events in payload', rejected });
  }

  const { queued } = await queueProducer.addBatch(accepted);
  if (!queued) {
    return reply.status(503).send({ error: 'Ingestion queue is at capacity, try again shortly' });
  }

  return reply.status(202).send({ status: 'queued', accepted: accepted.length, rejected });
}
