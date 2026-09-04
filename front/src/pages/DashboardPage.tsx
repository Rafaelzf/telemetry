import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { API_BASE, APP_ID } from '../telemetry';
import { useTelemetryMetrics, type Environment } from '../hooks/useTelemetryMetrics';

type PeriodPreset = '24h' | '7d' | '30d' | 'all';

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'all', label: 'Tudo (últimos 500 eventos)' }
];

const PERIOD_MS: Record<Exclude<PeriodPreset, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000
};

const CATEGORY_LABELS: Record<string, string> = {
  JS_RUNTIME: 'Erro de JS',
  UNHANDLED_PROMISE: 'Promise rejeitada',
  RESOURCE: 'Recurso quebrado',
  HTTP_API: 'Erro de API',
  REACT_RENDER: 'Erro de render (React)',
  UNKNOWN: 'Desconhecido'
};

const CATEGORY_COLORS: Record<string, string> = {
  JS_RUNTIME: '#e15759',
  UNHANDLED_PROMISE: '#f28e2b',
  RESOURCE: '#b07aa1',
  HTTP_API: '#edc948',
  REACT_RENDER: '#ff9da7',
  UNKNOWN: '#9c9c9c'
};

const ENVIRONMENT_COLORS: Record<string, string> = {
  development: '#4e79a7',
  staging: '#f28e2b',
  production: '#59a14f'
};

const METRIC_UNITS: Record<string, string> = {
  LCP: 'ms',
  FCP: 'ms',
  TTFB: 'ms',
  HTTP_LATENCY: 'ms',
  INP: 'ms',
  CLS: '' // unitless score
};

function dayBucket(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10); // YYYY-MM-DD, sorts lexicographically = chronologically
}

function formatDayLabel(bucket: string): string {
  const [, month, day] = bucket.split('-');
  return `${day}/${month}`;
}

export function DashboardPage() {
  const [environment, setEnvironment] = useState<Environment | 'all'>('all');
  const [period, setPeriod] = useState<PeriodPreset>('7d');
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<ReadonlySet<string>>(new Set());

  const toggleCategory = (category: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const from = useMemo(
    () => (period === 'all' ? undefined : new Date(Date.now() - PERIOD_MS[period]).toISOString()),
    [period]
  );
  const { errors, performance, loading, error, lastUpdated, reload } = useTelemetryMetrics(environment, from);

  const errorsByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of errors) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return [...counts.entries()]
      .map(([category, count]) => ({ category, label: CATEGORY_LABELS[category] ?? category, count }))
      .sort((a, b) => b.count - a.count);
  }, [errors]);

  const errorsByEnvironment = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of errors) counts.set(e.environment, (counts.get(e.environment) ?? 0) + 1);
    return [...counts.entries()].map(([env, count]) => ({ name: env, value: count }));
  }, [errors]);

  const categoriesPresent = useMemo(() => [...new Set(errors.map((e) => e.category))], [errors]);

  const errorsOverTime = useMemo(() => {
    const buckets = new Map<string, Record<string, number>>();
    for (const e of errors) {
      const bucket = dayBucket(e.timestamp);
      const row = buckets.get(bucket) ?? {};
      row[e.category] = (row[e.category] ?? 0) + 1;
      buckets.set(bucket, row);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, counts]) => ({ bucket, label: formatDayLabel(bucket), ...counts }));
  }, [errors]);

  const metricNames = useMemo(() => [...new Set(performance.map((p) => p.metric_name))].sort(), [performance]);

  const performanceAverages = useMemo(() => {
    const sums = new Map<string, { total: number; count: number }>();
    for (const p of performance) {
      const entry = sums.get(p.metric_name) ?? { total: 0, count: 0 };
      entry.total += Number(p.metric_value);
      entry.count += 1;
      sums.set(p.metric_name, entry);
    }
    return [...sums.entries()].map(([metric_name, { total, count }]) => ({
      metric_name,
      average: Number((total / count).toFixed(2)),
      samples: count,
      unit: METRIC_UNITS[metric_name] ?? ''
    }));
  }, [performance]);

  const selectedMetric = activeMetric ?? metricNames[0] ?? null;

  const selectedMetricOverTime = useMemo(() => {
    if (!selectedMetric) return [];
    const buckets = new Map<string, { total: number; count: number; max: number; min: number }>();
    for (const p of performance) {
      if (p.metric_name !== selectedMetric) continue;
      const value = Number(p.metric_value);
      const bucket = dayBucket(p.timestamp);
      const entry = buckets.get(bucket) ?? { total: 0, count: 0, max: -Infinity, min: Infinity };
      entry.total += value;
      entry.count += 1;
      entry.max = Math.max(entry.max, value);
      entry.min = Math.min(entry.min, value);
      buckets.set(bucket, entry);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, { total, count, max, min }]) => ({
        bucket,
        label: formatDayLabel(bucket),
        average: Number((total / count).toFixed(2)),
        max: Number(max.toFixed(2)),
        min: Number(min.toFixed(2)),
        samples: count
      }));
  }, [performance, selectedMetric]);

  const totalEvents = errors.length + performance.length;

  return (
    <section>
      <h1>Dashboard</h1>
      <p>
        Gráficos construídos a partir dos dados reais já persistidos pelo backend (Postgres, tabelas{' '}
        <code>error_events</code> e <code>performance_events</code>) — consultados via{' '}
        <code>GET /api/v1/metrics/errors</code> e <code>GET /api/v1/metrics/performance</code> em{' '}
        <code>{API_BASE}</code>, filtrados pelo <code>appId={APP_ID}</code>.
      </p>
      <p className="note">
        Os eventos passam por uma fila antes de serem gravados (ingestão assíncrona) — se você acabou de gerar
        eventos nas outras páginas, pode levar alguns segundos até aparecerem aqui. Use "Atualizar" para buscar de
        novo sem recarregar a página.
      </p>

      <div className="dashboard-filters">
        <label>
          Ambiente
          <select value={environment} onChange={(e) => setEnvironment(e.target.value as Environment | 'all')}>
            <option value="all">Todos</option>
            <option value="development">development</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
        </label>

        <label>
          Período
          <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodPreset)}>
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <button onClick={reload} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>

        {lastUpdated && (
          <span className="note">Última atualização: {lastUpdated.toLocaleTimeString('pt-BR')}</span>
        )}
      </div>

      {error && (
        <p className="note" style={{ color: '#e15759' }}>
          Falha ao buscar métricas: {error}
        </p>
      )}

      {!error && !loading && totalEvents === 0 && (
        <p className="note">
          Nenhum evento encontrado para esse filtro. Gere alguns nas páginas de Erros, HTTP / Fetch ou Performance e
          clique em "Atualizar".
        </p>
      )}

      <h2>Erros</h2>
      <div className="trigger-grid">
        <div className="trigger-card">
          <h2>Por categoria</h2>
          {errorsByCategory.length === 0 ? (
            <p className="note">Sem erros no período selecionado.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={errorsByCategory} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Ocorrências">
                  {errorsByCategory.map((entry) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? '#8884d8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="trigger-card">
          <h2>Por ambiente</h2>
          {errorsByEnvironment.length === 0 ? (
            <p className="note">Sem erros no período selecionado.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={errorsByEnvironment} dataKey="value" nameKey="name" outerRadius={80} label>
                  {errorsByEnvironment.map((entry) => (
                    <Cell key={entry.name} fill={ENVIRONMENT_COLORS[entry.name] ?? '#8884d8'} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="trigger-card">
        <h2>Erros ao longo do tempo (por categoria, por dia)</h2>
        {errorsOverTime.length === 0 ? (
          <p className="note">Sem erros no período selecionado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={errorsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend
                onClick={(entry) => {
                  if (typeof entry.dataKey === 'string') toggleCategory(entry.dataKey);
                }}
                formatter={(value) => <span style={{ cursor: 'pointer' }}>{value}</span>}
              />
              {categoriesPresent.map((category) => (
                <Bar
                  key={category}
                  dataKey={category}
                  name={CATEGORY_LABELS[category] ?? category}
                  stackId="errors"
                  fill={CATEGORY_COLORS[category] ?? '#8884d8'}
                  hide={hiddenCategories.has(category)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
        <p className="note">Clique num item da legenda para ocultar/mostrar aquela categoria no gráfico.</p>
      </div>

      <h2>Performance (Web Vitals)</h2>
      <div className="trigger-card">
        <h2>Média por métrica</h2>
        {performanceAverages.length === 0 ? (
          <p className="note">Sem eventos de performance no período selecionado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={performanceAverages}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="metric_name" />
              <YAxis />
              <Tooltip
                formatter={(value, _name, item) => [`${value} ${item.payload.unit}`.trim(), 'Média']}
                labelFormatter={(label) => `Métrica: ${label}`}
              />
              <Bar dataKey="average" name="Média" fill="#4e79a7" />
            </BarChart>
          </ResponsiveContainer>
        )}
        <p className="note">
          CLS é um score sem unidade (0 a ~1); as demais métricas são em milissegundos — por isso são mostradas na
          mesma escala apenas para comparação relativa de grandeza, não de valor absoluto.
        </p>
      </div>

      <div className="trigger-card">
        <h2>Métrica ao longo do tempo</h2>
        {metricNames.length === 0 ? (
          <p className="note">Sem eventos de performance no período selecionado.</p>
        ) : (
          <>
            <div className="metric-tabs">
              {metricNames.map((name) => (
                <button
                  key={name}
                  className={name === selectedMetric ? 'active' : ''}
                  onClick={() => setActiveMetric(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={selectedMetricOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [
                    `${value} ${selectedMetric ? (METRIC_UNITS[selectedMetric] ?? '') : ''}`.trim(),
                    name
                  ]}
                />
                <Legend />
                <Line type="monotone" dataKey="average" name="Média do dia" stroke="#4e79a7" strokeWidth={2} />
                <Line type="monotone" dataKey="max" name="Máximo do dia" stroke="#e15759" strokeDasharray="4 3" />
                <Line type="monotone" dataKey="min" name="Mínimo do dia" stroke="#59a14f" strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </section>
  );
}
