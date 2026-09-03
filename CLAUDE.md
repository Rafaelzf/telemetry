# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo is two halves of one system:

- **`back/`** — the ingestion backend. Fully implemented and tested.
- **`sdk/`** — the front-end telemetry SDK. Implemented per its spec (`sdk/sdd.md`), module layout `src/core`, `src/trackers`, `src/transport`, `src/react`. Built with `tsup` (dual ESM/CJS + `.d.ts`, two entry points: `.` and `./react`), tested with Vitest + Testing Library, not yet published anywhere.

`sdk/src/core/types.ts`'s `TelemetryEvent` union is the wire contract with `back/src/schemas/telemetry.schema.ts` and intentionally diverges from `sdd.md` §4 where the two conflict — the SDD conflates `behavior`/`custom` into one shape with `action`/`metadata`, but the backend's Zod schema requires them separate (`behavior`: `action`+`payload`; `custom`: `name`+`payload`), so the SDK implements the backend's shape, not the SDD's literal TS interface. Fields the SDD lists but the backend schema doesn't accept (`errorDetails.statusCode`, `metrics.resourceName`, behavior `category`) were dropped rather than sent-and-ignored. Keep both schemas in sync when changing either side.

All day-to-day backend commands below assume `cd back`. SDK commands (`cd sdk`): `npm run build` (tsup), `npm test` / `npm run test:watch` (Vitest + jsdom), `npm run typecheck`.

## Commands (run from `back/`)

```bash
npm run dev              # dev server with hot reload (tsx watch)
npm run build            # compile to dist/
npm start                # run compiled build (dist/app.js)
npm test                 # run full Vitest suite once
npm run test:watch       # Vitest watch mode
npm run typecheck        # tsc --noEmit
npm run migrate          # apply pending Knex migrations
npm run migrate:rollback # roll back the last migration batch
npm run migrate:status   # show migration status
```

Run a single test file: `npx vitest run tests/ingest.spec.ts`. There's no separate lint script.

Local setup: `cp .env.example .env`, point `DATABASE_URL` at Postgres, then `npm run migrate`. `DATABASE_URL`, `REDIS_URL`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` are required (Zod-validated at boot in `src/config/env.ts`); `tests/setup.ts` supplies dummy defaults for these so the test suite doesn't need real credentials.

## Architecture

Producer/consumer pipeline: a Fastify ingestion endpoint pushes onto a Redis list and returns immediately; polling loops drain the list and bulk-insert into Postgres.

```
POST /api/v1/telemetry → rate limit → Zod validation (per-item) → RPUSH onto Redis list (REST)
                                                                          ↓
                                          Polling LPOP loops → Worker → Postgres bulk insert (error_events / performance_events)
```

Key point: **the controller never awaits persistence.** `ingest.controller.ts` validates, calls `queueProducer.addBatch()` (a fast `RPUSH`), and responds `202` — `telemetry.queue.ts`'s poll loops call into `telemetry.worker.ts` to do the actual DB write asynchronously. Don't add `await`s in the ingest path that block on the database.

### Redis: REST only, no TCP — this was a deliberate migration away from BullMQ

All Redis access (ingestion queue, rate limiting, metrics caching) goes through **one** client: the Upstash REST API (`@upstash/redis`, `src/config/redis-rest.ts`). There is no TCP (`rediss://`, port 6379) client and no BullMQ dependency — both were removed after real-world testing showed the TCP port getting silently blocked (TCP `connect` succeeded but the connection never reached `ready`, consistent with corporate DPI firewalls resetting non-HTTPS traffic) even across different networks, while HTTPS/443 stayed reachable. See `SSD.md` §7.1/§7.6 for the full history if you're tempted to reintroduce a TCP-based queue library — don't, without re-validating that port 6379 is actually reachable in the target environment.

Because REST has no blocking pop or pub/sub, `telemetry.queue.ts` implements its own minimal queue: `RPUSH`/`LPOP` on a Redis list (`telemetry:queue:jobs`), with `QUEUE_CONCURRENCY` poll loops each sleeping `QUEUE_POLL_INTERVAL_MS` between empty polls. No automatic retry on failure (matches the prior BullMQ config, which also had no `attempts` set) — a failed batch is just logged and counted.

Every Redis operation in `telemetry.queue.ts` is wrapped in a 3s timeout (`withTimeout`/`REDIS_OP_TIMEOUT_MS`) so an unreachable Redis fails fast instead of hanging the request indefinitely. If you add new queue operations, wrap them the same way.

### Validation: per-item, not per-batch

`RawBatchSchema` in `ingest.controller.ts` only checks batch shape/size. Each event is then validated individually against `TelemetryEventSchema` (`schemas/telemetry.schema.ts`, a Zod discriminated union on `type`); invalid items are dropped and counted in `rejected` rather than failing the whole batch. Preserve this behavior in any changes — one corrupted event must not sink the rest.

### Event types and persistence

`TelemetryEvent` is a discriminated union: `error | performance | behavior | custom`. Only `error` and `performance` events are currently persisted (into `error_events` / `performance_events` via `telemetry.worker.ts`) — `behavior`/`custom` are validated and accepted into the queue but intentionally not written anywhere yet. Both tables FK on `app_id` → `applications`; there's no separate app-registration flow, so the worker upserts (`onConflict('id').ignore()`) rows into `applications` before inserting events (`ensureApplicationsExist` in `telemetry.worker.ts`).

### Metrics endpoints use cache-aside

`GET /metrics/errors` and `GET /metrics/performance` (`metrics.controller.ts`) wrap their Postgres query in `withCache()` (`lib/cache.ts`), keyed by a JSON-serialized version of the query params, TTL from `METRICS_CACHE_TTL_SECONDS`. These routes currently have no auth — that's a known gap, not an oversight to silently "fix".

### Config

All env vars are declared and validated in one place: `src/config/env.ts` (Zod schema, fails fast at boot on missing/invalid values). Add new env vars there, not by reading `process.env` directly elsewhere.
