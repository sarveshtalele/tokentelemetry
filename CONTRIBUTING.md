# Contributing to Claude Telemetry Enterprise

Issues and PRs are welcome. This is a small local-first tool, so the bar is: does it work,
is it tested, and does it match the existing style.

## Before opening a PR

1. **Run the checks:**
   ```bash
   uv venv .venv && uv pip install -p .venv -r backend/requirements-dev.txt
   .venv/bin/python -m pytest tests/test_backend_api.py tests/test_reconcile.py
   cd frontend && npm run build   # type-checks + builds
   ```
   Both should be clean before you push. CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml))
   runs the same checks (plus `npm audit`) automatically on every push and pull request, so a
   red check there means one of these didn't pass.
2. **Keep diffs focused.** Small, single-purpose PRs over drive-by refactors.
3. **Match the code style:** no comments unless they explain a non-obvious *why* (a hidden
   constraint, a workaround, a subtle invariant) — not what the code already says.

## Where things live

See [Development](README.md#development) in the README for the full layout.
The one thing worth knowing up front: **there is exactly one schema and one
collector/reconcile implementation**, in `telemetry/`. `backend/` imports it directly
(see the `sys.path` bootstrap in `backend/app/main.py`) rather than keeping its own copy —
that used to be three separate, independently-drifting copies of the same logic, which is
exactly the kind of bug this project doesn't want back. If you're touching schema or
reconcile logic, `telemetry/` is the one place to change it.

## Reporting bugs

Open an issue with: what you ran, what you expected, what happened instead, and — if it's
data-related — the relevant table's row count from the Settings page (no need to share the
actual telemetry data, which stays local to your machine).

## Feature requests

Open an issue describing the use case, not just the feature. This is a niche, opinionated
tool (local-first, no cost/pricing columns by design, exact vs. estimated always labeled) —
some requests will be a deliberate no, and it helps to know the "why" behind a request before
deciding.

## Security

**Please don't open a public issue for a suspected vulnerability.** See
[`SECURITY.md`](SECURITY.md) for how to report it privately, and
[`docs/SECURITY.md`](docs/SECURITY.md) for the project's threat model and full security
review — it explains what's in scope (e.g. a path-traversal or injection bug) versus accepted
risk for a local-first, single-user tool (e.g. no backend authentication, since it only binds
to `127.0.0.1`).
