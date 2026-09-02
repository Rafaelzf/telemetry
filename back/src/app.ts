import cors from '@fastify/cors';
import Fastify from 'fastify';
import { pathToFileURL } from 'node:url';
import { corsOrigins, env } from './config/env.js';
import { closeDatabaseConnection } from './database/connection.js';
import { queueProducer } from './queues/telemetry.queue.js';
import { apiRoutes } from './routes/api.routes.js';

export function buildServer() {
  const isProduction = env.NODE_ENV === 'production';

  const fastify = Fastify({
    logger: isProduction
      ? { level: 'info' }
      : { level: 'debug', transport: { target: 'pino-pretty' } },
    bodyLimit: env.MAX_PAYLOAD_BYTES,
    trustProxy: true
  });

  fastify.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS']
  });

  // navigator.sendBeacon commonly posts its payload as text/plain; parse it as raw
  // text here so the ingest controller can JSON.parse it just like a normal body.
  fastify.addContentTypeParser(
    'text/plain',
    { parseAs: 'string', bodyLimit: env.MAX_PAYLOAD_BYTES },
    (_req, body, done) => {
      done(null, body);
    }
  );

  fastify.register(apiRoutes, { prefix: '/api/v1' });

  return fastify;
}

async function main() {
  const fastify = buildServer();

  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    await fastify.close();
    await queueProducer.waitForDrain(10_000);
    await closeDatabaseConnection();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await fastify.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  void main();
}
