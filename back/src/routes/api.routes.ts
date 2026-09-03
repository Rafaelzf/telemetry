import type { FastifyInstance } from 'fastify';
import { ingestTelemetryHandler } from '../controllers/ingest.controller.js';
import { getErrorMetricsHandler, getPerformanceMetricsHandler } from '../controllers/metrics.controller.js';
import { checkDatabaseConnection } from '../database/connection.js';
import { queueProducer } from '../queues/telemetry.queue.js';

export async function apiRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/telemetry', {
    schema: {
      tags: ['ingest'],
      summary: 'Ingest a batch of telemetry events',
      description:
        'Accepts a JSON array of telemetry events (or a text/plain body for navigator.sendBeacon), queues valid items for ' +
        'async persistence, and returns 202 immediately. Invalid items are dropped individually and counted in `rejected` ' +
        'rather than failing the whole batch.'
    }
  }, ingestTelemetryHandler);

  fastify.get('/metrics/errors', {
    schema: {
      tags: ['metrics'],
      summary: 'Query persisted error events',
      description: 'Requires `appId`. Optional filters: `environment`, `category`, `from`, `to`, `limit`, `offset`.'
    }
  }, getErrorMetricsHandler);

  fastify.get('/metrics/performance', {
    schema: {
      tags: ['metrics'],
      summary: 'Query persisted performance events',
      description: 'Requires `appId`. Optional filters: `environment`, `metricName`, `from`, `to`, `limit`, `offset`.'
    }
  }, getPerformanceMetricsHandler);

  fastify.get('/health', {
    schema: {
      tags: ['health'],
      summary: 'Service health',
      description: 'Reports database connectivity and ingestion queue stats.'
    }
  }, async (_req, reply) => {
    const dbHealthy = await checkDatabaseConnection();
    const status = dbHealthy ? 200 : 503;
    return reply.status(status).send({
      status: dbHealthy ? 'ok' : 'degraded',
      database: dbHealthy ? 'up' : 'down',
      queue: await queueProducer.getStats()
    });
  });
}
