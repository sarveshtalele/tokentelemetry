import { fmt, ago } from '../../lib/format';
import type { SessionRow } from '../../types';
import { Badge } from '../ui/Badge';

export function SessionCard({ s, onClick }: { s: SessionRow; onClick?: () => void }) {
  const active = s.last_active && Date.now() - new Date(s.last_active).getTime() < 5 * 60 * 1000;
  return (
    <div onClick={onClick} className={`bg-surface-muted rounded-lg p-4 ${onClick ? 'cursor-pointer hover:bg-surface-muted' : ''}`}>
      <div className="font-mono text-xs text-ink-soft">{s.session_id.slice(0, 12)}</div>
      <div className="text-lg font-extrabold mt-1">{fmt(s.total_tokens)}</div>
      <div className="text-ink-soft text-xs">tokens · {ago(s.last_active)}</div>
      <div className="mt-2">
        <Badge tone={active ? 'success' : 'info'}>{active ? 'Active' : 'Complete'}</Badge>
      </div>
    </div>
  );
}
