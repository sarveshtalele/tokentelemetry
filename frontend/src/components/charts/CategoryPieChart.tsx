import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#6D5EF7', '#2878C8', '#0F9D72', '#C27A12', '#C53D4B', '#a49cff'];

interface Props {
  data: { name: string; value: number }[];
  title?: string;
}

export function CategoryPieChart({ data, title = 'Distribution' }: Props) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <h3 className="text-sm font-bold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
