import { useLocation, Link } from 'react-router-dom';
import { IconRefresh } from '../ui/Icons';

const LABELS: Record<string, string> = {
  projects: 'Projects',
  requests: 'Requests',
  tools: 'Tools',
  skills: 'Skills',
  sessions: 'Sessions',
  clients: 'Clients & IDEs',
  'mcp-plugins': 'MCP & Plugins',
  settings: 'Telemetry settings',
};

export function TopBar() {
  const loc = useLocation();
  const parts = loc.pathname.split('/').filter(Boolean);
  return (
    <header className="h-16 bg-white/90 backdrop-blur border-b border-line flex items-center justify-between px-7 sticky top-0 z-10">
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <strong className="text-ink">Telemetry</strong>
        {parts.length === 0 ? (
          <>
            <span className="text-line">/</span>
            <span className="font-semibold text-ink">Global</span>
          </>
        ) : (
          parts.map((p, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="text-line">/</span>
              {i === parts.length - 1 ? (
                <span className="font-semibold text-ink">{LABELS[p] || decodeURIComponent(p)}</span>
              ) : (
                <Link to={'/' + parts.slice(0, i + 1).join('/')} className="hover:text-ink">
                  {LABELS[p] || decodeURIComponent(p)}
                </Link>
              )}
            </span>
          ))
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 border border-line bg-white rounded-md px-3 py-2 text-sm font-semibold hover:border-slate-300"
        >
          <IconRefresh width={14} height={14} /> Refresh
        </button>
        <span className="flex items-center gap-1.5 bg-accent text-white rounded-md px-3 py-2 text-sm font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
        </span>
      </div>
    </header>
  );
}
