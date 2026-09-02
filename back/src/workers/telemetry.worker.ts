import type { Knex } from 'knex';
import { db } from '../database/connection.js';
import type { TelemetryBatch, TelemetryEvent } from '../schemas/telemetry.schema.js';

interface ErrorEventRow {
  id: string;
  app_id: string;
  environment: string;
  release: string | null;
  category: string;
  message: string;
  stack_trace: string | null;
  source: string | null;
  url: string;
  user_agent: string;
  timestamp: Date;
}

interface PerformanceEventRow {
  id: string;
  app_id: string;
  environment: string;
  metric_name: string;
  metric_value: number;
  url: string;
  timestamp: Date;
}

function toErrorRow(event: Extract<TelemetryEvent, { type: 'error' }>): ErrorEventRow {
  return {
    id: event.eventId,
    app_id: event.appId,
    environment: event.environment,
    release: event.release ?? null,
    category: event.errorDetails.category,
    message: event.errorDetails.message,
    stack_trace: event.errorDetails.stackTrace ?? null,
    source: event.errorDetails.source ?? null,
    url: event.url,
    user_agent: event.userAgent,
    timestamp: new Date(event.timestamp)
  };
}

function toPerformanceRow(event: Extract<TelemetryEvent, { type: 'performance' }>): PerformanceEventRow {
  return {
    id: event.eventId,
    app_id: event.appId,
    environment: event.environment,
    metric_name: event.metrics.metricName,
    metric_value: event.metrics.value,
    url: event.url,
    timestamp: new Date(event.timestamp)
  };
}

/** Ensures every referenced app_id exists so the FK on error/performance events never fails. */
async function ensureApplicationsExist(trx: Knex.Transaction, appIds: Set<string>): Promise<void> {
  if (appIds.size === 0) return;

  const rows = Array.from(appIds, (id) => ({ id, name: id }));
  await trx('applications').insert(rows).onConflict('id').ignore();
}

export async function processTelemetryQueueBatch(batch: TelemetryBatch): Promise<void> {
  const errorsToInsert: ErrorEventRow[] = [];
  const perfMetricsToInsert: PerformanceEventRow[] = [];
  const appIds = new Set<string>();

  for (const event of batch) {
    appIds.add(event.appId);

    if (event.type === 'error') {
      errorsToInsert.push(toErrorRow(event));
    } else if (event.type === 'performance') {
      perfMetricsToInsert.push(toPerformanceRow(event));
    }
    // 'behavior' and 'custom' events are validated and accepted, but this SDD
    // revision only persists 'error' and 'performance' events per the DDL in Section 4.
  }

  await db.transaction(async (trx) => {
    await ensureApplicationsExist(trx, appIds);

    await Promise.all([
      errorsToInsert.length ? trx('error_events').insert(errorsToInsert) : Promise.resolve(),
      perfMetricsToInsert.length ? trx('performance_events').insert(perfMetricsToInsert) : Promise.resolve()
    ]);
  });
}
