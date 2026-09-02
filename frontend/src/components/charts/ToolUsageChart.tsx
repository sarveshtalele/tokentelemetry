import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fmt } from '../../lib/format';

interface Props {
  data: { tool_name: string; call_count: number }[];
}

export function ToolUsageChart({ data }: Props) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <h3 className="text-sm font-bold mb-4">Tool call distribution</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data.slice(0, 12)} margin={{ left: -10, right: 10 }}>
          <XAxis dataKey="tool_name" tick={{ fontSize: 11 }} angle={-40} textAnchor="end" height={70} interval={0} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Bar dataKey="call_count" fill="#6D5EF7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
