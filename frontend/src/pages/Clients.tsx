import { useApi } from '../hooks/useApi';
import { getClients } from '../api/clients';
import { DataTable } from '../components/data/DataTable';
import { StatRow } from '../components/data/StatRow';
import { TokenBarChart } from '../components/charts/TokenBarChart';
import { Badge } from '../components/ui/Badge';
import { fmt } from '../lib/format';
import { PageHead, ErrorPanel } from './GlobalDashboard';

export function Clients() {
  const { data: clients = [], loading, error } = useApi(() => getClients(), []);
  if (error) return <ErrorPanel message={error.message} />;
  if (loading) return <div className="p-10 text-center text-slate-500">Loading clients…</div>;

  const totalTokens = clients.reduce((a, c) => a + (c.total_tokens || 0), 0);

  return (
    <div className="space-y-6">
      <PageHead eyebrow="Environment intelligence" title="Clients & IDEs" subtitle="Best-effort client classification across Claude Code sessions." />
      <StatRow
        stats={[
          { label: 'Known clients', value: fmt(clients.length) },
          { label: 'Top client', value: clients[0]?.client || '—' },
          { label: 'Total tokens', value: fmt(totalTokens) },
          { label: 'Total requests', value: fmt(clients.reduce((a, c) => a + (c.requests || 0), 0)) },
        ]}
      />
      {clients.length > 0 && <TokenBarChart data={clients.map((c) => ({ project: c.client, total_tokens: c.total_tokens }))} title="Client mix" />}
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="font-bold text-sm">Client breakdown</span>
          <Badge tone="info">Classification confidence varies</Badge>
        </div>
        <DataTable
          columns={[
            { key: 'client', label: 'Client' },
            { key: 'total_tokens', label: 'Tokens', align: 'right', render: (v) => fmt(v as number) },
            { key: 'sessions', label: 'Sessions', align: 'right', render: (v) => fmt(v as number) },
            { key: 'requests', label: 'Requests', align: 'right', render: (v) => fmt(v as number) },
            {
              key: 'total_tokens',
              label: 'Share',
              align: 'right',
              render: (v) => (totalTokens ? `${Math.round(((v as number) / totalTokens) * 100)}%` : '0%'),
            },
            { key: 'projects', label: 'Projects', render: (v) => <Badge>{fmt(v as number)} active</Badge> },
          ]}
          data={clients}
          emptyLabel="No client data recorded yet."
        />
      </div>
      <div className="bg-surface border border-line rounded-lg p-4">
        <div className="font-bold text-sm mb-1">Classification note</div>
        <p className="text-ink-soft text-sm">
          The telemetry layer uses available process/environment signals and transcript metadata. Treat the client field as analytical
          classification, not a cryptographic source of truth.
        </p>
      </div>
    </div>
  );
}
