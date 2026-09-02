# tokentelemetry

Install and run the [Claude Telemetry Enterprise](https://github.com/sarveshtalele/tokentelemetry)
console — a local-first FastAPI backend + React dashboard for Claude Code
token/tool/skill/hook telemetry — as a global tool on Windows, macOS, and
Linux, with Claude Code hooks wired up automatically.

The npm package bundles the backend, telemetry collector, hooks, and a
pre-built copy of the dashboard, so once it's built, no separate `git clone`
is required to run it.

This package is **not published to the npm registry** — build and install it
locally from a checkout of this repo. The easiest way is the one-shot setup
script, which detects your system, builds + installs the global
`tokentelemetry` command, runs the app install, and then drops you into an
interactive Start/Stop/Status/Uninstall menu:

```
git clone https://github.com/sarveshtalele/tokentelemetry.git
cd tokentelemetry
node cli/setup.js
```

To do the same steps by hand instead (e.g. for scripting, or if you just
want the global command without the interactive menu):

```
cd tokentelemetry/cli
npm pack --pack-destination /tmp              # runs the prepack build (vendors everything)
npm install -g /tmp/tokentelemetry-1.0.0.tgz  # installs `tokentelemetry` globally
```

## Usage

```
tokentelemetry                    # install (first run) + start everything
tokentelemetry install            # copy app files, set up the Python env, wire Claude Code hooks
tokentelemetry start              # start the backend, telemetry daemon, and dashboard
tokentelemetry status             # show install location, running processes, health checks
tokentelemetry stop               # stop everything started by "start"
tokentelemetry autostart enable   # start automatically at login (Task Scheduler / launchd / systemd)
tokentelemetry autostart disable  # remove the autostart entry
tokentelemetry uninstall          # remove the Claude Code hooks (add --purge to also delete app files)
```

Then open **http://127.0.0.1:5173**.

None of the commands above rebuild or reinstall anything — each just does
the one thing named. Only bare `node cli/setup.js` (or `node cli/setup.js
install`) does the full detect + build + install. If you're running from
the repo checkout rather than the global command, `cli/setup.js` has the
same fast subcommands and skips the rebuild too:

```
node cli/setup.js start     # start the backend, daemon, and dashboard
node cli/setup.js stop      # stop everything
node cli/setup.js status    # show what's running
node cli/setup.js delete    # full teardown: remove hooks + ~/.tokentelemetry
node cli/setup.js uninstall # remove hooks only, keep app files/database (add --purge for delete's behavior)
node cli/setup.js install   # re-run the full build+install, e.g. after `git pull`
```

If this ever gets published to npm for real, the global-command usage above
collapses to plain `npx tokentelemetry ...` — no local build/install step
needed.

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
