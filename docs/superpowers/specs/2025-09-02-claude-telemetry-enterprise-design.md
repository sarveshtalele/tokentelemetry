# Claude Telemetry Enterprise — Design Spec

**Version:** 1.0  
**Date:** 2025-09-02  
**Status:** Draft  
**Project:** Claude Token Telemetry v4 → Enterprise  

---

## 1. Overview

Claude Telemetry Enterprise is a complete re-architecture of the existing Streamlit-based token telemetry system into a professional two-tier application: a **React + Vite + TypeScript frontend** with a **FastAPI Python backend**, backed by the existing SQLite database. The design follows the DESIGN.md spec: quiet, data-dense, infrastructure-control-plane aesthetic with violet accent and semantic status colors.

**Goals:**
- Professional project structure (`frontend/`, `backend/`)
- Global dashboard showing all projects aggregated
- Per-project drilldown with scoped metrics
- Dedicated pages for Tools, Skills, Sessions, Clients, Requests, MCP/Plugins
- Live-updating charts (polling every 10s via WebSocket fallback)
- Zero cost display in primary UI (per DESIGN.md — cost hidden from primary views)
- Keep existing Python ingestion/reconciliation/daemon logic, restructured into `backend/`

**Non-goals:**
- Not replacing SQLite (upgrade path later)
- Not containerizing (Windows local first)
- Not adding auth (future)

---

## 2. Project Structure

```
claude-token-telemetry-v4/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app, CORS, lifespan
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── router.py              # Master router mounting all routes
│   │   │   └── routes/
│   │   │       ├── __init__.py
│   │   │       ├── usage.py           # GET /api/usage, /api/usage/project/{id}
│   │   │       ├── projects.py        # GET /api/projects
│   │   │       ├── tools.py           # GET /api/tools
│   │   │       ├── skills.py          # GET /api/skills
│   │   │       ├── sessions.py        # GET /api/sessions
│   │   │       ├── events.py          # GET /api/events
│   │   │       ├── clients.py         # GET /api/clients
│   │   │       ├── attributions.py    # GET /api/attributions
│   │   │       ├── mcp.py             # GET /api/mcp (MCP server tracking)
│   │   │       ├── plugins.py         # GET /api/plugins (skill plugins + hooks)
│   │   │       ├── settings.py        # GET /api/settings (daemon status, db info)
│   │   │       └── live.py            # WebSocket /ws/live for real-time chart updates
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── connection.py          # connect() — moved from telemetry/db.py
│   │   │   └── schema.py              # Full SCHEMA + migration logic
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py             # Pydantic response models
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── reconcile.py           # moved from telemetry/reconcile.py
│   │       ├── collector.py           # moved from telemetry/collector.py
│   │       ├── daemon.py              # moved from telemetry/daemon.py (runs as subprocess)
│   │       └── attribution.py         # rebuild_attributions() — extracted from reconcile
│   ├── hooks/
│   │   └── claude-telemetry-hook.py   # unchanged
│   ├── requirements.txt
│   └── run.py                         # entry point: uvicorn + optional daemon thread
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── main.tsx                   # React entry
│       ├── App.tsx                    # Router setup
│       ├── index.css                  # Tailwind imports + design tokens
│       ├── types/
│       │   └── index.ts               # TS interfaces: UsageRow, ToolCall, SkillEvent, etc.
│       ├── api/
│       │   ├── client.ts              # fetch wrapper with base URL
│       │   ├── usage.ts               # typed API functions
│       │   ├── projects.ts
│       │   ├── tools.ts
│       │   ├── skills.ts
│       │   ├── sessions.ts
│       │   ├── events.ts
│       │   ├── clients.ts
│       │   ├── attributions.ts
│       │   ├── mcp.ts
│       │   ├── plugins.ts
│       │   └── settings.ts
│       ├── hooks/
│       │   ├── useApi.ts              # generic fetch hook
│       │   ├── useLiveData.ts         # WebSocket hook for real-time updates
│       │   └── useAutoRefresh.ts      # polling fallback hook
│       ├── components/
│       │   ├── Layout/
│       │   │   ├── AppLayout.tsx      # sidebar + topbar + content area
│       │   │   ├── Sidebar.tsx        # nav rail (expanded/minimized states)
│       │   │   ├── TopBar.tsx         # breadcrumb + context
│       │   │   └── ProjectScope.tsx   # current project indicator
│       │   ├── charts/
│       │   │   ├── TokenBarChart.tsx        # per-project token bars
│       │   │   ├── DailyCostChart.tsx       # line chart (hidden per DESIGN.md? No — shows token volume instead)
│       │   │   ├── TokenTrendChart.tsx      # real-time token trend
│       │   │   ├── ToolUsageChart.tsx       # tool call distribution
│       │   │   ├── CategoryPieChart.tsx     # file category breakdown
│       │   │   └── TimelineChart.tsx        # event timeline sparkline
│       │   ├── data/
│       │   │   ├── DataTable.tsx            # sortable, filterable table
│       │   │   ├── MetricCard.tsx           # label + value + optional delta
│       │   │   └── StatRow.tsx              # horizontal metric row
│       │   ├── cards/
│       │   │   ├── ProjectCard.tsx          # project summary card
│       │   │   └── SessionCard.tsx          # session summary card
│       │   ├── filters/
│       │   │   ├── ProjectFilter.tsx
│       │   │   ├── ClientFilter.tsx
│       │   │   └── DateRangeFilter.tsx
│       │   └── ui/
│       │       ├── Badge.tsx
│       │       ├── Button.tsx
│       │       ├── Select.tsx
│       │       ├── TabNav.tsx
│       │       └── Tooltip.tsx
│       └── pages/
│           ├── GlobalDashboard.tsx          # / — all projects overview
│           ├── ProjectsList.tsx              # /projects
│           ├── ProjectDetail.tsx             # /projects/:id
│           ├── Requests.tsx                  # /requests
│           ├── Tools.tsx                     # /tools
│           ├── Skills.tsx                    # /skills
│           ├── Sessions.tsx                  # /sessions
│           ├── Clients.tsx                   # /clients
│           ├── McpPlugins.tsx                # /mcp-plugins (MCP + plugin/hook tracking)
│           └── Settings.tsx                  # /settings
├── tests/
│   ├── test_dashboard.py                    # existing Playwright e2e (update for new URL)
│   └── pytest.ini
├── requirements.txt                        # top-level: only backend deps
├── DESIGN.md
├── CLAUDE.md
└── README.md
```

---

## 3. Architecture & Data Flow

```
┌─────────────────────────────────────────────────────┐
│                  React SPA (Vite + TS)                │
│  localhost:5173                                      │
│  Charts: Recharts (live-updating via WebSocket)      │
│  Styling: Tailwind CSS + custom components           │
└──────────┬──────────────────────────────────────────┘
           │ HTTP GET /api/*  │ WebSocket /ws/live
           ▼                  ▼
┌─────────────────────────────────────────────────────┐
│              FastAPI Backend (uvicorn)                │
│  localhost:8000                                      │
│  Routes: /api/usage, /api/projects, ...              │
│  WebSocket: /ws/live (pushes updated metrics)        │
└──────────┬──────────────────────────────────────────┘
           │ sqlite3
           ▼
┌─────────────────────────────────────────────────────┐
│           SQLite Database (~/.claude/telemetry/)     │
│  Tables: events, usage, tool_calls, tool_paths,      │
│          skill_events, attributions, reconcile_state │
│          mcp_servers (NEW)                           │
└─────────────────────────────────────────────────────┘
           ▲
           │ Polls every 5s
┌─────────────────────────────────────────────────────┐
│         Daemon (background thread / subprocess)       │
│  Reads ~/.claude/projects/**/*.jsonl                  │
│  Calls reconcile() → rebuild_attributions()          │
└─────────────────────────────────────────────────────┘
           ▲
           │ Hook fires
┌─────────────────────────────────────────────────────┐
│     Claude Code Hooks (SessionStart, PreToolUse...)  │
│  claude-telemetry-hook.py → collector.ingest()      │
└─────────────────────────────────────────────────────┘
```

### Data flow details

1. **Hook ingestion** (live): Claude Code fires hooks → `claude-telemetry-hook.py` (stdin) → `collector.ingest()` → `events` + `skill_events` tables. Retained as-is.

2. **Transcript reconciliation** (batch): `reconcile()` scans `~/.claude/projects/**/*.jsonl`, parses JSONL lines, inserts into `usage`, `tool_calls`, `tool_paths`, `skill_events`. Then `rebuild_attributions()` clears + repopulates `attributions`. Retained as-is, moved to `backend/app/services/`.

3. **REST API** (new): FastAPI reads from SQLite via raw SQL or Pydantic models. No ORM — queries are straightforward aggregations. Each route returns JSON.

4. **WebSocket live updates** (new): Frontend connects to `/ws/live`. Backend polls the latest `event_time` in `usage` table every 5s. When new data appears, pushes a compact JSON payload to all connected clients. React hook (`useLiveData`) merges into chart state.

5. **MCP + Plugin tracking** (new): Two new sources:
   - **MCP servers**: Extracted from `events` table where `tool_name` starts with `mcp_` or `event_type` contains `mcp`. Also new `mcp_servers` table if we want explicit registration.
   - **Plugins**: Extracted from `skill_events` where `plugin_name` is non-null, plus `events` with `agent_type` or hook event patterns.

---

## 4. Pages & Routes

### 4.1 Global Dashboard (`/`)

The landing page — unfiltered aggregate across all projects.

**Sections:**
- **Header**: "Claude Telemetry Enterprise" + breadcrumb "Global"
- **Top metric row** (5 cards): Exact API tokens, Input, Output, Cache read, Cache write (all formatted K/M/B)
- **Secondary stat row** (4 cards): Requests (total), Top Model, Top Client, Avg tokens/req
- **Token trend chart** (Recharts `LineChart`): Real-time updating line of total tokens over last 30 days (polls via WebSocket)
- **Usage by project** (Recharts `BarChart`): Top 20 projects by total tokens
- **Recent projects** (card grid + `DataTable`): Project name, last activity, total tokens, request count
- **Active sessions** (compact table): Ongoing sessions from last 24h

**Filters:** Project (dropdown), Client/IDE (dropdown), Date range (date picker) — all in sidebar

### 4.2 Projects List (`/projects`)

Grid of `ProjectCard` components, each showing:
- Project name + path
- Total tokens (formatted)
- Request count
- Last activity timestamp
- Model distribution (tiny stacked bar)
- Primary client

Click → navigates to `/projects/:id`

### 4.3 Project Detail (`/projects/:id`)

Scoped to one project. Breadcrumb: Global > Project Name.

**Sections:**
- **Project header**: Name, path, total tokens, request count, last reconciled
- **Metric cards** (5): Input/Output/Cache read/Cache write tokens for this project
- **Token trend** (LineChart): This project's daily token volume
- **Hotspots** (DataTable + BarChart): File categories with estimated token attribution
- **Top files/paths** (DataTable): Individual paths with estimated tokens
- **Tools used** (BarChart): Tool call frequency for this project
- **Skills invoked** (DataTable): Skill activation list scoped to project
- **Sessions** (DataTable): Sessions for this project

**Filters:** Client, Date range

### 4.4 Requests (`/requests`)

All API requests table with:
- Timestamp, session_id, model, tokens (input/output/cache), preview (truncated prompt/response)
- Sortable by any column
- Expandable row for full preview
- Filter by project, model, date

### 4.5 Tools (`/tools`)

Tool usage analytics:
- **Tool activity bar chart** (BarChart): Top tools by call count
- **Tool table** (DataTable): Tool name, call count, unique sessions, first/last used
- **Tool detail on click**: Opens drawer showing tool input examples, associated files/paths

### 4.6 Skills (`/skills`)

Skill invocation analytics:
- **Skill activity bar chart**: Top skills by activation count
- **Skill table**: Skill name, trigger type (tool/slash/auto), plugin_name, call count, last activated
- **Trigger distribution pie chart**: Slash command vs tool call vs auto-trigger breakdown
- **Recent skill activations** (DataTable): Last 200 with full context

### 4.7 Sessions (`/sessions`)

Session browser:
- Table with: Session ID, project, client, model, total tokens, cost, interactions, start/end time
- Click → expandable detail with per-request breakdown
- Filter by project, client, date range
- Active sessions highlighted with live badge

### 4.8 Clients (`/clients`)

Client/IDE breakdown:
- **Client distribution** (BarChart): Tokens by client
- **Client table**: Client name, projects, sessions, total tokens, top model
- Client detection heuristics shown as tags (VS Code, Cursor, JetBrains, Terminal/CLI)

### 4.9 MCP & Plugins (`/mcp-plugins`)

_Two sub-tabs within one page:_

**MCP Servers:**
- Table: MCP server name, tool count, call count, last used, associated project
- Source: Extracted from `events.tool_name` containing `mcp_` prefix and from explicit MCP tool calls
- Future-proof: Schema ready for `mcp_servers` table

**Plugins & Hooks:**
- Plugin invocations from `skill_events.plugin_name`
- Hook event counts by hook type (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop)
- Agent/subagent tracking from `events.agent_type`

### 4.10 Settings (`/settings`)

System configuration panel:
- **Database**: Path, size, table row counts
- **Daemon**: Status (running/stopped), poll interval, last reconcile time
- **Hooks**: Installed hook events list (from settings.json)
- **Environment**: CLAUDE_TELEMETRY_DB, CLAUDE_CONFIG_DIR, CLAUDE_TELEMETRY_INTERVAL
- **Reconcile**: Manual trigger button, last reconcile timestamp
- **Client detection**: Currently active client(s)

---

## 5. API Endpoints

All endpoints return JSON. Prefix: `/api/v1` for future-proofing.

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/summary | Global aggregate (tokens, requests, projects, clients) |
| GET | /api/v1/usage | Usage rows (paginated, filterable) |
| GET | /api/v1/usage/project/{id} | Usage scoped to project |
| GET | /api/v1/usage/timeline | Daily aggregated token counts (30 days) |
| GET | /api/v1/projects | Project list with aggregates |
| GET | /api/v1/projects/{id} | Single project detail |
| GET | /api/v1/projects/{id}/hotspots | Attribution by category for project |
| GET | /api/v1/projects/{id}/paths | Top paths for project |
| GET | /api/v1/tools | Tool stats |
| GET | /api/v1/skills | Skill invocation stats |
| GET | /api/v1/sessions | Session list |
| GET | /api/v1/sessions/{id} | Single session detail |
| GET | /api/v1/clients | Client breakdown |
| GET | /api/v1/events | Raw events (paginated) |
| GET | /api/v1/attributions | Attribution summary |
| GET | /api/v1/mcp | MCP server tracking |
| GET | /api/v1/plugins | Plugin/hook tracking |
| GET | /api/v1/settings | System settings + daemon status |
| POST | /api/v1/reconcile | Trigger manual reconcile |
| WS | /ws/live | Real-time metric updates |

### Response format

```json
{
  "data": { ... },
  "meta": {
    "total": 1234,
    "page": 1,
    "page_size": 100
  }
}
```

---

## 6. Database Changes

### New table: `mcp_servers`

```sql
CREATE TABLE IF NOT EXISTS mcp_servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_name TEXT NOT NULL,
  tool_name TEXT,
  session_id TEXT,
  project TEXT,
  call_count INTEGER DEFAULT 1,
  first_seen TEXT,
  last_seen TEXT,
  UNIQUE(server_name, session_id)
);
```

### New table: `hook_events`

```sql
CREATE TABLE IF NOT EXISTS hook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hook_name TEXT NOT NULL,
  session_id TEXT,
  project TEXT,
  event_time TEXT,
  duration_ms INTEGER,
  UNIQUE(session_id, hook_name, event_time)
);
```

These are populated during `reconcile()` and `collector.ingest()` by parsing existing payload data — no new data source needed.

---

## 7. TypeScript Interfaces

```typescript
interface UsageRow {
  id: number;
  event_time: string;
  session_id: string;
  project: string;
  client: string;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  cost_usd: number;
  context_window: number;
  max_output_tokens: number;
  prompt_preview: string;
  response_preview: string;
}

interface ProjectSummary {
  project: string;
  total_tokens: number;
  requests: number;
  sessions: number;
  clients: string[];
  models: string[];
  last_activity: string;
}

interface ToolCall {
  id: number;
  tool_name: string;
  call_count: number;
  unique_sessions: number;
  first_seen: string;
  last_seen: string;
}

interface SkillEvent {
  skill_name: string;
  trigger_type: string;
  plugin_name: string | null;
  call_count: number;
  last_activated: string;
}

interface McpServer {
  server_name: string;
  tool_name: string;
  call_count: number;
  last_seen: string;
}

interface LiveUpdate {
  type: 'metrics' | 'events' | 'reconcile';
  data: Record<string, number>;
  timestamp: string;
}
```

---

## 8. Design System Implementation

All tokens from DESIGN.md map to Tailwind CSS custom properties:

```css
/* tailwind.config.ts */
colors: {
  ink: '#111827',
  'ink-soft': '#475569',
  canvas: '#F6F8FB',
  surface: '#FFFFFF',
  'surface-muted': '#F1F5F9',
  line: '#DCE3EC',
  accent: '#6D5EF7',
  'accent-strong': '#5848E8',
  'accent-soft': '#EEEAFE',
  success: '#0F9D72',
  warning: '#C27A12',
  danger: '#C53D4B',
  info: '#2878C8',
  'on-accent': '#FFFFFF',
}
```

- Layout: 1440px working width, 24-32px gutters, 12-column grid
- Navigation: persistent left rail (76px minimized, ~240px expanded), persisted in localStorage
- Sidebar state: expanded/minimized toggle stored locally
- Cards: subtle 1px `line` border, bg `surface`, radius `rounded-lg` (14px)
- Tables: hover rows, sortable headers, compact density
- MetricCards: label (12px/600), value (26px/700), optional delta
- Tabs: switch analytical surface without navigating
- Charts: Recharts with DESIGN.md color palette (accent = violet series)
- Status: semantic colors only for badges/pills (green = healthy, amber = warning, red = error, blue = info)

---

## 9. Real-Time Updates

**WebSocket flow:**

1. Frontend connects to `ws://localhost:8000/ws/live`
2. Backend maintains a `Set[WebSocket]` of connected clients
3. Every 5 seconds, backend does: `SELECT MAX(event_time), SUM(total_tokens) FROM usage`
4. If values changed since last poll, broadcasts `LiveUpdate` JSON to all clients
5. Frontend `useLiveData` hook receives payload and merges into chart state
6. **Fallback**: If WebSocket fails, `useAutoRefresh` polls `/api/v1/usage/timeline` every 10s

**Charts that update in real-time:**
- GlobalDashboard: TokenTrendChart (30-day line)
- ProjectDetail: Project token trend
- Any page showing "last 24h" metrics

---

## 10. Guardrails

- **No file deletion without permission**: All existing `.py` files in `telemetry/` retained during migration. New `backend/` is additive. Old `telemetry/` dir removed only after user confirms.
- **Token optimization**: Backend routes use raw SQL with LIMIT, not pandas on full tables. Daemon uses same reconcile logic — no change.
- **Model selection**: FastAPI routes are light reads — no LLM calls. Frontend is static after build. Heavy work (reconcile) still runs as background process.
- **Data safety**: All DB writes only happen in reconcile/collector — API is read-only except POST /api/v1/reconcile.

---

## 11. Migration Path

1. Add `backend/` with FastAPI, copy existing logic, add new routes
2. Add `frontend/` with Vite + React, scaffold all pages
3. Run both servers simultaneously (backend :8000, frontend :5173)
4. Old `app.py` (Streamlit) remains functional during migration
5. Once frontend matches all Streamlit functionality, decommission `app.py`
6. Old `telemetry/` module files refactored into `backend/app/services/`

---

## 12. Implementation Order

1. Backend project skeleton (FastAPI, db connection, health check)
2. API routes: usage, projects, tools, skills, sessions, clients (read-only, no auth)
3. WebSocket live endpoint
4. Frontend project skeleton (Vite, Tailwind, Router, Layout)
5. Pages: GlobalDashboard, ProjectsList, ProjectDetail
6. Pages: Tools, Skills, Sessions, Clients
7. Pages: Requests, McpPlugins, Settings
8. Charts and real-time integration
9. MCP + Plugin extraction logic
10. Testing (Playwright e2e on new frontend)
11. Cleanup (decommission Streamlit app, finalize structure)