import { useState } from 'react';
import { ActivityLog } from '../components/ActivityLog';
import { useActivityLog } from '../hooks/useActivityLog';
import { API_BASE } from '../telemetry';

export function HttpPage() {
  const { entries, log } = useActivityLog();
  const [pending, setPending] = useState<string | null>(null);

  async function runFetch(label: string, url: string) {
    setPending(label);
    log(`${label}: requisição iniciada`);
    try {
      const res = await fetch(url);
      log(`${label}: respondeu ${res.status} ${res.statusText}`);
    } catch (error) {
      log(`${label}: falhou (${error instanceof Error ? error.message : String(error)})`);
    } finally {
      setPending(null);
    }
  }

  return (
    <section>
      <h1>HTTP / Fetch</h1>
      <p>
        O <code>PerfTracker</code> intercepta <code>window.fetch</code> globalmente: toda chamada abaixo gera um
        evento de performance <code>HTTP_LATENCY</code>, e respostas com status ≥ 400 também geram um evento de
        erro <code>HTTP_API</code>.
      </p>

      <div className="trigger-grid">
        <div className="trigger-card">
          <h2>Sucesso</h2>
          <p>
            Chama <code>GET {API_BASE}/api/v1/health</code>. Só mede latência, não gera erro.
          </p>
          <button disabled={pending !== null} onClick={() => runFetch('Health check', `${API_BASE}/api/v1/health`)}>
            Chamar endpoint saudável
          </button>
        </div>

        <div className="trigger-card">
          <h2>Erro HTTP (404)</h2>
          <p>Chama uma rota que não existe no backend — resposta 404 vira um evento de erro HTTP_API.</p>
          <button
            disabled={pending !== null}
            onClick={() => runFetch('Rota inexistente', `${API_BASE}/api/v1/rota-que-nao-existe`)}
          >
            Chamar endpoint inexistente
          </button>
        </div>

        <div className="trigger-card">
          <h2>Falha de rede</h2>
          <p>Chama um host que não resolve — o fetch rejeita, sem sequer chegar a ter status HTTP.</p>
          <button
            disabled={pending !== null}
            onClick={() => runFetch('Host inválido', 'https://este-dominio-nao-existe-12345.invalid/')}
          >
            Chamar host inválido
          </button>
        </div>
      </div>

      <h2>Atividade</h2>
      <ActivityLog entries={entries} />
    </section>
  );
}
