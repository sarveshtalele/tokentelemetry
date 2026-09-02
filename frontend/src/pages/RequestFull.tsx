import { useParams, Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { getUsageById } from '../api/usage';
import { Badge } from '../components/ui/Badge';
import { fmt, ago } from '../lib/format';
import { ErrorPanel } from './GlobalDashboard';

export function RequestFull() {
  const { id = '' } = useParams();
  const { data: row, loading, error } = useApi(() => getUsageById(id), [id]);

  if (error) return <ErrorPanel message={error.message} />;
  if (loading || !row) return <div className="p-10 text-center text-ink-soft">Loading request…</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link to="/requests" className="text-sm text-accent-strong hover:underline">
          ← Back to requests
        </Link>
      </div>

      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div>
          <div className="text-accent text-[11px] font-extrabold uppercase tracking-wide">Full transcript</div>
          <div className="text-[27px] font-extrabold tracking-tight mt-1 mb-1.5">Request · {row.session_id.slice(0, 12)}</div>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Badge tone="accent">{row.model || '—'}</Badge>
            <Badge>{row.client || '—'}</Badge>
            <Badge>{row.project || '—'}</Badge>
            <span className="text-ink-soft text-xs">{ago(row.event_time)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric label="Input" value={fmt(row.input_tokens)} />
        <Metric label="Output" value={fmt(row.output_tokens)} />
        <Metric label="Cache read" value={fmt(row.cache_read_tokens)} />
        <Metric label="Cache write" value={fmt(row.cache_write_tokens)} />
        <Metric label="Total" value={fmt(row.total_tokens)} />
      </div>

      <div className="bg-surface border border-line rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wide font-bold text-ink-soft">Full prompt</div>
          <CopyButton text={row.prompt_full || row.prompt_preview || ''} />
        </div>
        <pre className="bg-surface-code text-slate-300 rounded-lg p-4 text-xs whitespace-pre-wrap break-words leading-relaxed max-h-[60vh] overflow-y-auto">
          {row.prompt_full || row.prompt_preview || '(no prompt captured)'}
        </pre>
      </div>

      <div className="bg-surface border border-line rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wide font-bold text-ink-soft">Full response</div>
          <CopyButton text={row.response_full || row.response_preview || ''} />
        </div>
        <pre className="bg-surface-code text-slate-300 rounded-lg p-4 text-xs whitespace-pre-wrap break-words leading-relaxed max-h-[60vh] overflow-y-auto">
          {row.response_full || row.response_preview || '(no response captured)'}
        </pre>
      </div>

      <div className="text-xs text-ink-soft">
        Session id: <span className="font-mono">{row.session_id}</span> · Event time: {row.event_time || '—'}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-muted rounded-lg p-3">
      <div className="text-[11px] text-ink-soft">{label}</div>
      <div className="font-bold text-base">{value}</div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => navigator.clipboard?.writeText(text)}
      className="text-[11px] font-semibold text-accent-strong hover:underline"
    >
      Copy
    </button>
  );
}
