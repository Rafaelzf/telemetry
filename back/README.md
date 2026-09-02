# Telemetry Backend — Ingestion Engine & API

Node.js/TypeScript backend for the Web Monitoring Telemetry SDD (v1.0.0): a low-latency
ingestion endpoint for the front-end SDK, an async in-memory queue/worker pipeline, and a
query API for the dashboard.

## Stack

- **Fastify 5** — HTTP layer, `text/plain` content-type parser for `navigator.sendBeacon`
- **Zod 4** — strict batch/event validation (discriminated union per event type)
- **Knex + PostgreSQL** — bulk inserts, migrations
- **In-memory queue** — single-instance producer/consumer (see `src/queues/telemetry.queue.ts`
  for how to swap in BullMQ/Redis for multi-instance deployments)
- **Vitest** — unit/integration tests

## Getting started

```bash
npm install
cp .env.example .env   # then point DATABASE_URL at your Postgres instance
npm run migrate        # creates applications / error_events / performance_events
npm run dev
```

## Scripts

| Script                  | Purpose                                      |
|--------------------------|-----------------------------------------------|
| `npm run dev`            | Start with hot reload (tsx watch)             |
| `npm run build` / `start`| Compile to `dist/` and run the compiled build |
| `npm test`                | Run the Vitest suite                          |
| `npm run typecheck`      | `tsc --noEmit`                                |
| `npm run migrate`        | Apply pending migrations                      |
| `npm run migrate:rollback` | Roll back the last migration batch          |

## API

- `POST /api/v1/telemetry` — accepts a JSON array of events (`application/json` or
  `text/plain`), validates each item independently (corrupted items are discarded, valid
  ones are still queued), and responds `202 Accepted` before persistence happens.
- `GET /api/v1/metrics/errors?appId=...` — paginated, filterable error events.
- `GET /api/v1/metrics/performance?appId=...` — paginated, filterable performance events.
- `GET /api/v1/health` — database connectivity + queue stats.

## Notes on the pipeline

- The ingestion controller never awaits persistence — `queueProducer.addBatch()` only
  enqueues (fast, synchronous push) and returns; the worker drains asynchronously.
- The worker upserts referenced `applications` rows before inserting events, since
  `error_events`/`performance_events` have an FK on `app_id` and the SDD doesn't define a
  separate app-registration flow.
- The queue caps its pending size (`QUEUE_MAX_SIZE`) and responds `503` when full, rather
  than growing memory unboundedly under sustained burst traffic.
