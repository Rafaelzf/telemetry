import type { ActivityEntry } from '../hooks/useActivityLog';

export function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return <p className="activity-log-empty">Nenhuma ação disparada ainda nesta página.</p>;
  }

  return (
    <ul className="activity-log">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className="activity-time">{entry.time}</span>
          {entry.message}
        </li>
      ))}
    </ul>
  );
}
