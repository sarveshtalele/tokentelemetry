import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { PageHead } from './GlobalDashboard';

export function About() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHead
        eyebrow="Product"
        title="About Claude Telemetry Enterprise"
        subtitle="A local-first observability console for Claude Code: exact request usage plus estimated tool, file, and skill attribution."
      />

      <Section title="What this tracks">
        <p>
          A background collector reads your Claude Code session transcripts and hook events into a local
          SQLite database (nothing leaves your machine). The dashboard then shows, per project, client and
          session: token usage, requests, tool calls, skill activations, MCP server calls, and hook firings.
        </p>
      </Section>

      <Section title="Exact vs. estimated — what “attributed” means">
        <p className="mb-3">
          The Claude API reports token usage per <em>request</em>, not per file or tool call. So anywhere
          you see an <Badge tone="success">Exact</Badge> badge, that number came straight from the API.
          Anywhere you see an <Badge tone="warning">Estimated</Badge> badge — attribution hotspots, top
          files/paths, per-project token breakdowns by category — that number is a heuristic: each
          request's exact token count is divided across the tool calls active near it in the transcript,
          then split again across the file paths each of those tools touched.
        </p>
        <p>
          A slice that couldn't be matched to any nearby tool call is bucketed as{' '}
          <span className="font-mono">[unattributed]</span> rather than silently dropped or guessed. Treat
          estimated numbers as directionally useful for finding hotspots, not as a precise per-file cost.
        </p>
      </Section>

      <Section title="Full prompts and responses">
        <p>
          List views (Requests, Project → Requests) show short truncated previews for speed. Click a row,
          then “Open full prompt &amp; response” to open the complete, untruncated prompt and response for
          that request in its own page —{' '}
          <Link to="/requests" className="text-accent-strong hover:underline">
            start from Requests
          </Link>
          .
        </p>
      </Section>

      <Section title="What's excluded on purpose">
        <p>
          Cost/pricing columns are intentionally left out of the primary UI — billing depends on the plan in
          effect and isn't a reliable token-telemetry primitive, so it would be misleading to display it
          alongside exact/estimated token data.
        </p>
      </Section>

      <Section title="Local-first">
        <p>
          Everything runs on your machine: a Python collector + FastAPI backend on top of a local SQLite
          file, and this React UI talking to it over <span className="font-mono">/api/v1</span>. See{' '}
          <Link to="/settings" className="text-accent-strong hover:underline">
            Settings
          </Link>{' '}
          for the database path and collector status.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-5">
      <h3 className="text-sm font-bold mb-2.5">{title}</h3>
      <div className="text-sm text-ink-soft leading-relaxed">{children}</div>
    </div>
  );
}
