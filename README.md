# Claude Telemetry Enterprise

Local-first observability console for [Claude Code](https://claude.com/claude-code): exact
per-request token usage, plus estimated tool/file/skill attribution — tools, MCP servers,
hooks, sessions, and projects, all in one dashboard. Everything runs on your machine against
a local SQLite database; nothing is sent anywhere else.

- **Exact vs. estimated** — token counts come straight from the Claude API; per-file/tool
  attribution is a clearly-labeled heuristic (see the in-app **About** page, or `DESIGN.md`).
- **Full prompt/response inspection** — drill into any request and open the complete,
  untruncated prompt and response in its own page.
- **Dark / light mode**, all-time (or custom range) data, per-project breakdowns of the
  skills/MCP servers/hooks used most.
- **No cost/pricing columns** in the primary UI — intentionally excluded (see `DESIGN.md`).

## Quick start (install locally)

`tokentelemetry` isn't published to the npm registry — it's not a bare `npx tokentelemetry`
you can run from just anywhere. Instead, build the CLI package straight from this repo and
install it once, on **Windows, macOS, or Linux**:

```bash
git clone https://github.com/sarveshtalele/tokentelemetry.git
cd tokentelemetry/cli
npm pack --pack-destination /tmp          # builds the package (vendors backend + built dashboard)
npm install -g /tmp/tokentelemetry-1.0.0.tgz   # installs the `tokentelemetry` command globally
```

From then on, `tokentelemetry` is a normal command on your `PATH` — no repo checkout needed
to run it, and no further `npm pack`/`npm install` unless you pull new changes and want to
rebuild:

```bash
tokentelemetry install    # copies the app to ~/.tokentelemetry, sets up a Python env,
                           # wires the Claude Code hooks into ~/.claude/settings.json
tokentelemetry start      # starts everything
```

Then open **http://127.0.0.1:5173**.

| Command | What it does |
|---|---|
| `tokentelemetry install` | Set up the app + Python env + Claude Code hooks (safe to re-run) |
| `tokentelemetry start` | Start the backend (`:8000`), telemetry daemon, and dashboard (`:5173`) |
| `tokentelemetry status` | Show install location, running processes, and health checks |
| `tokentelemetry stop` | Stop everything started by `start` |
| `tokentelemetry uninstall [--purge]` | Remove the Claude Code hooks (`--purge` also deletes app files) |

Requires Node.js 18+ and Python 3.9+ on `PATH` — or [`uv`](https://docs.astral.sh/uv/), which
is used automatically when present (faster env setup). Full details:
[`cli/README.md`](cli/README.md).

**Picked up a new commit and want the CLI rebuilt?** Re-run the `npm pack` /
`npm install -g` step above from a fresh `git pull` — that overwrites the global command with
the new build.

## Running it every time

`tokentelemetry start` doesn't survive a reboot by itself — it just launches three
background processes. Two ways to keep it running:

- **On demand:** run `tokentelemetry start` whenever you want it; `tokentelemetry stop` to
  shut it down. `tokentelemetry status` tells you what's currently running.
- **Automatically at login:** wire the telemetry daemon into your OS's startup scheduler
  (see below for Windows; `tokentelemetry status` also prints the exact command for your
  platform).

### Start automatically at Windows login

`tokentelemetry install` puts everything under `%USERPROFILE%\.tokentelemetry`. To have the
dashboard running whenever you log in, register a Task Scheduler task that runs
`tokentelemetry start` at logon. This assumes you've already done the global install from
[Quick start](#quick-start-install-locally) above, so `tokentelemetry` is on `PATH`.

**Option A — PowerShell (recommended, one-time setup):**

```powershell
$Tokentelemetry = (Get-Command tokentelemetry.cmd).Source
$Action  = New-ScheduledTaskAction -Execute $Tokentelemetry -Argument "start"
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName "Claude Token Telemetry" -Action $Action -Trigger $Trigger -Principal $Principal -Force
```

Run this once (as your normal user, no admin needed) after `tokentelemetry install`.
From then on, the backend, daemon, and dashboard start automatically every time you log in.

**Option B — Task Scheduler GUI:**

1. Open **Task Scheduler** → **Create Task…**
2. **General** tab: name it `Claude Token Telemetry`; under *Security options* choose
   "Run only when user is logged on".
3. **Triggers** tab → **New…** → *Begin the task:* **At log on** → OK.
4. **Actions** tab → **New…** → *Program/script:* the full path to `tokentelemetry.cmd`
   (find it by running `where tokentelemetry` in a terminal) → *Add arguments:* `start`.
5. Save. Test it immediately with **Run** in the task list.

To undo: delete the task from Task Scheduler, or run:
`Unregister-ScheduledTask -TaskName "Claude Token Telemetry" -Confirm:$false`.

**macOS / Linux:** run `tokentelemetry status` for the equivalent `launchd`
(`~/Library/LaunchAgents`) / `systemd --user` command and working directory to wire up.

## How data collection works

Data capture does **not** depend on `tokentelemetry start` being on:

1. `install` wires 5 hooks (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
   `Stop`) into Claude Code's own `settings.json`. Claude Code invokes these directly, so raw
   tool-call/skill events land in the SQLite DB the moment they happen — dashboard running or
   not.
2. Per-request token usage (and full prompt/response text) comes from **reconcile**, which
   parses Claude Code's session transcripts. This runs on a timer once the daemon is started
   (`start`, or the autostart task above), and it's idempotent — it tracks each transcript
   file's mtime/size, so turning the daemon off for a while and back on backfills everything
   it missed, nothing is lost.

## Manual / development setup

If you're working on the app itself rather than just running it, skip the CLI and run the
pieces directly:

```bash
cd backend && python run.py                # API on :8000
cd frontend && npm install && npm run dev   # React UI on :5173
```

`start_dashboard.bat` (Windows) does both, plus a reconcile pass. A lighter static
HTML/JS fallback (`index.html`, `assets/app.js`, no Node required) also ships in the repo
root — serve it with `python -m http.server 8080` if you'd rather skip the npm toolchain.
Opening either UI via `file://` will not work — the browser blocks the cross-origin API
fetch.

### Pages
- `/` — global command center · `/projects` — project inventory · `/projects/:id` — project
  workspace (with per-project skill/MCP/hook usage) · `/requests` and `/requests/:id` — request
  explorer and full prompt/response view · `/sessions`, `/tools`, `/skills`, `/clients`,
  `/mcp-plugins` — telemetry breakdowns · `/settings` — collector/data semantics ·
  `/about` — what "estimated attribution" means and what this tool tracks

### Tests

```bash
uv venv .venv && uv pip install -p .venv -r backend/requirements-dev.txt   # or plain venv/pip
.venv/bin/python -m pytest tests/test_backend_api.py
```

## Design system

`DESIGN.md` follows the Google Labs DESIGN.md format: YAML design tokens plus ordered
rationale sections, including light/dark theming rules and the exact-vs-estimated labeling
convention. Source specification: https://github.com/google-labs-code/design.md
