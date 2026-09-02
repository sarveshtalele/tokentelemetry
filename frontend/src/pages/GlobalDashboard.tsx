import { useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { useLiveData } from '../hooks/useLiveData';
import { getProjects } from '../api/projects';
import { getUsageTimeline } from '../api/usage';
import { getClients } from '../api/clients';
import { StatRow } from '../components/data/StatRow';
import { DataTable } from '../components/data/DataTable';
import { TokenTrendChart } from '../components/charts/TokenTrendChart';
import { TokenBarChart } from '../components/charts/TokenBarChart';
import { fmt, ago } from '../lib/format';
import { Link } from 'react-router-dom';

export function GlobalDashboard() {
  const { data: projects = [], loading: loadingProjects, error: errProjects } = useApi(() => getProjects(), []);
  const { data: timeline = [], loading: loadingTimeline, error: errTimeline } = useApi(() => getUsageTimeline(30), []);
  const { data: clients = [] } = useApi(() => getClients(), []);
  const live = useLiveData();

  const totals = useMemo(() => {
    const input = timeline.reduce((a, d) => a + (d.input || 0), 0);
    const output = timeline.reduce((a, d) => a + (d.output || 0), 0);
    const cacheRead = timeline.reduce((a, d) => a + (d.cache_read || 0), 0);
    const cacheWrite = timeline.reduce((a, d) => a + (d.cache_write || 0), 0);
    const totalTokens = timeline.reduce((a, d) => a + (d.tokens || 0), 0);
    const totalRequests = projects.reduce((a, p) => a + (p.requests || 0), 0);
    return { input, output, cacheRead, cacheWrite, totalTokens, totalRequests };
  }, [timeline, projects]);

  const error = errProjects || errTimeline;
  if (error) return <ErrorPanel message={error.message} />;
  if (loadingProjects || loadingTimeline) return <div className="p-10 text-center text-slate-500">Loading overview…</div>;

  const liveTotal = live.total_tokens as number | undefined;
  const topClient = clients[0];

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow="Command center"
        title="Usage overview"
        subtitle="Global Claude Code telemetry across projects, sessions, clients, tools and skills."
      />

      <StatRow
        columns={4}
        stats={[
          { label: 'Total tokens (30d)', value: fmt(liveTotal ?? totals.totalTokens) },
          { label: 'Input tokens', value: fmt(totals.input) },
          { label: 'Output tokens', value: fmt(totals.output) },
          { label: 'Cache read', value: fmt(totals.cacheRead) },
        ]}
      />

      <div className="grid grid-cols-[1.35fr_.65fr] gap-4">
        <TokenTrendChart data={timeline.map((d) => ({ day: d.day, tokens: d.tokens }))} title="Token consumption (30d)" />
        <div className="bg-surface border border-line rounded-lg p-4">
          <h3 className="text-sm font-bold mb-4">Token mix</h3>
          {[
            ['Input', totals.input],
            ['Cache read', totals.cacheRead],
            ['Cache write', totals.cacheWrite],
            ['Output', totals.output],
          ].map(([label, val]) => {
            const total = totals.input + totals.cacheRead + totals.cacheWrite + totals.output || 1;
            const pct = Math.round((val as number) / total * 100);
            return (
              <div key={label as string} className="my-4">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <b>{fmt(val as number)}</b>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 mt-1.5 overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <StatRow
        columns={4}
        stats={[
          { label: 'Requests (30d)', value: fmt(totals.totalRequests) },
          { label: 'Projects', value: fmt(projects.length) },
          { label: 'Top client', value: topClient ? topClient.client : '—' },
          {
            label: 'Avg tokens/req',
            value: totals.totalRequests > 0 ? fmt(Math.round(totals.totalTokens / totals.totalRequests)) : '—',
          },
        ]}
      />

      {projects.length > 0 && <TokenBarChart data={projects.slice(0, 20).map((p) => ({ project: p.project, total_tokens: p.total_tokens }))} />}

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="font-bold text-sm">Projects</span>
          <Link to="/projects" className="text-sm font-semibold text-accent-strong hover:underline">
            View all
          </Link>
        </div>
        <DataTable
          columns={[
            { key: 'project', label: 'Project', sortable: true },
            { key: 'total_tokens', label: 'Tokens', sortable: true, align: 'right', render: (v) => fmt(v as number) },
            { key: 'requests', label: 'Requests', sortable: true, align: 'right', render: (v) => fmt(v as number) },
            { key: 'last_activity', label: 'Last active', sortable: true, render: (v) => ago(v as string) },
          ]}
          data={projects.slice(0, 8)}
        />
      </div>
    </div>
  );
}

export function PageHead({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-5 flex-wrap">
      <div>
        <div className="text-accent text-[11px] font-extrabold uppercase tracking-wide">{eyebrow}</div>
        <div className="text-[27px] font-extrabold tracking-tight mt-1 mb-1.5">{title}</div>
        {subtitle && <div className="text-ink-soft text-sm max-w-2xl">{subtitle}</div>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="p-10 text-center text-slate-500 bg-surface border border-line rounded-lg">
      Could not reach the telemetry backend at <span className="font-mono">/api/v1</span>.
      <br />
      <span className="font-mono text-xs">{message}</span>
      <br />
      <br />
      Start it with: <span className="font-mono">cd backend &amp;&amp; python run.py</span>
    </div>
  );
}
