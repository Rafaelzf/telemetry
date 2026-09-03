import { useCallback, useState } from 'react';

export interface ActivityEntry {
  id: string;
  time: string;
  message: string;
}

export function useActivityLog() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  const log = useCallback((message: string) => {
    const entry: ActivityEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: new Date().toLocaleTimeString('pt-BR'),
      message
    };
    setEntries((prev) => [entry, ...prev].slice(0, 20));
  }, []);

  return { entries, log };
}
