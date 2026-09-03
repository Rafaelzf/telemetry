import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MonitoringErrorBoundary } from 'web-monitoring-sdk/react';
import './telemetry';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <MonitoringErrorBoundary
        fallback={
          <div className="crash-fallback">
            <h1>A aplicação encontrou um erro inesperado</h1>
            <p>Isso também foi reportado ao SDK de telemetria.</p>
            <a href="/">Voltar ao início</a>
          </div>
        }
      >
        <App />
      </MonitoringErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);
