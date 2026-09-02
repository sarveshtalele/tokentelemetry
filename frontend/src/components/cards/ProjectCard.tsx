import { Link } from 'react-router-dom';
import { fmt, ago, healthOf } from '../../lib/format';
import type { ProjectSummary } from '../../types';
import { Badge } from '../ui/Badge';

export function ProjectCard({ p }: { p: ProjectSummary }) {
  const health = healthOf(p.last_activity);
  const tone = health > 95 ? 'success' : health > 90 ? 'info' : 'warning';
  return (
    <Link
      to={`/projects/${encodeURIComponent(p.project)}`}
      className="block bg-surface border border-line rounded-lg p-4 hover:border-slate-300 hover:shadow-[0_2px_10px_rgba(15,23,42,.06)] transition-shadow"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-md bg-accent-soft text-accent-strong grid place-items-center font-extrabold shrink-0">
          {p.project.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-bold truncate">{p.project}</div>
          <div className="text-[11px] text-slate-500">{p.sessions} sessions</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div>
          <div className="font-bold">{fmt(p.total_tokens)}</div>
          <div className="text-[11px] text-slate-500">tokens</div>
        </div>
        <div>
          <div className="font-bold">{fmt(p.requests)}</div>
          <div className="text-[11px] text-slate-500">requests</div>
        </div>
        <div>
          <div className="font-bold">{ago(p.last_activity)}</div>
          <div className="text-[11px] text-slate-500">last active</div>
        </div>
        <Badge tone={tone}>{health}%</Badge>
      </div>
    </Link>
  );
}
