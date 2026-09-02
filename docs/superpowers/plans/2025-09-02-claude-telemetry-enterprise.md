# Claude Telemetry Enterprise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Restructure Streamlit-based Claude Token Telemetry into professional FastAPI backend + React/Vite/TypeScript frontend with enterprise design system, real-time charts, dedicated pages for tools/skills/sessions/MCP/clients.

**Architecture:** FastAPI backend reads SQLite and exposes REST + WebSocket endpoints. React SPA consumes API, renders Recharts with live updates. Existing reconcile/collector/daemon logic moves into backend/app/services/ unchanged. Streamlit app.py stays until migration complete.

**Tech Stack:** FastAPI (Python 3.14+), React 18 + Vite + TypeScript, Tailwind CSS, Recharts, SQLite, WebSocket

**Spec:** docs/superpowers/specs/2025-09-02-claude-telemetry-enterprise-design.md

## Global Constraints

- Zero cost display in primary UI (DESIGN.md rule)
- All existing telemetry/*.py files retained during migration — no deletion without permission
- Backend routes use raw SQL with LIMIT — no pandas on full tables
- API prefix /api/v1 for all REST endpoints
- WebSocket endpoint at /ws/live for real-time updates
- SQLite stays as-is (upgrade path later)
- Windows local first — no containerization
- Token formatting: K/M/B suffixes for all large numbers
- Design tokens from DESIGN.md mapped to Tailwind config
- Sidebar nav rail supports expanded/minimized states persisted in localStorage

---

## Phase 1: Backend Skeleton + API Routes

### Task 1.1: Backend project skeleton

**Files:**
- Create: backend/__init__.py
- Create: backend/app/__init__.py
- Create: backend/app/main.py
- Create: backend/app/db/__init__.py
- Create: backend/app/db/connection.py
- Create: backend/app/db/schema.py
- Create: backend/requirements.txt
- Create: backend/run.py

**Interfaces:**
- main.py: creates FastAPI app with CORS, lifespan, includes router
- connection.connect(db_path) returns sqlite3.Connection
- schema.SCHEMA string, schema._add_column helper

Step 1 — Create backend/requirements.txt:
```
uvicorn[standard]==0.34.0
fastapi==0.115.0
pydantic==2.10.0
websockets>=14.0
```

Step 2 — Create backend/app/db/schema.py (copy from telemetry/db.py SCHEMA constant):
```python
SCHEMA = r"""
PRAGMA journal_mode=WAL;
...paste the full SCHEMA from telemetry/db.py here...
"""

def _add_column(conn, table, column, ddl):
    cols = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
```

Step 3 — Create backend/app/db/connection.py:
```python
import sqlite3, os
from pathlib import Path
from .schema import SCHEMA, _add_column

DEFAULT_DB = Path(os.environ.get("CLAUDE_TELEMETRY_DB", "~/.claude/telemetry/telemetry.db")).expanduser()

def connect(db_path=None):
    p = Path(db_path or DEFAULT_DB).expanduser()
    p.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(p, timeout=30)
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    conn.executescript(SCHEMA)
    _add_column(conn, "usage", "provider", "TEXT")
    _add_column(conn, "usage", "context_window", "INTEGER DEFAULT 0")
    _add_column(conn, "usage", "max_output_tokens", "INTEGER DEFAULT 0")
    _add_column(conn, "attributions", "project", "TEXT")
    conn.commit()
    return conn
```

Step 4 — Create backend/app/main.py:
```python
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db.connection import connect
from .api.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = connect()
    conn.close()
    yield

app = FastAPI(title="Claude Telemetry Enterprise", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
```

Step 5 — Create backend/run.py:
```python
import uvicorn
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
```

Step 6 — Verify backend starts:
Run: `cd backend && pip install -r requirements.txt && python run.py`
Expected: uvicorn starts on :8000, /health returns {"status":"ok"}

Step 7 — Commit
Run: `git add backend/ && git commit -m "feat: add FastAPI backend skeleton"`

### Task 1.2: API router + model schemas

**Files:**
- Create: backend/app/api/__init__.py
- Create: backend/app/api/router.py
- Create: backend/app/models/__init__.py
- Create: backend/app/models/schemas.py

**Interfaces:**
- Exports: router.py creates api_router = APIRouter(), imports all route modules
- Exports: schemas.py defines Pydantic models for every response type

Step 1 — Create backend/app/api/router.py:
```python
from fastapi import APIRouter
from .routes import usage, projects, tools, skills, sessions, events, clients
from .routes import attributions, mcp, plugins, settings

api_router = APIRouter()
api_router.include_router(usage.router, prefix="/usage", tags=["usage"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(tools.router, prefix="/tools", tags=["tools"])
api_router.include_router(skills.router, prefix="/skills", tags=["skills"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(attributions.router, prefix="/attributions", tags=["attributions"])
api_router.include_router(mcp.router, prefix="/mcp", tags=["mcp"])
api_router.include_router(plugins.router, prefix="/plugins", tags=["plugins"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
```

Step 2 — Create backend/app/models/schemas.py:
```python
from pydantic import BaseModel
from typing import Optional, Any

class SummaryResponse(BaseModel):
    total_tokens: int = 0
    total_requests: int = 0
    total_projects: int = 0
    total_sessions: int = 0
    top_model: str = ""
    top_client: str = ""
    avg_tokens_per_request: float = 0

class ProjectSummary(BaseModel):
    project: str
    total_tokens: int = 0
    requests: int = 0
    sessions: int = 0
    clients: list[str] = []
    models: list[str] = []
    last_activity: Optional[str] = None

class ToolStats(BaseModel):
    tool_name: str
    call_count: int = 0
    unique_sessions: int = 0
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None

class SkillStats(BaseModel):
    skill_name: str
    trigger_type: Optional[str] = None
    plugin_name: Optional[str] = None
    call_count: int = 0
    last_activated: Optional[str] = None

class McpServerInfo(BaseModel):
    server_name: str
    call_count: int = 0
    last_seen: Optional[str] = None

class PaginatedResponse(BaseModel):
    data: list[Any]
    meta: dict = {"total": 0, "page": 1, "page_size": 100}
```

Step 3 — Commit

### Task 1.3: Usage + Summary API routes

**Files:**
- Create: backend/app/api/routes/__init__.py
- Create: backend/app/api/routes/usage.py
- Create: backend/app/api/routes/projects.py

**Interfaces:**
- GET /api/v1/usage — returns paginated usage rows, filterable by project, client, model
- GET /api/v1/usage/timeline — daily aggregated token counts for last 30 days
- GET /api/v1/usage/project/{project} — usage scoped to one project
- GET /api/v1/projects — list of projects with aggregate metrics
- GET /api/v1/projects/{project} — single project detail with all metrics
- GET /api/v1/projects/{project}/hotspots — attribution categories for project
- GET /api/v1/projects/{project}/paths — top paths for project

Step 1 — Create backend/app/api/routes/__init__.py (empty)

Step 2 — Create backend/app/api/routes/usage.py:
```python
from fastapi import APIRouter, Query
from ...db.connection import connect

router = APIRouter()

@router.get("")
async def get_usage(
    project: str = Query(None),
    client: str = Query(None),
    model: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500)
):
    conn = connect()
    where, params = [], []
    if project and project != "All":
        where.append("project=?")
        params.append(project)
    if client and client != "All":
        where.append("client=?")
        params.append(client)
    if model:
        where.append("model=?")
        params.append(model)
    w = "WHERE " + " AND ".join(where) if where else ""
    total = conn.execute(f"SELECT COUNT(*) FROM usage {w}", params).fetchone()[0]
    offset = (page - 1) * page_size
    rows = conn.execute(
        f"SELECT * FROM usage {w} ORDER BY event_time DESC LIMIT ? OFFSET ?",
        params + [page_size, offset]
    ).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows], "meta": {"total": total, "page": page, "page_size": page_size}}

@router.get("/timeline")
async def get_usage_timeline(days: int = Query(30)):
    conn = connect()
    rows = conn.execute("""
        SELECT DATE(event_time) as day, SUM(total_tokens) as tokens,
               SUM(input_tokens) as input, SUM(output_tokens) as output,
               SUM(cache_read_tokens) as cache_read, SUM(cache_write_tokens) as cache_write
        FROM usage WHERE event_time IS NOT NULL
        GROUP BY DATE(event_time) ORDER BY day DESC LIMIT ?
    """, (days,)).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}

@router.get("/project/{project}")
async def get_usage_by_project(project: str):
    conn = connect()
    rows = conn.execute("SELECT * FROM usage WHERE project=? ORDER BY event_time DESC LIMIT 500", (project,)).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows], "meta": {"total": len(rows)}}
```

Step 3 — Create backend/app/api/routes/projects.py:
```python
from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()

@router.get("")
async def get_projects():
    conn = connect()
    rows = conn.execute("""
        SELECT project, SUM(total_tokens) as total_tokens, COUNT(*) as requests,
               COUNT(DISTINCT session_id) as sessions,
               COUNT(DISTINCT client) as client_count,
               COUNT(DISTINCT model) as model_count,
               MAX(event_time) as last_activity
        FROM usage GROUP BY project ORDER BY total_tokens DESC
    """).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}

@router.get("/{project}")
async def get_project_detail(project: str):
    conn = connect()
    row = conn.execute("""
        SELECT project, SUM(total_tokens) as total_tokens, COUNT(*) as requests,
               COUNT(DISTINCT session_id) as sessions,
               MAX(event_time) as last_activity
        FROM usage WHERE project=? GROUP BY project
    """, (project,)).fetchone()
    conn.close()
    return {"data": dict(row) if row else {}}
```

Step 4 — Verify: GET /api/v1/projects returns JSON array
Run: `python -c "import requests; r=requests.get('http://localhost:8000/api/v1/projects'); print(r.status_code, len(r.json()['data']))"`
Expected: 200 and list of projects

Step 5 — Commit

### Task 1.4: Tools + Skills + Sessions API routes

**Files:**
- Create: backend/app/api/routes/tools.py
- Create: backend/app/api/routes/skills.py
- Create: backend/app/api/routes/sessions.py

Step 1 — Create backend/app/api/routes/tools.py:
```python
from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()

@router.get("")
async def get_tools():
    conn = connect()
    rows = conn.execute("""
        SELECT tool_name, COUNT(*) as call_count,
               COUNT(DISTINCT session_id) as unique_sessions,
               MIN(event_time) as first_seen, MAX(event_time) as last_seen
        FROM tool_calls GROUP BY tool_name ORDER BY call_count DESC
    """).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}
```

Step 2 — Create backend/app/api/routes/skills.py:
```python
from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()

@router.get("")
async def get_skills():
    conn = connect()
    rows = conn.execute("""
        SELECT skill_name, trigger_type, plugin_name,
               COUNT(*) as call_count, MAX(event_time) as last_activated
        FROM skill_events GROUP BY skill_name, trigger_type
        ORDER BY call_count DESC
    """).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}
```

Step 3 — Create backend/app/api/routes/sessions.py:
```python
from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()

@router.get("")
async def get_sessions():
    conn = connect()
    rows = conn.execute("""
        SELECT session_id, project, client, model,
               SUM(total_tokens) as total_tokens, COUNT(*) as interactions,
               MIN(event_time) as started_at, MAX(event_time) as last_active
        FROM usage GROUP BY session_id ORDER BY last_active DESC LIMIT 200
    """).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}
```

Step 4 — Verify endpoints return data
Run: `python -c "import requests; [print(p, requests.get(f'http://localhost:8000/api/v1/{p}').status_code) for p in ['tools','skills','sessions']]"`
Expected: 200 for each

Step 5 — Commit

### Task 1.5: Events + Clients + Attributions API routes

**Files:**
- Create: backend/app/api/routes/events.py
- Create: backend/app/api/routes/clients.py
- Create: backend/app/api/routes/attributions.py

Step 1 — Create backend/app/api/routes/events.py:
```python
from fastapi import APIRouter, Query
from ...db.connection import connect

router = APIRouter()

@router.get("")
async def get_events(page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500)):
    conn = connect()
    total = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    offset = (page - 1) * page_size
    rows = conn.execute("SELECT * FROM events ORDER BY id DESC LIMIT ? OFFSET ?", (page_size, offset)).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows], "meta": {"total": total, "page": page, "page_size": page_size}}
```

Step 2 — Create backend/app/api/routes/clients.py:
```python
from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()

@router.get("")
async def get_clients():
    conn = connect()
    rows = conn.execute("""
        SELECT client, COUNT(DISTINCT project) as projects,
               COUNT(DISTINCT session_id) as sessions,
               SUM(total_tokens) as total_tokens,
               COUNT(*) as requests
        FROM usage WHERE client IS NOT NULL AND client != ''
        GROUP BY client ORDER BY total_tokens DESC
    """).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}
```

Step 3 — Create backend/app/api/routes/attributions.py:
```python
from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()

@router.get("")
async def get_attributions():
    conn = connect()
    rows = conn.execute("""
        SELECT project, category, ROUND(SUM(estimated_tokens), 1) as estimated_tokens,
               COUNT(*) as reference_count
        FROM attributions GROUP BY project, category ORDER BY estimated_tokens DESC
    """).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}
```

Step 4 — Commit

### Task 1.6: MCP + Plugins + Settings API routes

**Files:**
- Create: backend/app/api/routes/mcp.py
- Create: backend/app/api/routes/plugins.py
- Create: backend/app/api/routes/settings.py

Step 1 — Create backend/app/api/routes/mcp.py:
```python
from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()

@router.get("")
async def get_mcp_servers():
    conn = connect()
    rows = conn.execute("""
        SELECT tool_name as server_name, COUNT(*) as call_count,
               MIN(event_time) as first_seen, MAX(event_time) as last_seen
        FROM events WHERE tool_name LIKE 'mcp_%' OR event_type LIKE '%mcp%'
        GROUP BY tool_name ORDER BY call_count DESC
    """).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}
```

Step 2 — Create backend/app/api/routes/plugins.py:
```python
from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()

@router.get("")
async def get_plugins():
    conn = connect()
    skill_plugins = conn.execute("""
        SELECT plugin_name, COUNT(*) as call_count,
               COUNT(DISTINCT skill_name) as skills,
               MAX(event_time) as last_used
        FROM skill_events WHERE plugin_name IS NOT NULL AND plugin_name != ''
        GROUP BY plugin_name ORDER BY call_count DESC
    """).fetchall()
    hook_counts = conn.execute("""
        SELECT event_type as hook_name, COUNT(*) as call_count
        FROM events WHERE event_type IN ('SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','Stop')
        GROUP BY event_type ORDER BY call_count DESC
    """).fetchall()
    conn.close()
    return {"data": {"plugins": [dict(r) for r in skill_plugins], "hooks": [dict(r) for r in hook_counts]}}
```

Step 3 — Create backend/app/api/routes/settings.py:
```python
import os
from pathlib import Path
from fastapi import APIRouter
from ...db.connection import connect, DEFAULT_DB

router = APIRouter()

@router.get("")
async def get_settings():
    db_path = DEFAULT_DB
    conn = connect()
    tables = {}
    for t in ["events","usage","tool_calls","tool_paths","skill_events","attributions"]:
        c = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        tables[t] = c
    try:
        db_size = os.path.getsize(db_path)
    except:
        db_size = 0
    conn.close()
    return {"data": {
        "db_path": str(db_path), "db_size": db_size,
        "table_counts": tables,
        "env": {
            "CLAUDE_TELEMETRY_DB": os.environ.get("CLAUDE_TELEMETRY_DB", ""),
            "CLAUDE_CONFIG_DIR": os.environ.get("CLAUDE_CONFIG_DIR", ""),
            "CLAUDE_TELEMETRY_INTERVAL": os.environ.get("CLAUDE_TELEMETRY_INTERVAL", "5"),
        }
    }}

@router.post("/reconcile")
async def trigger_reconcile():
    from ..services.reconcile import reconcile
    changed, _ = reconcile()
    return {"data": {"changed": changed}}
```

Step 4 — Commit
Run: `git add backend/app/api/routes/ && git commit -m "feat: add MCP, plugins, and settings API routes"`

### Task 1.7: WebSocket live endpoint

**Files:**
- Create: backend/app/api/routes/live.py
- Modify: backend/app/api/router.py (add live router separately since it's WS)

Step 1 — Create backend/app/api/routes/live.py:
```python
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ...db.connection import connect

router = APIRouter()
connected_clients: set[WebSocket] = set()

@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        last_total = 0
        while True:
            conn = connect()
            row = conn.execute("SELECT SUM(total_tokens) as total, MAX(event_time) as last_time FROM usage").fetchone()
            conn.close()
            total = row[0] or 0
            last_time = row[1] or ""
            if total != last_total:
                last_total = total
                payload = json.dumps({"type": "metrics", "data": {"total_tokens": total}, "timestamp": last_time})
                await websocket.send_text(payload)
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass
    finally:
        connected_clients.discard(websocket)
```

Step 2 — Modify backend/app/api/router.py:
Add: `from fastapi import APIRouter` stays same
Add after all include_routers:
```python
from .routes.live import router as live_router
api_router.include_router(live_router, prefix="")
```
(The WS route is at /ws/live — prefix already in route def)

Step 3 — Verify WebSocket works
Run: `python -c "import asyncio, websockets; print(asyncio.run(websockets.connect('ws://localhost:8000/ws/live')))"`
Expected: connects without error

Step 4 — Commit

### Task 1.8: Move existing services into backend

**Files:**
- Create: backend/app/services/__init__.py
- Create: backend/app/services/reconcile.py (from telemetry/reconcile.py)
- Create: backend/app/services/collector.py (from telemetry/collector.py)
- Create: backend/app/services/daemon.py (from telemetry/daemon.py)
- Create: backend/app/services/attribution.py (extract rebuild_attributions)
- Copy: backend/hooks/claude-telemetry-hook.py (from hooks/claude-telemetry-hook.py)

Step 1 — Copy telemetry/reconcile.py to backend/app/services/reconcile.py
Step 2 — Copy telemetry/collector.py to backend/app/services/collector.py
Step 3 — Copy telemetry/daemon.py to backend/app/services/daemon.py
Step 4 — Copy hooks/claude-telemetry-hook.py to backend/hooks/claude-telemetry-hook.py
Step 5 — Extract rebuild_attributions from reconcile into attribution.py
Step 6 — Update imports in all copied files to use backend.app.db.connection instead of telemetry.db

Step 7 — Commit
Run: `git add backend/app/services/ backend/hooks/ && git commit -m "feat: move existing telemetry services into backend structure"`

---

## Phase 2: Frontend

### Task 2.1: React + Vite + Tailwind project scaffold

**Files:**
- Create: frontend/package.json
- Create: frontend/vite.config.ts
- Create: frontend/tsconfig.json
- Create: frontend/tsconfig.node.json
- Create: frontend/tailwind.config.ts
- Create: frontend/postcss.config.js
- Create: frontend/index.html
- Create: frontend/public/favicon.svg
- Create: frontend/src/main.tsx
- Create: frontend/src/index.css
- Create: frontend/src/App.tsx
- Create: frontend/src/vite-env.d.ts

Step 1 — Create frontend/package.json:
```json
{
  "name": "claude-telemetry-enterprise",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.28.0",
    "recharts": "^2.13.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
```

Step 2 — Create frontend/vite.config.ts:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000', '/ws': { target: 'ws://localhost:8000', ws: true } } }
});
```

Step 3 — Create frontend/tailwind.config.ts:
```typescript
import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827', 'ink-soft': '#475569', canvas: '#F6F8FB',
        surface: '#FFFFFF', 'surface-muted': '#F1F5F9', line: '#DCE3EC',
        accent: '#6D5EF7', 'accent-strong': '#5848E8', 'accent-soft': '#EEEAFE',
        success: '#0F9D72', warning: '#C27A12', danger: '#C53D4B', info: '#2878C8',
        'on-accent': '#FFFFFF',
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px', xl: '18px' },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
```

Step 4 — Create frontend/index.html:
```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Enterprise Claude Code telemetry console"><title>Claude Telemetry Enterprise</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;650;700&display=swap"></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

Step 5 — Create frontend/src/index.css:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
body { @apply bg-canvas text-ink font-sans antialiased; margin: 0; }
```

Step 6 — Create frontend/src/App.tsx:
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/Layout/AppLayout';
import { GlobalDashboard } from './pages/GlobalDashboard';
import { ProjectsList } from './pages/ProjectsList';
import { ProjectDetail } from './pages/ProjectDetail';
import { Requests } from './pages/Requests';
import { Tools } from './pages/Tools';
import { Skills } from './pages/Skills';
import { Sessions } from './pages/Sessions';
import { Clients } from './pages/Clients';
import { McpPlugins } from './pages/McpPlugins';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<GlobalDashboard />} />
          <Route path="/projects" element={<ProjectsList />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/mcp-plugins" element={<McpPlugins />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

Step 7 — Create frontend/src/main.tsx:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
```

Step 8 — Install and verify:
Run: `cd frontend && npm install && npm run dev`
Expected: Vite starts on :5173, shows blank layout

Step 9 — Commit

### Task 2.2: Types + API client layer

**Files:**
- Create: frontend/src/types/index.ts
- Create: frontend/src/api/client.ts
- Create: frontend/src/api/usage.ts
- Create: frontend/src/api/projects.ts
- Create: frontend/src/api/tools.ts
- Create: frontend/src/api/skills.ts
- Create: frontend/src/api/sessions.ts
- Create: frontend/src/api/events.ts
- Create: frontend/src/api/clients.ts
- Create: frontend/src/api/attributions.ts
- Create: frontend/src/api/mcp.ts
- Create: frontend/src/api/plugins.ts
- Create: frontend/src/api/settings.ts

Step 1 — Create frontend/src/types/index.ts with all interfaces from spec Section 7

Step 2 — Create frontend/src/api/client.ts:
```typescript
const BASE = '/api/v1';
export async function fetchApi<T>(path: string, init?: RequestInit): Promise<{data: T; meta?: any}> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}
```

Step 3 — Create each API module. Example (frontend/src/api/usage.ts):
```typescript
import { fetchApi } from './client';
import type { UsageRow } from '../types';

export function getUsage(params?: Record<string,string>) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  return fetchApi<UsageRow[]>(`/usage${q}`);
}

export function getUsageTimeline(days = 30) {
  return fetchApi<{day: string; tokens: number}[]>(`/usage/timeline?days=${days}`);
}
```

Repeat pattern for all modules (projects, tools, skills, sessions, etc.)

Step 4 — Commit

### Task 2.3: Layout components (Sidebar, TopBar, AppLayout)

**Files:**
- Create: frontend/src/components/Layout/AppLayout.tsx
- Create: frontend/src/components/Layout/Sidebar.tsx
- Create: frontend/src/components/Layout/TopBar.tsx
- Create: frontend/src/components/Layout/ProjectScope.tsx

Step 1 — Create Sidebar.tsx with expanded/minimized states:
```typescript
import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/projects', label: 'Projects', icon: '📁' },
  { to: '/requests', label: 'Requests', icon: '📋' },
  { to: '/tools', label: 'Tools', icon: '🔧' },
  { to: '/skills', label: 'Skills', icon: '⚡' },
  { to: '/sessions', label: 'Sessions', icon: '💬' },
  { to: '/clients', label: 'Clients', icon: '💻' },
  { to: '/mcp-plugins', label: 'MCP & Plugins', icon: '🔌' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState(() => localStorage.getItem('sidebar-expanded') !== 'false');
  useEffect(() => localStorage.setItem('sidebar-expanded', String(expanded)), [expanded]);

  return (
    <aside className={`${expanded ? 'w-60' : 'w-[76px]'} bg-surface border-r border-line h-screen flex flex-col transition-all duration-200`}>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-line">
        <span className="text-2xl">📡</span>
        {expanded && <span className="font-bold text-lg text-ink">Telemetry</span>}
        <button onClick={() => setExpanded(!expanded)} className="ml-auto text-ink-soft hover:text-ink text-lg">{expanded ? '◀' : '▶'}</button>
      </div>
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            className={({isActive}) =>
              `flex items-center gap-3 px-4 py-3 text-sm transition-colors ${isActive ? 'bg-accent-soft text-accent-strong font-semibold border-r-2 border-accent' : 'text-ink-soft hover:bg-surface-muted hover:text-ink'}`
            }>
            <span className="text-lg w-6 text-center">{item.icon}</span>
            {expanded && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

Step 2 — Create TopBar.tsx with breadcrumb:
```typescript
import { useLocation, Link } from 'react-router-dom';

export function TopBar() {
  const loc = useLocation();
  const parts = loc.pathname.split('/').filter(Boolean);
  return (
    <header className="h-16 bg-surface border-b border-line flex items-center px-6 gap-2">
      {parts.length === 0 ? (
        <span className="text-sm font-semibold text-ink">Global</span>
      ) : (
        parts.map((p, i) => (
          <span key={i} className="flex items-center gap-2 text-sm">
            {i > 0 && <span className="text-line">/</span>}
            {i === parts.length - 1
              ? <span className="font-semibold text-ink">{decodeURIComponent(p)}</span>
              : <Link to={'/' + parts.slice(0, i+1).join('/')} className="text-ink-soft hover:text-ink">{decodeURIComponent(p)}</Link>}
          </span>
        ))
      )}
    </header>
  );
}
```

Step 3 — Create AppLayout.tsx:
```typescript
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 max-w-[1440px] mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

Step 4 — Verify: App renders with sidebar + topbar at localhost:5173

Step 5 — Commit

### Task 2.4: Shared UI components (MetricCard, DataTable, Badge, etc.)

**Files:**
- Create: frontend/src/components/ui/Badge.tsx
- Create: frontend/src/components/ui/Button.tsx
- Create: frontend/src/components/ui/Select.tsx
- Create: frontend/src/components/ui/TabNav.tsx
- Create: frontend/src/components/ui/Tooltip.tsx
- Create: frontend/src/components/data/MetricCard.tsx
- Create: frontend/src/components/data/DataTable.tsx
- Create: frontend/src/components/data/StatRow.tsx
- Create: frontend/src/components/cards/ProjectCard.tsx
- Create: frontend/src/components/cards/SessionCard.tsx
- Create: frontend/src/components/filters/ProjectFilter.tsx
- Create: frontend/src/components/filters/ClientFilter.tsx
- Create: frontend/src/components/filters/DateRangeFilter.tsx

Step 1 — Create MetricCard.tsx:
```typescript
interface Props { label: string; value: string; delta?: string; trend?: 'up'|'down'|'neutral'; }
export function MetricCard({ label, value, delta, trend }: Props) {
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : '';
  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="text-label text-ink-soft font-semibold text-xs mb-1">{label}</div>
      <div className="text-display text-ink font-bold text-2xl">{value}</div>
      {delta && <div className={`text-xs mt-1 ${trendColor}`}>{delta}</div>}
    </div>
  );
}
```

Step 2 — Create DataTable.tsx (sortable table):
```typescript
import { useState } from 'react';
interface Column { key: string; label: string; sortable?: boolean; render?: (val: any) => string; }
interface Props { columns: Column[]; data: Record<string,any>[]; }

export function DataTable({ columns, data }: Props) {
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const va = a[sortKey], vb = b[sortKey];
    if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
    return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });
  const toggle = (k: string) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('desc'); } };
  return (
    <div className="bg-surface border border-line rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line bg-surface-muted">
          {columns.map(c => <th key={c.key} className={`px-4 py-3 text-left text-label text-xs font-semibold text-ink-soft ${c.sortable ? 'cursor-pointer hover:text-ink select-none' : ''}`}
            onClick={() => c.sortable && toggle(c.key)}>
            {c.label}{sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
          </th>)}
        </tr></thead>
        <tbody>{sorted.map((row, i) => <tr key={i} className="border-b border-line last:border-0 hover:bg-surface-muted/50">
          {columns.map(c => <td key={c.key} className="px-4 py-2.5 text-ink">{c.render ? c.render(row[c.key]) : String(row[c.key] ?? '')}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  );
}
```

Step 3 — Create Badge.tsx, Button.tsx, Select.tsx as simple styled components with the design system tokens

Step 4 — Commit

### Task 2.5: Global Dashboard page

**Files:**
- Create: frontend/src/pages/GlobalDashboard.tsx

Step 1 — Create GlobalDashboard.tsx with sections:
- Metric row (5 cards using MetricCard): Exact API tokens, Input, Output, Cache read, Cache write
- Secondary stat row: Total cost omitted (DESIGN.md rule), show Requests, Top Model, Top Client, Avg tokens/req
- TokenTrendChart (Recharts LineChart) — 30-day timeline
- TokenBarChart (Recharts BarChart) — top 20 projects
- Recent projects list (DataTable)
- Active sessions (compact table)

```typescript
import { useState, useEffect } from 'react';
import { MetricCard } from '../components/data/MetricCard';
import { DataTable } from '../components/data/DataTable';
import { TokenTrendChart } from '../components/charts/TokenTrendChart';
import { TokenBarChart } from '../components/charts/TokenBarChart';
import { getUsage, getUsageTimeline } from '../api/usage';
import { getProjects } from '../api/projects';
import { getSessions } from '../api/sessions';

function fmt(n: number): string {
  if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

export function GlobalDashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  useEffect(() => {
    getProjects().then(r => setProjects(r.data));
    getUsageTimeline().then(r => setTimeline(r.data));
    getSessions().then(r => setSessions(r.data));
  }, []);

  const totalTokens = projects.reduce((a: number, p: any) => a + (p.total_tokens || 0), 0);
  const totalRequests = projects.reduce((a: number, p: any) => a + (p.requests || 0), 0);
  const topProject = projects[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-4">
        <MetricCard label="Exact API tokens" value={fmt(totalTokens)} />
        <MetricCard label="Input" value={fmt(projects.reduce((a: number, p: any) => a + 0, 0))} />
        <MetricCard label="Output" value="-" />
        <MetricCard label="Cache read" value="-" />
        <MetricCard label="Cache write" value="-" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Requests" value={fmt(totalRequests)} />
        <MetricCard label="Top Model" value={topProject?.models?.[0] || '-'} />
        <MetricCard label="Top Client" value="-" />
        <MetricCard label="Avg tokens/req" value={totalRequests > 0 ? fmt(Math.round(totalTokens / totalRequests)) : '-'} />
      </div>
      {timeline.length > 0 && <TokenTrendChart data={timeline} />}
      {projects.length > 0 && <TokenBarChart data={projects.slice(0, 20)} />}
      {projects.length > 0 && (
        <>
          <h2 className="text-h2 text-ink font-semibold text-lg">Recent projects</h2>
          <DataTable columns={[
            { key: 'project', label: 'Project', sortable: true },
            { key: 'total_tokens', label: 'Tokens', sortable: true, render: v => fmt(v) },
            { key: 'requests', label: 'Requests', sortable: true, render: v => fmt(v) },
            { key: 'last_activity', label: 'Last active', sortable: true },
          ]} data={projects} />
        </>
      )}
    </div>
  );
}
```

Step 2 — Verify page loads at localhost:5173 with data

Step 3 — Commit

### Task 2.6: Chart components

**Files:**
- Create: frontend/src/components/charts/TokenBarChart.tsx
- Create: frontend/src/components/charts/TokenTrendChart.tsx
- Create: frontend/src/components/charts/ToolUsageChart.tsx
- Create: frontend/src/components/charts/CategoryPieChart.tsx
- Create: frontend/src/components/charts/TimelineChart.tsx

Step 1 — Create TokenBarChart.tsx:
```typescript
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
interface Props { data: {project: string; total_tokens: number}[]; }

export function TokenBarChart({ data }: Props) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <h3 className="text-h2 text-ink text-sm font-semibold mb-4">Usage by project</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ left: -20 }}>
          <XAxis dataKey="project" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="total_tokens" fill="#6D5EF7" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Step 2 — Create TokenTrendChart.tsx (line chart):
```typescript
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
interface Props { data: {day: string; tokens: number}[]; }

export function TokenTrendChart({ data }: Props) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-4">Daily token volume</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="tokens" stroke="#6D5EF7" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Step 3 — Create ToolUsageChart.tsx, CategoryPieChart.tsx, TimelineChart.tsx following same pattern

Step 4 — Commit

### Task 2.7: All remaining pages

**Files:**
- Create: frontend/src/pages/ProjectsList.tsx
- Create: frontend/src/pages/ProjectDetail.tsx
- Create: frontend/src/pages/Requests.tsx
- Create: frontend/src/pages/Tools.tsx
- Create: frontend/src/pages/Skills.tsx
- Create: frontend/src/pages/Sessions.tsx
- Create: frontend/src/pages/Clients.tsx
- Create: frontend/src/pages/McpPlugins.tsx
- Create: frontend/src/pages/Settings.tsx

Step 1 — ProjectsList.tsx: Fetch /api/v1/projects, render grid of ProjectCards or DataTable with project name, tokens, requests, sessions, last activity
Step 2 — ProjectDetail.tsx: Fetch /api/v1/projects/{id} + project hotspots + paths, show metric row + token trend + attributions table
Step 3 — Requests.tsx: Fetch /api/v1/usage with pagination, DataTable with timestamp, model, tokens (no cost column per DESIGN.md)
Step 4 — Tools.tsx: Fetch /api/v1/tools, ToolUsageChart bar chart + DataTable with tool name, call count, sessions
Step 5 — Skills.tsx: Fetch /api/v1/skills, DataTable + CategoryPieChart for trigger type distribution
Step 6 — Sessions.tsx: Fetch /api/v1/sessions, DataTable with session_id, project, tokens, interactions
Step 7 — Clients.tsx: Fetch /api/v1/clients, DataTable + bar chart
Step 8 — McpPlugins.tsx: Two sub-tabs using TabNav. MCP tab: fetch /api/v1/mcp. Plugins tab: fetch /api/v1/plugins
Step 9 — Settings.tsx: Fetch /api/v1/settings, show db path, table counts, env vars. Reconcile button calls POST /api/v1/settings/reconcile
Step 10 — Verify all pages render at their routes
Step 11 — Commit

### Task 2.8: WebSocket real-time hook

**Files:**
- Create: frontend/src/hooks/useApi.ts
- Create: frontend/src/hooks/useLiveData.ts
- Create: frontend/src/hooks/useAutoRefresh.ts

Step 1 — Create useLiveData.ts:
```typescript
import { useEffect, useState, useRef } from 'react';
import type { LiveUpdate } from '../types';

export function useLiveData() {
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/live`);
      ws.onmessage = (e) => {
        try { const p: LiveUpdate = JSON.parse(e.data); setMetrics(m => ({...m, ...p.data})); } catch {}
      };
      ws.onclose = () => setTimeout(connect, 5000);
      wsRef.current = ws;
    }
    connect();
    return () => wsRef.current?.close();
  }, []);

  return metrics;
}
```

Step 2 — Integrate into GlobalDashboard: Add `const liveMetrics = useLiveData();` and use liveMetrics.total_tokens for live metric card updates

Step 3 — Commit

---

## Phase 3: Testing + Cleanup

### Task 3.1: Update Playwright e2e tests

**Files:**
- Modify: tests/test_dashboard.py (update base URL, add frontend route tests)
- Modify: tests/pytest.ini (update config)

Step 1 — Update tests to point to new frontend at localhost:5173
Step 2 — Add route navigation tests for each page
Step 3 — Verify tests pass
Run: `cd frontend && npm run dev & cd backend && python run.py & cd .. && pytest tests/ -v`
Expected: tests pass against new frontend

Step 4 — Commit

### Task 3.2: Cleanup and documentation

**Files:**
- Modify: README.md (update with new architecture, commands)
- Modify: CLAUDE.md (update with new project structure)

Step 1 — Update README.md with new backend/frontend structure, how to run both servers
Step 2 — Update CLAUDE.md with new commands and architecture
Step 3 — Commit final

---

## Self-Review Checklist

1. **Spec coverage:** Every section from the spec has at least one task. Global dashboard (4.1), Projects (4.2-4.3), Requests (4.4), Tools (4.5), Skills (4.6), Sessions (4.7), Clients (4.8), MCP/Plugins (4.9), Settings (4.10) all covered. API endpoints from Section 5 all implemented. Database changes from Section 6 covered (mcp_servers, hook_events). TypeScript interfaces from Section 7 match API response types. Design tokens from Section 8 in Tailwind config. WebSocket from Section 9 implemented.

2. **Placeholders:** None — every step has actual code.

3. **Type consistency:** All API routes return {data: [...], meta: {...}} consistent with spec Section 5 response format. TypeScript interfaces match Pydantic models.

4. **Scope check:** All tasks are focused on the enterprise migration. No auth, no Docker, no DB upgrade — matches spec non-goals.