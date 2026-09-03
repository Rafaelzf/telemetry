# Web Monitoring SDK

Biblioteca de telemetria leve e não-bloqueante para aplicações web, com suporte nativo a React. Captura erros, Web Vitals, latência de requisições HTTP e navegação/eventos customizados, agregando tudo em lotes e enviando para o [backend de ingestão](../back).

Ver [`sdd.md`](./sdd.md) para o documento de arquitetura completo. Este README cobre instalação e uso prático.

Status: implementado e testado (Vitest + jsdom), mas ainda não validado em um browser real nem publicado em nenhum registry.

## Instalação

O pacote (`web-monitoring-sdk`) ainda não está publicado. A forma de consumir depende de onde fica o projeto frontend.

### Mesmo monorepo (quando `front/` existir)

Configure npm workspaces na raiz do repo:

```json
// package.json na raiz
{
  "private": true,
  "workspaces": ["back", "sdk", "front"]
}
```

E no `front/package.json`:

```json
{
  "dependencies": {
    "web-monitoring-sdk": "*"
  }
}
```

Qualquer mudança no SDK reflete direto, sem reinstalar.

### Outro repositório

Pra testar/iterar sem publicar nada — rode `npm run build` no `sdk/` antes, e aponte pro diretório:

```bash
npm install "file:../caminho/para/telemetry/sdk"
```

Pra uso contínuo em produção, publique o pacote:

```bash
cd sdk
npm run build
npm publish              # registry público do npm
# ou configure um registry privado / GitHub Packages antes de publicar
```

## Uso

### Vanilla JS/TS

```ts
import { init, trackEvent, captureException } from 'web-monitoring-sdk';

init({
  endpoint: 'https://telemetry-back.onrender.com/api/v1/telemetry',
  appId: 'meu-app',
  environment: 'production', // 'development' | 'staging' | 'production'
  release: '1.4.2',          // opcional
  maxBatchSize: 10,          // opcional, padrão 10
  flushIntervalMs: 5000,     // opcional, padrão 5000
  sampleRate: 1              // opcional, padrão 1 (sem amostragem)
});

trackEvent('checkout_completed', { orderId: '123' });
captureException(new Error('algo manual que você quer reportar'));
```

Depois do `init()`, sem nenhuma instrumentação extra, o SDK já captura automaticamente:

- Exceções JS não tratadas e rejeições de Promise não tratadas
- Erros de carregamento de recursos estáticos (`<img>`, `<script>`, `<link>`)
- Web Vitals (LCP, FCP, CLS, aproximação de INP via `first-input`)
- Latência de toda chamada `fetch`, e erros HTTP (status ≥ 400) como eventos de erro
- Page views, incluindo navegação SPA (via patch de `history.pushState`/`replaceState`)

### React

Subpath `/react` — exige `react`/`react-dom` já instalados no projeto host (são peer dependencies, não vêm embutidas no pacote).

```tsx
import { MonitoringErrorBoundary, usePageTracking } from 'web-monitoring-sdk/react';
import { useLocation } from 'react-router-dom';

function App() {
  // Opcional: o core já auto-detecta navegação via History API.
  // Use usePageTracking() só se preferir page views atreladas à location
  // resolvida do seu router — usar os dois juntos duplica os eventos.
  usePageTracking(useLocation().pathname);

  return (
    <MonitoringErrorBoundary fallback={<div>Algo deu errado</div>}>
      <RestOfApp />
    </MonitoringErrorBoundary>
  );
}
```

`MonitoringErrorBoundary` captura exceções de renderização (`componentDidCatch`) e as reporta com `category: 'REACT_RENDER'`, incluindo o `componentStack`.

## Compatibilidade com o backend

O tipo `TelemetryEvent` (`src/core/types.ts`) é o contrato de wire format com `back/src/schemas/telemetry.schema.ts`. Os dois precisam ser mantidos em sincronia manualmente — não há geração automática de tipos entre os dois lados.

## Comandos (rodar a partir de `sdk/`)

```bash
npm run build       # build de produção via tsup (ESM + CJS + .d.ts, dois entry points)
npm run dev          # build em modo watch
npm test             # roda a suíte de testes uma vez (Vitest + jsdom)
npm run test:watch   # modo watch
npm run typecheck    # tsc --noEmit
```
