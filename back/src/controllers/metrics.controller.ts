import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../database/connection.js';
import { withCache } from '../lib/cache.js';

const ErrorsQuerySchema = z.object({
  appId: z.string().min(1),
  environment: z.enum(['development', 'staging', 'production']).optional(),
  category: z.string().optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0)
});

const PerformanceQuerySchema = z.object({
  appId: z.string().min(1),
  environment: z.enum(['development', 'staging', 'production']).optional(),
  metricName: z.string().optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0)
});

export async function getErrorMetricsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = ErrorsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
  }
  const { appId, environment, category, from, to, limit, offset } = parsed.data;

  const cacheKey = `telemetry:cache:errors:${JSON.stringify({ appId, environment, category, from, to, limit, offset })}`;
  const rows = await withCache(cacheKey, async () => {
    const query = db('error_events').where({ app_id: appId });
    if (environment) query.andWhere({ environment });
    if (category) query.andWhere({ category });
    if (from) query.andWhere('timestamp', '>=', from);
    if (to) query.andWhere('timestamp', '<=', to);

    return query.orderBy('timestamp', 'desc').limit(limit).offset(offset);
  });

  return reply.status(200).send({ data: rows, limit, offset });
}

export async function getPerformanceMetricsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = PerformanceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Invalid query parameters', issues: parsed.error.issues });
  }
  const { appId, environment, metricName, from, to, limit, offset } = parsed.data;

  const cacheKey = `telemetry:cache:performance:${JSON.stringify({ appId, environment, metricName, from, to, limit, offset })}`;
  const rows = await withCache(cacheKey, async () => {
    const query = db('performance_events').where({ app_id: appId });
    if (environment) query.andWhere({ environment });
    if (metricName) query.andWhere({ metric_name: metricName });
    if (from) query.andWhere('timestamp', '>=', from);
    if (to) query.andWhere('timestamp', '<=', to);

    return query.orderBy('timestamp', 'desc').limit(limit).offset(offset);
  });

  return reply.status(200).send({ data: rows, limit, offset });
}
