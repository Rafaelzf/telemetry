import type { FastifyInstance } from 'fastify';
import { ingestTelemetryHandler } from '../controllers/ingest.controller.js';
import { getErrorMetricsHandler, getPerformanceMetricsHandler } from '../controllers/metrics.controller.js';
import { checkDatabaseConnection } from '../database/connection.js';
import { queueProducer } from '../queues/telemetry.queue.js';

export async function apiRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/telemetry', ingestTelemetryHandler);

  fastify.get('/metrics/errors', getErrorMetricsHandler);
  fastify.get('/metrics/performance', getPerformanceMetricsHandler);

  fastify.get('/health', async (_req, reply) => {
    const dbHealthy = await checkDatabaseConnection();
    const status = dbHealthy ? 200 : 503;
    return reply.status(status).send({
      status: dbHealthy ? 'ok' : 'degraded',
      database: dbHealthy ? 'up' : 'down',
      queue: queueProducer.getStats()
    });
  });
}
