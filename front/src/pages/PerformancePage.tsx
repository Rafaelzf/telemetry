import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ActivityLog } from '../components/ActivityLog';
import { useActivityLog } from '../hooks/useActivityLog';

export function PerformancePage() {
  const { entries, log } = useActivityLog();
  const [shiftLayout, setShiftLayout] = useState(false);

  return (
    <section>
      <h1>Performance (Web Vitals)</h1>
      <p>
        Web Vitals são medidos passivamente pelo <code>PerformanceObserver</code> — não têm um botão de "disparar"
        como os erros, mas dá pra provocar alguns na prática:
      </p>

      <div className="trigger-grid">
        <div className="trigger-card">
          <h2>CLS (Cumulative Layout Shift)</h2>
          <p>Insere um bloco acima do conteúdo existente sem reservar espaço — desloca o layout de verdade.</p>
          <button
            onClick={() => {
              setShiftLayout(true);
              log('Bloco inserido acima do conteúdo — layout shift real disparado');
            }}
          >
            Provocar mudança de layout
          </button>
          {shiftLayout && (
            <div className="layout-shift-block">
              Este bloco apareceu do nada e empurrou o conteúdo abaixo dele — isso é exatamente o que o CLS mede.
              <button onClick={() => setShiftLayout(false)}>Remover</button>
            </div>
          )}
        </div>

        <div className="trigger-card">
          <h2>LCP / FCP</h2>
          <p>
            São reportados automaticamente durante o carregamento inicial de cada página, antes da primeira
            interação do usuário — não há como "clicar para disparar" sem invalidar a própria métrica. Pra ver o
            evento, abra esta página numa aba nova (Ctrl/Cmd+clique num link do menu) e evite interagir antes que
            o conteúdo termine de carregar.
          </p>
        </div>

        <div className="trigger-card">
          <h2>INP (aproximado via first-input)</h2>
          <p>
            Medido no primeiro clique/toque do usuário em qualquer lugar da página (não só nesta seção) — se ainda
            não interagiu com este app nesta navegação, o clique abaixo é o que vai gerar o evento.
          </p>
          <button onClick={() => log('Interação registrada (se foi a primeira desta navegação, gerou INP)')}>
            Clique aqui
          </button>
        </div>

        <div className="trigger-card">
          <h2>HTTP_LATENCY</h2>
          <p>
            Gerado por toda chamada <code>fetch</code>, ver a página <Link to="/http">HTTP / Fetch</Link>.
          </p>
        </div>
      </div>

      <h2>Atividade</h2>
      <ActivityLog entries={entries} />
    </section>
  );
}
