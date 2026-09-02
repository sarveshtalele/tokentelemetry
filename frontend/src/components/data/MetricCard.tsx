interface Props {
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function MetricCard({ label, value, delta, trend = 'up' }: Props) {
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-ink-soft';
  return (
    <div className="bg-surface border border-line rounded-lg p-4 shadow-[0_2px_10px_rgba(15,23,42,.045)] min-h-[110px]">
      <div className="text-ink-soft font-semibold text-xs">{label}</div>
      <div className="text-ink font-extrabold text-[26px] tracking-tight mt-2 mb-0.5">{value}</div>
      {delta && <div className={`text-xs font-semibold ${trendColor}`}>{delta}</div>}
    </div>
  );
}
