# Claude Token Telemetry v4

A Windows-friendly local telemetry application for Claude Code. Install it once and use it across projects.

## What it tracks

- Exact recorded API request usage: input, output, cache read, cache write
- Cost, model/provider and context-window metadata when available
- Projects, sessions and best-effort client/IDE classification
- Prompt/response previews
- Tool calls and tool inputs
- Files/directories referenced by tools
- Skill invocations and trigger/source/plugin metadata when supplied
- Agent/subagent metadata from hook payloads
- Raw hook events
- Estimated token attribution to tools, directories and paths

## Accuracy model

**Exact:** request-level usage recorded in Claude Code transcript usage fields.

**Estimated:** tool/file/directory attribution. A request's recorded tokens are divided across nearby matched tool calls and then across paths referenced by those calls. This prevents the dashboard from multiplying the same request tokens when one tool references several files, but it is still an inference, not upstream billing allocation.

So the dashboard can say:

`node_modules: ~2.0M estimated attributed tokens`

It should not claim:

`node_modules caused exactly 2.0M billed tokens`

## Windows installation

Open PowerShell in this folder:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install_windows.ps1
```

Install global Claude Code hooks:

```powershell
.\install_windows.ps1 -InstallHooks
```

Create a Windows logon task that continuously reconciles Claude Code transcripts:

```powershell
.\install_windows.ps1 -InstallHooks -CreateStartupTask
```

The startup task runs:

```text
python -m telemetry.daemon
```

It polls the Claude Code projects directory every 5 seconds by default. Change it with:

```powershell
$env:CLAUDE_TELEMETRY_INTERVAL="10"
```

## Dashboard

Easiest:

```bat
start_dashboard.bat
```

Or:

```bat
.venv\Scripts\python.exe -m telemetry.reconcile
.venv\Scripts\python.exe -m streamlit run app.py
```

## Existing history

The first reconciliation scans:

```text
%USERPROFILE%\.claude\projects\**\*.jsonl
```

Override the Claude config directory if needed:

```powershell
$env:CLAUDE_CONFIG_DIR="C:\path\to\.claude"
```

Override the database:

```powershell
$env:CLAUDE_TELEMETRY_DB="C:\path\to\telemetry.db"
```

## Global behavior

The hooks are installed in the user-level Claude Code settings:

```text
%USERPROFILE%\.claude\settings.json
```

That means the collector is not tied to a repository. When Claude Code runs in another project, its hook payload/transcript supplies the session and working-directory context, so the same local database can aggregate all projects.

## Files

- `app.py` — Streamlit dashboard
- `telemetry/db.py` — SQLite schema and migrations
- `telemetry/reconcile.py` — transcript importer + attribution engine
- `telemetry/collector.py` — hook event collector
- `telemetry/daemon.py` — lightweight polling daemon
- `hooks/claude-telemetry-hook.py` — Claude Code hook entry point
- `install_windows.ps1` — Windows installer/global hook + startup task
- `start_dashboard.bat` — dashboard launcher
- `start_daemon.bat` — manual daemon launcher

## Privacy

Everything is local by default. The database contains prompt/response previews and raw hook payloads. Treat the SQLite database as sensitive local telemetry.

## Claude Desktop / claude.ai

Claude Code transcript telemetry does not automatically equal Claude Desktop or claude.ai telemetry. Those clients need their own supported data source/export/API integration before their usage can be merged into this database.
