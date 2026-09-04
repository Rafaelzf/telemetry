import { useCallback, useEffect, useState } from 'react';
import { API_BASE, APP_ID } from '../telemetry';

export type Environment = 'development' | 'staging' | 'production';

export interface ErrorEventRow {
  id: string;
  app_id: string;
  environment: Environment;
  release: string | null;
  category: string;
  message: string;
  stack_trace: string | null;
  source: string | null;
  url: string;
  user_agent: string | null;
  timestamp: string;
  created_at: string;
}

export interface PerformanceEventRow {
  id: string;
  app_id: string;
  environment: Environment;
  metric_name: string;
  // Postgres numeric columns round-trip as strings (node-postgres doesn't parse
  // NUMERIC to number, to avoid precision loss) — convert with Number() before charting.
  metric_value: string;
  url: string;
  timestamp: string;
  created_at: string;
}

interface FetchState {
  errors: ErrorEventRow[];
  performance: PerformanceEventRow[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const MAX_LIMIT = 500;

/**
 * @param environment 'all' or one of the backend's Environment enum values.
 * @param from ISO datetime string (lower bound), or undefined for "no lower bound".
 */
export function useTelemetryMetrics(environment: Environment | 'all', from?: string) {
  const [state, setState] = useState<FetchState>({
    errors: [],
    performance: [],
    loading: true,
    error: null,
    lastUpdated: null
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const params = new URLSearchParams({ appId: APP_ID, limit: String(MAX_LIMIT) });
    if (environment !== 'all') params.set('environment', environment);
    if (from) params.set('from', from);

    try {
      const [errorsRes, perfRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/metrics/errors?${params.toString()}`),
        fetch(`${API_BASE}/api/v1/metrics/performance?${params.toString()}`)
      ]);

      if (!errorsRes.ok || !perfRes.ok) {
        throw new Error(`Backend respondeu ${errorsRes.status}/${perfRes.status}`);
      }

      const [errorsJson, perfJson] = await Promise.all([errorsRes.json(), perfRes.json()]);

      setState({
        errors: errorsJson.data ?? [],
        performance: perfJson.data ?? [],
        loading: false,
        error: null,
        lastUpdated: new Date()
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Falha desconhecida ao buscar métricas'
      }));
    }
  }, [environment, from]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
