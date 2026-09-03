import { Link } from 'react-router-dom';
import { API_BASE, APP_ID } from '../telemetry';

export function HomePage() {
  return (
    <section>
      <h1>Telemetry SDK — Demo</h1>
      <p>
        Este app existe só para exercitar, na prática, todos os pontos de captura do <code>web-monitoring-sdk</code>{' '}
        (pasta <code>sdk/</code>). Navegue pelas páginas abaixo e clique nos botões — cada um dispara um tipo
        diferente de evento de telemetria.
      </p>

      <ul className="feature-list">
        <li>
          <Link to="/errors">Erros</Link> — exceção JS não tratada, promise rejeitada, recurso quebrado, erro de
          renderização React (Error Boundary).
        </li>
        <li>
          <Link to="/http">HTTP / Fetch</Link> — latência de requisição, erro HTTP 4xx/5xx, falha de rede.
        </li>
        <li>
          <Link to="/performance">Performance</Link> — Web Vitals (LCP, FCP, CLS, aproximação de INP).
        </li>
        <li>
          <Link to="/behavior">Comportamento</Link> — page views (automático via navegação), eventos customizados,
          hook <code>usePageTracking()</code>.
        </li>
      </ul>

      <p className="note">
        Cada navegação entre essas páginas já dispara um evento de <strong>page view</strong> automaticamente
        (o core do SDK intercepta a History API) — não precisa clicar em nada pra isso.
      </p>

      <p className="note">
        appId usado nesta demo: <code>{APP_ID}</code>. Pra conferir os eventos persistidos, consulte{' '}
        <code>
          {API_BASE}/api/v1/metrics/errors?appId={APP_ID}
        </code>{' '}
        ou <code>.../metrics/performance?appId={APP_ID}</code> no backend (lembrando: os eventos são processados
        de forma assíncrona, pode levar alguns segundos até aparecer).
      </p>
    </section>
  );
}
