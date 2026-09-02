# tokentelemetry

Install and run the [Claude Telemetry Enterprise](https://github.com/sarveshtalele/tokentelemetry)
console — a local-first FastAPI backend + React dashboard for Claude Code
token/tool/skill/hook telemetry — as a global tool on Windows, macOS, and
Linux, with Claude Code hooks wired up automatically.

The npm package bundles the backend, telemetry collector, hooks, and a
pre-built copy of the dashboard, so no separate `git clone` is required.

## Usage

```
npx tokentelemetry              # install (first run) + start everything
npx tokentelemetry install      # copy app files, set up the Python env, wire Claude Code hooks
npx tokentelemetry start        # start the backend, telemetry daemon, and dashboard
npx tokentelemetry status       # show install location, running processes, health checks
npx tokentelemetry stop         # stop everything started by "start"
npx tokentelemetry uninstall    # remove the Claude Code hooks (add --purge to also delete app files)
```

Then open **http://127.0.0.1:5173**.

## What "install" does

1. Copies the bundled backend/telemetry/hooks/dashboard into
   `~/.tokentelemetry` (override with `TOKENTELEMETRY_HOME`).
2. Creates a Python virtual environment there, preferring
   [`uv`](https://docs.astral.sh/uv/) when it's on `PATH` (falls back to the
   standard `venv`/`pip`), and installs the FastAPI backend's dependencies.
3. Merges the telemetry hook into your Claude Code settings
   (`~/.claude/settings.json`, or `$CLAUDE_CONFIG_DIR/settings.json`) for the
   `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and
   `Stop` events — safe to re-run, entries are de-duplicated.

## What "start" does

Runs three local processes (see `tokentelemetry status` for health/PIDs, and
`~/.tokentelemetry/logs/` for their output):

- FastAPI backend on `http://127.0.0.1:8000`
- Telemetry reconcile daemon (polls Claude Code session transcripts)
- A static file server for the dashboard on `http://127.0.0.1:5173`

Autostart at login isn't configured automatically — `tokentelemetry status`
prints the exact command to wire into Task Scheduler (Windows), launchd
(macOS), or a systemd `--user` service (Linux) if you want the daemon
running in the background after you log in.

## Requirements

- Node.js 18+ (to run `npx`)
- Python 3.9+ on `PATH` (or [`uv`](https://docs.astral.sh/uv/), which is
  preferred automatically when present)
