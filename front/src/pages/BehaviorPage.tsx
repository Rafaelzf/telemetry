import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from 'web-monitoring-sdk';
import { usePageTracking } from 'web-monitoring-sdk/react';
import { ActivityLog } from '../components/ActivityLog';
import { useActivityLog } from '../hooks/useActivityLog';

/** Isolated so usePageTracking() only reacts to the fake `location` below, not real app navigation. */
function VirtualPageTracker({ location }: { location: string }) {
  usePageTracking(location);
  return null;
}

export function BehaviorPage() {
  const { entries, log } = useActivityLog();
  const location = useLocation();
  const [virtualLocation, setVirtualLocation] = useState<string | null>(null);
  const [virtualCount, setVirtualCount] = useState(0);

  return (
    <section>
      <h1>Comportamento</h1>

      <div className="trigger-grid">
        <div className="trigger-card">
          <h2>Page views (automático)</h2>
          <p>
            Toda navegação entre as páginas deste app já disparou um evento <code>PAGE_VIEW</code> — o core do SDK
            intercepta <code>history.pushState</code>/<code>replaceState</code> automaticamente, sem código extra.
            Rota atual: <code>{location.pathname}</code>.
          </p>
        </div>

        <div className="trigger-card">
          <h2>Evento customizado</h2>
          <p>
            Chama <code>trackEvent(name, payload)</code> — vira um evento do tipo <code>custom</code>.
          </p>
          <button
            onClick={() => {
              trackEvent('demo_button_click', { source: 'BehaviorPage', clickedAt: Date.now() });
              log('trackEvent("demo_button_click") disparado');
            }}
          >
            Disparar evento customizado
          </button>
        </div>

        <div className="trigger-card">
          <h2>
            Hook <code>usePageTracking()</code>
          </h2>
          <p>
            Demonstração isolada do hook React, com uma "location" fictícia (não a navegação real do app, pra não
            duplicar o page view automático acima).
          </p>
          <button
            onClick={() => {
              const next = `/demo/virtual-page-${virtualCount + 1}`;
              setVirtualCount((c) => c + 1);
              setVirtualLocation(next);
              log(`usePageTracking() rastreou "${next}"`);
            }}
          >
            Rastrear page view virtual via usePageTracking()
          </button>
          {virtualLocation && <VirtualPageTracker location={virtualLocation} />}
        </div>
      </div>

      <h2>Atividade</h2>
      <ActivityLog entries={entries} />
    </section>
  );
}
