import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { getUsage } from '../api/usage';
import { getProjects } from '../api/projects';
import { DataTable } from '../components/data/DataTable';
import { StatRow } from '../components/data/StatRow';
import { ProjectFilter } from '../components/filters/ProjectFilter';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { Badge } from '../components/ui/Badge';
import { IconRefresh } from '../components/ui/Icons';
import { fmt, ago } from '../lib/format';
import { PageHead, ErrorPanel } from './GlobalDashboard';
import type { UsageRow } from '../types';

export function Requests() {
  const [page, setPage] = useState(1);
  const [project, setProject] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<UsageRow | null>(null);
  const { data: usage = [], loading, error, reload } = useApi(
    () => getUsage({ page: String(page), page_size: '100', ...(project ? { project } : {}) }),
    [page, project]
  );
  const { data: projects = [] } = useApi(() => getProjects(), []);

  const filtered = useMemo(
    () => usage.filter((r) => [r.project, r.model, r.client, r.session_id].join(' ').toLowerCase().includes(q.toLowerCase())),
    [usage, q]
  );

  const totalTokens = usage.reduce((a, r) => a + (r.total_tokens || 0), 0);
  const cacheRead = usage.reduce((a, r) => a + (r.cache_read_tokens || 0), 0);

  if (error) return <ErrorPanel message={error.message} />;

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow="Trace explorer"
        title="Requests"
        subtitle="Inspect individual Claude requests with exact usage and context metadata. Click a row to view the prompt and response."
        actions={
          <Button onClick={reload} className="flex items-center gap-1.5">
            <IconRefresh width={14} height={14} /> Refresh
          </Button>
        }
      />
      <StatRow
        stats={[
          { label: 'Requests (page)', value: fmt(usage.length) },
          { label: 'Avg request', value: usage.length ? fmt(Math.round(totalTokens / usage.length)) : '—' },
          { label: 'Cache read (page)', value: fmt(cacheRead) },
          { label: 'Page', value: String(page) },
        ]}
      />
      <div className="flex gap-2 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search project, model, client…"
          className="h-10 border border-line bg-white rounded-md px-3 text-sm min-w-[260px] flex-1 outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
        />
        <ProjectFilter projects={projects.map((p) => p.project)} value={project} onChange={(v) => { setProject(v); setPage(1); }} />
      </div>
      {loading ? (
        <div className="p-10 text-center text-slate-500">Loading requests…</div>
      ) : (
        <DataTable<UsageRow>
          onRowClick={(row) => setSelected(row)}
          columns={[
            { key: 'session_id', label: 'Session', render: (v) => <span className="font-mono">{String(v).slice(0, 12)}</span> },
            { key: 'project', label: 'Project' },
            { key: 'model', label: 'Model' },
            { key: 'client', label: 'Client' },
            { key: 'input_tokens', label: 'Input', align: 'right', render: (v) => fmt(v as number) },
            { key: 'output_tokens', label: 'Output', align: 'right', render: (v) => fmt(v as number) },
            { key: 'cache_read_tokens', label: 'Cache read', align: 'right', render: (v) => fmt(v as number) },
            { key: 'event_time', label: 'Age', render: (v) => ago(v as string) },
          ]}
          data={filtered}
        />
      )}
      <div className="flex gap-2 justify-end">
        <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          ← Prev
        </Button>
        <Button onClick={() => setPage((p) => p + 1)}>Next →</Button>
      </div>

      <Drawer open={!!selected} title={selected ? `Request · ${selected.session_id.slice(0, 12)}` : ''} onClose={() => setSelected(null)}>
        {selected && <RequestDetail row={selected} />}
      </Drawer>
    </div>
  );
}

export function RequestDetail({ row }: { row: UsageRow }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge tone="accent">{row.model || '—'}</Badge>
        <Badge>{row.client || '—'}</Badge>
        <span className="text-ink-soft text-xs">{ago(row.event_time)}</span>
      </div>
      <div className="text-lg font-bold">{row.project || '—'}</div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Input" value={fmt(row.input_tokens)} />
        <Metric label="Output" value={fmt(row.output_tokens)} />
        <Metric label="Cache read" value={fmt(row.cache_read_tokens)} />
        <Metric label="Cache write" value={fmt(row.cache_write_tokens)} />
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-2">Session</div>
        <KV k="Session id" v={<span className="font-mono text-xs">{row.session_id}</span>} />
        <KV k="Total tokens" v={fmt(row.total_tokens)} />
        <KV k="Context window" v={row.context_window ? fmt(row.context_window) : '—'} />
        <KV k="Event time" v={row.event_time || '—'} />
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-2">Prompt preview</div>
        <p className="text-ink-soft text-xs mb-2">
          Truncated preview stored at collection time (up to 800 characters) — not the full transcript.
        </p>
        <pre className="bg-[#0b1220] text-slate-300 rounded-lg p-3.5 text-xs whitespace-pre-wrap break-words leading-relaxed max-h-72 overflow-y-auto">
          {row.prompt_preview || '(no prompt preview captured)'}
        </pre>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide font-bold text-slate-500 mb-2">Response preview</div>
        <p className="text-ink-soft text-xs mb-2">Truncated preview (up to 1200 characters) — not the full response.</p>
        <pre className="bg-[#0b1220] text-slate-300 rounded-lg p-3.5 text-xs whitespace-pre-wrap break-words leading-relaxed max-h-72 overflow-y-auto">
          {row.response_preview || '(no response preview captured)'}
        </pre>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-muted rounded-lg p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="font-bold text-base">{value}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 py-1.5 border-b border-[#eef2f6] last:border-0 text-sm">
      <span className="text-slate-500">{k}</span>
      <span>{v}</span>
    </div>
  );
}
