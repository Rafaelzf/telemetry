# Documento de Arquitetura e Planejamento Backend (SDD)

**Projeto:** Web Monitoring Telemetry Backend (Ingestion Engine & API)
**Target Runtime:** Node.js (LTS)
**Framework Recomendado:** Fastify (por conta do throughput e baixo overhead) ou Express.js
**Language:** TypeScript (Strict Mode)
**Versão:** 1.0.0

## 1. Visão Geral e Objetivos do Backend

### 1.1 Propósito

O Backend de Monitoramento é o serviço responsável por:

- **Receber e Ingerir** os payloads de telemetria enviados em lote pelo SDK Front-end em alta concorrência.
- **Validar e Sanitizar** a estrutura de dados recebida.
- **Processar Assincronamente** as métricas para não bloquear a resposta HTTP de ingestão (Fire-and-Forget / Queue-based processing).
- **Armazenar** logs, erros e métricas de performance em um banco de dados otimizado para séries temporais ou escrita massiva.
- **Servir dados** para uma API de visualização (Dashboard/Métricas).

### 1.2 Requisitos Não-Funcionais

- **Baixa Latência na Ingestão:** O endpoint de ingestão (`POST /api/v1/telemetry`) deve responder em `< 50ms`, pois é chamado em segundo plano por navegadores dos clientes.
- **Resiliência a Pico de Tráfego:** Deve suportar rajadas (bursts) de requisições sem derrubar o banco de dados principal.
- **CORS e Compatibilidade com `sendBeacon`:** Suporte total a requisições enviadas pelo navegador via `navigator.sendBeacon` (que costumam vir codificadas como `text/plain` ou `application/json`).
- **Sanitização contra DoS:** Limite estrito do tamanho do payload recebido (ex: máximo 1MB por lote).

## 2. Requisitos Funcionais do Backend

| ID    | Módulo         | Descrição do Requisito |
|-------|----------------|--------------------------|
| RF-01 | Ingestão       | Expor endpoint HTTP `POST /api/v1/telemetry` para receber o array de eventos. |
| RF-02 | Ingestão       | Aceitar payloads enviados via `application/json` e `text/plain` (formato padrão do `sendBeacon`). |
| RF-03 | Validação      | Validar a integridade do payload usando schemas estritos (ex: Zod). Se inválido, rejeitar ou descartar itens corrompidos. |
| RF-04 | Processamento  | Empurrar os lotes validados para uma fila assíncrona (ex: Redis/BullMQ ou fila em memória para instâncias únicas). |
| RF-05 | Worker         | Consumir a fila de processamento e gravar os dados persistidos no banco de dados. |
| RF-06 | Análise/API    | Expor rotas de consulta (`GET /api/v1/metrics/errors`, `GET /api/v1/metrics/performance`) para alimentar um Dashboard, com cache curto (cache-aside) para reduzir carga no banco. |
| RF-07 | Ingestão       | Aplicar rate limit por IP (sliding window) no endpoint de ingestão, para proteção adicional contra abuso/DoS além dos limites de payload/batch. |

### 2.1 Checklist de Implementação

- [x] **RF-01** — `POST /api/v1/telemetry` exposto (`src/routes/api.routes.ts`, `src/controllers/ingest.controller.ts`)
- [x] **RF-02** — `application/json` e `text/plain` (`sendBeacon`) aceitos (`src/app.ts` registra parser de `text/plain`; controller faz `JSON.parse` quando o body vem como string)
- [x] **RF-03** — Validação com Zod, descartando itens corrompidos individualmente e retornando `rejected` na resposta (`RawBatchSchema` + `TelemetryEventSchema.safeParse` por item)
- [x] **RF-04** — Lotes validados vão para fila assíncrona real (fila baseada em lista Redis, via API REST da Upstash, não mais em memória) (`src/queues/telemetry.queue.ts`)
- [x] **RF-05** — Worker consome a fila e grava no banco (`src/workers/telemetry.worker.ts`, chamado pelos loops de polling em `telemetry.queue.ts`)
- [x] **RF-06** — Rotas `GET /metrics/errors` e `GET /metrics/performance` expostas, com cache-aside (TTL configurável) (`src/controllers/metrics.controller.ts`, `src/lib/cache.ts`)
- [x] **RF-07** — Rate limit por IP (sliding window) no `/telemetry`, com headers `X-RateLimit-*` e `429` ao exceder (`src/lib/rate-limit.ts`)

Todos os requisitos funcionais listados já estão implementados e cobertos por testes automatizados (`npm test`); build e typecheck passam sem erros. Não há RF pendente no momento — próximos itens em aberto (ex: autenticação/autorização das rotas de métricas, dashboard consumidor da API) ainda não estavam listados como RF neste documento.

## 3. Arquitetura do Sistema e Pipeline de Ingestão

Adota-se uma arquitetura Desacoplada baseada em Eventos/Filas (Producer-Consumer) para evitar gargalos de I/O no banco de dados:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          NAVEGADOR DO USUÁRIO                          │
│                                                                        │
│                      [ SDK Front-end (React) ]                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP POST (sendBeacon / fetch)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        NODE.JS BACKEND (INGESTION)                     │
│                                                                        │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │ Fastify Server (Fast HTTP Ingestion Layer)                  │      │
│   │ - CORS & Payload Parsing (application/json + text/plain)    │      │
│   │ - Fast Schema Validation (Zod)                              │      │
│   └──────────────────────────────┬──────────────────────────────┘      │
│                                  │ (Responde HTTP 202 Accepted em <20ms)
│                                  ▼                                     │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │ Redis List Queue (RPUSH via Upstash REST API)                │      │
│   └──────────────────────────────┬──────────────────────────────┘      │
└──────────────────────────────────┼─────────────────────────────────────┘
                                   │ (Async Processing)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        NODE.JS WORKER SERVICE                          │
│                                                                        │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │ Polling Consumer (LPOP via REST) / Ingestor Worker           │      │
│   │ - Agrupa dados e formata stack traces                       │      │
│   │ - Grava em lote (Bulk Insert) no Banco de Dados             │      │
│   └──────────────────────────────┬──────────────────────────────┘      │
└──────────────────────────────────┼─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       PERSISTÊNCIA (STORAGE)                           │
│                                                                        │
│   - PostgreSQL / ClickHouse / MongoDB (Bulk Insertion)                │
└────────────────────────────────────────────────────────────────────────┘
```

## 4. Esquema de Banco de Dados (PostgreSQL Exemplo)

Abaixo o DDL de referência para tabelas relacionais eficientes para consultas de monitoramento:

```sql
-- Tabela de Aplicações/Projetos cadastrados
CREATE TABLE applications (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Erros Capturados
CREATE TABLE error_events (
    id UUID PRIMARY KEY,
    app_id VARCHAR(64) REFERENCES applications(id),
    environment VARCHAR(32) NOT NULL,
    release VARCHAR(64),
    category VARCHAR(32) NOT NULL, -- JS_RUNTIME, UNHANDLED_PROMISE, RESOURCE, HTTP_API, REACT_RENDER
    message TEXT NOT NULL,
    stack_trace TEXT,
    source TEXT,
    url TEXT NOT NULL,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_errors_app_env ON error_events (app_id, environment, timestamp DESC);

-- Tabela de Métricas de Performance (Web Vitals / HTTP)
CREATE TABLE performance_events (
    id UUID PRIMARY KEY,
    app_id VARCHAR(64) REFERENCES applications(id),
    environment VARCHAR(32) NOT NULL,
    metric_name VARCHAR(32) NOT NULL, -- LCP, FCP, CLS, INP, HTTP_LATENCY
    metric_value NUMERIC(10, 4) NOT NULL,
    url TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_perf_app_metric ON performance_events (app_id, metric_name, timestamp DESC);
```

## 5. Especificação dos Módulos Técnicos (Node.js)

### 5.1 Validação de Entrada (`src/schemas/telemetry.schema.ts`)

Uso do Zod para garantir que apenas dados válidos avancem no pipeline:

```typescript
import { z } from 'zod';

export const BaseEventSchema = z.object({
  eventId: z.string().uuid(),
  appId: z.string().min(1),
  timestamp: z.number(),
  environment: z.enum(['development', 'staging', 'production']),
  release: z.string().optional(),
  type: z.enum(['error', 'performance', 'behavior', 'custom']),
  url: z.string().url(),
  userAgent: z.string()
});

export const TelemetryBatchSchema = z.array(BaseEventSchema.passthrough());

export type TelemetryBatch = z.infer<typeof TelemetryBatchSchema>;
```

### 5.2 Controller de Ingestão (`src/controllers/ingest.controller.ts`)

O endpoint deve processar a requisição rapidamente, lidar com o tipo do payload e responder `HTTP 202 Accepted` sem esperar pelo salvamento no banco de dados.

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { TelemetryBatchSchema } from '../schemas/telemetry.schema';
import { queueProducer } from '../queues/telemetry.queue';

export async function ingestTelemetryHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    let rawBody = req.body;

    // Suporte para navigator.sendBeacon enviando como text/plain
    if (typeof rawBody === 'string') {
      rawBody = JSON.parse(rawBody);
    }

    // Validação ultra-rápida do lote
    const validatedBatch = TelemetryBatchSchema.parse(rawBody);

    // Envia assincronamente para a fila (In-Memory ou Redis)
    await queueProducer.addBatch(validatedBatch);

    // Retorna aceito imediatamente para o navegador do usuário
    return reply.status(202).send({ status: 'queued', count: validatedBatch.length });
  } catch (error) {
    // Retorna erro sem vazar detalhes críticos
    return reply.status(400).send({ error: 'Invalid telemetry payload structure' });
  }
}
```

### 5.3 Processador de Fila / Worker (`src/workers/telemetry.worker.ts`)

O Worker retira os dados da fila e grava em lotes (bulk insert) no banco para minimizar overhead de rede e transações I/O.

```typescript
import { TelemetryBatch } from '../schemas/telemetry.schema';
import { db } from '../database';

export async function processTelemetryQueueBatch(batch: TelemetryBatch) {
  const errorsToInsert = [];
  const perfMetricsToInsert = [];

  for (const event of batch) {
    if (event.type === 'error') {
      errorsToInsert.push({
        id: event.eventId,
        app_id: event.appId,
        environment: event.environment,
        release: event.release,
        category: (event as any).errorDetails?.category || 'UNKNOWN',
        message: (event as any).errorDetails?.message || 'No message',
        stack_trace: (event as any).errorDetails?.stackTrace,
        url: event.url,
        user_agent: event.userAgent,
        timestamp: new Date(event.timestamp)
      });
    } else if (event.type === 'performance') {
      perfMetricsToInsert.push({
        id: event.eventId,
        app_id: event.appId,
        environment: event.environment,
        metric_name: (event as any).metrics?.metricName,
        metric_value: (event as any).metrics?.value,
        url: event.url,
        timestamp: new Date(event.timestamp)
      });
    }
  }

  // Executa Bulk Insert assíncrono e paralelizado
  await Promise.all([
    errorsToInsert.length ? db('error_events').insert(errorsToInsert) : Promise.resolve(),
    perfMetricsToInsert.length ? db('performance_events').insert(perfMetricsToInsert) : Promise.resolve()
  ]);
}
```

## 6. Estrutura de Diretórios Esperada no Repositório Backend

```
/backend-root
├── src/
│   ├── config/             # Variáveis de ambiente e constantes
│   │   ├── env.ts
│   │   └── redis-rest.ts   # Cliente Redis REST (@upstash/redis), usado pela fila, cache e rate-limit
│   ├── controllers/        # Handlers das rotas HTTP
│   │   ├── ingest.controller.ts
│   │   └── metrics.controller.ts
│   ├── database/           # Configuração de conexão DB (Knex, Prisma ou TypeORM)
│   │   ├── connection.ts
│   │   └── migrations/
│   ├── lib/                # Utilitários compartilhados
│   │   ├── rate-limit.ts   # @upstash/ratelimit (sliding window, por IP)
│   │   └── cache.ts        # Helper cache-aside (get/set com TTL) via Redis REST
│   ├── queues/             # Fila Redis (lista, via API REST) - producer/consumer polling
│   │   └── telemetry.queue.ts
│   ├── schemas/            # Validações estritas com Zod
│   │   └── telemetry.schema.ts
│   ├── workers/            # Lógica de processamento em lote (chamada pelos loops de polling da fila)
│   │   └── telemetry.worker.ts
│   ├── routes/             # Definição de rotas da API Fastify/Express
│   │   └── api.routes.ts
│   └── app.ts              # Ponto de entrada do servidor Node.js
├── tests/                  # Testes automatizados de integração e ingestão
│   └── ingest.spec.ts
├── package.json
└── tsconfig.json
```

## 7. Notas de Implementação — Redis / Upstash

Esta seção documenta decisões tomadas durante a implementação real, que estendem ou ajustam o plano original das seções 1-6.

### 7.1 Uma única conexão Redis, só REST — sem TCP

**Histórico:** a primeira versão da fila usava BullMQ sobre uma conexão TCP persistente (`rediss://`, via `ioredis`), separada da conexão REST usada por cache/rate-limit. Isso foi abandonado (ver §7.6) porque a porta TCP 6379 se mostrou bloqueada de forma consistente em testes reais, mesmo após trocar de rede — o handshake TCP inicial (`connect`) tinha sucesso, mas a negociação subsequente (TLS/protocolo Redis) travava indefinidamente sem nunca emitir `ready`, `error` ou `close`. Esse comportamento bate com bloqueio por DPI (deep packet inspection) em firewall corporativo: a porta 443 (HTTPS, usada pela REST) permanece liberada nesse mesmo ambiente.

Hoje **todo** acesso ao Redis (fila de ingestão, cache e rate limiting) passa exclusivamente pela **API REST da Upstash** (HTTPS/443, via `@upstash/redis`, `src/config/redis-rest.ts`). Não há mais cliente TCP/`ioredis` no projeto. A troca elimina a dependência de uma porta que pode estar bloqueada em redes de desenvolvimento ou de produção, ao custo de a fila não ter mais pop bloqueante nem pub/sub nativos — os consumidores fazem *polling* na lista (ver §7.6).

### 7.2 Rate limiting no endpoint de ingestão (RF-07)

`POST /api/v1/telemetry` agora aplica um rate limit por IP usando `@upstash/ratelimit` (sliding window), antes de qualquer validação de payload. Retorna `429` com headers `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset` quando o limite é excedido. Configurável via `INGEST_RATE_LIMIT_MAX` e `INGEST_RATE_LIMIT_WINDOW_SECONDS`.

### 7.3 Cache nos endpoints de métricas (extensão do RF-06)

`GET /api/v1/metrics/errors` e `GET /api/v1/metrics/performance` usam um helper cache-aside (`withCache`, `src/lib/cache.ts`): a chave é derivada dos parâmetros da query, o TTL é configurável via `METRICS_CACHE_TTL_SECONDS` (padrão 30s), e o resultado da consulta ao Postgres só é recalculado quando o cache expira.

### 7.4 Resiliência a falhas do Redis (fila)

Descoberta durante testes com o cliente TCP original: sem proteção, uma chamada Redis que nunca recebe resposta (conexão inatingível) deixava a requisição HTTP presa indefinidamente. O mesmo cuidado se aplica ao cliente REST atual, já que uma chamada HTTPS também pode travar sob instabilidade de rede ou da Upstash.

Mitigação aplicada em `telemetry.queue.ts`: toda operação da fila (`addBatch`, `getStats`, e cada iteração de polling) tem um timeout de 3s (`REDIS_OP_TIMEOUT_MS`); ao estourar, a operação responde rápido em vez de travar — `addBatch` retorna `{ queued: false }` (HTTP 503), `getStats` retorna `redisReachable: false` no `/health`, e um poll sem resposta simplesmente tenta de novo no próximo ciclo.

### 7.5 Variáveis de ambiente adicionadas

| Variável | Descrição | Default |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Endpoint REST da Upstash — usado pela fila, cache e rate limit | — (obrigatória) |
| `UPSTASH_REDIS_REST_TOKEN` | Token da REST API da Upstash | — (obrigatória) |
| `QUEUE_POLL_INTERVAL_MS` | Intervalo entre polls quando a lista da fila está vazia | 250 |
| `INGEST_RATE_LIMIT_MAX` | Máximo de requisições por janela no rate limit de ingestão | 100 |
| `INGEST_RATE_LIMIT_WINDOW_SECONDS` | Duração da janela do rate limit (segundos) | 60 |
| `METRICS_CACHE_TTL_SECONDS` | TTL do cache dos endpoints de métricas (segundos) | 30 |

### 7.6 Migração da fila: de BullMQ/TCP para lista Redis via REST (polling)

A fila de ingestão (RF-04/RF-05) foi reescrita para não depender mais de TCP. Em vez do BullMQ (que exige uma conexão persistente e stateful ao Redis), `telemetry.queue.ts` agora implementa uma fila simples sobre uma lista Redis, acessada só pela API REST:

- **Produtor (`addBatch`)** — `LLEN` para checar o tamanho atual contra `QUEUE_MAX_SIZE` (não atômico com o push seguinte, mesma limitação aproximada que já existia na versão BullMQ), depois `RPUSH` do lote serializado.
- **Consumidor** — como a REST não suporta pop bloqueante nem pub/sub, `QUEUE_CONCURRENCY` loops de polling rodam em paralelo, cada um fazendo `LPOP` e, se a lista estiver vazia, aguardando `QUEUE_POLL_INTERVAL_MS` antes de tentar de novo.
- **Falhas** — sem retry automático (mesmo comportamento da versão BullMQ, que também não tinha `attempts` configurado): um lote que falha ao processar é apenas logado e contado em `failed`, sem ser reenfileirado.
- **Encerramento gracioso (`waitForDrain`)** — para os loops de polling e aguarda o contador local `inFlight` zerar, até um timeout.

Motivo da mudança: ver §7.1 — TCP/6379 se mostrou bloqueado numa rede de desenvolvimento real, o que tornaria a fila inutilizável nesse ambiente. O `bullmq` e o `ioredis` foram removidos das dependências do projeto.
