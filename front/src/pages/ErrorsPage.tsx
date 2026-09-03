import { useState } from 'react';
import { MonitoringErrorBoundary } from 'web-monitoring-sdk/react';
import { captureException } from 'web-monitoring-sdk';
import { ActivityLog } from '../components/ActivityLog';
import { useActivityLog } from '../hooks/useActivityLog';

function Bomb(): never {
  throw new Error('Erro de renderização React (demo)');
}

function ReactRenderErrorDemo() {
  const [crash, setCrash] = useState(false);

  return (
    <MonitoringErrorBoundary
      fallback={
        <div className="inline-fallback">
          💥 Erro capturado pelo <code>MonitoringErrorBoundary</code> (categoria <code>REACT_RENDER</code>).
          <button onClick={() => setCrash(false)}>Resetar</button>
        </div>
      }
    >
      {crash ? (
        <Bomb />
      ) : (
        <button onClick={() => setCrash(true)}>Lançar erro de renderização React</button>
      )}
    </MonitoringErrorBoundary>
  );
}

export function ErrorsPage() {
  const { entries, log } = useActivityLog();
  const [showBrokenImage, setShowBrokenImage] = useState(false);

  return (
    <section>
      <h1>Erros</h1>
      <p>Cada botão dispara um caminho diferente de captura de erro do SDK.</p>

      <div className="trigger-grid">
        <div className="trigger-card">
          <h2>JS Runtime</h2>
          <p>
            Lança uma exceção fora do fluxo de eventos do React (via <code>setTimeout</code>), capturada por{' '}
            <code>window.onerror</code>.
          </p>
          <button
            onClick={() => {
              log('Erro JS não tratado lançado');
              setTimeout(() => {
                throw new Error('Erro JS não tratado (demo)');
              });
            }}
          >
            Lançar erro JS não tratado
          </button>
        </div>

        <div className="trigger-card">
          <h2>Promise rejeitada</h2>
          <p>
            Cria uma Promise rejeitada sem <code>.catch()</code>, capturada por{' '}
            <code>window.onunhandledrejection</code>.
          </p>
          <button
            onClick={() => {
              log('Promise rejeitada sem tratamento criada');
              Promise.reject(new Error('Promise rejeitada não tratada (demo)'));
            }}
          >
            Lançar rejeição não tratada
          </button>
        </div>

        <div className="trigger-card">
          <h2>Recurso quebrado</h2>
          <p>Renderiza uma <code>&lt;img&gt;</code> com uma URL inválida — o erro de carregamento é capturado na capture phase.</p>
          <button onClick={() => { setShowBrokenImage(true); log('Imagem com URL inválida renderizada'); }}>
            Carregar imagem quebrada
          </button>
          {showBrokenImage && (
            <img
              src="https://telemetry-back.onrender.com/imagem-que-nao-existe.png"
              alt="recurso quebrado (demo)"
              width={1}
              height={1}
              onError={() => log('Evento onError dessa <img> disparado no browser')}
            />
          )}
        </div>

        <div className="trigger-card">
          <h2>Erro de renderização React</h2>
          <p>
            Lança uma exceção dentro do <code>render()</code>, capturada por um <code>MonitoringErrorBoundary</code>{' '}
            local a este card.
          </p>
          <ReactRenderErrorDemo />
        </div>

        <div className="trigger-card">
          <h2>Captura manual</h2>
          <p>
            Chama <code>captureException()</code> diretamente, sem passar por nenhum listener automático.
          </p>
          <button
            onClick={() => {
              log('captureException() chamado manualmente');
              captureException(new Error('Exceção reportada manualmente (demo)'));
            }}
          >
            Reportar exceção manual
          </button>
        </div>
      </div>

      <h2>Atividade</h2>
      <ActivityLog entries={entries} />
    </section>
  );
}
