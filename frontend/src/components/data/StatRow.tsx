import { MetricCard } from './MetricCard';

interface Stat {
  label: string;
  value: string;
  delta?: string;
}

export function StatRow({ stats, columns = 4 }: { stats: Stat[]; columns?: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {stats.map((s) => (
        <MetricCard key={s.label} {...s} />
      ))}
    </div>
  );
}
