# Documento de Arquitetura e Planejamento de Software (SDD)

**Projeto:** Web Monitoring SDK (Front-end Telemetry)
**Target Runtime:** Browser Environments (React.js Support)
**Language:** TypeScript (Strict Mode)
**Versão:** 1.0.0

## 1. Visão Geral e Objetivos do Sistema

### 1.1 Propósito

O Web Monitoring SDK é uma biblioteca de telemetria leve, assíncrona e não-bloqueante para ser embarcada em aplicações web (com suporte nativo a projetos React.js). O SDK é responsável por capturar eventos de Erros, Métricas de Performance (Web Vitals) e Interações do Usuário, agregando-os em fila (buffer) e transmitindo-os em lotes para um endpoint de ingestão backend.

### 1.2 Requisitos Não-Funcionais Atrelados à Arquitetura

- **Zero-Impact / Non-Blocking:** O SDK deve utilizar a thread principal (main thread) estritamente quando o navegador estiver ocioso (`requestIdleCallback`).
- **Resiliência na Saída de Página:** Envio garantido de telemetria residual no encerramento da sessão usando `navigator.sendBeacon`.
- **Low Memory Footprint & Zero External Dependencies (Core):** O núcleo do SDK deve ser escrito em TypeScript puro sem dependências externas de terceiros.
- **Isolamento de Erros de Execução:** Falhas internas de execução do próprio SDK jamais devem quebrar a aplicação hospedeira (mecanismo de self-contained try-catch).

## 2. Requisitos Funcionais do SDK

| ID    | Módulo           | Descrição do Requisito |
|-------|------------------|--------------------------|
| RF-01 | Core/Config      | Permitir inicialização singleton com `endpoint`, `appId`, `environment`, `release` e `sampleRate`. |
| RF-02 | Error Tracker    | Capturar exceções globais não tratadas via `window.onerror`. |
| RF-03 | Error Tracker    | Capturar rejeições de Promises não tratadas via `window.onunhandledrejection`. |
| RF-04 | Error Tracker    | Registrar erros de carregamento de recursos estáticos (CSS, imagens, scripts) capturando o evento na fase de captura (capture phase). |
| RF-05 | Perf Tracker     | Monitorar métricas Core Web Vitals (LCP, FCP, CLS, FID/INP) via `PerformanceObserver`. |
| RF-06 | Perf Tracker     | Interceptar requisições HTTP estendendo `window.fetch` para medir latência e capturar falhas de API (4xx, 5xx). |
| RF-07 | Behavior Tracker | Registrar navegação entre páginas/rotas (Page Views e Single Page Application transitions). |
| RF-08 | Behavior Tracker | Registrar eventos customizados disparados pela aplicação via API pública (`trackEvent`). |
| RF-09 | Reporter         | Acumular eventos em buffer de memória e despachar em lotes quando o limite de itens ou tempo for atingido. |
| RF-10 | React Binding    | Fornecer componente `<ErrorBoundary/>` e Hook `usePageTracking()` integrados à API do SDK. |

## 3. Arquitetura do Sistema e Design Pattern

A arquitetura adota a combinação dos padrões Singleton, Observer/PubSub e Facade:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APLICAÇÃO REACT (HOST)                            │
│                                                                             │
│   ┌──────────────────────────┐         ┌────────────────────────────────┐   │
│   │ React ErrorBoundary      │         │ Custom Hooks / Custom Events   │   │
│   └────────────┬─────────────┘         └───────────────┬────────────────┘   │
└────────────────┼───────────────────────────────────────┼────────────────────┘
                 │ (React Binding Layer)                 │ (Public API)
                 ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SDK CORE LAYER (FACADE)                           │
│                                                                             │
│                        ┌────────────────────────┐                           │
│                        │     SDKClient (Core)   │                           │
│                        └───────────┬────────────┘                           │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         ▼                          ▼                          ▼             │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐       │
│  │ ErrorTracker │          │ PerfTracker  │          │UserBehavior  │       │
│  └──────┬───────┘          └──────┬───────┘          └──────┬───────┘       │
│         │                          │                          │             │
│         └──────────────────────────┼──────────────────────────┘             │
│                                    ▼                                        │
│                        ┌────────────────────────┐                           │
│                        │     BatchQueueManager  │                           │
│                        └───────────┬────────────┘                           │
│                                    │                                        │
│                                    ▼                                        │
│                        ┌────────────────────────┐                           │
│                        │      TransportEngine   │                           │
│                        └───────────┬────────────┘                           │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │ HTTP (sendBeacon / fetch)
                                     ▼
                        ┌────────────────────────┐
                        │   Ingestion Backend    │
                        └────────────────────────┘
```

## 4. Especificação Estrutural de Dados (Modelos TypeScript)

```typescript
// types.ts

export type EventType = 'error' | 'performance' | 'behavior' | 'custom';

export interface SDKConfig {
  endpoint: string;
  appId: string;
  environment: 'development' | 'staging' | 'production';
  release?: string;
  maxBatchSize?: number;      // Padrão: 10
  flushIntervalMs?: number;   // Padrão: 5000 (5s)
  sampleRate?: number;        // Padrão: 1.0 (0 a 1)
}

export interface BaseTelemetryPayload {
  eventId: string;           // UUIDv4
  appId: string;
  timestamp: number;
  environment: string;
  release: string;
  type: EventType;
  url: string;
  userAgent: string;
}

export interface ErrorEventPayload extends BaseTelemetryPayload {
  type: 'error';
  errorDetails: {
    category: 'JS_RUNTIME' | 'UNHANDLED_PROMISE' | 'RESOURCE' | 'HTTP_API' | 'REACT_RENDER';
    message: string;
    stackTrace?: string;
    source?: string;
    statusCode?: number; // Para HTTP_API
  };
}

export interface PerformanceEventPayload extends BaseTelemetryPayload {
  type: 'performance';
  metrics: {
    metricName: 'LCP' | 'FCP' | 'CLS' | 'INP' | 'HTTP_LATENCY';
    value: number;
    resourceName?: string;
  };
}

export interface BehaviorEventPayload extends BaseTelemetryPayload {
  type: 'behavior' | 'custom';
  action: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

export type TelemetryEvent = ErrorEventPayload | PerformanceEventPayload | BehaviorEventPayload;
```

## 5. Especificação dos Módulos Técnicos

### 5.1 Core Manager (`SDKClient.ts`)

**Padrão:** Singleton.

**Responsabilidade:** Guarda a configuração global, expõe a API pública e coordena a inicialização dos trackers.

**Instruções de Implementação:**

- Método `init(config: SDKConfig)` previne dupla inicialização.
- Valida os campos obrigatórios do `SDKConfig`.

### 5.2 Capturador de Erros (`ErrorTracker.ts`)

**Responsabilidade:** Registra erros e os formata no tipo `ErrorEventPayload`.

**Instruções de Implementação:**

- `window.addEventListener('error', callback, true)`: Deve identificar se o alvo (`event.target`) é um elemento HTML (`HTMLScriptElement`, `HTMLImageElement`) para diferenciar erro de recurso estático de erro JS runtime.
- `window.addEventListener('unhandledrejection', callback)`: Extrai `reason` do objeto da Promise rejeitada.

### 5.3 Capturador de Performance e HTTP (`PerfTracker.ts`)

**Responsabilidade:** Monitora Core Web Vitals e latência de rede.

**Instruções de Implementação:**

- Instancia `PerformanceObserver` isolando entradas tipo `largest-contentful-paint`, `first-input`, `layout-shift`, `paint`.
- Realiza Monkey Patching (interceptação) na API `window.fetch` nativa:
  - Grava `startTime`.
  - Executa a requisição nativa.
  - No callback de resolução (`then`/`catch`), calcula `duration = performance.now() - startTime`.
  - Se `response.status >= 400`, gera também um `ErrorEventPayload` com categoria `HTTP_API`.

### 5.4 Gerenciador de Fila e Envio (`BatchQueueManager.ts` & `TransportEngine.ts`)

**Responsabilidade:** Agrupa eventos em memória antes da transmissão de rede.

**Instruções de Implementação:**

- Mantém vetor privado `queue: TelemetryEvent[]`.
- `push(event)`: Adiciona evento se o `sampleRate` for satisfeito (`Math.random() < sampleRate`). Se `queue.length >= maxBatchSize`, executa `flush()`.
- Controle de tempo via `setInterval` para executar `flush()` a cada `flushIntervalMs`.
- No descarregamento da janela (`window.addEventListener('beforeunload')` ou `visibilitychange` em estado `hidden`), dispara envio síncrono via `navigator.sendBeacon(endpoint, data)`.
- Se `sendBeacon` falhar ou ultrapassar limite do SO (64KB), aplica fallback para `fetch(endpoint, { keepalive: true })`.

### 5.5 React Integration Layer (`react/index.tsx`)

**Responsabilidade:** Interface declarativa específica para o ciclo de vida do React.

**Componente `<MonitoringErrorBoundary>`:**

- Implementa `componentDidCatch(error: Error, errorInfo: React.ErrorInfo)`.
- Envia evento do tipo `REACT_RENDER` incluindo o `componentStack`.

**Hook `usePageTracking()`:**

- Utiliza `useEffect` ouvindo mudanças na localização (Router) para despachar eventos de behavior do tipo `PAGE_VIEW`.

## 6. Plano de Testes e Validação do SDK

O Agente de Código deve gerar testes automatizados (usando Vitest ou Jest e Testing Library) cobrindo:

- **Unit Test - Queue Management:** Verificar se ao empilhar N itens correspondentes ao `maxBatchSize`, o método `flush()` do transportador é invocado automaticamente.
- **Unit Test - Error Interception:** Simular emissão de erro não capturado com `window.dispatchEvent(new ErrorEvent('error', {...}))` e asserir a presença do item formatado na fila.
- **Integration Test - React Error Boundary:** Renderizar componente React que lança exceção proposital dentro do `<MonitoringErrorBoundary>` e verificar o payload gerado.
- **Integration Test - Beacon Transport Fallback:** Forçar falha do `navigator.sendBeacon` e verificar se a chamada substituta via `fetch` com `keepalive: true` é realizada.

## 7. Estrutura de Diretórios Esperada no Repositório

```
/sdk-root
├── src/
│   ├── core/
│   │   ├── SDKClient.ts
│   │   ├── Config.ts
│   │   └── types.ts
│   ├── trackers/
│   │   ├── ErrorTracker.ts
│   │   ├── PerfTracker.ts
│   │   └── BehaviorTracker.ts
│   ├── transport/
│   │   ├── BatchQueueManager.ts
│   │   └── TransportEngine.ts
│   ├── react/
│   │   ├── MonitoringErrorBoundary.tsx
│   │   └── usePageTracking.ts
│   └── index.ts
├── tests/
│   ├── ErrorTracker.spec.ts
│   ├── BatchQueue.spec.ts
│   └── ReactBoundary.spec.tsx
├── package.json
└── tsconfig.json
```
