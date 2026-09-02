# Claude Telemetry Enterprise UI

Static multi-page enterprise UI prototype for the Claude Token Telemetry v5 architecture. The sidebar can be minimized, and cost/pricing fields are intentionally excluded from the UI.

## Pages
- `index.html` — global command center
- `projects.html` — project inventory
- `project.html?id=checkout-api` — isolated project workspace
- `requests.html` — request/usage explorer
- `sessions.html` — session history
- `tools.html` — tool telemetry
- `skills.html` — skill activation telemetry
- `clients.html` — IDE/client analytics
- `settings.html` — collector/data semantics

## Design system
`DESIGN.md` follows the Google Labs DESIGN.md format: YAML design tokens plus ordered rationale sections. The UI intentionally distinguishes exact request usage from estimated tool/path attribution.

Source specification: https://github.com/google-labs-code/design.md

## Run
Primary UI is the React app in `frontend/` (Vite + TypeScript + Tailwind + Recharts), talking to the FastAPI backend over `/api/v1` and a `/ws/live` WebSocket:

```
cd backend && python run.py          # API on :8000
cd frontend && npm install && npm run dev   # React UI on :5173
```

`start_dashboard.bat` does both, plus a reconcile pass. Open `http://localhost:5173`.

A lighter static HTML/JS fallback (`index.html`, `assets/app.js`, no Node required) still ships in the repo root and talks to the same backend — serve it with `python -m http.server 8080` and open `http://127.0.0.1:8080/index.html` if you'd rather skip the npm toolchain. Opening either UI via `file://` will not work — the browser blocks the cross-origin API fetch.
